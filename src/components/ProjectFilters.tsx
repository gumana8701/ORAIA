'use client'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useCallback, useRef, useState, useEffect } from 'react'

const STATUSES = [
  { value: '',           label: 'Todos los estados', icon: '◎' },
  { value: 'activo',     label: '🟢 Activo',          color: '#22c55e' },
  { value: 'en_riesgo',  label: '🔴 En Riesgo',       color: '#ef4444' },
  { value: 'pausado',    label: '⏸ Pausado',           color: '#6b7280' },
  { value: 'completado', label: '✅ Completado',       color: '#3b82f6' },
]

const STAGES = [
  { value: '',   label: 'Todas las etapas' },
  { value: '🟢', label: '🟢 Producción',  color: '#22c55e' },
  { value: '🟡', label: '🟡 Desarrollo',  color: '#eab308' },
  { value: '🔴', label: '🔴 En riesgo',   color: '#ef4444' },
  { value: '🟣', label: '🟣 POC',         color: '#a855f7' },
]

const DEVELOPERS = [
  { name: '',               label: 'Todos los devs',  emoji: '👥', color: '#A0AEC0' },
  { name: 'Enzo ORA IA',   label: '🟠 Enzo',          emoji: '🟠', color: '#E8792F' },
  { name: 'Hector Ramirez',label: '🔵 Héctor',        emoji: '🔵', color: '#3b82f6' },
  { name: 'Luca Fonzo',    label: '🟢 Luca',           emoji: '🟢', color: '#22c55e' },
  { name: 'Kevin ORA IA',  label: '🟣 Kevin',          emoji: '🟣', color: '#a855f7' },
]

function Dropdown({
  value, options, onChange, placeholder
}: {
  value: string
  options: { value: string; label: string; color?: string }[]
  onChange: (v: string) => void
  placeholder: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const selected = options.find(o => o.value === value)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} style={{ position: 'relative', minWidth: '170px', zIndex: open ? 9999 : 'auto' }}>
      {/* Trigger */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: '8px', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer',
          background: value ? 'rgba(232,121,47,0.08)' : 'rgba(17,24,39,0.8)',
          border: `1px solid ${value ? 'rgba(232,121,47,0.25)' : 'rgba(255,255,255,0.08)'}`,
          color: value ? (selected?.color ?? '#E8792F') : '#64748b',
          fontSize: '12px', fontWeight: value ? 600 : 400,
          transition: 'all 0.15s',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selected ? selected.label : placeholder}
        </span>
        <span style={{ fontSize: '9px', opacity: 0.5, flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>▼</span>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 9999,
          background: 'rgba(10,15,30,0.98)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,255,255,0.10)',
          borderRadius: '10px', overflow: 'hidden',
          minWidth: '100%', width: 'max-content',
          boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
        }}>
          {options.map((opt, i) => (
            <button
              key={opt.value + i}
              onClick={() => { onChange(opt.value); setOpen(false) }}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '9px 14px', fontSize: '12px', cursor: 'pointer', border: 'none',
                background: value === opt.value ? 'rgba(232,121,47,0.12)' : 'transparent',
                color: value === opt.value ? (opt.color ?? '#E8792F') : (opt.value ? '#cbd5e1' : '#475569'),
                fontWeight: value === opt.value ? 600 : 400,
                borderBottom: i < options.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
              onMouseLeave={e => (e.currentTarget.style.background = value === opt.value ? 'rgba(232,121,47,0.12)' : 'transparent')}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function ProjectFilters({ devsByProject = {} }: { devsByProject?: Record<string, any[]> }) {
  const router   = useRouter()
  const pathname = usePathname()
  const params   = useSearchParams()

  const update = useCallback((key: string, val: string) => {
    const sp = new URLSearchParams(params.toString())
    if (val) sp.set(key, val)
    else sp.delete(key)
    router.replace(`${pathname}?${sp.toString()}`)
  }, [params, pathname, router])

  const q      = params.get('q') ?? ''
  const status = params.get('status') ?? ''
  const color  = params.get('color') ?? ''
  const dev    = params.get('dev') ?? ''
  const hasFilters = !!(q || status || color || dev)

  return (
    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '28px' }}>
      {/* Search */}
      <div style={{ position: 'relative', flex: '1', minWidth: '200px', maxWidth: '300px' }}>
        <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#334155', fontSize: '12px', pointerEvents: 'none' }}>🔍</span>
        <input
          type="text"
          placeholder="Buscar proyecto..."
          defaultValue={q}
          onChange={e => update('q', e.target.value)}
          style={{
            width: '100%', boxSizing: 'border-box',
            background: 'rgba(17,24,39,0.80)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '8px', padding: '8px 12px 8px 32px',
            color: '#fff', fontSize: '12px', outline: 'none',
          }}
        />
      </div>

      {/* Estado dropdown */}
      <Dropdown
        value={status}
        options={STATUSES.map(s => ({ value: s.value, label: s.label, color: (s as any).color }))}
        onChange={v => update('status', v)}
        placeholder="Estado"
      />

      {/* Etapa dropdown */}
      <Dropdown
        value={color}
        options={STAGES.map(s => ({ value: s.value, label: s.label, color: (s as any).color }))}
        onChange={v => update('color', v)}
        placeholder="Etapa"
      />

      {/* Desarrollador dropdown */}
      <Dropdown
        value={dev}
        options={DEVELOPERS.map(d => ({ value: d.name, label: d.label, color: d.color }))}
        onChange={v => update('dev', v)}
        placeholder="Desarrollador"
      />

      {/* Clear */}
      {hasFilters && (
        <button
          onClick={() => router.replace(pathname)}
          style={{
            padding: '8px 12px', borderRadius: '8px', fontSize: '11px', cursor: 'pointer',
            border: '1px solid rgba(255,255,255,0.06)', background: 'transparent', color: '#334155',
            transition: 'color 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = '#94a3b8')}
          onMouseLeave={e => (e.currentTarget.style.color = '#334155')}
        >
          ✕ Limpiar
        </button>
      )}
    </div>
  )
}
