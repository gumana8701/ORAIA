'use client'
import Link from 'next/link'
import { Proyecto } from '@/lib/types'
import StatusBadge from './StatusBadge'

const prioColor = { alta: 'bg-red-500', media: 'bg-yellow-500', baja: 'bg-gray-500' }

export default function ProjectCard({ proyecto }: { proyecto: Proyecto }) {
  return (
    <Link href={`/proyectos/${proyecto.id}`}>
      <div className="glass p-5 hover:border-accent/30 hover:shadow-glow-sm transition-all duration-200 cursor-pointer group">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`w-2 h-2 rounded-full ${prioColor[proyecto.prioridad]}`} />
              <h3 className="font-semibold text-white group-hover:text-accent transition-colors">{proyecto.nombre}</h3>
            </div>
            <p className="text-xs text-muted">{proyecto.cliente}</p>
          </div>
          <StatusBadge estado={proyecto.estado} />
        </div>
        {proyecto.mensajeReciente && (
          <p className="text-sm text-muted/80 mb-4 line-clamp-2 italic">&ldquo;{proyecto.mensajeReciente}&rdquo;</p>
        )}
        <div className="mb-3">
          <div className="flex justify-between text-xs text-muted mb-1">
            <span>Progreso</span><span>{proyecto.progreso}%</span>
          </div>
          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div className="h-full bg-accent rounded-full" style={{ width: `${proyecto.progreso}%` }} />
          </div>
        </div>
        <div className="flex items-center justify-between text-xs text-muted">
          <span>{proyecto.responsable}</span><span>{proyecto.ultimaActividad}</span>
        </div>
        {proyecto.tags && proyecto.tags.length > 0 && (
          <div className="flex gap-1 mt-3">
            {proyecto.tags.map(tag => (
              <span key={tag} className="text-[10px] px-2 py-0.5 rounded bg-accent/10 text-accent border border-accent/20">{tag}</span>
            ))}
          </div>
        )}
      </div>
    </Link>
  )
}
