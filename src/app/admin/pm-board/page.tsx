'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

const ALL_ETAPAS = [
  '🔴 1. Incorporación',
  '1.1 Listo para Ops',
  'por trabajar',
  '🟡2. Creación del agente',
  '🟣3. Cliente testeando',
  '3.1 Aplicando Feedback',
  '3.2 Waiting Client/ Agente voz/ text',
  'PORTAL pendiente',
  'Portal listo - falta entregar',
  '🟢4. Lanzamiento',
  '6. RECIBIO PORTAL ☺',
  '🔵Soporte activo',
  'Termino soporte',
  'On Hold',
  'X. Cliente viejo y no muy contento',
  'Falta lanzar',
]

const ETAPA_COLORS: Record<string, { bg: string; text: string; border: string; header: string }> = {
  '🔴 1. Incorporación':                  { bg: 'rgba(239,68,68,0.08)',  text: '#ef4444', border: 'rgba(239,68,68,0.20)',  header: 'rgba(239,68,68,0.12)' },
  '1.1 Listo para Ops':                   { bg: 'rgba(249,115,22,0.08)', text: '#f97316', border: 'rgba(249,115,22,0.20)', header: 'rgba(249,115,22,0.12)' },
  'por trabajar':                          { bg: 'rgba(148,163,184,0.06)',text: '#94a3b8', border: 'rgba(148,163,184,0.15)',header: 'rgba(148,163,184,0.08)' },
  '🟡2. Creación del agente':             { bg: 'rgba(234,179,8,0.08)',  text: '#eab308', border: 'rgba(234,179,8,0.20)',  header: 'rgba(234,179,8,0.12)' },
  '🟣3. Cliente testeando':               { bg: 'rgba(168,85,247,0.08)', text: '#a855f7', border: 'rgba(168,85,247,0.20)', header: 'rgba(168,85,247,0.12)' },
  '3.1 Aplicando Feedback':               { bg: 'rgba(168,85,247,0.06)', text: '#c084fc', border: 'rgba(168,85,247,0.15)', header: 'rgba(168,85,247,0.10)' },
  '3.2 Waiting Client/ Agente voz/ text': { bg: 'rgba(148,163,184,0.06)',text: '#94a3b8', border: 'rgba(148,163,184,0.15)',header: 'rgba(148,163,184,0.08)' },
  'PORTAL pendiente':                     { bg: 'rgba(251,146,60,0.08)', text: '#fb923c', border: 'rgba(251,146,60,0.20)', header: 'rgba(251,146,60,0.12)' },
  'Portal listo - falta entregar':        { bg: 'rgba(251,146,60,0.06)', text: '#fdba74', border: 'rgba(251,146,60,0.15)', header: 'rgba(251,146,60,0.10)' },
  '🟢4. Lanzamiento':                     { bg: 'rgba(34,197,94,0.08)',  text: '#22c55e', border: 'rgba(34,197,94,0.20)',  header: 'rgba(34,197,94,0.12)' },
  '6. RECIBIO PORTAL ☺':                 { bg: 'rgba(34,197,94,0.06)',  text: '#4ade80', border: 'rgba(34,197,94,0.15)',  header: 'rgba(34,197,94,0.10)' },
  '🔵Soporte activo':                     { bg: 'rgba(59,130,246,0.08)', text: '#3b82f6', border: 'rgba(59,130,246,0.20)', header: 'rgba(59,130,246,0.12)' },
  'Termino soporte':                      { bg: 'rgba(107,114,128,0.06)',text: '#9ca3af', border: 'rgba(107,114,128,0.15)',header: 'rgba(107,114,128,0.08)' },
  'On Hold':                              { bg: 'rgba(107,114,128,0.08)',text: '#6b7280', border: 'rgba(107,114,128,0.20)',header: 'rgba(107,114,128,0.10)' },
  'X. Cliente viejo y no muy contento':   { bg: 'rgba(239,68,68,0.06)',  text: '#f87171', border: 'rgba(239,68,68,0.15)',  header: 'rgba(239,68,68,0.08)' },
  'Falta lanzar':                         { bg: 'rgba(234,179,8,0.06)',  text: '#fbbf24', border: 'rgba(234,179,8,0.15)',  header: 'rgba(234,179,8,0.10)' },
}
const DEFAULT_COLOR = { bg: 'rgba(232,121,47,0.08)', text: '#E8792F', border: 'rgba(232,121,47,0.20)', header: 'rgba(232,121,47,0.10)' }

