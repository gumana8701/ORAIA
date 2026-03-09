/**
 * ORAIA Slack Sync
 * Pulls message history from all channels → Supabase messages table
 * Run once for backfill, then on a cron for incremental updates.
 */

const { createClient } = require('@supabase/supabase-js')

// Load from .env if present
try { require('fs').readFileSync('.env','utf8').split('\n').forEach(l=>{ const [k,...v]=l.split('='); if(k&&v.length) process.env[k.trim()]=v.join('=').trim() }) } catch {}

const SLACK_TOKEN  = process.env.SLACK_BOT_TOKEN
const SB_URL       = process.env.NEXT_PUBLIC_SUPABASE_URL
const SB_KEY       = process.env.SUPABASE_SERVICE_ROLE_KEY

// How far back to pull on first sync (days)
const BACKFILL_DAYS = 90

const sb = createClient(SB_URL, SB_KEY)

// ── Slack API helper ──────────────────────────────────────────────────────────
async function slack(method, params = {}) {
  const qs = new URLSearchParams(params).toString()
  const url = `https://slack.com/api/${method}${qs ? '?' + qs : ''}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${SLACK_TOKEN}` } })
  const data = await res.json()
  if (!data.ok) throw new Error(`Slack ${method}: ${data.error}`)
  return data
}

// ── User cache ────────────────────────────────────────────────────────────────
const userCache = {}
async function resolveUser(userId) {
  if (!userId) return 'Desconocido'
  if (userCache[userId]) return userCache[userId]
  try {
    const { user } = await slack('users.info', { user: userId })
    const name = user.profile?.display_name || user.real_name || user.name || userId
    userCache[userId] = name
    // Upsert to slack_users
    await sb.from('slack_users').upsert({
      slack_user_id: userId,
      display_name:  user.profile?.display_name || null,
      real_name:     user.real_name || null,
      is_bot:        user.is_bot || false,
      updated_at:    new Date().toISOString(),
    }, { onConflict: 'slack_user_id' })
    return name
  } catch {
    userCache[userId] = userId
    return userId
  }
}

// ── Alert detection (same rules as WA bot) ───────────────────────────────────
const ALERT_RULES = [
  { keywords: ['cancelar','cancelación','cancelo','me voy','no quiero continuar'], tipo: 'cancelacion', nivel: 'critico', desc: 'Posible cancelación mencionada en Slack' },
  { keywords: ['reembolso','reembolsar','devolver el dinero'],                      tipo: 'reembolso',   nivel: 'critico', desc: 'Reembolso mencionado en Slack' },
  { keywords: ['decepcionado','molesto','frustrado','pésimo','terrible','muy mal'], tipo: 'enojo',       nivel: 'alto',    desc: 'Frustración detectada en Slack' },
  { keywords: ['urgente','lo necesito ya','para hoy','inmediatamente'],             tipo: 'urgente',     nivel: 'medio',   desc: 'Urgencia detectada en Slack' },
  { keywords: ['no han entregado','retrasado','atraso','se pasaron del plazo'],     tipo: 'entrega',     nivel: 'alto',    desc: 'Problema de entrega mencionado en Slack' },
  { keywords: ['bloqueado','bloqueada','no podemos avanzar','estamos atascados'],   tipo: 'urgente',     nivel: 'alto',    desc: 'Bloqueo de proyecto detectado en Slack' },
]
function detectAlerts(text) {
  const tl = text.toLowerCase()
  const results = []
  const seen = new Set()
  for (const rule of ALERT_RULES) {
    if (seen.has(rule.tipo)) continue
    for (const kw of rule.keywords) {
      if (tl.includes(kw)) { results.push(rule); seen.add(rule.tipo); break }
    }
  }
  return results
}

// ── Load / register channels ──────────────────────────────────────────────────
async function loadChannels() {
  // Fetch from Slack
  const { channels } = await slack('conversations.list', {
    types: 'public_channel,private_channel',
    limit: 200,
    exclude_archived: true,
  })

  // Load existing project mappings from Supabase
  const { data: existing } = await sb.from('slack_channels').select('*')
  const existingMap = Object.fromEntries((existing || []).map(r => [r.channel_id, r]))

  // Load projects with slack_channel_id set
  const { data: projects } = await sb.from('projects').select('id,nombre,slack_channel_id')
  const projBySlackId = Object.fromEntries(
    (projects || []).filter(p => p.slack_channel_id).map(p => [p.slack_channel_id.toLowerCase(), p.id])
  )
  // Also match by channel name vs project name
  const projByName = Object.fromEntries(
    (projects || []).map(p => [p.nombre.toLowerCase().replace(/[^a-z0-9]/g, ''), p.id])
  )

  const channelRecords = channels.map(ch => {
    const existing_ = existingMap[ch.id]
    // Try to find matching project
    const projectId = projBySlackId[ch.id]
      || projBySlackId[ch.name.toLowerCase()]
      || existing_?.project_id
      || null

    // Classify channel type
    let channelType = 'general'
    if (ch.name.startsWith('project-')) channelType = 'project'
    else if (['general','varios','outreach'].includes(ch.name)) channelType = 'general'
    else channelType = 'team'

    return {
      channel_id:   ch.id,
      channel_name: ch.name,
      project_id:   projectId,
      channel_type: channelType,
      last_cursor:  existing_?.last_cursor || null,
      is_active:    true,
    }
  })

  // Upsert all
  await sb.from('slack_channels').upsert(channelRecords, { onConflict: 'channel_id' })
  console.log(`[channels] Registered ${channelRecords.length} channels`)
  return channelRecords
}

