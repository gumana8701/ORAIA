/**
 * ORAIA WhatsApp Bot
 * Listens to all WA groups, pushes new messages to Supabase in real-time,
 * runs alert detection, and updates project stats.
 */

const { Client, LocalAuth, NoAuth } = require('whatsapp-web.js')
const fs = require('fs')
const path = require('path')

// Clean up any stale Chromium locks before starting
const SESSION_PATH = '/tmp/oraia-wa-session'
try {
  const lockFiles = ['SingletonLock', 'SingletonSocket', 'SingletonCookie', 'lockfile']
  for (const f of lockFiles) {
    const p = path.join(SESSION_PATH, f)
    if (fs.existsSync(p)) { fs.unlinkSync(p); console.log(`[startup] Cleaned lock: ${f}`) }
  }
} catch(e) {}
const qrcode = require('qrcode-terminal')
const { createClient } = require('@supabase/supabase-js')

// ── Config ────────────────────────────────────────────────────────────────────
const SUPABASE_URL = 'https://nhsxwgrekdmkxemdoqqx.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oc3h3Z3Jla2Rta3hlbWRvcXF4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjgyODE2NywiZXhwIjoyMDg4NDA0MTY3fQ.5rbxlYG2Z5wY5GoacHbr-rOruvY4nsPu_yHEfEP0kMM'
const OWN_NUMBER   = '50378888120'   // your WA number — skip self-messages

const sb = createClient(SUPABASE_URL, SUPABASE_KEY)

// ── Grupos privados — NUNCA procesar, NUNCA crear proyecto ────────────────────
// ⚠️  PERMANENTE: estos grupos son personales y NUNCA deben aparecer en ORAIA
const PRIVATE_GROUPS = [
  'niña maitra',
  'maitra',
  'beer&grill',
  'beer & grill',
  'familia 2.0',
  'familia2.0',
  '2nd grade',
  '5th b',
  '5th grade',
]
function isPrivateGroup(name = '') {
  const n = name.toLowerCase().trim()
  return PRIVATE_GROUPS.some(pg => n.includes(pg))
}

// ── Team detection ─────────────────────────────────────────────────────────────
const TEAM_KEYWORDS = [
  'jennifer ora', 'javi ora', 'ora ia', 'hector ora', 'hector ramirez',
  'trina gomez', 'jorge salamanca', 'enzo ora', 'kevin ora', 'luca fonzo',
  'guillermo'
]
function isTeam(name = '') {
  const n = name.toLowerCase()
  return TEAM_KEYWORDS.some(kw => n.includes(kw))
}

// ── Alert rules ───────────────────────────────────────────────────────────────
const ALERT_RULES = [
  { keywords: ['cancelar','cancelación','cancelo','me voy','no quiero continuar','quiero salir','quiero retirarme'],
    tipo: 'cancelacion', nivel: 'critico', desc: 'Cliente menciona cancelación o salida' },
  { keywords: ['reembolso','reembolsar','devolver el dinero'],
    tipo: 'reembolso',   nivel: 'critico', desc: 'Cliente solicita reembolso' },
  { keywords: ['decepcionado','decepcionada','molesto','molesta','frustrado','frustrada','pésimo','terrible','muy mal','no funciona','insatisfecho'],
    tipo: 'enojo',       nivel: 'alto',    desc: 'Cliente expresa enojo o frustración' },
  { keywords: ['urgente','lo necesito ya','necesito hoy','es urgente','para hoy','inmediatamente'],
    tipo: 'urgente',     nivel: 'medio',   desc: 'Cliente solicita atención urgente' },
  { keywords: ['no han entregado','cuándo entregan','retrasado','atraso','se pasaron del plazo'],
    tipo: 'entrega',     nivel: 'alto',    desc: 'Problema con entrega o plazo' },
  { keywords: ['no he recibido','falta el pago','cobro incorrecto','me cobraron de más'],
    tipo: 'pago',        nivel: 'alto',    desc: 'Problema relacionado con pagos' },
]

function detectAlerts(text) {
  const tl = text.toLowerCase()
  const results = []
  const seen = new Set()
  for (const rule of ALERT_RULES) {
    if (seen.has(rule.tipo)) continue
    for (const kw of rule.keywords) {
      if (tl.includes(kw)) {
        results.push({ tipo: rule.tipo, nivel: rule.nivel, desc: rule.desc })
        seen.add(rule.tipo)
        break
      }
    }
  }
  return results
}

// ── Project cache (group name → project id) ───────────────────────────────────
let projectCache = {}   // waGroupName → project_id

async function loadProjectCache() {
  const { data } = await sb.from('projects').select('id, nombre, whatsapp_chat_id').execute()
  projectCache = {}
  for (const p of data ?? []) {
    // Index by cleaned group name variations
    const keys = [
      p.nombre?.toLowerCase().trim(),
      p.whatsapp_chat_id?.toLowerCase().trim(),
    ]
    for (const k of keys) {
      if (k) projectCache[k] = p.id
    }
  }
  console.log(`[cache] Loaded ${Object.keys(projectCache).length} project keys`)
}

