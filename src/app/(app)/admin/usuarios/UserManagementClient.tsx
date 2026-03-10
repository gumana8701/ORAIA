'use client'
import { useState } from 'react'

type UserProfile = {
  id: string
  nombre: string
  email: string
  rol: string
  developer_id: string | null
  activo: boolean
  created_at: string
}

type Developer = { id: string; nombre: string; emoji: string; color: string }

const ROL_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  admin:          { label: 'Admin',          color: '#E8792F', bg: 'rgba(232,121,47,0.12)', icon: '👑' },
  supervisor:     { label: 'Supervisor',     color: '#818cf8', bg: 'rgba(129,140,248,0.12)', icon: '🔭' },
  client_success: { label: 'Client Success', color: '#60a5fa', bg: 'rgba(96,165,250,0.10)', icon: '🤝' },
  cs_user:        { label: 'CS User',        color: '#67e8f9', bg: 'rgba(103,232,249,0.10)', icon: '👤' },
  developer:      { label: 'Developer',      color: '#4ade80', bg: 'rgba(34,197,94,0.10)',  icon: '💻' },
}

export default function UserManagementClient({
  initialUsers, developers,
}: { initialUsers: UserProfile[]; developers: Developer[] }) {
  const [users, setUsers]       = useState(initialUsers)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [success, setSuccess]   = useState('')

  const [form, setForm] = useState({
    nombre: '', email: '', password: '', rol: 'developer', developer_id: '',
  })

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError(''); setSuccess('')

    const res = await fetch('/api/admin/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()

    if (!res.ok) { setError(data.error ?? 'Error desconocido'); setLoading(false); return }

    setSuccess(`✅ Usuario ${form.nombre} creado correctamente`)
    setForm({ nombre: '', email: '', password: '', rol: 'developer', developer_id: '' })
    setShowForm(false)

    // Refresh users list
    const refreshed = await fetch('/api/admin/list-users').then(r => r.json()).catch(() => null)
    if (refreshed?.users) setUsers(refreshed.users)

    setLoading(false)
  }

  return (
    <div>
      {/* Success banner */}
      {success && (
        <div style={{
          marginBottom: '16px', padding: '12px 16px', borderRadius: '8px',
          background: 'rgba(34,197,94,0.10)', border: '1px solid rgba(34,197,94,0.25)', color: '#4ade80', fontSize: '13px',
        }}>
          {success}
        </div>
      )}

      {/* Create user button */}
      {!showForm && (
        <button onClick={() => setShowForm(true)} style={{
          marginBottom: '20px', padding: '10px 20px', borderRadius: '8px', border: 'none',
          background: 'linear-gradient(135deg, #E8792F, #c45c1a)', color: '#fff',
          fontSize: '13px', fontWeight: 700, cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(232,121,47,0.25)',
        }}>
          + Crear nuevo usuario
        </button>
      )}

      {/* Create user form */}
      {showForm && (
        <div style={{
          background: 'rgba(17,24,39,0.9)', border: '1px solid rgba(232,121,47,0.20)',
          borderRadius: '12px', padding: '24px', marginBottom: '24px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <h2 style={{ color: '#fff', fontSize: '15px', fontWeight: 700, margin: 0 }}>Nuevo usuario</h2>
            <button onClick={() => { setShowForm(false); setError('') }} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '18px', cursor: 'pointer' }}>✕</button>
          </div>

          <form onSubmit={handleCreate}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              {/* Nombre */}
              <div>
                <label style={labelStyle}>Nombre completo</label>
                <input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                  required placeholder="Enzo García" style={inputStyle} />
              </div>
              {/* Email */}
              <div>
                <label style={labelStyle}>Email</label>
                <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  required placeholder="enzo@b360agencia.com" style={inputStyle} />
              </div>
              {/* Password */}
              <div>
                <label style={labelStyle}>Contraseña temporal</label>
                <input type="text" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  required placeholder="mínimo 8 caracteres" style={inputStyle} />
              </div>
              {/* Rol */}
              <div>
                <label style={labelStyle}>Rol</label>
                <select value={form.rol} onChange={e => setForm(f => ({ ...f, rol: e.target.value }))} style={inputStyle}>
                  <option value="admin">👑 Admin</option>
                  <option value="supervisor">🔭 Supervisor</option>
                  <option value="client_success">🤝 Client Success</option>
                  <option value="cs_user">👤 CS User</option>
                  <option value="developer">💻 Developer</option>
                </select>
              </div>
            </div>

            {/* Staff link */}
            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>Vincular a Staff (opcional)</label>
              <select value={form.developer_id} onChange={e => setForm(f => ({ ...f, developer_id: e.target.value }))} style={inputStyle}>
                <option value="">— Sin vincular —</option>
                {developers.map(d => (
                  <option key={d.id} value={d.id}>{d.emoji} {d.nombre}</option>
                ))}
              </select>
              <p style={{ fontSize: '11px', color: '#475569', margin: '5px 0 0' }}>
                Al vincular, el usuario verá los proyectos asignados a ese desarrollador
              </p>
            </div>

            {error && (
              <div style={{ marginBottom: '16px', padding: '10px 12px', borderRadius: '8px', background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171', fontSize: '13px' }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="submit" disabled={loading} style={{
                padding: '10px 24px', borderRadius: '8px', border: 'none',
                background: loading ? 'rgba(232,121,47,0.4)' : 'linear-gradient(135deg, #E8792F, #c45c1a)',
                color: '#fff', fontSize: '13px', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
              }}>
                {loading ? 'Creando…' : 'Crear usuario'}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setError('') }} style={{
                padding: '10px 20px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)',
                background: 'transparent', color: '#94a3b8', fontSize: '13px', cursor: 'pointer',
              }}>
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Users table */}
      <div style={{ background: 'rgba(17,24,39,0.85)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{
          display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1.5fr 80px',
          padding: '10px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)',
          fontSize: '10px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em',
        }}>
          <span>Usuario</span><span>Email</span><span>Rol</span><span>Vinculado a</span><span>Estado</span>
        </div>

        {users.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#475569', fontSize: '13px' }}>
            No hay usuarios aún
          </div>
        ) : users.map((u, i) => {
          const rol = ROL_CONFIG[u.rol] ?? ROL_CONFIG.developer
          const dev = developers.find(d => d.id === u.developer_id)
          return (
            <div key={u.id} style={{
              display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1.5fr 80px',
              padding: '14px 20px', alignItems: 'center',
              borderBottom: i < users.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
              background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
                  background: `${rol.color}20`, border: `1.5px solid ${rol.color}40`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px',
                }}>
                  {rol.icon}
                </div>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#e2e8f0' }}>{u.nombre}</span>
              </div>
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>{u.email}</span>
              <span style={{
                fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px',
                background: rol.bg, color: rol.color,
                textTransform: 'uppercase', letterSpacing: '0.05em',
                display: 'inline-block',
              }}>
                {rol.label}
              </span>
              <span style={{ fontSize: '12px', color: '#64748b' }}>
                {dev ? `${dev.emoji} ${dev.nombre}` : '—'}
              </span>
              <span style={{
                fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px',
                background: u.activo ? 'rgba(34,197,94,0.10)' : 'rgba(100,116,139,0.10)',
                color: u.activo ? '#4ade80' : '#94a3b8',
                display: 'inline-block',
              }}>
                {u.activo ? 'Activo' : 'Inactivo'}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '11px', fontWeight: 600, color: '#94a3b8',
  marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em',
}
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: '8px', boxSizing: 'border-box',
  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)',
  color: '#fff', fontSize: '13px', outline: 'none',
}
