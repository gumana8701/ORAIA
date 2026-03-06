import { proyectosMock } from '@/lib/data'
import ProjectCard from '@/components/ProjectCard'

const stats = [
  { label: 'Proyectos Activos', value: '8', sub: '+2 este mes' },
  { label: 'En Riesgo', value: '2', sub: 'Requieren atención' },
  { label: 'Mensajes Hoy', value: '34', sub: 'WhatsApp y Slack' },
  { label: 'Completados', value: '12', sub: 'Este trimestre' },
]

export default function Dashboard() {
  return (
    <div>
      <div className="mb-10 relative">
        <div className="absolute -top-4 -left-4 w-64 h-32 rounded-full bg-accent/10 blur-3xl pointer-events-none" />
        <h1 className="text-3xl font-black glow-text mb-1">Panel General</h1>
        <p className="text-muted text-sm">Vista en tiempo real de todos tus proyectos activos.</p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {stats.map(stat => (
          <div key={stat.label} className="glass p-5">
            <p className="text-3xl font-black text-accent">{stat.value}</p>
            <p className="text-sm font-semibold text-white mt-1">{stat.label}</p>
            <p className="text-xs text-muted mt-0.5">{stat.sub}</p>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-bold text-white">Proyectos Recientes</h2>
        <button className="btn-orange text-xs">+ Nuevo Proyecto</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {proyectosMock.map(p => (<ProjectCard key={p.id} proyecto={p} />))}
      </div>
    </div>
  )
}
