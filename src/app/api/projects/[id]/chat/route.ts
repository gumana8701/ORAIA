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
  const queryLower = query.toLowerCase()

  // Detect if user is asking about a specific time period
  const timePatterns = [
    { re: /hace\s+(\d+)\s+mes/i,    fn: (m: RegExpMatchArray) => new Date(Date.now() - parseInt(m[1]) * 30 * 86400000).toISOString() },
    { re: /hace\s+(\d+)\s+semana/i, fn: (m: RegExpMatchArray) => new Date(Date.now() - parseInt(m[1]) * 7 * 86400000).toISOString() },
    { re: /hace\s+(\d+)\s+d[íi]a/i, fn: (m: RegExpMatchArray) => new Date(Date.now() - parseInt(m[1]) * 86400000).toISOString() },
    { re: /(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)/i, fn: () => null },
  ]

  let sinceDate: string | null = null
  for (const p of timePatterns) {
    const m = query.match(p.re)
    if (m) { sinceDate = p.fn(m); break }
  }

  // Keywords to search across full history
  const searchKeywords = query
    .replace(/[¿?!.,]/g, '')
    .split(' ')
    .filter(w => w.length > 4 && !['sobre','donde','cuando','cuanto','quien','como','para','este','esta','eso','ese','una','uno','los','las','del','que','fue','con'].includes(w.toLowerCase()))
    .slice(0, 5)

  const isDeepSearch = searchKeywords.length > 0 || sinceDate

  const [projRes, recentMsgRes, searchMsgRes, briefRes, alertRes, kpiRes, notionRes, tasksRes] = await Promise.all([
    sb.from('projects').select('*').eq('id', projectId).single(),

    // Always get last 60 recent messages
    sb.from('messages').select('contenido,timestamp,es_del_cliente,fuente,sender')
      .eq('project_id', projectId)
      .order('timestamp', { ascending: false })
      .limit(60),

    // Deep search: look through ALL history for relevant messages
    isDeepSearch
      ? sb.from('messages').select('contenido,timestamp,es_del_cliente,fuente,sender')
          .eq('project_id', projectId)
          .or(searchKeywords.map(kw => `contenido.ilike.%${kw}%`).join(','))
          .order('timestamp', { ascending: false })
          .limit(30)
      : Promise.resolve({ data: [] as any[] }),

    sb.from('meeting_briefs').select('title,meeting_date,summary,decisions,action_items,participants')
      .eq('project_id', projectId).order('meeting_date', { ascending: false }).limit(15),

    sb.from('alerts').select('tipo,nivel,descripcion,created_at,resuelta')
      .eq('project_id', projectId).order('created_at', { ascending: false }).limit(15),

    sb.from('project_kpis').select('kpi_text,categoria,meta,confirmado').eq('project_id', projectId),

    sb.from('notion_projects').select('nombre,estado,etapas,responsable,plan_type,kick_off_date,lanzamiento_real,info_util,contact_email,contact_phone')
      .eq('project_id', projectId).limit(1).maybeSingle(),

    // Include tasks with their status
    sb.from('project_tasks').select('title,status,assignee,priority,due_date,notes,completed_at')
      .eq('project_id', projectId).is('parent_task_id', null).order('order_index'),
  ])

  // Merge recent + search results, deduplicate by content+timestamp
  const allMessages = [...(recentMsgRes.data || []), ...(searchMsgRes.data || [])]
  const seen = new Set<string>()
  const messages = allMessages.filter(m => {
    const key = `${m.timestamp}-${m.contenido?.slice(0, 50)}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  return {
    project: projRes.data,
    messages,
    briefs: briefRes.data || [],
    alerts: alertRes.data || [],
    kpis: kpiRes.data || [],
    notion: notionRes.data,
    tasks: tasksRes.data || [],
    searchKeywords,
  }
}

function buildSystemPrompt(ctx: Awaited<ReturnType<typeof getProjectContext>>) {
  const { project, messages, briefs, alerts, kpis, notion, tasks, searchKeywords } = ctx
  if (!project) return ''

  const msgText = messages.map((m: any) => {
    const date = new Date(m.timestamp).toLocaleString('es-MX', {
      timeZone: 'America/El_Salvador', day: '2-digit', month: 'short',
      year: 'numeric', hour: '2-digit', minute: '2-digit',
    })
    const who = m.es_del_cliente ? 'CLIENTE' : `EQUIPO${m.sender ? ' ('+m.sender+')' : ''}`
    return `[${date}] ${who}: ${(m.contenido || '').slice(0, 400)}`
  }).join('\n')

  const briefText = briefs.map((b: any) =>
    `📅 ${b.title} (${b.meeting_date}):\n  Resumen: ${b.summary || '—'}\n  Decisiones: ${(b.decisions || []).join(' | ')}\n  Pendientes: ${(b.action_items || []).join(' | ')}\n  Participantes: ${(b.participants || []).join(', ')}`
  ).join('\n\n')

  const alertText = alerts.map((a: any) =>
    `[${a.nivel?.toUpperCase()}] ${a.tipo}: ${a.descripcion} — ${new Date(a.created_at).toLocaleDateString('es-MX')} (${a.resuelta ? '✅ resuelta' : '🔴 activa'})`
  ).join('\n')

  const kpiText = kpis.map((k: any) =>
    `• [${k.categoria}] ${k.kpi_text}${k.meta ? ' — meta: '+k.meta : ''} ${k.confirmado ? '✅' : '⏳'}`
  ).join('\n')

  const tasksText = tasks.map((t: any) => {
    const flags = [
      t.priority === 'alta' ? '🔴 ALTA' : '',
      t.due_date ? `📅 ${t.due_date}` : '',
      t.assignee ? `👤 ${t.assignee}` : '',
    ].filter(Boolean).join(' ')
    return `• [${t.status?.toUpperCase()}] ${t.title}${flags ? ' — '+flags : ''}${t.notes ? ' — Notas: '+t.notes : ''}`
  }).join('\n')

  const searchNote = searchKeywords.length > 0
    ? `\n⚠️ BÚSQUEDA ACTIVA: El usuario preguntó sobre "${searchKeywords.join(', ')}". Los mensajes del contexto incluyen resultados de búsqueda por esas palabras en TODO el historial del proyecto, no solo los recientes. Cita fechas exactas cuando encuentres coincidencias.`
    : ''

  return `Eres el Copiloto de Proyecto de ORA IA para "${project.nombre}". Eres el experto que conoce TODA la historia de este proyecto.${searchNote}

## PROYECTO
- Nombre: ${project.nombre}
- Estado: ${project.estado || '—'} | Alertas activas: ${project.alertas_count || 0}
- Última actividad: ${project.ultima_actividad ? new Date(project.ultima_actividad).toLocaleDateString('es-MX') : '—'}
- Descripción empresa: ${(project as any).descripcion_empresa || '—'}
- Objetivo: ${(project as any).objetivo_proyecto || '—'}
${notion ? `
## DATOS NOTION
- Etapa actual: ${(notion.etapas || []).join(', ') || '—'}
- Plan: ${notion.plan_type || '—'}
- Responsable: ${Array.isArray(notion.responsable) ? notion.responsable.join(', ') : (notion.responsable || '—')}
- Kick-off: ${notion.kick_off_date || '—'} | Lanzamiento: ${notion.lanzamiento_real || '—'}
- Contacto: ${notion.contact_email || '—'} / ${notion.contact_phone || '—'}
${notion.info_util ? `- Info útil: ${notion.info_util}` : ''}` : ''}

## TAREAS DEL PROYECTO (${tasks.length} total)
${tasksText || 'Sin tareas registradas'}

## KPIs
${kpiText || 'Sin KPIs'}

## HISTORIAL DE MENSAJES (${messages.length} mensajes cargados — incluye búsqueda histórica si aplica)
${msgText || 'Sin mensajes'}

## REUNIONES Y MEETS (${briefs.length})
${briefText || 'Sin reuniones registradas'}

## ALERTAS (${alerts.length})
${alertText || 'Sin alertas'}

## INSTRUCCIONES CRÍTICAS
- Responde en español, tono directo y profesional como un PM senior
- Cuando el usuario pregunta si algo "ya se mencionó antes": busca en el historial de mensajes y CITA el texto exacto con fecha y hora
- Si el cliente dice "estoy enojado por X": busca en historial cuándo se mencionó X por primera vez, muestra el patrón
- Si preguntan por una fecha específica: busca en ese rango y reporta exactamente
- Si no encuentras algo en el contexto cargado, dilo claramente: "No encuentro ese mensaje en el historial disponible"
- Sé el defensor del equipo ORA IA: cuando el cliente dice algo que ya se resolvió, confirma con evidencia del historial
- Máximo 400 palabras salvo que se pida resumen completo
- Nunca digas que eres IA`
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
    { role: 'model', parts: [{ text: `Listo. Soy el Copiloto del proyecto "${ctx.project?.nombre}". Tengo acceso a ${ctx.messages.length} mensajes del historial, ${ctx.tasks.length} tareas y todas las reuniones. ¿Qué necesitas saber?` }] },
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
          generationConfig: { temperature: 0.4, maxOutputTokens: 1200 },
        }),
      }
    )
    const data = await res.json()
    // gemini-2.5-flash may return thinking parts (thought: true) before the actual response
    const parts: any[] = data?.candidates?.[0]?.content?.parts || []
    const replyPart = parts.find((p: any) => !p.thought && p.text) || parts[0]
    const reply = replyPart?.text?.trim()
    if (!reply) return NextResponse.json({ error: 'No response from AI', raw: data }, { status: 500 })
    return NextResponse.json({ reply })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
