import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get('project_id')
  const notionId = req.nextUrl.searchParams.get('notion_id')

  if (!projectId && !notionId) {
    return NextResponse.json({ error: 'project_id or notion_id required' }, { status: 400 })
  }

  try {
    // Get notion project
    let notionProject = null
    if (projectId) {
      const { data } = await sb.from('notion_projects').select('*').eq('project_id', projectId).in('plan_type', ['DFY', 'Partnership', 'Prueba de concepto']).limit(1).maybeSingle()
      notionProject = data
    } else if (notionId) {
      const { data } = await sb.from('notion_projects').select('*').eq('id', notionId).limit(1).maybeSingle()
      notionProject = data
    }

    if (!notionProject) {
      return NextResponse.json({ notion_project: null, tasks: [], task_stats: null })
    }

    // Get tasks
    const { data: tasks } = await sb.from('notion_tasks')
      .select('*')
      .eq('notion_project_id', notionProject.id)
      .order('section', { ascending: true })
      .order('position', { ascending: true })

    const taskList = tasks || []
    const completed = taskList.filter(t => t.checked).length

    return NextResponse.json({
      notion_project: notionProject,
      tasks: taskList,
      task_stats: {
        total: taskList.length,
        completed,
        pending: taskList.length - completed,
        pct: taskList.length > 0 ? Math.round((completed / taskList.length) * 100) : 0
      }
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
