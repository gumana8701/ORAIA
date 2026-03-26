export type EstadoProyecto = 'activo' | 'pausado' | 'completado' | 'en_riesgo'

export interface Proyecto {
  id: string
  nombre: string
  cliente: string
  estado: EstadoProyecto
  prioridad: 'alta' | 'media' | 'baja'
  responsable: string | null
  progreso: number
  whatsapp_chat_id?: string
  slack_channel_id?: string
  color_emoji?: string
  ultimo_mensaje?: string
  ultima_actividad?: string
  total_mensajes?: number
  alertas_count?: number
  desarrollador_principal?: string
  fecha_inicio?: string
  created_at?: string
  updated_at?: string
  nicho?: string
  tipo_leads?: 'campaña' | 'base_de_datos' | 'ambos'
  twilio_cuenta?: string
  twilio_bundle?: string
  twilio_numero?: string
  twilio_saldo?: string
  tipo_integracion?: 'chatbot' | 'app_level'
  doc_expediente?: string
  doc_flujograma?: string
  doc_cableado?: string
  accesos_brindados?: string
}

export interface Mensaje {
  id: string
  project_id: string
  fuente: 'whatsapp' | 'slack' | 'manual'
  sender: string
  contenido: string
  timestamp: string
  es_del_cliente: boolean
  metadata?: Record<string, unknown>
}

export interface Alerta {
  id: string
  project_id: string
  message_id?: string
  tipo: 'reembolso' | 'pago' | 'enojo' | 'silencio' | 'entrega' | 'cancelacion' | 'urgente' | 'otro'
  descripcion: string
  nivel: 'bajo' | 'medio' | 'alto' | 'critico'
  resuelta: boolean
  created_at: string
}

export interface Developer {
  id: string
  nombre: string
  emoji: string
  color: string
  es_supervisor: boolean
  activo: boolean
  created_at?: string
}

export interface ProjectDeveloper {
  id: string
  project_id: string
  developer_id: string
  rol: string
  assigned_at: string
  developer?: Developer
}
