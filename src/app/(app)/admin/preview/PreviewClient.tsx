'use client'
import { useState } from 'react'
import ProjectsPreview from './ProjectsPreview'

const ROL_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  admin:          { label: 'Admin',          icon: '👑', color: '#E8792F' },
  supervisor:     { label: 'Supervisor',     icon: '🔭', color: '#818cf8' },
  client_success: { label: 'Client Success', icon: '🤝', color: '#60a5fa' },
  cs_user:        { label: 'CS User',        icon: '👤', color: '#67e8f9' },
  developer:      { label: 'Developer',      icon: '💻', color: '#4ade80' },
}

export default function PreviewClient({ users, adminProfile }: { users: any[]; adminProfile: any }) {
  const [selected, setSelected] = useState<any | null>(null)

  const grouped: Record<string, any[]> = {}
  for (const u of users) {
    if (!grouped[u.rol]) grouped[u.rol] = []
    grouped[u.rol].push(u)
  }
  const roleOrder = ['admin', 'supervisor', 'developer', 'client_success', 'cs_user']

  return (
    <div style={{ maxWidth: '1200px' }}>
      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{
          fontSize: '26px', fontWeight: 800, color: '#fff',
          background: 'linear-gradient(135deg,#E8792F,#f59e0b)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          margin: '0 0 6px',
        }}>
          👁️ Ver como usuario
        </h1>
        <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>
          Previsualiza la app exactamente como la vería cada miembro del equipo
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '20px' }}>
        {/* User list */}
        <div style={{
          background: 'rgba(17,24,39,0.8)', border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: '16px', padding: '16px', height: 'fit-content',
        }}>
          <p style={{ color: '#475569', fontSize: '11px', fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 12px' }}>
            Seleccionar usuario
          </p>

          {roleOrder.map(rol => {
            const group = grouped[rol]
            if (!group?.length) return null
            const cfg = ROL_CONFIG[rol]
            return (
              <div key={rol} style={{ marginBottom: '16px' }}>
                <p style={{
                  color: cfg.color, fontSize: '10px', fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 6px',
                }}>
                  {cfg.icon} {cfg.label}
                </p>
                {group.map(u => (
                  <button key={u.id} onClick={() => setSelected(u)} style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    width: '100%', padding: '8px 10px', borderRadius: '8px',
                    border: selected?.id === u.id
                      ? `1px solid ${cfg.color}40`
                      : '1px solid transparent',
                    background: selected?.id === u.id
                      ? `${cfg.color}12`
                      : 'transparent',
                    cursor: 'pointer', marginBottom: '2px', textAlign: 'left',
                    transition: 'all 0.15s',
                  }}>
                    <span style={{
                      width: '28px', height: '28px', borderRadius: '8px',
                      background: `${cfg.color}20`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '14px', flexShrink: 0,
                    }}>
                      {cfg.icon}
                    </span>
                    <div>
                      <div style={{ color: '#e2e8f0', fontSize: '12px', fontWeight: 600 }}>
                        {u.nombre}
                      </div>
                      <div style={{ color: '#475569', fontSize: '10px' }}>{u.email}</div>
                    </div>
                  </button>
                ))}
              </div>
            )
          })}
        </div>

        {/* Preview panel */}
        <div style={{
          background: 'rgba(17,24,39,0.8)', border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: '16px', overflow: 'hidden',
        }}>
          {!selected ? (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', height: '400px', gap: '12px',
            }}>
              <span style={{ fontSize: '48px' }}>👈</span>
              <p style={{ color: '#475569', fontSize: '14px', margin: 0 }}>
                Selecciona un usuario para previsualizar su vista
              </p>
            </div>
          ) : (
            <ProjectsPreview profile={selected} />
          )}
        </div>
      </div>
    </div>
  )
}
