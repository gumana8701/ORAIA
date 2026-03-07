import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// POST — assign developer
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { developer_id, rol = 'developer' } = await req.json()

  const { data, error } = await sb()
    .from('project_developers')
    .upsert({ project_id: id, developer_id, rol }, { onConflict: 'project_id,developer_id' })
    .select('*, developer:developers(*)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Update desarrollador_principal if this is the first non-supervisor or set to this dev's name
  const dev = await sb().from('developers').select('nombre,es_supervisor').eq('id', developer_id).single()
  if (!dev.data?.es_supervisor) {
    await sb().from('projects').update({ desarrollador_principal: dev.data?.nombre }).eq('id', id)
  }

  return NextResponse.json(data)
}

// DELETE — unassign developer
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { developer_id } = await req.json()

  // Don't allow removing supervisor
  const dev = await sb().from('developers').select('es_supervisor').eq('id', developer_id).single()
  if (dev.data?.es_supervisor) {
    return NextResponse.json({ error: 'No se puede desasignar al supervisor' }, { status: 400 })
  }

  const { error } = await sb()
    .from('project_developers')
    .delete()
    .eq('project_id', id)
    .eq('developer_id', developer_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
