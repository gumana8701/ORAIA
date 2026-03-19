/**
 * GET /api/projects/[id]/recap
 * Returns a 72h activity recap for a project.
 * Uses Gemini to generate a summary. Cached for 2h in project_recaps.
 * Pass ?refresh=1 to force regeneration.
 */
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const GEMINI_KEY = process.env.GEMINI_API_KEY || 'AIzaSyBjs8PfHpaQID7r_Wo7pcAeiEuLKnGKt5A'
const CACHE_HOURS = 2

async function generateRecap(projectId: string, projectName: string): Promise<{
  recap_text: string
  msg_count_72h: number
  meeting_count_72h: number
  alert_count_72h: number
  last_client_msg: string | null
}> {
  const cutoff = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString()

  // Fetch last 72h data in parallel
  const [msgRes, briefRes, alertRes] = await Promise.all([
    sb.from('messages')
      .select('contenido, timestamp, es_del_cliente, fuente')
      .eq('project_id', projectId)
      .gte('timestamp', cutoff)
      .order('timestamp', { ascending: false })
      .limit(80),
    sb.from('meeting_briefs')
      .select('title, meeting_date, summary, decisions, action_items')
      .eq('project_id', projectId)
      .gte('meeting_date', cutoff.slice(0, 10))
      .order('meeting_date', { ascending: false })
      .limit(5),
    sb.from('alerts')
      .select('tipo, nivel, descripcion, created_at')
      .eq('project_id', projectId)
      .gte('created_at', cutoff)
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  const messages = msgRes.data || []
  const briefs = briefRes.data || []
  const alerts = alertRes.data || []

  const clientMsgs = messages.filter(m => m.es_del_cliente)
  const lastClientMsg = clientMsgs[0]?.timestamp || null
  const msg_count_72h = messages.length
  const meeting_count_72h = briefs.length
  const alert_count_72h = alerts.length

  // If no activity, return simple message
  if (msg_count_72h === 0 && meeting_count_72h === 0 && alert_count_72h === 0) {
    return {
      recap_text: 'Sin actividad registrada en las últimas 72 horas.',
      msg_count_72h: 0,
      meeting_count_72h: 0,
      alert_count_72h: 0,
      last_client_msg: null,
    }
  }

  // Build context for Gemini
  const msgSample = messages.slice(0, 30).map((m: any) =>
    `[${new Date(m.timestamp).toLocaleString('es-MX', { timeZone: 'America/El_Salvador' })}] ${m.es_del_cliente ? 'CLIENTE' : 'EQUIPO'} (${m.fuente || 'whatsapp'}): ${(m.contenido || '').slice(0, 200)}`
  ).join('\n')

  const briefSample = briefs.map(b =>
    `REUNIÓN: ${b.title} (${b.meeting_date})\nResumen: ${b.summary || ''}\nDecisiones: ${(b.decisions || []).join(', ')}\nAction items: ${(b.action_items || []).join(', ')}`
  ).join('\n\n')

  const alertSample = alerts.map(a =>
    `ALERTA [${a.nivel}]: ${a.tipo} — ${a.descripcion}`
  ).join('\n')

  const prompt = `Eres un asistente de operations de ORA AI. Genera un brief detallado de las últimas 72 horas del proyecto "${projectName}".

DATOS DISPONIBLES:

${msgSample ? `MENSAJES WhatsApp/Slack (${msg_count_72h} total, mostrando últimos 30):\n${msgSample}` : 'Sin mensajes en 72h.'}
${briefSample ? `\nREUNIONES/MEETS:\n${briefSample}` : '\nSin reuniones en 72h.'}
${alertSample ? `\nALERTAS DETECTADAS:\n${alertSample}` : '\nSin alertas en 72h.'}

Instrucciones para el brief:
1. **Resumen ejecutivo** (2-3 oraciones): qué pasó en general, cómo está la comunicación
2. **Estado del cliente** (1-2 oraciones): cómo se ve el cliente, si está activo, si tiene dudas/problemas
3. **Temas clave tratados**: lista bullet de los temas principales que surgieron en los mensajes
4. **Pendientes / Action items**: qué quedó pendiente, qué necesita seguimiento del equipo
5. **Riesgos** (solo si hay): señales de alerta o fricción detectadas

Formato: usa los emojis 📋 🤝 💬 ⚡ ⚠️ para los encabezados de cada sección.
Tono: directo, operacional, como una nota de briefing para el equipo.
NO menciones que eres IA. Responde en español.`

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 800 },
        }),
      }
    )
    const data = await res.json()
    const recap_text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
      || 'No se pudo generar el resumen automático.'
    return { recap_text, msg_count_72h, meeting_count_72h, alert_count_72h, last_client_msg: lastClientMsg }
  } catch {
    return {
      recap_text: `${msg_count_72h} mensaje${msg_count_72h !== 1 ? 's' : ''} en 72h${meeting_count_72h > 0 ? `, ${meeting_count_72h} reunión${meeting_count_72h > 1 ? 'es' : ''}` : ''}${alert_count_72h > 0 ? `. ${alert_count_72h} alerta${alert_count_72h > 1 ? 's' : ''} activa${alert_count_72h > 1 ? 's' : ''}` : ''}.`,
      msg_count_72h, meeting_count_72h, alert_count_72h, last_client_msg: lastClientMsg,
    }
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const forceRefresh = req.nextUrl.searchParams.get('refresh') === '1'

  // Check cache
  if (!forceRefresh) {
    const { data: cached } = await sb
      .from('project_recaps')
      .select('*')
      .eq('project_id', id)
      .single()

    if (cached) {
      const ageHours = (Date.now() - new Date(cached.generated_at).getTime()) / (1000 * 60 * 60)
      if (ageHours < CACHE_HOURS) {
        return NextResponse.json({ ...cached, cached: true })
      }
    }
  }

  // Get project name
  const { data: project } = await sb
    .from('projects')
    .select('nombre')
    .eq('id', id)
    .single()

  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  // Generate new recap
  const recap = await generateRecap(id, project.nombre)

  // Save to cache (upsert)
  await sb.from('project_recaps').upsert({
    project_id: id,
    ...recap,
    generated_at: new Date().toISOString(),
  }, { onConflict: 'project_id' })

  return NextResponse.json({ project_id: id, ...recap, cached: false })
}
