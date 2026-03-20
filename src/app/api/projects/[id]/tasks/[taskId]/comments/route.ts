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

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  const { taskId } = await params
  const { data, error } = await sb
    .from('project_task_comments')
    .select('*')
    .eq('task_id', taskId)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  const { id, taskId } = await params
  const { content, author } = await req.json()

  if (!content?.trim()) return NextResponse.json({ error: 'content required' }, { status: 400 })

  const { data: comment, error } = await sb
    .from('project_task_comments')
    .insert({
      task_id: taskId,
      project_id: id,
      content: content.trim(),
      author: author || 'Equipo',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Get task title + project slack channel
  const { data: task } = await sb
    .from('project_tasks')
    .select('title')
    .eq('id', taskId)
    .single()

  const { data: project } = await sb
    .from('projects')
    .select('slack_channel_id')
    .eq('id', id)
    .single()

  if (project?.slack_channel_id && task?.title) {
    await slackPost('chat.postMessage', {
      channel: project.slack_channel_id,
      text: `💬 *Nuevo comentario* en tarea:\n> ${task.title}\n\n*${author || 'Equipo'}:* ${content.trim()}`,
    })
  }

  return NextResponse.json(comment)
}
