'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTheme } from '@/lib/ThemeContext'
import { useState, useEffect } from 'react'

const allNav = [
  { href: '/insights',            label: 'Insights',     icon: '📊', adminOnly: false },
  { href: '/',                    label: 'Proyectos',    icon: '📂', adminOnly: false },
  { href: '/alertas',             label: 'Alertas',      icon: '⚠️',  adminOnly: true  },
  { href: '/admin/onboarding',    label: 'Onboarding',   icon: '🚀', adminOnly: true  },
  { href: '/admin/usuarios',      label: 'Usuarios',     icon: '🔐', adminOnly: true  },
  { href: '/admin/notion-link',   label: 'Notion Link',  icon: '📋', adminOnly: false },
  { href: '/admin/pm-board',      label: 'PM Board',     icon: '📊', adminOnly: false },
  { href: '/admin/health',        label: 'Health Check', icon: '🔍', adminOnly: false },
  { href: '/admin/preview',       label: 'Ver como…',    icon: '👁️',  adminOnly: true  },
]

export default function Sidebar({ role = 'developer' }: { role?: string }) {
  const pathname  = usePathname()
  const { theme, toggle } = useTheme()
  const isAdmin = role === 'admin'
  const nav = allNav.filter(item => !item.adminOnly || isAdmin)
  const isLight = theme === 'light'
  const [mobileOpen, setMobileOpen] = useState(false)

  // Close sidebar on route change
  useEffect(() => { setMobileOpen(false) }, [pathname])
  // Prevent body scroll when mobile sidebar open
  useEffect(() => {
    if (mobileOpen) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [mobileOpen])

  const sidebarContent = (
    <>
      {/* Subtle orange halo */}
      <div style={{
        position: 'absolute', top: '-40px', right: '-40px',
        width: '180px', height: '180px',
        background: 'radial-gradient(circle, rgba(232,121,47,0.08) 0%, transparent 70%)',
        borderRadius: '50%', pointerEvents: 'none', filter: 'blur(30px)',
      }}/>

      {/* Logo */}
      <div style={{ marginBottom: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <img src="/logo.png" alt="ORA IA" style={{ height: '64px', width: 'auto', objectFit: 'contain', marginBottom: '8px' }} />
        <div style={{
          fontSize: '9px', color: isLight ? 'rgba(10,15,30,0.35)' : 'rgba(160,174,192,0.5)',
          textTransform: 'uppercase', letterSpacing: '2.5px', textAlign: 'center', fontWeight: 600,
        }}>Centro de Proyectos</div>
      </div>

      <div style={{ height: '1px', background: 'linear-gradient(90deg, transparent, rgba(232,121,47,0.25), transparent)', marginBottom: '20px' }}/>

      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '3px' }}>
        {nav.map(item => {
          const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
          return (
            <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '10px 12px', borderRadius: '8px',
                fontSize: '13px', fontWeight: active ? 600 : 400,
                color: active ? '#E8792F' : isLight ? '#4A5568' : '#A0AEC0',
                background: active ? 'rgba(232,121,47,0.10)' : 'transparent',
                border: `1px solid ${active ? 'rgba(232,121,47,0.18)' : 'transparent'}`,
                transition: 'all 0.15s', cursor: 'pointer', position: 'relative',
              }}>
                {active && <span style={{ position: 'absolute', left: 0, top: '20%', bottom: '20%', width: '2px', borderRadius: '0 2px 2px 0', background: 'linear-gradient(180deg, #E8792F, #d4651f)', boxShadow: '0 0 8px rgba(232,121,47,0.6)' }}/>}
                <span style={{ fontSize: '15px', flexShrink: 0 }}>{item.icon}</span>
                {item.label}
              </div>
            </Link>
          )
        })}
      </nav>

      <div style={{ height: '1px', background: isLight ? 'linear-gradient(90deg, transparent, rgba(0,0,0,0.08), transparent)' : 'linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)', margin: '14px 0' }}/>

      {/* Theme toggle */}
      <button onClick={toggle} title={isLight ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'} style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
        padding: '9px 12px', borderRadius: '8px', border: `1px solid ${isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.07)'}`,
        background: isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.03)', cursor: 'pointer', marginBottom: '12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '14px' }}>{isLight ? '🌙' : '☀️'}</span>
          <span style={{ fontSize: '11px', fontWeight: 600, color: isLight ? '#4A5568' : '#A0AEC0', letterSpacing: '0.03em' }}>
            {isLight ? 'Modo Oscuro' : 'Modo Claro'}
          </span>
        </div>
        <div style={{ width: '32px', height: '18px', borderRadius: '9px', background: isLight ? 'rgba(0,0,0,0.12)' : 'rgba(232,121,47,0.25)', position: 'relative' }}>
          <div style={{ position: 'absolute', top: '3px', left: isLight ? '3px' : '15px', width: '12px', height: '12px', borderRadius: '50%', background: isLight ? '#94A3B8' : '#E8792F', transition: 'left 0.25s ease' }}/>
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
          color: isLight ? 'rgba(10,15,30,0.4)' : 'rgba(160,174,192,0.4)', fontSize: '12px', fontWeight: 500,
        }}
        onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
        onMouseLeave={e => (e.currentTarget.style.color = isLight ? 'rgba(10,15,30,0.4)' : 'rgba(160,174,192,0.4)')}
      >
        <span>🚪</span> Cerrar sesión
      </button>

      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '10px', color: isLight ? 'rgba(10,15,30,0.25)' : 'rgba(160,174,192,0.3)', letterSpacing: '0.5px' }}>ORA IA · v2.0</div>
      </div>
    </>
  )

  return (
    <>
      {/* ── Desktop sidebar ── */}
      <aside className="sidebar-desktop" style={{
        width: '220px', minHeight: '100vh',
        background: isLight ? 'linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%)' : 'linear-gradient(180deg, #0D1220 0%, #0A0F1E 100%)',
        borderRight: `1px solid ${isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.07)'}`,
        display: 'flex', flexDirection: 'column', padding: '32px 20px 24px',
        flexShrink: 0, position: 'relative',
      }}>
        {sidebarContent}
      </aside>

      {/* ── Mobile hamburger button ── */}
      <button
        className="mobile-menu-btn"
        onClick={() => setMobileOpen(true)}
        style={{
          position: 'fixed', top: '16px', left: '16px', zIndex: 200,
          width: '40px', height: '40px', borderRadius: '10px',
          background: isLight ? '#fff' : '#0D1220',
          border: `1px solid ${isLight ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.12)'}`,
          cursor: 'pointer', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: '4px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        }}
      >
        {[0,1,2].map(i => (
          <div key={i} style={{ width: '18px', height: '2px', background: '#E8792F', borderRadius: '1px' }}/>
        ))}
      </button>

      {/* ── Mobile overlay ── */}
      {mobileOpen && (
        <div
          className="mobile-overlay"
          onClick={() => setMobileOpen(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
            zIndex: 300, backdropFilter: 'blur(2px)',
          }}
        />
      )}

      {/* ── Mobile sidebar drawer ── */}
      <aside
        className="sidebar-mobile"
        style={{
          position: 'fixed', top: 0, left: 0, height: '100vh', width: '260px',
          background: isLight ? 'linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%)' : 'linear-gradient(180deg, #0D1220 0%, #0A0F1E 100%)',
          borderRight: `1px solid ${isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.07)'}`,
          display: 'flex', flexDirection: 'column', padding: '32px 20px 24px',
          zIndex: 400, overflowY: 'auto',
          transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        {/* Close button */}
        <button
          onClick={() => setMobileOpen(false)}
          style={{
            position: 'absolute', top: '16px', right: '16px',
            background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
            color: '#94a3b8', borderRadius: '8px', padding: '6px 10px',
            cursor: 'pointer', fontSize: '14px',
          }}
        >✕</button>
        {sidebarContent}
      </aside>

      <style>{`
        .sidebar-desktop { display: flex !important; }
        .mobile-menu-btn { display: none !important; }
        .sidebar-mobile { display: none !important; }
        .mobile-overlay { display: none !important; }

        @media (max-width: 768px) {
          .sidebar-desktop { display: none !important; }
          .mobile-menu-btn { display: flex !important; }
          .sidebar-mobile { display: flex !important; }
          .mobile-overlay { display: block !important; }
        }
      `}</style>
    </>
  )
}