// ── Join channels bot isn't in ────────────────────────────────────────────────
async function joinChannel(channelId) {
  try {
    await slack('conversations.join', { channel: channelId })
  } catch (e) {
    // already_in_channel is fine
    if (!e.message.includes('already_in_channel')) console.warn(`[join] ${channelId}: ${e.message}`)
  }
}

// ── Sync one channel ──────────────────────────────────────────────────────────
async function syncChannel(channel, projectMap) {
  const { channel_id, channel_name, project_id, last_cursor } = channel

  await joinChannel(channel_id)

  // Determine oldest timestamp to pull
  const oldest = last_cursor
    ? String(parseFloat(last_cursor) + 0.000001) // just after last synced
    : String((Date.now() / 1000) - (BACKFILL_DAYS * 86400))

  let cursor    = undefined
  let totalNew  = 0
  let latestTs  = last_cursor

  console.log(`[sync] #${channel_name} — from ${new Date(parseFloat(oldest)*1000).toISOString().slice(0,10)}`)

  do {
    const params = { channel: channel_id, limit: 200, oldest }
    if (cursor) params.cursor = cursor

    let history
    try {
      history = await slack('conversations.history', params)
    } catch (e) {
      console.warn(`[skip] #${channel_name}: ${e.message}`)
      break
    }

    const messages = (history.messages || []).filter(m =>
      m.type === 'message' && !m.subtype && m.text?.trim()
    )

    for (const msg of messages) {
      const sender = await resolveUser(msg.user)

      // Skip bot messages from our own bot
      if (msg.bot_id) continue

      const ts      = new Date(parseFloat(msg.ts) * 1000).toISOString()
      const content = msg.text.slice(0, 2000)

      // Find project for this channel
      let pid = project_id
      // For team channels, try to infer project from message content
      if (!pid && projectMap) {
        for (const [name, id] of Object.entries(projectMap)) {
          if (content.toLowerCase().includes(name.toLowerCase().substring(0, 8))) {
            pid = id; break
          }
        }
      }
      if (!pid) continue // Skip messages not tied to any project

      // Check for duplicates (by slack ts + project)
      const { count } = await sb.from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', pid)
        .eq('fuente', 'slack')
        .eq('metadata->>slack_ts', msg.ts)

      if (count && count > 0) continue // already synced

      // Insert message
      const { data: inserted } = await sb.from('messages').insert({
        project_id:     pid,
        fuente:         'slack',
        sender:         sender,
        contenido:      content,
        timestamp:      ts,
        es_del_cliente: false, // Slack = internal team
        metadata: {
          slack_ts:      msg.ts,
          slack_channel: channel_id,
          channel_name:  channel_name,
          thread_ts:     msg.thread_ts || null,
        },
      }).select('id').single()

      // Alert detection
      if (inserted?.id) {
        const alerts = detectAlerts(content)
        for (const a of alerts) {
          await sb.from('alerts').insert({
            project_id:  pid,
            message_id:  inserted.id,
            tipo:        a.tipo,
            nivel:       a.nivel,
            descripcion: `${a.desc} — "${content.slice(0, 120)}"`,
            resuelta:    false,
          })
        }
      }

      if (!latestTs || parseFloat(msg.ts) > parseFloat(latestTs)) latestTs = msg.ts
      totalNew++
    }

    cursor = history.response_metadata?.next_cursor || null
  } while (cursor)

  // Update cursor + project stats
  if (latestTs !== last_cursor) {
    await sb.from('slack_channels')
      .update({ last_cursor: latestTs })
      .eq('channel_id', channel_id)
  }

  // Update project ultima_actividad if we got messages
  if (totalNew > 0 && project_id) {
    const { count: total } = await sb.from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', project_id)
    const { count: alertCount } = await sb.from('alerts')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', project_id)
      .eq('resuelta', false)
    await sb.from('projects').update({
      ultima_actividad: new Date(parseFloat(latestTs) * 1000).toISOString(),
      total_mensajes:   total ?? 0,
      alertas_count:    alertCount ?? 0,
    }).eq('id', project_id)
  }

  if (totalNew > 0) console.log(`  → ${totalNew} new messages`)
  return totalNew
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🔵 ORAIA Slack Sync starting...\n')

  const channels = await loadChannels()

  // Build project name map for fuzzy matching in team channels
  const { data: projects } = await sb.from('projects').select('id,nombre')
  const projectMap = Object.fromEntries((projects || []).map(p => [p.nombre, p.id]))

  let totalMessages = 0
  for (const ch of channels.filter(c => c.is_active)) {
    const count = await syncChannel(ch, projectMap)
    totalMessages += count
    // Rate limit: 1 req/sec to Slack API
    await new Promise(r => setTimeout(r, 1200))
  }

  console.log(`\n✅ Sync complete — ${totalMessages} new messages ingested across ${channels.length} channels`)
}

main().catch(err => { console.error('❌ Fatal:', err.message); process.exit(1) })
