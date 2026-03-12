'use client'
import { useState } from 'react'
import MeetingBriefPanel from './MeetingBriefPanel'

// ── Types ──────────────────────────────────────────────────────────────────────
interface Message {
  id: string
  fuente?: string
  sender?: string
  contenido: string
  timestamp: string
  es_del_cliente?: boolean
  metadata?: { channel_name?: string; slack_channel?: string; slack_ts?: string }
}

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
  messages: Message[]
  briefs: MeetingBrief[]
  projectId: string
}

// ── Source config ──────────────────────────────────────────────────────────────
const SOURCE_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; icon: string }> = {
  whatsapp:  { label: 'WhatsApp',  color: '#4ade80', bg: 'rgba(34,197,94,0.08)',   border: 'rgba(34,197,94,0.18)',   icon: '💬' },
  slack:     { label: 'Slack',     color: '#818cf8', bg: 'rgba(129,140,248,0.08)', border: 'rgba(129,140,248,0.18)', icon: '⚡' },
  manual:    { label: 'Manual',    color: '#94a3b8', bg: 'rgba(148,163,184,0.08)', border: 'rgba(148,163,184,0.15)', icon: '✏️' },
  reuniones: { label: 'Reuniones', color: '#60a5fa', bg: 'rgba(96,165,250,0.08)',  border: 'rgba(96,165,250,0.15)',  icon: '🎥' },
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}
function cleanTitle(title: string) {
  return title.replace(' - Notas de Gemini', '').replace(' - Notes by Gemini', '').trim()
}

// ── Brief card (inline in feed) ───────────────────────────────────────────────
function BriefCard({ brief, onClick }: { brief: MeetingBrief; onClick: () => void }) {
  const cfg = SOURCE_CONFIG.reuniones
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', gap: '12px', padding: '12px 16px', borderRadius: '8px',
        background: cfg.bg, border: `1px solid ${cfg.border}`,
        borderLeft: `3px solid ${cfg.color}`,
        cursor: 'pointer', transition: 'all 0.15s',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(96,165,250,0.13)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = cfg.bg }}
    >
      {/* Icon */}
      <div style={{
        width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
        background: `${cfg.color}25`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px',
      }}>
        🎥
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Header */}
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '3px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: cfg.color }}>Reunión</span>
          <span style={{
            fontSize: '9px', fontWeight: 700, padding: '1px 5px', borderRadius: '3px',
            background: `${cfg.color}18`, color: cfg.color,
            textTransform: 'uppercase', letterSpacing: '0.05em', border: `1px solid ${cfg.color}25`,
          }}>Google Meet</span>
          <span style={{ fontSize: '11px', color: '#4a5568', marginLeft: 'auto' }}>
            {formatTime(brief.meeting_date)}
          </span>
        </div>

        {/* Title */}
        <p style={{ fontSize: '13px', color: '#e2e8f0', margin: '0 0 4px', fontWeight: 600, lineHeight: 1.4 }}>
          {cleanTitle(brief.title)}
        </p>

        {/* Summary preview */}
        {brief.summary && (
          <p style={{
            fontSize: '12px', color: '#64748b', margin: '0 0 6px',
            overflow: 'hidden', display: '-webkit-box',
            WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: 1.5,
          }}>
            {brief.summary}
          </p>
        )}

        {/* Badges */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
          {(brief.decisions?.length > 0) && (
            <span style={{
              fontSize: '10px', padding: '2px 7px', borderRadius: '4px',
              background: 'rgba(167,139,250,0.10)', color: '#a78bfa',
              border: '1px solid rgba(167,139,250,0.2)',
            }}>✅ {brief.decisions.length} decisiones</span>
          )}
          {(brief.action_items?.length > 0) && (
            <span style={{
              fontSize: '10px', padding: '2px 7px', borderRadius: '4px',
              background: 'rgba(245,158,11,0.10)', color: '#f59e0b',
              border: '1px solid rgba(245,158,11,0.2)',
            }}>🎯 {brief.action_items.length} pendientes</span>
          )}
          {(brief.participants?.length > 0) && (
            <span style={{
              fontSize: '10px', padding: '2px 7px', borderRadius: '4px',
              background: 'rgba(52,211,153,0.08)', color: '#34d399',
              border: '1px solid rgba(52,211,153,0.15)',
            }}>👥 {brief.participants.length} participantes</span>
          )}
          <span style={{ fontSize: '10px', color: '#374151', marginLeft: 'auto' }}>Ver detalle →</span>
        </div>
      </div>
    </div>
  )
}

