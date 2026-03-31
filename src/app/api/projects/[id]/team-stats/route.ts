/**
 * GET /api/projects/[id]/team-stats
 * Returns per-assignee task statistics for a project.
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

  // Fetch all tasks + subtasks for this project
  const { data: tasks, error } = await sb
    .from('project_tasks')
    .select('id, title, assignee, status, completed, created_at, updated_at, due_date, priority, parent_task_id, completed_at, status_changed_at')
    .eq('project_id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!tasks?.length) return NextResponse.json([])

  const now = Date.now()

  // Group by assignee
  const byAssignee: Record<string, {
    assignee: string
    total: number
    completed: number
    en_progreso: number
    pendiente: number
    bloqueado: number
    overdue: number
    tasks: any[]
    total_open_ms: number
    open_count_for_avg: number
    completed_times_ms: number[]
  }> = {}

  for (const task of tasks) {
    const key = task.assignee || 'Sin asignar'
    if (!byAssignee[key]) {
      byAssignee[key] = {
        assignee: key,
        total: 0, completed: 0, en_progreso: 0, pendiente: 0, bloqueado: 0, overdue: 0,
        tasks: [],
        total_open_ms: 0, open_count_for_avg: 0, completed_times_ms: [],
      }
    }
    const a = byAssignee[key]
    a.total++
    a.tasks.push(task)

    const status = task.status || (task.completed ? 'completado' : 'pendiente')
    if (status === 'completado') {
      a.completed++
      // Calculate resolution time
      const created = new Date(task.created_at).getTime()
      const completedAt = task.completed_at
        ? new Date(task.completed_at).getTime()
        : task.status_changed_at ? new Date(task.status_changed_at).getTime() : now
      const resMs = completedAt - created
      if (resMs > 0) a.completed_times_ms.push(resMs)
    } else if (status === 'en_progreso') {
      a.en_progreso++
      const openMs = now - new Date(task.created_at).getTime()
      a.total_open_ms += openMs
      a.open_count_for_avg++
    } else if (status === 'bloqueado') {
      a.bloqueado++
      const openMs = now - new Date(task.created_at).getTime()
      a.total_open_ms += openMs
      a.open_count_for_avg++
    } else {
      a.pendiente++
      const openMs = now - new Date(task.created_at).getTime()
      a.total_open_ms += openMs
      a.open_count_for_avg++
    }

    // Check overdue
    if (task.due_date && status !== 'completado') {
      const due = new Date(task.due_date).getTime()
      if (due < now) a.overdue++
    }
  }

  function msToHuman(ms: number): string {
    const h = Math.floor(ms / 3600000)
    const d = Math.floor(h / 24)
    if (d >= 1) return `${d}d`
    if (h >= 1) return `${h}h`
    return '<1h'
  }

  const result = Object.values(byAssignee)
    .filter(a => a.assignee !== 'Sin asignar' || a.total > 0)
    .sort((a, b) => b.total - a.total)
    .map(a => {
      const avgOpenMs   = a.open_count_for_avg > 0 ? a.total_open_ms / a.open_count_for_avg : 0
      const avgResolveMs = a.completed_times_ms.length > 0
        ? a.completed_times_ms.reduce((s, v) => s + v, 0) / a.completed_times_ms.length
        : 0
      const completionRate = a.total > 0 ? Math.round((a.completed / a.total) * 100) : 0

      // Open tasks sorted by age
      const openTasks = a.tasks
        .filter(t => (t.status || (t.completed ? 'completado' : 'pendiente')) !== 'completado')
        .map(t => ({
          id: t.id,
          title: t.title,
          status: t.status || 'pendiente',
          priority: t.priority || 'normal',
          due_date: t.due_date,
          is_subtask: !!t.parent_task_id,
          open_since: msToHuman(now - new Date(t.created_at).getTime()),
          overdue: t.due_date ? new Date(t.due_date).getTime() < now : false,
        }))
        .sort((a, b) => (b.overdue ? 1 : 0) - (a.overdue ? 1 : 0))

      return {
        assignee:        a.assignee,
        total:           a.total,
        completed:       a.completed,
        en_progreso:     a.en_progreso,
        pendiente:       a.pendiente,
        bloqueado:       a.bloqueado,
        overdue:         a.overdue,
        completion_rate: completionRate,
        avg_open_time:   avgOpenMs > 0 ? msToHuman(avgOpenMs) : null,
        avg_resolve_time: avgResolveMs > 0 ? msToHuman(avgResolveMs) : null,
        open_tasks:      openTasks,
      }
    })

  return NextResponse.json(result)
}
