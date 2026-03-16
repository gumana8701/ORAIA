'use client'
import { useState, useMemo } from 'react'

interface NotionProject {
  id: string
  nombre: string
  etapas: string[] | null
  estado: string | null
  project_id: string | null
  whatsapp_group_id: string | null
  plan_type: string | null
  lanzamiento_real: string | null
}

interface SupabaseProject {
  id: string
  nombre: string
  estado: string
  color_emoji: string | null
}

const ETAPA_COLOR: Record<string, string> = {
  '🔵Soporte activo': '#3b82f6',
  '🟢4. Lanzamiento': '#22c55e',
  '🟣3. Cliente testeando': '#a855f7',
  '🟡2. Creación del agente': '#eab308',
  '🔴 1. Incorporación': '#ef4444',
  'On Hold': '#6b7280',
  'Termino soporte': '#6b7280',
}

export default function NotionLinkClient({
  notionProjects,
  supabaseProjects,
}: {
  notionProjects: NotionProject[]
  supabaseProjects: SupabaseProject[]
}) {
  const [links, setLinks] = useState<Record<string, string | null>>(() => {
    const init: Record<string, string | null> = {}
    for (const np of notionProjects) init[np.id] = np.project_id
    return init
  })
  const [saving, setSaving] = useState<string | null>(null)
  const [saved, setSaved] = useState<Record<string, boolean>>({})
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'linked' | 'unlinked'>('all')

  // Build reverse map: project_id → list of notion names linked to it
  const linkedTo = useMemo(() => {
    const map: Record<string, string[]> = {}
    for (const np of notionProjects) {
      const pid = links[np.id]
      if (pid) {
        if (!map[pid]) map[pid] = []
        map[pid].push(np.nombre)
      }
    }
    return map
  }, [links, notionProjects])

  const spMap = useMemo(() => {
    const m: Record<string, SupabaseProject> = {}
    for (const sp of supabaseProjects) m[sp.id] = sp
    return m
  }, [supabaseProjects])

  const filtered = useMemo(() => {
    let list = notionProjects
    if (filter === 'linked') list = list.filter(np => links[np.id])
    if (filter === 'unlinked') list = list.filter(np => !links[np.id])
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(np => np.nombre.toLowerCase().includes(q))
    }
    // Sort: unlinked first
    return [...list].sort((a, b) => {
      const al = !!links[a.id], bl = !!links[b.id]
      if (al !== bl) return al ? 1 : -1
      return a.nombre.localeCompare(b.nombre)
    })
  }, [notionProjects, links, filter, search])

  const linkedCount = notionProjects.filter(np => links[np.id]).length
  const unlinkedCount = notionProjects.length - linkedCount

  async function saveLink(notionId: string, projectId: string | null) {
    setSaving(notionId)
    try {
      await fetch('/api/notion/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notion_project_id: notionId, project_id: projectId }),
      })
      setLinks(prev => ({ ...prev, [notionId]: projectId }))
      setSaved(prev => ({ ...prev, [notionId]: true }))
      setTimeout(() => setSaved(prev => ({ ...prev, [notionId]: false })), 2000)
    } finally {
      setSaving(null)
    }
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#fff', margin: '0 0 4px' }}>
          📋 Vincular Proyectos Notion
        </h1>
        <p style={{ fontSize: '13px', color: '#A0AEC0', margin: 0 }}>
          Conecta cada entrada de Notion con su proyecto en la webapp. Un proyecto puede tener múltiples entradas.
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {[
          { label: 'Total Notion', value: notionProjects.length, color: '#fff' },
          { label: '✅ Vinculados', value: linkedCount, color: '#22c55e' },
          { label: '⏳ Sin vincular', value: unlinkedCount, color: '#f59e0b' },
          { label: 'Proyectos webapp', value: supabaseProjects.length, color: '#3b82f6' },
        ].map(s => (
          <div key={s.label} style={{
            background: 'rgba(17,24,39,0.85)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '10px', padding: '12px 20px', textAlign: 'center',
          }}>
            <div style={{ fontSize: '22px', fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '11px', color: '#6b7280' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          placeholder="🔍 Buscar en Notion..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            flex: 1, minWidth: '200px', maxWidth: '320px',
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '8px', padding: '8px 12px', color: '#fff', fontSize: '13px',
            outline: 'none',
          }}
        />
        {(['all', 'linked', 'unlinked'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '7px 14px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer', fontWeight: 600,
            background: filter === f ? '#E8792F' : 'rgba(255,255,255,0.04)',
            color: filter === f ? '#fff' : '#A0AEC0',
            border: filter === f ? 'none' : '1px solid rgba(255,255,255,0.08)',
          }}>
            {f === 'all' ? `Todos (${notionProjects.length})` : f === 'linked' ? `✅ Vinculados (${linkedCount})` : `⏳ Sin vincular (${unlinkedCount})`}
          </button>
        ))}
      </div>

      {/* List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {filtered.map(np => {
          const isLinked = !!links[np.id]
          const linkedProject = links[np.id] ? spMap[links[np.id]!] : null
          const isSaving = saving === np.id
          const isSaved = saved[np.id]
          const etapa = np.etapas?.[0]
          const etapaColor = etapa ? (ETAPA_COLOR[etapa] || '#E8792F') : '#4a5568'

          return (
            <div key={np.id} style={{
              background: isLinked ? 'rgba(17,24,39,0.5)' : 'rgba(17,24,39,0.85)',
              border: `1px solid ${isLinked ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.08)'}`,
              borderRadius: '10px', padding: '12px 16px',
              display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap',
              opacity: isLinked ? 0.75 : 1,
              transition: 'opacity 0.2s',
            }}>
              {/* Notion project info */}
              <div style={{ flex: 1, minWidth: '220px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: isLinked ? '#718096' : '#fff' }}>
                    {np.nombre}
                  </span>
                  {etapa && (
                    <span style={{
                      fontSize: '10px', padding: '1px 6px', borderRadius: '4px',
                      background: `${etapaColor}18`, color: etapaColor,
                      border: `1px solid ${etapaColor}30`, fontWeight: 600,
                    }}>{etapa}</span>
                  )}
                  {np.plan_type && (
                    <span style={{ fontSize: '10px', color: '#4a5568' }}>{np.plan_type}</span>
                  )}
                </div>
                {isLinked && linkedProject && (
                  <div style={{ fontSize: '11px', color: '#22c55e', marginTop: '3px' }}>
                    ✅ Vinculado a: <strong>{linkedProject.color_emoji} {linkedProject.nombre}</strong>
                    {(linkedTo[links[np.id]!]?.length ?? 0) > 1 && (
                      <span style={{ color: '#3b82f6', marginLeft: '6px' }}>
                        ({linkedTo[links[np.id]!].length} entradas)
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Dropdown to link */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                <select
                  value={links[np.id] || ''}
                  onChange={e => saveLink(np.id, e.target.value || null)}
                  disabled={isSaving}
                  style={{
                    background: '#0d1220', border: `1px solid ${isLinked ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.12)'}`,
                    borderRadius: '8px', padding: '6px 10px', color: isLinked ? '#22c55e' : '#A0AEC0',
                    fontSize: '12px', cursor: 'pointer', maxWidth: '260px', minWidth: '180px',
                  }}
                >
                  <option value="">— Sin vincular —</option>
                  {supabaseProjects.map(sp => {
                    const othersLinked = (linkedTo[sp.id] || []).filter(name => name !== np.nombre)
                    const label = `${sp.color_emoji || ''} ${sp.nombre}${othersLinked.length > 0 ? ` [+${othersLinked.length}]` : ''}`
                    return (
                      <option key={sp.id} value={sp.id}>{label}</option>
                    )
                  })}
                </select>

                {isSaving && <span style={{ fontSize: '11px', color: '#E8792F' }}>⏳</span>}
                {isSaved && <span style={{ fontSize: '11px', color: '#22c55e' }}>✅</span>}
              </div>
            </div>
          )
        })}
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#4a5568', fontSize: '13px' }}>
          No hay resultados para "{search}"
        </div>
      )}
    </div>
  )
}
