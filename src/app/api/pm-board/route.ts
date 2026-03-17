import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  const { data: notionProjects, error } = await sb
    .from('notion_projects')
    .select('id, nombre, estado, etapas, responsable, resp_chatbot, plan_type, lanzamiento_real, kick_off_date, es_chatbot, project_id')
    .order('nombre')

  if (error) {
    console.error('pm-board query error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const { data: taskStats } = await sb
    .from('notion_tasks')
    .select('notion_project_id, checked')

  const statsMap: Record<string, { total: number; done: number }> = {}
  for (const t of (taskStats || [])) {
    if (!statsMap[t.notion_project_id]) statsMap[t.notion_project_id] = { total: 0, done: 0 }
    statsMap[t.notion_project_id].total++
    if (t.checked) statsMap[t.notion_project_id].done++
  }

  const { data: kpis } = await sb
    .from('project_kpis')
    .select('project_id, kpi_text, categoria')

  const kpiMap: Record<string, Array<{ kpi_text: string; categoria: string }>> = {}
  for (const k of (kpis || [])) {
    if (!kpiMap[k.project_id]) kpiMap[k.project_id] = []
    kpiMap[k.project_id].push({ kpi_text: k.kpi_text, categoria: k.categoria })
  }

  const enriched = (notionProjects || []).map(p => ({
    ...p,
    taskStats: statsMap[p.id] || { total: 0, done: 0 },
    kpis: p.project_id ? (kpiMap[p.project_id] || []) : [],
  }))

  return NextResponse.json(enriched)
}
