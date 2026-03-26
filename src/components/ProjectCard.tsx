'use client'
import Link from 'next/link'
import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Proyecto } from '@/lib/types'
import StatusBadge from './StatusBadge'

const prioColor: Record<string, string> = {
  alta: '#ef4444', media: '#eab308', baja: '#6b7280'
}

const ALL_DEVS = [
  { id: null,       nombre: 'Sin asignar',   emoji: '➕', color: '#334155' },
  { id: 'enzo',     nombre: 'Enzo ORA IA',   emoji: '🟠', color: '#E8792F' },
  { id: 'hector',   nombre: 'Hector Ramirez',emoji: '🔵', color: '#3b82f6' },
  { id: 'luca',     nombre: 'Luca Fonzo',    emoji: '🟢', color: '#22c55e' },
  { id: 'kevin',    nombre: 'Kevin ORA IA',  emoji: '🟣', color: '#a855f7' },
]

function timeAgo(iso?: string): string {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(mins / 60)
  const days  = Math.floor(hours / 24)
  if (days > 0)  return `hace ${days}d`
  if (hours > 0) return `hace ${hours}h`
  if (mins > 0)  return `hace ${mins}m`
  return 'ahora'
}

function fmtDate(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const today     = new Date(); today.setHours(0,0,0,0)
  const yesterday = new Date(today); yesterday.setDate(today.getDate()-1)
  const msgDay    = new Date(d); msgDay.setHours(0,0,0,0)
  const time = d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', timeZone: 'America/El_Salvador' })
  if (msgDay.getTime() === today.getTime())     return `hoy ${time}`
  if (msgDay.getTime() === yesterday.getTime()) return `ayer ${time}`
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/El_Salvador' }) + ' · ' + time
}

