import { createClient as createAdmin } from '@supabase/supabase-js'
import { getSessionProfile } from '@/lib/auth'
import { redirect } from 'next/navigation'
import PreviewClient from './PreviewClient'

async function getUsers() {
  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
  const { data } = await admin.from('user_profiles').select('*').order('rol').order('nombre')
  return data ?? []
}

export default async function PreviewPage() {
  const profile = await getSessionProfile()
  if (profile.rol !== 'admin') redirect('/')

  const users = await getUsers()
  return <PreviewClient users={users} adminProfile={profile} />
}
