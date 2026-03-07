'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const nav = [
  { href: '/insights',   label: 'Insights',   icon: '📊' },
  { href: '/',           label: 'Proyectos',  icon: '📂' },
  { href: '/alertas',    label: 'Alertas',    icon: '⚠️' },
  { href: '/onboarding', label: 'Onboarding', icon: '🚀' },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside style={{
      width: '220px',
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #0D1220 0%, #0A0F1E 100%)',
      borderRight: '1px solid rgba(255,255,255,0.07)',
      display: 'flex',
      flexDirection: 'column',
      padding: '32px 20px 24px',
      flexShrink: 0,
      position: 'relative',
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
          fontSize: '9px', color: 'rgba(160,174,192,0.5)',
          textTransform: 'uppercase', letterSpacing: '2.5px', textAlign: 'center',
          fontWeight: 600,
        }}>
          Centro de Proyectos
        </div>
      </div>

      {/* Top divider with orange shimmer */}
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
                color: active ? '#E8792F' : '#A0AEC0',
                background: active ? 'rgba(232,121,47,0.10)' : 'transparent',
                border: `1px solid ${active ? 'rgba(232,121,47,0.18)' : 'transparent'}`,
                transition: 'all 0.15s',
                cursor: 'pointer',
                position: 'relative',
              }}>
                {/* Active indicator line */}
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

      {/* Bottom divider + footer */}
      <div style={{
        height: '1px',
        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)',
        marginBottom: '14px',
      }}/>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '10px', color: 'rgba(160,174,192,0.3)', letterSpacing: '0.5px' }}>
          ORA IA · v2.0
        </div>
      </div>
    </aside>
  )
}
