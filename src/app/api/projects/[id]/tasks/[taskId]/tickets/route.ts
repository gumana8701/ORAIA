/**
 * POST /api/projects/[id]/tasks/[taskId]/tickets — create ticket
 * PATCH /api/projects/[id]/tasks/[taskId]/tickets — resolve/reassign ticket
 * GET  /api/projects/[id]/tasks/[taskId]/tickets — list tickets for task
 */
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const SLACK_TOKEN = process.env.SLACK_BOT_TOKEN || ''
const APP_URL     = process.env.NEXT_PUBLIC_APP_URL || 'https://oraia-five.vercel.app'

// Slack IDs for @mention
const SLACK_IDS: Record<string, string> = {
  'Jennifer Serrano': 'U09220MVB33',
  'Trina Gomez':      'U09BGLR8C02',
  'Enzo ORA IA':      'U09L1EP6FT3',
  'Luca Fonzo':       'U09R5BFE1QR',
  'Brenda Cruz':      'U0AH84KRQMV',
  'Victor Ramirez':   'U0AKZ4SD8GJ',
  'Héctor Ramirez':   'U09BAM705MM',
  'Hector Ramirez':   'U09BAM705MM',
}

async function slackPost(method: string, body: Record<string, any>) {
  if (!SLACK_TOKEN) return { ok: false }
  const r = await fetch(`https://slack.com/api/${method}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${SLACK_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return r.json()
}

async function addTaskComment(taskId: string, projectId: string, content: string, author: string) {
  await sb.from('task_comments').insert({ task_id: taskId, project_id: projectId, content, author, created_at: new Date().toISOString() })
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  const { taskId } = await params
  const { data, error } = await sb.from('task_tickets').select('*').eq('task_id', taskId).order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  const { id: projectId, taskId } = await params
  const { description, assignee, requested_by, mark_blocked = false } = await req.json()

  if (!description?.trim() || !assignee) return NextResponse.json({ error: 'description and assignee required' }, { status: 400 })

  const now = new Date().toISOString()

  // Get task + project info
  const { data: task } = await sb.from('project_tasks').select('title, status').eq('id', taskId).single()
  const { data: proj } = await sb.from('projects').select('nombre, slack_channel_id').eq('id', projectId).single()

  // If mark_blocked, update task status
  if (mark_blocked && task?.status !== 'bloqueado') {
    await sb.from('project_tasks').update({ status: 'bloqueado', completed: false, status_changed_at: now, updated_at: now }).eq('id', taskId)
    // Log status history
    await sb.from('task_status_history').insert({ task_id: taskId, project_id: projectId, status: 'bloqueado', changed_at: now, changed_by: requested_by })
  }

  // Create alert for follow-ups
  const alertMention = SLACK_IDS[assignee] ? `<@${SLACK_IDS[assignee]}>` : assignee
  let alertId: string | null = null
  const { data: alert } = await sb.from('alerts').insert({
    project_id: projectId,
    alert_type: 'ticket_blocked',
    title: `Ticket: ${task?.title || 'Tarea'} — asignado a ${assignee}`,
    descripcion: `Ticket abierto por ${requested_by} para ${assignee}`,
    status: 'open',
    slack_channel_id: proj?.slack_channel_id || null,
    send_after: now,
    send_count: 1,
    max_sends: 10,
    tipo: 'otro', nivel: 'alto', resuelta: false,
    created_at: now, updated_at: now,
    last_sent_at: now,
  }).select('id').single()
  alertId = alert?.id || null

  // Create ticket
  const { data: ticket, error } = await sb.from('task_tickets').insert({
    task_id: taskId, project_id: projectId,
    description: description.trim(), assignee, requested_by,
    status: 'open', alert_id: alertId,
    created_at: now, updated_at: now,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Add comment to task
  await addTaskComment(taskId, projectId, `🎫 *Ticket abierto* por *${requested_by}* para *${assignee}*:\n${description.trim()}`, 'Sistema')

  // Send immediate Slack alert
  if (proj?.slack_channel_id) {
    const taskUrl = `${APP_URL}/login?next=${encodeURIComponent(`/proyectos/${projectId}?tab=tareas`)}`
    const res = await slackPost('chat.postMessage', {
      channel: proj.slack_channel_id,
      text: `🎫 Nuevo ticket — ${alertMention} necesita apoyo`,
      blocks: [
        { type: 'section', text: { type: 'mrkdwn', text: `🎫 *Nuevo ticket de soporte* — ${alertMention}\n\n*Tarea:* ${task?.title || '—'}\n*Solicitado por:* ${requested_by}\n*Descripción:* ${description.trim()}` } },
        { type: 'actions', elements: [{ type: 'button', text: { type: 'plain_text', text: '🔍 Ver tarea' }, url: taskUrl, style: 'primary' }] },
        { type: 'context', elements: [{ type: 'mrkdwn', text: `_Se enviará recordatorio cada 24h hasta que el ticket se resuelva_` }] },
      ],
    })
    // Save thread_ts to alert and ticket
    if (res.ok && res.ts) {
      await sb.from('alerts').update({ slack_thread_ts: res.ts, updated_at: now }).eq('id', alertId)
      await sb.from('task_tickets').update({ slack_thread_ts: res.ts }).eq('id', ticket.id)
    }
  }

  return NextResponse.json(ticket)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  const { id: projectId, taskId } = await params
  const { ticket_id, action, new_assignee, resolved_by, notes } = await req.json()

  const { data: ticket } = await sb.from('task_tickets').select('*, alert_id').eq('id', ticket_id).single() as { data: any }
  if (!ticket) return NextResponse.json({ error: 'ticket not found' }, { status: 404 })

  const now = new Date()
  const { data: proj } = await sb.from('projects').select('nombre, slack_channel_id').eq('id', projectId).single()
  const { data: task } = await sb.from('project_tasks').select('title').eq('id', taskId).single()

  if (action === 'resolve') {
    const resSecs = Math.round((now.getTime() - new Date(ticket.created_at).getTime()) / 1000)
    const daysOpen = Math.round(resSecs / 86400 * 10) / 10

    await sb.from('task_tickets').update({ status: 'resolved', resolved_by: resolved_by || 'Equipo', resolved_at: now.toISOString(), resolution_seconds: resSecs, updated_at: now.toISOString() }).eq('id', ticket_id)

    // Close alert
    if (ticket.alert_id) {
      await sb.from('alerts').update({ status: 'resolved', resolved_at: now.toISOString(), resolved_by: resolved_by || 'Equipo', resolution_seconds: resSecs }).eq('id', ticket.alert_id)
    }

    // Move task to en_progreso
    await sb.from('project_tasks').update({ status: 'en_progreso', status_changed_at: now.toISOString(), updated_at: now.toISOString() }).eq('id', taskId)
    await sb.from('task_status_history').insert({ task_id: taskId, project_id: projectId, status: 'en_progreso', changed_at: now.toISOString(), changed_by: resolved_by || 'Equipo' })

    // Comment on task
    const noteText = notes ? `\n_"${notes}"_` : ''
    await addTaskComment(taskId, projectId, `✅ *Ticket resuelto* por *${resolved_by || 'Equipo'}* en ${daysOpen} días.${noteText}`, 'Sistema')

    // Slack notification
    if (proj?.slack_channel_id && ticket.slack_thread_ts) {
      await slackPost('chat.postMessage', {
        channel: proj.slack_channel_id,
        thread_ts: ticket.slack_thread_ts,
        text: `✅ Ticket resuelto por *${resolved_by || 'Equipo'}* (${daysOpen} días). Tarea → *en progreso*.`,
      })
    }

  } else if (action === 'reassign' && new_assignee) {
    await sb.from('task_tickets').update({ assignee: new_assignee, updated_at: now.toISOString() }).eq('id', ticket_id)

    const mention = SLACK_IDS[new_assignee] ? `<@${SLACK_IDS[new_assignee]}>` : new_assignee
    await addTaskComment(taskId, projectId, `🔄 *Ticket reasignado* a *${new_assignee}* por *${resolved_by || 'Equipo'}*`, 'Sistema')

    if (proj?.slack_channel_id && ticket.slack_thread_ts) {
      await slackPost('chat.postMessage', {
        channel: proj.slack_channel_id,
        thread_ts: ticket.slack_thread_ts,
        text: `🔄 Ticket reasignado a ${mention} por *${resolved_by || 'Equipo'}*. Por favor atiende en cuanto puedas.`,
      })
    }
  }

  return NextResponse.json({ ok: true })
}
