export type EstadoProyecto = 'activo' | 'pausado' | 'completado' | 'en_riesgo'

export interface Proyecto {
  id: string
  nombre: string
  cliente: string
  estado: EstadoProyecto
  prioridad: 'alta' | 'media' | 'baja'
  ultimaActividad: string
  mensajeReciente?: string
  responsable: string
  progreso: number
  tags?: string[]
}
