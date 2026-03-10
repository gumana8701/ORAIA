import { createClient as createAdmin } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const admin = () => createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function GET(req: NextRequest) {
  // Verify caller is admin
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = admin()
  const { data: callerProfile } = await db.from('user_profiles').select('rol').eq('id', user.id).single()
  if (callerProfile?.rol !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const rol = searchParams.get('rol')
  const developerId = searchParams.get('developerId')

  let projectIds: string[] | null = null

  if (rol === 'admin' || rol === 'cs_user') {
    projectIds = null // all projects
  } else if (rol === 'supervisor') {
    // All projects assigned to any developer
    const { data: teamDevs } = await db
      .from('user_profiles').select('developer_id').eq('rol', 'developer').not('developer_id', 'is', null)
    const devIds = (teamDevs ?? []).map((d: any) => d.developer_id).filter(Boolean)
    if (devIds.length) {
      const { data: asgn } = await db.from('project_developers').select('project_id').in('developer_id', devIds)
      projectIds = [...new Set((asgn ?? []).map((a: any) => a.project_id))]
    } else {
      projectIds = []
    }
  } else if (rol === 'developer' && developerId) {
    const { data: asgn } = await db.from('project_developers').select('project_id').eq('developer_id', developerId)
    projectIds = (asgn ?? []).map((a: any) => a.project_id)
  } else if (rol === 'client_success') {
    return NextResponse.json({ projects: [], locked: true })
  }

  let query = db.from('projects').select('id,nombre,cliente,estado,color_emoji,alertas_count,ultima_actividad')
    .order('ultima_actividad', { ascending: false, nullsFirst: false })

  if (projectIds !== null) {
    if (projectIds.length === 0) return NextResponse.json({ projects: [] })
    query = query.in('id', projectIds)
  }

  const { data: projects } = await query
  return NextResponse.json({ projects: projects ?? [] })
}
