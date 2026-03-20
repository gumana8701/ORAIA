/**
 * POST /api/onboarding
 * Project onboarding wizard — creates project, tasks, Slack channel, links welcome call
 */
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const SLACK_TOKEN = process.env.SLACK_BOT_TOKEN || ''

// Always-included Slack members (by display name keywords)
const CORE_MEMBERS = ['jennifer', 'trina', 'guillermo', 'enzo']

const TASKS_VOICE = [
  'Recolección de requerimientos (objetivos y casos de uso)',
  'Configuración de número telefónico (Twilio u otro proveedor)',
  'Redacción y grabación de voces (o configuración de TTS)',
  'Diseño y configuración del flujo de llamadas (IVR, menú, transferencias)',
  'Integración con sistemas externos (CRM, bases de datos, APIs)',
  'Pruebas internas (QA)',
  'Pruebas con cliente',
  'Ajustes finales',
  'Go Live / Puesta en producción',
  'Monitoreo y soporte inicial',
]

const TASKS_WHATSAPP = [
  'Recolección de requerimientos (objetivos y casos de uso)',
  'Conexión del número de WhatsApp/SMS (configuración y verificación)',
  'Configuración del agente/chatbot (flujos conversacionales y respuestas automáticas)',
  'Integración con CRM o sistemas externos',
  'Configuración de AppLevel/permisos y accesos',
  'Pruebas internas (QA)',
  'Pruebas con cliente',
  'Ajustes finales',
  'Go Live / Puesta en producción',
  'Monitoreo y soporte inicial',
]

async function slackPost(method: string, body: Record<string, any>) {
  const res = await fetch(`https://slack.com/api/${method}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SLACK_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  return res.json()
}

async function slackGet(method: string, params: Record<string, string> = {}) {
  const qs = new URLSearchParams(params).toString()
  const res = await fetch(`https://slack.com/api/${method}${qs ? '?' + qs : ''}`, {
    headers: { 'Authorization': `Bearer ${SLACK_TOKEN}` },
  })
  return res.json()
}

async function findSlackUserIds(devNames: string[]): Promise<string[]> {
  try {
    const data = await slackGet('users.list', { limit: '200' })
    if (!data.ok) return []
    const members = data.members || []
    // Split each dev name into words so "Kevin ORA IA" matches "kevin carrillo"
    const allNames = [...CORE_MEMBERS, ...devNames.flatMap(d => d.toLowerCase().split(/\s+/))]
    const ids: string[] = []
    for (const user of members) {
      if (user.is_bot || user.deleted) continue
      const displayName = (user.profile?.display_name || user.name || '').toLowerCase()
      const realName = (user.profile?.real_name || '').toLowerCase()
      if (allNames.some(n => displayName.includes(n) || realName.includes(n))) {
        ids.push(user.id)
      }
    }
    return [...new Set(ids)]
  } catch {
    return []
  }
}

async function createSlackChannel(channelName: string, devNames: string[]): Promise<{
  id: string | null; name: string | null; error: string | null
}> {
  // Slugify channel name
  const slug = channelName.toLowerCase()
    .replace(/[áàä]/g, 'a').replace(/[éèë]/g, 'e').replace(/[íìï]/g, 'i')
    .replace(/[óòö]/g, 'o').replace(/[úùü]/g, 'u').replace(/ñ/g, 'n')
    .replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
    .substring(0, 80)

  const createRes = await slackPost('conversations.create', {
    name: slug,
    is_private: true,
  })

  if (!createRes.ok) {
    return { id: null, name: null, error: createRes.error || 'Could not create channel' }
  }

  const channelId = createRes.channel?.id
  const channelActualName = createRes.channel?.name

  // Invite members
  const userIds = await findSlackUserIds(devNames)
  if (userIds.length > 0) {
    await slackPost('conversations.invite', {
      channel: channelId,
      users: userIds.join(','),
    })
  }

  return { id: channelId, name: channelActualName, error: null }
}

