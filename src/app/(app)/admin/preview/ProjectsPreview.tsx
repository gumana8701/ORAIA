'use client'
import { useEffect, useState } from 'react'

const ROL_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  admin:          { label: 'Admin',          icon: '👑', color: '#E8792F' },
  supervisor:     { label: 'Supervisor',     icon: '🔭', color: '#818cf8' },
  client_success: { label: 'Client Success', icon: '🤝', color: '#60a5fa' },
  cs_user:        { label: 'CS User',        icon: '👤', color: '#67e8f9' },
  developer:      { label: 'Developer',      icon: '💻', color: '#4ade80' },
}

const ESTADO_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  activo:    { label: 'Activo',    color: '#4ade80', bg: 'rgba(34,197,94,0.1)' },
  en_riesgo: { label: 'En Riesgo', color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
  pausado:   { label: 'Pausado',   color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  completado:{ label: 'Completado',color: '#60a5fa', bg: 'rgba(96,165,250,0.1)' },
}

export default function ProjectsPreview({ profile }: { profile: any }) {
  const [projects, setProjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const cfg = ROL_CONFIG[profile.rol] ?? ROL_CONFIG.developer

  useEffect(() => {
    setLoading(true)
    fetch(`/api/admin/preview-projects?userId=${profile.id}&rol=${profile.rol}&developerId=${profile.developer_id ?? ''}`)
      .then(r => r.json())
      .then(d => { setProjects(d.projects ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [profile.id])

  return (
    <div style={{ height: '100%' }}>
      {/* Fake browser bar */}
      <div style={{
        background: 'rgba(0,0,0,0.4)', borderBottom: '1px solid rgba(255,255,255,0.06)',
        padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '10px',
      }}>
        <div style={{ display: 'flex', gap: '5px' }}>
          {['#ef4444','#f59e0b','#4ade80'].map((c, i) => (
            <div key={i} style={{ width: '8px', height: '8px', borderRadius: '50%', background: c }} />
          ))}
        </div>
        <div style={{
          flex: 1, background: 'rgba(255,255,255,0.06)', borderRadius: '6px',
          padding: '4px 12px', fontSize: '11px', color: '#475569',
        }}>
          oraia-five.vercel.app — sesión como {profile.nombre}
        </div>
        <span style={{
          fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px',
          background: `${cfg.color}18`, color: cfg.color,
        }}>
          {cfg.icon} {cfg.label}
        </span>
      </div>

      {/* Simulated app content */}
      <div style={{ padding: '24px', maxHeight: '600px', overflowY: 'auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h2 style={{ color: '#f1f5f9', fontSize: '20px', fontWeight: 800, margin: 0 }}>
            Proyectos
          </h2>
          <span style={{
            fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '5px',
            background: `${cfg.color}15`, color: cfg.color,
            border: `1px solid ${cfg.color}25`,
          }}>
            {cfg.icon} {cfg.label === 'Admin' ? 'Vista completa' : `Vista de ${profile.nombre.split(' ')[0]}`}
          </span>
        </div>

        {loading && (
          <div style={{ color: '#475569', fontSize: '13px', textAlign: 'center', paddingTop: '40px' }}>
            Cargando proyectos...
          </div>
        )}

        {!loading && profile.rol === 'client_success' && (
          <div style={{
            textAlign: 'center', padding: '48px 20px',
            background: 'rgba(255,255,255,0.02)', borderRadius: '12px',
            border: '1px solid rgba(255,255,255,0.05)',
          }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>🚧</div>
            <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>
              Jennifer aún no ha configurado su vista.<br />
              Aparecerá aquí cuando lo haga.
            </p>
          </div>
        )}

        {!loading && profile.rol !== 'client_success' && projects.length === 0 && (
          <div style={{ color: '#475569', fontSize: '13px', textAlign: 'center', paddingTop: '40px' }}>
            Sin proyectos asignados
          </div>
        )}

        {!loading && profile.rol !== 'client_success' && (
          <div style={{ display: 'grid', gap: '10px' }}>
            {projects.map(p => {
              const est = ESTADO_CONFIG[p.estado] ?? { label: p.estado, color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' }
              return (
                <div key={p.id} style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: `1px solid rgba(255,255,255,0.07)`,
                  borderLeft: `3px solid ${est.color}`,
                  borderRadius: '10px', padding: '12px 16px',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '20px' }}>{p.color_emoji || '📂'}</span>
                    <div>
                      <div style={{ color: '#e2e8f0', fontSize: '13px', fontWeight: 600 }}>{p.nombre}</div>
                      {p.cliente && <div style={{ color: '#475569', fontSize: '11px' }}>{p.cliente}</div>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {p.alertas_count > 0 && (
                      <span style={{
                        fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: '4px',
                        background: 'rgba(239,68,68,0.15)', color: '#ef4444',
                      }}>
                        ⚠️ {p.alertas_count}
                      </span>
                    )}
                    <span style={{
                      fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '5px',
                      background: est.bg, color: est.color,
                    }}>
                      {est.label}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div style={{
          marginTop: '16px', padding: '8px 12px', borderRadius: '8px',
          background: 'rgba(232,121,47,0.06)', border: '1px solid rgba(232,121,47,0.12)',
        }}>
          <p style={{ color: '#E8792F', fontSize: '11px', margin: 0 }}>
            👁️ Vista de administrador — {profile.nombre} ve {projects.length} proyecto{projects.length !== 1 ? 's' : ''}
            {profile.rol === 'developer' ? ' (solo sus asignados)' :
             profile.rol === 'supervisor' ? ' (equipo completo)' :
             profile.rol === 'cs_user' ? ' (todos los proyectos)' : ''}
          </p>
        </div>
      </div>
    </div>
  )
}
