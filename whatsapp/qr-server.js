/**
 * ORAIA WhatsApp QR Server
 * Muestra el QR en http://IP:3001/qr para escanear desde el teléfono
 */
const { Client, LocalAuth } = require('whatsapp-web.js')
const QRCode = require('qrcode')
const http = require('http')
const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')

const SUPABASE_URL = 'https://nhsxwgrekdmkxemdoqqx.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oc3h3Z3Jla2Rta3hlbWRvcXF4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjgyODE2NywiZXhwIjoyMDg4NDA0MTY3fQ.5rbxlYG2Z5wY5GoacHbr-rOruvY4nsPu_yHEfEP0kMM'
const sb = createClient(SUPABASE_URL, SUPABASE_KEY)

const TEAM_KEYWORDS = ['jennifer ora','javi ora','ora ia','hector ora','hector ramirez','trina gomez','jorge salamanca','enzo ora','kevin ora','luca fonzo','guillermo']
function isTeam(name=''){return TEAM_KEYWORDS.some(k=>name.toLowerCase().includes(k))}

// ── BLOCKLIST — grupos personales que NUNCA se deben ingestar ─────────────
const PERSONAL_GROUP_BLOCKLIST = [
  'niña maitra',
  "niña maitra's beer",
  'beer&grill',
  'beer & grill',
  'familia 2.0',
  'familia 2',
  '2nd grade',
  '5th b',
  '5th grade',
  'family',
  'familia',
]
function isBlocklisted(groupName=''){
  const lower = groupName.toLowerCase().trim()
  return PERSONAL_GROUP_BLOCKLIST.some(b => lower.includes(b))
}

const ALERT_RULES=[
  {keywords:['cancelar','cancelación','cancelo','me voy','quiero salir','quiero retirarme'],tipo:'cancelacion',nivel:'critico',desc:'Cliente menciona cancelación'},
  {keywords:['reembolso','reembolsar','devolver el dinero'],tipo:'reembolso',nivel:'critico',desc:'Cliente solicita reembolso'},
  {keywords:['decepcionado','decepcionada','molesto','molesta','frustrado','pésimo','terrible','muy mal','no funciona'],tipo:'enojo',nivel:'alto',desc:'Cliente expresa enojo'},
  {keywords:['urgente','lo necesito ya','es urgente','para hoy','inmediatamente'],tipo:'urgente',nivel:'medio',desc:'Solicitud urgente'},
  {keywords:['no han entregado','cuándo entregan','retrasado','atraso'],tipo:'entrega',nivel:'alto',desc:'Problema con entrega'},
  {keywords:['falta el pago','cobro incorrecto','me cobraron de más'],tipo:'pago',nivel:'alto',desc:'Problema de pago'},
]
function detectAlerts(text){
  const tl=text.toLowerCase(),res=[],seen=new Set()
  for(const r of ALERT_RULES){if(seen.has(r.tipo))continue;for(const k of r.keywords){if(tl.includes(k)){res.push(r);seen.add(r.tipo);break}}}
  return res
}

let qrImageData = null
let status = 'waiting_qr'
let projectCache = {}

async function loadCache(){
  const {data}=await sb.from('projects').select('id,nombre,whatsapp_chat_id')
  projectCache={}
  for(const p of data??[]){
    if(p.nombre) projectCache[p.nombre.toLowerCase().trim()]=p.id
    if(p.whatsapp_chat_id) projectCache[p.whatsapp_chat_id.toLowerCase().trim()]=p.id
  }
  console.log(`[cache] ${Object.keys(projectCache).length} proyectos cargados`)
}

function cleanName(raw=''){
  return raw.replace(/\s*[xX]\s*ORA\s*IA.*$/i,'').replace(/\s*[-–]\s*ORA\s*IA.*$/i,'')
    .replace(/\s*ORA\s*IA\s*/i,'').replace(/^DFY\s*[-–]?\s*/i,'').replace(/^[🔴🟡🟢🟣]\s*/,'').trim().toLowerCase()
}

async function findOrCreateProject(groupName){
  const cleaned=cleanName(groupName)
  if(projectCache[cleaned]) return projectCache[cleaned]
  for(const [k,id] of Object.entries(projectCache)){
    if(k.includes(cleaned.substring(0,12))||cleaned.includes(k.substring(0,12))) return id
  }
  const {data}=await sb.from('projects').insert({
    nombre:groupName,cliente:groupName,estado:'activo',prioridad:'media',
    responsable:null,progreso:0,whatsapp_chat_id:groupName,total_mensajes:0,alertas_count:0
  }).select('id').single()
  if(data?.id){projectCache[cleaned]=data.id;return data.id}
  return null
}

