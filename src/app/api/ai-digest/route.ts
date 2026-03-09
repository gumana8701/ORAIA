import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET() {
  const client  = sb()
  const since72 = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString()

  const [msgRes, alertRes, projRes] = await Promise.all([
    client
      .from('messages')
      .select('project_id, contenido, timestamp, sender')
      .gte('timestamp', since72)
      .order('timestamp', { ascending: false }),
    client
      .from('alerts')
      .select('project_id, nivel, created_at')
      .eq('resuelta', false),
    client
      .from('projects')
      .select('id, nombre, estado'),
  ])

  const messages = msgRes.data   ?? []
  const alerts   = alertRes.data ?? []
  const projects = projRes.data  ?? []

  // Build lookup maps
  const projMap: Record<string, { nombre: string; estado: string }> = {}
  for (const p of projects) projMap[p.id] = { nombre: p.nombre, estado: p.estado }

  const alertCount: Record<string, number> = {}
  for (const a of alerts) {
    alertCount[a.project_id] = (alertCount[a.project_id] ?? 0) + 1
  }

  // Group messages by project (most recent first per project)
  const byProject: Record<string, {
    msgs: number
    ultimoMensaje: string
    ultimoTimestamp: string
    senders: Set<string>
  }> = {}

  for (const m of messages) {
    if (!byProject[m.project_id]) {
      byProject[m.project_id] = {
        msgs: 0,
        ultimoMensaje: m.contenido ?? '',
        ultimoTimestamp: m.timestamp,
        senders: new Set(),
      }
    }
    const entry = byProject[m.project_id]
    entry.msgs++
    if (m.sender) entry.senders.add(m.sender)
    // Since messages are ordered DESC, first encountered = most recent
    // ultimoMensaje/Timestamp already set on creation (first = latest)
  }

  // Build sorted result — by most recent activity
  const proyectos = Object.entries(byProject)
    .map(([pid, d]) => ({
      id: pid,
      nombre: projMap[pid]?.nombre ?? pid,
      estado: projMap[pid]?.estado ?? 'activo',
      msgs: d.msgs,
      ultimoMensaje: d.ultimoMensaje,
      ultimoTimestamp: d.ultimoTimestamp,
      alertas: alertCount[pid] ?? 0,
      senders: [...d.senders].slice(0, 4), // max 4 names
    }))
    .sort((a, b) => new Date(b.ultimoTimestamp).getTime() - new Date(a.ultimoTimestamp).getTime())

  return NextResponse.json({
    proyectos,
    totalMsgs: messages.length,
    generatedAt: new Date().toISOString(),
  })
}
