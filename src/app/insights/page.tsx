import { createClient } from '@supabase/supabase-js'
import { Suspense } from 'react'
import { Proyecto, Mensaje } from '@/lib/types'
import ActivityBarChart from '@/components/charts/ActivityBarChart'
import HourlyLineChart from '@/components/charts/HourlyLineChart'
import StatusDonut from '@/components/charts/StatusDonut'
import InsightDateFilter from '@/components/InsightDateFilter'
import Link from 'next/link'

// ── Insight generator ─────────────────────────────────────────────────────────
function generateInsight(p: Proyecto & { lastMsg?: Mensaje }): { text: string; icon: string; tone: 'danger' | 'warn' | 'ok' | 'info' } {
  const alerts    = p.alertas_count ?? 0
  const daysSince = p.ultima_actividad
    ? Math.floor((Date.now() - new Date(p.ultima_actividad).getTime()) / 86400000)
    : 999
  const lastIsClient = p.lastMsg?.es_del_cliente ?? false

  if (p.estado === 'en_riesgo' && alerts > 0)
    return { icon: '🚨', tone: 'danger', text: `${alerts} alerta${alerts > 1 ? 's' : ''} activa${alerts > 1 ? 's' : ''}. El cliente muestra señales de riesgo. Requiere atención inmediata.` }
  if (p.estado === 'en_riesgo')
    return { icon: '🔴', tone: 'danger', text: `Marcado en riesgo. Último contacto hace ${daysSince} día${daysSince !== 1 ? 's' : ''}. Prioriza el seguimiento.` }
  if (lastIsClient && daysSince <= 2)
    return { icon: '💬', tone: 'warn', text: `El cliente escribió hace ${daysSince <= 0 ? 'menos de 1 día' : daysSince + ' día' + (daysSince > 1 ? 's' : '')}. El equipo aún no ha respondido.` }
  if (alerts >= 5)
    return { icon: '⚠️', tone: 'warn', text: `${alerts} alertas detectadas. Revisar mensajes para identificar puntos de fricción.` }
  if (daysSince > 30)
    return { icon: '😴', tone: 'warn', text: `Sin actividad en ${daysSince} días. Considera un seguimiento proactivo.` }
  if (daysSince <= 2 && !lastIsClient)
    return { icon: '✅', tone: 'ok', text: `Comunicación activa. El equipo respondió recientemente. Proyecto en buen estado.` }
  if (daysSince <= 7)
    return { icon: '📊', tone: 'info', text: `Última interacción hace ${daysSince} día${daysSince !== 1 ? 's' : ''}. Seguimiento normal.` }
  return { icon: '📁', tone: 'info', text: `Proyecto activo. Última interacción hace ${daysSince} días.` }
}

const toneColors = {
  danger: { bg: 'rgba(239,68,68,0.08)',  border: 'rgba(239,68,68,0.25)',  text: '#ef4444' },
  warn:   { bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.25)', text: '#f59e0b' },
  ok:     { bg: 'rgba(34,197,94,0.08)',  border: 'rgba(34,197,94,0.25)',  text: '#22c55e' },
  info:   { bg: 'rgba(255,255,255,0.03)', border: 'rgba(255,255,255,0.08)', text: '#A0AEC0' },
}

function fmtDate(iso?: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/El_Salvador' })
}

