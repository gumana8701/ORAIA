'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

// ── Types ────────────────────────────────────────────────────────────────────
interface Summary {
  totalProjects: number; activeProjects: number; riskProjects: number
  totalTasks: number; completedTasks: number; blockedCount: number; inProgressCount: number
  openAlerts: number; alertsByLevel: Record<string, number>
  avgResolutionHrs: number | null; msgsHoy: number; completionRate: number
}
interface ProjectHealth {
  id: string; nombre: string; estado: string; color_emoji: string | null
  alertas: number; pct: number; total: number; completed: number
  blocked: number; maxBlockedHrs: number; daysSinceActivity: number; score: number
}
interface TeamMember {
  nombre: string; total: number; completadas: number; bloqueadas: number
  enProgreso: number; pendientes: number; overdueCount: number
  avgCompletionDays: number | null; totalBlockedHrs: number
  ticketsAssigned: number; ticketsResolved: number
}
interface BlockedTask {
  id: string; title: string; assignee: string; project: string; projectId: string
  priority: string; blockedHrs: number
}
interface UpcomingTask {
  id: string; title: string; assignee: string; project: string; projectId: string
  dueDate: string; daysLeft: number; overdue: boolean
}
interface RecentActivity {
  taskTitle: string; project: string; projectId: string; status: string
  changedBy: string; changedAt: string; durationSecs: number
}
interface Metrics {
  summary: Summary; projectHealth: ProjectHealth[]; team: TeamMember[]
  blockedTasks: BlockedTask[]; upcoming: UpcomingTask[]; recentActivity: RecentActivity[]
  generatedAt: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const STATUS_COLOR: Record<string, string> = {
  completado: '#22c55e', en_progreso: '#3b82f6', bloqueado: '#ef4444', pendiente: '#64748b',
}
const STATUS_LABEL: Record<string, string> = {
  completado: '✅ Completado', en_progreso: '🔄 En progreso',
  bloqueado: '🚫 Bloqueado', pendiente: '⏳ Pendiente',
}

function timeAgo(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (d < 60) return 'ahora'
  if (d < 3600) return `${Math.floor(d / 60)}m`
  if (d < 86400) return `${Math.floor(d / 3600)}h`
  return `${Math.floor(d / 86400)}d`
}

function scoreColor(s: number) {
  if (s >= 80) return '#22c55e'
  if (s >= 50) return '#f59e0b'
  return '#ef4444'
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: 'rgba(17,24,39,0.85)', border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: '12px', padding: '20px', ...style,
    }}>
      {children}
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: '11px', fontWeight: 700, color: '#E8792F', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '14px' }}>
      {children}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function PMDashboard() {
  const [data, setData]         = useState<Metrics | null>(null)
  const [loading, setLoading]   = useState(true)
  const [refreshing, setRefresh] = useState(false)
  const [view, setView]         = useState<'health' | 'team' | 'blocked' | 'activity'>('health')

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefresh(true)
    try {
      const res = await fetch('/api/dashboard/metrics')
      const d   = await res.json()
      setData(d)
    } finally {
      setLoading(false)
      setRefresh(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '48px', color: '#475569' }}>
      <div style={{ fontSize: '32px', marginBottom: '12px' }}>📊</div>
      <div style={{ fontSize: '14px' }}>Cargando métricas...</div>
    </div>
  )

  if (!data) return null
  const { summary, projectHealth, team, blockedTasks, upcoming, recentActivity } = data

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* ── Top KPI bar ─────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
        {[
          { icon: '🟠', label: 'Activos',      value: summary.activeProjects,  sub: `${summary.riskProjects} en riesgo`,   color: '#E8792F' },
          { icon: '✅', label: 'Completadas',   value: `${summary.completionRate}%`, sub: `${summary.completedTasks}/${summary.totalTasks} tareas`, color: '#22c55e' },
          { icon: '🚫', label: 'Bloqueadas',    value: summary.blockedCount,    sub: 'tareas sin avanzar',                 color: summary.blockedCount > 0 ? '#ef4444' : '#22c55e' },
          { icon: '⚠️', label: 'Alertas',       value: summary.openAlerts,      sub: `${summary.alertsByLevel.critico ?? 0} críticas`, color: summary.alertsByLevel.critico > 0 ? '#ef4444' : '#f59e0b' },
        ].map(s => (
          <div key={s.label} style={{
            background: 'rgba(17,24,39,0.85)', border: `1px solid ${s.color}18`,
            borderRadius: '12px', padding: '16px 18px', position: 'relative', overflow: 'hidden',
          }}>
            <div style={{ position: 'absolute', bottom: 0, left: '10%', right: '10%', height: '2px', background: `linear-gradient(90deg, transparent, ${s.color}60, transparent)` }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '20px' }}>{s.icon}</span>
              <span style={{ fontSize: '28px', fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</span>
            </div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#e2e8f0', marginTop: '8px' }}>{s.label}</div>
            <div style={{ fontSize: '10px', color: '#475569', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Alert severity mini bar ─────────────────────────────────────── */}
      {summary.openAlerts > 0 && (
        <div style={{
          display: 'flex', gap: '8px', padding: '10px 16px',
          background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)',
          borderRadius: '8px', alignItems: 'center', flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Alertas:</span>
          {[['critico','#ef4444'],['alto','#f97316'],['medio','#f59e0b'],['bajo','#6b7280']].map(([k,c]) => (
            (summary.alertsByLevel[k] || 0) > 0 && (
              <span key={k} style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', background: `${c}20`, color: c, border: `1px solid ${c}40`, textTransform: 'uppercase' }}>
                {k}: {summary.alertsByLevel[k]}
              </span>
            )
          ))}
          {summary.avgResolutionHrs !== null && (
            <span style={{ fontSize: '11px', color: '#475569', marginLeft: 'auto' }}>
              ⏱ Resolución promedio: <strong style={{ color: '#94a3b8' }}>{summary.avgResolutionHrs}h</strong>
            </span>
          )}
        </div>
      )}

      {/* ── View tabs ───────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0' }}>
        {([
          ['health',   '🏥 Salud Proyectos'],
          ['team',     '👥 Equipo'],
          ['blocked',  `🚫 Bloqueadas${blockedTasks.length > 0 ? ` (${blockedTasks.length})` : ''}`],
          ['activity', '⚡ Actividad Reciente'],
        ] as [typeof view, string][]).map(([k, label]) => (
          <button key={k} onClick={() => setView(k)} style={{
            padding: '9px 16px', fontSize: '12px', fontWeight: view === k ? 700 : 400,
            color: view === k ? '#E8792F' : '#64748b',
            borderBottom: `2px solid ${view === k ? '#E8792F' : 'transparent'}`,
            marginBottom: '-1px', background: 'none', border: 'none',
            borderBottomStyle: 'solid', borderBottomWidth: '2px',
            borderBottomColor: view === k ? '#E8792F' : 'transparent',
            cursor: 'pointer',
          }}>{label}</button>
        ))}
        <button
          onClick={() => load(true)} disabled={refreshing}
          style={{ marginLeft: 'auto', padding: '6px 12px', fontSize: '11px', fontWeight: 600, borderRadius: '6px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#475569', cursor: 'pointer', marginBottom: '4px', opacity: refreshing ? 0.5 : 1 }}
        >{refreshing ? '⏳' : '↻ Refresh'}</button>
      </div>

      {/* ── VIEW: Project Health ─────────────────────────────────────────── */}
      {view === 'health' && (
        <Card>
          <SectionTitle>🏥 Salud de proyectos — Score más bajo primero</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {/* Header */}
            <div style={{ display: 'grid', gridTemplateColumns: '32px 1fr 60px 80px 60px 60px 70px 70px', gap: '8px', padding: '0 8px', fontSize: '9px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <span></span><span>Proyecto</span><span style={{textAlign:'right'}}>Score</span><span style={{textAlign:'center'}}>Progreso</span><span style={{textAlign:'center'}}>Bloqueos</span><span style={{textAlign:'center'}}>Alertas</span><span style={{textAlign:'center'}}>Sin actividad</span><span style={{textAlign:'center'}}>Estado</span>
            </div>
            {projectHealth.map((p, i) => (
              <Link key={p.id} href={`/proyectos/${p.id}?tab=estado`} style={{ textDecoration: 'none' }}>
                <div style={{
                  display: 'grid', gridTemplateColumns: '32px 1fr 60px 80px 60px 60px 70px 70px', gap: '8px',
                  padding: '10px 8px', borderRadius: '8px', alignItems: 'center',
                  background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
                  border: '1px solid transparent', cursor: 'pointer',
                }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(232,121,47,0.2)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'transparent')}
                >
                  <span style={{ fontSize: '14px' }}>{p.color_emoji || '🟠'}</span>
                  <span style={{ fontSize: '12px', color: '#e2e8f0', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nombre}</span>
                  {/* Score */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 800, color: scoreColor(p.score) }}>{p.score}</span>
                  </div>
                  {/* Progress bar */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ flex: 1, height: '5px', borderRadius: '3px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${p.pct}%`, background: p.pct === 100 ? '#22c55e' : '#E8792F', borderRadius: '3px' }} />
                    </div>
                    <span style={{ fontSize: '10px', color: '#64748b', flexShrink: 0 }}>{p.pct}%</span>
                  </div>
                  {/* Blocked */}
                  <div style={{ textAlign: 'center' }}>
                    {p.blocked > 0
                      ? <span style={{ fontSize: '11px', fontWeight: 700, color: '#ef4444' }}>🚫 {p.blocked}</span>
                      : <span style={{ fontSize: '11px', color: '#22c55e' }}>✓</span>}
                  </div>
                  {/* Alerts */}
                  <div style={{ textAlign: 'center' }}>
                    {p.alertas > 0
                      ? <span style={{ fontSize: '11px', fontWeight: 700, color: '#f59e0b' }}>⚠️ {p.alertas}</span>
                      : <span style={{ fontSize: '11px', color: '#22c55e' }}>✓</span>}
                  </div>
                  {/* Days since activity */}
                  <div style={{ textAlign: 'center' }}>
                    <span style={{ fontSize: '11px', color: p.daysSinceActivity > 7 ? '#f87171' : '#64748b' }}>
                      {p.daysSinceActivity > 900 ? '—' : `${p.daysSinceActivity}d`}
                    </span>
                  </div>
                  {/* Estado */}
                  <div style={{ textAlign: 'center' }}>
                    <span style={{
                      fontSize: '9px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase',
                      background: p.estado === 'en_riesgo' ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.10)',
                      color: p.estado === 'en_riesgo' ? '#ef4444' : '#22c55e',
                      border: `1px solid ${p.estado === 'en_riesgo' ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.2)'}`,
                    }}>{p.estado === 'en_riesgo' ? 'En Riesgo' : 'Activo'}</span>
                  </div>
                </div>
              </Link>
            ))}
            {projectHealth.length === 0 && (
              <div style={{ textAlign: 'center', padding: '24px', color: '#475569', fontSize: '13px' }}>Sin proyectos</div>
            )}
          </div>
        </Card>
      )}

      {/* ── VIEW: Team ──────────────────────────────────────────────────── */}
      {view === 'team' && (
        <Card>
          <SectionTitle>👥 Rendimiento del equipo</SectionTitle>
          {team.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px', color: '#475569', fontSize: '13px' }}>
              Sin datos de equipo todavía — asigna personas a las tareas para ver métricas.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {/* Header */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 50px 50px 50px 50px 80px 70px', gap: '10px', padding: '0 10px', fontSize: '9px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <span>Persona</span><span style={{textAlign:'center'}}>Total</span><span style={{textAlign:'center'}}>✅</span><span style={{textAlign:'center'}}>🔄</span><span style={{textAlign:'center'}}>🚫</span><span style={{textAlign:'center'}}>⏱ Días prom.</span><span style={{textAlign:'center'}}>Hrs bloq.</span>
              </div>
              {team.map((m, i) => {
                const completionPct = m.total > 0 ? Math.round((m.completadas / m.total) * 100) : 0
                return (
                  <div key={m.nombre} style={{
                    display: 'grid', gridTemplateColumns: '1fr 50px 50px 50px 50px 80px 70px', gap: '10px',
                    padding: '12px 10px', borderRadius: '8px', alignItems: 'center',
                    background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
                  }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#f1f5f9' }}>{m.nombre}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                        <div style={{ width: '60px', height: '3px', borderRadius: '2px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${completionPct}%`, background: completionPct > 70 ? '#22c55e' : completionPct > 30 ? '#f59e0b' : '#ef4444' }} />
                        </div>
                        <span style={{ fontSize: '10px', color: '#64748b' }}>{completionPct}% completado</span>
                        {m.overdueCount > 0 && <span style={{ fontSize: '10px', color: '#ef4444', fontWeight: 700 }}>⚠️ {m.overdueCount} vencidas</span>}
                      </div>
                    </div>
                    <div style={{ textAlign: 'center', fontSize: '13px', fontWeight: 700, color: '#94a3b8' }}>{m.total}</div>
                    <div style={{ textAlign: 'center', fontSize: '13px', fontWeight: 700, color: '#22c55e' }}>{m.completadas}</div>
                    <div style={{ textAlign: 'center', fontSize: '13px', fontWeight: 700, color: '#3b82f6' }}>{m.enProgreso}</div>
                    <div style={{ textAlign: 'center', fontSize: '13px', fontWeight: 700, color: m.bloqueadas > 0 ? '#ef4444' : '#475569' }}>{m.bloqueadas}</div>
                    <div style={{ textAlign: 'center', fontSize: '12px', color: '#64748b' }}>
                      {m.avgCompletionDays !== null ? `${m.avgCompletionDays}d` : '—'}
                    </div>
                    <div style={{ textAlign: 'center', fontSize: '12px', color: m.totalBlockedHrs > 24 ? '#f87171' : '#64748b' }}>
                      {m.totalBlockedHrs > 0 ? `${m.totalBlockedHrs}h` : '—'}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      )}

      {/* ── VIEW: Blocked tasks ──────────────────────────────────────────── */}
      {view === 'blocked' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {upcoming.length > 0 && (
            <Card>
              <SectionTitle>📅 Próximos vencimientos (7 días)</SectionTitle>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {upcoming.map(t => (
                  <Link key={t.id} href={`/proyectos/${t.projectId}?tab=tareas`} style={{ textDecoration: 'none' }}>
                    <div style={{
                      display: 'flex', gap: '10px', alignItems: 'center', padding: '8px 10px',
                      borderRadius: '7px', background: 'rgba(255,255,255,0.02)', border: '1px solid transparent',
                      cursor: 'pointer',
                    }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(232,121,47,0.2)')}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = 'transparent')}
                    >
                      <span style={{ fontSize: '13px', fontWeight: 800, color: t.overdue ? '#ef4444' : t.daysLeft <= 2 ? '#f59e0b' : '#22c55e', flexShrink: 0, minWidth: '32px' }}>
                        {t.overdue ? `${Math.abs(t.daysLeft)}d` : `+${t.daysLeft}d`}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '12px', color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</div>
                        <div style={{ fontSize: '11px', color: '#475569' }}>{t.project} · {t.assignee}</div>
                      </div>
                      <span style={{ fontSize: '10px', color: '#64748b', flexShrink: 0 }}>{t.dueDate}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </Card>
          )}
          <Card>
            <SectionTitle>🚫 Tareas bloqueadas — mayor tiempo primero</SectionTitle>
            {blockedTasks.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px', color: '#22c55e', fontSize: '14px' }}>✅ Sin tareas bloqueadas</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {blockedTasks.map(t => (
                  <Link key={t.id} href={`/proyectos/${t.projectId}?tab=tareas`} style={{ textDecoration: 'none' }}>
                    <div style={{
                      display: 'flex', gap: '12px', alignItems: 'center', padding: '10px 12px',
                      borderRadius: '8px', background: 'rgba(239,68,68,0.04)',
                      border: '1px solid rgba(239,68,68,0.12)', cursor: 'pointer',
                    }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)')}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(239,68,68,0.12)')}
                    >
                      <div style={{ flexShrink: 0, textAlign: 'center', minWidth: '44px' }}>
                        <div style={{ fontSize: '14px', fontWeight: 800, color: t.blockedHrs > 48 ? '#ef4444' : '#f59e0b' }}>{t.blockedHrs}h</div>
                        <div style={{ fontSize: '9px', color: '#64748b', textTransform: 'uppercase' }}>bloq.</div>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '12px', color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>{t.title}</div>
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>{t.project} · {t.assignee}</div>
                      </div>
                      {t.priority === 'alta' && (
                        <span style={{ fontSize: '10px', fontWeight: 700, color: '#ef4444', padding: '2px 6px', borderRadius: '4px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', flexShrink: 0 }}>ALTA</span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ── VIEW: Recent activity ────────────────────────────────────────── */}
      {view === 'activity' && (
        <Card>
          <SectionTitle>⚡ Actividad reciente del equipo (últimos 7 días)</SectionTitle>
          {recentActivity.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px', color: '#475569', fontSize: '13px' }}>
              Sin actividad registrada todavía. El historial se irá acumulando con los cambios de estado.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {recentActivity.map((a, i) => (
                <Link key={i} href={`/proyectos/${a.projectId}?tab=tareas`} style={{ textDecoration: 'none' }}>
                  <div style={{
                    display: 'flex', gap: '10px', alignItems: 'center', padding: '9px 10px',
                    borderRadius: '8px', background: 'rgba(255,255,255,0.02)', cursor: 'pointer',
                    border: '1px solid transparent',
                  }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(232,121,47,0.15)')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = 'transparent')}
                  >
                    <span style={{ fontSize: '14px', flexShrink: 0 }}>
                      {a.status === 'completado' ? '✅' : a.status === 'bloqueado' ? '🚫' : a.status === 'en_progreso' ? '🔄' : '⏳'}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '12px', color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <strong style={{ color: '#94a3b8' }}>{a.changedBy}</strong> → {a.taskTitle}
                      </div>
                      <div style={{ fontSize: '11px', color: '#475569', marginTop: '2px' }}>
                        {a.project} · {STATUS_LABEL[a.status] || a.status}
                        {a.durationSecs > 0 && ` · tardó ${Math.round(a.durationSecs / 3600)}h`}
                      </div>
                    </div>
                    <span style={{ fontSize: '11px', color: '#334155', flexShrink: 0 }}>{timeAgo(a.changedAt)}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>
      )}

      <p style={{ fontSize: '10px', color: '#1e293b', textAlign: 'right' }}>
        Actualizado: {data?.generatedAt ? timeAgo(data.generatedAt) : '—'}
      </p>
    </div>
  )
}
