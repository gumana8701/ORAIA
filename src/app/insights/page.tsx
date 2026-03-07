import { createClient } from '@supabase/supabase-js'
import { Proyecto, Mensaje } from '@/lib/types'
import ActivityBarChart from '@/components/charts/ActivityBarChart'
import HourlyLineChart from '@/components/charts/HourlyLineChart'
import StatusDonut from '@/components/charts/StatusDonut'
import Link from 'next/link'

// ── Insight generator (rule-based AI) ────────────────────────────────────────
function generateInsight(p: Proyecto & { lastMsg?: Mensaje }): { text: string; icon: string; tone: 'danger' | 'warn' | 'ok' | 'info' } {
  const alerts     = p.alertas_count ?? 0
  const daysSince  = p.ultima_actividad
    ? Math.floor((Date.now() - new Date(p.ultima_actividad).getTime()) / 86400000)
    : 999
  const lastIsClient = p.lastMsg?.es_del_cliente ?? false

  if (p.estado === 'en_riesgo' && alerts > 0)
    return { icon: '🚨', tone: 'danger', text: `${alerts} alerta${alerts > 1 ? 's' : ''} activa${alerts > 1 ? 's' : ''}. El cliente muestra señales de riesgo. Requiere atención inmediata.` }

  if (p.estado === 'en_riesgo')
    return { icon: '🔴', tone: 'danger', text: `Marcado en riesgo. Último contacto hace ${daysSince} día${daysSince !== 1 ? 's' : ''}. Prioriza el seguimiento.` }

  if (lastIsClient && daysSince <= 2)
    return { icon: '💬', tone: 'warn', text: `El cliente escribió hace ${daysSince <= 0 ? 'menos de 1 día' : daysSince + ' día' + (daysSince > 1 ? 's' : '')}. El equipo aún no ha respondido. Responder pronto.` }

  if (alerts >= 5)
    return { icon: '⚠️', tone: 'warn', text: `${alerts} alertas detectadas. Revisar mensajes recientes del cliente para identificar puntos de fricción.` }

  if (daysSince > 30)
    return { icon: '😴', tone: 'warn', text: `Sin actividad en ${daysSince} días. Considera un seguimiento proactivo para reactivar la relación.` }

  if (daysSince <= 2 && !lastIsClient)
    return { icon: '✅', tone: 'ok', text: `Comunicación activa. El equipo respondió recientemente. Proyecto en buen estado.` }

  if (daysSince <= 7)
    return { icon: '📊', tone: 'info', text: `Última interacción hace ${daysSince} día${daysSince !== 1 ? 's' : ''}. Seguimiento normal en curso.` }

  return { icon: '📁', tone: 'info', text: `Proyecto activo. Última interacción hace ${daysSince} días.` }
}

const toneColors = {
  danger: { bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.25)',   text: '#ef4444' },
  warn:   { bg: 'rgba(245,158,11,0.08)',   border: 'rgba(245,158,11,0.25)',  text: '#f59e0b' },
  ok:     { bg: 'rgba(34,197,94,0.08)',    border: 'rgba(34,197,94,0.25)',   text: '#22c55e' },
  info:   { bg: 'rgba(255,255,255,0.03)',  border: 'rgba(255,255,255,0.08)', text: '#A0AEC0' },
}

function fmtDate(iso?: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}

function daysAgo(iso?: string | null) {
  if (!iso) return '—'
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (d === 0) return 'hoy'
  if (d === 1) return 'ayer'
  return `hace ${d}d`
}

const statusLabel: Record<string, string> = {
  activo: 'Activo', en_riesgo: 'En Riesgo', pausado: 'Pausado', completado: 'Completado'
}