function fmtFull(iso?: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  const today = new Date(); today.setHours(0,0,0,0)
  const msgDay = new Date(d.toLocaleDateString('en-US', { timeZone: 'America/El_Salvador' }))
  const time = d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', timeZone: 'America/El_Salvador' })
  if (msgDay.getTime() === today.getTime()) return `hoy ${time}`
  return fmtDate(iso) + ' · ' + time
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

const RANGE_LABELS: Record<string, string> = {
  '1d': 'hoy', '7d': 'últimos 7 días', '14d': 'últimos 14 días',
  '30d': 'últimos 30 días', '90d': 'últimos 3 meses'
}

// ── Data fetch ────────────────────────────────────────────────────────────────
async function getData(range: string) {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string
  )

  const rangeDays = range === '1d' ? 1 : range === '14d' ? 14 : range === '30d' ? 30 : range === '90d' ? 90 : 7
  const now = new Date()
  const sinceRange = new Date(now.getTime() - rangeDays * 86400000).toISOString()
  const since30d   = new Date(now.getTime() - 30 * 86400000).toISOString()

  const [projRes, msgsRange, msgs30d, lastMsgs] = await Promise.all([
    sb.from('projects').select('*').order('ultima_actividad', { ascending: false, nullsFirst: false }),
    sb.from('messages').select('project_id, timestamp, es_del_cliente').gte('timestamp', sinceRange),
    sb.from('messages').select('project_id, timestamp').gte('timestamp', since30d),
    sb.from('messages').select('id, project_id, sender, contenido, timestamp, es_del_cliente')
      .order('timestamp', { ascending: false }).limit(200),
  ])

  const proyectos = (projRes.data ?? []) as Proyecto[]

  const lastMsgMap: Record<string, Mensaje> = {}
  for (const m of (lastMsgs.data ?? []) as Mensaje[]) {
    if (!lastMsgMap[m.project_id]) lastMsgMap[m.project_id] = m
  }

  const msgsByProject: Record<string, number> = {}
  for (const m of msgsRange.data ?? []) {
    msgsByProject[m.project_id] = (msgsByProject[m.project_id] ?? 0) + 1
  }

  // Bar data: range window
  const colorMap: Record<string, string> = {
    '🔴': '#ef4444', '🟡': '#eab308', '🟢': '#22c55e', '🟣': '#a855f7'
  }
  const projMap: Record<string, Proyecto> = {}
  for (const p of proyectos) projMap[p.id] = p

  const barData = Object.entries(msgsByProject)
    .sort((a, b) => b[1] - a[1]).slice(0, 15)
    .map(([pid, count]) => ({
      name: (projMap[pid]?.nombre ?? 'Desconocido').substring(0, 22),
      mensajes: count,
      color: colorMap[projMap[pid]?.color_emoji ?? ''] ?? '#E8792F',
    }))

  // Hourly chart: El Salvador time (UTC-6)
  const hourlyMap: Record<string, number> = {}
  for (const m of msgs30d.data ?? []) {
    const svHour = new Date(new Date(m.timestamp).getTime() - 6 * 3600000).getUTCHours()
    const label = `${String(svHour).padStart(2,'0')}:00`
    hourlyMap[label] = (hourlyMap[label] ?? 0) + 1
  }
  const hourlyData = Array.from({ length: 24 }, (_, h) => {
    const label = `${String(h).padStart(2,'0')}:00`
    return { hour: label, mensajes: hourlyMap[label] ?? 0 }
  })

  // Daily trend for selected range
  const dailyMap: Record<string, number> = {}
  for (const m of msgsRange.data ?? []) {
    const svDate = new Date(new Date(m.timestamp).getTime() - 6 * 3600000)
    const key = svDate.toISOString().slice(0, 10)
    dailyMap[key] = (dailyMap[key] ?? 0) + 1
  }
  const dailyData = Array.from({ length: rangeDays }, (_, i) => {
    const d = new Date(now.getTime() - (rangeDays - 1 - i) * 86400000)
    const key = new Date(d.getTime() - 6 * 3600000).toISOString().slice(0, 10)
    const label = d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', timeZone: 'America/El_Salvador' })
    return { hour: label, mensajes: dailyMap[key] ?? 0 }
  })

  const donutData = [
    { name: 'Activo',     value: proyectos.filter(p=>p.estado==='activo').length,     color: '#22c55e' },
    { name: 'En Riesgo',  value: proyectos.filter(p=>p.estado==='en_riesgo').length,  color: '#ef4444' },
    { name: 'Pausado',    value: proyectos.filter(p=>p.estado==='pausado').length,     color: '#6b7280' },
    { name: 'Completado', value: proyectos.filter(p=>p.estado==='completado').length,  color: '#3b82f6' },
  ].filter(d => d.value > 0)

  const activeIds = new Set(Object.keys(msgsByProject))
  const activeProjects = proyectos
    .filter(p => activeIds.has(p.id) || (p.ultima_actividad && new Date(p.ultima_actividad) > new Date(sinceRange)))
    .slice(0, 20).map(p => ({ ...p, lastMsg: lastMsgMap[p.id] }))

  const totalMsgsInRange = msgsRange.data?.length ?? 0
  const totalAlertas = proyectos.reduce((s, p) => s + (p.alertas_count ?? 0), 0)
  const enRiesgo = proyectos.filter(p => p.estado === 'en_riesgo').length

  return { proyectos, activeProjects, barData, hourlyData, dailyData, donutData, totalMsgsInRange, totalAlertas, enRiesgo, lastMsgMap, rangeDays }
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default async function InsightsPage({
  searchParams
}: {
  searchParams: Promise<{ range?: string }>
}) {
  const { range = '7d' } = await searchParams
  const { proyectos, activeProjects, barData, hourlyData, dailyData, donutData, totalMsgsInRange, totalAlertas, enRiesgo, lastMsgMap, rangeDays } = await getData(range)
  const rangeLabel = RANGE_LABELS[range] ?? '7 días'
  const showDaily = rangeDays > 1

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 className="headline headline-gradient" style={{ marginBottom: '6px' }}>📊 Insights</h1>
          <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>
            Datos de actividad · {rangeLabel}
          </p>
        </div>
        {/* Date range filter */}
        <Suspense>
          <InsightDateFilter />
        </Suspense>
      </div>

      {/* Top stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '28px' }}>
        {[
          { label: 'Total Proyectos',  value: proyectos.length,    color: '#E8792F', icon: '📂', sub: 'en el sistema' },
          { label: 'Mensajes',         value: totalMsgsInRange,    color: '#3b82f6', icon: '💬', sub: rangeLabel },
          { label: 'En Riesgo',        value: enRiesgo,            color: '#ef4444', icon: '🔴', sub: 'requieren atención' },
          { label: 'Alertas Abiertas', value: totalAlertas,        color: '#f59e0b', icon: '⚠️', sub: 'sin resolver' },
        ].map(s => (
          <div key={s.label} className="stat-card" style={{ borderColor: `${s.color}18` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
              <span style={{ fontSize: '20px' }}>{s.icon}</span>
              <span style={{ fontSize: '28px', fontWeight: 800, color: s.color, lineHeight: 1, letterSpacing: '-0.02em' }}>{s.value}</span>
            </div>
            <p style={{ fontSize: '12px', fontWeight: 600, color: '#e2e8f0', margin: '0 0 2px' }}>{s.label}</p>
            <p style={{ fontSize: '10px', color: '#475569', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.sub}</p>
            <div style={{ position: 'absolute', bottom: 0, left: '20%', right: '20%', height: '2px', background: `linear-gradient(90deg, transparent, ${s.color}50, transparent)`, borderRadius: '2px' }}/>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px', marginBottom: '28px' }}>
        {/* Daily trend or Hourly distribution */}
        <div className="glass" style={{ borderRadius: '12px', padding: '20px' }}>
          <h2 style={{ fontSize: '13px', fontWeight: 700, color: '#fff', margin: '0 0 3px' }}>
            {showDaily ? 'Mensajes por Día' : 'Actividad de Hoy por Hora'}
          </h2>
          <p style={{ fontSize: '11px', color: '#475569', margin: '0 0 14px' }}>
            {showDaily ? rangeLabel + ' · hora El Salvador' : 'Distribución horaria · UTC-6'}
          </p>
          <HourlyLineChart data={showDaily ? dailyData : hourlyData} />
        </div>

        {/* Status donut */}
        <div className="glass" style={{ borderRadius: '12px', padding: '20px' }}>
          <h2 style={{ fontSize: '13px', fontWeight: 700, color: '#fff', margin: '0 0 3px' }}>Estado de Proyectos</h2>
          <p style={{ fontSize: '11px', color: '#475569', margin: '0 0 14px' }}>Distribución actual</p>
          <StatusDonut data={donutData} />
        </div>
      </div>

      {/* Bar chart */}
      {barData.length > 0 && (
        <div className="glass" style={{ borderRadius: '12px', padding: '20px', marginBottom: '28px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <h2 style={{ fontSize: '13px', fontWeight: 700, color: '#fff', margin: 0 }}>Proyectos Más Activos</h2>
            <span style={{ fontSize: '10px', background: 'rgba(232,121,47,0.1)', border: '1px solid rgba(232,121,47,0.2)', borderRadius: '5px', padding: '2px 8px', color: '#E8792F' }}>
              {rangeLabel}
            </span>
          </div>
          <p style={{ fontSize: '11px', color: '#475569', margin: '0 0 14px' }}>Top {barData.length} por volumen de mensajes</p>
          <ActivityBarChart data={barData} />
        </div>
      )}

      {/* Hourly heatmap — always show for 30d context */}
      {showDaily && (
        <div className="glass" style={{ borderRadius: '12px', padding: '20px', marginBottom: '28px' }}>
          <h2 style={{ fontSize: '13px', fontWeight: 700, color: '#fff', margin: '0 0 3px' }}>Actividad por Hora del Día</h2>
          <p style={{ fontSize: '11px', color: '#475569', margin: '0 0 14px' }}>Últimos 30 días · hora El Salvador (UTC-6)</p>
          <HourlyLineChart data={hourlyData} />
        </div>
      )}

      {/* AI Insight cards */}
      {activeProjects.length > 0 && (
        <div style={{ marginBottom: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px', paddingBottom: '10px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <h2 style={{ fontSize: '13px', fontWeight: 700, color: '#fff', margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>🤖 Análisis por Proyecto</h2>
            <span style={{ fontSize: '10px', color: '#334155', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '5px', padding: '2px 8px' }}>
              con actividad · {rangeLabel}
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '10px' }}>
            {activeProjects.map(p => {
              const insight = generateInsight(p)
              const c = toneColors[insight.tone]
              return (
                <Link key={p.id} href={`/proyectos/${p.id}`} style={{ textDecoration: 'none' }}>
                  <div style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: '10px', padding: '14px', cursor: 'pointer', transition: 'transform 0.15s' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', minWidth: 0 }}>
                        <span style={{ fontSize: '12px' }}>{p.color_emoji}</span>
                        <span style={{ fontWeight: 600, color: '#fff', fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nombre}</span>
                      </div>
                      <span style={{ fontSize: '15px', flexShrink: 0 }}>{insight.icon}</span>
                    </div>
                    <p style={{ fontSize: '11px', color: c.text, margin: '0 0 6px', lineHeight: 1.6 }}>{insight.text}</p>
                    {p.ultima_actividad && (
                      <p style={{ fontSize: '10px', color: '#334155', margin: 0 }}>
                        📅 {fmtFull(p.ultima_actividad)}
                      </p>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* Projects table */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px', paddingBottom: '10px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <h2 style={{ fontSize: '13px', fontWeight: 700, color: '#94a3b8', margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>📋 Todos los Proyectos</h2>
          <span style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', color: '#475569', border: '1px solid rgba(255,255,255,0.06)', fontWeight: 600 }}>{proyectos.length}</span>
        </div>
        <div className="glass" style={{ borderRadius: '12px', overflow: 'hidden' }}>
          {/* Table header */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 70px 70px', gap: '12px', padding: '11px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: '10px', color: '#334155', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 700 }}>
            <span>Proyecto</span><span>Inicio</span><span>Último Msj.</span><span>Última Persona</span><span>Msgs</span><span>Alertas</span>
          </div>
          {proyectos.map((p, i) => {
            const last = lastMsgMap[p.id]
            return (
              <Link key={p.id} href={`/proyectos/${p.id}`} style={{ textDecoration: 'none' }}>
                <div style={{
                  display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 70px 70px',
                  gap: '12px', padding: '12px 18px', alignItems: 'center',
                  borderBottom: i < proyectos.length-1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                  cursor: 'pointer', transition: 'background 0.15s',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                    <span style={{ fontSize: '11px' }}>{p.color_emoji}</span>
                    <span style={{ fontSize: '12px', color: '#e2e8f0', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nombre}</span>
                    {p.estado === 'en_riesgo' && <span style={{ fontSize: '9px', background: 'rgba(239,68,68,0.15)', color: '#ef4444', padding: '1px 5px', borderRadius: '3px', flexShrink: 0, fontWeight: 700 }}>RIESGO</span>}
                  </div>
                  <span style={{ fontSize: '11px', color: '#475569' }}>{fmtDate((p as any).fecha_inicio)}</span>
                  <span style={{ fontSize: '11px', color: p.ultima_actividad && new Date(p.ultima_actividad) > new Date(Date.now()-7*86400000) ? '#4ade80' : '#475569', fontWeight: 600 }}>
                    {fmtFull(p.ultima_actividad)}
                  </span>
                  <span style={{ fontSize: '11px', color: last?.es_del_cliente ? '#94a3b8' : '#E8792F', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {last ? (last.es_del_cliente ? '👤 ' + last.sender.split(' ')[0] : '🟠 equipo') : '—'}
                  </span>
                  <span style={{ fontSize: '12px', color: '#e2e8f0', fontWeight: 700 }}>{p.total_mensajes ?? '—'}</span>
                  <span style={{ fontSize: '12px', color: (p.alertas_count ?? 0) > 0 ? '#fbbf24' : '#334155', fontWeight: 700 }}>
                    {(p.alertas_count ?? 0) > 0 ? `⚠ ${p.alertas_count}` : '—'}
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
