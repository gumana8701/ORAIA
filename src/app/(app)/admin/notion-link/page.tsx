import { createClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import { createClient as createServerClient } from '@/lib/supabase/server'
import NotionLinkClient from './NotionLinkClient'

async function getData() {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const sb = await createServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await admin.from('user_profiles').select('rol').eq('id', user.id).single()
  if (!['admin', 'supervisor'].includes(profile?.rol)) redirect('/')

  const [notionRes, projectsRes] = await Promise.all([
    // All notion projects, ordered: unlinked first, then by etapa
    admin.from('notion_projects')
      .select('id, nombre, etapas, estado, project_id, whatsapp_group_id, plan_type, lanzamiento_real')
      .order('nombre', { ascending: true }),
    // All supabase projects
    admin.from('projects')
      .select('id, nombre, estado, color_emoji')
      .order('nombre', { ascending: true }),
  ])

  return {
    notionProjects: notionRes.data ?? [],
    supabaseProjects: projectsRes.data ?? [],
  }
}

export default async function NotionLinkPage() {
  const { notionProjects, supabaseProjects } = await getData()
  return <NotionLinkClient notionProjects={notionProjects} supabaseProjects={supabaseProjects} />
}
