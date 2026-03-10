import { createClient } from '@supabase/supabase-js'
import { Suspense } from 'react'
import ProjectCard from '@/components/ProjectCard'
import ProjectFilters from '@/components/ProjectFilters'
import AIDigest72h from '@/components/AIDigest72h'
import { Proyecto } from '@/lib/types'
import { getSessionProfile, getAllowedProjectIds } from '@/lib/auth'

async function getData() {
  const profile = await getSessionProfile()
  const allowedIds = await getAllowedProjectIds(profile)

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string
  )

  // Build project query with role-based filter
  let projQuery = supabase.from('projects').select('*').order('ultima_actividad', { ascending: false, nullsFirst: false })
  if (allowedIds !== null) {
    projQuery = allowedIds.length > 0
      ? projQuery.in('id', allowedIds)
      : projQuery.eq('id', '00000000-0000-0000-0000-000000000000') // empty result
  }

  const [projRes, msgRes, pdRes, devRes] = await Promise.all([
    projQuery,
    supabase.from('messages').select('*', { count: 'exact', head: true }).gte('timestamp', new Date().toISOString().slice(0, 10)),
    supabase.from('project_developers').select('project_id, developer:developers(id,nombre,emoji,color,es_supervisor)'),
    supabase.from('developers').select('*').eq('activo', true).order('nombre'),
  ])

  const devsByProject: Record<string, any[]> = {}
  for (const row of pdRes.data ?? []) {
    if (!devsByProject[row.project_id]) devsByProject[row.project_id] = []
    if (row.developer) devsByProject[row.project_id].push(row.developer)
  }

  // Add "Sin asignar" sentinel for the picker
  const allDevs = [
    { id: null, nombre: 'Sin asignar', emoji: '➕', color: '#334155', activo: true },
    ...(devRes.data ?? []),
  ]

  return {
    proyectos: (projRes.data ?? []) as Proyecto[],
    mensajesHoy: msgRes.count ?? 0,
    devsByProject,
    allDevs,
    profile,
  }
}

