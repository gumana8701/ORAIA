'use client'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useCallback } from 'react'

const STATUSES = [
  { value: '',          label: 'Todos',      color: '#A0AEC0' },
  { value: 'activo',    label: 'Activos',    color: '#22c55e' },
  { value: 'en_riesgo', label: 'En Riesgo',  color: '#ef4444' },
  { value: 'pausado',   label: 'Pausados',   color: '#6b7280' },
]

const COLORS = [
  { value: '',   label: 'Todos' },
  { value: '🟢', label: '🟢' },
  { value: '🟡', label: '🟡' },
  { value: '🔴', label: '🔴' },
  { value: '🟣', label: '🟣' },
]

const DEVELOPERS = ['Enzo ORA IA', 'Hector Ramirez', 'Luca Fonzo', 'Kevin ORA IA']
const DEV_EMOJIS: Record<string, string> = {
  'Enzo ORA IA': '🟠', 'Hector Ramirez': '🔵', 'Luca Fonzo': '🟢', 'Kevin ORA IA': '🟣'
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

  return (
    <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '28px' }}>
      {/* Search */}
      <div style={{ position: 'relative', flex: '1', minWidth: '220px', maxWidth: '360px' }}>
        <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#4a5568', fontSize: '14px' }}>🔍</span>
        <input
          type="text"
          placeholder="Buscar proyecto..."
          defaultValue={q}
          onChange={e => update('q', e.target.value)}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            background: 'rgba(17,24,39,0.85)',
            border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: '8px',
            padding: '9px 14px 9px 36px',
            color: '#fff',
            fontSize: '13px',
            outline: 'none',
          }}
        />
      </div>

      {/* Status filter */}
      <div style={{ display: 'flex', gap: '6px' }}>
        {STATUSES.map(s => (
          <button
            key={s.value}
            onClick={() => update('status', s.value)}
            style={{
              padding: '7px 12px',
              borderRadius: '7px',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer',
              border: '1px solid',
              borderColor: status === s.value ? s.color : 'rgba(255,255,255,0.08)',
              background: status === s.value ? `${s.color}18` : 'rgba(17,24,39,0.85)',
              color: status === s.value ? s.color : '#A0AEC0',
              transition: 'all 0.15s',
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Color/stage filter */}
      <div style={{ display: 'flex', gap: '6px' }}>
        {COLORS.map(c => (
          <button
            key={c.value}
            onClick={() => update('color', c.value)}
            style={{
              padding: '7px 10px',
              borderRadius: '7px',
              fontSize: '13px',
              cursor: 'pointer',
              border: '1px solid',
              borderColor: color === c.value ? '#E8792F' : 'rgba(255,255,255,0.08)',
              background: color === c.value ? 'rgba(232,121,47,0.15)' : 'rgba(17,24,39,0.85)',
              color: color === c.value ? '#E8792F' : '#A0AEC0',
              transition: 'all 0.15s',
              fontWeight: color === c.value ? 700 : 400,
            }}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Developer filter */}
      <div style={{ display: 'flex', gap: '6px' }}>
        <button
          onClick={() => update('dev', '')}
          style={{
            padding: '7px 10px', borderRadius: '7px', fontSize: '12px', cursor: 'pointer',
            border: '1px solid', borderColor: dev === '' ? '#E8792F' : 'rgba(255,255,255,0.08)',
            background: dev === '' ? 'rgba(232,121,47,0.15)' : 'rgba(17,24,39,0.85)',
            color: dev === '' ? '#E8792F' : '#A0AEC0', fontWeight: dev === '' ? 700 : 400,
          }}
        >
          Todos
        </button>
        {DEVELOPERS.map(name => (
          <button
            key={name}
            onClick={() => update('dev', name)}
            style={{
              padding: '7px 10px', borderRadius: '7px', fontSize: '12px', cursor: 'pointer',
              border: '1px solid', borderColor: dev === name ? '#E8792F' : 'rgba(255,255,255,0.08)',
              background: dev === name ? 'rgba(232,121,47,0.15)' : 'rgba(17,24,39,0.85)',
              color: dev === name ? '#E8792F' : '#A0AEC0', fontWeight: dev === name ? 700 : 400,
            }}
          >
            {DEV_EMOJIS[name]} {name.split(' ')[0]}
          </button>
        ))}
      </div>

      {/* Clear */}
      {(q || status || color || dev) && (
        <button
          onClick={() => { router.replace(pathname) }}
          style={{
            padding: '7px 12px', borderRadius: '7px', fontSize: '12px',
            cursor: 'pointer', border: '1px solid rgba(255,255,255,0.08)',
            background: 'transparent', color: '#4a5568',
          }}
        >
          ✕ Limpiar
        </button>
      )}
    </div>
  )
}
