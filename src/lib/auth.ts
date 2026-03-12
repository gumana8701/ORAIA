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
 * Returns null = no filter (see all projects).
 * All roles currently see all projects — RBAC filtering preserved for future use.
 */
export async function getAllowedProjectIds(_profile: UserProfile): Promise<string[] | null> {
  return null // all roles see all projects
}
