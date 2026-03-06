'use client'
import { EstadoProyecto } from '@/lib/types'

const cfg: Record<EstadoProyecto, { label: string; cls: string }> = {
  activo: { label: 'Activo', cls: 'bg-green-500/20 text-green-400 border border-green-500/30' },
  pausado: { label: 'Pausado', cls: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' },
  completado: { label: 'Completado', cls: 'bg-blue-500/20 text-blue-400 border border-blue-500/30' },
  en_riesgo: { label: 'En Riesgo', cls: 'bg-red-500/20 text-red-400 border border-red-500/30' },
}

export default function StatusBadge({ estado }: { estado: EstadoProyecto }) {
  const { label, cls } = cfg[estado]
  return <span className={`text-xs font-semibold px-2 py-1 rounded-full ${cls}`}>{label}</span>
}
