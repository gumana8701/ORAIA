/**
 * POST /api/meetings/ingest
 *
 * Ingesta completa de transcripts de Google Meet via n8n.
 * Pipeline:
 *   1. Gemini analiza el transcript
 *   2. Guarda meeting_brief (summary, decisions, action_items, participants)
 *   3. Upserta KPIs extraídos en project_kpis
 *   4. Crea alertas si hay riesgos detectados
 *   5. Registra actividad en messages (fuente: google_meet)
 *   6. Actualiza ultimo_mensaje + ultima_actividad en projects
 *
 * Headers:
 *   x-webhook-secret: <MEETINGS_WEBHOOK_SECRET>
 *
 * Body:
 * {
 *   title: string,
 *   meeting_date: string,       // ISO 8601
 *   transcript: string,
 *   project_id?: string,        // UUID (opcional, se busca por project_name si no viene)
 *   project_name?: string,      // Para auto-match
 *   participants?: string[],
 *   drive_link?: string,
 *   duration_minutes?: number,
 *   source?: string             // default: "google_meet"
 * }
 */

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// ─── Types ────────────────────────────────────────────────────────────────────

interface IngestPayload {
  title: string
  meeting_date: string
  transcript: string
  project_id?: string
  project_name?: string
  participants?: string[]
  drive_link?: string
  duration_minutes?: number
  source?: string
}

interface GeminiAnalysis {
  summary: string
  decisions: string[]
  action_items: string[]
  participants: string[]
  ai_confidence: number
  // Project management enrichment
  kpis: Array<{ kpi_text: string; categoria: string; meta: string }>
  alerts: Array<{ tipo: string; descripcion: string; nivel: string }>
  progreso?: number          // 0-100 si se menciona avance
  estado?: string            // activo | en_riesgo | pausado | completado
  proyecto_detectado?: string // Si el transcript menciona el nombre del proyecto
}

// ─── Slack notification ───────────────────────────────────────────────────────

