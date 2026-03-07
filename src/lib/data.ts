import { Proyecto } from './types'

export const proyectosMock: Proyecto[] = [
  { id: '1', nombre: 'Plataforma E-commerce', cliente: 'Cliente A', estado: 'activo', prioridad: 'alta', ultima_actividad: new Date().toISOString(), ultimo_mensaje: 'El cliente aprobó el diseño de la página de pago.', responsable: 'Guillermo', progreso: 65 },
  { id: '2', nombre: 'App Móvil iOS', cliente: 'Cliente B', estado: 'en_riesgo', prioridad: 'alta', ultima_actividad: new Date().toISOString(), ultimo_mensaje: 'Bloqueados por integración con API de pagos.', responsable: 'Dev Team', progreso: 40 },
  { id: '3', nombre: 'Rediseño Web Corporativa', cliente: 'Cliente C', estado: 'pausado', prioridad: 'media', ultima_actividad: new Date().toISOString(), ultimo_mensaje: 'Esperando assets del cliente.', responsable: 'Guillermo', progreso: 30 },
  { id: '4', nombre: 'Sistema CRM Interno', cliente: 'Interno', estado: 'completado', prioridad: 'baja', ultima_actividad: new Date().toISOString(), ultimo_mensaje: 'Proyecto entregado y aprobado.', responsable: 'Dev Team', progreso: 100 },
]