function cleanGroupName(raw = '') {
  // Strip common suffixes from WA group names to match our project names
  return raw
    .replace(/\s*[xX]\s*ORA\s*IA.*$/i, '')
    .replace(/\s*[-–]\s*ORA\s*IA.*$/i, '')
    .replace(/\s*ORA\s*IA\s*/i, '')
    .replace(/^DFY\s*[-–]?\s*/i, '')
    .replace(/^[🔴🟡🟢🟣]\s*/, '')
    .trim()
    .toLowerCase()
}

async function findOrCreateProject(groupName, rawGroupName) {
  // Try direct match
  const cleaned = cleanGroupName(rawGroupName)
  if (projectCache[cleaned]) return projectCache[cleaned]

  // Try partial match
  for (const [key, id] of Object.entries(projectCache)) {
    if (key.includes(cleaned) || cleaned.includes(key.substring(0, 10))) {
      return id
    }
  }

  // Create new project
  console.log(`[project] Creating new project for group: ${rawGroupName}`)
  const { data } = await sb.from('projects').insert({
    nombre: groupName,
    cliente: groupName,
    estado: 'activo',
    prioridad: 'media',
    responsable: null,
    progreso: 0,
    whatsapp_chat_id: rawGroupName,
    total_mensajes: 0,
    alertas_count: 0,
  }).select('id').single().execute()

  if (data?.id) {
    projectCache[cleaned] = data.id
    return data.id
  }
  return null
}

// ── Message handler ───────────────────────────────────────────────────────────
async function handleMessage(msg, client) {
  try {
    // Only process group messages
    if (!msg.from.endsWith('@g.us')) return

    // Skip media — text only
    if (msg.hasMedia) return

    const body = msg.body?.trim()
    if (!body || body.length < 2) return

    // Get group info
    const chat      = await msg.getChat()
    const contact   = await msg.getContact()
    const groupName = chat.name ?? 'Grupo desconocido'

    // Hard-block private groups — no logging, no project creation, no storage
    if (isPrivateGroup(groupName)) return

    const sender    = contact.pushname || contact.number || 'Desconocido'
    const team      = isTeam(sender)

    console.log(`[msg] ${groupName} | ${sender} | ${body.substring(0, 60)}`)

    // Find project
    const projectId = await findOrCreateProject(groupName, groupName)
    if (!projectId) {
      console.warn(`[warn] Could not resolve project for: ${groupName}`)
      return
    }

    // Insert message
    const { data: inserted } = await sb.from('messages').insert({
      project_id:      projectId,
      fuente:          'whatsapp',
      sender:          sender,
      contenido:       body.substring(0, 2000),
      timestamp:       new Date(msg.timestamp * 1000).toISOString(),
      es_del_cliente:  !team,
      metadata:        { wa_id: msg.id._serialized, group: groupName },
    }).select('id').single().execute()

    // Detect alerts (client messages only)
    let newAlerts = 0
    if (!team && inserted?.id) {
      const alerts = detectAlerts(body)
      for (const a of alerts) {
        await sb.from('alerts').insert({
          project_id:  projectId,
          message_id:  inserted.id,
          tipo:        a.tipo,
          nivel:       a.nivel,
          descripcion: `${a.desc} — "${body.substring(0, 120)}"`,
          resuelta:    false,
        }).execute()
        newAlerts++
      }
    }

    // Update project stats
    const { count } = await sb.from('messages').select('*', { count: 'exact', head: true })
      .eq('project_id', projectId).execute()
    const { count: alertCount } = await sb.from('alerts').select('*', { count: 'exact', head: true })
      .eq('project_id', projectId).eq('resuelta', false).execute()

    await sb.from('projects').update({
      ultimo_mensaje:   body.substring(0, 300),
      ultima_actividad: new Date(msg.timestamp * 1000).toISOString(),
      total_mensajes:   count ?? 0,
      alertas_count:    alertCount ?? 0,
    }).eq('id', projectId).execute()

    console.log(`[ok] Saved · ${groupName} · alerts: ${newAlerts}`)

  } catch (err) {
    console.error('[error]', err.message)
  }
}

// ── WhatsApp client ───────────────────────────────────────────────────────────
const client = new Client({
  authStrategy: new LocalAuth({
    clientId: 'oraia-bot',
    dataPath: '/tmp/oraia-wa-session'
  }),
  puppeteer: {
    headless: true,
    executablePath: '/usr/bin/chromium-browser',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--no-first-run',
      '--disable-default-apps',
      '--disable-extensions',
      '--disable-background-networking',
      '--single-process',
    ],
  }
})

client.on('qr', qr => {
  console.log('\n📱 Escanea este QR con WhatsApp → Dispositivos vinculados:\n')
  qrcode.generate(qr, { small: true })
})

client.on('authenticated', () => console.log('✅ WhatsApp autenticado'))
client.on('auth_failure', msg => console.error('❌ Auth falló:', msg))

client.on('ready', async () => {
  console.log(`\n🟢 Bot ORAIA conectado como +${OWN_NUMBER}`)
  await loadProjectCache()
  console.log('👂 Escuchando mensajes de todos los grupos...\n')
})

client.on('message', msg => handleMessage(msg, client))
client.on('message_create', msg => {
  // Also capture own messages (team messages sent from this number)
  if (msg.fromMe) handleMessage(msg, client)
})

// Refresh project cache every 5 minutes
setInterval(loadProjectCache, 5 * 60 * 1000)

console.log('🚀 Iniciando bot ORAIA WhatsApp...')
client.initialize()
