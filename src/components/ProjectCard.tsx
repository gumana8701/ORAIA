'use client'
import Link from 'next/link'
import { Proyecto } from '@/lib/types'
import StatusBadge from './StatusBadge'

const prioColor: Record<string, string> = {
  alta: '#ef4444', media: '#eab308', baja: '#6b7280'
}
const prioLabel: Record<string, string> = {
  alta: 'Alta', media: 'Media', baja: 'Baja'
}

function timeAgo(iso?: string): string {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(mins / 60)
  const days  = Math.floor(hours / 24)
  if (days > 30) return `hace ${days}d`
  if (days > 0)  return `hace ${days}d`
  if (hours > 0) return `hace ${hours}h`
  if (mins > 0)  return `hace ${mins}m`
  return 'ahora'
}

function fmtDate(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const today    = new Date(); today.setHours(0,0,0,0)
  const yesterday = new Date(today); yesterday.setDate(today.getDate()-1)
  const msgDay = new Date(d); msgDay.setHours(0,0,0,0)
  const time = d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', timeZone: 'America/El_Salvador' })
  if (msgDay.getTime() === today.getTime())    return `hoy ${time}`
  if (msgDay.getTime() === yesterday.getTime()) return `ayer ${time}`
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/El_Salvador' }) + ' ' + time
}

export default function ProjectCard({ proyecto, developers = [] }: { proyecto: Proyecto; developers?: any[] }) {
  const hasAlerts = (proyecto.alertas_count ?? 0) > 0
  const isRisk    = proyecto.estado === 'en_riesgo'
  const isActive  = proyecto.estado === 'activo'

  const borderColor = isRisk
    ? 'rgba(239,68,68,0.30)'
    : hasAlerts
      ? 'rgba(245,158,11,0.28)'
      : 'rgba(255,255,255,0.07)'

  const glowShadow = isRisk
    ? '0 0 20px rgba(239,68,68,0.08)'
    : hasAlerts
      ? '0 0 16px rgba(245,158,11,0.06)'
      : 'none'

  return (
    <Link href={`/proyectos/${proyecto.id}`} style={{ textDecoration: 'none', color: 'inherit', display: 'block', height: '100%' }}>
      <div
        className="project-card"
        style={{
          background: 'rgba(17,24,39,0.65)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: `1px solid ${borderColor}`,
          borderRadius: '14px',
          padding: '20px',
          cursor: 'pointer',
          height: '100%',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: `0 4px 20px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05), ${glowShadow}`,
        }}
      >
        {/* Top shimmer line */}
        <div style={{
          position: 'absolute', top: 0, left: '15%', right: '15%', height: '1px',
          background: isRisk
            ? 'linear-gradient(90deg, transparent, rgba(239,68,68,0.4), transparent)'
            : 'linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)',
          pointerEvents: 'none',
        }}/>

        {/* Header row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Name row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px', flexWrap: 'wrap' }}>
              {/* Priority dot */}
              <span style={{
                width: '6px', height: '6px', borderRadius: '50%',
                background: prioColor[proyecto.prioridad],
                display: 'inline-block', flexShrink: 0,
                boxShadow: `0 0 6px ${prioColor[proyecto.prioridad]}60`,
              }}/>
              {proyecto.color_emoji && <span style={{ fontSize: '12px' }}>{proyecto.color_emoji}</span>}
              <h3 style={{
                fontWeight: 700, color: '#fff', margin: 0,
                fontSize: '13px', letterSpacing: '-0.01em',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {proyecto.nombre}
              </h3>
            </div>
            {/* Subtitle */}
            <p style={{ fontSize: '11px', color: '#64748b', margin: 0, fontWeight: 400 }}>
              {proyecto.total_mensajes
                ? `${proyecto.total_mensajes.toLocaleString('es')} mensajes`
                : proyecto.cliente}
            </p>
          </div>

          {/* Badges */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0 }}>
            <StatusBadge estado={proyecto.estado} />
            {hasAlerts && (
              <span style={{
                fontSize: '10px', padding: '2px 6px', borderRadius: '4px',
                background: 'rgba(245,158,11,0.12)',
                color: '#fbbf24',
                border: '1px solid rgba(245,158,11,0.22)',
                fontWeight: 600, letterSpacing: '0.02em',
              }}>
                ⚠ {proyecto.alertas_count}
              </span>
            )}
          </div>
        </div>

        {/* Last message preview */}
        {proyecto.ultimo_mensaje && (
          <p style={{
            fontSize: '11px',
            color: 'rgba(148,163,184,0.65)',
            fontStyle: 'italic',
            lineHeight: 1.5,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            margin: 0,
          }}>
            "{proyecto.ultimo_mensaje}"
          </p>
        )}

        {/* Developer pills */}
        {developers.length > 0 && (
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            {developers.map((d: any) => (
              <span key={d.id} title={d.nombre} style={{
                fontSize: '10px', padding: '2px 7px', borderRadius: '4px',
                background: `${d.color}12`, color: d.color,
                border: `1px solid ${d.color}22`, fontWeight: 500, letterSpacing: '0.01em',
              }}>
                {d.emoji} {d.nombre.split(' ')[0]}
              </span>
            ))}
          </div>
        )}

        {/* Footer */}
        <div style={{
          marginTop: 'auto', paddingTop: '8px',
          borderTop: '1px solid rgba(255,255,255,0.04)',
        }}>
          {/* Date line */}
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
  )
}
