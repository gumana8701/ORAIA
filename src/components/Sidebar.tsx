'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTheme } from '@/lib/ThemeContext'

const nav = [
  { href: '/insights',        label: 'Insights',   icon: '📊' },
  { href: '/',                label: 'Proyectos',  icon: '📂' },
  { href: '/alertas',         label: 'Alertas',    icon: '⚠️' },
  { href: '/onboarding',      label: 'Onboarding', icon: '🚀' },
  { href: '/admin/usuarios',      label: 'Usuarios',     icon: '🔐' },
  { href: '/admin/notion-link',   label: 'Notion Link',  icon: '📋' },
  { href: '/admin/preview',       label: 'Ver como…',    icon: '👁️' },
]

export default function Sidebar() {
  const pathname  = usePathname()
  const { theme, toggle } = useTheme()
  const isLight   = theme === 'light'

  return (
    <aside style={{
      width: '220px',
      minHeight: '100vh',
      background: isLight
        ? 'linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%)'
        : 'linear-gradient(180deg, #0D1220 0%, #0A0F1E 100%)',
      borderRight: `1px solid ${isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.07)'}`,
      display: 'flex',
      flexDirection: 'column',
      padding: '32px 20px 24px',
      flexShrink: 0,
      position: 'relative',
      transition: 'background 0.25s ease, border-color 0.25s ease',
    }}>

      {/* Subtle orange halo top-right corner */}
      <div style={{
        position: 'absolute', top: '-40px', right: '-40px',
        width: '180px', height: '180px',
        background: 'radial-gradient(circle, rgba(232,121,47,0.08) 0%, transparent 70%)',
        borderRadius: '50%', pointerEvents: 'none', filter: 'blur(30px)',
      }}/>

      {/* Logo */}
      <div style={{ marginBottom: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <img
          src="/logo.png"
          alt="ORA IA"
          style={{ height: '64px', width: 'auto', objectFit: 'contain', marginBottom: '8px' }}
        />
        <div style={{
          fontSize: '9px',
          color: isLight ? 'rgba(10,15,30,0.35)' : 'rgba(160,174,192,0.5)',
          textTransform: 'uppercase', letterSpacing: '2.5px', textAlign: 'center',
          fontWeight: 600,
          transition: 'color 0.25s ease',
        }}>
          Centro de Proyectos
        </div>
      </div>

      {/* Top divider */}
      <div style={{
        height: '1px',
        background: 'linear-gradient(90deg, transparent, rgba(232,121,47,0.25), transparent)',
        marginBottom: '20px',
      }}/>

      {/* Nav */}
      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '3px' }}>
        {nav.map(item => {
          const active = item.href === '/'
            ? pathname === '/'
            : pathname.startsWith(item.href)

          return (
            <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '10px 12px', borderRadius: '8px',
                fontSize: '13px', fontWeight: active ? 600 : 400,
                color: active
                  ? '#E8792F'
                  : isLight ? '#4A5568' : '#A0AEC0',
                background: active
                  ? 'rgba(232,121,47,0.10)'
                  : 'transparent',
                border: `1px solid ${active ? 'rgba(232,121,47,0.18)' : 'transparent'}`,
                transition: 'all 0.15s',
                cursor: 'pointer',
                position: 'relative',
              }}>
                {active && (
                  <span style={{
                    position: 'absolute', left: 0, top: '20%', bottom: '20%',
                    width: '2px', borderRadius: '0 2px 2px 0',
                    background: 'linear-gradient(180deg, #E8792F, #d4651f)',
                    boxShadow: '0 0 8px rgba(232,121,47,0.6)',
                  }}/>
                )}
                <span style={{ fontSize: '15px', flexShrink: 0 }}>{item.icon}</span>
                {item.label}
              </div>
            </Link>
          )
        })}
      </nav>

      {/* Bottom divider */}
      <div style={{
        height: '1px',
        background: isLight
          ? 'linear-gradient(90deg, transparent, rgba(0,0,0,0.08), transparent)'
          : 'linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)',
        marginBottom: '14px',
        marginTop: '14px',
      }}/>

      {/* Theme toggle */}
      <button
        onClick={toggle}
        title={isLight ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          padding: '9px 12px',
          borderRadius: '8px',
          border: `1px solid ${isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.07)'}`,
          background: isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.03)',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          marginBottom: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '14px' }}>{isLight ? '🌙' : '☀️'}</span>
          <span style={{
            fontSize: '11px',
            fontWeight: 600,
            color: isLight ? '#4A5568' : '#A0AEC0',
            letterSpacing: '0.03em',
          }}>
            {isLight ? 'Modo Oscuro' : 'Modo Claro'}
          </span>
        </div>

        {/* Toggle pill */}
        <div style={{
          width: '32px', height: '18px',
          borderRadius: '9px',
          background: isLight
            ? 'rgba(0,0,0,0.12)'
            : 'rgba(232,121,47,0.25)',
          position: 'relative',
          transition: 'background 0.25s ease',
          flexShrink: 0,
        }}>
          <div style={{
            position: 'absolute',
            top: '3px',
            left: isLight ? '3px' : '15px',
            width: '12px', height: '12px',
            borderRadius: '50%',
            background: isLight ? '#94A3B8' : '#E8792F',
            boxShadow: isLight ? 'none' : '0 0 6px rgba(232,121,47,0.6)',
            transition: 'left 0.25s ease, background 0.25s ease',
          }}/>
        </div>
      </button>

      {/* Logout */}
      <button
        onClick={async () => {
          const { createClient } = await import('@/lib/supabase/client')
          await createClient().auth.signOut()
          window.location.href = '/login'
        }}
        style={{
          display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
          padding: '8px 12px', borderRadius: '8px', border: 'none',
          background: 'transparent', cursor: 'pointer', marginBottom: '10px',
          color: isLight ? 'rgba(10,15,30,0.4)' : 'rgba(160,174,192,0.4)',
          fontSize: '12px', fontWeight: 500,
          transition: 'all 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
        onMouseLeave={e => (e.currentTarget.style.color = isLight ? 'rgba(10,15,30,0.4)' : 'rgba(160,174,192,0.4)')}
      >
        <span>🚪</span> Cerrar sesión
      </button>

      {/* Footer */}
      <div style={{ textAlign: 'center' }}>
        <div style={{
          fontSize: '10px',
          color: isLight ? 'rgba(10,15,30,0.25)' : 'rgba(160,174,192,0.3)',
          letterSpacing: '0.5px',
          transition: 'color 0.25s ease',
        }}>
          ORA IA · v2.0
        </div>
      </div>
    </aside>
  )
}
