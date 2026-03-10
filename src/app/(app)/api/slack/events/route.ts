/**
 * ORAIA — Slack Events Webhook
 * Receives real-time events from Slack → classifies → saves to Supabase
 * Register this URL in api.slack.com → Event Subscriptions:
 *   https://oraia-five.vercel.app/api/slack/events
 * Required events: message.channels, message.groups
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SLACK_SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET || ''
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || ''
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ── Verify Slack signature ────────────────────────────────────────────────────
async function verifySlack(req: NextRequest, body: string): Promise<boolean> {
  if (!SLACK_SIGNING_SECRET) return true // skip in dev
  const ts  = req.headers.get('x-slack-request-timestamp') || ''
  const sig = req.headers.get('x-slack-signature') || ''
  if (Math.abs(Date.now() / 1000 - parseInt(ts)) > 300) return false
  const base = `v0:${ts}:${body}`
  const key  = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(SLACK_SIGNING_SECRET),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const mac  = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(base))
  const hex  = 'v0=' + Array.from(new Uint8Array(mac)).map(b => b.toString(16).padStart(2,'0')).join('')
  return hex === sig
}

// ── User name cache (in-memory, Vercel edge resets periodically) ──────────────
async function resolveUser(userId: string): Promise<string> {
  const { data } = await sb.from('slack_users').select('display_name,real_name')
    .eq('slack_user_id', userId).single()
  if (data) return data.display_name || data.real_name || userId

  // Fetch from Slack API
  try {
    const res  = await fetch(`https://slack.com/api/users.info?user=${userId}`, {
      headers: { Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}` }
    })
    const json = await res.json()
    const name = json.user?.profile?.display_name || json.user?.real_name || userId
    await sb.from('slack_users').upsert({
      slack_user_id: userId, display_name: json.user?.profile?.display_name || null,
      real_name: json.user?.real_name || null, is_bot: json.user?.is_bot || false,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'slack_user_id' })
    return name
  } catch { return userId }
}

// ── Claude project classifier ─────────────────────────────────────────────────
async function classifyMessage(text: string, channelName: string, contextMsgs: string[]): Promise<{
  projectId: string | null, confidence: number
}> {
  const { data: projects } = await sb.from('projects')
    .select('id,nombre,cliente').in('estado', ['activo','en_riesgo'])
  if (!projects?.length) return { projectId: null, confidence: 0 }

  const projectList = projects.map((p, i) =>
    `${i+1}. "${p.nombre}" (cliente: ${p.cliente || 'interno'})`).join('\n')
  const context = contextMsgs.join('\n') || '(sin contexto previo)'

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 150,
      messages: [{
        role: 'user',
        content: `Canal: #${channelName}\nContexto:\n${context}\n\nMensaje: "${text}"\n\nProyectos:\n${projectList}\n\nResponde SOLO JSON: {"project_index": <n o null>, "confidence": <0.0-1.0>}`
      }]
    }),
  })
  const data = await res.json()

  try {
    const txt  = (data.content?.[0]?.text || '{}') as string
    const json = JSON.parse(txt.match(/\{[\s\S]*\}/)?.[0] || '{}')
    return {
      projectId: json.project_index ? projects[json.project_index - 1]?.id || null : null,
      confidence: json.confidence || 0,
    }
  } catch { return { projectId: null, confidence: 0 } }
}

// ── Main handler ──────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const rawBody = await req.text()

  // Verify signature
  if (!await verifySlack(req, rawBody)) {
    return NextResponse.json({ error: 'invalid_signature' }, { status: 401 })
  }

  const payload = JSON.parse(rawBody)

  // URL verification challenge (Slack sends this when you register the URL)
  if (payload.type === 'url_verification') {
    return NextResponse.json({ challenge: payload.challenge })
  }

  // Only handle message events
  const event = payload.event
  if (!event || event.type !== 'message' || event.subtype || event.bot_id) {
    return NextResponse.json({ ok: true })
  }

  const text = event.text?.trim()
  if (!text || text.length < 3) return NextResponse.json({ ok: true })

  // Process async (Slack expects response in 3s)
  void (async () => {
    try {
      // Dedup check
      const { count } = await sb.from('messages').select('id', { count: 'exact', head: true })
        .eq('fuente', 'slack').eq('metadata->>slack_ts', event.ts)
      if ((count ?? 0) > 0) return

      // Get channel name
      const { data: chData } = await sb.from('slack_channels')
        .select('channel_name').eq('channel_id', event.channel).single()
      const channelName = chData?.channel_name || event.channel

      // Get sender name
      const sender = event.user ? await resolveUser(event.user) : 'Sistema'

      // Get recent context (last 3 messages from this channel)
      const { data: ctx } = await sb.from('messages')
        .select('sender,contenido').eq('fuente', 'slack')
        .eq('metadata->>slack_channel', event.channel)
        .order('timestamp', { ascending: false }).limit(3)
      const contextMsgs = (ctx || []).reverse()
        .map(m => `${m.sender}: ${m.contenido.slice(0, 100)}`)

      // Classify with Claude
      const { projectId, confidence } = await classifyMessage(text, channelName, contextMsgs)

      const status = confidence >= 0.80 ? 'ai_high'
                   : confidence >= 0.40 ? 'ai_low'
                   : confidence < 0.10  ? 'unrelated' : 'needs_review'

      // Insert message
      const { data: msg } = await sb.from('messages').insert({
        project_id:            projectId,
        fuente:                'slack',
        sender,
        contenido:             text.slice(0, 2000),
        timestamp:             new Date(parseFloat(event.ts) * 1000).toISOString(),
        es_del_cliente:        false,
        classification_status: status,
        ai_confidence:         confidence,
        slack_thread_ts:       event.thread_ts || event.ts,
        metadata: {
          slack_ts:      event.ts,
          slack_channel: event.channel,
          channel_name:  channelName,
          thread_ts:     event.thread_ts || null,
        },
      }).select('id').single()

      // Update project stats
      if (projectId && msg?.id) {
        const { count: total } = await sb.from('messages').select('id', { count: 'exact', head: true })
          .eq('project_id', projectId)
        await sb.from('projects').update({
          total_mensajes:   total ?? 0,
          ultima_actividad: new Date(parseFloat(event.ts) * 1000).toISOString(),
          ultimo_mensaje:   text.slice(0, 300),
        }).eq('id', projectId)

        // Update channel cursor
        await sb.from('slack_channels').update({ last_cursor: event.ts })
          .eq('channel_id', event.channel)
      }
    } catch (e) {
      console.error('[slack/events] error:', e)
    }
  })()

  return NextResponse.json({ ok: true })
}