// ── Developer picker popover ──────────────────────────────────────────────────
function DevPicker({
  projectId, current, allDevs, onSaved
}: {
  projectId: string
  current: any[]
  allDevs: any[]
  onSaved: () => void
}) {
  const [open, setOpen]     = useState(false)
  const [saving, setSaving] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const assign = async (e: React.MouseEvent, devId: string | null) => {
    e.preventDefault(); e.stopPropagation()
    setSaving(true)
    try {
      await fetch('/api/projects/assign-dev', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId, developer_id: devId }),
      })
      onSaved()
      setOpen(false)
    } finally { setSaving(false) }
  }

  const currentIds = new Set(current.map(d => d.id))
  const label = current.length > 0
    ? current.map(d => `${d.emoji} ${d.nombre.split(' ')[0]}`).join(', ')
    : '+ Asignar dev'

  const hasDevs = current.length > 0

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={e => { e.preventDefault(); e.stopPropagation(); setOpen(o => !o) }}
        title="Cambiar desarrollador"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '4px',
          padding: '3px 8px', borderRadius: '5px', cursor: 'pointer',
          border: `1px solid ${hasDevs ? 'rgba(255,255,255,0.08)' : 'rgba(232,121,47,0.25)'}`,
          background: hasDevs ? 'rgba(255,255,255,0.03)' : 'rgba(232,121,47,0.07)',
          color: hasDevs ? '#64748b' : '#E8792F',
          fontSize: '10px', fontWeight: 500,
          transition: 'all 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(232,121,47,0.4)'; e.currentTarget.style.color = '#E8792F' }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = hasDevs ? 'rgba(255,255,255,0.08)' : 'rgba(232,121,47,0.25)'; e.currentTarget.style.color = hasDevs ? '#64748b' : '#E8792F' }}
      >
        {saving ? '⏳' : label}
        <span style={{ fontSize: '8px', opacity: 0.5 }}>✎</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', bottom: 'calc(100% + 6px)', left: 0, zIndex: 200,
          background: 'rgba(8,13,26,0.98)', backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,255,255,0.10)', borderRadius: '10px',
          overflow: 'hidden', minWidth: '180px',
          boxShadow: '0 -8px 32px rgba(0,0,0,0.6)',
        }}>
          <div style={{ padding: '8px 12px 6px', fontSize: '10px', color: '#334155', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            Asignar desarrollador
          </div>
          {allDevs.filter(d => d.activo !== false).map((d: any, i: number) => {
            const isAssigned = currentIds.has(d.id)
            return (
              <button
                key={d.id ?? 'none'}
                onClick={e => assign(e, d.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  width: '100%', padding: '9px 12px', textAlign: 'left',
                  border: 'none', cursor: 'pointer',
                  background: isAssigned ? `${d.color ?? '#E8792F'}12` : 'transparent',
                  color: isAssigned ? (d.color ?? '#E8792F') : '#94a3b8',
                  fontSize: '12px', fontWeight: isAssigned ? 600 : 400,
                  borderBottom: 'none',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                onMouseLeave={e => (e.currentTarget.style.background = isAssigned ? `${d.color ?? '#E8792F'}12` : 'transparent')}
              >
                <span style={{
                  width: '24px', height: '24px', borderRadius: '50%',
                  background: d.id ? `${d.color}18` : 'rgba(255,255,255,0.04)',
                  border: `1.5px solid ${d.id ? d.color + '30' : 'rgba(255,255,255,0.08)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '13px', lineHeight: 1, flexShrink: 0,
                }}>{d.emoji}</span>
                <span>{d.id ? d.nombre.split(' ')[0] + ' ' + (d.nombre.split(' ')[1] ?? '') : 'Sin asignar'}</span>
                {isAssigned && <span style={{ marginLeft: 'auto', fontSize: '10px', color: d.color }}>✓</span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Main Card ─────────────────────────────────────────────────────────────────
export default function ProjectCard({
  proyecto,
  developers = [],
  allDevs = [],
  notionEtapas,
}: {
  proyecto: Proyecto
  developers?: any[]
  allDevs?: any[]
  notionEtapas?: string[]
}) {
  const router = useRouter()
  const [localDevs, setLocalDevs] = useState(developers)

  // Refresh after assignment
  const handleSaved = useCallback(async () => {
    // Re-fetch this project's developers
    const res = await fetch(`/api/projects/assign-dev?project_id=${proyecto.id}`)
    if (res.ok) {
      const data = await res.json()
      setLocalDevs(data.developers ?? [])
    }
    router.refresh()
  }, [proyecto.id, router])

  // Sync if parent re-renders
  useEffect(() => { setLocalDevs(developers) }, [developers])

  const hasAlerts = (proyecto.alertas_count ?? 0) > 0
  const isRisk    = proyecto.estado === 'en_riesgo'

  const borderColor = isRisk
    ? 'rgba(239,68,68,0.30)'
    : hasAlerts ? 'rgba(245,158,11,0.28)' : 'rgba(255,255,255,0.07)'

  const glowShadow = isRisk
    ? '0 0 20px rgba(239,68,68,0.08)'
    : hasAlerts ? '0 0 16px rgba(245,158,11,0.06)' : 'none'

  // Build allDevs list — fallback to static if not passed
  const devOptions = allDevs.length > 0 ? allDevs : [
    { id: null, nombre: 'Sin asignar', emoji: '➕', color: '#334155', activo: true },
    { id: 'enzo-placeholder', nombre: 'Enzo ORA IA', emoji: '🟠', color: '#E8792F', activo: true },
    { id: 'hector-placeholder', nombre: 'Hector Ramirez', emoji: '🔵', color: '#3b82f6', activo: true },
    { id: 'luca-placeholder', nombre: 'Luca Fonzo', emoji: '🟢', color: '#22c55e', activo: true },
    { id: 'kevin-placeholder', nombre: 'Kevin ORA IA', emoji: '🟣', color: '#a855f7', activo: true },
  ]

  return (
    <div style={{ height: '100%' }}>
      <Link href={`/proyectos/${proyecto.id}`} style={{ textDecoration: 'none', color: 'inherit', display: 'block', height: '100%' }}>
        <div
          className="project-card"
          style={{
            background: 'rgba(17,24,39,0.65)', backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)', border: `1px solid ${borderColor}`,
            borderRadius: '14px', padding: '20px', cursor: 'pointer', height: '100%',
            boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '12px',
            position: 'relative', overflow: 'hidden',
            boxShadow: `0 4px 20px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05), ${glowShadow}`,
          }}
        >
          {/* Shimmer top line */}
          <div style={{
            position: 'absolute', top: 0, left: '15%', right: '15%', height: '1px', pointerEvents: 'none',
            background: isRisk
              ? 'linear-gradient(90deg, transparent, rgba(239,68,68,0.4), transparent)'
              : 'linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)',
          }}/>

          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px', flexWrap: 'wrap' }}>
                <span style={{
                  width: '6px', height: '6px', borderRadius: '50%',
                  background: prioColor[proyecto.prioridad], display: 'inline-block', flexShrink: 0,
                  boxShadow: `0 0 6px ${prioColor[proyecto.prioridad]}60`,
                }}/>
                {proyecto.color_emoji && <span style={{ fontSize: '12px' }}>{proyecto.color_emoji}</span>}
                <h3 style={{
                  fontWeight: 700, color: '#fff', margin: 0, fontSize: '13px',
                  letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {proyecto.nombre}
                </h3>
              </div>
              <p style={{ fontSize: '11px', color: '#64748b', margin: '0 0 2px' }}>
                {proyecto.total_mensajes
                  ? `${proyecto.total_mensajes.toLocaleString('es')} mensajes`
                  : proyecto.cliente}
              </p>
              {proyecto.nicho && (
                <span style={{
                  display: 'inline-block',
                  fontSize: '10px', color: '#94a3b8',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: '4px', padding: '1px 6px',
                  fontWeight: 500, letterSpacing: '0.02em',
                }}>
                  {proyecto.nicho}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0 }}>
              <StatusBadge estado={proyecto.estado} />
              {hasAlerts && (
                <span style={{
                  fontSize: '10px', padding: '2px 6px', borderRadius: '4px',
                  background: 'rgba(245,158,11,0.12)', color: '#fbbf24',
                  border: '1px solid rgba(245,158,11,0.22)', fontWeight: 600,
                }}>⚠ {proyecto.alertas_count}</span>
              )}
              {notionEtapas && notionEtapas.length > 0 && (
                <span style={{
                  fontSize: '10px', padding: '2px 6px', borderRadius: '4px',
                  background: 'rgba(232,121,47,0.10)', color: '#E8792F',
                  border: '1px solid rgba(232,121,47,0.22)', fontWeight: 600,
                  maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>📋 {notionEtapas[0]}</span>
              )}
            </div>
          </div>

          {/* Last message preview */}
          {proyecto.ultimo_mensaje && (
            <p style={{
              fontSize: '11px', color: 'rgba(148,163,184,0.65)', fontStyle: 'italic',
              lineHeight: 1.5, margin: 0,
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }}>
              "{proyecto.ultimo_mensaje}"
            </p>
          )}

          {/* Developer row */}
          <div
            style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}
            onClick={e => e.preventDefault()}
          >
            {/* Current dev pills */}
            {localDevs.map((d: any) => (
              <span key={d.id} style={{
                fontSize: '10px', padding: '2px 7px', borderRadius: '4px',
                background: `${d.color}12`, color: d.color,
                border: `1px solid ${d.color}22`, fontWeight: 500,
              }}>
                {d.emoji} {d.nombre.split(' ')[0]}
              </span>
            ))}
            {/* Assign picker */}
            <DevPicker
              projectId={proyecto.id}
              current={localDevs}
              allDevs={devOptions}
              onSaved={handleSaved}
            />
          </div>

          {/* Footer */}
          <div style={{ marginTop: 'auto', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
              <span style={{ fontSize: '10px', color: '#334155', display: 'flex', alignItems: 'center', gap: '3px' }}>
                <span>🕐</span> Último mensaje
              </span>
              <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 500 }}>
                {timeAgo(proyecto.ultima_actividad)}
              </span>
            </div>
            <div style={{
              fontSize: '11px', color: '#475569', fontWeight: 500,
              background: 'rgba(255,255,255,0.03)', borderRadius: '5px',
              padding: '4px 7px', textAlign: 'right',
            }}>
              📅 {fmtDate(proyecto.ultima_actividad)}
            </div>
          </div>
        </div>
      </Link>
    </div>
  )
}
