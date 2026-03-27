import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  const now = new Date()
  const todayISO = now.toISOString().slice(0, 10)
  const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString()
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 86400000).toISOString().slice(0, 10)

  const [
    projectsRes,
    tasksRes,
    alertsRes,
    historyRes,
    ticketsRes,
    msgsRes,
  ] = await Promise.all([
    sb.from('projects').select('id,nombre,estado,alertas_count,ultima_actividad,color_emoji'),
    sb.from('project_tasks')
      .select('id,project_id,title,status,assignee,due_date,priority,time_pendiente_seconds,time_bloqueado_seconds,started_at,completed_at,created_at,status_changed_at,parent_task_id')
      .is('parent_task_id', null),
    sb.from('alerts')
      .select('id,project_id,nivel,tipo,descripcion,created_at,resolved_at,resolution_seconds,resuelta')
      .order('created_at', { ascending: false })
      .limit(200),
    sb.from('task_status_history')
      .select('task_id,project_id,status,changed_at,changed_by,duration_seconds')
      .gte('changed_at', weekAgo)
      .order('changed_at', { ascending: false }),
    sb.from('task_tickets')
      .select('id,task_id,project_id,assignee,status,resolution_seconds,created_at,resolved_at')
      .order('created_at', { ascending: false })
      .limit(200),
    sb.from('messages')
      .select('id', { count: 'exact', head: true })
      .gte('timestamp', todayISO),
  ])

  const projects = projectsRes.data || []
  const tasks    = tasksRes.data || []
  const alerts   = alertsRes.data || []
  const history  = historyRes.data || []
  const tickets  = ticketsRes.data || []
  const msgsHoy  = msgsRes.count || 0

  // ── Project health ───────────────────────────────────────────────────────
  const projectHealth = projects.map(p => {
    const pTasks     = tasks.filter(t => t.project_id === p.id)
    const total      = pTasks.length
    const completed  = pTasks.filter(t => t.status === 'completado').length
    const blocked    = pTasks.filter(t => t.status === 'bloqueado')
    const pct        = total > 0 ? Math.round((completed / total) * 100) : 0
    const daysSinceActivity = p.ultima_actividad
      ? Math.floor((now.getTime() - new Date(p.ultima_actividad).getTime()) / 86400000)
      : 999

    // Health score (0-100): starts at 100, penalize for risk factors
    let score = 100
    if (p.estado === 'en_riesgo') score -= 30
    score -= blocked.length * 15
    score -= (p.alertas_count || 0) * 10
    if (daysSinceActivity > 7) score -= 20
    if (daysSinceActivity > 14) score -= 20
    score = Math.max(0, Math.min(100, score))

    // Max blocked time
    const maxBlockedHrs = blocked.reduce((max, t) => {
      const secs = t.time_bloqueado_seconds || 0
      return Math.max(max, secs / 3600)
    }, 0)

    return {
      id: p.id,
      nombre: p.nombre,
      estado: p.estado,
      color_emoji: p.color_emoji,
      alertas: p.alertas_count || 0,
      pct,
      total,
      completed,
      blocked: blocked.length,
      maxBlockedHrs: Math.round(maxBlockedHrs),
      daysSinceActivity,
      score,
    }
  }).sort((a, b) => a.score - b.score) // worst first

  // ── Team performance ─────────────────────────────────────────────────────
  const assigneeMap: Record<string, {
    nombre: string
    total: number
    completadas: number
    bloqueadas: number
    enProgreso: number
    pendientes: number
    overdueCount: number
    avgCompletionDays: number | null
    totalBlockedHrs: number
    ticketsAssigned: number
    ticketsResolved: number
    avgTicketResolutionHrs: number | null
  }> = {}

  for (const t of tasks) {
    const name = t.assignee?.trim() || 'Sin asignar'
    if (!assigneeMap[name]) {
      assigneeMap[name] = {
        nombre: name,
        total: 0, completadas: 0, bloqueadas: 0, enProgreso: 0, pendientes: 0,
        overdueCount: 0, avgCompletionDays: null, totalBlockedHrs: 0,
        ticketsAssigned: 0, ticketsResolved: 0, avgTicketResolutionHrs: null,
      }
    }
    const m = assigneeMap[name]
    m.total++
    if (t.status === 'completado') m.completadas++
    else if (t.status === 'bloqueado') m.bloqueadas++
    else if (t.status === 'en_progreso') m.enProgreso++
    else m.pendientes++

    m.totalBlockedHrs += Math.round((t.time_bloqueado_seconds || 0) / 3600)

    if (t.due_date && t.status !== 'completado' && t.due_date < todayISO) m.overdueCount++
  }

  // Avg completion days from task history
  const completionsByPerson: Record<string, number[]> = {}
  for (const t of tasks.filter(t => t.status === 'completado' && t.started_at && t.completed_at)) {
    const name = t.assignee?.trim() || 'Sin asignar'
    const days = (new Date(t.completed_at!).getTime() - new Date(t.started_at!).getTime()) / 86400000
    if (!completionsByPerson[name]) completionsByPerson[name] = []
    completionsByPerson[name].push(days)
  }
  for (const [name, days] of Object.entries(completionsByPerson)) {
    if (assigneeMap[name] && days.length > 0) {
      assigneeMap[name].avgCompletionDays = Math.round((days.reduce((a, b) => a + b, 0) / days.length) * 10) / 10
    }
  }

  // Tickets
  for (const tk of tickets) {
    const name = tk.assignee?.trim()
    if (!name || !assigneeMap[name]) continue
    assigneeMap[name].ticketsAssigned++
    if (tk.status === 'resolved') {
      assigneeMap[name].ticketsResolved++
    }
  }

  const team = Object.values(assigneeMap)
    .filter(a => a.nombre !== 'Sin asignar' && a.total > 0)
    .sort((a, b) => b.completadas - a.completadas)

  // ── Blocked tasks across all projects ────────────────────────────────────
  const blockedTasks = tasks
    .filter(t => t.status === 'bloqueado')
    .map(t => {
      const proj = projects.find(p => p.id === t.project_id)
      const blockedHrs = Math.round((t.time_bloqueado_seconds || 0) / 3600)
      // If status_changed_at is when it became blocked
      const blockedSince = t.status_changed_at
        ? Math.floor((now.getTime() - new Date(t.status_changed_at).getTime()) / 3600000)
        : blockedHrs
      return {
        id: t.id,
        title: t.title,
        assignee: t.assignee || 'Sin asignar',
        project: proj?.nombre || 'Desconocido',
        projectId: t.project_id,
        priority: t.priority || 'normal',
        blockedHrs: blockedSince,
      }
    })
    .sort((a, b) => b.blockedHrs - a.blockedHrs)

  // ── Upcoming due dates (next 7 days) ─────────────────────────────────────
  const upcoming = tasks
    .filter(t => t.due_date && t.status !== 'completado' && t.due_date <= sevenDaysFromNow)
    .map(t => {
      const proj = projects.find(p => p.id === t.project_id)
      const daysLeft = Math.ceil((new Date(t.due_date!).getTime() - now.getTime()) / 86400000)
      return {
        id: t.id,
        title: t.title,
        assignee: t.assignee || 'Sin asignar',
        project: proj?.nombre || 'Desconocido',
        projectId: t.project_id,
        dueDate: t.due_date!,
        daysLeft,
        overdue: daysLeft < 0,
      }
    })
    .sort((a, b) => a.daysLeft - b.daysLeft)
    .slice(0, 20)

  // ── Alerts summary ───────────────────────────────────────────────────────
  const openAlerts   = alerts.filter(a => !a.resuelta)
  const alertsByLevel = {
    critico: openAlerts.filter(a => a.nivel === 'critico').length,
    alto:    openAlerts.filter(a => a.nivel === 'alto').length,
    medio:   openAlerts.filter(a => a.nivel === 'medio').length,
    bajo:    openAlerts.filter(a => a.nivel === 'bajo').length,
  }
  const resolvedAlerts = alerts.filter(a => a.resuelta && a.resolution_seconds)
  const avgResolutionHrs = resolvedAlerts.length > 0
    ? Math.round(resolvedAlerts.reduce((s, a) => s + (a.resolution_seconds || 0), 0) / resolvedAlerts.length / 3600)
    : null

  // ── Recent activity (last 7 days) ────────────────────────────────────────
  const recentActivity = history.slice(0, 15).map(h => {
    const task = tasks.find(t => t.id === h.task_id)
    const proj = projects.find(p => p.id === h.project_id)
    return {
      taskTitle: task?.title || 'Tarea',
      project: proj?.nombre || 'Proyecto',
      projectId: h.project_id,
      status: h.status,
      changedBy: h.changed_by,
      changedAt: h.changed_at,
      durationSecs: h.duration_seconds,
    }
  })

  // ── Summary KPIs ─────────────────────────────────────────────────────────
  const totalTasks     = tasks.length
  const completedTasks = tasks.filter(t => t.status === 'completado').length
  const blockedCount   = tasks.filter(t => t.status === 'bloqueado').length
  const inProgressCount = tasks.filter(t => t.status === 'en_progreso').length

  return NextResponse.json({
    summary: {
      totalProjects: projects.length,
      activeProjects: projects.filter(p => p.estado === 'activo').length,
      riskProjects:   projects.filter(p => p.estado === 'en_riesgo').length,
      totalTasks, completedTasks, blockedCount, inProgressCount,
      openAlerts: openAlerts.length,
      alertsByLevel,
      avgResolutionHrs,
      msgsHoy,
      completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
    },
    projectHealth: projectHealth.slice(0, 20),
    team,
    blockedTasks: blockedTasks.slice(0, 10),
    upcoming,
    recentActivity,
    generatedAt: now.toISOString(),
  })
}