const ROL_GREETING: Record<string, string> = {
  admin:          '👑 Vista completa',
  supervisor:     '🔭 Vista de equipo',
  client_success: '🤝 Client Success',
  cs_user:        '👤 Mi vista',
  developer:      '💻 Mis proyectos',
}

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; color?: string; dev?: string }>
}) {
  const { proyectos, mensajesHoy, devsByProject, allDevs, profile } = await getData()
  const { q = '', status = '', color = '', dev = '' } = await searchParams

  let filtered = proyectos
  if (q)      filtered = filtered.filter(p => p.nombre.toLowerCase().includes(q.toLowerCase()))
  if (status) filtered = filtered.filter(p => p.estado === status)
  if (color)  filtered = filtered.filter(p => p.color_emoji === color)
  if (dev)    filtered = filtered.filter(p => (devsByProject[p.id] ?? []).some((d: any) => d.nombre === dev))

  const activos      = proyectos.filter(p => p.estado === 'activo').length
  const enRiesgo     = proyectos.filter(p => p.estado === 'en_riesgo').length
  const totalAlertas = proyectos.reduce((acc, p) => acc + (p.alertas_count ?? 0), 0)
  const enRiesgoFiltered = filtered.filter(p => p.estado === 'en_riesgo')
  const restoFiltered    = filtered.filter(p => p.estado !== 'en_riesgo')
  const isFiltering      = !!(q || status || color || dev)

  const stats = [
    { label: 'Activos',       value: activos,      sub: 'en curso',        color: '#E8792F', icon: '🟠' },
    { label: 'En Riesgo',     value: enRiesgo,     sub: 'requieren atención', color: '#ef4444', icon: '🔴' },
    { label: 'Alertas',       value: totalAlertas, sub: 'sin resolver',    color: '#f59e0b', icon: '⚠️' },
    { label: 'Msgs Hoy',      value: mensajesHoy,  sub: 'actividad hoy',   color: '#3b82f6', icon: '💬' },
  ]

  return (
    <div style={{ position: 'relative' }}>

      {/* Atmospheric orange halo — top right */}
      <div style={{
        position: 'absolute', top: '-60px', right: '-40px',
        width: '400px', height: '300px',
        background: 'radial-gradient(ellipse, rgba(232,121,47,0.07) 0%, transparent 70%)',
        pointerEvents: 'none', filter: 'blur(40px)', zIndex: 0,
      }}/>

      {/* Header */}
      <div style={{ marginBottom: '28px', position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
          <h1 className="headline headline-gradient" style={{ margin: 0 }}>
            Proyectos
          </h1>
          <span style={{
            fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '6px',
            background: 'rgba(232,121,47,0.10)', color: '#E8792F',
            border: '1px solid rgba(232,121,47,0.20)',
            letterSpacing: '0.03em',
          }}>
            {ROL_GREETING[profile.rol] ?? profile.rol} · {profile.nombre}
          </span>
        </div>
        <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>
          Vista en tiempo real · {proyectos.length} proyecto{proyectos.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Stats row */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px',
        marginBottom: '28px', position: 'relative', zIndex: 1,
      }}>
        {stats.map(stat => (
          <div key={stat.label} className="stat-card" style={{ borderColor: `${stat.color}18` }}>
            {/* Icon + number */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
              <span style={{ fontSize: '22px' }}>{stat.icon}</span>
              <span style={{
                fontSize: '28px', fontWeight: 800, color: stat.color,
                lineHeight: 1, letterSpacing: '-0.02em',
              }}>{stat.value}</span>
            </div>
            <p style={{ fontSize: '12px', fontWeight: 600, color: '#e2e8f0', margin: '0 0 2px' }}>{stat.label}</p>
            <p style={{ fontSize: '10px', color: '#475569', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{stat.sub}</p>
            {/* Bottom color line */}
            <div style={{
              position: 'absolute', bottom: 0, left: '20%', right: '20%', height: '2px',
              background: `linear-gradient(90deg, transparent, ${stat.color}50, transparent)`,
              borderRadius: '2px',
            }}/>
          </div>
        ))}
      </div>

      {/* AI Digest — últimas 72h */}
      <Suspense fallback={null}>
        <AIDigest72h />
      </Suspense>

      {/* Filters */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        <Suspense>
          <ProjectFilters devsByProject={devsByProject} />
        </Suspense>
      </div>

      {/* Results count */}
      {isFiltering && (
        <p style={{ fontSize: '12px', color: '#475569', marginBottom: '16px' }}>
          {filtered.length} resultado{filtered.length !== 1 ? 's' : ''}
          {q && <span> · búsqueda: <strong style={{ color: '#94a3b8' }}>"{q}"</strong></span>}
        </p>
      )}

      {/* En Riesgo section */}
      {!status && enRiesgoFiltered.length > 0 && (
        <div style={{ marginBottom: '32px', position: 'relative', zIndex: 1 }}>
          {/* Section header */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            marginBottom: '14px', paddingBottom: '10px',
            borderBottom: '1px solid rgba(239,68,68,0.15)',
          }}>
            <div style={{
              width: '6px', height: '6px', borderRadius: '50%',
              background: '#ef4444', boxShadow: '0 0 8px rgba(239,68,68,0.8)',
            }}/>
            <h2 style={{ fontSize: '13px', fontWeight: 700, color: '#f87171', margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              En Riesgo — {enRiesgoFiltered.length} proyecto{enRiesgoFiltered.length > 1 ? 's' : ''}
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: '14px' }}>
            {enRiesgoFiltered.map(p => (
              <ProjectCard key={p.id} proyecto={p} developers={devsByProject[p.id] ?? []} allDevs={allDevs} />
            ))}
          </div>
        </div>
      )}

      {/* All projects */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          marginBottom: '14px', paddingBottom: '10px',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
        }}>
          <h2 style={{ fontSize: '13px', fontWeight: 700, color: '#94a3b8', margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {status
              ? status === 'en_riesgo' ? 'En Riesgo'
                : status.charAt(0).toUpperCase() + status.slice(1)
              : 'Todos los Proyectos'}
          </h2>
          <span style={{
            fontSize: '10px', padding: '2px 7px', borderRadius: '4px',
            background: 'rgba(255,255,255,0.05)', color: '#475569',
            border: '1px solid rgba(255,255,255,0.06)', fontWeight: 600,
          }}>
            {isFiltering ? filtered.length : proyectos.length}
          </span>
        </div>

        {filtered.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '60px',
            background: 'rgba(17,24,39,0.5)', backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.06)', borderRadius: '14px',
          }}>
            <p style={{ fontSize: '28px', marginBottom: '10px' }}>🔍</p>
            <p style={{ fontWeight: 600, color: '#e2e8f0', marginBottom: '4px' }}>Sin resultados</p>
            <p style={{ fontSize: '12px', color: '#475569' }}>Prueba con otro término o quita los filtros.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: '14px' }}>
            {(status === 'en_riesgo' ? enRiesgoFiltered : restoFiltered).map(p => (
              <ProjectCard key={p.id} proyecto={p} developers={devsByProject[p.id] ?? []} allDevs={allDevs} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
