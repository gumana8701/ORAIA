import { createClient } from '@supabase/supabase-js'
import StatusBadge from '@/components/StatusBadge'
import Link from 'next/link'
import { Proyecto, Mensaje, Alerta, Developer, ProjectDeveloper } from '@/lib/types'
import { notFound } from 'next/navigation'
import DeveloperAssignerWrapper from './DeveloperAssignerWrapper'
import ActivityFeed from '@/components/ActivityFeed'
import ProjectKPIs from '@/components/ProjectKPIs'
import ProjectKPIsEditor from '@/components/ProjectKPIsEditor'
import NotionTasksTab from '@/components/NotionTasksTab'

const nivelColor: Record<string, string> = {
  critico: '#ef4444', alto: '#f97316', medio: '#f59e0b', bajo: '#6b7280',
}
const tipoIcon: Record<string, string> = {
  cancelacion:'🚪', reembolso:'💸', enojo:'😡', pago:'💳',
  entrega:'📦', urgente:'⚡', silencio:'🔇', otro:'⚠️',
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins=Math.floor(diff/60000), hours=Math.floor(mins/60), days=Math.floor(hours/24)
  if (days>30) return new Date(iso).toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric'})
  if (days>0) return `hace ${days}d`
  if (hours>0) return `hace ${hours}h`
  if (mins>0) return `hace ${mins}m`
  return 'ahora'
}

async function getData(id: string) {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const [projRes, msgRes, alertRes, devsRes, assignedRes, briefsRes, kpisRes, notionRes] = await Promise.all([
    sb.from('projects').select('*').eq('id', id).single(),
    sb.from('messages').select('*').eq('project_id', id).order('timestamp',{ascending:false}).limit(100),
    sb.from('alerts').select('*').eq('project_id', id).eq('resuelta',false).order('created_at',{ascending:false}),
    sb.from('developers').select('*').eq('activo',true).order('es_supervisor',{ascending:false}),
    sb.from('project_developers').select('*, developer:developers(*)').eq('project_id', id),
    sb.from('meeting_briefs').select('id,title,meeting_date,drive_link,summary,decisions,action_items,participants,ai_confidence').eq('project_id', id).order('meeting_date',{ascending:false}).limit(50),
    sb.from('project_kpis').select('id,kpi_text,categoria,meta,confirmado').eq('project_id', id).order('created_at',{ascending:true}),
    sb.from('notion_projects').select('id,etapas').eq('project_id', id).limit(1).maybeSingle(),
  ])
  return {
    proyecto: projRes.data as Proyecto | null,
    mensajes: (msgRes.data ?? []) as Mensaje[],
    alertas: (alertRes.data ?? []) as Alerta[],
    allDevelopers: (devsRes.data ?? []) as Developer[],
    assigned: (assignedRes.data ?? []) as (ProjectDeveloper & { developer: Developer })[],
    meetingBriefs: (briefsRes.data ?? []) as any[],
    kpis: (kpisRes.data ?? []) as any[],
    notionProject: notionRes.data as { id: string; etapas: string[] } | null,
  }
}

