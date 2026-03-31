/**
 * POST /api/voice/create-task
 * Called by BOB (ElevenLabs voice agent) via server tool webhook.
 *
 * Body:
 * {
 *   project_name: string,           // exact or partial project name
 *   title: string,                  // task title
 *   description?: string,           // optional description / notes
 *   assignee: string,               // team member name
 *   priority?: 'alta'|'normal'|'baja',
 *   due_date?: string,              // ISO date YYYY-MM-DD
 *   category?: string,              // 'Agente de Voz' | 'WhatsApp/Texto'
 *   checklist_items?: string[],     // checklist for main task
 *   subtasks?: Array<{
 *     title: string,
 *     assignee?: string,
 *     description?: string,
 *     checklist_items?: string[]
 *   }>
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

async function slackPost(method: string, body: Record<string, any>) {
  if (!SLACK_TOKEN) return { ok: false }
  const r = await fetch(`https://slack.com/api/${method}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${SLACK_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return r.json()
}

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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      project_name,
      title,
      description,
      assignee: rawAssignee,
      priority = 'normal',
      due_date,
      category,
      checklist_items = [],
      subtasks = [],
    } = body

    // ── Validate required fields ──────────────────────────────────────────
    if (!project_name?.trim()) return NextResponse.json({ error: 'project_name required', success: false }, { status: 400 })
    if (!title?.trim())        return NextResponse.json({ error: 'title required', success: false }, { status: 400 })

    // ── Resolve assignee ──────────────────────────────────────────────────
    const assignee = fuzzyMatchTeam(rawAssignee || '') || rawAssignee || null

    // ── Find project by name (fuzzy) ──────────────────────────────────────
    const { data: allProjects } = await sb
      .from('projects')
      .select('id, nombre, slack_channel_id')
      .in('estado', ['activo', 'en_riesgo', 'pausado'])
      .order('ultima_actividad', { ascending: false })

    if (!allProjects?.length) {
      return NextResponse.json({ error: 'No projects found', success: false }, { status: 404 })
    }

    const lowerSearch = project_name.toLowerCase()
    let project = allProjects.find(p =>
      p.nombre?.toLowerCase() === lowerSearch
    ) || allProjects.find(p =>
      p.nombre?.toLowerCase().includes(lowerSearch) || lowerSearch.includes(p.nombre?.toLowerCase())
    )

    if (!project) {
      const projectNames = allProjects.slice(0, 20).map(p => p.nombre).join(', ')
      return NextResponse.json({
        error: `Project "${project_name}" not found. Available: ${projectNames}`,
        success: false,
      }, { status: 404 })
    }

    const projectId = project.id
    const now = new Date().toISOString()

    // ── Get next order_index ──────────────────────────────────────────────
    const { data: existingTasks } = await sb
      .from('project_tasks')
      .select('order_index')
      .eq('project_id', projectId)
      .is('parent_task_id', null)
      .order('order_index', { ascending: false })
      .limit(1)
    const nextIndex = (existingTasks?.[0]?.order_index ?? -1) + 1

    // ── Create main task ──────────────────────────────────────────────────
    const { data: task, error: taskError } = await sb
      .from('project_tasks')
      .insert({
        project_id:  projectId,
        title:       title.trim(),
        description: description?.trim() || null,
        notes:       description?.trim() || null,
        assignee:    assignee,
        priority:    priority,
        due_date:    due_date || null,
        category:    category || null,
        status:      'pendiente',
        completed:   false,
        order_index: nextIndex,
        created_at:  now,
        updated_at:  now,
      })
      .select()
      .single()

    if (taskError || !task) {
      return NextResponse.json({ error: taskError?.message || 'Failed to create task', success: false }, { status: 500 })
    }

    // ── Create checklist items for main task ──────────────────────────────
    if (checklist_items.length > 0) {
      await sb.from('task_checklist_items').insert(
        checklist_items.map((text: string, i: number) => ({
          task_id:     task.id,
          project_id:  projectId,
          text:        text.trim(),
          order_index: i,
          created_at:  now,
          updated_at:  now,
        }))
      )
    }

    // ── Create subtasks ───────────────────────────────────────────────────
    const createdSubtasks: any[] = []
    for (let i = 0; i < subtasks.length; i++) {
      const sub = subtasks[i]
      const subAssignee = fuzzyMatchTeam(sub.assignee || '') || sub.assignee || assignee

      const { data: subtask } = await sb
        .from('project_tasks')
        .insert({
          project_id:     projectId,
          parent_task_id: task.id,
          title:          sub.title.trim(),
          description:    sub.description?.trim() || null,
          notes:          sub.description?.trim() || null,
          assignee:       subAssignee,
          status:         'pendiente',
          completed:      false,
          order_index:    i,
          created_at:     now,
          updated_at:     now,
        })
        .select()
        .single()

      if (subtask) {
        createdSubtasks.push(subtask)
        // Create checklist items for subtask
        const subChecklist = sub.checklist_items || []
        if (subChecklist.length > 0) {
          await sb.from('task_checklist_items').insert(
            subChecklist.map((text: string, j: number) => ({
              task_id:     subtask.id,
              project_id:  projectId,
              text:        text.trim(),
              order_index: j,
              created_at:  now,
              updated_at:  now,
            }))
          )
        }
      }
    }

    // ── Update project activity ───────────────────────────────────────────
    await sb
      .from('projects')
      .update({ ultima_actividad: now })
      .eq('id', projectId)

    // ── Send Slack notification ───────────────────────────────────────────
    if (project.slack_channel_id) {
      const taskUrl = `${APP_URL}/proyectos/${projectId}?tab=tareas`
      const assigneeMention = assignee && SLACK_IDS[assignee] ? `<@${SLACK_IDS[assignee]}>` : assignee || 'Sin asignar'

      const priorityEmoji = priority === 'alta' ? '🔴' : priority === 'baja' ? '⚪' : '🟡'
      const dueDateText   = due_date ? `\n📅 *Fecha límite:* ${due_date}` : ''
      const subtasksText  = createdSubtasks.length > 0
        ? `\n📋 *Subtareas:* ${createdSubtasks.map(s => `• ${s.title}`).join(', ')}`
        : ''
      const checklistText = checklist_items.length > 0
        ? `\n✅ *Checklist (${checklist_items.length} items)*`
        : ''
      const descText = description ? `\n_${description.trim()}_` : ''

      await slackPost('chat.postMessage', {
        channel: project.slack_channel_id,
        text: `🤖 BOB creó una tarea para ${assigneeMention} — ${project.nombre}`,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `🤖 *BOB creó una nueva tarea* en *${project.nombre}*\n\n*${title.trim()}*${descText}\n\n👤 *Asignado a:* ${assigneeMention}\n${priorityEmoji} *Prioridad:* ${priority}${dueDateText}${subtasksText}${checklistText}`,
            },
          },
          {
            type: 'actions',
            elements: [
              {
                type:  'button',
                text:  { type: 'plain_text', text: '📋 Ver tareas' },
                url:   taskUrl,
                style: 'primary',
              },
            ],
          },
        ],
      })
    }

    return NextResponse.json({
      success:   true,
      task_id:   task.id,
      project:   project.nombre,
      assignee:  assignee,
      title:     task.title,
      subtasks:  createdSubtasks.length,
      checklist: checklist_items.length,
      message:   `✅ Tarea "${title.trim()}" creada en ${project.nombre} y asignada a ${assignee || 'sin asignar'}. ${createdSubtasks.length > 0 ? `${createdSubtasks.length} subtarea(s) incluida(s).` : ''} ${checklist_items.length > 0 ? `Checklist con ${checklist_items.length} item(s).` : ''} Notificación enviada a Slack.`,
    })
  } catch (err: any) {
    console.error('voice/create-task error:', err)
    return NextResponse.json({ error: err.message, success: false }, { status: 500 })
  }
}
