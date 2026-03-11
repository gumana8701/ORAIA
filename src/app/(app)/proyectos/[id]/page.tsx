import { createClient } from '@supabase/supabase-js'
import StatusBadge from '@/components/StatusBadge'
import Link from 'next/link'
import { Proyecto, Mensaje, Alerta, Developer, ProjectDeveloper } from '@/lib/types'
import { notFound } from 'next/navigation'
import DeveloperAssignerWrapper from './DeveloperAssignerWrapper'
import MeetingBriefList from '@/components/MeetingBriefList'

// ── Source config ─────────────────────────────────────────────────────────────
const SOURCE_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; icon: string }> = {
  whatsapp: { label: 'WhatsApp', color: '#4ade80', bg: 'rgba(34,197,94,0.08)',   border: 'rgba(34,197,94,0.18)',   icon: '💬' },
  slack:    { label: 'Slack',    color: '#818cf8', bg: 'rgba(129,140,248,0.08)', border: 'rgba(129,140,248,0.18)', icon: '⚡' },
  manual:   { label: 'Manual',   color: '#94a3b8', bg: 'rgba(148,163,184,0.08)', border: 'rgba(148,163,184,0.15)', icon: '✏️' },
  meet:     { label: 'Meet',     color: '#60a5fa', bg: 'rgba(96,165,250,0.08)',  border: 'rgba(96,165,250,0.15)',  icon: '🎥' },
}

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
function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('es-MX',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})
}