export default async function ProyectoDetalle({
  params, searchParams
}: {
  params: Promise<{id:string}>
  searchParams: Promise<{tab?:string; fuente?:string}>
}) {
  const {id} = await params
  const {tab='mensajes', fuente: fuenteFilter} = await searchParams
  const {proyecto, mensajes, alertas, allDevelopers, assigned, meetingBriefs, kpis, notionProject} = await getData(id)
  if (!proyecto) notFound()

  const totalActivity = mensajes.length + meetingBriefs.length
  const tabs = [
    {key:'actividad',  label:`📋 Actividad${totalActivity>0?' ('+totalActivity+')':''}`},
    {key:'alertas',    label:`⚠️ Alertas${alertas.length>0?' ('+alertas.length+')':''}`},
    {key:'notion',     label:'📋 Notion'},
    {key:'onboarding', label:'🚀 Onboarding'},
    {key:'perfil',     label:'🎯 KPIs'},
  ]

  // Default tab migration: old 'mensajes' → 'actividad'
  const activeTab = tab === 'mensajes' || tab === 'reuniones' ? 'actividad' : tab

  const assignedDevs = assigned.map(a => a.developer).filter(Boolean)

  return (
    <div>
      {/* Breadcrumb */}
      <div style={{display:'flex',alignItems:'center',gap:'6px',fontSize:'13px',color:'#A0AEC0',marginBottom:'24px'}}>
        <Link href="/" style={{color:'#A0AEC0',textDecoration:'none'}}>Proyectos</Link>
        <span>/</span>
        <span style={{color:'#fff',fontWeight:500}}>{proyecto.nombre}</span>
      </div>

      {/* Header */}
      <div style={{background:'rgba(17,24,39,0.85)',border:'1px solid rgba(255,255,255,0.10)',borderRadius:'12px',padding:'24px',marginBottom:'24px',position:'relative',overflow:'hidden'}}>
        <div style={{position:'absolute',top:0,right:0,width:'192px',height:'192px',background:'rgba(232,121,47,0.04)',borderRadius:'50%',filter:'blur(60px)',pointerEvents:'none'}}/>
        <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:'16px',flexWrap:'wrap'}}>
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'4px'}}>
              {proyecto.color_emoji && <span style={{fontSize:'18px'}}>{proyecto.color_emoji}</span>}
              <h1 style={{fontSize:'24px',fontWeight:800,color:'#fff',margin:0}}>{proyecto.nombre}</h1>
            </div>
            <p style={{color:'#A0AEC0',fontSize:'13px',margin:0}}>{proyecto.cliente}</p>
          </div>
          <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:'8px',flexShrink:0}}>
            <StatusBadge estado={proyecto.estado}/>
            <ProjectKPIs kpis={kpis} projectId={id} />
          </div>
        </div>

        {/* Stats */}
        <div style={{display:'flex',gap:'24px',marginTop:'16px',flexWrap:'wrap'}}>
          <div style={{fontSize:'13px',color:'#A0AEC0'}}>
            💬 <span style={{color:'#fff',fontWeight:600}}>{proyecto.total_mensajes}</span> mensajes
          </div>
          <div style={{fontSize:'13px',color:'#A0AEC0'}}>
            🕒 <span style={{color:'#fff',fontWeight:600}}>{proyecto.ultima_actividad ? timeAgo(proyecto.ultima_actividad) : '—'}</span>
          </div>
          {(proyecto.alertas_count??0)>0 && (
            <div style={{fontSize:'13px',color:'#f59e0b'}}>
              ⚠️ <span style={{fontWeight:600}}>{proyecto.alertas_count}</span> alertas
            </div>
          )}
        </div>

        {/* Developers assigned */}
        {assignedDevs.length > 0 && (
          <div style={{display:'flex',gap:'8px',marginTop:'14px',flexWrap:'wrap',alignItems:'center'}}>
            <span style={{fontSize:'12px',color:'#4a5568'}}>Equipo:</span>
            {assignedDevs.map((d:any) => (
              <span key={d.id} style={{
                fontSize:'12px', padding:'3px 10px', borderRadius:'6px',
                background:`${d.color}15`, color:d.color,
                border:`1px solid ${d.color}30`, fontWeight:600,
              }}>{d.emoji} {d.nombre}</span>
            ))}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{display:'flex',gap:'4px',marginBottom:'20px',borderBottom:'1px solid rgba(255,255,255,0.06)',paddingBottom:'0'}}>
        {tabs.map(t => (
          <Link key={t.key} href={`/proyectos/${id}?tab=${t.key}`} style={{textDecoration:'none'}}>
            <div style={{
              padding:'10px 16px', fontSize:'13px', fontWeight:activeTab===t.key?600:400,
              color:activeTab===t.key?'#E8792F':'#A0AEC0',
              borderBottom:`2px solid ${activeTab===t.key?'#E8792F':'transparent'}`,
              marginBottom:'-1px', cursor:'pointer',
            }}>{t.label}</div>
          </Link>
        ))}
      </div>

      {/* Tab: Actividad (unified feed) */}
      {activeTab==='actividad' && (
        <ActivityFeed
          messages={mensajes as any}
          briefs={meetingBriefs}
          projectId={id}
        />
      )}

      {/* Tab: Alerts */}
      {tab==='alertas' && (
        <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
          {alertas.length===0 ? (
            <div style={{textAlign:'center',padding:'40px',color:'#22c55e',background:'rgba(17,24,39,0.85)',border:'1px solid rgba(255,255,255,0.10)',borderRadius:'12px'}}>✅ Sin alertas activas</div>
          ) : alertas.map(a => (
            <div key={a.id} style={{background:'rgba(17,24,39,0.85)',border:`1px solid ${nivelColor[a.nivel]}30`,borderLeft:`3px solid ${nivelColor[a.nivel]}`,borderRadius:'8px',padding:'12px 16px',display:'flex',gap:'12px',alignItems:'flex-start'}}>
              <span style={{fontSize:'18px',flexShrink:0}}>{tipoIcon[a.tipo]??'⚠️'}</span>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:'flex',gap:'8px',alignItems:'center',marginBottom:'4px',flexWrap:'wrap'}}>
                  <span style={{fontSize:'11px',padding:'1px 6px',borderRadius:'4px',background:`${nivelColor[a.nivel]}20`,color:nivelColor[a.nivel],fontWeight:700,textTransform:'uppercase'}}>{a.nivel}</span>
                  <span style={{fontSize:'11px',color:'#A0AEC0',textTransform:'capitalize'}}>{a.tipo}</span>
                </div>
                <p style={{fontSize:'13px',color:'#cbd5e0',margin:0,lineHeight:1.5}}>{a.descripcion}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab: Notion */}
      {activeTab==='notion' && (
        <NotionTasksTab projectId={id} />
      )}

      {/* Tab: Onboarding / Developer Assignment */}
      {tab==='onboarding' && (
        <div>
          <div style={{marginBottom:'20px'}}>
            <h2 style={{fontSize:'15px',fontWeight:700,color:'#fff',margin:'0 0 4px'}}>Asignar Desarrolladores</h2>
            <p style={{fontSize:'13px',color:'#A0AEC0',margin:0}}>Enzo siempre está asignado como supervisor. Asigna uno o más desarrolladores adicionales.</p>
          </div>
          <DeveloperAssignerWrapper
            projectId={id}
            allDevelopers={allDevelopers}
            assigned={assigned as any}
          />
        </div>
      )}

      {/* Tab: KPIs */}
      {tab==='perfil' && (
        <ProjectKPIsEditor projectId={id} initialKpis={kpis} />
      )}
    </div>
  )
}