// ── Data fetch ────────────────────────────────────────────────────────────────
async function getData() {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string
  )

  const now = new Date()
  const since7d  = new Date(now.getTime() - 7  * 86400000).toISOString()
  const since30d = new Date(now.getTime() - 30 * 86400000).toISOString()
  const since24h = new Date(now.getTime() - 24 * 3600000).toISOString()

  const [projRes, msgs7d, msgs30d, lastMsgs] = await Promise.all([
    sb.from('projects').select('*').order('ultima_actividad', { ascending: false, nullsFirst: false }),
    sb.from('messages').select('project_id, timestamp, es_del_cliente').gte('timestamp', since7d),
    sb.from('messages').select('project_id, timestamp').gte('timestamp', since30d),
    sb.from('messages').select('id, project_id, sender, contenido, timestamp, es_del_cliente')
      .order('timestamp', { ascending: false }).limit(200),
  ])

  const proyectos = (projRes.data ?? []) as Proyecto[]

  // Last message per project
  const lastMsgMap: Record<string, Mensaje> = {}
  for (const m of (lastMsgs.data ?? []) as Mensaje[]) {
    if (!lastMsgMap[m.project_id]) lastMsgMap[m.project_id] = m
  }

  // Messages in last 7d grouped by project
  const msgsByProject: Record<string, number> = {}
  for (const m of msgs7d.data ?? []) {
    msgsByProject[m.project_id] = (msgsByProject[m.project_id] ?? 0) + 1
  }

  // Hourly distribution (last 30d) — group by day-of-week + hour
  const hourlyMap: Record<string, number> = {}
  for (const m of msgs30d.data ?? []) {
    const h = new Date(m.timestamp).getUTCHours()
    const label = `${String(h).padStart(2,'0')}:00`
    hourlyMap[label] = (hourlyMap[label] ?? 0) + 1
  }
  const hourlyData = Array.from({ length: 24 }, (_, h) => {
    const label = `${String(h).padStart(2,'0')}:00`
    return { hour: label, mensajes: hourlyMap[label] ?? 0 }
  })

  // Bar chart: top 15 projects by msgs in last 7d
  const colorMap: Record<string, string> = {
    '🔴': '#ef4444', '🟡': '#eab308', '🟢': '#22c55e', '🟣': '#a855f7'
  }
  const projMap: Record<string, Proyecto> = {}
  for (const p of proyectos) projMap[p.id] = p

  const barData = Object.entries(msgsByProject)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([pid, count]) => ({
      name: (projMap[pid]?.nombre ?? 'Desconocido').substring(0, 20),
      mensajes: count,
      color: colorMap[projMap[pid]?.color_emoji ?? ''] ?? '#E8792F',
    }))

  // Status donut
  const statusCounts: Record<string, number> = {}
  for (const p of proyectos) statusCounts[p.estado] = (statusCounts[p.estado] ?? 0) + 1
  const donutData = [
    { name: 'Activo',      value: statusCounts['activo']     ?? 0, color: '#22c55e' },
    { name: 'En Riesgo',   value: statusCounts['en_riesgo']  ?? 0, color: '#ef4444' },
    { name: 'Pausado',     value: statusCounts['pausado']    ?? 0, color: '#6b7280' },
    { name: 'Completado',  value: statusCounts['completado'] ?? 0, color: '#3b82f6' },
  ].filter(d => d.value > 0)

  // Active projects last 7d (for insight cards)
  const activeIds = new Set(Object.keys(msgsByProject))
  const activeProjects = proyectos
    .filter(p => activeIds.has(p.id) || (p.ultima_actividad && new Date(p.ultima_actividad) > new Date(since7d)))
    .slice(0, 20)
    .map(p => ({ ...p, lastMsg: lastMsgMap[p.id] }))

  // Stats
  const msgs24h = (msgs7d.data ?? []).filter(m => m.timestamp >= since24h).length

  return { proyectos, activeProjects, barData, hourlyData, donutData, msgs24h, lastMsgMap }
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default async function InsightsPage() {
  const { proyectos, activeProjects, barData, hourlyData, donutData, msgs24h, lastMsgMap } = await getData()

  const totalAlertas = proyectos.reduce((s, p) => s + (p.alertas_count ?? 0), 0)
  const enRiesgo = proyectos.filter(p => p.estado === 'en_riesgo').length

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 800, background: 'linear-gradient(135deg, #fff 30%, #E8792F 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: '6px' }}>
          📊 Insights
        </h1>
        <p style={{ color: '#A0AEC0', fontSize: '14px', margin: 0 }}>
          Actividad reciente · tendencias · estado de proyectos
        </p>
      </div>

      {/* Top stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '32px' }}>
        {[
          { label: 'Total Proyectos',  value: proyectos.length,     color: '#E8792F', icon: '📂' },
          { label: 'Mensajes (24h)',   value: msgs24h,               color: '#3b82f6', icon: '💬' },
          { label: 'En Riesgo',        value: enRiesgo,              color: '#ef4444', icon: '🔴' },
          { label: 'Alertas Abiertas', value: totalAlertas,          color: '#f59e0b', icon: '⚠️' },
        ].map(s => (
          <div key={s.label} style={{ background: 'rgba(17,24,39,0.85)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '20px' }}>
            <div style={{ fontSize: '20px', marginBottom: '8px' }}>{s.icon}</div>
            <p style={{ fontSize: '30px', fontWeight: 800, color: s.color, margin: '0 0 4px' }}>{s.value}</p>
            <p style={{ fontSize: '12px', color: '#A0AEC0', margin: 0 }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '32px' }}>

        {/* Hourly activity */}
        <div style={{ background: 'rgba(17,24,39,0.85)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '20px' }}>
          <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#fff', margin: '0 0 4px' }}>Actividad por Hora del Día</h2>
          <p style={{ fontSize: '12px', color: '#A0AEC0', margin: '0 0 16px' }}>Últimos 30 días · hora UTC</p>
          <HourlyLineChart data={hourlyData} />
        </div>

        {/* Status donut */}
        <div style={{ background: 'rgba(17,24,39,0.85)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '20px' }}>
          <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#fff', margin: '0 0 4px' }}>Estado de Proyectos</h2>
          <p style={{ fontSize: '12px', color: '#A0AEC0', margin: '0 0 16px' }}>Distribución actual</p>
          <StatusDonut data={donutData} />
        </div>
      </div>

      {/* Bar chart — msgs per project last 7d */}
      {barData.length > 0 && (
        <div style={{ background: 'rgba(17,24,39,0.85)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '20px', marginBottom: '32px' }}>
          <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#fff', margin: '0 0 4px' }}>Mensajes por Proyecto — Últimos 7 Días</h2>
          <p style={{ fontSize: '12px', color: '#A0AEC0', margin: '0 0 16px' }}>Top {barData.length} proyectos más activos</p>
          <ActivityBarChart data={barData} />
        </div>
      )}

      {/* AI Insight cards */}
      {activeProjects.length > 0 && (
        <div style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#fff', marginBottom: '4px' }}>🤖 Análisis por Proyecto</h2>
          <p style={{ fontSize: '12px', color: '#A0AEC0', margin: '0 0 16px' }}>Proyectos con actividad reciente · insights automáticos</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '12px' }}>
            {activeProjects.map(p => {
              const insight = generateInsight(p)
              const c = toneColors[insight.tone]
              return (
                <Link key={p.id} href={`/proyectos/${p.id}`} style={{ textDecoration: 'none' }}>
                  <div style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: '10px', padding: '16px', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>{p.color_emoji}</span>
                        <span style={{ fontWeight: 600, color: '#fff', fontSize: '13px' }}>{p.nombre}</span>
                      </div>
                      <span style={{ fontSize: '16px' }}>{insight.icon}</span>
                    </div>
                    <p style={{ fontSize: '12px', color: c.text, margin: 0, lineHeight: 1.6 }}>{insight.text}</p>
                    {p.lastMsg && (
                      <p style={{ fontSize: '11px', color: '#4a5568', margin: '8px 0 0', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        &ldquo;{p.lastMsg.contenido.substring(0, 80)}&rdquo;
                      </p>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* Full projects table */}
      <div>
        <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#fff', marginBottom: '16px' }}>📋 Tabla de Proyectos</h2>
        <div style={{ background: 'rgba(17,24,39,0.85)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', overflow: 'hidden' }}>
          {/* Table header */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 80px 80px', gap: '12px', padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: '11px', color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
            <span>Proyecto</span>
            <span>Inicio</span>
            <span>Último Msj.</span>
            <span>Última Persona</span>
            <span>Msgs</span>
            <span>Alertas</span>
          </div>
          {/* Rows */}
          {proyectos.map((p, i) => {
            const last = lastMsgMap[p.id]
            return (
              <Link key={p.id} href={`/proyectos/${p.id}`} style={{ textDecoration: 'none' }}>
                <div style={{
                  display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 80px 80px',
                  gap: '12px', padding: '13px 20px',
                  borderBottom: i < proyectos.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                  cursor: 'pointer',
                }}>
                  {/* Name */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                    <span style={{ fontSize: '12px' }}>{p.color_emoji}</span>
                    <span style={{ fontSize: '13px', color: '#fff', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nombre}</span>
                    {p.estado === 'en_riesgo' && <span style={{ fontSize: '10px', background: 'rgba(239,68,68,0.15)', color: '#ef4444', padding: '1px 5px', borderRadius: '4px', flexShrink: 0 }}>riesgo</span>}
                  </div>
                  {/* Start date */}
                  <span style={{ fontSize: '12px', color: '#A0AEC0', alignSelf: 'center' }}>{fmtDate((p as any).fecha_inicio)}</span>
                  {/* Last msg */}
                  <span style={{ fontSize: '12px', color: p.ultima_actividad && new Date(p.ultima_actividad) > new Date(Date.now() - 7*86400000) ? '#22c55e' : '#A0AEC0', alignSelf: 'center', fontWeight: 500 }}>
                    {daysAgo(p.ultima_actividad)}
                  </span>
                  {/* Last sender */}
                  <span style={{ fontSize: '12px', color: last?.es_del_cliente ? '#94a3b8' : '#E8792F', alignSelf: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {last ? (last.es_del_cliente ? '👤 ' + last.sender.split(' ')[0] : '🟠 equipo') : '—'}
                  </span>
                  {/* Total msgs */}
                  <span style={{ fontSize: '13px', color: '#fff', fontWeight: 600, alignSelf: 'center' }}>{p.total_mensajes ?? '—'}</span>
                  {/* Alerts */}
                  <span style={{ fontSize: '13px', color: (p.alertas_count ?? 0) > 0 ? '#f59e0b' : '#4a5568', fontWeight: 600, alignSelf: 'center' }}>
                    {(p.alertas_count ?? 0) > 0 ? `⚠️ ${p.alertas_count}` : '—'}
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
