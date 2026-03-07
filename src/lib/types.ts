export type EstadoProyecto = 'activo' | 'pausado' | 'completado' | 'en_riesgo'

export interface Proyecto {
  id: string
  nombre: string
  cliente: string
  estado: EstadoProyecto
  prioridad: 'alta' | 'media' | 'baja'
  ultimaActividad?: string
  mensajeReciente?: string
  responsable: string
  progreso: number
  tags?: string[]
  whatsapp_chat_id?: string
  slack_channel_id?: string
  created_at?: string
  updated_at?: string
}