async function getData(id: string) {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const [projRes, msgRes, alertRes, devsRes, assignedRes, briefsRes] = await Promise.all([
    sb.from('projects').select('*').eq('id', id).single(),
    sb.from('messages').select('*').eq('project_id', id).order('timestamp',{ascending:false}).limit(100),
    sb.from('alerts').select('*').eq('project_id', id).eq('resuelta',false).order('created_at',{ascending:false}),
    sb.from('developers').select('*').eq('activo',true).order('es_supervisor',{ascending:false}),
    sb.from('project_developers').select('*, developer:developers(*)').eq('project_id', id),
    sb.from('meeting_briefs').select('id,title,meeting_date,drive_link,summary,decisions,action_items,participants,ai_confidence').eq('project_id', id).order('meeting_date',{ascending:false}).limit(50),
  ])
  return {
    proyecto: projRes.data as Proyecto | null,
    mensajes: (msgRes.data ?? []) as Mensaje[],
    alertas: (alertRes.data ?? []) as Alerta[],
    allDevelopers: (devsRes.data ?? []) as Developer[],
    assigned: (assignedRes.data ?? []) as (ProjectDeveloper & { developer: Developer })[],
    meetingBriefs: (briefsRes.data ?? []) as any[],
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
  const {proyecto, mensajes, alertas, allDevelopers, assigned, meetingBriefs} = await getData(id)
  if (!proyecto) notFound()

  const tabs = [
    {key:'mensajes', label:'💬 Mensajes'},
    {key:'reuniones', label:`🎥 Reuniones${meetingBriefs.length>0?' ('+meetingBriefs.length+')':''}`},
    {key:'alertas',  label:`⚠️ Alertas${alertas.length>0?' ('+alertas.length+')':''}`},
    {key:'onboarding', label:'🚀 Onboarding'},
  ]

  // Count messages per source
  const sourceCounts = mensajes.reduce((acc, m) => {
    const src = (m as any).fuente ?? 'manual'
    acc[src] = (acc[src] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)

  // Filtered messages
  const mensajesFiltrados = fuenteFilter && fuenteFilter !== 'todos'
    ? mensajes.filter(m => (m as any).fuente === fuenteFilter)
    : mensajes

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
        <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between'}}>
          <div>
            <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'4px'}}>
              {proyecto.color_emoji && <span style={{fontSize:'18px'}}>{proyecto.color_emoji}</span>}
              <h1 style={{fontSize:'24px',fontWeight:800,color:'#fff',margin:0}}>{proyecto.nombre}</h1>
            </div>
            <p style={{color:'#A0AEC0',fontSize:'13px',margin:0}}>{proyecto.cliente}</p>
          </div>
          <StatusBadge estado={proyecto.estado}/>
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
              padding:'10px 16px', fontSize:'13px', fontWeight:tab===t.key?600:400,
              color:tab===t.key?'#E8792F':'#A0AEC0',
              borderBottom:`2px solid ${tab===t.key?'#E8792F':'transparent'}`,
              marginBottom:'-1px', cursor:'pointer',
            }}>{t.label}</div>
          </Link>
        ))}
      </div>

      {/* Tab: Messages */}
      {tab==='mensajes' && (
        <div>
          {/* ── Source filter bar ── */}
          {mensajes.length > 0 && (
            <div style={{display:'flex',gap:'6px',marginBottom:'14px',flexWrap:'wrap',alignItems:'center'}}>
              <span style={{fontSize:'11px',color:'#4a5568',marginRight:'2px'}}>Fuente:</span>
              {(['todos', ...Object.keys(sourceCounts)] as string[]).map(src => {
                const isActive = (fuenteFilter ?? 'todos') === src
                const cfg = SOURCE_CONFIG[src]
                const count = src === 'todos' ? mensajes.length : sourceCounts[src]
                return (
                  <Link
                    key={src}
                    href={`/proyectos/${id}?tab=mensajes${src !== 'todos' ? `&fuente=${src}` : ''}`}
                    style={{textDecoration:'none'}}
                  >
                    <span style={{
                      display:'inline-flex', alignItems:'center', gap:'4px',
                      fontSize:'11px', fontWeight: isActive ? 700 : 500,
                      padding:'3px 9px', borderRadius:'6px', cursor:'pointer',
                      background: isActive ? (cfg?.bg ?? 'rgba(232,121,47,0.12)') : 'rgba(255,255,255,0.04)',
                      color: isActive ? (cfg?.color ?? '#E8792F') : '#64748b',
                      border: `1px solid ${isActive ? (cfg?.border ?? 'rgba(232,121,47,0.25)') : 'rgba(255,255,255,0.08)'}`,
                      transition: 'all 0.15s',
                    }}>
                      {cfg?.icon ?? '📋'} {cfg?.label ?? 'Todos'} <span style={{opacity:0.6}}>({count})</span>
                    </span>
                  </Link>
                )
              })}
            </div>
          )}

          {/* ── Message list ── */}
          <div style={{display:'flex',flexDirection:'column',gap:'6px'}}>
            {mensajesFiltrados.length === 0 ? (
              <div style={{textAlign:'center',padding:'40px',color:'#A0AEC0',background:'rgba(17,24,39,0.85)',border:'1px solid rgba(255,255,255,0.10)',borderRadius:'12px'}}>
                Sin mensajes{fuenteFilter && fuenteFilter !== 'todos' ? ` de ${SOURCE_CONFIG[fuenteFilter]?.label ?? fuenteFilter}` : ''}
              </div>
            ) : mensajesFiltrados.map(msg => {
              const fuente = (msg as any).fuente ?? 'manual'
              const meta   = (msg as any).metadata ?? {}
              const cfg    = SOURCE_CONFIG[fuente] ?? SOURCE_CONFIG.manual
              const channelName = meta.channel_name ? `#${meta.channel_name}` : null

              return (
                <div key={msg.id} style={{
                  display:'flex', gap:'12px', padding:'10px 14px', borderRadius:'8px',
                  background: msg.es_del_cliente ? 'rgba(17,24,39,0.6)' : cfg.bg,
                  border: `1px solid ${msg.es_del_cliente ? 'rgba(255,255,255,0.05)' : cfg.border}`,
                  borderLeft: `3px solid ${msg.es_del_cliente ? 'rgba(100,116,139,0.3)' : cfg.color}`,
                }}>
                  {/* Avatar */}
                  <div style={{
                    width:'28px', height:'28px', borderRadius:'50%', flexShrink:0,
                    background: msg.es_del_cliente ? 'rgba(100,116,139,0.3)' : `${cfg.color}25`,
                    display:'flex', alignItems:'center', justifyContent:'center', fontSize:'12px',
                  }}>
                    {msg.es_del_cliente ? '👤' : cfg.icon}
                  </div>

                  <div style={{flex:1,minWidth:0}}>
                    {/* Header row */}
                    <div style={{display:'flex',gap:'6px',alignItems:'center',marginBottom:'3px',flexWrap:'wrap'}}>
                      <span style={{fontSize:'12px',fontWeight:700,color: msg.es_del_cliente ? '#94a3b8' : cfg.color}}>
                        {msg.sender}
                      </span>
                      {/* Source badge */}
                      <span style={{
                        fontSize:'9px', fontWeight:700, padding:'1px 5px', borderRadius:'3px',
                        background:`${cfg.color}18`, color:cfg.color,
                        textTransform:'uppercase', letterSpacing:'0.05em', border:`1px solid ${cfg.color}25`,
                      }}>
                        {cfg.label}
                        {channelName && <span style={{opacity:0.7}}> · {channelName}</span>}
                      </span>
                      <span style={{fontSize:'11px',color:'#4a5568',marginLeft:'auto'}}>
                        {formatTime(msg.timestamp)}
                      </span>
                    </div>
                    {/* Content */}
                    <p style={{fontSize:'13px',color:'#cbd5e0',margin:0,lineHeight:1.5,wordBreak:'break-word'}}>
                      {msg.contenido}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Tab: Reuniones */}
      {tab==='reuniones' && (
        <MeetingBriefList briefs={meetingBriefs} />
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
    </div>
  )
}
