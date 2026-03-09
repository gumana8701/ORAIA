'use client'

import { useEffect, useState, useTransition, useCallback } from 'react'

interface ProjectDigest {
  id: string
  nombre: string
  estado: string
  cliente: string
  responsable: string
  progreso: number
  msgs: number
  ultimoMensaje: string
  ultimoTimestamp: string
  alertas: number
  alertasCriticas: number
  topAlertas: Array<{ tipo: string; nivel: string; desc: string }>
  senders: string[]
  fuentes: string[]
  resumenIA: string
}

interface DigestPayload {
  proyectos: ProjectDigest[]
  totalMsgs: number
  totalAlertas: number
  generatedAt: string
}

function relLabel(iso: string): string {
  const diffH = (Date.now() - new Date(iso).getTime()) / 3_600_000
  if (diffH < 1)  return 'hace <1h'
  if (diffH < 24) return `hace ${Math.round(diffH)}h`
  return `hace ${Math.round(diffH / 24)}d`
}

function estadoConfig(estado: string) {
  const map: Record<string, { color: string; bg: string; border: string; label: string; icon: string }> = {
    en_riesgo:  { color: '#f87171', bg: 'rgba(239,68,68,0.10)',  border: 'rgba(239,68,68,0.30)',  label: 'En Riesgo',  icon: '⚠️' },
    activo:     { color: '#fb923c', bg: 'rgba(232,121,47,0.10)', border: 'rgba(232,121,47,0.25)', label: 'Activo',     icon: '🟢' },
    pausado:    { color: '#94a3b8', bg: 'rgba(148,163,184,0.10)',border: 'rgba(148,163,184,0.20)',label: 'Pausado',    icon: '⏸️' },
    completado: { color: '#4ade80', bg: 'rgba(34,197,94,0.10)',  border: 'rgba(34,197,94,0.20)',  label: 'Completado', icon: '✅' },
  }
  return map[estado] ?? map['activo']
}

function SourceBadge({ fuente }: { fuente: string }) {
  const config: Record<string, { label: string; color: string; bg: string }> = {
    whatsapp: { label: 'WhatsApp', color: '#4ade80', bg: 'rgba(34,197,94,0.10)' },
    slack:    { label: 'Slack',    color: '#818cf8', bg: 'rgba(129,140,248,0.10)' },
    manual:   { label: 'Manual',   color: '#94a3b8', bg: 'rgba(148,163,184,0.08)' },
    meet:     { label: 'Meet',     color: '#60a5fa', bg: 'rgba(96,165,250,0.10)' },
  }
  const c = config[fuente] ?? config['manual']
  return (
    <span style={{
      fontSize: '9px', fontWeight: 700, padding: '2px 6px',
      borderRadius: '4px', background: c.bg, color: c.color,
      textTransform: 'uppercase', letterSpacing: '0.05em', border: `1px solid ${c.color}25`,
    }}>
      {c.label}
    </span>
  )
}

function ProgressBar({ value }: { value: number }) {
  const pct = Math.min(100, Math.max(0, value))
  const color = pct >= 80 ? '#4ade80' : pct >= 40 ? '#E8792F' : '#f87171'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <div style={{ flex: 1, height: '3px', borderRadius: '2px', background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', borderRadius: '2px', background: color, transition: 'width 0.5s ease' }} />
      </div>
      <span style={{ fontSize: '9px', color: '#64748b', fontWeight: 600, minWidth: '24px' }}>{pct}%</span>
    </div>
  )
}

// ── Dancing robot loading animation ──────────────────────────────────────────
function RobotLoader() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '32px 20px', gap: '16px',
    }}>
      {/* Robot */}
      <div style={{ position: 'relative', fontSize: '48px', animation: 'robotBounce 0.6s ease-in-out infinite alternate' }}>
        🤖
        {/* Signal waves */}
        <span style={{
          position: 'absolute', top: '-8px', right: '-16px', fontSize: '14px',
          animation: 'waveFlash 0.8s ease-in-out infinite', opacity: 0,
        }}>📡</span>
      </div>

      {/* Scanning dots */}
      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
        {[0, 1, 2, 3, 4].map(i => (
          <div key={i} style={{
            width: '6px', height: '6px', borderRadius: '50%',
            background: '#E8792F',
            animation: `dotPulse 1s ease-in-out infinite`,
            animationDelay: `${i * 0.15}s`,
            opacity: 0.3,
          }} />
        ))}
      </div>

      {/* Status text */}
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: '12px', color: '#E8792F', fontWeight: 700, margin: '0 0 4px', letterSpacing: '0.05em' }}>
          ANALIZANDO PROYECTOS
        </p>
        <p style={{ fontSize: '10px', color: '#475569', margin: 0, fontStyle: 'italic' }}>
          Claude está procesando Slack + WhatsApp…
        </p>
      </div>
    </div>
  )
}