async function notifySlack(analysis: GeminiAnalysis, payload: IngestPayload, projectId: string | null, briefId: string, stats: Record<string, unknown>) {
  const SLACK_TOKEN = process.env.SLACK_BOT_TOKEN
  const DM_CHANNEL  = process.env.SLACK_ALERT_DM

  if (!SLACK_TOKEN || !DM_CHANNEL) return // env vars not set yet

  const alertEmoji  = (analysis.alerts.length > 0)
    ? analysis.alerts.some(a => a.nivel === 'critico' || a.nivel === 'alto') ? '🔴' : '🟡'
    : '🟢'

  const lines: string[] = [
    `${alertEmoji} *Nuevo transcript procesado*`,
    `📋 *${payload.title}*`,
    `🗓️ ${new Date(payload.meeting_date).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })}`,
  ]

  if (projectId) lines.push(`🔗 project_id: \`${projectId}\``)

  if (analysis.summary) lines.push(`\n📝 ${analysis.summary.slice(0, 280)}`)

  if (analysis.decisions.length > 0) {
    lines.push(`\n✅ *Decisiones (${analysis.decisions.length}):*`)
    analysis.decisions.slice(0, 3).forEach(d => lines.push(`  • ${d}`))
  }

  if (analysis.action_items.length > 0) {
    lines.push(`\n🎯 *Pendientes (${analysis.action_items.length}):*`)
    analysis.action_items.slice(0, 3).forEach(a => lines.push(`  • ${a}`))
  }

  if (analysis.alerts.length > 0) {
    lines.push(`\n⚠️ *Alertas generadas (${analysis.alerts.length}):*`)
    analysis.alerts.forEach(a => {
      const icon = a.nivel === 'critico' ? '🔴' : a.nivel === 'alto' ? '🟠' : a.nivel === 'medio' ? '🟡' : '⚪'
      lines.push(`  ${icon} [${a.tipo.toUpperCase()}] ${a.descripcion}`)
    })
  }

  if ((stats.kpis_inserted as number) > 0) {
    lines.push(`\n📊 ${stats.kpis_inserted} KPI(s) extraídos → pendientes de confirmar en la webapp`)
  }

  lines.push(`\n_brief_id: ${briefId}_`)

  await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${SLACK_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ channel: DM_CHANNEL, text: lines.join('\n') }),
  }).catch(err => console.error('[meetings/ingest] Slack notify error:', err))
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function analyzeWithGemini(payload: IngestPayload): Promise<GeminiAnalysis> {
  const GEMINI_KEY = process.env.GEMINI_API_KEY

  // Trim transcript to avoid token limits
  const transcriptSnippet = payload.transcript.slice(0, 80000)

  const participantsHint = payload.participants?.length
    ? `\nParticipantes conocidos: ${payload.participants.join(', ')}`
    : ''
  const projectHint = payload.project_name
    ? `\nProyecto: "${payload.project_name}"`
    : ''

  const prompt = `Eres un analista senior de project management. Analiza el transcript de esta reunión de Google Meet y extrae TODA la información estructurada.

Reunión: "${payload.title}"
Fecha: ${payload.meeting_date}${projectHint}${participantsHint}

TRANSCRIPT:
${transcriptSnippet}

Responde ÚNICAMENTE con un JSON válido (sin markdown, sin \`\`\`, sin texto extra):
{
  "summary": "Resumen ejecutivo de 3-5 oraciones en español. Qué se discutió, estado del proyecto, decisiones clave.",
  "decisions": ["Decisión tomada 1", "Decisión tomada 2"],
  "action_items": ["Tarea pendiente 1 (responsable: nombre si se menciona)", "Tarea 2"],
  "participants": ["Nombre 1", "Nombre 2"],
  "ai_confidence": 0.95,
  "kpis": [
    {
      "kpi_text": "Descripción corta del KPI o meta mencionada en la reunión",
      "categoria": "una de: entrega | calidad | comunicacion | financiero | tecnico | cliente | otro",
      "meta": "Valor o descripción de la meta si se menciona, ej: '2 semanas', '$5000', 'antes del viernes'"
    }
  ],
  "alerts": [
    {
      "tipo": "uno de: cancelacion | reembolso | enojo | pago | entrega | urgente | silencio | otro",
      "descripcion": "Descripción clara del riesgo o problema identificado",
      "nivel": "uno de: bajo | medio | alto | critico"
    }
  ],
  "progreso": 65,
  "estado": "activo",
  "proyecto_detectado": "Nombre del proyecto si se menciona explícitamente en el transcript"
}

Reglas importantes:
- summary: español, directo, útil para un manager
- decisions: solo lo que se DECIDIÓ formalmente (puede ser [] si no hay)
- action_items: tareas concretas con responsable si se menciona
- kpis: extrae CUALQUIER métrica, objetivo, entregable, o meta mencionada (puede ser [] si no hay)
- alerts: detecta problemas, riesgos, quejas, retrasos, cancelaciones (puede ser [] si no hay)
- progreso: número 0-100 SOLO si el transcript menciona % de avance explícitamente, si no → null
- estado: SOLO si hay señales claras (cancelación → en_riesgo, completado → completado), si no → null
- proyecto_detectado: null si no se menciona nombre de proyecto
- ai_confidence: 0.0-1.0 según calidad y completitud del transcript`

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.15, maxOutputTokens: 2048 },
      }),
    }
  )

  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text().then(t => t.slice(0, 200))}`)

  const data = await res.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

  try {
    const parsed = JSON.parse(cleaned)
    return {
      summary:             parsed.summary             ?? '',
      decisions:           Array.isArray(parsed.decisions)   ? parsed.decisions   : [],
      action_items:        Array.isArray(parsed.action_items) ? parsed.action_items : [],
      participants:        Array.isArray(parsed.participants) ? parsed.participants : (payload.participants ?? []),
      ai_confidence:       typeof parsed.ai_confidence === 'number' ? parsed.ai_confidence : 0.8,
      kpis:                Array.isArray(parsed.kpis)    ? parsed.kpis    : [],
      alerts:              Array.isArray(parsed.alerts)  ? parsed.alerts  : [],
      progreso:            typeof parsed.progreso === 'number' ? parsed.progreso : undefined,
      estado:              parsed.estado              ?? undefined,
      proyecto_detectado:  parsed.proyecto_detectado  ?? undefined,
    }
  } catch {
    return {
      summary: text.slice(0, 500),
      decisions: [], action_items: [],
      participants: payload.participants ?? [],
      ai_confidence: 0.3,
      kpis: [], alerts: [],
    }
  }
}

async function resolveProjectId(payload: IngestPayload, proyecto_detectado?: string): Promise<string | null> {
  if (payload.project_id) return payload.project_id

  const sb = supabase()
  const searchName = payload.project_name || proyecto_detectado
  if (!searchName) return null

  const { data } = await sb
    .from('projects')
    .select('id')
    .ilike('nombre', `%${searchName}%`)
    .limit(1)
    .single()

  return data?.id ?? null
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Auth
  const secret = req.headers.get('x-webhook-secret')
  const expectedSecret = process.env.MEETINGS_WEBHOOK_SECRET
  if (expectedSecret && secret !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Parse
  let payload: IngestPayload
  try { payload = await req.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  if (!payload.title || !payload.transcript || !payload.meeting_date) {
    return NextResponse.json(
      { error: 'Missing: title, transcript, meeting_date' },
      { status: 400 }
    )
  }

  // ── 1. Gemini analysis ────────────────────────────────────────────────────
  let analysis: GeminiAnalysis
  try {
    analysis = await analyzeWithGemini(payload)
  } catch (err) {
    console.error('[meetings/ingest] Gemini error:', err)
    analysis = {
      summary: '', decisions: [], action_items: [],
      participants: payload.participants ?? [],
      ai_confidence: 0, kpis: [], alerts: [],
    }
  }

  // ── 2. Resolve project ────────────────────────────────────────────────────
  const projectId = await resolveProjectId(payload, analysis.proyecto_detectado)

  const sb = supabase()
  const results: Record<string, unknown> = {}

  // ── 3. Insert meeting_brief ───────────────────────────────────────────────
  const { data: brief, error: briefErr } = await sb
    .from('meeting_briefs')
    .insert({
      title:            payload.title,
      meeting_date:     payload.meeting_date,
      transcript_raw:   payload.transcript,
      drive_link:       payload.drive_link   ?? null,
      source:           payload.source       ?? 'google_meet',
      duration_minutes: payload.duration_minutes ?? null,
      project_id:       projectId,
      summary:          analysis.summary,
      decisions:        analysis.decisions,
      action_items:     analysis.action_items,
      participants:     analysis.participants,
      ai_confidence:    analysis.ai_confidence,
    })
    .select('id')
    .single()

  if (briefErr) {
    console.error('[meetings/ingest] brief insert error:', briefErr)
    return NextResponse.json({ error: 'brief insert failed', detail: briefErr.message }, { status: 500 })
  }

  results.brief_id = brief.id

  // ── 4. Upsert KPIs ────────────────────────────────────────────────────────
  if (projectId && analysis.kpis.length > 0) {
    const kpiRows = analysis.kpis.map(k => ({
      project_id:      projectId,
      source_brief_id: brief.id,
      kpi_text:        k.kpi_text,
      categoria:       k.categoria,
      meta:            k.meta,
      confirmado:      false,
    }))

    const { error: kpiErr } = await sb.from('project_kpis').insert(kpiRows)
    if (kpiErr) console.error('[meetings/ingest] kpi insert error:', kpiErr)
    results.kpis_inserted = kpiErr ? 0 : kpiRows.length
  }

  // ── 5. Insert alerts ──────────────────────────────────────────────────────
  if (projectId && analysis.alerts.length > 0) {
    const alertRows = analysis.alerts.map(a => ({
      project_id:  projectId,
      tipo:        a.tipo,
      descripcion: a.descripcion,
      nivel:       a.nivel,
      resuelta:    false,
    }))

    const { error: alertErr } = await sb.from('alerts').insert(alertRows)
    if (alertErr) console.error('[meetings/ingest] alert insert error:', alertErr)
    results.alerts_created = alertErr ? 0 : alertRows.length
  }

  // ── 6. Log as message (Activity Feed) ────────────────────────────────────
  if (projectId) {
    const msgContent = `🎥 Reunión: ${payload.title}\n\n${analysis.summary}${
      analysis.action_items.length > 0
        ? '\n\n📌 Pendientes:\n' + analysis.action_items.map(a => `• ${a}`).join('\n')
        : ''
    }`

    await sb.from('messages').insert({
      project_id:    projectId,
      fuente:        'google_meet',
      sender:        'Google Meet',
      contenido:     msgContent,
      timestamp:     payload.meeting_date,
      es_del_cliente: false,
      metadata: {
        brief_id:   brief.id,
        drive_link: payload.drive_link ?? null,
        participants: analysis.participants,
        decisions_count: analysis.decisions.length,
        action_items_count: analysis.action_items.length,
      },
    })
    results.message_logged = true
  }

  // ── 7. Update project: last activity + optional status/progress ───────────
  if (projectId) {
    const updatePayload: Record<string, unknown> = {
      ultima_actividad: payload.meeting_date,
      ultimo_mensaje:   analysis.summary.slice(0, 200) || `Reunión: ${payload.title}`,
    }

    if (analysis.progreso !== undefined) updatePayload.progreso = analysis.progreso
    if (analysis.estado)                 updatePayload.estado   = analysis.estado

    const { error: projErr } = await sb
      .from('projects')
      .update(updatePayload)
      .eq('id', projectId)

    if (projErr) console.error('[meetings/ingest] project update error:', projErr)
    results.project_updated = !projErr
  }

  // ── 8. Slack DM notification ──────────────────────────────────────────────
  await notifySlack(analysis, payload, projectId, brief.id, results)

  // ── Response ──────────────────────────────────────────────────────────────
  return NextResponse.json({
    ok:             true,
    brief_id:       brief.id,
    project_id:     projectId,
    ai_confidence:  analysis.ai_confidence,
    summary_preview: analysis.summary.slice(0, 150),
    stats: {
      kpis_inserted:    results.kpis_inserted    ?? 0,
      alerts_created:   results.alerts_created   ?? 0,
      message_logged:   results.message_logged   ?? false,
      project_updated:  results.project_updated  ?? false,
    },
  })
}
