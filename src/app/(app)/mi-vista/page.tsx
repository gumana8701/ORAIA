import { getSessionProfile } from '@/lib/auth'
import Link from 'next/link'

const ROL_CONFIG: Record<string, { label: string; icon: string; color: string; desc: string }> = {
  supervisor:     { label: 'Supervisor',     icon: '🔭', color: '#818cf8', desc: 'Vista del equipo y sus proyectos' },
  client_success: { label: 'Client Success', icon: '🤝', color: '#60a5fa', desc: 'Vista de seguimiento de clientes' },
  cs_user:        { label: 'CS User',        icon: '👤', color: '#67e8f9', desc: 'Vista de proyectos activos' },
  developer:      { label: 'Developer',      icon: '💻', color: '#4ade80', desc: 'Vista de tus proyectos asignados' },
}

export default async function MiVista() {
  const profile = await getSessionProfile()
  const cfg = ROL_CONFIG[profile.rol]

  return (
    <div style={{
      minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        maxWidth: '520px', width: '100%', textAlign: 'center',
        background: 'rgba(17,24,39,0.85)',
        border: `1px solid ${cfg?.color ?? '#E8792F'}22`,
        borderRadius: '20px', padding: '48px 40px',
        backdropFilter: 'blur(20px)',
      }}>
        {/* Icon */}
        <div style={{
          width: '72px', height: '72px', borderRadius: '18px', margin: '0 auto 24px',
          background: `${cfg?.color ?? '#E8792F'}18`,
          border: `2px solid ${cfg?.color ?? '#E8792F'}30`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '32px',
        }}>
          {cfg?.icon ?? '🟠'}
        </div>

        <h1 style={{ color: '#fff', fontSize: '24px', fontWeight: 800, margin: '0 0 8px' }}>
          Hola, {profile.nombre.split(' ')[0]} 👋
        </h1>

        <span style={{
          display: 'inline-block', fontSize: '11px', fontWeight: 700,
          padding: '3px 10px', borderRadius: '6px', marginBottom: '20px',
          background: `${cfg?.color ?? '#E8792F'}18`,
          color: cfg?.color ?? '#E8792F',
          border: `1px solid ${cfg?.color ?? '#E8792F'}25`,
          textTransform: 'uppercase', letterSpacing: '0.05em',
        }}>
          {cfg?.label ?? profile.rol}
        </span>

        <div style={{
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: '12px', padding: '20px', marginBottom: '28px',
        }}>
          <div style={{ fontSize: '28px', marginBottom: '10px' }}>🚧</div>
          <p style={{ color: '#94a3b8', fontSize: '14px', lineHeight: 1.6, margin: 0 }}>
            Tu vista personalizada está en construcción.
            <br />
            El administrador la configurará próximamente.
          </p>
        </div>

        <p style={{ color: '#475569', fontSize: '12px', margin: '0 0 20px' }}>
          {cfg?.desc}
        </p>

        <Link href="/" style={{
          display: 'inline-block', padding: '10px 24px', borderRadius: '8px',
          background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)',
          color: '#94a3b8', fontSize: '13px', fontWeight: 600, textDecoration: 'none',
          transition: 'all 0.15s',
        }}>
          ← Ver proyectos
        </Link>
      </div>
    </div>
  )
}
