/**
 * ORAIA Slack Sync — Full Pipeline
 * 1. Ingests ALL messages from all channels (project_id nullable)
 * 2. Claude classifies each message to a project
 * 3. High confidence → auto-assign
 * 4. Low confidence → mark as ai_low (review later)
 * Run: node sync.js [--classify-only] [--backfill-days=30]
 */

try { require('fs').readFileSync('.env','utf8').split('\n').forEach(l=>{ const [k,...v]=l.split('='); if(k?.trim()&&v.length) process.env[k.trim()]=v.join('=').trim() }) } catch {}

const { createClient } = require('@supabase/supabase-js')

const SLACK_TOKEN   = process.env.SLACK_BOT_TOKEN
const SB_URL        = process.env.NEXT_PUBLIC_SUPABASE_URL
const SB_KEY        = process.env.SUPABASE_SERVICE_ROLE_KEY
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY

const BACKFILL_DAYS = parseInt(process.env.BACKFILL_DAYS || '90')
const CLASSIFY_ONLY = process.argv.includes('--classify-only')

const sb = createClient(SB_URL, SB_KEY)

// ── Slack API ─────────────────────────────────────────────────────────────────
async function slack(method, params = {}) {
  const qs  = new URLSearchParams(params).toString()
  const res = await fetch(`https://slack.com/api/${method}${qs ? '?' + qs : ''}`, {
    headers: { Authorization: `Bearer ${SLACK_TOKEN}` }
  })
  const data = await res.json()
  if (!data.ok) throw new Error(`Slack ${method}: ${data.error}`)
  return data
}

async function slackPost(method, body) {
  const res = await fetch(`https://slack.com/api/${method}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${SLACK_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.json()
}

// ── User cache ────────────────────────────────────────────────────────────────
const userCache = {}
async function resolveUser(userId) {
  if (!userId) return 'Sistema'
  if (userCache[userId]) return userCache[userId]
  try {
    const { user } = await slack('users.info', { user: userId })
    const name = user.profile?.display_name || user.real_name || user.name || userId
    userCache[userId] = name
    await sb.from('slack_users').upsert({
      slack_user_id: userId, display_name: user.profile?.display_name || null,
      real_name: user.real_name || null, is_bot: user.is_bot || false,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'slack_user_id' })
    return name
  } catch { userCache[userId] = userId; return userId }
}

// ── Claude classifier ─────────────────────────────────────────────────────────
async function classifyWithClaude(message, context, projects) {
  const projectList = projects.map((p, i) => `${i+1}. "${p.nombre}" (cliente: ${p.cliente || 'interno'})`).join('\n')
  const prompt = `Eres un clasificador de mensajes de Slack para un equipo de proyectos.

PROYECTOS ACTIVOS:
${projectList}

CONTEXTO DEL CANAL (mensajes previos):
${context}

MENSAJE A CLASIFICAR:
"${message}"

Analiza si este mensaje se refiere a algún proyecto específico de la lista.
Responde SOLO con JSON válido:
{
  "project_index": <número 1-N o null si no aplica/no se puede determinar>,
  "confidence": <0.0-1.0>,
  "reason": "<explicación breve en español>"
}`

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 200,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    const data = await res.json()
    const text = data.content?.[0]?.text || '{}'
    const json = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] || '{}')
    return {
      projectId: json.project_index ? projects[json.project_index - 1]?.id || null : null,
      confidence: json.confidence || 0,
      reason: json.reason || '',
    }
  } catch (e) {
    return { projectId: null, confidence: 0, reason: 'error: ' + e.message }
  }
}

// ── Register + update channels ────────────────────────────────────────────────
async function loadChannels() {
  const { channels } = await slack('conversations.list', {
    types: 'public_channel,private_channel', limit: 200, exclude_archived: true,
  })
  const { data: existing } = await sb.from('slack_channels').select('*')
  const existingMap = Object.fromEntries((existing || []).map(r => [r.channel_id, r]))

  const records = channels.map(ch => ({
    channel_id:   ch.id,
    channel_name: ch.name,
    project_id:   existingMap[ch.id]?.project_id || null,
    channel_type: ch.name.startsWith('project-') ? 'project'
                : ['general','varios','outreach'].includes(ch.name) ? 'general' : 'team',
    last_cursor:  existingMap[ch.id]?.last_cursor || null,
    is_active:    true,
  }))

  await sb.from('slack_channels').upsert(records, { onConflict: 'channel_id' })
  console.log(`[channels] ${records.length} registered`)
  return records
}

// ── Ingest messages from one channel ─────────────────────────────────────────
async function ingestChannel(channel) {
  const { channel_id, channel_name, last_cursor } = channel
  const oldest = last_cursor
    ? String(parseFloat(last_cursor) + 0.000001)
    : String((Date.now() / 1000) - (BACKFILL_DAYS * 86400))

  let cursor = undefined, total = 0, latestTs = last_cursor

  do {
    const params = { channel: channel_id, limit: 200, oldest }
    if (cursor) params.cursor = cursor
    let history
    try { history = await slack('conversations.history', params) }
    catch (e) { console.warn(`[skip] #${channel_name}: ${e.message}`); break }

    const msgs = (history.messages || []).filter(m =>
      m.type === 'message' && !m.subtype && m.text?.trim() && !m.bot_id
    )

    for (const msg of msgs) {
      const sender = await resolveUser(msg.user)
      const ts     = new Date(parseFloat(msg.ts) * 1000).toISOString()

      // Dedup check
      const { count } = await sb.from('messages').select('id', { count: 'exact', head: true })
        .eq('fuente', 'slack').eq('metadata->>slack_ts', msg.ts)
      if (count > 0) continue

      await sb.from('messages').insert({
        project_id:            null,  // Will be filled by classifier
        fuente:                'slack',
        sender,
        contenido:             msg.text.slice(0, 2000),
        timestamp:             ts,
        es_del_cliente:        false,
        classification_status: 'pending',
        slack_thread_ts:       msg.thread_ts || msg.ts,
        metadata: {
          slack_ts:      msg.ts,
          slack_channel: channel_id,
          channel_name,
          thread_ts:     msg.thread_ts || null,
        },
      })

      if (!latestTs || parseFloat(msg.ts) > parseFloat(latestTs)) latestTs = msg.ts
      total++
    }

    cursor = history.response_metadata?.next_cursor || null
  } while (cursor)

  if (latestTs !== last_cursor) {
    await sb.from('slack_channels').update({ last_cursor: latestTs }).eq('channel_id', channel_id)
  }
  if (total > 0) console.log(`  #${channel_name} → ${total} ingested`)
  return total
}