// ── Message card ──────────────────────────────────────────────────────────────
function MessageCard({ msg }: { msg: Message }) {
  const fuente = msg.fuente ?? 'manual'
  const meta = msg.metadata ?? {}
  const cfg = SOURCE_CONFIG[fuente] ?? SOURCE_CONFIG.manual
  const channelName = meta.channel_name ? `#${meta.channel_name}` : null

  return (
    <div style={{
      display: 'flex', gap: '12px', padding: '10px 14px', borderRadius: '8px',
      background: msg.es_del_cliente ? 'rgba(17,24,39,0.6)' : cfg.bg,
      border: `1px solid ${msg.es_del_cliente ? 'rgba(255,255,255,0.05)' : cfg.border}`,
      borderLeft: `3px solid ${msg.es_del_cliente ? 'rgba(100,116,139,0.3)' : cfg.color}`,
    }}>
      <div style={{
        width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
        background: msg.es_del_cliente ? 'rgba(100,116,139,0.3)' : `${cfg.color}25`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px',
      }}>
        {msg.es_del_cliente ? '👤' : cfg.icon}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '3px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: msg.es_del_cliente ? '#94a3b8' : cfg.color }}>
            {msg.sender}
          </span>
          <span style={{
            fontSize: '9px', fontWeight: 700, padding: '1px 5px', borderRadius: '3px',
            background: `${cfg.color}18`, color: cfg.color,
            textTransform: 'uppercase', letterSpacing: '0.05em', border: `1px solid ${cfg.color}25`,
          }}>
            {cfg.label}
            {channelName && <span style={{ opacity: 0.7 }}> · {channelName}</span>}
          </span>
          <span style={{ fontSize: '11px', color: '#4a5568', marginLeft: 'auto' }}>
            {formatTime(msg.timestamp)}
          </span>
        </div>
        <p style={{ fontSize: '13px', color: '#cbd5e0', margin: 0, lineHeight: 1.5, wordBreak: 'break-word' }}>
          {msg.contenido}
        </p>
      </div>
    </div>
  )
}

// ── Day separator ─────────────────────────────────────────────────────────────
function DaySeparator({ date }: { date: string }) {
  const d = new Date(date)
  const label = d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '8px 0' }}>
      <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.06)' }} />
      <span style={{ fontSize: '11px', color: '#374151', textTransform: 'capitalize', whiteSpace: 'nowrap' }}>{label}</span>
      <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.06)' }} />
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function ActivityFeed({ messages, briefs, projectId }: Props) {
  const [selectedBrief, setSelectedBrief] = useState<MeetingBrief | null>(null)
  const [filter, setFilter] = useState<string>('todos')

  // Build unified activity items
  type ActivityItem =
    | { kind: 'message'; date: string; data: Message }
    | { kind: 'brief';   date: string; data: MeetingBrief }

  const allItems: ActivityItem[] = [
    ...messages.map(m => ({ kind: 'message' as const, date: m.timestamp, data: m })),
    ...briefs.map(b => ({ kind: 'brief' as const, date: b.meeting_date, data: b })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  // Filter
  const filtered = filter === 'todos' ? allItems
    : filter === 'reuniones' ? allItems.filter(i => i.kind === 'brief')
    : allItems.filter(i => i.kind === 'message' && (i.data as Message).fuente === filter)

  // Source counts
  const msgCounts: Record<string, number> = {}
  messages.forEach(m => {
    const src = m.fuente ?? 'manual'
    msgCounts[src] = (msgCounts[src] ?? 0) + 1
  })
  const filterOptions = [
    { key: 'todos', label: 'Todos', count: allItems.length, cfg: null },
    ...Object.entries(msgCounts).map(([src, count]) => ({
      key: src, label: SOURCE_CONFIG[src]?.label ?? src, count, cfg: SOURCE_CONFIG[src] ?? null,
    })),
    ...(briefs.length > 0 ? [{ key: 'reuniones', label: 'Reuniones', count: briefs.length, cfg: SOURCE_CONFIG.reuniones }] : []),
  ]

  // Day grouping helper
  function dayKey(iso: string) {
    return new Date(iso).toISOString().slice(0, 10)
  }

  let lastDay = ''

  return (
    <>
      {/* Filter bar */}
      {allItems.length > 0 && (
        <div style={{ display: 'flex', gap: '6px', marginBottom: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', color: '#4a5568', marginRight: '2px' }}>Fuente:</span>
          {filterOptions.map(opt => {
            const isActive = filter === opt.key
            const cfg = opt.cfg
            return (
              <button
                key={opt.key}
                onClick={() => setFilter(opt.key)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                  fontSize: '11px', fontWeight: isActive ? 700 : 500,
                  padding: '3px 9px', borderRadius: '6px', cursor: 'pointer',
                  background: isActive ? (cfg?.bg ?? 'rgba(232,121,47,0.12)') : 'rgba(255,255,255,0.04)',
                  color: isActive ? (cfg?.color ?? '#E8792F') : '#64748b',
                  border: `1px solid ${isActive ? (cfg?.border ?? 'rgba(232,121,47,0.25)') : 'rgba(255,255,255,0.08)'}`,
                  transition: 'all 0.15s', outline: 'none',
                }}
              >
                {cfg?.icon ?? '📋'} {opt.label} <span style={{ opacity: 0.6 }}>({opt.count})</span>
              </button>
            )
          })}
        </div>
      )}

      {/* Feed */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {filtered.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '40px',
            background: 'rgba(17,24,39,0.85)', border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: '12px', color: '#A0AEC0',
          }}>
            Sin actividad para este filtro
          </div>
        ) : filtered.map((item, i) => {
          const day = dayKey(item.date)
          const showDay = day !== lastDay
          if (showDay) lastDay = day

          return (
            <div key={item.kind === 'brief' ? `brief-${(item.data as MeetingBrief).id}` : `msg-${(item.data as Message).id}`}>
              {showDay && <DaySeparator date={item.date} />}
              {item.kind === 'brief'
                ? <BriefCard brief={item.data as MeetingBrief} onClick={() => setSelectedBrief(item.data as MeetingBrief)} />
                : <MessageCard msg={item.data as Message} />
              }
            </div>
          )
        })}
      </div>

      <MeetingBriefPanel brief={selectedBrief} onClose={() => setSelectedBrief(null)} />
    </>
  )
}
