import { proyectosMock } from '@/lib/data'
import StatusBadge from '@/components/StatusBadge'
import Link from 'next/link'

export default function ProyectoDetalle({ params }: { params: { id: string } }) {
  const proyecto = proyectosMock.find(p => p.id === params.id)
  if (!proyecto) return <div className="flex items-center justify-center h-96"><p className="text-muted">Proyecto no encontrado.</p></div>

  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-muted mb-6">
        <Link href="/" className="hover:text-white transition-colors">Panel</Link>
        <span>/</span>
        <span className="text-white font-medium">{proyecto.nombre}</span>
      </div>
      <div className="glass p-6 mb-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-accent/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-black text-white mb-1">{proyecto.nombre}</h1>
            <p className="text-muted text-sm">{proyecto.cliente}</p>
          </div>
          <StatusBadge estado={proyecto.estado} />
        </div>
        <div className="mt-5">
          <div className="flex justify-between text-xs text-muted mb-1.5">
            <span>Progreso general</span>
            <span className="text-accent font-bold">{proyecto.progreso}%</span>
          </div>
          <div className="h-2 bg-white/5 rounded-full overflow-hidden">
            <div className="h-full bg-accent rounded-full" style={{ width: `${proyecto.progreso}%` }} />
          </div>
        </div>
        <div className="flex gap-6 mt-5 text-sm text-muted">
          <span>👤 {proyecto.responsable}</span>
          <span>🕒 {proyecto.ultimaActividad}</span>
          <span>🚦 Prioridad: <span className="capitalize text-white">{proyecto.prioridad}</span></span>
        </div>
      </div>
      <div className="flex gap-2 mb-6 border-b border-white/5">
        {['Resumen', 'WhatsApp', 'Slack', 'Tareas'].map((tab, i) => (
          <button key={tab} className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${i === 0 ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-white'}`}>{tab}</button>
        ))}
      </div>
      <div className="glass p-8 text-center text-muted">
        <p className="text-4xl mb-3">💬</p>
        <p className="font-semibold text-white mb-1">Historial de Mensajes</p>
        <p className="text-sm">Aquí aparecerá el historial de WhatsApp y Slack del proyecto.</p>
        <p className="text-sm mt-1">Sube los archivos ZIP para comenzar.</p>
      </div>
    </div>
  )
}
