'use client'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useCallback } from 'react'

const STATUSES = [
  { value: '',           label: 'Todos',       icon: '◎',   color: '#A0AEC0' },
  { value: 'activo',     label: 'Activo',      icon: '🟢',  color: '#22c55e' },
  { value: 'en_riesgo',  label: 'En Riesgo',   icon: '🔴',  color: '#ef4444' },
  { value: 'pausado',    label: 'Pausado',     icon: '⏸',   color: '#6b7280' },
  { value: 'completado', label: 'Completado',  icon: '✅',  color: '#3b82f6' },
]

const STAGES = [
  { value: '',   label: 'Todas etapas', color: '#A0AEC0' },
  { value: '🟢', label: '🟢 Producción',  color: '#22c55e' },
  { value: '🟡', label: '🟡 Desarrollo',  color: '#eab308' },
  { value: '🔴', label: '🔴 En riesgo',   color: '#ef4444' },
  { value: '🟣', label: '🟣 POC',         color: '#a855f7' },
]

const DEVELOPERS = [
  { name: 'Enzo ORA IA',    emoji: '🟠', color: '#E8792F', shortName: 'Enzo' },
  { name: 'Hector Ramirez', emoji: '🔵', color: '#3b82f6', shortName: 'Héctor' },
  { name: 'Luca Fonzo',     emoji: '🟢', color: '#22c55e', shortName: 'Luca' },
  { name: 'Kevin ORA IA',   emoji: '🟣', color: '#a855f7', shortName: 'Kevin' },
]

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

  const btnBase: React.CSSProperties = {
    padding: '6px 13px', borderRadius: '7px', fontSize: '12px',
    fontWeight: 500, cursor: 'pointer', border: '1px solid',
    transition: 'all 0.15s', background: 'transparent', whiteSpace: 'nowrap',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '28px' }}>

      {/* ── Row 1: Search + Clear ─────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: '380px' }}>
          <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#4a5568', fontSize: '13px', pointerEvents: 'none' }}>🔍</span>
          <input
            type="text"
            placeholder="Buscar proyecto..."
            defaultValue={q}
            onChange={e => update('q', e.target.value)}
            style={{
              width: '100%', boxSizing: 'border-box',
              background: 'rgba(17,24,39,0.80)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '8px', padding: '9px 14px 9px 36px',
              color: '#fff', fontSize: '13px', outline: 'none',
            }}
          />
        </div>
        {hasFilters && (
          <button
            onClick={() => router.replace(pathname)}
            style={{ ...btnBase, borderColor: 'rgba(255,255,255,0.08)', color: '#475569', fontSize: '11px', padding: '7px 12px' }}
          >
            ✕ Limpiar filtros
          </button>
        )}
      </div>

      {/* ── Row 2: Estado + Etapa unificado ──────────────────────────── */}
      <div style={{
        background: 'rgba(17,24,39,0.65)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: '12px',
        padding: '14px 16px',
      }}>
        {/* Section label */}
        <p style={{ fontSize: '10px', color: '#334155', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 10px' }}>
          Estado &amp; Etapa
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-start' }}>
          {/* Status buttons */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {STATUSES.map(s => {
              const active = status === s.value && !color
              return (
                <button
                  key={s.value}
                  onClick={() => { update('status', s.value); update('color', '') }}
                  style={{
                    ...btnBase,
                    borderColor: active ? s.color : 'rgba(255,255,255,0.07)',
                    background: active ? `${s.color}15` : 'rgba(255,255,255,0.03)',
                    color: active ? s.color : '#64748b',
                    fontWeight: active ? 700 : 400,
                    display: 'flex', alignItems: 'center', gap: '5px',
                  }}
                >
                  <span style={{ fontSize: '11px' }}>{s.icon}</span>
                  {s.label}
                </button>
              )
            })}
          </div>

          {/* Divider */}
          <div style={{ width: '1px', background: 'rgba(255,255,255,0.06)', alignSelf: 'stretch', margin: '0 2px' }}/>

          {/* Stage / color buttons */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {STAGES.map(s => {
              const active = color === s.value && !status
              return (
                <button
                  key={s.value}
                  onClick={() => { update('color', s.value); update('status', '') }}
                  style={{
                    ...btnBase,
                    borderColor: active ? s.color : 'rgba(255,255,255,0.07)',
                    background: active ? `${s.color}15` : 'rgba(255,255,255,0.03)',
                    color: active ? s.color : '#64748b',
                    fontWeight: active ? 700 : 400,
                  }}
                >
                  {s.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Row 3: Desarrolladores ────────────────────────────────────── */}
      <div style={{
        background: 'rgba(17,24,39,0.65)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: '12px',
        padding: '14px 16px',
      }}>
        <p style={{ fontSize: '10px', color: '#334155', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 10px' }}>
          Desarrollador
        </p>

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
          {/* All developers button */}
          <button
            onClick={() => update('dev', '')}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px',
              padding: '10px 16px', borderRadius: '10px', cursor: 'pointer',
              border: `1px solid ${dev === '' ? 'rgba(232,121,47,0.4)' : 'rgba(255,255,255,0.07)'}`,
              background: dev === '' ? 'rgba(232,121,47,0.12)' : 'rgba(255,255,255,0.02)',
              transition: 'all 0.15s', minWidth: '70px',
            }}
          >
            <span style={{ fontSize: '20px', lineHeight: 1 }}>👥</span>
            <span style={{
              fontSize: '11px', fontWeight: dev === '' ? 700 : 400,
              color: dev === '' ? '#E8792F' : '#4a5568',
              letterSpacing: '0.01em',
            }}>Todos</span>
          </button>

          {DEVELOPERS.map(d => {
            const active = dev === d.name
            return (
              <button
                key={d.name}
                onClick={() => update('dev', d.name)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px',
                  padding: '10px 16px', borderRadius: '10px', cursor: 'pointer',
                  border: `1px solid ${active ? d.color + '50' : 'rgba(255,255,255,0.07)'}`,
                  background: active ? `${d.color}12` : 'rgba(255,255,255,0.02)',
                  transition: 'all 0.15s', minWidth: '70px',
                  boxShadow: active ? `0 0 12px ${d.color}20` : 'none',
                }}
              >
                {/* Avatar circle */}
                <div style={{
                  width: '32px', height: '32px', borderRadius: '50%',
                  background: active ? `${d.color}20` : 'rgba(255,255,255,0.05)',
                  border: `1.5px solid ${active ? d.color + '60' : 'rgba(255,255,255,0.08)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '16px', lineHeight: 1,
                  boxShadow: active ? `0 0 8px ${d.color}40` : 'none',
                }}>
                  {d.emoji}
                </div>
                <span style={{
                  fontSize: '11px', fontWeight: active ? 700 : 400,
                  color: active ? d.color : '#4a5568',
                  letterSpacing: '0.01em',
                }}>{d.shortName}</span>
              </button>
            )
          })}
        </div>
      </div>

    </div>
  )
}
