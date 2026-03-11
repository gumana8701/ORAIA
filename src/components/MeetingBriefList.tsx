'use client'
import { useState } from 'react'
import MeetingBriefPanel from './MeetingBriefPanel'

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
  briefs: MeetingBrief[]
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000), hours = Math.floor(mins / 60), days = Math.floor(hours / 24)
  if (days > 30) return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
  if (days > 0) return `hace ${days}d`
  if (hours > 0) return `hace ${hours}h`
  if (mins > 0) return `hace ${mins}m`
  return 'ahora'
}

function cleanTitle(title: string) {
  return title.replace(' - Notas de Gemini', '').replace(' - Notes by Gemini', '')
}

export default function MeetingBriefList({ briefs }: Props) {
  const [selected, setSelected] = useState<MeetingBrief | null>(null)

  if (briefs.length === 0) {
    return (
      <div style={{
        textAlign: 'center', padding: '48px 24px',
        background: 'rgba(17,24,39,0.85)', border: '1px solid rgba(255,255,255,0.10)',
        borderRadius: '12px', color: '#4a5568',
      }}>
        <div style={{ fontSize: '32px', marginBottom: '8px' }}>🎥</div>
        <p style={{ margin: 0, fontSize: '14px' }}>Sin reuniones registradas para este proyecto</p>
      </div>
    )
  }

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {briefs.map(brief => {
          const hasClassification = brief.summary || (brief.decisions?.length > 0)
          return (
            <div
              key={brief.id}
              onClick={() => setSelected(brief)}
              style={{
                display: 'flex', gap: '12px', padding: '12px 16px', borderRadius: '8px',
                background: 'rgba(96,165,250,0.05)',
                border: '1px solid rgba(96,165,250,0.12)',
                borderLeft: '3px solid rgba(96,165,250,0.5)',
                cursor: 'pointer', transition: 'all 0.15s',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLDivElement).style.background = 'rgba(96,165,250,0.10)'
                ;(e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(96,165,250,0.25)'
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLDivElement).style.background = 'rgba(96,165,250,0.05)'
                ;(e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(96,165,250,0.12)'
              }}
            >
              {/* Icon */}
              <div style={{
                width: '32px', height: '32px', borderRadius: '8px', flexShrink: 0,
                background: 'rgba(96,165,250,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px',
              }}>
                🎥
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                {/* Title row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#e2e8f0', lineHeight: 1.4 }}>
                    {cleanTitle(brief.title)}
                  </span>
                  <span style={{ fontSize: '11px', color: '#4a5568', flexShrink: 0 }}>
                    {timeAgo(brief.meeting_date)}
                  </span>
                </div>

                {/* Summary preview or pending */}
                {brief.summary ? (
                  <p style={{
                    fontSize: '12px', color: '#64748b', margin: 0,
                    overflow: 'hidden', display: '-webkit-box',
                    WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                    lineHeight: 1.5,
                  }}>
                    {brief.summary}
                  </p>
                ) : (
                  <span style={{ fontSize: '11px', color: '#374151', fontStyle: 'italic' }}>
                    ⏳ Clasificando...
                  </span>
                )}

                {/* Badges */}
                {hasClassification && (
                  <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                    {brief.decisions?.length > 0 && (
                      <span style={{
                        fontSize: '10px', padding: '2px 7px', borderRadius: '4px',
                        background: 'rgba(167,139,250,0.10)', color: '#a78bfa',
                        border: '1px solid rgba(167,139,250,0.2)',
                      }}>
                        ✅ {brief.decisions.length} decisiones
                      </span>
                    )}
                    {brief.action_items?.length > 0 && (
                      <span style={{
                        fontSize: '10px', padding: '2px 7px', borderRadius: '4px',
                        background: 'rgba(245,158,11,0.10)', color: '#f59e0b',
                        border: '1px solid rgba(245,158,11,0.2)',
                      }}>
                        🎯 {brief.action_items.length} pendientes
                      </span>
                    )}
                    {brief.participants?.length > 0 && (
                      <span style={{
                        fontSize: '10px', padding: '2px 7px', borderRadius: '4px',
                        background: 'rgba(52,211,153,0.08)', color: '#34d399',
                        border: '1px solid rgba(52,211,153,0.15)',
                      }}>
                        👥 {brief.participants.length}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Arrow */}
              <div style={{ color: '#60a5fa', fontSize: '14px', opacity: 0.5, alignSelf: 'center', flexShrink: 0 }}>
                ‹
              </div>
            </div>
          )
        })}
      </div>

      <MeetingBriefPanel brief={selected} onClose={() => setSelected(null)} />
    </>
  )
}
