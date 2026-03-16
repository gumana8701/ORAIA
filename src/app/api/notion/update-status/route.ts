/**
 * Update Notion project status (Etapa de implementación / Estado)
 * PATCH /api/notion/update-status
 * Body: { notion_project_id, etapas?, estado? }
 * Syncs to both Supabase and Notion
 */
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const NOTION_KEY = process.env.NOTION_API_KEY!
const NOTION_VERSION = '2025-09-03'

async function notionPatch(pageId: string, properties: Record<string, any>) {
  const res = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${NOTION_KEY}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ properties }),
  })
  return res
}

export async function PATCH(req: NextRequest) {
  const { notion_project_id, etapas, estado } = await req.json()
  if (!notion_project_id) {
    return NextResponse.json({ error: 'notion_project_id required' }, { status: 400 })
  }

  // 1. Update Supabase
  const updateData: Record<string, any> = { synced_at: new Date().toISOString() }
  if (etapas !== undefined) updateData.etapas = etapas
  if (estado !== undefined) updateData.estado = estado

  const { error: sbErr } = await sb.from('notion_projects')
    .update(updateData)
    .eq('id', notion_project_id)

  if (sbErr) {
    return NextResponse.json({ error: sbErr.message }, { status: 500 })
  }

  // 2. Build Notion properties patch
  const notionProps: Record<string, any> = {}

  if (etapas !== undefined) {
    notionProps['Etapa de implementación'] = {
      multi_select: etapas.map((name: string) => ({ name }))
    }
  }

  if (estado !== undefined) {
    notionProps['Estado'] = {
      status: { name: estado }
    }
  }

  // 3. Patch Notion
  const notionRes = await notionPatch(notion_project_id, notionProps)
  if (!notionRes.ok) {
    const errBody = await notionRes.text()
    console.error('Notion patch failed:', errBody)
    // Don't fail — Supabase already updated, Notion will sync on next run
    return NextResponse.json({ ok: true, notion_warning: 'Supabase updated, Notion patch failed: ' + errBody.slice(0, 100) })
  }

  return NextResponse.json({ ok: true })
}
