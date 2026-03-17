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

const ETAPA_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  '🔴 1. Incorporación': { bg: 'rgba(239,68,68,0.10)', text: '#ef4444', border: 'rgba(239,68,68,0.25)' },
  '1.1 Listo para Ops': { bg: 'rgba(249,115,22,0.10)', text: '#f97316', border: 'rgba(249,115,22,0.25)' },
  '🟡2. Creación del agente': { bg: 'rgba(234,179,8,0.10)', text: '#eab308', border: 'rgba(234,179,8,0.25)' },
  '🟣3. Cliente testeando': { bg: 'rgba(168,85,247,0.10)', text: '#a855f7', border: 'rgba(168,85,247,0.25)' },
  '3.1 Aplicando Feedback': { bg: 'rgba(168,85,247,0.08)', text: '#c084fc', border: 'rgba(168,85,247,0.20)' },
  '3.2 Waiting Client/ Agente voz/ text': { bg: 'rgba(148,163,184,0.10)', text: '#94a3b8', border: 'rgba(148,163,184,0.20)' },
  '🟢4. Lanzamiento': { bg: 'rgba(34,197,94,0.10)', text: '#22c55e', border: 'rgba(34,197,94,0.25)' },
  '🔵Soporte activo': { bg: 'rgba(59,130,246,0.10)', text: '#3b82f6', border: 'rgba(59,130,246,0.25)' },
  'On Hold': { bg: 'rgba(107,114,128,0.10)', text: '#6b7280', border: 'rgba(107,114,128,0.25)' },
  'Termino soporte': { bg: 'rgba(107,114,128,0.08)', text: '#9ca3af', border: 'rgba(107,114,128,0.20)' },
}
const DEFAULT_COLOR = { bg: 'rgba(232,121,47,0.10)', text: '#E8792F', border: 'rgba(232,121,47,0.25)' }

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

function EtapaBadge({ etapa }: { etapa: string }) {
  const c = ETAPA_COLORS[etapa] || DEFAULT_COLOR
  return (
    <span
      style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}
      className="px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap"
    >
      {etapa}
    </span>
  )
}

function TaskBar({ total, done }: { total: number; done: number }) {
  if (total === 0) return <span className="text-xs text-slate-500">Sin tareas</span>
  const pct = Math.round((done / total) * 100)
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-700 rounded-full min-w-[60px]">
        <div
          className="h-1.5 rounded-full transition-all"
          style={{
            width: `${pct}%`,
            background: pct === 100 ? '#22c55e' : '#E8792F',
          }}
        />
      </div>
      <span className="text-xs text-slate-400 tabular-nums">{done}/{total}</span>
    </div>
  )
}

