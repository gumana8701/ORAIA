'use client'
import { useState, useEffect } from 'react'

interface MemberStat {
  assignee: string
  total: number
  completed: number
  en_progreso: number
  pendiente: number
  bloqueado: number
  overdue: number
  completion_rate: number
  avg_open_time: string | null
  avg_resolve_time: string | null
  open_tasks: {
    id: string
    title: string
    status: string
    priority: string
    due_date: string | null
    is_subtask: boolean
    open_since: string
    overdue: boolean
  }[]
}

const MEMBER_COLORS: Record<string, { color: string; emoji: string }> = {
  'Enzo ORA IA':       { color: '#6366f1', emoji: '🎯' },
  'Héctor Ramirez':    { color: '#E8792F', emoji: '⚡' },
  'Victor Ramirez':    { color: '#3b82f6', emoji: '🔧' },
  'Brenda Cruz':       { color: '#ec4899', emoji: '✨' },
  'Kevin ORA IA':      { color: '#8b5cf6', emoji: '💻' },
  'Luca Fonzo':        { color: '#14b8a6', emoji: '🌐' },
  'Jennifer Serrano':  { color: '#f59e0b', emoji: '💼' },
  'Trina Gomez':       { color: '#a855f7', emoji: '🌟' },
}

const STATUS_STYLE: Record<string, { color: string; bg: string }> = {
  pendiente:   { color: '#64748b', bg: 'rgba(100,116,139,0.15)' },
  en_progreso: { color: '#3b82f6', bg: 'rgba(59,130,246,0.12)'  },
  bloqueado:   { color: '#ef4444', bg: 'rgba(239,68,68,0.12)'   },
  completado:  { color: '#22c55e', bg: 'rgba(34,197,94,0.12)'   },
}

