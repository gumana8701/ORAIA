'use client'
import { useState, useEffect, useRef } from 'react'

interface NotionProject {
  id: string
  nombre: string
  estado: string
  etapas: string[]
  responsable: string[]
  resp_chatbot: string[]
  resp_voz: string[]
  plan_type: string
  plan_pagos: string
  lanzamiento_real: string | null
  testeo_inicia: string | null
  kick_off_date: string | null
  es_chatbot: boolean
  info_util: string | null
  notion_url: string | null
  cantidad_contratada: number | null
  saldo_pendiente: number | null
}

interface NotionTask {
  id: string
  task_text: string
  checked: boolean
  section: string
  position: number
}

interface TaskStats {
  total: number
  completed: number
  pending: number
  pct: number
}

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

const DEFAULT_ETAPA_COLOR = { bg: 'rgba(232,121,47,0.10)', text: '#E8792F', border: 'rgba(232,121,47,0.25)' }

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

const ALL_ESTADOS = [
  'Sin empezar',
  'Sesion 1 Completada',
  'Sesion 2 Completada',
  'Sesion 3 Completada',
  'Sesion 4 Completada',
  'Sesion 5 Completada',
  'Sesion 6 Completada',
  'Sesion 7 Completada',
  'Sesion 8 Completada',
  'Listo',
]

function EtapaBadge({ etapa }: { etapa: string }) {
  const c = ETAPA_COLORS[etapa] || DEFAULT_ETAPA_COLOR
  return (
    <span style={{
      display: 'inline-block', fontSize: '11px', padding: '2px 8px', borderRadius: '6px',
      background: c.bg, color: c.text, border: `1px solid ${c.border}`, fontWeight: 600,
      marginRight: '4px', marginBottom: '4px',
    }}>{etapa}</span>
  )
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/El_Salvador' })
}

