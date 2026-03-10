import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
)

// GET: fetch current developers for a project (used by card after save)
export async function GET(req: NextRequest) {
  const project_id = req.nextUrl.searchParams.get('project_id')
  if (!project_id) return NextResponse.json({ error: 'project_id required' }, { status: 400 })
  const { data } = await sb
    .from('project_developers')
    .select('developer:developers(id,nombre,emoji,color)')
    .eq('project_id', project_id)
  const developers = (data ?? []).map((r: any) => r.developer).filter(Boolean)
  return NextResponse.json({ developers })
}

// POST: assign a developer to a project (replaces existing)
export async function POST(req: NextRequest) {
  const { project_id, developer_id } = await req.json()
  if (!project_id) return NextResponse.json({ error: 'project_id required' }, { status: 400 })

  // Remove existing assignments for this project
  await sb.from('project_developers').delete().eq('project_id', project_id)

  // If developer_id is provided → insert new assignment
  if (developer_id) {
    const { error } = await sb.from('project_developers').insert({
      project_id,
      developer_id,
      rol: 'desarrollador',
      assigned_at: new Date().toISOString(),
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
