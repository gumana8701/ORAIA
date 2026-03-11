'use client'
import { useState } from 'react'

interface KPI {
  id: string
  kpi_text: string
  categoria: string
  meta: string | null
  confirmado: boolean
}

interface Props {
  kpis: KPI[]
  projectId: string
}

const categoriaColor: Record<string, { color: string; bg: string; border: string }> = {
  ventas:        { color: '#4ade80', bg: 'rgba(74,222,128,0.08)',  border: 'rgba(74,222,128,0.2)'  },
  satisfaccion:  { color: '#60a5fa', bg: 'rgba(96,165,250,0.08)',  border: 'rgba(96,165,250,0.2)'  },
  tiempo:        { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)',  border: 'rgba(245,158,11,0.2)'  },
  general:       { color: '#a78bfa', bg: 'rgba(167,139,250,0.08)', border: 'rgba(167,139,250,0.2)' },
  crecimiento:   { color: '#f97316', bg: 'rgba(249,115,22,0.08)',  border: 'rgba(249,115,22,0.2)'  },
  retencion:     { color: '#34d399', bg: 'rgba(52,211,153,0.08)',  border: 'rgba(52,211,153,0.2)'  },
}

export default function ProjectKPIs({ kpis, projectId }: Props) {
  const [expanded, setExpanded] = useState(false)

  if (kpis.length === 0) {
    return (
      <div style={{
        padding: '10px 14px',
        background: 'rgba(255,255,255,0.03)',
        border: '1px dashed rgba(255,255,255,0.08)',
        borderRadius: '10px',
        minWidth: '200px',
        maxWidth: '260px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
          <span style={{ fontSize: '12px' }}>🎯</span>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            KPIs de Éxito
          </span>
        </div>
        <p style={{ fontSize: '11px', color: '#374151', margin: 0, fontStyle: 'italic' }}>
          Pendiente de sesión de bienvenida
        </p>
      </div>
    )
  }

  const visible = expanded ? kpis : kpis.slice(0, 2)
  const hasMore = kpis.length > 2

  return (
    <div style={{
      padding: '10px 14px',
      background: 'rgba(17,24,39,0.6)',
      border: '1px solid rgba(232,121,47,0.15)',
      borderRadius: '10px',
      minWidth: '220px',
      maxWidth: '280px',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '12px' }}>🎯</span>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#E8792F', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            KPIs de Éxito
          </span>
        </div>
        <span style={{
          fontSize: '10px', padding: '1px 6px', borderRadius: '4px',
          background: 'rgba(232,121,47,0.12)', color: '#E8792F',
          border: '1px solid rgba(232,121,47,0.2)', fontWeight: 700,
        }}>
          {kpis.length}
        </span>
      </div>

      {/* KPI list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
        {visible.map(kpi => {
          const style = categoriaColor[kpi.categoria] ?? categoriaColor.general
          return (
            <div key={kpi.id} style={{
              display: 'flex', alignItems: 'flex-start', gap: '6px',
              padding: '5px 8px', borderRadius: '6px',
              background: style.bg, border: `1px solid ${style.border}`,
            }}>
              <span style={{ color: style.color, fontSize: '10px', marginTop: '1px', flexShrink: 0 }}>●</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: '11px', color: '#cbd5e0', margin: 0, lineHeight: 1.4 }}>
                  {kpi.kpi_text}
                </p>
                {kpi.meta && (
                  <span style={{ fontSize: '10px', color: style.color, fontWeight: 600 }}>
                    → {kpi.meta}
                  </span>
                )}
              </div>
              {kpi.confirmado && (
                <span style={{ fontSize: '10px', color: '#4ade80', flexShrink: 0 }}>✓</span>
              )}
            </div>
          )
        })}
      </div>

      {/* Show more / less */}
      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            marginTop: '6px', background: 'none', border: 'none',
            color: '#E8792F', fontSize: '11px', cursor: 'pointer',
            padding: '2px 0', fontWeight: 600,
          }}
        >
          {expanded ? '▲ Ver menos' : `▼ +${kpis.length - 2} más`}
        </button>
      )}
    </div>
  )
}