interface Project {
  id: string
  nombre: string
  estado: string | null
  etapas: string[]
  responsable: string[]
  plan_type: string | null
  lanzamiento_real: string | null
  kick_off_date: string | null
  project_id: string | null
  taskStats: { total: number; done: number }
  kpis: Array<{ kpi_text: string; categoria: string }>
}

function TaskBar({ total, done }: { total: number; done: number }) {
  if (total === 0) return null
  const pct = Math.round((done / total) * 100)
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1 bg-slate-700 rounded-full">
        <div
          className="h-1 rounded-full transition-all"
          style={{ width: `${pct}%`, background: pct === 100 ? '#22c55e' : '#E8792F' }}
        />
      </div>
      <span className="text-[11px] text-slate-500 tabular-nums flex-shrink-0">{done}/{total}</span>
    </div>
  )
}

function Initials({ names }: { names: string[] }) {
  if (!names || names.length === 0) return null
  return (
    <div className="flex -space-x-1">
      {names.slice(0, 3).map((name, i) => (
        <div key={i} title={name}
          className="w-5 h-5 rounded-full bg-slate-600 border border-slate-900 flex items-center justify-center text-[9px] font-bold text-slate-200">
          {name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}
        </div>
      ))}
      {names.length > 3 && (
        <div className="w-5 h-5 rounded-full bg-slate-700 border border-slate-900 flex items-center justify-center text-[9px] text-slate-400">
          +{names.length - 3}
        </div>
      )}
    </div>
  )
}

function EstadoBadge({ estado }: { estado: string | null }) {
  if (!estado || estado === 'Sin empezar') return null
  const isListo = estado === 'Listo'
  const isSesion = estado.toLowerCase().includes('sesion')
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
      isListo ? 'bg-green-500/15 text-green-400' :
      isSesion ? 'bg-orange-500/15 text-orange-400' :
      'bg-slate-700 text-slate-400'
    }`}>
      {isListo ? '✅ ' : isSesion ? '🔄 ' : ''}{estado}
    </span>
  )
}

function MoveButtons({ etapaIdx, isUpdating, onPrev, onNext }: {
  etapaIdx: number; isUpdating: boolean
  onPrev: () => void; onNext: () => void
}) {
  const btnStyle = (disabled: boolean): React.CSSProperties => ({
    padding: '3px 8px', borderRadius: '5px', fontSize: '11px', fontWeight: 600,
    background: disabled ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.10)',
    border: `1px solid ${disabled ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.18)'}`,
    color: disabled ? '#334155' : '#94a3b8',
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'all 0.1s',
    lineHeight: '16px',
  })
  return (
    <div style={{ display: 'flex', gap: '4px' }}>
      <button onClick={onPrev} disabled={etapaIdx <= 0 || isUpdating}
        title="Etapa anterior" style={btnStyle(etapaIdx <= 0 || isUpdating)}>
        ‹ Prev
      </button>
      <button onClick={onNext} disabled={etapaIdx >= ALL_ETAPAS.length - 1 || isUpdating}
        title="Siguiente etapa" style={btnStyle(etapaIdx >= ALL_ETAPAS.length - 1 || isUpdating)}>
        Next ›
      </button>
    </div>
  )
}

