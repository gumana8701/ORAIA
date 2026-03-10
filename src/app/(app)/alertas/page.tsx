import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import { Alerta, Proyecto } from '@/lib/types'

const nivelColor: Record<string, string> = {
  critico: '#ef4444',
  alto: '#f97316',
  medio: '#f59e0b',
  bajo: '#6b7280',
}

const tipoIcon: Record<string, string> = {
  cancelacion: '🚪',
  reembolso: '💸',
  enojo: '😡',
  pago: '💳',
  entrega: '📦',
  urgente: '⚡',
  silencio: '🔇',
  otro: '⚠️',
}

async function getData() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string
  )

  const [alertRes, projRes] = await Promise.all([
    supabase.from('alerts').select('*').eq('resuelta', false)
      .order('nivel').order('created_at', { ascending: false }),
    supabase.from('projects').select('id, nombre, color_emoji, estado'),
  ])

  const proyectosMap: Record<string, Pick<Proyecto, 'nombre' | 'color_emoji' | 'estado'>> = {}
  for (const p of (projRes.data ?? [])) {
    proyectosMap[p.id] = p
  }

  return {
    alertas: (alertRes.data ?? []) as Alerta[],
    proyectosMap,
  }
}

// Sort by severity
const nivelOrder: Record<string, number> = { critico: 0, alto: 1, medio: 2, bajo: 3 }

export default async function AlertasPage() {
  const { alertas, proyectosMap } = await getData()

  const sorted = [...alertas].sort((a, b) =>
    (nivelOrder[a.nivel] ?? 4) - (nivelOrder[b.nivel] ?? 4)
  )

  const byTipo = sorted.reduce<Record<string, Alerta[]>>((acc, a) => {
    acc[a.tipo] = acc[a.tipo] ?? []
    acc[a.tipo].push(a)
    return acc
  }, {})

  const criticos  = sorted.filter(a => a.nivel === 'critico').length
  const altos     = sorted.filter(a => a.nivel === 'alto').length
  const medios    = sorted.filter(a => a.nivel === 'medio').length

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 800, background: 'linear-gradient(135deg, #fff 30%, #f59e0b 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: '6px' }}>
          ⚠️ Alertas Activas
        </h1>
        <p style={{ color: '#A0AEC0', fontSize: '14px', margin: 0 }}>
          {sorted.length} alertas sin resolver en {Object.keys(proyectosMap).length} proyectos
        </p>
      </div>

      {/* Summary pills */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '32px', flexWrap: 'wrap' }}>
        {[
          { label: 'Crítico', count: criticos, color: '#ef4444' },
          { label: 'Alto',    count: altos,    color: '#f97316' },
          { label: 'Medio',   count: medios,   color: '#f59e0b' },
        ].map(s => (
          <div key={s.label} style={{
            padding: '8px 16px', borderRadius: '8px',
            background: `${s.color}15`, border: `1px solid ${s.color}40`,
            fontSize: '13px', fontWeight: 600, color: s.color,
          }}>
            {s.label}: {s.count}
          </div>
        ))}
      </div>

      {/* By tipo */}
      {Object.entries(byTipo).map(([tipo, items]) => (
        <div key={tipo} style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#fff', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            {tipoIcon[tipo] ?? '⚠️'} {tipo.charAt(0).toUpperCase() + tipo.slice(1)} ({items.length})
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {items.map(alerta => {
              const proj = proyectosMap[alerta.project_id]
              return (
                <div key={alerta.id} style={{
                  background: 'rgba(17,24,39,0.85)',
                  border: `1px solid ${nivelColor[alerta.nivel]}30`,
                  borderLeft: `3px solid ${nivelColor[alerta.nivel]}`,
                  borderRadius: '8px',
                  padding: '12px 16px',
                  display: 'flex',
                  gap: '12px',
                  alignItems: 'flex-start',
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '11px', padding: '1px 6px', borderRadius: '4px', background: `${nivelColor[alerta.nivel]}20`, color: nivelColor[alerta.nivel], fontWeight: 700, textTransform: 'uppercase' }}>
                        {alerta.nivel}
                      </span>
                      {proj && (
                        <Link href={`/proyectos/${alerta.project_id}`} style={{ textDecoration: 'none' }}>
                          <span style={{ fontSize: '12px', color: '#E8792F', fontWeight: 600 }}>
                            {proj.color_emoji} {proj.nombre}
                          </span>
                        </Link>
                      )}
                    </div>
                    <p style={{ fontSize: '13px', color: '#cbd5e0', margin: 0, lineHeight: 1.5 }}>
                      {alerta.descripcion}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {sorted.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px', color: '#A0AEC0', background: 'rgba(17,24,39,0.85)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: '12px' }}>
          <p style={{ fontSize: '32px', marginBottom: '12px' }}>✅</p>
          <p style={{ fontWeight: 600, color: '#fff' }}>Sin alertas activas</p>
        </div>
      )}
    </div>
  )
}