async function handleMessage(msg){
  try{
    if(!msg.from.endsWith('@g.us')) return
    if(msg.hasMedia) return
    const body=msg.body?.trim()
    if(!body||body.length<2) return
    const chat=await msg.getChat()
    const contact=await msg.getContact()
    const groupName=chat.name??'Grupo'
    const sender=contact.pushname||contact.number||'Desconocido'

    // ── BLOCKLIST CHECK — rechazar grupos personales ─────────────────────
    if(isBlocklisted(groupName)){
      console.log(`[BLOCKED] Grupo personal ignorado: ${groupName}`)
      return
    }

    // ── WHITELIST CHECK — solo grupos que ya existen como proyectos ──────
    const cleaned=cleanName(groupName)
    const existsInCache=Object.keys(projectCache).some(k=>
      k===cleaned||k.includes(cleaned.substring(0,12))||cleaned.includes(k.substring(0,12))
    )
    if(!existsInCache){
      console.log(`[SKIP] Grupo no reconocido como proyecto, ignorado: ${groupName}`)
      return
    }

    const team=isTeam(sender)
    console.log(`[msg] ${groupName} | ${sender} | ${body.substring(0,60)}`)
    const projectId=await findOrCreateProject(groupName)
    if(!projectId) return
    const {data:inserted}=await sb.from('messages').insert({
      project_id:projectId,fuente:'whatsapp',sender,contenido:body.substring(0,2000),
      timestamp:new Date(msg.timestamp*1000).toISOString(),es_del_cliente:!team,metadata:{group:groupName}
    }).select('id').single()
    let newAlerts=0
    if(!team&&inserted?.id){
      for(const a of detectAlerts(body)){
        await sb.from('alerts').insert({project_id:projectId,message_id:inserted.id,
          tipo:a.tipo,nivel:a.nivel,descripcion:`${a.desc} — "${body.substring(0,120)}"`,resuelta:false})
        newAlerts++
      }
    }
    const {count:total}=await sb.from('messages').select('*',{count:'exact',head:true}).eq('project_id',projectId)
    const {count:alertCount}=await sb.from('alerts').select('*',{count:'exact',head:true}).eq('project_id',projectId).eq('resuelta',false)
    await sb.from('projects').update({
      ultimo_mensaje:body.substring(0,300),ultima_actividad:new Date(msg.timestamp*1000).toISOString(),
      total_mensajes:total??0,alertas_count:alertCount??0
    }).eq('id',projectId)
    console.log(`✓ ${groupName} | alerts: ${newAlerts}`)
  }catch(e){console.error('[error]',e.message)}
}

// ── QR HTTP server ─────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  if(req.url==='/qr'){
    if(status==='connected'){
      res.writeHead(200,{'Content-Type':'text/html'})
      res.end(`<!DOCTYPE html><html><body style="background:#0d1220;color:#22c55e;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;flex-direction:column"><h2>✅ WhatsApp Conectado</h2><p style="color:#a0aec0">El bot ORAIA está activo y escuchando todos los grupos.</p></body></html>`)
    } else if(qrImageData){
      res.writeHead(200,{'Content-Type':'text/html'})
      res.end(`<!DOCTYPE html><html><head><meta http-equiv="refresh" content="15"><title>ORAIA WhatsApp QR</title></head>
<body style="background:#0d1220;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;font-family:sans-serif">
<h2 style="color:#fff;margin-bottom:8px">Escanea con WhatsApp</h2>
<p style="color:#a0aec0;margin-bottom:24px;font-size:14px">Configuración → Dispositivos vinculados → Vincular dispositivo</p>
<img src="/qr.png" style="width:280px;height:280px;border-radius:12px"/>
<p style="color:#4a5568;font-size:12px;margin-top:16px">Se actualiza automáticamente · ${new Date().toLocaleTimeString()}</p>
</body></html>`)
    } else {
      res.writeHead(200,{'Content-Type':'text/html'})
      res.end(`<!DOCTYPE html><html><head><meta http-equiv="refresh" content="3"></head><body style="background:#0d1220;color:#a0aec0;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><p>⏳ Generando QR, espera un momento...</p></body></html>`)
    }
  } else if(req.url==='/qr.png' && qrImageData){
    const buf=Buffer.from(qrImageData.split(',')[1],'base64')
    res.writeHead(200,{'Content-Type':'image/png'})
    res.end(buf)
  } else {
    res.writeHead(302,{Location:'/qr'});res.end()
  }
})
server.listen(3001,()=>console.log('📱 QR disponible en: http://87.99.131.106:3001/qr'))

// ── WhatsApp client ────────────────────────────────────────────────────────
// Clean stale locks
try{
  const p='/tmp/oraia-wa-session'
  for(const f of['SingletonLock','SingletonSocket','SingletonCookie','lockfile']){
    const fp=require('path').join(p,f)
    if(fs.existsSync(fp)){fs.unlinkSync(fp);console.log(`[cleanup] ${f}`)}
  }
}catch(e){}

const client = new Client({
  authStrategy: new LocalAuth({clientId:'oraia-bot',dataPath:'/tmp/oraia-wa-session'}),
  puppeteer:{
    headless:true,
    executablePath:'/usr/bin/chromium-browser',
    args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--no-first-run','--disable-default-apps','--disable-extensions'],
  }
})

client.on('qr', async qr => {
  console.log('[qr] Nuevo QR generado')
  qrImageData = await QRCode.toDataURL(qr, {width:280,margin:2,color:{dark:'#000000',light:'#ffffff'}})
  status='waiting_qr'
})
client.on('authenticated',()=>{console.log('✅ Autenticado');status='authenticated'})
client.on('ready',async()=>{
  console.log('🟢 Bot conectado y listo')
  status='connected';qrImageData=null
  await loadCache()
})
client.on('auth_failure',e=>console.error('❌ Auth fallida:',e))
client.on('disconnected',r=>{console.log('⚠️ Desconectado:',r);status='waiting_qr'})
client.on('message',handleMessage)
client.on('message_create',msg=>{if(msg.fromMe)handleMessage(msg)})
setInterval(loadCache,5*60*1000)

console.log('🚀 Iniciando ORAIA WhatsApp Bot...')
client.initialize()
