'use client'
import Link from 'next/link'
import { Proyecto } from '@/lib/types'
import StatusBadge from './StatusBadge'

const prioColor: Record<string, string> = {
  alta: '#ef4444', media: '#eab308', baja: '#6b7280'
}

export default function ProjectCard({ proyecto }: { proyecto: Proyecto }) {
  return (
    <Link href={`/proyectos/${proyecto.id}`} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
      <div style={{ background: 'rgba(17,24,39,0.85)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: '12px', padding: '20px', cursor: 'pointer', transition: 'border-color 0.2s' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: prioColor[proyecto.prioridad], display: 'inline-block' }} />
              <h3 style={{ fontWeight: 600, color: '#fff', margin: 0 }}>{proyecto.nombre}</h3>
            </div>
            <p style={{ fontSize: '12px', color: '#A0AEC0', margin: 0 }}>{proyecto.cliente}</p>
          </div>
          <StatusBadge estado={proyecto.estado} />
        </div>
        {proyecto.mensajeReciente && (
          <p style={{ fontSize: '13px', color: 'rgba(160,174,192,0.8)', fontStyle: 'italic', marginBottom: '16px' }}>
            &ldquo;{proyecto.mensajeReciente}&rdquo;
          </p>
        )}
        <div style={{ marginBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#A0AEC0', marginBottom: '4px' }}>
            <span>Progreso</span><span>{proyecto.progreso}%</span>
          </div>
          <div style={{ height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '9999px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${proyecto.progreso}%`, background: '#E8792F', borderRadius: '9999px' }} />
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#A0AEC0' }}>
          <span>{proyecto.responsable}</span><span>{proyecto.ultimaActividad}</span>
        </div>
        {proyecto.tags && proyecto.tags.length > 0 && (
          <div style={{ display: 'flex', gap: '4px', marginTop: '12px' }}>
            {proyecto.tags.map(tag => (
              <span key={tag} style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '4px', background: 'rgba(232,121,47,0.1)', color: '#E8792F', border: '1px solid rgba(232,121,47,0.2)' }}>{tag}</span>
            ))}
          </div>
        )}
      </div>
    </Link>
  )
}
