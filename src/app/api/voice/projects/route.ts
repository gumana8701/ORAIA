import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const [projRes, alertRes] = await Promise.all([
    sb.from('projects')
      .select('nombre,estado,alertas_count,ultima_actividad,total_mensajes,desarrollador_principal,color_emoji')
      .order('ultima_actividad', { ascending: false, nullsFirst: false }),
    sb.from('alerts')
      .select('tipo,nivel,descripcion')
      .eq('resuelta', false)
      .in('nivel', ['critico', 'alto'])
      .limit(30),
  ])

  const proyectos  = projRes.data ?? []
  const alertas    = alertRes.data ?? []

  const activos     = proyectos.filter(p => p.estado === 'activo').length
  const enRiesgo    = proyectos.filter(p => p.estado === 'en_riesgo').length
  const pausados    = proyectos.filter(p => p.estado === 'pausado').length
  const completados = proyectos.filter(p => p.estado === 'completado').length

  function daysAgo(iso?: string) {
    if (!iso) return null
    const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
    return d === 0 ? 'hoy' : d === 1 ? 'ayer' : `hace ${d} días`
  }

  return NextResponse.json({
    resumen: {
      total: proyectos.length,
      activos,
      en_riesgo: enRiesgo,
      pausados,
      completados,
      alertas_abiertas: alertas.length,
    },
    proyectos_en_riesgo: proyectos
      .filter(p => p.estado === 'en_riesgo')
      .map(p => ({
        nombre: p.nombre,
        alertas: p.alertas_count ?? 0,
        ultimo_mensaje: daysAgo(p.ultima_actividad),
        desarrollador: p.desarrollador_principal ?? 'Sin asignar',
      })),
    proyectos_activos: proyectos
      .filter(p => p.estado === 'activo')
      .slice(0, 12)
      .map(p => ({
        nombre: p.nombre,
        mensajes: p.total_mensajes ?? 0,
        ultimo_mensaje: daysAgo(p.ultima_actividad),
        desarrollador: p.desarrollador_principal ?? 'Sin asignar',
      })),
    alertas_urgentes: alertas.map(a => ({
      tipo: a.tipo,
      nivel: a.nivel,
      descripcion: a.descripcion?.slice(0, 120),
    })),
  })
}
