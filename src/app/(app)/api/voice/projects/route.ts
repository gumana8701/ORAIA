import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function GET() {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const since72 = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString()

  const [projRes, alertRes, recentMsgRes] = await Promise.all([
    sb.from('projects')
      .select('id,nombre,estado,cliente,responsable,alertas_count,ultima_actividad,total_mensajes,desarrollador_principal,progreso')
      .order('ultima_actividad', { ascending: false, nullsFirst: false }),
    sb.from('alerts')
      .select('project_id,tipo,nivel,descripcion')
      .eq('resuelta', false)
      .in('nivel', ['critico', 'alto'])
      .limit(40),
    // Recent messages from ALL sources (WhatsApp + Slack) for top active projects
    sb.from('messages')
      .select('project_id,contenido,fuente,sender,timestamp')
      .gte('timestamp', since72)
      .not('project_id', 'is', null)
      .order('timestamp', { ascending: false })
      .limit(200),
  ])

  const proyectos   = projRes.data ?? []
  const alertas     = alertRes.data ?? []
  const recentMsgs  = recentMsgRes.data ?? []

  // Build project-level context
  const projMap = Object.fromEntries(proyectos.map(p => [p.id, p]))
  const alertsByProj: Record<string, typeof alertas> = {}
  for (const a of alertas) {
    if (!alertsByProj[a.project_id]) alertsByProj[a.project_id] = []
    alertsByProj[a.project_id].push(a)
  }

  // Group recent messages by project, track sources
  const msgsByProj: Record<string, { count: number; slack: number; whatsapp: number; snippets: string[] }> = {}
  for (const m of recentMsgs) {
    if (!msgsByProj[m.project_id]) msgsByProj[m.project_id] = { count: 0, slack: 0, whatsapp: 0, snippets: [] }
    const e = msgsByProj[m.project_id]
    e.count++
    if (m.fuente === 'slack') e.slack++
    if (m.fuente === 'whatsapp') e.whatsapp++
    if (e.snippets.length < 2) e.snippets.push(`${m.sender}: ${m.contenido?.slice(0, 80)}`)
  }

  function daysAgo(iso?: string) {
    if (!iso) return null
    const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
    return d === 0 ? 'hoy' : d === 1 ? 'ayer' : `hace ${d} días`
  }

  const activos     = proyectos.filter(p => p.estado === 'activo').length
  const enRiesgo    = proyectos.filter(p => p.estado === 'en_riesgo').length
  const pausados    = proyectos.filter(p => p.estado === 'pausado').length
  const completados = proyectos.filter(p => p.estado === 'completado').length

  // Build enriched project list for BOB
  const proyectosEnriquecidos = proyectos
    .filter(p => p.estado === 'activo' || p.estado === 'en_riesgo')
    .slice(0, 15)
    .map(p => {
      const msgs72  = msgsByProj[p.id]
      const alerts  = alertsByProj[p.id] ?? []
      const fuentes = []
      if (msgs72?.whatsapp) fuentes.push(`${msgs72.whatsapp} msg WA`)
      if (msgs72?.slack)    fuentes.push(`${msgs72.slack} msg Slack`)

      return {
        nombre:        p.nombre,
        estado:        p.estado,
        cliente:       p.cliente ?? '',
        responsable:   p.desarrollador_principal ?? p.responsable ?? 'Sin asignar',
        progreso:      p.progreso ?? 0,
        alertas:       alerts.length,
        actividad72h:  msgs72 ? fuentes.join(', ') || `${msgs72.count} msgs` : 'sin actividad',
        ultima_act:    daysAgo(p.ultima_actividad),
        snippets:      msgs72?.snippets ?? [],
        alerts_detail: alerts.slice(0, 2).map(a => `${a.tipo}: ${a.descripcion?.slice(0, 80)}`),
      }
    })

  return NextResponse.json({
    resumen: {
      total: proyectos.length,
      activos, en_riesgo: enRiesgo, pausados, completados,
      alertas_abiertas: alertas.length,
      msgs_72h: recentMsgs.length,
      fuentes_activas: [...new Set(recentMsgs.map(m => m.fuente))],
    },
    proyectos_en_riesgo: proyectosEnriquecidos
      .filter(p => p.estado === 'en_riesgo')
      .map(p => ({
        nombre: p.nombre, cliente: p.cliente, alertas: p.alertas,
        actividad: p.actividad72h, ultimo_mensaje: p.ultima_act,
        desarrollador: p.responsable, alerts_detail: p.alerts_detail,
      })),
    proyectos_activos: proyectosEnriquecidos
      .filter(p => p.estado === 'activo')
      .map(p => ({
        nombre: p.nombre, cliente: p.cliente, progreso: p.progreso,
        actividad: p.actividad72h, ultimo_mensaje: p.ultima_act,
        desarrollador: p.responsable,
      })),
    // Project list for task creation (name + id)
    proyectos_para_tareas: proyectos
      .filter(p => ['activo', 'en_riesgo'].includes(p.estado))
      .map(p => ({ id: p.id, nombre: p.nombre })),
    alertas_urgentes: alertas.slice(0, 8).map(a => ({
      tipo: a.tipo, nivel: a.nivel,
      descripcion: a.descripcion?.slice(0, 120),
    })),
  })
}
