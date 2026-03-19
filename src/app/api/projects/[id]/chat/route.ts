/**
 * POST /api/projects/[id]/chat
 * Body: { message: string, history?: {role, content}[] }
 * Mini PM agent — knows everything about the project
 */
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const GEMINI_KEY = process.env.GEMINI_API_KEY

async function getProjectContext(projectId: string, query: string) {
  const since30d = new Date(Date.now() - 30 * 86400000).toISOString()
  const isSearch = query.length > 3

  const [projRes, msgRes, briefRes, alertRes, kpiRes, notionRes] = await Promise.all([
    sb.from('projects').select('*').eq('id', projectId).single(),
    // Smart search: if query looks like a search, use ilike; otherwise get recent
    isSearch
      ? sb.from('messages').select('contenido,timestamp,es_del_cliente,fuente')
          .eq('project_id', projectId)
          .ilike('contenido', `%${query.split(' ').slice(0, 3).join('%')}%`)
          .order('timestamp', { ascending: false }).limit(20)
      : sb.from('messages').select('contenido,timestamp,es_del_cliente,fuente')
          .eq('project_id', projectId)
          .gte('timestamp', since30d)
          .order('timestamp', { ascending: false }).limit(40),
    sb.from('meeting_briefs').select('title,meeting_date,summary,decisions,action_items,participants')
      .eq('project_id', projectId).order('meeting_date', { ascending: false }).limit(10),
    sb.from('alerts').select('tipo,nivel,descripcion,created_at,resuelta')
      .eq('project_id', projectId).order('created_at', { ascending: false }).limit(10),
    sb.from('project_kpis').select('kpi_text,categoria,meta').eq('project_id', projectId),
    sb.from('notion_projects').select('nombre,estado,etapas,responsable,plan_type,kick_off_date,lanzamiento_real,info_util,contact_email,contact_phone')
      .eq('project_id', projectId).limit(1).maybeSingle(),
  ])

  return {
    project: projRes.data,
    messages: msgRes.data || [],
    briefs: briefRes.data || [],
    alerts: alertRes.data || [],
    kpis: kpiRes.data || [],
    notion: notionRes.data,
  }
}

function buildSystemPrompt(ctx: Awaited<ReturnType<typeof getProjectContext>>) {
  const { project, messages, briefs, alerts, kpis, notion } = ctx
  if (!project) return ''

  const msgText = messages.slice(0, 30).map((m: any) =>
    `[${new Date(m.timestamp).toLocaleString('es-MX', { timeZone: 'America/El_Salvador' })}] ${m.es_del_cliente ? 'CLIENTE' : 'EQUIPO'} (${m.fuente || 'wa'}): ${(m.contenido || '').slice(0, 300)}`
  ).join('\n')

  const briefText = briefs.map((b: any) =>
    `📅 ${b.title} (${b.meeting_date}): ${b.summary || ''} | Decisiones: ${(b.decisions || []).join(', ')} | Action items: ${(b.action_items || []).join(', ')}`
  ).join('\n')

  const alertText = alerts.map((a: any) =>
    `[${a.nivel}] ${a.tipo}: ${a.descripcion} (${a.resuelta ? 'resuelta' : 'activa'})`
  ).join('\n')

  const kpiText = kpis.map((k: any) => `• ${k.kpi_text} (${k.categoria}${k.meta ? ' — meta: '+k.meta : ''})`).join('\n')

  return `Eres el PM Agent de ORA IA para el proyecto "${project.nombre}". Tienes acceso completo a toda la información del proyecto.

## PROYECTO
- Nombre: ${project.nombre}
- Estado: ${project.estado || '—'}
- Última actividad: ${project.ultima_actividad || '—'}
- Alertas activas: ${project.alertas_count || 0}
${notion ? `
## NOTION
- Etapa: ${(notion.etapas || []).join(', ') || '—'}
- Sesiones: ${notion.estado || '—'}
- Plan: ${notion.plan_type || '—'}
- Responsable: ${(notion.responsable || []).join(', ') || '—'}
- Kick-off: ${notion.kick_off_date || '—'}
- Lanzamiento: ${notion.lanzamiento_real || '—'}
- Email cliente: ${notion.contact_email || '—'}
- Tel. cliente: ${notion.contact_phone || '—'}
${notion.info_util ? `- Info útil: ${notion.info_util}` : ''}` : ''}

## KPIs
${kpiText || 'Sin KPIs definidos'}

## MENSAJES RECIENTES (WhatsApp/Slack)
${msgText || 'Sin mensajes recientes'}

## REUNIONES / MEETS
${briefText || 'Sin reuniones registradas'}

## ALERTAS
${alertText || 'Sin alertas'}

## INSTRUCCIONES
- Responde en español, tono directo y profesional
- Si te piden buscar un mensaje específico, busca en el contexto y cita el texto exacto con fecha
- Si no tienes la información, dilo claramente
- Eres un mini PM que sabe todo de este proyecto — responde con autoridad
- Máximo 300 palabras salvo que se pida un resumen largo
- NO menciones que eres IA`
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { message, history = [] } = await req.json()
  if (!message) return NextResponse.json({ error: 'message required' }, { status: 400 })
  if (!GEMINI_KEY) return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 })

  const ctx = await getProjectContext(id, message)
  const systemPrompt = buildSystemPrompt(ctx)

  // Build conversation for Gemini
  const contents = [
    // System as first user turn (Gemini doesn't have system role)
    { role: 'user', parts: [{ text: systemPrompt + '\n\nEntendido. Estoy listo para responder preguntas sobre este proyecto.' }] },
    { role: 'model', parts: [{ text: `Entendido. Soy el PM Agent de "${ctx.project?.nombre}". ¿En qué puedo ayudarte?` }] },
    // Previous history
    ...history.slice(-8).map((h: { role: string; content: string }) => ({
      role: h.role === 'user' ? 'user' : 'model',
      parts: [{ text: h.content }],
    })),
    // Current message
    { role: 'user', parts: [{ text: message }] },
  ]

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          generationConfig: { temperature: 0.4, maxOutputTokens: 600 },
        }),
      }
    )
    const data = await res.json()
    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
    if (!reply) return NextResponse.json({ error: 'No response from AI', raw: data }, { status: 500 })
    return NextResponse.json({ reply })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
