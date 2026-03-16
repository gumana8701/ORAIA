/**
 * Link / unlink a Notion project to a Supabase project
 * POST /api/notion/link
 * Body: { notion_project_id, project_id }  — pass project_id: null to unlink
 */
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  // Auth check — admin only
  const sb = await createServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await admin.from('user_profiles').select('rol').eq('id', user.id).single()
  if (!['admin', 'supervisor'].includes(profile?.rol)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { notion_project_id, project_id } = await req.json()
  if (!notion_project_id) return NextResponse.json({ error: 'notion_project_id required' }, { status: 400 })

  // Update notion_projects
  const { error } = await admin.from('notion_projects')
    .update({ project_id: project_id || null })
    .eq('id', notion_project_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Also update notion_tasks for this notion project
  await admin.from('notion_tasks')
    .update({ project_id: project_id || null })
    .eq('notion_project_id', notion_project_id)

  return NextResponse.json({ ok: true })
}
