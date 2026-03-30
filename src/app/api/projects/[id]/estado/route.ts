import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const GEMINI_MODEL   = 'gemini-2.5-flash'

// ── GET /api/projects/[id]/estado ────────────────────────────────────────────
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  // Gather all project data in parallel
  const [projRes, tasksRes, alertsRes, kpisRes, notionRes] = await Promise.all([
    sb.from('projects').select('nombre, nicho, descripcion_empresa, objetivo_proyecto, estado, prioridad, maturity_stage, total_mensajes, ultima_actividad, fecha_inicio').eq('id', id).single(),
    sb.from('project_tasks').select('title, status, completed, assignee, category, notes, time_pendiente_seconds, time_bloqueado_seconds, parent_task_id').eq('project_id', id).is('parent_task_id', null).order('order_index'),
    sb.from('alerts').select('tipo, nivel, descripcion, created_at').eq('project_id', id).eq('resuelta', false).order('created_at', { ascending: false }).limit(20),
    sb.from('project_kpis').select('kpi_text, categoria, confirmado').eq('project_id', id),
    sb.from('notion_projects').select('etapas, plan_type').eq('project_id', id).maybeSingle(),
  ])

  const proyecto  = projRes.data
  const tasks     = tasksRes.data || []
  const alertas   = alertsRes.data || []
  const kpis      = kpisRes.data || []
  const notion    = notionRes.data

  if (!proyecto) return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 })

  // Categorize tasks
  const completadas  = tasks.filter(t => t.status === 'completado')
  const bloqueadas   = tasks.filter(t => t.status === 'bloqueado')
  const enProgreso   = tasks.filter(t => t.status === 'en_progreso')
  const pendientes   = tasks.filter(t => t.status === 'pendiente' && !t.completed)
  const pct          = tasks.length > 0 ? Math.round((completadas.length / tasks.length) * 100) : 0

  // Build context for Gemini
  const context = `
PROYECTO: ${proyecto.nombre}
Nicho: ${proyecto.nicho || 'No especificado'}
Descripción empresa: ${proyecto.descripcion_empresa || 'No disponible'}
Objetivo: ${proyecto.objetivo_proyecto || 'No especificado'}
Estado actual: ${proyecto.estado || 'No especificado'}
Prioridad: ${proyecto.prioridad || 'No especificada'}
Madurez: ${proyecto.maturity_stage || 'No especificada'}
Fecha inicio: ${proyecto.fecha_inicio || 'No especificada'}
Plan contratado: ${notion?.plan_type || 'No especificado'}
Etapas Notion: ${notion?.etapas?.join(', ') || 'No disponible'}
Mensajes totales: ${proyecto.total_mensajes || 0}
Última actividad: ${proyecto.ultima_actividad || 'Desconocida'}

PROGRESO DE TAREAS: ${pct}% completado (${completadas.length}/${tasks.length})

TAREAS COMPLETADAS (${completadas.length}):
${completadas.map(t => `  ✅ ${t.title}${t.assignee ? ` [${t.assignee}]` : ''}`).join('\n') || '  Ninguna'}

TAREAS EN PROGRESO (${enProgreso.length}):
${enProgreso.map(t => `  🔄 ${t.title}${t.assignee ? ` [${t.assignee}]` : ''}`).join('\n') || '  Ninguna'}

TAREAS BLOQUEADAS (${bloqueadas.length}):
${bloqueadas.map(t => `  🚫 ${t.title}${t.assignee ? ` [${t.assignee}]` : ''}${t.notes ? ` — ${t.notes}` : ''}`).join('\n') || '  Ninguna'}

TAREAS PENDIENTES (${pendientes.length}):
${pendientes.map(t => `  ⏳ ${t.title}${t.assignee ? ` [${t.assignee}]` : ''}`).join('\n') || '  Ninguna'}

KPIs DEL PROYECTO:
${kpis.map(k => `  • [${k.categoria}] ${k.kpi_text} ${k.confirmado ? '✅' : '⏳'}`).join('\n') || '  Sin KPIs definidos'}

ALERTAS ACTIVAS (${alertas.length}):
${alertas.map(a => `  ⚠️ [${a.nivel?.toUpperCase()}] ${a.tipo}: ${a.descripcion}`).join('\n') || '  Sin alertas activas'}
`.trim()

  const prompt = `Eres el analista de proyecto de ORA IA. Genera un Estado del Proyecto claro, directo y accionable en español.

DATOS DEL PROYECTO:
${context}

INSTRUCCIONES:
1. Escribe en un tono profesional pero directo, como un PM reportando a un cliente.
2. Sé honesto sobre bloqueos y riesgos — no suavices problemas críticos.
3. La longitud ideal es 4-6 párrafos bien estructurados.
4. Usa emojis con moderación para marcar secciones clave.
5. Termina con las 2-3 acciones MÁS URGENTES que necesitan atención inmediata.

ESTRUCTURA (sigue este orden):
- **Estado general**: En qué etapa está el proyecto, porcentaje de avance, percepción general.
- **Lo que se ha logrado**: Principales hitos completados recientemente.
- **En curso**: Qué está siendo trabajado ahora mismo y por quién.
- **Bloqueos y riesgos**: Sé explícito aquí si hay tareas bloqueadas o alertas. Es lo más importante.
- **Próximos pasos urgentes**: Lista las 2-3 acciones más críticas con formato de bullet points.

Responde SOLO con el análisis en texto plano con markdown básico (negrita con ** y bullets con -). No incluyas JSON ni metadatos.`

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1024,
          },
        }),
      }
    )

    const geminiData = await res.json()
    const text = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || 'No se pudo generar el análisis.'

    return NextResponse.json({
      estado: text,
      meta: {
        pct,
        total: tasks.length,
        completadas: completadas.length,
        bloqueadas: bloqueadas.length,
        enProgreso: enProgreso.length,
        pendientes: pendientes.length,
        alertas: alertas.length,
      },
      alertas,
      generatedAt: new Date().toISOString(),
    })
  } catch (err) {
    return NextResponse.json({ error: 'Error llamando a Gemini', detail: String(err) }, { status: 500 })
  }
}
