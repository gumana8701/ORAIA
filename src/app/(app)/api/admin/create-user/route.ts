/**
 * Admin-only: Create a new user with role
 * POST /api/admin/create-user
 * Body: { email, password, nombre, rol, developer_id? }
 */
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const adminSb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(req: NextRequest) {
  // Get caller session via cookies
  const cookieStore = await cookies()
  const caller = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    }
  )

  const { data: { user }, error: sessionErr } = await caller.auth.getUser()
  if (sessionErr || !user) {
    return NextResponse.json({ error: 'No session. Please log in again.' }, { status: 401 })
  }

  // Use SERVICE ROLE to check profile (avoids RLS issues)
  const { data: profile, error: profileErr } = await adminSb
    .from('user_profiles')
    .select('rol, nombre')
    .eq('id', user.id)
    .single()

  if (profileErr || !profile) {
    return NextResponse.json({ error: `Profile not found for user ${user.id}` }, { status: 403 })
  }

  if (profile.rol !== 'admin') {
    return NextResponse.json({ error: `Forbidden: your role is "${profile.rol}", must be "admin"` }, { status: 403 })
  }

  const { email, password, nombre, rol, developer_id } = await req.json()
  if (!email || !password || !nombre || !rol) {
    return NextResponse.json({ error: 'Missing required fields: email, password, nombre, rol' }, { status: 400 })
  }

  // Create auth user
  const { data: newUser, error: authErr } = await adminSb.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nombre },
  })
  if (authErr) return NextResponse.json({ error: authErr.message }, { status: 400 })

  // Create profile
  const { error: profileInsertErr } = await adminSb.from('user_profiles').insert({
    id: newUser.user.id,
    nombre,
    email,
    rol,
    developer_id: developer_id || null,
    activo: true,
  })

  if (profileInsertErr) {
    // Rollback: delete the auth user we just created
    await adminSb.auth.admin.deleteUser(newUser.user.id)
    return NextResponse.json({ error: profileInsertErr.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true, userId: newUser.user.id, nombre, email, rol })
}
