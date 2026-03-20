/**
 * POST /api/alerts/process
 * Called by OpenClaw cron every hour.
 * - Sends pending alerts whose send_after time has passed (business hours only)
 * - Sends daily follow-ups for open alerts
 * - Expires alerts that exceeded max_sends
 * Secured by CRON_SECRET header.
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

// El Salvador = UTC-6. Business hours 8am–6pm local = 14:00–00:00 UTC
function isBusinessHour(): boolean {
  const h = new Date().getUTCHours()
  return h >= 14 || h < 4 // 8am-10pm ES local
}

async function slackPost(method: string, body: Record<string, any>) {
  const r = await fetch(`https://slack.com/api/${method}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${SLACK_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return r.json()
}

async function sendKpiAlert(alert: any, isFollowUp = false): Promise<string | null> {
  const { data: proj } = await sb.from('projects').select('nombre').eq('id', alert.project_id).single()
  const nombre = proj?.nombre || 'Proyecto'
  const kpiUrl = `${APP_URL}/proyectos/${alert.project_id}?tab=kpis`

  const header = isFollowUp
    ? `📊 *Recordatorio #${alert.send_count + 1}* — KPIs pendientes`
    : `📊 *KPIs no definidos* — acción requerida`

  const body: Record<string, any> = {
    channel: alert.slack_channel_id,
    text: `${header}\n\n*${nombre}* fue onboarded pero aún no tiene KPIs definidos. Por favor agrégalos para que el equipo pueda hacer seguimiento.\n\n👉 <${kpiUrl}|Agregar KPIs ahora>`,
    blocks: [
      { type: 'section', text: { type: 'mrkdwn', text: `${header}\n\n*${nombre}* fue onboarded pero aún no tiene KPIs definidos. Sin KPIs no podemos medir el éxito del proyecto.` } },
      { type: 'actions', elements: [{ type: 'button', text: { type: 'plain_text', text: '📝 Agregar KPIs' }, url: kpiUrl, style: 'primary' }] },
      { type: 'context', elements: [{ type: 'mrkdwn', text: `_Recordatorio ${alert.send_count + 1} de ${alert.max_sends} · Se repetirá cada 24h hasta que se agreguen KPIs_` }] },
    ],
  }

  // Follow-ups go in the same thread
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

  // ── 1. Send pending alerts whose time has come ─────────────────────────
  const { data: pending } = await sb
    .from('alerts')
    .select('*')
    .eq('status', 'pending')
    .lte('send_after', now.toISOString())

  for (const alert of pending || []) {
    if (!alert.slack_channel_id) continue
    const ts = await sendKpiAlert(alert, false)
    if (ts) {
      await sb.from('alerts').update({
        status: 'open', slack_thread_ts: ts, last_sent_at: now.toISOString(), send_count: 1, updated_at: now.toISOString(),
      }).eq('id', alert.id)
      await sb.from('alert_followups').insert({ alert_id: alert.id, slack_message_ts: ts, message: 'Initial alert sent' })
      log.push(`sent:${alert.id}`)
    }
  }

  // ── 2. Daily follow-ups for open alerts ───────────────────────────────
  const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
  const { data: open } = await sb
    .from('alerts')
    .select('*')
    .eq('status', 'open')
    .lte('last_sent_at', cutoff)
    .lt('send_count', sb.rpc as any) // workaround — filter in JS

  const openFiltered = (open || []).filter((a: any) => a.send_count < a.max_sends)

  for (const alert of openFiltered) {
    if (!alert.slack_channel_id) continue
    const ts = await sendKpiAlert(alert, true)
    if (ts) {
      await sb.from('alerts').update({
        last_sent_at: now.toISOString(), send_count: alert.send_count + 1, updated_at: now.toISOString(),
      }).eq('id', alert.id)
      await sb.from('alert_followups').insert({ alert_id: alert.id, slack_message_ts: ts, message: `Follow-up #${alert.send_count + 1}` })
      log.push(`followup:${alert.id}:${alert.send_count + 1}`)
    }
  }

  // ── 3. Expire alerts that hit max_sends ───────────────────────────────
  const { data: maxed } = await sb
    .from('alerts')
    .select('id, send_count, max_sends')
    .eq('status', 'open')

  for (const a of (maxed || []).filter((a: any) => a.send_count >= a.max_sends)) {
    await sb.from('alerts').update({ status: 'expired', updated_at: now.toISOString() }).eq('id', a.id)
    log.push(`expired:${a.id}`)
  }

  return NextResponse.json({ processed: log.length, log })
}
