'use client'
import { useEffect, useRef } from 'react'

interface MeetingBrief {
  id: string
  title: string
  meeting_date: string
  drive_link: string | null
  summary: string | null
  decisions: string[]
  action_items: string[]
  participants: string[]
  ai_confidence: number
}

interface Props {
  brief: MeetingBrief | null
  onClose: () => void
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('es-MX', {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function MeetingBriefPanel({ brief, onClose }: Props) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
          zIndex: 50, opacity: brief ? 1 : 0, pointerEvents: brief ? 'auto' : 'none',
          transition: 'opacity 0.25s',
        }}
      />

      {/* Panel — slides in from the LEFT */}
      <div
        ref={panelRef}
        style={{
          position: 'fixed', top: 0, left: 0, height: '100vh',
          width: 'min(480px, 92vw)',
          background: '#0f172a',
          borderRight: '1px solid rgba(255,255,255,0.10)',
          zIndex: 51,
          transform: brief ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1)',
          display: 'flex', flexDirection: 'column',
          overflowY: 'auto',
        }}
      >
        {brief && (
          <>
            {/* Header */}
            <div style={{
              padding: '20px 24px 16px',
              borderBottom: '1px solid rgba(255,255,255,0.07)',
              background: 'rgba(96,165,250,0.06)',
              position: 'sticky', top: 0, zIndex: 1,
              backdropFilter: 'blur(8px)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <span style={{ fontSize: '16px' }}>🎥</span>
                    <span style={{
                      fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: '4px',
                      background: 'rgba(96,165,250,0.15)', color: '#60a5fa',
                      border: '1px solid rgba(96,165,250,0.25)', textTransform: 'uppercase', letterSpacing: '0.05em',
                    }}>Meet · Gemini Brief</span>
                    {brief.ai_confidence > 0 && (
                      <span style={{ fontSize: '10px', color: '#4a5568' }}>
                        {(brief.ai_confidence * 100).toFixed(0)}% match
                      </span>
                    )}
                  </div>
                  <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#fff', margin: 0, lineHeight: 1.4 }}>
                    {brief.title.replace(' - Notas de Gemini', '').replace(' - Notes by Gemini', '')}
                  </h2>
                  <p style={{ fontSize: '12px', color: '#4a5568', margin: '4px 0 0' }}>
                    {formatDate(brief.meeting_date)}
                  </p>
                </div>
                <button
                  onClick={onClose}
                  style={{
                    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)',
                    color: '#94a3b8', borderRadius: '8px', padding: '6px 10px',
                    cursor: 'pointer', fontSize: '14px', flexShrink: 0,
                  }}
                >✕</button>
              </div>
            </div>

            {/* Body */}
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

              {/* Summary */}
              {brief.summary && (
                <section>
                  <h3 style={{ fontSize: '11px', fontWeight: 700, color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 8px' }}>
                    📝 Resumen
                  </h3>
                  <p style={{ fontSize: '13px', color: '#cbd5e0', margin: 0, lineHeight: 1.65 }}>
                    {brief.summary}
                  </p>
                </section>
              )}

              {/* Decisions */}
              {brief.decisions?.length > 0 && (
                <section>
                  <h3 style={{ fontSize: '11px', fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 8px' }}>
                    ✅ Decisiones
                  </h3>
                  <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {brief.decisions.map((d, i) => (
                      <li key={i} style={{
                        fontSize: '13px', color: '#cbd5e0', padding: '8px 12px',
                        background: 'rgba(167,139,250,0.07)', borderRadius: '6px',
                        borderLeft: '2px solid rgba(167,139,250,0.4)', lineHeight: 1.5,
                      }}>
                        {d}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Action Items */}
              {brief.action_items?.length > 0 && (
                <section>
                  <h3 style={{ fontSize: '11px', fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 8px' }}>
                    🎯 Pendientes
                  </h3>
                  <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {brief.action_items.map((a, i) => (
                      <li key={i} style={{
                        fontSize: '13px', color: '#cbd5e0', padding: '8px 12px',
                        background: 'rgba(245,158,11,0.07)', borderRadius: '6px',
                        borderLeft: '2px solid rgba(245,158,11,0.4)', lineHeight: 1.5,
                        display: 'flex', gap: '8px', alignItems: 'flex-start',
                      }}>
                        <span style={{ color: '#f59e0b', marginTop: '1px', flexShrink: 0 }}>○</span>
                        {a}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Participants */}
              {brief.participants?.length > 0 && (
                <section>
                  <h3 style={{ fontSize: '11px', fontWeight: 700, color: '#34d399', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 8px' }}>
                    👥 Participantes
                  </h3>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {brief.participants.map((p, i) => (
                      <span key={i} style={{
                        fontSize: '12px', padding: '4px 10px', borderRadius: '20px',
                        background: 'rgba(52,211,153,0.08)', color: '#34d399',
                        border: '1px solid rgba(52,211,153,0.2)',
                      }}>
                        {p}
                      </span>
                    ))}
                  </div>
                </section>
              )}

              {/* No classification yet */}
              {!brief.summary && brief.ai_confidence === 0 && (
                <div style={{
                  textAlign: 'center', padding: '32px 16px',
                  background: 'rgba(255,255,255,0.03)', borderRadius: '10px',
                  border: '1px dashed rgba(255,255,255,0.08)',
                }}>
                  <div style={{ fontSize: '24px', marginBottom: '8px' }}>⏳</div>
                  <p style={{ fontSize: '13px', color: '#4a5568', margin: 0 }}>
                    Clasificando con Gemini...
                  </p>
                </div>
              )}

              {/* Link to Drive */}
              {brief.drive_link && (
                <a
                  href={brief.drive_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    padding: '10px 16px', borderRadius: '8px',
                    background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.2)',
                    color: '#60a5fa', fontSize: '13px', fontWeight: 600, textDecoration: 'none',
                    marginTop: '4px',
                  }}
                >
                  📄 Ver brief completo en Drive ↗
                </a>
              )}
            </div>
          </>
        )}
      </div>
    </>
  )
}
