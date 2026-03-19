'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface Task {
  id: string
  title: string
  completed: boolean
  status: string
  order_index: number
  category: string | null
  assignee: string | null
  notes: string | null
}

export default function ProjectTasksTab({ projectId }: { projectId: string }) {
  const router = useRouter()
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/projects/${projectId}/tasks`)
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setTasks(d) })
      .finally(() => setLoading(false))
  }, [projectId])

  async function toggleTask(taskId: string, currentCompleted: boolean) {
    setUpdating(taskId)
    const newCompleted = !currentCompleted

    // Optimistic update
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, completed: newCompleted, status: newCompleted ? 'completado' : 'pendiente' } : t))

    try {
      await fetch(`/api/projects/${projectId}/tasks`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, completed: newCompleted }),
      })
    } catch {
      // Revert on error
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, completed: currentCompleted } : t))
    } finally {
      setUpdating(null)
    }
  }

  const completed = tasks.filter(t => t.completed).length
  const total = tasks.length
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0

  if (loading) {
    return (
      <div style={{ padding: '32px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
        Cargando tareas...
      </div>
    )
  }

  if (tasks.length === 0) {
    return (
      <div style={{
        textAlign: 'center', padding: '48px 24px',
        background: 'rgba(17,24,39,0.85)', border: '1px solid rgba(255,255,255,0.10)',
        borderRadius: '12px',
      }}>
        <div style={{ fontSize: '32px', marginBottom: '12px' }}>✅</div>
        <p style={{ fontSize: '14px', color: '#64748b', margin: '0 0 16px' }}>
          Sin tareas generadas para este proyecto
        </p>
        <button
          onClick={() => router.push('/admin/onboarding')}
          style={{
            padding: '9px 18px', borderRadius: '8px', cursor: 'pointer',
            background: '#E8792F', border: 'none', color: '#fff',
            fontSize: '13px', fontWeight: 600,
          }}
        >
          🚀 Ir al Onboarding
        </button>
      </div>
    )
  }

  return (
    <div>
      {/* Progress bar */}
      <div style={{
        background: 'rgba(17,24,39,0.8)', border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '12px', padding: '16px 20px', marginBottom: '16px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#f1f5f9' }}>
            Progreso del proyecto
          </span>
          <span style={{ fontSize: '13px', fontWeight: 700, color: pct === 100 ? '#22c55e' : '#E8792F' }}>
            {completed}/{total} · {pct}%
          </span>
        </div>
        <div style={{ height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: '3px', transition: 'width 0.4s ease',
            width: `${pct}%`,
            background: pct === 100 ? '#22c55e' : 'linear-gradient(90deg, #E8792F, #f59e0b)',
          }} />
        </div>
      </div>

      {/* Task list — grouped by category if multiple */}
      {(() => {
        const categories = [...new Set(tasks.map(t => t.category).filter(Boolean))]
        const multiCategory = categories.length > 1
        return null // rendered below
      })()}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {tasks.map((task, idx) => {
          const prevTask = tasks[idx - 1]
          const showCategoryHeader = task.category && task.category !== prevTask?.category
          const multiCat = [...new Set(tasks.map(t => t.category).filter(Boolean))].length > 1
          return (
          <div key={task.id + '-wrap'}>
            {multiCat && showCategoryHeader && (
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#E8792F', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '12px 4px 6px', marginTop: idx > 0 ? '8px' : 0 }}>
                {task.category === 'Agente de Voz' ? '🎙 Agente de Voz' : '💬 WhatsApp / Texto'}
              </div>
            )}
            <div
            style={{
              display: 'flex', gap: '12px', alignItems: 'flex-start',
              padding: '12px 16px', borderRadius: '8px',
              background: task.completed ? 'rgba(34,197,94,0.04)' : 'rgba(17,24,39,0.8)',
              border: `1px solid ${task.completed ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.07)'}`,
              transition: 'all 0.15s',
              opacity: updating === task.id ? 0.6 : 1,
            }}
          >
            {/* Step number */}
            <div style={{
              width: '22px', height: '22px', borderRadius: '50%', flexShrink: 0,
              background: task.completed ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.06)',
              border: `1px solid ${task.completed ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.12)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '10px', fontWeight: 700,
              color: task.completed ? '#22c55e' : '#475569',
              marginTop: '1px',
            }}>
              {task.completed ? '✓' : idx + 1}
            </div>

            {/* Title */}
            <div style={{ flex: 1 }}>
              <span style={{
                fontSize: '13px', color: task.completed ? '#475569' : '#e2e8f0',
                textDecoration: task.completed ? 'line-through' : 'none',
                lineHeight: 1.5,
              }}>
                {task.title}
              </span>
            </div>

            {/* Checkbox */}
            <button
              onClick={() => toggleTask(task.id, task.completed)}
              disabled={updating === task.id}
              style={{
                width: '20px', height: '20px', borderRadius: '4px', flexShrink: 0,
                background: task.completed ? '#22c55e' : 'transparent',
                border: `2px solid ${task.completed ? '#22c55e' : 'rgba(255,255,255,0.2)'}`,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '11px', color: '#fff', transition: 'all 0.15s',
              }}
            >
              {task.completed ? '✓' : ''}
            </button>
            </div>
          </div>
          )
        })}
      </div>
    </div>
  )
}
