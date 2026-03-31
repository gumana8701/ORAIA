/**
 * POST /api/voice/add-subtask
 * BOB calls this to add a subtask with checklist to an existing task.
 *
 * Body:
 * {
 *   parent_task_id: string,
 *   project_id?: string,       // optional if parent task has it
 *   title: string,
 *   description?: string,
 *   assignee?: string,
 *   checklist_items?: string[]
 * }
 */
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const SLACK_TOKEN = process.env.SLACK_BOT_TOKEN || ''
const APP_URL     = process.env.NEXT_PUBLIC_APP_URL || 'https://oraia-five.vercel.app'

const SLACK_IDS: Record<string, string> = {
  'Jennifer Serrano': 'U09220MVB33',
  'Trina Gomez':      'U09BGLR8C02',
  'Enzo ORA IA':      'U09L1EP6FT3',
  'Luca Fonzo':       'U09R5BFE1QR',
  'Brenda Cruz':      'U0AH84KRQMV',
  'Victor Ramirez':   'U0AKZ4SD8GJ',
  'Héctor Ramirez':   'U09BAM705MM',
  'Hector Ramirez':   'U09BAM705MM',
  'Kevin ORA IA':     'U09L1EP6FT3',
}

const TEAM_NAMES = [
  'Enzo ORA IA', 'Héctor Ramirez', 'Victor Ramirez', 'Brenda Cruz',
  'Kevin ORA IA', 'Luca Fonzo', 'Jennifer Serrano', 'Trina Gomez',
]

function fuzzyMatchTeam(name: string): string | null {
  if (!name) return null
  const lower = name.toLowerCase()
  for (const member of TEAM_NAMES) {
    if (member.toLowerCase().includes(lower) || lower.includes(member.toLowerCase().split(' ')[0].toLowerCase())) {
      return member
    }
  }
  return null
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

export async function POST(req: NextRequest) {
  try {
    const { parent_task_id, project_id: bodyProjectId, title, description, assignee: rawAssignee, checklist_items = [] } = await req.json()

    if (!parent_task_id) return NextResponse.json({ error: 'parent_task_id required', success: false }, { status: 400 })
    if (!title?.trim())  return NextResponse.json({ error: 'title required', success: false }, { status: 400 })

    // Fetch parent task to get project_id, title, assignee
    const { data: parent } = await sb
      .from('project_tasks')
      .select('id, title, project_id, assignee')
      .eq('id', parent_task_id)
      .single()

    if (!parent) return NextResponse.json({ error: 'Parent task not found', success: false }, { status: 404 })

    const projectId  = bodyProjectId || parent.project_id
    const assignee   = fuzzyMatchTeam(rawAssignee || '') || rawAssignee || parent.assignee || null
    const now        = new Date().toISOString()

    // Get next order_index among subtasks
    const { data: siblings } = await sb
      .from('project_tasks')
      .select('order_index')
      .eq('parent_task_id', parent_task_id)
      .order('order_index', { ascending: false })
      .limit(1)
    const nextIndex = (siblings?.[0]?.order_index ?? -1) + 1

    // Create subtask
    const { data: subtask, error } = await sb
      .from('project_tasks')
      .insert({
        project_id:     projectId,
        parent_task_id: parent_task_id,
        title:          title.trim(),
        description:    description?.trim() || null,
        notes:          description?.trim() || null,
        assignee:       assignee,
        status:         'pendiente',
        completed:      false,
        order_index:    nextIndex,
        created_at:     now,
        updated_at:     now,
      })
      .select()
      .single()

    if (error || !subtask) return NextResponse.json({ error: error?.message || 'Failed', success: false }, { status: 500 })

    // Create checklist items
    if (checklist_items.length > 0) {
      await sb.from('task_checklist_items').insert(
        checklist_items.map((text: string, i: number) => ({
          task_id:     subtask.id,
          project_id:  projectId,
          text:        text.trim(),
          order_index: i,
          created_at:  now,
          updated_at:  now,
        }))
      )
    }

    // Add comment to parent task
    const checklistSummary = checklist_items.length > 0
      ? `\n\nChecklist:\n${checklist_items.map((t: string) => `• ${t}`).join('\n')}`
      : ''
    await sb.from('task_comments').insert({
      task_id:    parent_task_id,
      project_id: projectId,
      author:     'BOB',
      content:    `🤖 *BOB agregó subtarea:* "${title.trim()}" → asignada a ${assignee || 'Sin asignar'}${checklistSummary}`,
      created_at: now,
    }).catch(() => {}) // non-blocking

    // Send Slack notification
    const { data: proj } = await sb
      .from('projects')
      .select('nombre, slack_channel_id')
      .eq('id', projectId)
      .single()

    if (proj?.slack_channel_id) {
      const assigneeMention = assignee && SLACK_IDS[assignee] ? `<@${SLACK_IDS[assignee]}>` : (assignee || 'Sin asignar')
      const taskUrl = `${APP_URL}/proyectos/${projectId}?tab=tareas`
      const checklistBlock = checklist_items.length > 0
        ? `\n\n*Checklist de requisitos (${checklist_items.length} items):*\n${checklist_items.map((t: string) => `• ${t}`).join('\n')}`
        : ''

      await slackPost('chat.postMessage', {
        channel: proj.slack_channel_id,
        text:    `🤖 BOB agregó una subtarea para ${assigneeMention} en "${parent.title}"`,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `🤖 *BOB agregó una subtarea* en *${proj.nombre}*\n\n📌 *Tarea padre:* ${parent.title}\n➕ *Nueva subtarea:* ${title.trim()}\n👤 *Asignado a:* ${assigneeMention}${checklistBlock}`,
            },
          },
          {
            type: 'actions',
            elements: [{ type: 'button', text: { type: 'plain_text', text: '📋 Ver tareas' }, url: taskUrl, style: 'primary' }],
          },
        ],
      })
    }

    return NextResponse.json({
      success:        true,
      subtask_id:     subtask.id,
      parent_title:   parent.title,
      subtask_title:  title.trim(),
      assignee:       assignee,
      checklist:      checklist_items.length,
      message:        `✅ Subtarea "${title.trim()}" agregada a "${parent.title}", asignada a ${assignee || 'sin asignar'}. ${checklist_items.length > 0 ? `Checklist de ${checklist_items.length} requisitos incluido.` : ''} Slack notificado.`,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message, success: false }, { status: 500 })
  }
}
