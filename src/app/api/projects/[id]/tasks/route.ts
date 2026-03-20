import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const SLACK_TOKEN = process.env.SLACK_BOT_TOKEN || ''

async function slackPost(method: string, body: Record<string, any>) {
  if (!SLACK_TOKEN) return
  await fetch(`https://slack.com/api/${method}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${SLACK_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

async function getProject(projectId: string) {
  const { data } = await sb.from('projects').select('slack_channel_id, nombre').eq('id', projectId).single()
  return data
}

// ── GET /api/projects/[id]/tasks ─────────────────────────────────────────────
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { data, error } = await sb
    .from('project_tasks')
    .select('*')
    .eq('project_id', id)
    .order('order_index')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

// ── POST /api/projects/[id]/tasks — create task ───────────────────────────────
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { title, category, assignee, author } = await req.json()

  if (!title?.trim()) return NextResponse.json({ error: 'title required' }, { status: 400 })

  const { data: existing } = await sb
    .from('project_tasks')
    .select('order_index')
    .eq('project_id', id)
    .order('order_index', { ascending: false })
    .limit(1)

  const nextIndex = (existing?.[0]?.order_index ?? -1) + 1
  const now = new Date().toISOString()

  const { data: task, error } = await sb
    .from('project_tasks')
    .insert({
      project_id: id,
      title: title.trim(),
      category: category || null,
      order_index: nextIndex,
      completed: false,
      status: 'pendiente',
      assignee: assignee || null,
      status_changed_at: now,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Log history entry
  await sb.from('task_status_history').insert({
    task_id: task.id,
    project_id: id,
    status: 'pendiente',
    changed_at: now,
    changed_by: author || 'Sistema',
    duration_seconds: 0,
  })

  // Slack alert
  const proj = await getProject(id)
  if (proj?.slack_channel_id) {
    await slackPost('chat.postMessage', {
      channel: proj.slack_channel_id,
      text: `📋 *Nueva tarea agregada*${assignee ? ` — asignada a *${assignee}*` : ''}:\n> ${title.trim()}`,
    })
  }

  return NextResponse.json(task)
}

// ── PATCH /api/projects/[id]/tasks — update task ─────────────────────────────
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { taskId, completed, status, notes, assignee, author } = await req.json()

  // Fetch current task state
  const { data: current } = await sb
    .from('project_tasks')
    .select('title, status, status_changed_at, time_pendiente_seconds, time_bloqueado_seconds, time_completado_seconds, started_at')
    .eq('id', taskId)
    .single() as { data: { title: string; status: string; status_changed_at: string | null; started_at: string | null; time_pendiente_seconds: number; time_bloqueado_seconds: number; time_completado_seconds: number } | null }

  const now = new Date()
  const patch: Record<string, any> = { updated_at: now.toISOString() }

  let newStatus = status
  if (completed !== undefined) {
    patch.completed = completed
    newStatus = completed ? 'completado' : 'pendiente'
  }
  if (newStatus !== undefined) {
    patch.status = newStatus
    patch.completed = newStatus === 'completado'
    if (newStatus === 'completado') patch.completed_at = now.toISOString()
    if (newStatus === 'en_progreso' && !current?.started_at) patch.started_at = now.toISOString()
    patch.status_changed_at = now.toISOString()
  }
  if (notes !== undefined) patch.notes = notes
  if (assignee !== undefined) patch.assignee = assignee

  // Calculate time spent in previous status
  if (current && newStatus && newStatus !== current.status) {
    const prevChanged = current.status_changed_at ? new Date(current.status_changed_at) : now
    const durationSecs = Math.round((now.getTime() - prevChanged.getTime()) / 1000)

    if (current.status === 'pendiente')   patch.time_pendiente_seconds   = (current.time_pendiente_seconds   || 0) + durationSecs
    if (current.status === 'bloqueado')   patch.time_bloqueado_seconds   = (current.time_bloqueado_seconds   || 0) + durationSecs
    if (current.status === 'completado')  patch.time_completado_seconds  = (current.time_completado_seconds  || 0) + durationSecs

    // Log history
    await sb.from('task_status_history').insert({
      task_id: taskId,
      project_id: id,
      status: newStatus,
      changed_at: now.toISOString(),
      changed_by: author || 'Equipo',
      duration_seconds: durationSecs,
    })
  }

  const { data: updated, error } = await sb
    .from('project_tasks')
    .update(patch)
    .eq('id', taskId)
    .eq('project_id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Slack alert on status change
  if (current && newStatus && newStatus !== current.status) {
    const proj = await getProject(id)
    if (proj?.slack_channel_id) {
      const emoji = newStatus === 'completado' ? '✅' : newStatus === 'bloqueado' ? '🚫' : '🔄'
      await slackPost('chat.postMessage', {
        channel: proj.slack_channel_id,
        text: `${emoji} *Tarea actualizada* en _${proj.nombre}_:\n> *${current.title}*\n${current.status} → *${newStatus}*${updated?.assignee ? ` — ${updated.assignee}` : ''}`,
      })
    }
  }

  return NextResponse.json(updated)
}
