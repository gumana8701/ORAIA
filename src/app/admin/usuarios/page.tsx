import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import UserManagementClient from './UserManagementClient'

async function getData() {
  // Use service role to bypass RLS for admin operations
  const { createClient: createAdmin } = await import('@supabase/supabase-js')
  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Verify session via cookie-based server client
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login')

  // Check role via service role (bypasses RLS)
  const { data: myProfile } = await admin.from('user_profiles').select('rol').eq('id', user.id).single()
  if (myProfile?.rol !== 'admin') redirect('/')

  const [usersRes, devsRes] = await Promise.all([
    admin.from('user_profiles').select('*').order('created_at', { ascending: false }),
    admin.from('developers').select('id,nombre,emoji,color').eq('activo', true),
  ])

  return {
    users:      usersRes.data ?? [],
    developers: devsRes.data ?? [],
  }
}

export default async function AdminUsuarios() {
  const { users, developers } = await getData()

  return (
    <div>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#A0AEC0', marginBottom: '24px' }}>
        <Link href="/" style={{ color: '#A0AEC0', textDecoration: 'none' }}>Proyectos</Link>
        <span>/</span>
        <span style={{ color: '#fff', fontWeight: 500 }}>Admin · Usuarios</span>
      </div>

      {/* Header */}
      <div style={{
        background: 'rgba(17,24,39,0.85)', border: '1px solid rgba(255,255,255,0.10)',
        borderRadius: '12px', padding: '24px', marginBottom: '24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#fff', margin: '0 0 4px' }}>
            🔐 Gestión de Usuarios
          </h1>
          <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>
            {users.length} usuario{users.length !== 1 ? 's' : ''} registrado{users.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <UserManagementClient initialUsers={users} developers={developers} />
    </div>
  )
}
