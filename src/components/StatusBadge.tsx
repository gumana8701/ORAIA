import { EstadoProyecto } from '@/lib/types'

const cfg: Record<EstadoProyecto, { label: string; dot: string; cls: string }> = {
  activo:     { label: 'Activo',     dot: '#4ade80', cls: 'status-activo'     },
  pausado:    { label: 'Pausado',    dot: '#9ca3af', cls: 'status-pausado'    },
  completado: { label: 'Completado', dot: '#60a5fa', cls: 'status-completado' },
  en_riesgo:  { label: 'En Riesgo',  dot: '#f87171', cls: 'status-en_riesgo'  },
}

export default function StatusBadge({ estado }: { estado: EstadoProyecto }) {
  const { label, dot, cls } = cfg[estado] ?? cfg['activo']
  return (
    <span className={`status-badge ${cls}`}>
      <span style={{
        display: 'inline-block', width: '5px', height: '5px',
        borderRadius: '50%', background: dot, flexShrink: 0,
      }}/>
      {label}
    </span>
  )
}
