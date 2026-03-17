/**
 * Sync a specific Notion project → Supabase
 * POST /api/notion/sync-project
 * Body: { notion_page_id }
 *
 * Also used internally by the webhook handler.
 */
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const NOTION_KEY = process.env.NOTION_API_KEY!
const NOTION_VERSION = '2025-09-03'

async function notionGet(path: string) {
  const res = await fetch(`https://api.notion.com${path}`, {
    headers: {
      Authorization: `Bearer ${NOTION_KEY}`,
      'Notion-Version': NOTION_VERSION,
    },
  })
  if (!res.ok) throw new Error(`Notion ${res.status}: ${await res.text()}`)
  return res.json()
}

function getTitle(p: Record<string, any>, key: string): string {
  return (p[key]?.title || []).map((i: any) => i.plain_text).join('').trim()
}
function getText(p: Record<string, any>, key: string): string {
  return (p[key]?.rich_text || []).map((i: any) => i.plain_text).join('').trim()
}
function getStatus(p: Record<string, any>, key: string): string | null {
  return p[key]?.status?.name ?? null
}
function getSelect(p: Record<string, any>, key: string): string | null {
  return p[key]?.select?.name ?? null
}
function getMultiSelect(p: Record<string, any>, key: string): string[] {
  return (p[key]?.multi_select || []).map((o: any) => o.name)
}
function getPeople(p: Record<string, any>, key: string): string[] {
  return (p[key]?.people || []).map((o: any) => o.name || '').filter(Boolean)
}
function getDate(p: Record<string, any>, key: string): string | null {
  return p[key]?.date?.start ?? null
}
function getCheckbox(p: Record<string, any>, key: string): boolean {
  return p[key]?.checkbox ?? false
}
function getNumber(p: Record<string, any>, key: string): number | null {
  return p[key]?.number ?? null
}
function getEmail(p: Record<string, any>, key: string): string | null {
  return p[key]?.email ?? null
}
function getPhone(p: Record<string, any>, key: string): string | null {
  return p[key]?.phone_number ?? null
}

function extractProps(page: any) {
  const props = page.properties || {}
  return {
    id: page.id,
    created_time: page.created_time || null,
    last_edited_time: page.last_edited_time || null,
    nombre: getTitle(props, 'Nombre de la empresa / nombre del representante'),
    estado: getStatus(props, 'Estado'),
    etapas: getMultiSelect(props, 'Etapa de implementación'),
    responsable: getPeople(props, 'Responsable'),
    resp_chatbot: getPeople(props, 'Resp. Chatbot'),
    resp_voz: getPeople(props, 'Resp. Agente de voz'),
    whatsapp_group_id: getText(props, 'WhatsApp Group ID') || null,
    lanzamiento_real: getDate(props, 'Lanzamiento REAL'),
    testeo_inicia: getDate(props, 'TESTEO inicia'),
    kick_off_date: getDate(props, '1ra call de kick off'),
    es_chatbot: getCheckbox(props, 'Chatbot? '),
    plan_type: getSelect(props, 'Plan Type'),
    plan_pagos: getSelect(props, 'Plan Pagos'),
    cantidad_contratada: getNumber(props, 'Cantidad contratada'),
    saldo_pendiente: getNumber(props, 'Saldo pendiente'),
    contact_email: getEmail(props, 'Contact Email (cliente)'),
    contact_phone: getPhone(props, 'Contact Phone (cliente)'),
    info_util: getText(props, 'Info util que debería ser considerada') || null,
    notion_url: page.url || null,
    synced_at: new Date().toISOString(),
  }
}

async function fetchTasks(pageId: string) {
  const tasks: any[] = []
  try {
    const data = await notionGet(`/v1/blocks/${pageId}/children?page_size=50`)
    const blocks = data.results || []
    let currentSection = 'General'

    for (const block of blocks) {
      const btype = block.type
      const content = block[btype] || {}

      if (['heading_1', 'heading_2', 'heading_3'].includes(btype)) {
        currentSection = (content.rich_text || []).map((r: any) => r.plain_text).join('').trim()
      }

      if (btype === 'to_do') {
        const text = (content.rich_text || []).map((r: any) => r.plain_text).join('').trim()
        if (text) tasks.push({
          id: block.id,
          task_text: text,
          checked: content.checked || false,
          section: currentSection,
          position: tasks.length,
          created_time: block.created_time || null,
          last_edited_time: block.last_edited_time || null,
        })
      }

      if (block.has_children && ['heading_2', 'heading_3'].includes(btype)) {
        await new Promise(r => setTimeout(r, 150))
        const childData = await notionGet(`/v1/blocks/${block.id}/children?page_size=50`)
        for (const child of childData.results || []) {
          if (child.type === 'to_do') {
            const cc = child.to_do || {}
            const text = (cc.rich_text || []).map((r: any) => r.plain_text).join('').trim()
            if (text) tasks.push({
              id: child.id,
              task_text: text,
              checked: cc.checked || false,
              section: currentSection,
              position: tasks.length,
              created_time: child.created_time || null,
              last_edited_time: child.last_edited_time || null,
            })
          }
        }
      }
    }
  } catch (e: any) {
    console.error(`Error fetching tasks for ${pageId}:`, e.message)
  }
  return tasks
}

export async function syncNotionProject(pageId: string): Promise<{ ok: boolean; error?: string }> {
  // 1. Fetch page from Notion
  let page: any
  try {
    page = await notionGet(`/v1/pages/${pageId}`)
  } catch (e: any) {
    return { ok: false, error: e.message }
  }

  const extracted = extractProps(page)

  // 2. Look up existing project_id from Supabase
  const { data: existing } = await sb
    .from('notion_projects')
    .select('project_id')
    .eq('id', pageId)
    .single()

  const projectId = existing?.project_id || null

  // 3. Upsert notion_project
  const { error: upsertErr } = await sb
    .from('notion_projects')
    .upsert({ ...extracted, project_id: projectId }, { onConflict: 'id' })

  if (upsertErr) return { ok: false, error: upsertErr.message }

  // 4. Fetch + upsert tasks
  await new Promise(r => setTimeout(r, 200))
  const tasks = await fetchTasks(pageId)
  if (tasks.length > 0) {
    const taskRows = tasks.map(t => ({
      ...t,
      notion_project_id: pageId,
      project_id: projectId,
      synced_at: new Date().toISOString(),
    }))
    await sb.from('notion_tasks').upsert(taskRows, { onConflict: 'id' })
  }

  return { ok: true }
}

export async function POST(req: NextRequest) {
  const { notion_page_id } = await req.json()
  if (!notion_page_id) {
    return NextResponse.json({ error: 'notion_page_id required' }, { status: 400 })
  }
  const result = await syncNotionProject(notion_page_id)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 })
  return NextResponse.json({ ok: true })
}
