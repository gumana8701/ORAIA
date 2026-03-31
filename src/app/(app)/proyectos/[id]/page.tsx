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
import ProjectChat from '@/components/ProjectChat'
import ProjectTasksTab from '@/components/ProjectTasksTab'
import TeamStatsTab from '@/components/TeamStatsTab'
import SetVoiceProject from '@/components/SetVoiceProject'
import { getSessionProfile } from '@/lib/auth'
import ProjectMetaEditor from '@/components/ProjectMetaEditor'
import ProjectDocs from '@/components/ProjectDocs'
import EstadoProyectoTab from '@/components/EstadoProyectoTab'

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

async function getData(id: string, profileId?: string, profileRole?: string, developerProfileId?: string | null) {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  // Build navigation project list (filtered by role)
  let navQuery = sb.from('projects').select('id,nombre').order('ultima_actividad', { ascending: false, nullsFirst: false })
  if (profileRole === 'developer' && developerProfileId) {
    // Developers only see their assigned projects
    const { data: myProjects } = await sb.from('project_developers')
      .select('project_id')
      .eq('developer_id', developerProfileId)
    const myIds = (myProjects ?? []).map((r: any) => r.project_id)
    if (myIds.length > 0) navQuery = navQuery.in('id', myIds)
    else navQuery = navQuery.eq('id', '00000000-0000-0000-0000-000000000000')
  }
  const navRes = await navQuery

  const [projRes, msgRes, alertRes, devsRes, assignedRes, briefsRes, kpisRes, notionRes] = await Promise.all([
    sb.from('projects').select('*').eq('id', id).single(),
    sb.from('messages').select('*').eq('project_id', id).order('timestamp',{ascending:false}).limit(100),
    sb.from('alerts').select('*').eq('project_id', id).eq('resuelta',false).order('created_at',{ascending:false}),
    sb.from('developers').select('*').eq('activo',true).order('es_supervisor',{ascending:false}),
    sb.from('project_developers').select('*, developer:developers(*)').eq('project_id', id),
    sb.from('meeting_briefs').select('id,title,meeting_date,drive_link,recording_url,transcript_raw,summary,decisions,action_items,participants,ai_confidence').eq('project_id', id).order('meeting_date',{ascending:false}).limit(50),
    sb.from('project_kpis').select('id,kpi_text,categoria,meta,confirmado').eq('project_id', id).order('created_at',{ascending:true}),
    sb.from('notion_projects').select('id,etapas,cantidad_contratada,saldo_pendiente,plan_type').eq('project_id', id).limit(1).maybeSingle(),
  ])
  return {
    proyecto: projRes.data as Proyecto | null,
    mensajes: (msgRes.data ?? []) as Mensaje[],
    alertas: (alertRes.data ?? []) as Alerta[],
    allDevelopers: (devsRes.data ?? []) as Developer[],
    assigned: (assignedRes.data ?? []) as (ProjectDeveloper & { developer: Developer })[],
    meetingBriefs: (briefsRes.data ?? []) as any[],
    kpis: (kpisRes.data ?? []) as any[],
    notionProject: notionRes.data as { id: string; etapas: string[]; cantidad_contratada?: number; saldo_pendiente?: number; plan_type?: string } | null,
    navProjects: (navRes.data ?? []) as { id: string; nombre: string }[],
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
  const profile = await getSessionProfile()
  const {proyecto, mensajes, alertas, allDevelopers, assigned, meetingBriefs, kpis, notionProject, navProjects} = await getData(id, profile.id, profile.rol, profile.developer_id)
  if (!proyecto) notFound()

  // Compute prev/next for navigation
  const navIdx = navProjects.findIndex(p => p.id === id)
  const prevProject = navIdx > 0 ? navProjects[navIdx - 1] : null
  const nextProject = navIdx >= 0 && navIdx < navProjects.length - 1 ? navProjects[navIdx + 1] : null

  const isAdmin = profile.rol === 'admin'
  const totalActivity = mensajes.length + meetingBriefs.length
  const tabs = [
    {key:'estado',     label:`🧠 Estado${alertas.length>0?' ⚠️'+alertas.length:''}`},
    {key:'actividad',  label:`📋 Actividad${totalActivity>0?' ('+totalActivity+')':''}`},
    {key:'tareas',     label:'✅ Tareas'},
    {key:'notion',     label:'📋 Notion'},
    {key:'perfil',     label:'🎯 KPIs'},
    ...(isAdmin ? [{key:'onboarding', label:'👥 Equipo'}] : []),
  ]

  // Default tab migration: old 'mensajes' → 'actividad'
  const activeTab = tab === 'mensajes' || tab === 'reuniones' ? 'actividad' : tab

  const assignedDevs = assigned.map(a => a.developer).filter(Boolean)

  return (
    <div>
      {/* Tell BOB which project is active */}
      <SetVoiceProject projectId={id} projectName={proyecto.nombre} />

      {/* Navigation bar */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'20px',gap:'8px'}}>
        {/* Back button */}
        <Link href="/" style={{textDecoration:'none'}}>
          <div style={{
            display:'flex',alignItems:'center',gap:'6px',fontSize:'13px',color:'#A0AEC0',
            padding:'6px 12px',borderRadius:'8px',border:'1px solid rgba(255,255,255,0.08)',
            background:'rgba(255,255,255,0.03)',cursor:'pointer',
          }}>
            ← Todos los proyectos
          </div>
        </Link>

        {/* Prev / counter / next */}
        <div style={{display:'flex',alignItems:'center',gap:'6px'}}>
          {prevProject ? (
            <Link href={`/proyectos/${prevProject.id}?tab=${tab}`} title={prevProject.nombre} style={{textDecoration:'none'}}>
              <div style={{
                display:'flex',alignItems:'center',gap:'6px',fontSize:'13px',
                padding:'6px 12px',borderRadius:'8px',border:'1px solid rgba(255,255,255,0.08)',
                background:'rgba(255,255,255,0.03)',color:'#A0AEC0',cursor:'pointer',
                maxWidth:'200px',overflow:'hidden',
              }}>
                <span>←</span>
                <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{prevProject.nombre}</span>
              </div>
            </Link>
          ) : (
            <div style={{padding:'6px 12px',fontSize:'13px',color:'#2d3748',borderRadius:'8px',border:'1px solid transparent'}}>←</div>
          )}

          {navIdx >= 0 && (
            <span style={{fontSize:'11px',color:'#4a5568',padding:'0 4px',whiteSpace:'nowrap'}}>
              {navIdx + 1} / {navProjects.length}
            </span>
          )}

          {nextProject ? (
            <Link href={`/proyectos/${nextProject.id}?tab=${tab}`} title={nextProject.nombre} style={{textDecoration:'none'}}>
              <div style={{
                display:'flex',alignItems:'center',gap:'6px',fontSize:'13px',
                padding:'6px 12px',borderRadius:'8px',
                background:'#E8792F',color:'#fff',cursor:'pointer',fontWeight:600,
                maxWidth:'200px',overflow:'hidden',
              }}>
                <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{nextProject.nombre}</span>
                <span>→</span>
              </div>
            </Link>
          ) : (
            <div style={{padding:'6px 12px',fontSize:'13px',color:'#2d3748',borderRadius:'8px',border:'1px solid transparent'}}>→</div>
          )}
        </div>
      </div>

      {/* Header */}
      <div style={{background:'rgba(17,24,39,0.85)',border:'1px solid rgba(255,255,255,0.10)',borderRadius:'12px',padding:'24px',marginBottom:'24px',position:'relative'}}>
        <div style={{position:'absolute',top:0,right:0,width:'192px',height:'192px',background:'rgba(232,121,47,0.04)',borderRadius:'50%',filter:'blur(60px)',pointerEvents:'none'}}/>
        <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:'16px',flexWrap:'wrap'}}>
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'4px'}}>
              {proyecto.color_emoji && <span style={{fontSize:'18px'}}>{proyecto.color_emoji}</span>}
              <h1 style={{fontSize:'24px',fontWeight:800,color:'#fff',margin:0}}>{proyecto.nombre}</h1>
            </div>
            <ProjectMetaEditor
              projectId={id}
              initialNicho={proyecto.nicho}
              initialTipoLeads={proyecto.tipo_leads}
              initialTwilioCuenta={proyecto.twilio_cuenta}
              initialTwilioBundle={proyecto.twilio_bundle}
              initialTwilioNumero={proyecto.twilio_numero}
              initialTwilioSaldo={proyecto.twilio_saldo}
              initialTipoIntegracion={proyecto.tipo_integracion}
            />
            <ProjectDocs
              projectId={id}
              initialDocs={{
                doc_expediente:    proyecto.doc_expediente,
                doc_flujograma:    proyecto.doc_flujograma,
                doc_cableado:      proyecto.doc_cableado,
                accesos_brindados: proyecto.accesos_brindados,
                reunion_link:      proyecto.reunion_link,
              }}
            />
          </div>
          <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:'8px',flexShrink:0}}>
            {notionProject?.cantidad_contratada != null && (
              <div style={{
                display:'flex',flexDirection:'column',alignItems:'flex-end',
                background:'rgba(232,121,47,0.08)',border:'1px solid rgba(232,121,47,0.20)',
                borderRadius:'10px',padding:'8px 14px',
              }}>
                <span style={{fontSize:'10px',color:'#E8792F',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:'2px'}}>
                  💰 Monto contratado
                </span>
                <span style={{fontSize:'20px',fontWeight:800,color:'#fff',letterSpacing:'-0.02em'}}>
                  ${notionProject.cantidad_contratada.toLocaleString('en-US')}
                </span>
                {notionProject.saldo_pendiente != null && notionProject.saldo_pendiente > 0 && (
                  <span style={{fontSize:'11px',color:'#f59e0b',fontWeight:600,marginTop:'2px'}}>
                    Saldo pendiente: ${notionProject.saldo_pendiente.toLocaleString('en-US')}
                  </span>
                )}
              </div>
            )}
            <StatusBadge estado={proyecto.estado}/>
            <ProjectKPIs kpis={kpis} projectId={id} />
          </div>
        </div>

        {/* Stats */}
        <div style={{display:'flex',gap:'24px',marginTop:'16px',flexWrap:'wrap',alignItems:'center'}}>
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
          {/* Services contracted */}
          {(proyecto as any).services_detail ? (
            <div style={{fontSize:'12px',padding:'3px 10px',borderRadius:'6px',background:'rgba(232,121,47,0.10)',border:'1px solid rgba(232,121,47,0.25)',color:'#E8792F',fontWeight:600}}>
              🤝 {(proyecto as any).services_detail}
            </div>
          ) : (proyecto as any).project_type && (
            <div style={{fontSize:'12px',padding:'3px 10px',borderRadius:'6px',background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.10)',color:'#64748b',fontWeight:600}}>
              {(proyecto as any).project_type === 'voice' ? '🎙 Agente de Voz' : (proyecto as any).project_type === 'whatsapp' ? '💬 WhatsApp' : (proyecto as any).project_type === 'both' ? '🎙💬 Voz + Chat' : (proyecto as any).project_type}
            </div>
          )}
        </div>

        {/* Team — always show CS + Operaciones */}
        <div style={{display:'flex',gap:'16px',marginTop:'14px',flexWrap:'wrap',alignItems:'flex-start'}}>
          {/* CS */}
          <div style={{display:'flex',gap:'6px',alignItems:'center',flexWrap:'wrap'}}>
            <span style={{fontSize:'10px',fontWeight:700,color:'#64748b',textTransform:'uppercase',letterSpacing:'0.05em',marginRight:'2px'}}>CS</span>
            {[{nombre:'Jennifer Serrano',emoji:'💼',color:'#6366f1'},{nombre:'Trina Gomez',emoji:'🌟',color:'#8b5cf6'}].map(p => (
              <span key={p.nombre} style={{fontSize:'12px',padding:'3px 10px',borderRadius:'6px',background:`${p.color}15`,color:p.color,border:`1px solid ${p.color}30`,fontWeight:600}}>
                {p.emoji} {p.nombre}
              </span>
            ))}
          </div>
          {/* Operaciones */}
          {assignedDevs.length > 0 && (
            <div style={{display:'flex',gap:'6px',alignItems:'center',flexWrap:'wrap'}}>
              <span style={{fontSize:'10px',fontWeight:700,color:'#64748b',textTransform:'uppercase',letterSpacing:'0.05em',marginRight:'2px'}}>OPS</span>
              {assignedDevs.map((d:any) => (
                <span key={d.id} style={{fontSize:'12px',padding:'3px 10px',borderRadius:'6px',background:`${d.color}15`,color:d.color,border:`1px solid ${d.color}30`,fontWeight:600}}>
                  {d.emoji} {d.nombre}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>


      {/* Company info card — shown when available */}
      {((proyecto as any).descripcion_empresa || (proyecto as any).objetivo_proyecto) && (
        <div style={{
          background: 'rgba(17,24,39,0.7)', border: '1px solid rgba(255,255,255,0.07)',
          borderLeft: '3px solid rgba(232,121,47,0.5)', borderRadius: '10px',
          padding: '14px 18px', marginBottom: '20px',
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px',
        }}>
          {(proyecto as any).descripcion_empresa && (
            <div>
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#E8792F', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>🏢 Empresa</div>
              <p style={{ fontSize: '13px', color: '#cbd5e0', margin: 0, lineHeight: 1.5 }}>{(proyecto as any).descripcion_empresa}</p>
            </div>
          )}
          {(proyecto as any).objetivo_proyecto && (
            <div>
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#E8792F', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>🎯 Objetivo</div>
              <p style={{ fontSize: '13px', color: '#cbd5e0', margin: 0, lineHeight: 1.5 }}>{(proyecto as any).objetivo_proyecto}</p>
            </div>
          )}
          {((proyecto as any).kpis_acordados?.length > 0) && (
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#E8792F', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>📊 KPIs acordados</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {((proyecto as any).kpis_acordados as string[]).map((kpi: string, i: number) => (
                  <span key={i} style={{
                    fontSize: '11px', padding: '3px 10px', borderRadius: '20px',
                    background: 'rgba(232,121,47,0.10)', color: '#E8792F',
                    border: '1px solid rgba(232,121,47,0.2)',
                  }}>{kpi}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

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

      {/* Tab: Estado del Proyecto (AI + Alertas) */}
      {activeTab==='estado' && (
        <EstadoProyectoTab projectId={id} />
      )}

      {/* Tab: Tareas */}
      {activeTab==='tareas' && (
        <ProjectTasksTab projectId={id} canAddTasks={isAdmin || profile.rol === 'supervisor'} />
      )}

      {/* Tab: Notion */}
      {activeTab==='notion' && (
        <NotionTasksTab projectId={id} />
      )}

      {/* Tab: Equipo — Team stats + assignment */}
      {tab==='onboarding' && (
        <div>
          {/* Team task stats */}
          <div style={{marginBottom:'24px'}}>
            <h2 style={{fontSize:'15px',fontWeight:700,color:'#fff',margin:'0 0 16px'}}>📊 Estadísticas por miembro</h2>
            <TeamStatsTab
              projectId={id}
              assignedDevs={assignedDevs.map((d:any) => ({ nombre: d.nombre, color: d.color, emoji: d.emoji }))}
            />
          </div>

          {/* Developer assignment */}
          {isAdmin && (
            <div style={{borderTop:'1px solid rgba(255,255,255,0.06)',paddingTop:'24px'}}>
              <div style={{marginBottom:'16px'}}>
                <h2 style={{fontSize:'15px',fontWeight:700,color:'#fff',margin:'0 0 4px'}}>👥 Asignar desarrolladores</h2>
                <p style={{fontSize:'13px',color:'#A0AEC0',margin:0}}>Enzo siempre está asignado como supervisor.</p>
              </div>
              <DeveloperAssignerWrapper
                projectId={id}
                allDevelopers={allDevelopers}
                assigned={assigned as any}
              />
            </div>
          )}
        </div>
      )}

      {/* Tab: KPIs */}
      {tab==='perfil' && (
        <ProjectKPIsEditor projectId={id} initialKpis={kpis} />
      )}

      {/* PM Agent chat widget */}
      <ProjectChat projectId={id} projectName={proyecto.nombre} />
    </div>
  )
}
