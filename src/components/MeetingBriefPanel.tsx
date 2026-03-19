'use client'
import { useEffect, useRef, useState } from 'react'

interface MeetingBrief {
  id: string
  title: string
  meeting_date: string
  drive_link: string | null
  recording_url?: string | null
  transcript_raw?: string | null
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

type Tab = 'resumen' | 'transcripcion'

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('es-MX', {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function cleanTitle(title: string) {
  return title
    .replace(' - Notas de Gemini', '')
    .replace(' - Notes by Gemini', '')
    .replace(' - Gemini Notes', '')
}

export default function MeetingBriefPanel({ brief, onClose }: Props) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [tab, setTab] = useState<Tab>('resumen')

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  // Reset tab when opening a new brief
  useEffect(() => { if (brief) setTab('resumen') }, [brief?.id])

  const hasTranscript = !!(brief?.transcript_raw)
  const hasRecording = !!(brief?.recording_url)

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
          width: 'min(520px, 94vw)',
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
            {/* ── Header ─────────────────────────────────────────────────── */}
            <div style={{
              padding: '20px 24px 0',
              borderBottom: '1px solid rgba(255,255,255,0.07)',
              background: 'rgba(96,165,250,0.06)',
              position: 'sticky', top: 0, zIndex: 1,
              backdropFilter: 'blur(8px)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '12px' }}>
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
                    {cleanTitle(brief.title)}
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

              {/* ── Recording button ── */}
              {hasRecording && (
                <a
                  href={brief.recording_url!}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '9px 14px', borderRadius: '8px', marginBottom: '12px',
                    background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.25)',
                    color: '#f87171', fontSize: '12px', fontWeight: 600, textDecoration: 'none',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.18)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.10)'}
                >
                  <span style={{ fontSize: '14px' }}>▶</span>
                  Ver grabación de la reunión ↗
                </a>
              )}

              {/* ── Tabs ── */}
              <div style={{ display: 'flex', gap: '0', borderBottom: '1px solid rgba(255,255,255,0.06)', marginLeft: '-24px', marginRight: '-24px', paddingLeft: '24px' }}>
                {(['resumen', 'transcripcion'] as Tab[]).map(t => {
                  const labels: Record<Tab, string> = { resumen: '📝 Resumen', transcripcion: '📄 Transcripción' }
                  const isActive = tab === t
                  const isDisabled = t === 'transcripcion' && !hasTranscript
                  return (
                    <button
                      key={t}
                      onClick={() => !isDisabled && setTab(t)}
                      style={{
                        padding: '8px 16px', fontSize: '12px', fontWeight: isActive ? 600 : 400,
                        color: isDisabled ? '#2d3748' : isActive ? '#60a5fa' : '#64748b',
                        background: 'transparent', border: 'none',
                        borderBottom: isActive ? '2px solid #60a5fa' : '2px solid transparent',
                        cursor: isDisabled ? 'not-allowed' : 'pointer',
                        transition: 'color 0.15s', marginBottom: '-1px',
                      }}
                    >
                      {labels[t]}
                      {t === 'transcripcion' && !hasTranscript && (
                        <span style={{ marginLeft: '4px', fontSize: '10px', color: '#374151' }}>(no disponible)</span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* ── Body ───────────────────────────────────────────────────── */}
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '20px', flex: 1 }}>

              {/* ── Tab: Resumen ── */}
              {tab === 'resumen' && (
                <>
                  {brief.summary && (
                    <section>
                      <h3 style={{ fontSize: '11px', fontWeight: 700, color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 8px' }}>
                        📝 Resumen ejecutivo
                      </h3>
                      <p style={{ fontSize: '13px', color: '#cbd5e0', margin: 0, lineHeight: 1.65 }}>
                        {brief.summary}
                      </p>
                    </section>
                  )}

                  {brief.decisions?.length > 0 && (
                    <section>
                      <h3 style={{ fontSize: '11px', fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 8px' }}>
                        ✅ Decisiones tomadas
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

                  {brief.action_items?.length > 0 && (
                    <section>
                      <h3 style={{ fontSize: '11px', fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 8px' }}>
                        🎯 Compromisos y pendientes
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
                            border: '1px solid rgba(52,211,153,0.15)',
                          }}>
                            {p}
                          </span>
                        ))}
                      </div>
                    </section>
                  )}

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

                  {/* Links */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
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
                        }}
                      >
                        📄 Ver notas de Gemini en Drive ↗
                      </a>
                    )}
                    {hasRecording && (
                      <a
                        href={brief.recording_url!}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                          padding: '10px 16px', borderRadius: '8px',
                          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                          color: '#f87171', fontSize: '13px', fontWeight: 600, textDecoration: 'none',
                        }}
                      >
                        ▶ Ver grabación de la reunión ↗
                      </a>
                    )}
                  </div>
                </>
              )}

              {/* ── Tab: Transcripción ── */}
              {tab === 'transcripcion' && hasTranscript && (
                <section>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <h3 style={{ fontSize: '11px', fontWeight: 700, color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '0.07em', margin: 0 }}>
                      📄 Transcripción completa
                    </h3>
                    <span style={{ fontSize: '10px', color: '#374151' }}>
                      {brief.transcript_raw!.length.toLocaleString()} caracteres
                    </span>
                  </div>
                  <div style={{
                    background: 'rgba(10,15,30,0.8)', border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: '10px', padding: '16px',
                    maxHeight: '60vh', overflowY: 'auto',
                  }}>
                    <pre style={{
                      fontSize: '12px', color: '#94a3b8', margin: 0,
                      whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.7,
                      fontFamily: "'SF Mono', 'Consolas', monospace",
                    }}>
                      {brief.transcript_raw}
                    </pre>
                  </div>
                </section>
              )}

            </div>
          </>
        )}
      </div>
    </>
  )
}
