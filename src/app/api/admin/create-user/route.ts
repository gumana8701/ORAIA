/**
 * Admin-only: Create a new user with role
 * POST /api/admin/create-user
 * Body: { email, password, nombre, rol, developer_id? }
 * Requires: SUPABASE_SERVICE_ROLE_KEY (server-side only)
 */
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  // Verify caller is admin
  const caller = await createServerClient()
  const { data: { user } } = await caller.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await caller.from('user_profiles').select('rol').eq('id', user.id).single()
  if (profile?.rol !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { email, password, nombre, rol, developer_id } = await req.json()
  if (!email || !password || !nombre || !rol) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  // Use service role to create user
  const adminSb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Create auth user
  const { data: newUser, error: authErr } = await adminSb.auth.admin.createUser({
    email, password, email_confirm: true,
  })
  if (authErr) return NextResponse.json({ error: authErr.message }, { status: 400 })

  // Create profile
  const { error: profileErr } = await adminSb.from('user_profiles').insert({
    id:           newUser.user.id,
    nombre,
    email,
    rol,
    developer_id: developer_id || null,
  })
  if (profileErr) return NextResponse.json({ error: profileErr.message }, { status: 400 })

  return NextResponse.json({ ok: true, userId: newUser.user.id })
}
