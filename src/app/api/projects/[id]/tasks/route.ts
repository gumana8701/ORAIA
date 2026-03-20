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

async function getProjectSlackChannel(projectId: string): Promise<string | null> {
  const { data } = await sb.from('projects').select('slack_channel_id, nombre').eq('id', projectId).single()
  return data?.slack_channel_id || null
}

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

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { title, category, author } = await req.json()

  if (!title?.trim()) return NextResponse.json({ error: 'title required' }, { status: 400 })

  // Get current max order_index
  const { data: existing } = await sb
    .from('project_tasks')
    .select('order_index')
    .eq('project_id', id)
    .order('order_index', { ascending: false })
    .limit(1)

  const nextIndex = (existing?.[0]?.order_index ?? -1) + 1

  const { data: task, error } = await sb
    .from('project_tasks')
    .insert({
      project_id: id,
      title: title.trim(),
      category: category || null,
      order_index: nextIndex,
      completed: false,
      status: 'pendiente',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Notify Slack
  const channelId = await getProjectSlackChannel(id)
  if (channelId) {
    await slackPost('chat.postMessage', {
      channel: channelId,
      text: `📋 *Nueva tarea agregada* por ${author || 'el equipo'}:\n> ${title.trim()}`,
    })
  }

  return NextResponse.json(task)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { taskId, completed, status, notes, assignee, author } = await req.json()

  const patch: Record<string, any> = { updated_at: new Date().toISOString() }

  let newStatus = status
  if (completed !== undefined) {
    patch.completed = completed
    newStatus = completed ? 'completado' : 'pendiente'
  }
  if (newStatus !== undefined) {
    patch.status = newStatus
    patch.completed = newStatus === 'completado'
  }
  if (notes !== undefined) patch.notes = notes
  if (assignee !== undefined) patch.assignee = assignee

  const { data: taskData } = await sb
    .from('project_tasks')
    .select('title, status')
    .eq('id', taskId)
    .single()

  const { error } = await sb
    .from('project_tasks')
    .update(patch)
    .eq('id', taskId)
    .eq('project_id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Notify Slack on status change to completado
  const wasCompleted = taskData?.status !== 'completado' && patch.status === 'completado'
  const wasBlocked = patch.status === 'bloqueado'

  if (wasCompleted || wasBlocked) {
    const channelId = await getProjectSlackChannel(id)
    if (channelId && taskData?.title) {
      const emoji = wasCompleted ? '✅' : '🔴'
      const statusLabel = wasCompleted ? 'completada' : 'bloqueada'
      await slackPost('chat.postMessage', {
        channel: channelId,
        text: `${emoji} *Tarea ${statusLabel}*:\n> ${taskData.title}${author ? `\n_Actualizado por ${author}_` : ''}`,
      })
    }
  }

  return NextResponse.json({ success: true })
}
