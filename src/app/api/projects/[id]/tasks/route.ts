import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { data, error } = await sb
    .from('project_tasks')
    .select('*')
    .eq('project_id', id)
    .order('order_index')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { taskId, completed, notes, assignee } = await req.json()

  const patch: Record<string, any> = { updated_at: new Date().toISOString() }
  if (completed !== undefined) {
    patch.completed = completed
    patch.status = completed ? 'completado' : 'pendiente'
  }
  if (notes !== undefined) patch.notes = notes
  if (assignee !== undefined) patch.assignee = assignee

  const { error } = await sb
    .from('project_tasks')
    .update(patch)
    .eq('id', taskId)
    .eq('project_id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
