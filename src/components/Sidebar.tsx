'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const nav = [
  { href: '/', label: 'Panel General', icon: '⚡' },
  { href: '/proyectos', label: 'Proyectos', icon: '📂' },
]

export default function Sidebar() {
  const pathname = usePathname()
  return (
    <aside style={{
      width: '240px',
      minHeight: '100vh',
      background: '#0D1220',
      borderRight: '1px solid rgba(255,255,255,0.07)',
      display: 'flex',
      flexDirection: 'column',
      padding: '28px 16px',
      flexShrink: 0,
    }}>
      {/* Logo */}
      <div style={{ marginBottom: '40px', paddingLeft: '8px' }}>
        <div style={{
          fontSize: '22px',
          fontWeight: 800,
          background: 'linear-gradient(135deg, #fff 30%, #E8792F 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          letterSpacing: '-0.5px',
        }}>ORA IA</div>
        <div style={{
          fontSize: '10px',
          color: '#A0AEC0',
          textTransform: 'uppercase',
          letterSpacing: '2px',
          marginTop: '2px',
        }}>Centro de Proyectos</div>
      </div>

      {/* Divider */}
      <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', marginBottom: '16px' }} />

      {/* Nav */}
      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {nav.map(item => {
          const active = pathname === item.href
          return (
            <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 12px',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: active ? 600 : 400,
                color: active ? '#E8792F' : '#A0AEC0',
                background: active ? 'rgba(232,121,47,0.12)' : 'transparent',
                border: active ? '1px solid rgba(232,121,47,0.2)' : '1px solid transparent',
                transition: 'all 0.15s',
                cursor: 'pointer',
              }}>
                <span style={{ fontSize: '16px' }}>{item.icon}</span>
                {item.label}
              </div>
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div style={{ paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
        <div style={{ fontSize: '11px', color: 'rgba(160,174,192,0.4)' }}>M&R Support Hub</div>
      </div>
    </aside>
  )
}
