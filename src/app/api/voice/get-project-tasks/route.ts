/**
 * GET /api/voice/get-project-tasks?project_name=X&include_closed=true
 * Returns tasks for a project so BOB can analyze before creating new ones.
 */
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const projectName    = searchParams.get('project_name') || ''
  const projectId      = searchParams.get('project_id') || ''
  const includeClosed  = searchParams.get('include_closed') === 'true'

  // Resolve project
  let resolvedId = projectId
  if (!resolvedId && projectName) {
    const { data: projects } = await sb
      .from('projects')
      .select('id, nombre')
      .order('ultima_actividad', { ascending: false })
    const lower = projectName.toLowerCase()
    const match = projects?.find(p =>
      p.nombre?.toLowerCase() === lower ||
      p.nombre?.toLowerCase().includes(lower) ||
      lower.includes(p.nombre?.toLowerCase())
    )
    if (!match) return NextResponse.json({ error: `Project not found: ${projectName}`, tasks: [] })
    resolvedId = match.id
  }

  if (!resolvedId) return NextResponse.json({ error: 'project_name or project_id required', tasks: [] })

  // Fetch tasks
  let query = sb
    .from('project_tasks')
    .select('id, title, status, assignee, notes, description, due_date, priority, parent_task_id, created_at, category')
    .eq('project_id', resolvedId)
    .is('parent_task_id', null) // only top-level tasks
    .order('order_index')

  if (!includeClosed) {
    query = query.neq('status', 'completado')
  }

  const { data: tasks, error } = await query
  if (error) return NextResponse.json({ error: error.message, tasks: [] })

  // Also get subtask counts
  const taskIds = (tasks || []).map(t => t.id)
  const { data: subtasks } = taskIds.length > 0
    ? await sb.from('project_tasks').select('parent_task_id, status').in('parent_task_id', taskIds)
    : { data: [] }

  const subtasksByParent: Record<string, { total: number; completed: number }> = {}
  for (const s of subtasks || []) {
    if (!subtasksByParent[s.parent_task_id]) subtasksByParent[s.parent_task_id] = { total: 0, completed: 0 }
    subtasksByParent[s.parent_task_id].total++
    if (s.status === 'completado') subtasksByParent[s.parent_task_id].completed++
  }

  const result = (tasks || []).map(t => ({
    id:          t.id,
    title:       t.title,
    status:      t.status,
    assignee:    t.assignee,
    description: t.description || t.notes || null,
    priority:    t.priority,
    due_date:    t.due_date,
    category:    t.category,
    subtasks:    subtasksByParent[t.id] || { total: 0, completed: 0 },
  }))

  // Group for easier BOB consumption
  const open   = result.filter(t => t.status !== 'completado')
  const closed = result.filter(t => t.status === 'completado')

  return NextResponse.json({
    project_id: resolvedId,
    open_tasks:   open,
    closed_tasks: includeClosed ? closed : [],
    summary: `${open.length} tareas abiertas, ${closed.length} completadas`,
  })
}

export async function POST(req: NextRequest) {
  // Allow POST with body for easier tool calling
  const body = await req.json().catch(() => ({}))
  const url  = new URL(req.url)
  const qs   = new URLSearchParams({
    project_name:    body.project_name    || url.searchParams.get('project_name')    || '',
    project_id:      body.project_id      || url.searchParams.get('project_id')      || '',
    include_closed:  body.include_closed  ?? url.searchParams.get('include_closed')  ?? 'false',
  })
  return GET(new NextRequest(`${url.origin}/api/voice/get-project-tasks?${qs}`, { method: 'GET' }))
}
