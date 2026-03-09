'use client'

import { useEffect, useState, useTransition, useCallback } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────
interface ProjectDigest {
  id: string
  nombre: string
  estado: string
  msgs: number
  ultimoMensaje: string
  ultimoTimestamp: string
  alertas: number
  senders: string[]
}

interface DigestPayload {
  proyectos: ProjectDigest[]
  totalMsgs: number
  generatedAt: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function relLabel(iso: string): string {
  const diffH = (Date.now() - new Date(iso).getTime()) / 3_600_000
  if (diffH < 1)  return 'hace <1h'
  if (diffH < 24) return `hace ${Math.round(diffH)}h`
  return `hace ${Math.round(diffH / 24)}d`
}

function estadoColor(estado: string) {
  if (estado === 'en_riesgo') return { dot: '#ef4444', text: '#f87171', badge: 'rgba(239,68,68,0.12)' }
  if (estado === 'activo')    return { dot: '#E8792F', text: '#fb923c', badge: 'rgba(232,121,47,0.10)' }
  if (estado === 'pausado')   return { dot: '#94a3b8', text: '#94a3b8', badge: 'rgba(148,163,184,0.10)' }
  return { dot: '#22c55e', text: '#4ade80', badge: 'rgba(34,197,94,0.10)' }
}

function estadoLabel(estado: string) {
  const map: Record<string, string> = {
    activo: 'Activo', en_riesgo: 'En Riesgo', pausado: 'Pausado', completado: 'Completado'
  }
  return map[estado] ?? estado
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function AIDigest72h() {
  const [data, setData]         = useState<DigestPayload | null>(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(false)
  const [isPending, startTransition] = useTransition()

  const load = useCallback(() => {
    setLoading(true)
    setError(false)
    fetch('/api/ai-digest', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => { setError(true); setLoading(false) })
  }, [])

  useEffect(() => { load() }, [load])

  const refresh = () => startTransition(() => { load() })

  // ── Nothing to show ──────────────────────────────────────────────────────
  if (!loading && !error && data && data.proyectos.length === 0) return null

  // ── Spinner while loading ────────────────────────────────────────────────
  const isSpinning = loading || isPending

  return (
    <div style={{
      position: 'relative', zIndex: 1,
      marginBottom: '20px',
      background: 'linear-gradient(135deg, rgba(232,121,47,0.05) 0%, rgba(15,23,42,0.7) 60%)',
      border: '1px solid rgba(232,121,47,0.16)',
      borderRadius: '14px',
      overflow: 'hidden',
      backdropFilter: 'blur(10px)',
    }}>

      {/* Top glow */}
      <div style={{
        position: 'absolute', top: 0, left: 0,
        width: '220px', height: '70px',
        background: 'radial-gradient(ellipse, rgba(232,121,47,0.13) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* ── Header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: '14px 18px 0',
      }}>
        <div style={{
          width: '26px', height: '26px', borderRadius: '7px', flexShrink: 0,
          background: 'linear-gradient(135deg, #E8792F 0%, #c45c1a 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px',
        }}>🤖</div>

        <span style={{
          fontSize: '11px', fontWeight: 700, color: '#E8792F',
          textTransform: 'uppercase', letterSpacing: '0.08em',
        }}>
          Resumen IA · Últimas 72h
        </span>

        {data && !isSpinning && (
          <span style={{
            fontSize: '10px', color: '#475569',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '4px', padding: '2px 7px', fontWeight: 500,
          }}>
            {data.totalMsgs} msgs · {data.proyectos.length} proyecto{data.proyectos.length !== 1 ? 's' : ''}
          </span>
        )}

        <div style={{ flex: 1 }} />

        {/* Refresh button */}
        <button
          onClick={refresh}
          disabled={isSpinning}
          title="Actualizar resumen"
          style={{
            background: 'rgba(232,121,47,0.08)',
            border: '1px solid rgba(232,121,47,0.18)',
            borderRadius: '6px',
            color: isSpinning ? '#475569' : '#E8792F',
            cursor: isSpinning ? 'not-allowed' : 'pointer',
            fontSize: '13px', padding: '4px 8px',
            display: 'flex', alignItems: 'center', gap: '4px',
            transition: 'all 0.15s',
          }}
        >
          <span style={{
            display: 'inline-block',
            animation: isSpinning ? 'spin 0.8s linear infinite' : 'none',
          }}>↻</span>
          <span style={{ fontSize: '10px', fontWeight: 600 }}>
            {isSpinning ? 'Cargando…' : 'Actualizar'}
          </span>
        </button>
      </div>

      {/* Divider */}
      <div style={{ height: '1px', background: 'rgba(232,121,47,0.10)', margin: '12px 18px 0' }} />

      {/* ── Body ── */}
      <div style={{ padding: '12px 18px 16px' }}>

        {/* Loading skeleton */}
        {isSpinning && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[80, 60, 90].map((w, i) => (
              <div key={i} style={{
                height: '14px', borderRadius: '4px', width: `${w}%`,
                background: 'rgba(255,255,255,0.05)',
                animation: 'pulse 1.5s ease-in-out infinite',
              }} />
            ))}
          </div>
        )}

        {/* Error */}
        {error && !isSpinning && (
          <p style={{ fontSize: '12px', color: '#ef4444', margin: 0 }}>
            No se pudo cargar el resumen. <button onClick={refresh} style={{ background: 'none', border: 'none', color: '#E8792F', cursor: 'pointer', textDecoration: 'underline', fontSize: '12px', padding: 0 }}>Reintentar</button>
          </p>
        )}

        {/* Project cards */}
        {!isSpinning && !error && data && data.proyectos.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {data.proyectos.map(p => {
              const c = estadoColor(p.estado)
              return (
                <div key={p.id} style={{
                  background: 'rgba(255,255,255,0.025)',
                  border: `1px solid ${c.dot}22`,
                  borderLeft: `3px solid ${c.dot}`,
                  borderRadius: '8px',
                  padding: '10px 12px',
                }}>
                  {/* Row 1: name + badges */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '5px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#e2e8f0' }}>
                      {p.nombre}
                    </span>
                    {/* Estado badge */}
                    <span style={{
                      fontSize: '9px', fontWeight: 700, padding: '2px 6px',
                      borderRadius: '4px', background: c.badge, color: c.text,
                      textTransform: 'uppercase', letterSpacing: '0.06em',
                    }}>
                      {estadoLabel(p.estado)}
                    </span>
                    {/* Alertas badge */}
                    {p.alertas > 0 && (
                      <span style={{
                        fontSize: '9px', fontWeight: 700, padding: '2px 6px',
                        borderRadius: '4px', background: 'rgba(245,158,11,0.12)', color: '#fbbf24',
                        textTransform: 'uppercase', letterSpacing: '0.06em',
                      }}>
                        ⚠️ {p.alertas} alerta{p.alertas > 1 ? 's' : ''}
                      </span>
                    )}
                    <div style={{ flex: 1 }} />
                    {/* Stats */}
                    <span style={{ fontSize: '10px', color: '#475569', whiteSpace: 'nowrap' }}>
                      💬 {p.msgs} msg{p.msgs !== 1 ? 's' : ''} · {relLabel(p.ultimoTimestamp)}
                    </span>
                  </div>

                  {/* Row 2: senders */}
                  {p.senders.length > 0 && (
                    <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '4px' }}>
                      👤 {p.senders.join(', ')}
                    </div>
                  )}

                  {/* Row 3: last message snippet */}
                  {p.ultimoMensaje && (
                    <p style={{
                      fontSize: '11px', color: '#94a3b8', margin: 0,
                      lineHeight: 1.5, fontStyle: 'italic',
                      borderLeft: '2px solid rgba(255,255,255,0.06)',
                      paddingLeft: '8px',
                    }}>
                      "{p.ultimoMensaje.slice(0, 120)}{p.ultimoMensaje.length > 120 ? '…' : ''}"
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* CSS animations */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse {
          0%, 100% { opacity: 0.4; }
          50%       { opacity: 0.8; }
        }
      `}</style>
    </div>
  )
}
