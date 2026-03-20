/**
 * Alerts API
 * GET  /api/alerts?project_id=xxx   — list alerts for a project
 * POST /api/alerts                  — create alert
 * PATCH /api/alerts                 — resolve alert
 */
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get('project_id')
  let query = sb.from('alerts').select('*').order('created_at', { ascending: false })
  if (projectId) query = query.eq('project_id', projectId)
  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { project_id, alert_type, title, slack_channel_id, send_after_hours = 6, max_sends = 10 } = body

  if (!project_id || !alert_type) return NextResponse.json({ error: 'project_id and alert_type required' }, { status: 400 })

  const sendAfter = new Date(Date.now() + send_after_hours * 60 * 60 * 1000).toISOString()

  const { data, error } = await sb.from('alerts').insert({
    project_id,
    alert_type,
    title: title || alert_type,
    status: 'pending',
    slack_channel_id,
    send_after: sendAfter,
    send_count: 0,
    max_sends,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest) {
  const { alert_id, resolved_by } = await req.json()
  if (!alert_id) return NextResponse.json({ error: 'alert_id required' }, { status: 400 })

  // Get alert to compute resolution time
  const { data: alert } = await sb.from('alerts').select('created_at').eq('id', alert_id).single()
  const resolutionSeconds = alert?.created_at
    ? Math.round((Date.now() - new Date(alert.created_at).getTime()) / 1000)
    : null

  const { data, error } = await sb.from('alerts').update({
    status: 'resolved',
    resolved_at: new Date().toISOString(),
    resolved_by: resolved_by || 'Sistema',
    resolution_seconds: resolutionSeconds,
    updated_at: new Date().toISOString(),
  }).eq('id', alert_id).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
