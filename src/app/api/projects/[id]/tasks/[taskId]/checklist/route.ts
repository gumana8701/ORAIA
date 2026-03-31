/**
 * Checklist items for a task (or subtask)
 * GET    /api/projects/[id]/tasks/[taskId]/checklist
 * POST   /api/projects/[id]/tasks/[taskId]/checklist   — { text }
 * PATCH  /api/projects/[id]/tasks/[taskId]/checklist   — { item_id, completed?, text?, author? }
 * DELETE /api/projects/[id]/tasks/[taskId]/checklist   — { item_id }
 */
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type Params = { params: Promise<{ id: string; taskId: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { taskId } = await params
  const { data, error } = await sb
    .from('task_checklist_items')
    .select('*')
    .eq('task_id', taskId)
    .order('order_index')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id: projectId, taskId } = await params
  const { text } = await req.json()
  if (!text?.trim()) return NextResponse.json({ error: 'text required' }, { status: 400 })

  // Get next order_index
  const { data: existing } = await sb
    .from('task_checklist_items')
    .select('order_index')
    .eq('task_id', taskId)
    .order('order_index', { ascending: false })
    .limit(1)
  const nextIndex = (existing?.[0]?.order_index ?? -1) + 1

  const { data, error } = await sb
    .from('task_checklist_items')
    .insert({ task_id: taskId, project_id: projectId, text: text.trim(), order_index: nextIndex })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { taskId } = await params
  const { item_id, completed, text, author } = await req.json()
  if (!item_id) return NextResponse.json({ error: 'item_id required' }, { status: 400 })

  const now = new Date().toISOString()
  const update: Record<string, any> = { updated_at: now }
  if (text !== undefined)      update.text = text
  if (completed !== undefined) {
    update.completed    = completed
    update.completed_by = completed ? (author || 'Equipo') : null
    update.completed_at = completed ? now : null
  }

  const { data, error } = await sb
    .from('task_checklist_items')
    .update(update)
    .eq('id', item_id)
    .eq('task_id', taskId)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { taskId } = await params
  const { item_id } = await req.json()
  if (!item_id) return NextResponse.json({ error: 'item_id required' }, { status: 400 })

  const { error } = await sb
    .from('task_checklist_items')
    .delete()
    .eq('id', item_id)
    .eq('task_id', taskId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
