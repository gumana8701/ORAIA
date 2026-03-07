'use client'
import { useState } from 'react'
import { Developer, ProjectDeveloper } from '@/lib/types'

interface Props {
  projectId: string
  allDevelopers: Developer[]
  assigned: ProjectDeveloper[]
  onUpdate: () => void
}

export default function DeveloperAssigner({ projectId, allDevelopers, assigned, onUpdate }: Props) {
  const [loading, setLoading] = useState<string | null>(null)

  const assignedIds = new Set(assigned.map(a => a.developer_id))

  async function assign(devId: string) {
    setLoading(devId)
    await fetch(`/api/projects/${projectId}/developers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ developer_id: devId }),
    })
    setLoading(null)
    onUpdate()
  }

  async function unassign(devId: string) {
    setLoading(devId)
    await fetch(`/api/projects/${projectId}/developers`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ developer_id: devId }),
    })
    setLoading(null)
    onUpdate()
  }

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {allDevelopers.map(dev => {
          const isAssigned = assignedIds.has(dev.id)
          const isSupervisor = dev.es_supervisor
          const isLoading = loading === dev.id

          return (
            <div key={dev.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 14px', borderRadius: '8px',
              background: isAssigned ? `${dev.color}12` : 'rgba(17,24,39,0.6)',
              border: `1px solid ${isAssigned ? dev.color + '35' : 'rgba(255,255,255,0.06)'}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '18px' }}>{dev.emoji}</span>
                <div>
                  <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: isAssigned ? '#fff' : '#A0AEC0' }}>
                    {dev.nombre}
                  </p>
                  {isSupervisor && (
                    <p style={{ margin: 0, fontSize: '11px', color: dev.color }}>Supervisor · siempre asignado</p>
                  )}
                </div>
              </div>
              {isSupervisor ? (
                <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', background: `${dev.color}20`, color: dev.color, fontWeight: 600 }}>
                  Supervisor
                </span>
              ) : (
                <button
                  onClick={() => isAssigned ? unassign(dev.id) : assign(dev.id)}
                  disabled={!!isLoading}
                  style={{
                    padding: '5px 14px', borderRadius: '6px', fontSize: '12px',
                    fontWeight: 600, cursor: 'pointer', border: '1px solid',
                    borderColor: isAssigned ? 'rgba(239,68,68,0.3)' : `${dev.color}50`,
                    background: isAssigned ? 'rgba(239,68,68,0.08)' : `${dev.color}15`,
                    color: isAssigned ? '#ef4444' : dev.color,
                    opacity: isLoading ? 0.5 : 1,
                  }}
                >
                  {isLoading ? '...' : isAssigned ? 'Quitar' : 'Asignar'}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
