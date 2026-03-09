import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function generateProjectSummary(
  projectName: string,
  messages: Array<{ contenido: string; fuente: string; sender: string; timestamp: string }>,
  alertCount: number
): Promise<string> {
  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY
  if (!ANTHROPIC_KEY || messages.length === 0) return ''

  const msgSample = messages.slice(0, 15).map(m =>
    `[${m.fuente.toUpperCase()} · ${m.sender}]: ${m.contenido.slice(0, 150)}`
  ).join('\n')

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 180,
        messages: [{
          role: 'user',
          content: `Eres un analista de proyectos. Analiza estos mensajes del proyecto "${projectName}" de las últimas 72h y genera un resumen ejecutivo en 2-3 líneas máximo en español. Sé directo y específico. Menciona: estado actual, temas principales, y si hay algo urgente. ${alertCount > 0 ? `Hay ${alertCount} alerta(s) activa(s).` : ''}

MENSAJES (${messages.length} total, mostrando muestra):
${msgSample}

Responde SOLO el resumen, sin introducción ni formato extra.`
        }]
      }),
    })
    const data = await res.json()
    return (data.content?.[0]?.text || '').trim()
  } catch { return '' }
}

export async function GET() {
  const client  = sb()
  const since72 = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString()

  const [msgRes, alertRes, projRes] = await Promise.all([
    client
      .from('messages')
      .select('project_id, contenido, timestamp, sender, fuente')
      .gte('timestamp', since72)
      .not('project_id', 'is', null)
      .order('timestamp', { ascending: false })
      .limit(500),
    client
      .from('alerts')
      .select('project_id, nivel, tipo, descripcion, created_at')
      .eq('resuelta', false),
    client
      .from('projects')
      .select('id, nombre, estado, cliente, responsable, progreso'),
  ])

  const messages = msgRes.data   ?? []
  const alerts   = alertRes.data ?? []
  const projects = projRes.data  ?? []

  const projMap: Record<string, typeof projects[0]> = {}
  for (const p of projects) projMap[p.id] = p

  const alertsByProject: Record<string, typeof alerts> = {}
  for (const a of alerts) {
    if (!alertsByProject[a.project_id]) alertsByProject[a.project_id] = []
    alertsByProject[a.project_id].push(a)
  }

  // Group messages by project, tracking sources
  const byProject: Record<string, {
    msgs: Array<{ contenido: string; fuente: string; sender: string; timestamp: string }>
    senders: Set<string>
    sources: Set<string>
    ultimoTimestamp: string
  }> = {}

  for (const m of messages) {
    if (!m.project_id) continue
    if (!byProject[m.project_id]) {
      byProject[m.project_id] = {
        msgs: [],
        senders: new Set(),
        sources: new Set(),
        ultimoTimestamp: m.timestamp,
      }
    }
    const entry = byProject[m.project_id]
    entry.msgs.push({ contenido: m.contenido ?? '', fuente: m.fuente, sender: m.sender, timestamp: m.timestamp })
    if (m.sender) entry.senders.add(m.sender)
    entry.sources.add(m.fuente)
  }

  // Generate AI summaries in parallel (max 6 to stay within timeout)
  const projectEntries = Object.entries(byProject)
    .sort((a, b) => new Date(b[1].ultimoTimestamp).getTime() - new Date(a[1].ultimoTimestamp).getTime())
    .slice(0, 8)

  const summaries = await Promise.all(
    projectEntries.map(([pid, d]) =>
      generateProjectSummary(
        projMap[pid]?.nombre ?? pid,
        d.msgs,
        (alertsByProject[pid] ?? []).length
      )
    )
  )

  const proyectos = projectEntries.map(([pid, d], i) => {
    const proj   = projMap[pid]
    const projAlerts = alertsByProject[pid] ?? []
    const criticalAlerts = projAlerts.filter(a => a.nivel === 'critico' || a.nivel === 'alto')
    const lastMsg = d.msgs[0]

    return {
      id:               pid,
      nombre:           proj?.nombre ?? pid,
      estado:           proj?.estado ?? 'activo',
      cliente:          proj?.cliente ?? '',
      responsable:      proj?.responsable ?? '',
      progreso:         proj?.progreso ?? 0,
      msgs:             d.msgs.length,
      ultimoMensaje:    lastMsg?.contenido ?? '',
      ultimoTimestamp:  d.ultimoTimestamp,
      alertas:          projAlerts.length,
      alertasCriticas:  criticalAlerts.length,
      topAlertas:       criticalAlerts.slice(0, 2).map(a => ({ tipo: a.tipo, nivel: a.nivel, desc: a.descripcion?.slice(0, 80) })),
      senders:          [...d.senders].slice(0, 4),
      fuentes:          [...d.sources],
      resumenIA:        summaries[i] ?? '',
    }
  })

  return NextResponse.json({
    proyectos,
    totalMsgs:    messages.length,
    totalAlertas: alerts.length,
    generatedAt:  new Date().toISOString(),
  })
}
