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
    <aside className="w-60 min-h-screen bg-[#0D1220] border-r border-white/5 flex flex-col p-5 shrink-0">
      <div className="mb-10">
        <span className="text-2xl font-black glow-text tracking-tight">ORA IA</span>
        <p className="text-[10px] text-muted mt-0.5 uppercase tracking-widest">Centro de Proyectos</p>
      </div>
      <nav className="flex-1 space-y-1">
        {nav.map(item => (
          <Link key={item.href} href={item.href}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
              pathname === item.href ? 'bg-accent/15 text-accent border border-accent/20' : 'text-muted hover:text-white hover:bg-white/5'
            }`}>
            <span>{item.icon}</span>{item.label}
          </Link>
        ))}
      </nav>
      <div className="pt-4 border-t border-white/5">
        <p className="text-[11px] text-muted/50 text-center">M&R Support Hub</p>
      </div>
    </aside>
  )
}
