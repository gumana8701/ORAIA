import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function svTime(iso?: string | null) {
  if (!iso) return null
  // Convert UTC to El Salvador (UTC-6)
  const d = new Date(iso)
  return new Date(d.getTime() - 6 * 60 * 60 * 1000)
    .toLocaleString('es-SV', { timeZone: 'America/El_Salvador', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

// Midnight El Salvador time in UTC
function svMidnightUTC() {
  const now = new Date()
  const svNow = new Date(now.getTime() - 6 * 60 * 60 * 1000)
  svNow.setUTCHours(0, 0, 0, 0)
  return new Date(svNow.getTime() + 6 * 60 * 60 * 1000).toISOString()
}

export async function GET(req: NextRequest) {
  const tipo    = req.nextUrl.searchParams.get('tipo') ?? 'resumen'
  const nombre  = req.nextUrl.searchParams.get('nombre') ?? ''
  const client  = sb()

  try {
    // ── RESUMEN GENERAL ───────────────────────────────────────────────
    if (tipo === 'resumen') {
      const { data: proyectos } = await client.from('projects').select('estado,alertas_count')
      const activos     = proyectos?.filter(p => p.estado === 'activo').length ?? 0
      const en_riesgo   = proyectos?.filter(p => p.estado === 'en_riesgo').length ?? 0
      const pausados    = proyectos?.filter(p => p.estado === 'pausado').length ?? 0
      const completados = proyectos?.filter(p => p.estado === 'completado').length ?? 0
      const alertas     = proyectos?.reduce((a, p) => a + (p.alertas_count ?? 0), 0) ?? 0
      return NextResponse.json({ activos, en_riesgo, pausados, completados, alertas_abiertas: alertas, total: proyectos?.length ?? 0 })
    }

    // ── MENSAJES DE HOY ───────────────────────────────────────────────
    if (tipo === 'hoy') {
      const desde = svMidnightUTC()
      const { data, count } = await client
        .from('messages')
        .select('sender,contenido,timestamp,project_id', { count: 'exact' })
        .gte('timestamp', desde)
        .order('timestamp', { ascending: false })
        .limit(20)

      const { data: proyectos } = await client.from('projects').select('id,nombre')
      const proyMap: Record<string, string> = {}
      for (const p of proyectos ?? []) proyMap[p.id] = p.nombre

      return NextResponse.json({
        total_mensajes_hoy: count ?? 0,
        desde_hora_sv: svTime(desde),
        mensajes: (data ?? []).map(m => ({
          proyecto: proyMap[m.project_id] ?? 'Desconocido',
          sender: m.sender,
          hora_sv: svTime(m.timestamp),
          contenido: m.contenido?.slice(0, 100),
        }))
      })
    }

    // ── PROYECTOS EN RIESGO ───────────────────────────────────────────
    if (tipo === 'en_riesgo') {
      const { data } = await client
        .from('projects')
        .select('nombre,alertas_count,ultima_actividad,desarrollador_principal')
        .eq('estado', 'en_riesgo')
        .order('alertas_count', { ascending: false })
      return NextResponse.json({
        total: data?.length ?? 0,
        proyectos: (data ?? []).map(p => ({
          nombre: p.nombre,
          alertas: p.alertas_count,
          ultima_actividad_sv: svTime(p.ultima_actividad),
          desarrollador: p.desarrollador_principal,
        }))
      })
    }

    // ── ALERTAS ───────────────────────────────────────────────────────
    if (tipo === 'alertas') {
      const { data } = await client
        .from('alerts')
        .select('tipo,nivel,descripcion,created_at,project_id')
        .eq('resuelta', false)
        .order('nivel', { ascending: false })
        .limit(20)

      const { data: proyectos } = await client.from('projects').select('id,nombre')
      const proyMap: Record<string, string> = {}
      for (const p of proyectos ?? []) proyMap[p.id] = p.nombre

      return NextResponse.json({
        total: data?.length ?? 0,
        alertas: (data ?? []).map(a => ({
          proyecto: proyMap[a.project_id] ?? '—',
          tipo: a.tipo,
          nivel: a.nivel,
          descripcion: a.descripcion?.slice(0, 120),
          creada: svTime(a.created_at),
        }))
      })
    }

    // ── SILENCIO — proyectos sin actividad reciente ───────────────────
    if (tipo === 'silencio') {
      const hace7dias = new Date(Date.now() - 7 * 86400000).toISOString()
      const { data } = await client
        .from('projects')
        .select('nombre,ultima_actividad,estado,desarrollador_principal')
        .in('estado', ['activo', 'en_riesgo'])
        .lt('ultima_actividad', hace7dias)
        .order('ultima_actividad', { ascending: true })
        .limit(15)
      return NextResponse.json({
        total: data?.length ?? 0,
        proyectos: (data ?? []).map(p => ({
          nombre: p.nombre,
          estado: p.estado,
          ultima_actividad_sv: svTime(p.ultima_actividad),
          desarrollador: p.desarrollador_principal,
        }))
      })
    }

    // ── BUSCAR PROYECTO ESPECÍFICO ────────────────────────────────────
    if (tipo === 'proyecto' && nombre) {
      const { data: projs } = await client
        .from('projects')
        .select('id,nombre,estado,alertas_count,total_mensajes,ultima_actividad,desarrollador_principal,color_emoji')
        .ilike('nombre', `%${nombre}%`)
        .limit(3)

      if (!projs?.length) return NextResponse.json({ encontrado: false, mensaje: `No encontré ningún proyecto con el nombre "${nombre}"` })

      const p = projs[0]
      const { data: alertas } = await client
        .from('alerts')
        .select('tipo,nivel,descripcion')
        .eq('project_id', p.id)
        .eq('resuelta', false)
        .limit(5)

      const { data: ultMsgs } = await client
        .from('messages')
        .select('sender,contenido,timestamp')
        .eq('project_id', p.id)
        .order('timestamp', { ascending: false })
        .limit(3)

      return NextResponse.json({
        encontrado: true,
        proyecto: {
          nombre: p.nombre,
          estado: p.estado,
          alertas_abiertas: p.alertas_count,
          total_mensajes: p.total_mensajes,
          ultima_actividad_sv: svTime(p.ultima_actividad),
          desarrollador: p.desarrollador_principal,
        },
        alertas: alertas ?? [],
        ultimos_mensajes: (ultMsgs ?? []).map(m => ({
          sender: m.sender,
          contenido: m.contenido?.slice(0, 120),
          hora_sv: svTime(m.timestamp),
        }))
      })
    }

    // ── ACTIVIDAD RECIENTE (última hora) ──────────────────────────────
    if (tipo === 'reciente') {
      const hace1h = new Date(Date.now() - 3600000).toISOString()
      const { data, count } = await client
        .from('messages')
        .select('sender,contenido,timestamp,project_id', { count: 'exact' })
        .gte('timestamp', hace1h)
        .order('timestamp', { ascending: false })
        .limit(10)

      const { data: proyectos } = await client.from('projects').select('id,nombre')
      const proyMap: Record<string, string> = {}
      for (const p of proyectos ?? []) proyMap[p.id] = p.nombre

      return NextResponse.json({
        mensajes_ultima_hora: count ?? 0,
        mensajes: (data ?? []).map(m => ({
          proyecto: proyMap[m.project_id] ?? '—',
          sender: m.sender,
          hora_sv: svTime(m.timestamp),
          contenido: m.contenido?.slice(0, 80),
        }))
      })
    }

    return NextResponse.json({ error: 'tipo no válido', tipos_validos: ['resumen','hoy','en_riesgo','alertas','silencio','proyecto','reciente'] }, { status: 400 })

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
