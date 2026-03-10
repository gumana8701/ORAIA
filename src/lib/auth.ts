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
    // Supervisor sees projects assigned to their team's developers
    // Their developers are user_profiles with rol='developer' (all devs for now)
    const { data: teamDevs } = await admin
      .from('user_profiles')
      .select('developer_id')
      .eq('rol', 'developer')
      .not('developer_id', 'is', null)

    const devIds = (teamDevs ?? []).map((d: any) => d.developer_id).filter(Boolean)
    if (!devIds.length) return []

    const { data: assignments } = await admin
      .from('project_developers')
      .select('project_id')
      .in('developer_id', devIds)

    return [...new Set((assignments ?? []).map((a: any) => a.project_id))]
  }

  if (profile.rol === 'developer') {
    // Developer sees only their assigned projects (same layout as supervisor, filtered)
    if (!profile.developer_id) return []
    const { data: assignments } = await admin
      .from('project_developers')
      .select('project_id')
      .eq('developer_id', profile.developer_id)

    return (assignments ?? []).map((a: any) => a.project_id)
  }

  if (profile.rol === 'client_success') {
    // CS — vista en construcción por ahora, se implementará cuando Jennifer configure la suya
    return 'locked' as any
  }

  if (profile.rol === 'cs_user') {
    // CS Users ven TODOS los proyectos (sin filtro, igual que admin en visibilidad)
    return null
  }

  return []
}
