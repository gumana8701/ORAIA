import { createClient as createAdmin } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export type UserRole = 'admin' | 'supervisor' | 'client_success' | 'cs_user' | 'developer'

export interface UserProfile {
  id: string
  nombre: string
  email: string
  rol: UserRole
  developer_id: string | null
  activo: boolean
}

/** Get current session + profile. Redirects to /login if unauthenticated. */
export async function getSessionProfile(): Promise<UserProfile> {
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: profile } = await admin
    .from('user_profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile || !profile.activo) redirect('/login')
  return profile as UserProfile
}

/**
 * Build a project-id filter based on role.
 * Returns null = no filter (see all), or an array of allowed project IDs.
 */
export async function getAllowedProjectIds(profile: UserProfile): Promise<string[] | null> {
  if (profile.rol === 'admin') return null  // all projects

  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  if (profile.rol === 'supervisor') {
    // Supervisor sees all projects assigned to their team
    // Find all developers whose supervisor is this user (by developer_id link)
    // For now: supervisor sees ALL projects (same as admin for project view)
    // But only within their team's assignments
    const { data: teamDevs } = await admin
      .from('user_profiles')
      .select('developer_id')
      .eq('rol', 'developer')
      .not('developer_id', 'is', null)

    const devIds = (teamDevs ?? []).map(d => d.developer_id).filter(Boolean)
    if (!devIds.length) return []

    const { data: assignments } = await admin
      .from('project_developers')
      .select('project_id')
      .in('developer_id', devIds)

    const projectIds = [...new Set((assignments ?? []).map(a => a.project_id))]
    return projectIds
  }

  if (profile.rol === 'developer') {
    // Developer sees only their assigned projects
    if (!profile.developer_id) return []
    const { data: assignments } = await admin
      .from('project_developers')
      .select('project_id')
      .eq('developer_id', profile.developer_id)

    return (assignments ?? []).map(a => a.project_id)
  }

  if (profile.rol === 'client_success' || profile.rol === 'cs_user') {
    // CS sees client-facing projects (all active/at-risk for now)
    // TODO: refine when client projects are tagged
    const { data: projects } = await admin
      .from('projects')
      .select('id')
      .in('estado', ['activo', 'en_riesgo'])

    return (projects ?? []).map(p => p.id)
  }

  return []
}