// ── AI classification pass ────────────────────────────────────────────────────
async function classifyPending() {
  const { data: projects } = await sb.from('projects')
    .select('id,nombre,cliente').in('estado', ['activo','en_riesgo'])
  if (!projects?.length) return console.log('[classify] No active projects')

  // Get pending messages in batches of 20
  const { data: pending } = await sb.from('messages')
    .select('id,contenido,metadata,slack_thread_ts')
    .eq('fuente', 'slack')
    .eq('classification_status', 'pending')
    .limit(100)

  if (!pending?.length) return console.log('[classify] No pending messages')
  console.log(`[classify] Processing ${pending.length} messages with Claude...`)

  let classified = 0, skipped = 0

  for (const msg of pending) {
    // Get context: last 3 messages from same channel
    const channelId = msg.metadata?.slack_channel
    const { data: ctx } = await sb.from('messages')
      .select('sender,contenido,timestamp')
      .eq('fuente', 'slack')
      .eq('metadata->>slack_channel', channelId)
      .neq('id', msg.id)
      .order('timestamp', { ascending: false })
      .limit(3)

    const contextStr = (ctx || []).reverse()
      .map(m => `${m.sender}: ${m.contenido.slice(0,100)}`).join('\n') || '(sin contexto)'

    const result = await classifyWithClaude(msg.contenido, contextStr, projects)

    if (result.confidence >= 0.80 && result.projectId) {
      // High confidence → auto-assign
      await sb.from('messages').update({
        project_id:            result.projectId,
        classification_status: 'ai_high',
        ai_confidence:         result.confidence,
      }).eq('id', msg.id)

      // Update project stats
      await updateProjectStats(result.projectId)
      classified++
    } else if (result.confidence >= 0.40 && result.projectId) {
      // Medium confidence → assign but flag
      await sb.from('messages').update({
        project_id:            result.projectId,
        classification_status: 'ai_low',
        ai_confidence:         result.confidence,
      }).eq('id', msg.id)
      classified++
    } else {
      // Low confidence → mark as unrelated or needs_review
      await sb.from('messages').update({
        classification_status: result.confidence < 0.1 ? 'unrelated' : 'needs_review',
        ai_confidence:         result.confidence,
      }).eq('id', msg.id)
      skipped++
    }

    // Rate limit Claude
    await new Promise(r => setTimeout(r, 300))
  }

  console.log(`[classify] Done — ${classified} classified, ${skipped} unrelated/review`)
}

async function updateProjectStats(projectId) {
  const { count: total } = await sb.from('messages').select('id', { count: 'exact', head: true })
    .eq('project_id', projectId)
  const { data: latest } = await sb.from('messages').select('contenido,timestamp')
    .eq('project_id', projectId).order('timestamp', { ascending: false }).limit(1)
  await sb.from('projects').update({
    total_mensajes:   total ?? 0,
    ultima_actividad: latest?.[0]?.timestamp || null,
    ultimo_mensaje:   latest?.[0]?.contenido?.slice(0, 300) || null,
  }).eq('id', projectId)
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🔵 ORAIA Slack Sync\n')

  if (!CLASSIFY_ONLY) {
    const channels = await loadChannels()
    let total = 0
    for (const ch of channels.filter(c => c.is_active)) {
      total += await ingestChannel(ch)
      await new Promise(r => setTimeout(r, 1000)) // rate limit
    }
    console.log(`\n📥 Ingested: ${total} new messages`)
  }

  console.log('\n🧠 Running Claude classifier...')
  await classifyPending()

  console.log('\n✅ Done')
}

main().catch(e => { console.error('❌', e.message); process.exit(1) })
