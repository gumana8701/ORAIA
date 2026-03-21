/**
 * POST /api/alerts/process
 * Called by OpenClaw cron every hour.
 * Handles: kpi_missing, services_missing
 * Secured by x-cron-secret header.
 */
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const SLACK_TOKEN  = process.env.SLACK_BOT_TOKEN || ''
const APP_URL      = process.env.NEXT_PUBLIC_APP_URL || 'https://oraia-five.vercel.app'
const CRON_SECRET  = process.env.CRON_SECRET || 'oraia-cron-2026'

// El Salvador UTC-6. Business hours 8am–10pm local = 14:00–04:00 UTC
function isBusinessHour(): boolean {
  const h = new Date().getUTCHours()
  return h >= 14 || h < 4
}

async function slackPost(method: string, body: Record<string, any>) {
  const r = await fetch(`https://slack.com/api/${method}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${SLACK_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return r.json()
}

const ALERT_COPY: Record<string, { emoji: string; header: string; detail: string; btn: string }> = {
  kpi_missing: {
    emoji: '📊',
    header: 'KPIs no definidos',
    detail: 'El proyecto fue onboarded pero aún no tiene KPIs definidos. Sin KPIs no podemos medir el éxito del proyecto.',
    btn: '📝 Agregar KPIs',
  },
  services_missing: {
    emoji: '📋',
    header: 'Servicios contratados no definidos',
    detail: 'No se pudo detectar la cantidad de servicios contratados. Por favor especifica cuántos y qué tipo de agentes (voz/WhatsApp) fueron contratados.',
    btn: '📋 Definir servicios',
  },
}

async function sendAlert(alert: any, isFollowUp = false): Promise<string | null> {
  const { data: proj } = await sb.from('projects').select('nombre').eq('id', alert.project_id).single()
  const nombre  = proj?.nombre || 'Proyecto'
  const copy    = ALERT_COPY[alert.alert_type] || ALERT_COPY.kpi_missing
  const destUrl = `${APP_URL}/login?next=${encodeURIComponent(`/proyectos/${alert.project_id}?tab=kpis`)}`

  const header = isFollowUp
    ? `${copy.emoji} *Recordatorio #${alert.send_count + 1}* — ${copy.header}`
    : `${copy.emoji} *${copy.header}* — acción requerida`

  const body: Record<string, any> = {
    channel: alert.slack_channel_id,
    text: `${header}\n\n*${nombre}* — ${copy.detail}\n\n👉 <${destUrl}|${copy.btn}>`,
    blocks: [
      { type: 'section', text: { type: 'mrkdwn', text: `${header}\n\n*${nombre}* — ${copy.detail}` } },
      { type: 'actions', elements: [{ type: 'button', text: { type: 'plain_text', text: copy.btn }, url: destUrl, style: 'primary' }] },
      { type: 'context', elements: [{ type: 'mrkdwn', text: `_Recordatorio ${alert.send_count + 1} de ${alert.max_sends} · Se repetirá cada 24h hasta completar_` }] },
    ],
  }

  if (isFollowUp && alert.slack_thread_ts) {
    body.thread_ts = alert.slack_thread_ts
  }

  const res = await slackPost('chat.postMessage', body)
  return res.ok ? (res.ts as string) : null
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
  if (secret !== CRON_SECRET) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  if (!isBusinessHour()) return NextResponse.json({ skipped: 'outside business hours' })

  const now = new Date()
  const log: string[] = []

  // ── 1. Send pending alerts whose send_after time has come ─────────────
  const { data: pending } = await sb
    .from('alerts')
    .select('*')
    .eq('status', 'pending')
    .lte('send_after', now.toISOString())
    .in('alert_type', ['kpi_missing', 'services_missing'])

  for (const alert of pending || []) {
    if (!alert.slack_channel_id) continue
    const ts = await sendAlert(alert, false)
    if (ts) {
      await sb.from('alerts').update({
        status: 'open', slack_thread_ts: ts, last_sent_at: now.toISOString(), send_count: 1, updated_at: now.toISOString(),
      }).eq('id', alert.id)
      await sb.from('alert_followups').insert({ alert_id: alert.id, slack_message_ts: ts, message: 'Initial alert sent' })
      log.push(`sent:${alert.alert_type}:${alert.id}`)
    }
  }

  // ── 2. Daily follow-ups for open alerts ──────────────────────────────
  const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
  const { data: open } = await sb
    .from('alerts')
    .select('*')
    .eq('status', 'open')
    .lte('last_sent_at', cutoff)
    .in('alert_type', ['kpi_missing', 'services_missing'])

  for (const alert of (open || []).filter((a: any) => a.send_count < a.max_sends)) {
    if (!alert.slack_channel_id) continue
    const ts = await sendAlert(alert, true)
    if (ts) {
      await sb.from('alerts').update({
        last_sent_at: now.toISOString(), send_count: alert.send_count + 1, updated_at: now.toISOString(),
      }).eq('id', alert.id)
      await sb.from('alert_followups').insert({ alert_id: alert.id, slack_message_ts: ts, message: `Follow-up #${alert.send_count + 1}` })
      log.push(`followup:${alert.alert_type}:${alert.id}:${alert.send_count + 1}`)
    }
  }

  // ── 3. Expire alerts that hit max_sends ──────────────────────────────
  const { data: maxed } = await sb.from('alerts').select('id, send_count, max_sends').eq('status', 'open')
  for (const a of (maxed || []).filter((a: any) => a.send_count >= a.max_sends)) {
    await sb.from('alerts').update({ status: 'expired', updated_at: now.toISOString() }).eq('id', a.id)
    log.push(`expired:${a.id}`)
  }

  return NextResponse.json({ processed: log.length, log })
}