function Initials({ names }: { names: string[] }) {
  if (!names || names.length === 0) return null
  return (
    <div className="flex -space-x-1">
      {names.slice(0, 3).map((name, i) => (
        <div
          key={i}
          title={name}
          className="w-6 h-6 rounded-full bg-slate-600 border border-slate-900 flex items-center justify-center text-[10px] font-bold text-slate-200"
        >
          {name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
        </div>
      ))}
      {names.length > 3 && (
        <div className="w-6 h-6 rounded-full bg-slate-700 border border-slate-900 flex items-center justify-center text-[10px] text-slate-400">
          +{names.length - 3}
        </div>
      )}
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
      .then(data => {
        setProjects(Array.isArray(data) ? data : [])
        setLoading(false)
      })
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

    // Optimistic update
    setProjects(prev => prev.map(p =>
      p.id === project.id ? { ...p, etapas: [newEtapa] } : p
    ))

    try {
      const res = await fetch('/api/notion/update-status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notion_project_id: project.id, etapas: [newEtapa] }),
      })
      if (!res.ok) throw new Error('Update failed')
    } catch {
      // Revert on error
      setProjects(prev => prev.map(p =>
        p.id === project.id ? { ...p, etapas: project.etapas } : p
      ))
    } finally {
      setUpdatingId(null)
    }
  }, [])

  const getProjectHref = (project: Project) =>
    project.project_id ? `/admin/proyectos/${project.project_id}` : null

  // ── KANBAN VIEW ──────────────────────────────────────────────────────────────

  const KanbanView = () => {
    const columnsWithProjects = ALL_ETAPAS
      .map(etapa => ({
        etapa,
        projects: filteredProjects.filter(p => (p.etapas?.[0] || '') === etapa),
      }))
      .filter(col => col.projects.length > 0)

    const noEtapa = filteredProjects.filter(p => !p.etapas || p.etapas.length === 0)

    return (
      <div className="flex gap-4 overflow-x-auto pb-6" style={{ minHeight: '60vh' }}>
        {columnsWithProjects.map(col => {
          const c = ETAPA_COLORS[col.etapa] || DEFAULT_COLOR
          return (
            <div key={col.etapa} className="flex-shrink-0 w-72">
              {/* Column header */}
              <div
                className="mb-3 px-3 py-2 rounded-lg flex items-center gap-2"
                style={{ background: c.bg, border: `1px solid ${c.border}` }}
              >
                <span style={{ color: c.text }} className="text-xs font-semibold flex-1 leading-tight">
                  {col.etapa}
                </span>
                <span className="bg-slate-900/40 text-slate-300 text-xs px-2 py-0.5 rounded-full font-medium">
                  {col.projects.length}
                </span>
              </div>
              {/* Cards */}
              <div className="flex flex-col gap-3">
                {col.projects.map(project => {
                  const etapaIdx = ALL_ETAPAS.indexOf(col.etapa)
                  const isUpdating = updatingId === project.id
                  const href = getProjectHref(project)
                  return (
                    <div
                      key={project.id}
                      className={`bg-slate-800 border rounded-xl p-4 transition-all ${
                        isUpdating
                          ? 'opacity-50 border-slate-700'
                          : 'border-slate-700 hover:border-slate-500'
                      }`}
                    >
                      {/* Project name */}
                      {href ? (
                        <Link href={href} className="block text-sm font-semibold text-white mb-2 hover:text-orange-400 transition-colors leading-snug">
                          {project.nombre}
                        </Link>
                      ) : (
                        <p className="text-sm font-semibold text-white mb-2 leading-snug">{project.nombre}</p>
                      )}

                      {/* Estado badge */}
                      {project.estado && (
                        <div className="mb-2">
                          <span className="text-xs px-2 py-0.5 rounded bg-slate-700 text-slate-300">
                            {project.estado}
                          </span>
                        </div>
                      )}

                      {/* Task progress */}
                      <div className="mb-3">
                        <TaskBar total={project.taskStats.total} done={project.taskStats.done} />
                      </div>

                      {/* KPIs */}
                      {project.kpis.length > 0 && (
                        <div className="mb-3">
                          <span className="text-xs bg-orange-500/10 text-orange-400 border border-orange-500/20 px-2 py-0.5 rounded">
                            📊 {project.kpis.length} KPI{project.kpis.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                      )}

                      {/* Footer */}
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-700/50">
                        <Initials names={project.responsable || []} />
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleMoveEtapa(project, 'prev')}
                            disabled={etapaIdx <= 0 || isUpdating}
                            title="Etapa anterior"
                            className="w-7 h-7 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-slate-300 text-sm transition-colors"
                          >
                            ←
                          </button>
                          <button
                            onClick={() => handleMoveEtapa(project, 'next')}
                            disabled={etapaIdx >= ALL_ETAPAS.length - 1 || isUpdating}
                            title="Siguiente etapa"
                            className="w-7 h-7 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-slate-300 text-sm transition-colors"
                          >
                            →
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}

        {/* Sin etapa column */}
        {noEtapa.length > 0 && (
          <div className="flex-shrink-0 w-72">
            <div className="mb-3 px-3 py-2 rounded-lg flex items-center gap-2 bg-slate-800 border border-slate-700">
              <span className="text-xs font-semibold text-slate-400 flex-1">Sin etapa</span>
              <span className="bg-slate-700 text-slate-300 text-xs px-2 py-0.5 rounded-full">{noEtapa.length}</span>
            </div>
            <div className="flex flex-col gap-3">
              {noEtapa.map(project => {
                const href = getProjectHref(project)
                return (
                  <div key={project.id} className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                    {href ? (
                      <Link href={href} className="block text-sm font-semibold text-white mb-2 hover:text-orange-400">
                        {project.nombre}
                      </Link>
                    ) : (
                      <p className="text-sm font-semibold text-white mb-2">{project.nombre}</p>
                    )}
                    <TaskBar total={project.taskStats.total} done={project.taskStats.done} />
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── TABLE VIEW ───────────────────────────────────────────────────────────────

  const TableView = () => (
    <div className="overflow-x-auto rounded-xl border border-slate-700">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-700 bg-slate-800/60">
            <th className="text-left px-4 py-3 text-slate-400 font-medium">Proyecto</th>
            <th className="text-left px-4 py-3 text-slate-400 font-medium">Etapa</th>
            <th className="text-left px-4 py-3 text-slate-400 font-medium">Estado</th>
            <th className="text-left px-4 py-3 text-slate-400 font-medium">Plan</th>
            <th className="text-left px-4 py-3 text-slate-400 font-medium">Responsable</th>
            <th className="text-left px-4 py-3 text-slate-400 font-medium w-40">Tareas</th>
            <th className="text-left px-4 py-3 text-slate-400 font-medium">KPIs</th>
            <th className="text-center px-4 py-3 text-slate-400 font-medium">Mover</th>
          </tr>
        </thead>
        <tbody>
          {filteredProjects.map(project => {
            const currentEtapa = project.etapas?.[0] || ''
            const etapaIdx = ALL_ETAPAS.indexOf(currentEtapa)
            const isUpdating = updatingId === project.id
            const href = getProjectHref(project)
            return (
              <tr
                key={project.id}
                className={`border-b border-slate-700/50 transition-colors ${
                  isUpdating ? 'opacity-50' : 'hover:bg-slate-800/40'
                }`}
              >
                <td className="px-4 py-3 max-w-[220px]">
                  {href ? (
                    <Link href={href} className="font-medium text-white hover:text-orange-400 transition-colors line-clamp-2">
                      {project.nombre}
                    </Link>
                  ) : (
                    <span className="font-medium text-white">{project.nombre}</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {currentEtapa
                    ? <EtapaBadge etapa={currentEtapa} />
                    : <span className="text-slate-500 text-xs">—</span>}
                </td>
                <td className="px-4 py-3">
                  {project.estado
                    ? <span className="text-xs px-2 py-0.5 rounded bg-slate-700 text-slate-300">{project.estado}</span>
                    : <span className="text-slate-500 text-xs">—</span>}
                </td>
                <td className="px-4 py-3 text-slate-400 text-xs">{project.plan_type || '—'}</td>
                <td className="px-4 py-3">
                  <Initials names={project.responsable || []} />
                </td>
                <td className="px-4 py-3">
                  <TaskBar total={project.taskStats.total} done={project.taskStats.done} />
                </td>
                <td className="px-4 py-3">
                  {project.kpis.length > 0
                    ? <span className="text-xs text-orange-400">📊 {project.kpis.length}</span>
                    : <span className="text-slate-500 text-xs">—</span>}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1 justify-center">
                    <button
                      onClick={() => handleMoveEtapa(project, 'prev')}
                      disabled={etapaIdx <= 0 || isUpdating}
                      title="Etapa anterior"
                      className="w-7 h-7 rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-slate-300 text-sm transition-colors"
                    >
                      ←
                    </button>
                    <button
                      onClick={() => handleMoveEtapa(project, 'next')}
                      disabled={etapaIdx >= ALL_ETAPAS.length - 1 || isUpdating}
                      title="Siguiente etapa"
                      className="w-7 h-7 rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-slate-300 text-sm transition-colors"
                    >
                      →
                    </button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {filteredProjects.length === 0 && !loading && (
        <div className="text-center py-16 text-slate-500">No se encontraron proyectos</div>
      )}
    </div>
  )

  // ── RENDER ───────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="max-w-screen-2xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex flex-wrap items-center gap-4 mb-8">
          <Link href="/admin" className="text-slate-400 hover:text-white text-sm transition-colors flex items-center gap-1">
            ← Dashboard
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-white">PM Board 📊</h1>
            <p className="text-slate-400 text-sm mt-0.5">
              {loading ? 'Cargando...' : `${filteredProjects.length} proyectos`}
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <input
            type="text"
            placeholder="Buscar proyecto..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-orange-500/50 w-64 transition-colors"
          />
          <div className="flex bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
            <button
              onClick={() => setView('kanban')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                view === 'kanban' ? 'bg-orange-500 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              🗂 Kanban
            </button>
            <button
              onClick={() => setView('table')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                view === 'table' ? 'bg-orange-500 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              📋 Tabla
            </button>
          </div>
          {search && (
            <button
              onClick={() => setSearch('')}
              className="text-xs text-slate-400 hover:text-white transition-colors"
            >
              ✕ Limpiar
            </button>
          )}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-24 text-slate-400 gap-3">
            <div className="w-5 h-5 border-2 border-slate-600 border-t-orange-500 rounded-full animate-spin" />
            Cargando proyectos...
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
