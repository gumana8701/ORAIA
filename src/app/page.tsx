import { createClient } from '@supabase/supabase-js'
import ProjectCard from '@/components/ProjectCard'

async function getProyectos() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { data, error } = await supabase.from('projects').select('*').order('created_at', { ascending: false })
  if (error) { console.error(error); return [] }
  return data
}

export default async function Dashboard() {
  const proyectos = await getProyectos()

  const activos = proyectos.filter(p => p.estado === 'activo').length
  const enRiesgo = proyectos.filter(p => p.estado === 'en_riesgo').length
  const completados = proyectos.filter(p => p.estado === 'completado').length

  const stats = [
    { label: 'Proyectos Activos', value: String(activos), sub: 'En curso ahora', color: '#E8792F' },
    { label: 'En Riesgo', value: String(enRiesgo), sub: 'Requieren atención', color: '#ef4444' },
    { label: 'Mensajes Hoy', value: '—', sub: 'WhatsApp y Slack', color: '#3b82f6' },
    { label: 'Completados', value: String(completados), sub: 'Total histórico', color: '#22c55e' },
  ]

  return (
    <div style={{ position: 'relative' }}>
      {/* Header */}
      <div style={{ marginBottom: '40px', position: 'relative' }}>
        <div style={{ position: 'absolute', top: '-16px', left: '-16px', width: '256px', height: '128px', borderRadius: '50%', background: 'rgba(232,121,47,0.08)', filter: 'blur(40px)', pointerEvents: 'none' }} />
        <h1 style={{ fontSize: '28px', fontWeight: 800, background: 'linear-gradient(135deg, #fff 30%, #E8792F 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: '6px' }}>Panel General</h1>
        <p style={{ color: '#A0AEC0', fontSize: '14px', margin: 0 }}>Vista en tiempo real de todos tus proyectos activos.</p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '40px' }}>
        {stats.map(stat => (
          <div key={stat.label} style={{ background: 'rgba(17,24,39,0.85)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: '12px', padding: '20px' }}>
            <p style={{ fontSize: '32px', fontWeight: 800, color: stat.color, margin: '0 0 4px 0' }}>{stat.value}</p>
            <p style={{ fontSize: '13px', fontWeight: 600, color: '#fff', margin: '0 0 2px 0' }}>{stat.label}</p>
            <p style={{ fontSize: '11px', color: '#A0AEC0', margin: 0 }}>{stat.sub}</p>
          </div>
        ))}
      </div>

      {/* Projects */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#fff', margin: 0 }}>Proyectos Recientes</h2>
        <button className="btn-orange" style={{ fontSize: '12px' }}>+ Nuevo Proyecto</button>
      </div>

      {proyectos.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#A0AEC0', background: 'rgba(17,24,39,0.85)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: '12px' }}>
          <p style={{ fontSize: '32px', marginBottom: '12px' }}>📂</p>
          <p style={{ fontWeight: 600, color: '#fff', marginBottom: '4px' }}>Sin proyectos aún</p>
          <p style={{ fontSize: '13px' }}>Agrega proyectos o conecta tus chats de WhatsApp para comenzar.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
          {proyectos.map((p: any) => (<ProjectCard key={p.id} proyecto={p} />))}
        </div>
      )}
    </div>
  )
}
