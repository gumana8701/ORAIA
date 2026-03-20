/**
 * GET  /api/projects/[id]/kpis  — list KPIs
 * POST /api/projects/[id]/kpis  — add KPI + auto-close kpi_missing alert
 */
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { data, error } = await sb
    .from('project_kpis')
    .select('*')
    .eq('project_id', id)
    .order('created_at')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { kpi_text, categoria, meta, added_by } = await req.json()

  if (!kpi_text?.trim()) return NextResponse.json({ error: 'kpi_text required' }, { status: 400 })

  const { data: kpi, error } = await sb.from('project_kpis').insert({
    project_id: id,
    kpi_text: kpi_text.trim(),
    categoria: categoria || 'general',
    meta: meta || null,
    confirmado: true,
    created_at: new Date().toISOString(),
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Auto-close open kpi_missing alert for this project
  const { data: openAlert } = await sb
    .from('alerts')
    .select('id, created_at, slack_channel_id, slack_thread_ts')
    .eq('project_id', id)
    .eq('alert_type', 'kpi_missing')
    .in('status', ['pending', 'open'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (openAlert) {
    const resolutionSeconds = Math.round((Date.now() - new Date(openAlert.created_at).getTime()) / 1000)
    await sb.from('alerts').update({
      status: 'resolved',
      resolved_at: new Date().toISOString(),
      resolved_by: added_by || 'Equipo',
      resolution_seconds: resolutionSeconds,
      updated_at: new Date().toISOString(),
    }).eq('id', openAlert.id)

    // Notify Slack thread that it's resolved
    if (openAlert.slack_channel_id && openAlert.slack_thread_ts && process.env.SLACK_BOT_TOKEN) {
      const hours = Math.round(resolutionSeconds / 3600)
      await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${process.env.SLACK_BOT_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: openAlert.slack_channel_id,
          thread_ts: openAlert.slack_thread_ts,
          text: `✅ KPIs agregados por *${added_by || 'el equipo'}* — alerta cerrada (${hours}h de respuesta).`,
        }),
      })
    }
  }

  return NextResponse.json({ kpi, alertClosed: !!openAlert })
}