export default function PMBoardPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'kanban' | 'table'>('kanban')
  const [search, setSearch] = useState('')
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/pm-board')
      .then(r => r.json())
      .then(data => { setProjects(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const filteredProjects = projects.filter(p =>
    p.nombre?.toLowerCase().includes(search.toLowerCase())
  )

  const handleMoveEtapa = useCallback(async (project: Project, direction: 'prev' | 'next') => {
    const currentEtapa = project.etapas?.[0] || ''
    const currentIdx = ALL_ETAPAS.indexOf(currentEtapa)
    const newIdx = direction === 'next' ? currentIdx + 1 : currentIdx - 1
    if (newIdx < 0 || newIdx >= ALL_ETAPAS.length) return
    const newEtapa = ALL_ETAPAS[newIdx]
    setUpdatingId(project.id)
    setProjects(prev => prev.map(p => p.id === project.id ? { ...p, etapas: [newEtapa] } : p))
    try {
      await fetch('/api/notion/update-status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notion_project_id: project.id, etapas: [newEtapa] }),
      })
    } catch {
      setProjects(prev => prev.map(p => p.id === project.id ? { ...p, etapas: project.etapas } : p))
    } finally {
      setUpdatingId(null)
    }
  }, [])

  const getHref = (p: Project) => p.project_id ? `/proyectos/${p.project_id}` : null

  // ── KANBAN ───────────────────────────────────────────────────────────────────

  const KanbanView = () => {
    const columns = ALL_ETAPAS
      .map(etapa => ({ etapa, items: filteredProjects.filter(p => (p.etapas?.[0] || '') === etapa) }))
      .filter(c => c.items.length > 0)
    const noEtapa = filteredProjects.filter(p => !p.etapas?.length)

    return (
      <div className="flex gap-3 overflow-x-auto pb-6" style={{ minHeight: '70vh' }}>
        {[...columns, ...(noEtapa.length ? [{ etapa: 'Sin etapa', items: noEtapa }] : [])].map(col => {
          const c = ETAPA_COLORS[col.etapa] || DEFAULT_COLOR
          return (
            <div key={col.etapa} className="flex-shrink-0" style={{ width: '280px' }}>
              {/* Column header */}
              <div style={{
                marginBottom: '10px', padding: '8px 12px', borderRadius: '10px',
                display: 'flex', alignItems: 'center', gap: '8px',
                background: c.header, border: `1px solid ${c.border}`,
                position: 'sticky', top: 0, zIndex: 10,
              }}>
                <div style={{
                  width: '8px', height: '8px', borderRadius: '50%',
                  background: c.text, flexShrink: 0,
                }} />
                <span style={{
                  color: c.text, fontSize: '11px', fontWeight: 700,
                  flex: 1, lineHeight: '1.3',
                }}>
                  {col.etapa}
                </span>
                <span style={{
                  fontSize: '11px', fontWeight: 700, padding: '1px 7px',
                  borderRadius: '10px', background: 'rgba(0,0,0,0.25)',
                  color: c.text, flexShrink: 0,
                }}>
                  {col.items.length}
                </span>
              </div>

              {/* Cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {col.items.map(project => {
                  const etapaIdx = ALL_ETAPAS.indexOf(col.etapa)
                  const isUpdating = updatingId === project.id
                  const href = getHref(project)
                  const pct = project.taskStats.total > 0
                    ? Math.round((project.taskStats.done / project.taskStats.total) * 100)
                    : null
                  return (
                    <div key={project.id}
                      style={{
                        background: '#162032',
                        border: `1px solid ${c.border}`,
                        borderLeft: `3px solid ${c.text}`,
                        borderRadius: '10px',
                        overflow: 'hidden',
                        opacity: isUpdating ? 0.5 : 1,
                        transition: 'all 0.15s ease',
                        boxShadow: '0 2px 10px rgba(0,0,0,0.35)',
                      }}>
                      <div style={{ padding: '12px' }}>
                        {/* Name */}
                        {href ? (
                          <Link href={href} style={{
                            display: 'block', fontSize: '13px', fontWeight: 600,
                            color: '#f1f5f9', marginBottom: '8px', lineHeight: '1.4',
                            textDecoration: 'none',
                          }}>
                            {project.nombre}
                          </Link>
                        ) : (
                          <p style={{
                            fontSize: '13px', fontWeight: 600, color: '#f1f5f9',
                            marginBottom: '8px', lineHeight: '1.4', margin: '0 0 8px 0',
                          }}>
                            {project.nombre}
                          </p>
                        )}

                        {/* Estado badge */}
                        {project.estado && project.estado !== 'Sin empezar' && (
                          <div style={{ marginBottom: '8px' }}>
                            <EstadoBadge estado={project.estado} />
                          </div>
                        )}

                        {/* Task progress */}
                        {project.taskStats.total > 0 && (
                          <div style={{ marginBottom: '8px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                              <span style={{ fontSize: '10px', color: '#64748b' }}>Tareas</span>
                              <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 600 }}>
                                {project.taskStats.done}/{project.taskStats.total} · {pct}%
                              </span>
                            </div>
                            <div style={{ height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.08)' }}>
                              <div style={{
                                height: '4px', borderRadius: '2px',
                                width: `${pct}%`,
                                background: pct === 100 ? '#22c55e' : c.text,
                                transition: 'width 0.3s ease',
                              }} />
                            </div>
                          </div>
                        )}

                        {/* KPIs */}
                        {project.kpis.length > 0 && (
                          <div style={{ marginBottom: '8px' }}>
                            <span style={{
                              fontSize: '10px', padding: '2px 6px', borderRadius: '4px',
                              background: 'rgba(232,121,47,0.15)', color: '#E8792F',
                              border: '1px solid rgba(232,121,47,0.25)', fontWeight: 600,
                            }}>
                              📊 {project.kpis.length} KPI{project.kpis.length !== 1 ? 's' : ''}
                            </span>
                          </div>
                        )}

                        {/* Footer */}
                        <div style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.07)',
                        }}>
                          <Initials names={project.responsable || []} />
                          <MoveButtons
                            etapaIdx={etapaIdx} isUpdating={isUpdating}
                            onPrev={() => handleMoveEtapa(project, 'prev')}
                            onNext={() => handleMoveEtapa(project, 'next')}
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // ── TABLE ────────────────────────────────────────────────────────────────────

  const TableView = () => (
    <div className="overflow-x-auto rounded-xl border border-slate-700/60">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-700/60 bg-slate-800/80">
            <th className="text-left px-4 py-3 text-slate-400 font-medium text-xs uppercase tracking-wide">Proyecto</th>
            <th className="text-left px-4 py-3 text-slate-400 font-medium text-xs uppercase tracking-wide">Etapa</th>
            <th className="text-left px-4 py-3 text-slate-400 font-medium text-xs uppercase tracking-wide">Estado</th>
            <th className="text-left px-4 py-3 text-slate-400 font-medium text-xs uppercase tracking-wide">Plan</th>
            <th className="text-left px-4 py-3 text-slate-400 font-medium text-xs uppercase tracking-wide">Equipo</th>
            <th className="text-left px-4 py-3 text-slate-400 font-medium text-xs uppercase tracking-wide w-40">Tareas</th>
            <th className="text-left px-4 py-3 text-slate-400 font-medium text-xs uppercase tracking-wide">KPIs</th>
            <th className="text-center px-3 py-3 text-slate-400 font-medium text-xs uppercase tracking-wide">Mover</th>
          </tr>
        </thead>
        <tbody>
          {filteredProjects.map(project => {
            const currentEtapa = project.etapas?.[0] || ''
            const etapaIdx = ALL_ETAPAS.indexOf(currentEtapa)
            const c = ETAPA_COLORS[currentEtapa] || DEFAULT_COLOR
            const isUpdating = updatingId === project.id
            const href = getHref(project)
            return (
              <tr key={project.id}
                className={`border-b border-slate-700/30 transition-colors ${isUpdating ? 'opacity-40' : 'hover:bg-slate-800/50'}`}>
                <td className="px-4 py-3 max-w-[200px]">
                  {href ? (
                    <Link href={href} className="font-medium text-white hover:text-orange-400 transition-colors text-sm line-clamp-2">
                      {project.nombre}
                    </Link>
                  ) : (
                    <span className="font-medium text-slate-200 text-sm">{project.nombre}</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {currentEtapa ? (
                    <span className="text-xs px-2 py-0.5 rounded font-medium whitespace-nowrap"
                      style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}>
                      {currentEtapa}
                    </span>
                  ) : <span className="text-slate-600 text-xs">—</span>}
                </td>
                <td className="px-4 py-3">
                  <EstadoBadge estado={project.estado} />
                  {(!project.estado || project.estado === 'Sin empezar') && <span className="text-slate-600 text-xs">—</span>}
                </td>
                <td className="px-4 py-3 text-slate-400 text-xs">{project.plan_type || '—'}</td>
                <td className="px-4 py-3">
                  <Initials names={project.responsable || []} />
                </td>
                <td className="px-4 py-3 min-w-[130px]">
                  {project.taskStats.total > 0
                    ? <TaskBar total={project.taskStats.total} done={project.taskStats.done} />
                    : <span className="text-slate-600 text-xs">—</span>}
                </td>
                <td className="px-4 py-3">
                  {project.kpis.length > 0
                    ? <span className="text-xs text-orange-400">📊 {project.kpis.length}</span>
                    : <span className="text-slate-600 text-xs">—</span>}
                </td>
                <td className="px-3 py-3">
                  <MoveButtons etapaIdx={etapaIdx} isUpdating={isUpdating}
                    onPrev={() => handleMoveEtapa(project, 'prev')}
                    onNext={() => handleMoveEtapa(project, 'next')} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {filteredProjects.length === 0 && !loading && (
        <div className="text-center py-16 text-slate-500 text-sm">No se encontraron proyectos</div>
      )}
    </div>
  )

  // ── RENDER ───────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#f1f5f9', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ maxWidth: '1600px', margin: '0 auto', padding: '32px 24px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
          <Link href="/" style={{
            fontSize: '13px', color: '#64748b', textDecoration: 'none', fontWeight: 500,
            padding: '6px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}>
            ← Dashboard
          </Link>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#f1f5f9', margin: 0, lineHeight: 1.2 }}>
              PM Board
              <span style={{ fontSize: '14px', fontWeight: 400, color: '#475569', marginLeft: '8px' }}>
                {!loading && `${filteredProjects.length} proyectos`}
              </span>
            </h1>
          </div>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '14px' }}>🔍</span>
            <input
              type="text"
              placeholder="Buscar proyecto..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                background: '#1e293b', border: '1px solid #334155', borderRadius: '8px',
                padding: '8px 12px 8px 32px', fontSize: '13px', color: '#f1f5f9',
                outline: 'none', width: '220px',
              }}
            />
          </div>

          <div style={{ display: 'flex', borderRadius: '8px', overflow: 'hidden', border: '1px solid #334155' }}>
            <button onClick={() => setView('kanban')} style={{
              padding: '8px 16px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
              background: view === 'kanban' ? '#E8792F' : '#1e293b',
              color: view === 'kanban' ? '#fff' : '#94a3b8',
              border: 'none', transition: 'all 0.15s',
            }}>
              🗂 Kanban
            </button>
            <button onClick={() => setView('table')} style={{
              padding: '8px 16px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
              background: view === 'table' ? '#E8792F' : '#1e293b',
              color: view === 'table' ? '#fff' : '#94a3b8',
              border: 'none', borderLeft: '1px solid #334155', transition: 'all 0.15s',
            }}>
              📋 Tabla
            </button>
          </div>

          {search && (
            <button onClick={() => setSearch('')} style={{
              fontSize: '12px', color: '#64748b', background: 'none', border: 'none', cursor: 'pointer',
            }}>
              ✕ Limpiar
            </button>
          )}
        </div>

        {/* Content */}
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px', color: '#475569', gap: '12px' }}>
            <div style={{
              width: '20px', height: '20px', borderRadius: '50%',
              border: '2px solid #334155', borderTopColor: '#E8792F',
              animation: 'spin 0.8s linear infinite',
            }} />
            <span style={{ fontSize: '14px' }}>Cargando proyectos...</span>
          </div>
        ) : view === 'kanban' ? (
          <KanbanView />
        ) : (
          <TableView />
        )}
      </div>
    </div>
  )
}