export default function TeamStatsTab({
  projectId,
  assignedDevs,
}: {
  projectId: string
  assignedDevs: { nombre: string; color?: string; emoji?: string }[]
}) {
  const [stats, setStats]         = useState<MemberStat[]>([])
  const [loading, setLoading]     = useState(true)
  const [expanded, setExpanded]   = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/projects/${projectId}/team-stats`)
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setStats(d) })
      .finally(() => setLoading(false))
  }, [projectId])

  if (loading) {
    return (
      <div style={{ padding: '32px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
        Cargando estadísticas del equipo...
      </div>
    )
  }

  if (!stats.length) {
    return (
      <div style={{ padding: '32px', textAlign: 'center', color: '#475569', fontSize: '13px' }}>
        Sin tareas asignadas aún.
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Header */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '180px repeat(6, 1fr) auto',
        gap: '8px',
        padding: '8px 16px',
        fontSize: '10px', fontWeight: 700, color: '#475569',
        textTransform: 'uppercase', letterSpacing: '0.06em',
      }}>
        <span>Miembro</span>
        <span style={{ textAlign: 'center' }}>Total</span>
        <span style={{ textAlign: 'center' }}>✅ Completadas</span>
        <span style={{ textAlign: 'center' }}>🔵 En progreso</span>
        <span style={{ textAlign: 'center' }}>⏳ Pendientes</span>
        <span style={{ textAlign: 'center' }}>🔴 Bloqueadas</span>
        <span style={{ textAlign: 'center' }}>⚠️ Vencidas</span>
        <span style={{ textAlign: 'center' }}>Tiempos</span>
      </div>

      {stats.map(member => {
        const mc = MEMBER_COLORS[member.assignee] || { color: '#94a3b8', emoji: '👤' }
        const isExpanded = expanded === member.assignee
        const pct = member.completion_rate

        return (
          <div key={member.assignee} style={{
            background: 'rgba(17,24,39,0.8)',
            border: `1px solid ${isExpanded ? mc.color + '40' : 'rgba(255,255,255,0.07)'}`,
            borderRadius: '12px',
            overflow: 'hidden',
            transition: 'border-color 0.2s',
          }}>
            {/* Main row */}
            <div
              onClick={() => setExpanded(isExpanded ? null : member.assignee)}
              style={{
                display: 'grid',
                gridTemplateColumns: '180px repeat(6, 1fr) auto',
                gap: '8px',
                padding: '14px 16px',
                cursor: 'pointer',
                alignItems: 'center',
              }}
            >
              {/* Name */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
                  background: mc.color + '20', border: `1.5px solid ${mc.color}40`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '14px',
                }}>{mc.emoji}</span>
                <div>
                  <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#f1f5f9' }}>
                    {member.assignee.split(' ')[0]}
                  </p>
                  <p style={{ margin: 0, fontSize: '10px', color: '#475569' }}>
                    {member.assignee.split(' ').slice(1).join(' ')}
                  </p>
                </div>
              </div>

              {/* Total + progress */}
              <div style={{ textAlign: 'center' }}>
                <p style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#f1f5f9' }}>{member.total}</p>
                <div style={{ height: '3px', borderRadius: '2px', background: 'rgba(255,255,255,0.08)', marginTop: '4px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: '2px', width: `${pct}%`, background: pct === 100 ? '#22c55e' : mc.color, transition: 'width 0.4s' }} />
                </div>
                <p style={{ margin: '2px 0 0', fontSize: '10px', color: pct === 100 ? '#22c55e' : '#64748b' }}>{pct}%</p>
              </div>

              {/* Completed */}
              <div style={{ textAlign: 'center' }}>
                <p style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: member.completed > 0 ? '#22c55e' : '#334155' }}>
                  {member.completed}
                </p>
              </div>

              {/* En progreso */}
              <div style={{ textAlign: 'center' }}>
                <p style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: member.en_progreso > 0 ? '#3b82f6' : '#334155' }}>
                  {member.en_progreso}
                </p>
              </div>

              {/* Pendiente */}
              <div style={{ textAlign: 'center' }}>
                <p style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: member.pendiente > 0 ? '#94a3b8' : '#334155' }}>
                  {member.pendiente}
                </p>
              </div>

              {/* Bloqueado */}
              <div style={{ textAlign: 'center' }}>
                <p style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: member.bloqueado > 0 ? '#ef4444' : '#334155' }}>
                  {member.bloqueado}
                </p>
              </div>

              {/* Vencidas */}
              <div style={{ textAlign: 'center' }}>
                <p style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: member.overdue > 0 ? '#f59e0b' : '#334155' }}>
                  {member.overdue > 0 ? `⚠️ ${member.overdue}` : '—'}
                </p>
              </div>

              {/* Tiempos + chevron */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                {member.avg_resolve_time && (
                  <span style={{ fontSize: '10px', color: '#22c55e', fontWeight: 600 }}>
                    ✅ prom {member.avg_resolve_time}
                  </span>
                )}
                {member.avg_open_time && (
                  <span style={{ fontSize: '10px', color: '#f59e0b', fontWeight: 600 }}>
                    ⏳ abierto {member.avg_open_time}
                  </span>
                )}
                <span style={{ fontSize: '11px', color: '#334155', marginTop: '4px' }}>
                  {isExpanded ? '▾' : '▸'}
                </span>
              </div>
            </div>

            {/* Expanded: open tasks list */}
            {isExpanded && member.open_tasks.length > 0 && (
              <div style={{
                borderTop: '1px solid rgba(255,255,255,0.06)',
                padding: '12px 16px',
                background: 'rgba(0,0,0,0.2)',
              }}>
                <p style={{ margin: '0 0 10px', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Tareas abiertas ({member.open_tasks.length})
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {member.open_tasks.map(task => {
                    const sc = STATUS_STYLE[task.status] || STATUS_STYLE.pendiente
                    const priorityBadge = task.priority === 'alta'
                      ? <span style={{ fontSize: '9px', fontWeight: 800, padding: '1px 5px', borderRadius: '3px', background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', marginLeft: '4px' }}>ALTA</span>
                      : null
                    return (
                      <div key={task.id} style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        padding: '7px 10px', borderRadius: '7px',
                        background: task.overdue ? 'rgba(245,158,11,0.05)' : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${task.overdue ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.06)'}`,
                      }}>
                        {task.is_subtask && (
                          <span style={{ fontSize: '9px', color: '#475569', flexShrink: 0 }}>↳</span>
                        )}
                        <span style={{ flex: 1, fontSize: '12px', color: '#cbd5e0', lineHeight: 1.4 }}>
                          {task.title}{priorityBadge}
                        </span>
                        <span style={{
                          fontSize: '10px', padding: '2px 6px', borderRadius: '4px',
                          background: sc.bg, color: sc.color, fontWeight: 600, flexShrink: 0,
                        }}>
                          {task.status}
                        </span>
                        <span style={{ fontSize: '10px', color: task.overdue ? '#f59e0b' : '#475569', fontWeight: task.overdue ? 600 : 400, flexShrink: 0 }}>
                          {task.overdue ? `⚠️ vencida` : `⏳ ${task.open_since}`}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
            {isExpanded && member.open_tasks.length === 0 && (
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '12px 16px', background: 'rgba(0,0,0,0.2)' }}>
                <p style={{ margin: 0, fontSize: '12px', color: '#22c55e', textAlign: 'center' }}>
                  ✅ Todo completado
                </p>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