// ── Etapa selector dropdown ────────────────────────────────────────────────────
function EtapaSelector({
  notionProjectId, currentEtapas, onSaved
}: {
  notionProjectId: string
  currentEtapas: string[]
  onSaved: (newEtapas: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<string[]>(currentEtapas)
  const [saving, setSaving] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const toggle = (etapa: string) => {
    setSelected(prev => prev.includes(etapa) ? prev.filter(e => e !== etapa) : [...prev, etapa])
  }

  const save = async () => {
    setSaving(true)
    try {
      await fetch('/api/notion/update-status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notion_project_id: notionProjectId, etapas: selected })
      })
      onSaved(selected)
      setOpen(false)
    } finally {
      setSaving(false)
    }
  }

  const c = selected.length > 0 ? (ETAPA_COLORS[selected[0]] || DEFAULT_ETAPA_COLOR) : DEFAULT_ETAPA_COLOR

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button onClick={() => setOpen(!open)} style={{
        display: 'flex', alignItems: 'center', gap: '6px',
        background: c.bg, border: `1px solid ${c.border}`, borderRadius: '8px',
        padding: '5px 10px', cursor: 'pointer', color: c.text, fontSize: '12px', fontWeight: 600,
      }}>
        {selected.length > 0 ? selected.map(e => e.split(' ')[0]).join(' ') || selected[0] : '+ Etapa'}
        <span style={{ fontSize: '10px', opacity: 0.7 }}>▼</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, zIndex: 100, minWidth: '260px',
          background: '#1a2035', border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '10px', padding: '8px', marginTop: '4px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        }}>
          <div style={{ fontSize: '10px', color: '#4a5568', padding: '2px 6px 6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Selecciona etapa(s)
          </div>
          <div style={{ maxHeight: '240px', overflowY: 'auto' }}>
            {ALL_ETAPAS.map(etapa => {
              const isActive = selected.includes(etapa)
              const ec = ETAPA_COLORS[etapa] || DEFAULT_ETAPA_COLOR
              return (
                <div key={etapa} onClick={() => toggle(etapa)} style={{
                  padding: '6px 8px', borderRadius: '6px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '8px',
                  background: isActive ? ec.bg : 'transparent',
                  marginBottom: '2px',
                }}>
                  <span style={{
                    width: '14px', height: '14px', borderRadius: '3px', flexShrink: 0,
                    border: `1px solid ${isActive ? ec.text : 'rgba(255,255,255,0.2)'}`,
                    background: isActive ? ec.text : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '9px', color: '#fff',
                  }}>{isActive ? '✓' : ''}</span>
                  <span style={{ fontSize: '12px', color: isActive ? ec.text : '#A0AEC0' }}>{etapa}</span>
                </div>
              )
            })}
          </div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '8px', marginTop: '4px', display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
            <button onClick={() => setOpen(false)} style={{
              fontSize: '11px', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer',
              background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#A0AEC0',
            }}>Cancelar</button>
            <button onClick={save} disabled={saving} style={{
              fontSize: '11px', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer',
              background: '#E8792F', border: 'none', color: '#fff', fontWeight: 700,
            }}>{saving ? '...' : 'Guardar'}</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Estado selector ────────────────────────────────────────────────────────────
function EstadoSelector({
  notionProjectId, currentEstado, onSaved
}: {
  notionProjectId: string
  currentEstado: string
  onSaved: (newEstado: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const select = async (estado: string) => {
    setSaving(true)
    try {
      await fetch('/api/notion/update-status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notion_project_id: notionProjectId, estado })
      })
      onSaved(estado)
      setOpen(false)
    } finally {
      setSaving(false)
    }
  }

  const isComplete = currentEstado === 'Listo'
  const isInProgress = currentEstado?.includes('Sesion')
  const badgeColor = isComplete ? '#22c55e' : isInProgress ? '#E8792F' : '#6b7280'

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button onClick={() => setOpen(!open)} style={{
        display: 'flex', alignItems: 'center', gap: '6px',
        background: `${badgeColor}15`, border: `1px solid ${badgeColor}35`,
        borderRadius: '8px', padding: '5px 10px', cursor: 'pointer', color: badgeColor, fontSize: '11px', fontWeight: 600,
      }}>
        {saving ? '...' : (currentEstado || 'Sin empezar')}
        <span style={{ fontSize: '9px', opacity: 0.7 }}>▼</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, zIndex: 100, minWidth: '200px',
          background: '#1a2035', border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '10px', padding: '6px', marginTop: '4px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        }}>
          {ALL_ESTADOS.map(estado => (
            <div key={estado} onClick={() => select(estado)} style={{
              padding: '7px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px',
              color: estado === currentEstado ? '#fff' : '#A0AEC0',
              background: estado === currentEstado ? 'rgba(232,121,47,0.15)' : 'transparent',
              fontWeight: estado === currentEstado ? 600 : 400,
            }}>
              {estado === 'Listo' ? '✅ ' : estado.includes('Sesion') ? '🔄 ' : '○ '}{estado}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function NotionTasksTab({ projectId }: { projectId: string }) {
  const [notionProject, setNotionProject] = useState<NotionProject | null>(null)
  const [tasks, setTasks] = useState<NotionTask[]>([])
  const [stats, setStats] = useState<TaskStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/notion?project_id=${projectId}`)
        const data = await res.json()
        setNotionProject(data.notion_project)
        setTasks(data.tasks || [])
        setStats(data.task_stats)
      } catch (e: any) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [projectId])

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '40px', color: '#A0AEC0', fontSize: '13px' }}>
      Cargando datos de Notion...
    </div>
  )

  if (error) return (
    <div style={{ textAlign: 'center', padding: '40px', color: '#ef4444', fontSize: '13px' }}>
      Error: {error}
    </div>
  )

  if (!notionProject) return (
    <div style={{
      textAlign: 'center', padding: '48px', color: '#6b7280', fontSize: '13px',
      background: 'rgba(17,24,39,0.85)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px'
    }}>
      <div style={{ fontSize: '32px', marginBottom: '12px' }}>📋</div>
      <p style={{ margin: 0, fontWeight: 600, color: '#A0AEC0' }}>Sin datos de Notion</p>
      <p style={{ margin: '6px 0 0', color: '#4a5568' }}>
        Este proyecto aún no está vinculado a un registro de Notion.
      </p>
    </div>
  )

  // Group tasks by section
  const sections: Record<string, NotionTask[]> = {}
  for (const t of tasks) {
    const s = t.section || 'General'
    if (!sections[s]) sections[s] = []
    sections[s].push(t)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Meta card */}
      <div style={{
        background: 'rgba(17,24,39,0.85)', border: '1px solid rgba(255,255,255,0.10)',
        borderRadius: '12px', padding: '20px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '16px' }}>📋</span>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#fff', margin: 0 }}>Notion Tracker</h3>
          </div>
          {notionProject.notion_url && (
            <a href={notionProject.notion_url} target="_blank" rel="noopener noreferrer"
              style={{ fontSize: '11px', color: '#E8792F', textDecoration: 'none', fontWeight: 600 }}>
              Abrir en Notion ↗
            </a>
          )}
        </div>

        {/* Etapas — editable */}
        <div style={{ marginBottom: '12px' }}>
          <span style={{ fontSize: '11px', color: '#4a5568', display: 'block', marginBottom: '6px' }}>
            Etapa de implementación
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <EtapaSelector
              notionProjectId={notionProject.id}
              currentEtapas={notionProject.etapas || []}
              onSaved={(newEtapas) => setNotionProject(prev => prev ? { ...prev, etapas: newEtapas } : prev)}
            />
            {notionProject.etapas?.slice(1).map(e => <EtapaBadge key={e} etapa={e} />)}
          </div>
        </div>

        {/* Grid de metadata */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '10px' }}>
          <div>
            <div style={{ fontSize: '10px', color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Sesiones</div>
            <EstadoSelector
              notionProjectId={notionProject.id}
              currentEstado={notionProject.estado || 'Sin empezar'}
              onSaved={(newEstado) => setNotionProject(prev => prev ? { ...prev, estado: newEstado } : prev)}
            />
          </div>
          <MetaItem label="Plan" value={notionProject.plan_type || '—'} />
          <MetaItem label="Responsable" value={notionProject.responsable?.join(', ') || '—'} />
          {notionProject.resp_chatbot?.length > 0 && (
            <MetaItem label="Resp. Chatbot" value={notionProject.resp_chatbot.join(', ')} />
          )}
          {notionProject.resp_voz?.length > 0 && (
            <MetaItem label="Resp. Voz" value={notionProject.resp_voz.join(', ')} />
          )}
          <MetaItem label="Kick-off" value={fmtDate(notionProject.kick_off_date)} />
          <MetaItem label="Testeo" value={fmtDate(notionProject.testeo_inicia)} />
          <MetaItem label="Lanzamiento" value={fmtDate(notionProject.lanzamiento_real)} />
          {notionProject.es_chatbot && <MetaItem label="Tipo" value="🤖 Chatbot" />}
          {notionProject.cantidad_contratada != null && (
            <MetaItem label="Contratado" value={`$${notionProject.cantidad_contratada.toLocaleString()}`} />
          )}
          {notionProject.saldo_pendiente != null && notionProject.saldo_pendiente > 0 && (
            <MetaItem label="Saldo pendiente" value={`$${notionProject.saldo_pendiente.toLocaleString()}`} accent />
          )}
        </div>

        {/* Info util */}
        {notionProject.info_util && (
          <div style={{
            marginTop: '14px', padding: '10px 14px', borderRadius: '8px',
            background: 'rgba(232,121,47,0.06)', border: '1px solid rgba(232,121,47,0.15)',
          }}>
            <span style={{ fontSize: '11px', color: '#E8792F', fontWeight: 600 }}>💡 Info útil</span>
            <p style={{ fontSize: '12px', color: '#cbd5e0', margin: '4px 0 0', lineHeight: 1.5 }}>
              {notionProject.info_util}
            </p>
          </div>
        )}
      </div>

      {/* Tasks progress */}
      {stats && stats.total > 0 && (
        <div style={{
          background: 'rgba(17,24,39,0.85)', border: '1px solid rgba(255,255,255,0.10)',
          borderRadius: '12px', padding: '20px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#fff', margin: 0 }}>
              Checklist de Operaciones
            </h3>
            <span style={{ fontSize: '12px', color: '#A0AEC0', fontWeight: 500 }}>
              {stats.completed}/{stats.total} completadas ({stats.pct}%)
            </span>
          </div>

          {/* Progress bar */}
          <div style={{
            width: '100%', height: '6px', borderRadius: '3px',
            background: 'rgba(255,255,255,0.06)', marginBottom: '16px', overflow: 'hidden',
          }}>
            <div style={{
              width: `${stats.pct}%`, height: '100%', borderRadius: '3px',
              background: stats.pct === 100 ? '#22c55e' : '#E8792F',
              transition: 'width 0.3s ease',
            }} />
          </div>

          {/* Tasks by section */}
          {Object.entries(sections).map(([section, sectionTasks]) => (
            <div key={section} style={{ marginBottom: '12px' }}>
              {Object.keys(sections).length > 1 && (
                <div style={{
                  fontSize: '11px', fontWeight: 700, color: '#4a5568',
                  textTransform: 'uppercase', letterSpacing: '0.05em',
                  marginBottom: '6px', paddingBottom: '4px',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                }}>{section}</div>
              )}
              {sectionTasks.map(t => (
                <div key={t.id} style={{
                  display: 'flex', alignItems: 'flex-start', gap: '8px',
                  padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.03)',
                }}>
                  <span style={{
                    fontSize: '14px', flexShrink: 0, marginTop: '1px',
                    opacity: t.checked ? 0.5 : 1,
                  }}>
                    {t.checked ? '☑️' : '☐'}
                  </span>
                  <span style={{
                    fontSize: '13px', color: t.checked ? '#4a5568' : '#cbd5e0',
                    textDecoration: t.checked ? 'line-through' : 'none',
                    lineHeight: 1.5,
                  }}>
                    {t.task_text}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function MetaItem({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: '10px', color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>
        {label}
      </div>
      <div style={{ fontSize: '13px', color: accent ? '#f59e0b' : '#cbd5e0', fontWeight: 500 }}>
        {value}
      </div>
    </div>
  )
}
