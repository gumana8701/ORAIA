import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  // Fetch all active projects with their connections
  const { data: projects } = await sb
    .from('projects')
    .select('id, nombre, cliente, estado, project_type, whatsapp_chat_id, slack_channel_id, kpis_acordados, onboarded_at')
    .eq('estado', 'activo')
    .order('nombre')

  if (!projects) return NextResponse.json({ projects: [] })

  // Notion links (project_id FK)
  const { data: notionLinks } = await sb
    .from('notion_projects')
    .select('project_id')
    .not('project_id', 'is', null)

  const notionSet = new Set((notionLinks || []).map(n => n.project_id))

  // Developer assignments
  const { data: devAssignments } = await sb
    .from('project_developers')
    .select('project_id, developer_id')

  const devMap: Record<string, number> = {}
  for (const d of devAssignments || []) {
    devMap[d.project_id] = (devMap[d.project_id] || 0) + 1
  }

  // Task counts per project
  const { data: taskRows } = await sb
    .from('project_tasks')
    .select('project_id, status')

  const taskMap: Record<string, { total: number; completado: number }> = {}
  for (const t of taskRows || []) {
    if (!taskMap[t.project_id]) taskMap[t.project_id] = { total: 0, completado: 0 }
    taskMap[t.project_id].total++
    if (t.status === 'completado') taskMap[t.project_id].completado++
  }

  // Build health per project
  const result = projects.map(p => {
    const hasSlack   = !!p.slack_channel_id
    const hasWA      = !!p.whatsapp_chat_id
    const hasNotion  = notionSet.has(p.id)
    const hasDevs    = (devMap[p.id] || 0) > 0
    const kpisArr    = Array.isArray(p.kpis_acordados) ? p.kpis_acordados : []
    const hasKPIs    = kpisArr.length > 0
    const tasks      = taskMap[p.id] || { total: 0, completado: 0 }

    const checks = [hasSlack, hasWA, hasNotion, hasDevs, hasKPIs]
    const score  = Math.round((checks.filter(Boolean).length / checks.length) * 100)

    return {
      id: p.id,
      nombre: p.nombre,
      cliente: p.cliente,
      project_type: p.project_type,
      onboarded_at: p.onboarded_at,
      score,
      checks: { slack: hasSlack, whatsapp: hasWA, notion: hasNotion, devs: hasDevs, kpis: hasKPIs },
      tasks,
    }
  })

  return NextResponse.json({ projects: result })
}