export async function POST(req: NextRequest) {
  try {
    const { projectName, projectTypes, notionProjectId, assignedDevs = [], slackChannelName } = await req.json()

    if (!projectName?.trim()) {
      return NextResponse.json({ error: 'projectName is required' }, { status: 400 })
    }

    const types: string[] = Array.isArray(projectTypes) ? projectTypes : [projectTypes].filter(Boolean)
    const projectType = types.join('+') || 'whatsapp' // 'voice', 'whatsapp', or 'voice+whatsapp'

    const results: Record<string, any> = {}

    // ── 1. Find or create project ──────────────────────────────────────────
    const { data: existing } = await sb
      .from('projects')
      .select('id, nombre')
      .ilike('nombre', projectName.trim())
      .limit(1)
      .maybeSingle()

    let projectId: string

    if (existing) {
      projectId = existing.id
      await sb.from('projects').update({
        project_type: projectType,
        whatsapp_chat_id: projectName.trim(),
        onboarded_at: new Date().toISOString(),
      }).eq('id', projectId)
      results.project = { action: 'updated', id: projectId, nombre: existing.nombre }
    } else {
      const { data: created, error: createErr } = await sb.from('projects').insert({
        nombre: projectName.trim(),
        cliente: projectName.trim(),
        whatsapp_chat_id: projectName.trim(),
        estado: 'activo',
        prioridad: 'media',
        progreso: 0,
        total_mensajes: 0,
        alertas_count: 0,
        project_type: projectType,
        onboarded_at: new Date().toISOString(),
      }).select('id').single()

      if (createErr || !created) {
        return NextResponse.json({ error: 'Failed to create project: ' + createErr?.message }, { status: 500 })
      }
      projectId = created.id
      results.project = { action: 'created', id: projectId, nombre: projectName.trim() }
    }

    // ── 2. Link Notion project ─────────────────────────────────────────────
    if (notionProjectId) {
      await sb.from('notion_projects').update({ project_id: projectId })
        .eq('id', notionProjectId)
      results.notion = { linked: true }
    }

    // ── 3. Create tasks ────────────────────────────────────────────────────
    // Delete existing tasks first
    await sb.from('project_tasks').delete().eq('project_id', projectId)

    // Build task list based on selected types
    let taskList: { title: string; category: string }[] = []
    if (types.includes('voice')) {
      taskList = [...taskList, ...TASKS_VOICE.map(t => ({ title: t, category: 'Agente de Voz' }))]
    }
    if (types.includes('whatsapp')) {
      taskList = [...taskList, ...TASKS_WHATSAPP.map(t => ({ title: t, category: 'WhatsApp/Texto' }))]
    }
    if (taskList.length === 0) {
      taskList = TASKS_WHATSAPP.map(t => ({ title: t, category: 'WhatsApp/Texto' }))
    }

    const tasksToInsert = taskList.map((t, i) => ({
      project_id: projectId,
      title: t.title,
      category: t.category,
      order_index: i,
      completed: false,
      status: 'pendiente',
    }))

    const { data: tasks, error: taskErr } = await sb.from('project_tasks').insert(tasksToInsert).select('id')
    results.tasks = { created: tasks?.length || 0, error: taskErr?.message || null }

    // ── 4. Assign developers in project_developers ────────────────────────
    const { data: allDevs } = await sb.from('developers').select('id, nombre').eq('activo', true)
    if (allDevs && assignedDevs.length > 0) {
      // Always include Enzo as supervisor
      const enzo = allDevs.find(d => d.nombre.toLowerCase().includes('enzo'))
      const devsToAssign: { project_id: string; developer_id: string; rol: string }[] = []

      if (enzo) devsToAssign.push({ project_id: projectId, developer_id: enzo.id, rol: 'supervisor' })

      for (const devName of assignedDevs) {
        const firstWord = devName.split(' ')[0].toLowerCase()
        const match = allDevs.find(d => d.nombre.toLowerCase().includes(firstWord))
        if (match && match.id !== enzo?.id) {
          devsToAssign.push({ project_id: projectId, developer_id: match.id, rol: 'developer' })
        }
      }

      if (devsToAssign.length > 0) {
        await sb.from('project_developers').upsert(devsToAssign, { onConflict: 'project_id,developer_id' })
      }
      results.developers = { assigned: devsToAssign.length }
    }

    // ── 5. Create Slack channel ──────────────────────────────────────────
    const channelSlug = slackChannelName || projectName.trim()
    const slackResult = await createSlackChannel(channelSlug, assignedDevs)

    if (slackResult.id) {
      await sb.from('projects').update({
        slack_channel_id: slackResult.id,
        slack_channel_name: slackResult.name,
      }).eq('id', projectId)
    }
    results.slack = slackResult

    // ── 6. Search for welcome call ─────────────────────────────────────────
    const searchTerm = projectName.trim().substring(0, 15)
    const { data: welcomeCall } = await sb
      .from('meeting_briefs')
      .select('id, title, drive_link, summary, action_items, decisions, transcript_raw')
      .ilike('title', `%${searchTerm}%`)
      .order('meeting_date', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (welcomeCall) {
      // Link it to project if not already linked
      await sb.from('meeting_briefs').update({ project_id: projectId })
        .eq('id', welcomeCall.id)

      // Extract company description, project objective and KPIs with Gemini
      const geminiKey = process.env.GEMINI_API_KEY
      if (geminiKey) {
        try {
          const content = [
            welcomeCall.summary || '',
            (welcomeCall.decisions || []).join('\n'),
            (welcomeCall.action_items || []).join('\n'),
            (welcomeCall.transcript_raw || '').substring(0, 6000),
          ].filter(Boolean).join('\n\n')

          const prompt = `Eres un asistente de operaciones de ORA AI. Analiza esta llamada de bienvenida con el cliente "${projectName}" y extrae:

CONTENIDO:
${content}

Responde SOLO con JSON válido:
{
  "descripcion_empresa": "1-2 oraciones describiendo a qué se dedica el cliente/empresa",
  "objetivo_proyecto": "1-2 oraciones explicando qué quiere lograr con este proyecto de IA",
  "kpis_acordados": ["KPI 1 acordado", "KPI 2 acordado"]
}`

          const gemRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.2, maxOutputTokens: 400 },
              }),
            }
          )
          const gemData = await gemRes.json()
          const text = gemData?.candidates?.[0]?.content?.parts?.[0]?.text || ''
          const jsonMatch = text.match(/\{[\s\S]*\}/)
          if (jsonMatch) {
            const extracted = JSON.parse(jsonMatch[0])
            await sb.from('projects').update({
              descripcion_empresa: extracted.descripcion_empresa || null,
              objetivo_proyecto: extracted.objetivo_proyecto || null,
              kpis_acordados: extracted.kpis_acordados || [],
            }).eq('id', projectId)
            results.welcomeCall = {
              found: true,
              title: welcomeCall.title,
              extracted: {
                descripcion: extracted.descripcion_empresa,
                objetivo: extracted.objetivo_proyecto,
                kpis: extracted.kpis_acordados?.length || 0,
              }
            }
          } else {
            results.welcomeCall = { found: true, title: welcomeCall.title }
          }
        } catch {
          results.welcomeCall = { found: true, title: welcomeCall.title }
        }
      } else {
        results.welcomeCall = { found: true, title: welcomeCall.title }
      }
    } else {
      // Add to pending calls
      await sb.from('pending_calls').insert({
        project_id: projectId,
        title: `Llamada de bienvenida — ${projectName.trim()}`,
        status: 'pendiente',
        created_at: new Date().toISOString(),
      })
      results.welcomeCall = { found: false, addedToPending: true }
    }

    // ── 6. Send welcome message to Slack channel ──────────────────────────
    if (slackResult.id) {
      const typeLabel = types.includes('voice') && types.includes('whatsapp')
        ? '🎙 Agente de Voz + 💬 WhatsApp'
        : types.includes('voice') ? '🎙 Agente de Voz' : '💬 WhatsApp / Texto'

      const taskLines = taskList.slice(0, 5).map((t, i) => `${i + 1}. ${t.title}`).join('\n')
      const extraTasks = taskList.length > 5 ? `\n_...y ${taskList.length - 5} tareas más_` : ''

      const welcomeMsg = [
        `👋 *¡Bienvenidos al proyecto ${projectName.trim()}!*`,
        ``,
        `Este canal es el espacio oficial del equipo para coordinar, hacer seguimiento y resolver dudas sobre este proyecto.`,
        ``,
        `*Tipo de proyecto:* ${typeLabel}`,
        ``,
        `*Tareas iniciales a completar:*`,
        taskLines + extraTasks,
        ``,
        `¡Manos a la obra! 🚀 Cualquier actualización de tarea o comentario aparecerá aquí.`,
      ].join('\n')

      await slackPost('chat.postMessage', {
        channel: slackResult.id,
        text: welcomeMsg,
      })
      results.welcomeSlack = { sent: true }
    }

    return NextResponse.json({
      success: true,
      projectId,
      ...results,
      message: `Proyecto "${projectName.trim()}" onboarded exitosamente.`,
    })

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