export default function AIDigest72h() {
  const [data, setData]         = useState<DigestPayload | null>(null)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(false)
  const [open, setOpen]         = useState(false)   // collapsed by default ✅
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [isPending, startTransition] = useTransition()

  const load = useCallback(() => {
    setLoading(true); setError(false)
    fetch('/api/ai-digest', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => { setError(true); setLoading(false) })
  }, [])

  const handleToggle = () => {
    if (!open && !data && !loading) load()  // load on first open
    setOpen(o => !o)
  }

  const refresh = () => startTransition(() => { load() })

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const isSpinning = loading || isPending

  return (
    <div style={{
      position: 'relative', zIndex: 1, marginBottom: '20px',
      background: 'linear-gradient(135deg, rgba(232,121,47,0.04) 0%, rgba(15,23,42,0.6) 70%)',
      border: `1px solid ${open ? 'rgba(232,121,47,0.22)' : 'rgba(232,121,47,0.12)'}`,
      borderRadius: '14px', overflow: 'hidden', backdropFilter: 'blur(10px)',
      transition: 'border-color 0.2s ease',
    }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, width: '200px', height: '60px',
        background: 'radial-gradient(ellipse, rgba(232,121,47,0.10) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* ── Header — always visible, click to toggle ── */}
      <div
        onClick={handleToggle}
        style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '13px 18px', cursor: 'pointer', userSelect: 'none',
        }}
      >
        <div style={{
          width: '26px', height: '26px', borderRadius: '7px', flexShrink: 0,
          background: 'linear-gradient(135deg, #E8792F 0%, #c45c1a 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px',
          animation: isSpinning ? 'robotDance 0.4s ease-in-out infinite alternate' : 'none',
        }}>🤖</div>

        <span style={{
          fontSize: '11px', fontWeight: 700, color: '#E8792F',
          textTransform: 'uppercase', letterSpacing: '0.08em',
        }}>
          Inteligencia de Proyectos · 72h
        </span>

        {/* Summary pill */}
        {data && !isSpinning && (
          <span style={{
            fontSize: '10px', color: '#475569',
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '4px', padding: '2px 7px', fontWeight: 500,
          }}>
            {data.proyectos.length} proyecto{data.proyectos.length !== 1 ? 's' : ''}
            {(data.totalAlertas ?? 0) > 0 && <span style={{ color: '#fbbf24' }}> · ⚠️ {data.totalAlertas}</span>}
          </span>
        )}

        {isSpinning && (
          <span style={{ fontSize: '10px', color: '#E8792F', fontStyle: 'italic', animation: 'fadeFlicker 1s ease-in-out infinite' }}>
            analizando…
          </span>
        )}

        <div style={{ flex: 1 }} />

        {/* Refresh — only when open and loaded */}
        {open && data && !isSpinning && (
          <button
            onClick={e => { e.stopPropagation(); refresh() }}
            style={{
              background: 'rgba(232,121,47,0.08)', border: '1px solid rgba(232,121,47,0.18)',
              borderRadius: '6px', color: '#E8792F', cursor: 'pointer',
              fontSize: '12px', padding: '3px 8px',
              display: 'flex', alignItems: 'center', gap: '3px',
            }}
          >
            <span>↻</span>
            <span style={{ fontSize: '10px', fontWeight: 600 }}>Actualizar</span>
          </button>
        )}

        {/* Chevron */}
        <span style={{
          fontSize: '10px', color: '#475569',
          display: 'inline-block', transition: 'transform 0.25s ease',
          transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
        }}>▼</span>
      </div>

      {/* ── Collapsible body ── */}
      {open && (
        <>
          <div style={{ height: '1px', background: 'rgba(232,121,47,0.08)', margin: '0 18px' }} />
          <div style={{ padding: '14px 18px 16px' }}>

            {/* Dancing robot while loading */}
            {isSpinning && <RobotLoader />}

            {/* Error */}
            {error && !isSpinning && (
              <p style={{ fontSize: '12px', color: '#ef4444', margin: 0, textAlign: 'center', padding: '16px' }}>
                Error al cargar.{' '}
                <button onClick={refresh} style={{ background: 'none', border: 'none', color: '#E8792F', cursor: 'pointer', textDecoration: 'underline', fontSize: '12px', padding: 0 }}>
                  Reintentar
                </button>
              </p>
            )}

            {/* Empty */}
            {!isSpinning && !error && data?.proyectos.length === 0 && (
              <p style={{ fontSize: '12px', color: '#475569', textAlign: 'center', padding: '16px', margin: 0 }}>
                Sin actividad en las últimas 72h.
              </p>
            )}

            {/* Project cards */}
            {!isSpinning && !error && data && data.proyectos.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {data.proyectos.map(p => {
                  const cfg  = estadoConfig(p.estado)
                  const cardOpen = expanded.has(p.id)
                  const hasCritical = p.alertasCriticas > 0

                  return (
                    <div key={p.id} style={{
                      background: hasCritical ? 'rgba(239,68,68,0.04)' : 'rgba(255,255,255,0.025)',
                      border: `1px solid ${hasCritical ? 'rgba(239,68,68,0.25)' : cfg.border}`,
                      borderLeft: `3px solid ${hasCritical ? '#ef4444' : cfg.color}`,
                      borderRadius: '10px', overflow: 'hidden',
                    }}>
                      {/* Card header */}
                      <div onClick={() => toggleExpand(p.id)} style={{ padding: '10px 12px', cursor: 'pointer' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '5px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '13px', fontWeight: 700, color: '#e2e8f0', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {p.nombre}
                          </span>
                          <span style={{
                            fontSize: '9px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px',
                            background: cfg.bg, color: cfg.color, textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0,
                          }}>
                            {cfg.icon} {cfg.label}
                          </span>
                          {hasCritical && (
                            <span style={{
                              fontSize: '9px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px',
                              background: 'rgba(239,68,68,0.12)', color: '#f87171',
                              textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0,
                            }}>
                              🚨 {p.alertasCriticas} crítica{p.alertasCriticas > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>

                        {p.resumenIA && (
                          <p style={{
                            fontSize: '11.5px', color: '#cbd5e1', margin: '0 0 7px', lineHeight: 1.55,
                            display: '-webkit-box', WebkitLineClamp: cardOpen ? undefined : 2,
                            WebkitBoxOrient: 'vertical' as const, overflow: cardOpen ? 'visible' : 'hidden',
                          }}>
                            {p.resumenIA}
                          </p>
                        )}

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          {p.fuentes.map(f => <SourceBadge key={f} fuente={f} />)}
                          <span style={{ fontSize: '10px', color: '#64748b' }}>💬 {p.msgs} · {relLabel(p.ultimoTimestamp)}</span>
                          {p.responsable && <span style={{ fontSize: '10px', color: '#64748b' }}>👤 {p.responsable}</span>}
                          <div style={{ flex: 1 }} />
                          <span style={{ fontSize: '10px', color: '#475569' }}>{cardOpen ? '▲' : '▼'}</span>
                        </div>
                      </div>

                      {/* Expanded detail */}
                      {cardOpen && (
                        <div style={{ padding: '0 12px 12px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '10px' }}>
                          {p.progreso > 0 && (
                            <div style={{ marginBottom: '8px' }}>
                              <span style={{ fontSize: '10px', color: '#64748b', display: 'block', marginBottom: '4px' }}>Progreso</span>
                              <ProgressBar value={p.progreso} />
                            </div>
                          )}
                          {p.topAlertas.length > 0 && (
                            <div style={{ marginBottom: '8px' }}>
                              <span style={{ fontSize: '10px', color: '#64748b', display: 'block', marginBottom: '5px' }}>Alertas activas</span>
                              {p.topAlertas.map((a, i) => (
                                <div key={i} style={{
                                  fontSize: '10.5px', color: '#fca5a5',
                                  background: 'rgba(239,68,68,0.07)', borderRadius: '5px',
                                  padding: '5px 8px', marginBottom: '4px',
                                  borderLeft: '2px solid rgba(239,68,68,0.4)',
                                }}>
                                  <strong style={{ textTransform: 'capitalize' }}>{a.tipo}</strong> · {a.desc}
                                </div>
                              ))}
                            </div>
                          )}
                          {p.senders.length > 0 && (
                            <div style={{ fontSize: '10px', color: '#64748b' }}>
                              Participantes: <span style={{ color: '#94a3b8' }}>{p.senders.join(', ')}</span>
                            </div>
                          )}
                          {p.ultimoMensaje && (
                            <div style={{
                              marginTop: '8px', fontSize: '10.5px', color: '#94a3b8',
                              fontStyle: 'italic', lineHeight: 1.5,
                              borderLeft: '2px solid rgba(255,255,255,0.08)', paddingLeft: '8px',
                            }}>
                              "{p.ultimoMensaje.slice(0, 200)}{p.ultimoMensaje.length > 200 ? '…' : ''}"
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}

      <style>{`
        @keyframes robotDance   { from { transform: rotate(-8deg) scale(1.05); } to { transform: rotate(8deg) scale(0.95); } }
        @keyframes robotBounce  { from { transform: translateY(0px) rotate(-5deg); } to { transform: translateY(-8px) rotate(5deg); } }
        @keyframes waveFlash    { 0%,100% { opacity:0; transform:scale(0.8); } 50% { opacity:1; transform:scale(1.2); } }
        @keyframes dotPulse     { 0%,100% { opacity:0.2; transform:scale(0.8); } 50% { opacity:1; transform:scale(1.3); } }
        @keyframes fadeFlicker  { 0%,100% { opacity:0.5; } 50% { opacity:1; } }
        @keyframes spin         { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
