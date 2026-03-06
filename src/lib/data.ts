import { Proyecto } from './types'

export const proyectosMock: Proyecto[] = [
  { id: '1', nombre: 'Plataforma E-commerce', cliente: 'Cliente A', estado: 'activo', prioridad: 'alta', ultimaActividad: 'hace 2 horas', mensajeReciente: 'El cliente aprobó el diseño de la página de pago.', responsable: 'Guillermo', progreso: 65, tags: ['WhatsApp', 'Slack'] },
  { id: '2', nombre: 'App Móvil iOS', cliente: 'Cliente B', estado: 'en_riesgo', prioridad: 'alta', ultimaActividad: 'hace 30 min', mensajeReciente: 'Bloqueados por integración con API de pagos.', responsable: 'Dev Team', progreso: 40, tags: ['Slack'] },
  { id: '3', nombre: 'Rediseño Web Corporativa', cliente: 'Cliente C', estado: 'pausado', prioridad: 'media', ultimaActividad: 'hace 1 día', mensajeReciente: 'Esperando assets del cliente.', responsable: 'Guillermo', progreso: 30, tags: ['WhatsApp'] },
  { id: '4', nombre: 'Sistema CRM Interno', cliente: 'Interno', estado: 'completado', prioridad: 'baja', ultimaActividad: 'hace 3 días', mensajeReciente: 'Proyecto entregado y aprobado.', responsable: 'Dev Team', progreso: 100, tags: [] },
]
