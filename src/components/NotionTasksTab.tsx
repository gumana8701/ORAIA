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
  plan_type: string | null
  plan_pagos: string | null
  lanzamiento_real: string | null
  testeo_inicia: string | null
  kick_off_date: string | null
  es_chatbot: boolean
  info_util: string | null
  notion_url: string | null
  cantidad_contratada: number | null
  saldo_pendiente: number | null
  contact_email: string | null
  contact_phone: string | null
  created_time: string | null
  last_edited_time: string | null
}

interface NotionTask {
  id: string
  task_text: string
  checked: boolean
  section: string
  position: number
  created_time: string | null
  last_edited_time: string | null
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

// ── Etapa selector dropdown (single select) ───────────────────────────────────
function EtapaSelector({
  notionProjectId, currentEtapas, onSaved
}: {
  notionProjectId: string
  currentEtapas: string[]
  onSaved: (newEtapas: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = currentEtapas[0] || null

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const select = async (etapa: string) => {
    if (saving) return
    setSaving(true)
    try {
      await fetch('/api/notion/update-status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notion_project_id: notionProjectId, etapas: [etapa] })
      })
      onSaved([etapa])
      setOpen(false)
    } finally {
      setSaving(false)
    }
  }

  const c = current ? (ETAPA_COLORS[current] || DEFAULT_ETAPA_COLOR) : { bg: 'rgba(255,255,255,0.06)', text: '#6b7280', border: 'rgba(255,255,255,0.12)' }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(!open)} style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        background: c.bg, border: `1px solid ${c.border}`, borderRadius: '8px',
        padding: '7px 12px', cursor: 'pointer', color: c.text, fontSize: '13px', fontWeight: 600,
        maxWidth: '280px', textAlign: 'left',
      }}>
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {saving ? 'Guardando...' : (current || 'Sin etapa')}
        </span>
        <span style={{ fontSize: '10px', opacity: 0.6, flexShrink: 0 }}>▼</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 100, width: '280px',
          background: '#1a2035', border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '10px', padding: '6px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        }}>
          <div style={{ fontSize: '10px', color: '#4a5568', padding: '2px 8px 6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Etapa de implementación
          </div>
          <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
            {ALL_ETAPAS.map(etapa => {
              const isActive = etapa === current
              const ec = ETAPA_COLORS[etapa] || DEFAULT_ETAPA_COLOR
              return (
                <div key={etapa} onClick={() => select(etapa)} style={{
                  padding: '8px 10px', borderRadius: '6px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '8px',
                  background: isActive ? ec.bg : 'transparent',
                  marginBottom: '1px', transition: 'background 0.1s',
                }}>
                  <span style={{
                    width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
                    background: isActive ? ec.text : 'rgba(255,255,255,0.15)',
                  }}/>
                  <span style={{ fontSize: '13px', color: isActive ? ec.text : '#A0AEC0', fontWeight: isActive ? 600 : 400 }}>
                    {etapa}
                  </span>
                </div>
              )
            })}
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

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null
  const diff = Date.now() - new Date(dateStr).getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

function fmtRelative(dateStr: string | null): string {
  if (!dateStr) return '—'
  const days = daysSince(dateStr)!
  if (days === 0) return 'Hoy'
  if (days === 1) return 'Ayer'
  if (days < 7) return `Hace ${days} días`
  if (days < 30) return `Hace ${Math.floor(days / 7)} sem`
  if (days < 365) return `Hace ${Math.floor(days / 30)} meses`
  return `Hace ${Math.floor(days / 365)} años`
}

export default function NotionTasksTab({ projectId }: { projectId: string }) {
  const [notionProject, setNotionProject] = useState<NotionProject | null>(null)
  const [tasks, setTasks] = useState<NotionTask[]>([])
  const [stats, setStats] = useState<TaskStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  useEffect(() => { load() }, [projectId])

  async function handleSync() {
    if (!notionProject) return
    setSyncing(true)
    try {
      await fetch('/api/notion/sync-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notion_page_id: notionProject.id }),
      })
      // Reload data
      setLoading(true)
      await load()
    } finally {
      setSyncing(false)
    }
  }

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
            {notionProject.last_edited_time && (
              <span style={{ fontSize: '10px', color: '#4a5568', fontWeight: 400 }}>
                · Actualizado {fmtRelative(notionProject.last_edited_time)}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {notionProject.notion_url && (
              <a href={notionProject.notion_url} target="_blank" rel="noopener noreferrer"
                style={{ fontSize: '11px', color: '#E8792F', textDecoration: 'none', fontWeight: 600 }}>
                Abrir en Notion ↗
              </a>
            )}
            <button
              onClick={handleSync}
              disabled={syncing}
              style={{
                fontSize: '11px', fontWeight: 600, padding: '4px 10px', borderRadius: '6px',
                background: 'rgba(232,121,47,0.10)', border: '1px solid rgba(232,121,47,0.25)',
                color: '#E8792F', cursor: syncing ? 'not-allowed' : 'pointer', opacity: syncing ? 0.6 : 1,
              }}>
              {syncing ? '⟳ Sincronizando...' : '⟳ Sync Notion'}
            </button>
          </div>
        </div>

        {/* Etapas — editable */}
        <div style={{ marginBottom: '12px' }}>
          <span style={{ fontSize: '11px', color: '#4a5568', display: 'block', marginBottom: '6px' }}>
            Etapa de implementación
          </span>
          <EtapaSelector
            notionProjectId={notionProject.id}
            currentEtapas={notionProject.etapas || []}
            onSaved={(newEtapas) => setNotionProject(prev => prev ? { ...prev, etapas: newEtapas } : prev)}
          />
        </div>

        {/* Grid de metadata — solo campos con datos */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '10px' }}>
          {/* Estado/Sesiones — siempre visible */}
          <div>
            <div style={{ fontSize: '10px', color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Sesiones</div>
            <EstadoSelector
              notionProjectId={notionProject.id}
              currentEstado={notionProject.estado || 'Sin empezar'}
              onSaved={(newEstado) => setNotionProject(prev => prev ? { ...prev, estado: newEstado } : prev)}
            />
          </div>

          {/* Responsable — siempre visible */}
          {notionProject.responsable?.length > 0 && (
            <MetaItem label="Responsable" value={notionProject.responsable.join(', ')} />
          )}

          {/* Plan */}
          {notionProject.plan_type && (
            <MetaItem label="Plan" value={notionProject.plan_type} />
          )}
          {notionProject.plan_pagos && (
            <MetaItem label="Plan pagos" value={notionProject.plan_pagos} />
          )}

          {/* Equipo */}
          {notionProject.resp_chatbot?.length > 0 && (
            <MetaItem label="Resp. Chatbot" value={notionProject.resp_chatbot.join(', ')} />
          )}
          {notionProject.resp_voz?.length > 0 && (
            <MetaItem label="Resp. Voz" value={notionProject.resp_voz.join(', ')} />
          )}

          {/* Fechas clave */}
          {notionProject.kick_off_date && (
            <MetaItem label="Kick-off" value={fmtDate(notionProject.kick_off_date)} />
          )}
          {notionProject.testeo_inicia && (
            <MetaItem label="Inicio testeo" value={fmtDate(notionProject.testeo_inicia)} />
          )}
          {notionProject.lanzamiento_real && (
            <MetaItem label="Lanzamiento" value={fmtDate(notionProject.lanzamiento_real)} />
          )}

          {/* Tipo */}
          {notionProject.es_chatbot && (
            <MetaItem label="Tipo" value="🤖 Chatbot" />
          )}

          {/* Financiero */}
          {notionProject.cantidad_contratada != null && (
            <MetaItem label="Contratado" value={`$${notionProject.cantidad_contratada.toLocaleString()}`} />
          )}
          {notionProject.saldo_pendiente != null && notionProject.saldo_pendiente > 0 && (
            <MetaItem label="Saldo pendiente" value={`$${notionProject.saldo_pendiente.toLocaleString()}`} accent />
          )}

          {/* Contacto */}
          {notionProject.contact_email && (
            <MetaItem label="Email cliente" value={notionProject.contact_email} />
          )}
          {notionProject.contact_phone && (
            <MetaItem label="Tel. cliente" value={notionProject.contact_phone} />
          )}
        </div>

        {/* Tiempo KPIs */}
        {(notionProject.created_time || notionProject.last_edited_time) && (
          <div style={{
            display: 'flex', gap: '16px', flexWrap: 'wrap',
            marginTop: '14px', paddingTop: '14px',
            borderTop: '1px solid rgba(255,255,255,0.05)',
          }}>
            {notionProject.created_time && (
              <div>
                <div style={{ fontSize: '10px', color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '3px' }}>
                  En Notion desde
                </div>
                <div style={{ fontSize: '12px', color: '#cbd5e0' }}>
                  {fmtDate(notionProject.created_time)} · <span style={{ color: '#6b7280' }}>{fmtRelative(notionProject.created_time)}</span>
                </div>
              </div>
            )}
            {notionProject.last_edited_time && (
              <div>
                <div style={{ fontSize: '10px', color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '3px' }}>
                  Última edición Notion
                </div>
                <div style={{ fontSize: '12px', color: '#cbd5e0' }}>
                  {fmtDate(notionProject.last_edited_time)} · <span style={{ color: daysSince(notionProject.last_edited_time)! > 14 ? '#f59e0b' : '#6b7280' }}>{fmtRelative(notionProject.last_edited_time)}</span>
                </div>
              </div>
            )}
            {notionProject.created_time && (
              <div>
                <div style={{ fontSize: '10px', color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '3px' }}>
                  Días en proyecto
                </div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#E8792F' }}>
                  {daysSince(notionProject.created_time)} días
                </div>
              </div>
            )}
          </div>
        )}

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
