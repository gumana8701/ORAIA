/**
 * POST /api/meetings/ingest
 *
 * Recibe transcripts de Google Meet via n8n, los procesa con Gemini AI,
 * y los almacena en la tabla `meeting_briefs` de Supabase.
 *
 * Headers requeridos:
 *   x-webhook-secret: <MEETINGS_WEBHOOK_SECRET>
 *
 * Body (JSON):
 * {
 *   title: string,               // Título de la reunión
 *   meeting_date: string,         // ISO 8601 (ej: "2026-03-13T14:00:00Z")
 *   transcript: string,           // Texto completo del transcript
 *   project_id?: string,          // UUID del proyecto en Supabase (opcional)
 *   project_name?: string,        // Nombre del proyecto para matching (opcional)
 *   participants?: string[],       // Lista de participantes (opcional, Gemini puede extraerlos)
 *   drive_link?: string,          // Link al documento en Drive (opcional)
 *   duration_minutes?: number,    // Duración en minutos (opcional)
 *   source?: string               // "google_meet" | "zoom" | etc (default: "google_meet")
 * }
 */

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

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
  project_match?: string
  ai_confidence: number
}

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function analyzeWithGemini(payload: IngestPayload): Promise<GeminiAnalysis> {
  const GEMINI_KEY = process.env.GEMINI_API_KEY || 'AIzaSyCXasYSgKTdLX5mZLR0jFntO7HB0CUmWOw'

  // Trim transcript to avoid token limits (Gemini 1.5 Flash handles ~100k tokens)
  const transcriptSnippet = payload.transcript.slice(0, 80000)

  const participantsHint = payload.participants?.length
    ? `\nParticipantes conocidos: ${payload.participants.join(', ')}`
    : ''

  const projectHint = payload.project_name
    ? `\nEste meeting es del proyecto: "${payload.project_name}"`
    : ''

  const prompt = `Eres un analista de proyectos. Analiza el siguiente transcript de una reunión de Google Meet y extrae la información estructurada en JSON.

Reunión: "${payload.title}"
Fecha: ${payload.meeting_date}${projectHint}${participantsHint}

TRANSCRIPT:
${transcriptSnippet}

Responde ÚNICAMENTE con un JSON válido con esta estructura exacta (sin markdown, sin \`\`\`):
{
  "summary": "Resumen ejecutivo de 3-5 oraciones en español. Qué se discutió, estado del proyecto, decisiones clave.",
  "decisions": ["Decisión 1", "Decisión 2"],
  "action_items": ["Tarea pendiente 1 (responsable: nombre)", "Tarea pendiente 2"],
  "participants": ["Nombre 1", "Nombre 2"],
  "ai_confidence": 0.95
}

Reglas:
- summary: siempre en español, directo y ejecutivo
- decisions: solo lo que se decidió formalmente (vacío [] si no hay nada)
- action_items: tareas concretas con responsable si se menciona
- participants: extrae nombres reales del transcript
- ai_confidence: entre 0.0 y 1.0 según la calidad del transcript`

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 1024,
        },
      }),
    }
  )

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Gemini error ${res.status}: ${err.slice(0, 200)}`)
  }

  const data = await res.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

  // Strip markdown code fences if present
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

  try {
    const parsed = JSON.parse(cleaned)
    return {
      summary: parsed.summary ?? '',
      decisions: Array.isArray(parsed.decisions) ? parsed.decisions : [],
      action_items: Array.isArray(parsed.action_items) ? parsed.action_items : [],
      participants: Array.isArray(parsed.participants) ? parsed.participants : (payload.participants ?? []),
      ai_confidence: typeof parsed.ai_confidence === 'number' ? parsed.ai_confidence : 0.8,
    }
  } catch {
    // Fallback: return raw text as summary
    return {
      summary: text.slice(0, 500),
      decisions: [],
      action_items: [],
      participants: payload.participants ?? [],
      ai_confidence: 0.3,
    }
  }
}

async function findProjectByName(name: string): Promise<string | null> {
  if (!name) return null
  const sb = supabase()
  const { data } = await sb
    .from('projects')
    .select('id, nombre')
    .ilike('nombre', `%${name}%`)
    .limit(1)
    .single()
  return data?.id ?? null
}

export async function POST(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const secret = req.headers.get('x-webhook-secret')
  const expectedSecret = process.env.MEETINGS_WEBHOOK_SECRET

  if (expectedSecret && secret !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let payload: IngestPayload
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!payload.title || !payload.transcript || !payload.meeting_date) {
    return NextResponse.json(
      { error: 'Missing required fields: title, transcript, meeting_date' },
      { status: 400 }
    )
  }

  // ── Resolve project_id ────────────────────────────────────────────────────
  let projectId = payload.project_id ?? null

  if (!projectId && payload.project_name) {
    projectId = await findProjectByName(payload.project_name)
  }

  // ── Gemini analysis ───────────────────────────────────────────────────────
  let analysis: GeminiAnalysis
  try {
    analysis = await analyzeWithGemini(payload)
  } catch (err) {
    console.error('[meetings/ingest] Gemini error:', err)
    // Fallback: store raw without AI analysis
    analysis = {
      summary: '',
      decisions: [],
      action_items: [],
      participants: payload.participants ?? [],
      ai_confidence: 0,
    }
  }

  // ── Upsert to Supabase ────────────────────────────────────────────────────
  const sb = supabase()

  const record = {
    title: payload.title,
    meeting_date: payload.meeting_date,
    transcript_raw: payload.transcript,
    drive_link: payload.drive_link ?? null,
    source: payload.source ?? 'google_meet',
    duration_minutes: payload.duration_minutes ?? null,
    project_id: projectId,
    summary: analysis.summary,
    decisions: analysis.decisions,
    action_items: analysis.action_items,
    participants: analysis.participants,
    ai_confidence: analysis.ai_confidence,
  }

  const { data, error } = await sb
    .from('meeting_briefs')
    .insert(record)
    .select('id')
    .single()

  if (error) {
    console.error('[meetings/ingest] Supabase error:', error)
    return NextResponse.json(
      { error: 'Database insert failed', detail: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({
    ok: true,
    id: data.id,
    project_id: projectId,
    ai_confidence: analysis.ai_confidence,
    summary_preview: analysis.summary.slice(0, 120),
  })
}
