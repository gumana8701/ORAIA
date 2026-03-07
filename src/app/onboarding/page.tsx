import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import { Proyecto, Developer, ProjectDeveloper } from '@/lib/types'

async function getData() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const [projRes, devRes, pdRes] = await Promise.all([
    sb.from('projects').select('*').order('ultima_actividad', { ascending: false, nullsFirst: false }),
    sb.from('developers').select('*').eq('activo', true).order('es_supervisor', { ascending: false }),
    sb.from('project_developers').select('*, developer:developers(*)'),
  ])
  return {
    proyectos: (projRes.data ?? []) as Proyecto[],
    developers: (devRes.data ?? []) as Developer[],
    assignments: (pdRes.data ?? []) as (ProjectDeveloper & { developer: Developer })[],
  }
}

export default async function OnboardingPage() {
  const { proyectos, developers, assignments } = await getData()

  // Map: project_id → list of developers
  const devsByProject: Record<string, Developer[]> = {}
  for (const a of assignments) {
    if (!devsByProject[a.project_id]) devsByProject[a.project_id] = []
    if (a.developer) devsByProject[a.project_id].push(a.developer as Developer)
  }

  const statusColor: Record<string, string> = {
    activo: '#22c55e', en_riesgo: '#ef4444', pausado: '#6b7280', completado: '#3b82f6'
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 800, background: 'linear-gradient(135deg, #fff 30%, #E8792F 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: '6px' }}>
          🚀 Onboarding
        </h1>
        <p style={{ color: '#A0AEC0', fontSize: '14px', margin: 0 }}>
          Asignación de desarrolladores por proyecto
        </p>
      </div>

      {/* Team legend */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '28px', flexWrap: 'wrap' }}>
        {developers.map(dev => (
          <div key={dev.id} style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '6px 12px', borderRadius: '8px',
            background: `${dev.color}12`, border: `1px solid ${dev.color}30`,
          }}>
            <span>{dev.emoji}</span>
            <span style={{ fontSize: '12px', fontWeight: 600, color: dev.color }}>{dev.nombre}</span>
            {dev.es_supervisor && <span style={{ fontSize: '10px', color: '#4a5568' }}>· Supervisor</span>}
          </div>
        ))}
      </div>

      {/* Projects table */}
      <div style={{ background: 'rgba(17,24,39,0.85)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 100px 1fr 1fr', gap: '12px', padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: '11px', color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
          <span>Proyecto</span>
          <span>Estado</span>
          <span>Desarrolladores Asignados</span>
          <span>Acción</span>
        </div>

        {proyectos.map((p, i) => {
          const devs = devsByProject[p.id] ?? []
          const nonSupervDev = devs.filter(d => !d.es_supervisor)
          const supervisor = devs.find(d => d.es_supervisor)

          return (
            <div key={p.id} style={{
              display: 'grid', gridTemplateColumns: '2fr 100px 1fr 1fr',
              gap: '12px', padding: '14px 20px',
              borderBottom: i < proyectos.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
              alignItems: 'center',
            }}>
              {/* Name */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                <span style={{ fontSize: '13px' }}>{p.color_emoji}</span>
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nombre}</p>
                  {p.alertas_count ? <p style={{ margin: 0, fontSize: '11px', color: '#f59e0b' }}>⚠️ {p.alertas_count} alertas</p> : null}
                </div>
              </div>

              {/* Status */}
              <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', background: `${statusColor[p.estado] ?? '#6b7280'}15`, color: statusColor[p.estado] ?? '#6b7280', fontWeight: 600, whiteSpace: 'nowrap', display: 'inline-block' }}>
                {p.estado.replace('_', ' ')}
              </span>

              {/* Developers */}
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
                {supervisor && (
                  <span title={supervisor.nombre} style={{ fontSize: '16px', cursor: 'default' }}>{supervisor.emoji}</span>
                )}
                {nonSupervDev.map(d => (
                  <span key={d.id} title={d.nombre} style={{
                    fontSize: '12px', padding: '2px 8px', borderRadius: '4px',
                    background: `${d.color}15`, color: d.color, fontWeight: 600,
                    border: `1px solid ${d.color}30`,
                  }}>{d.emoji} {d.nombre.split(' ')[0]}</span>
                ))}
                {devs.length <= 1 && (
                  <span style={{ fontSize: '11px', color: '#4a5568', fontStyle: 'italic' }}>Sin dev asignado</span>
                )}
              </div>

              {/* Action */}
              <Link href={`/proyectos/${p.id}?tab=onboarding`} style={{ textDecoration: 'none' }}>
                <button style={{
                  padding: '6px 14px', borderRadius: '7px', fontSize: '12px',
                  fontWeight: 600, cursor: 'pointer',
                  border: '1px solid rgba(232,121,47,0.3)',
                  background: 'rgba(232,121,47,0.08)', color: '#E8792F',
                }}>
                  ✏️ Gestionar
                </button>
              </Link>
            </div>
          )
        })}
      </div>
    </div>
  )
}
