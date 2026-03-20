'use client'
import { useState, useEffect, useRef } from 'react'

interface Task {
  id: string
  title: string
  completed: boolean
  status: 'pendiente' | 'bloqueado' | 'completado'
  order_index: number
  category: string | null
  assignee: string | null
  notes: string | null
}

interface Comment {
  id: string
  task_id: string
  author: string
  content: string
  created_at: string
}

const STATUS_CONFIG = {
  pendiente:  { label: 'Pendiente',  color: '#64748b', bg: 'rgba(100,116,139,0.15)', dot: '#64748b' },
  bloqueado:  { label: 'Bloqueado',  color: '#f87171', bg: 'rgba(248,113,113,0.12)', dot: '#ef4444' },
  completado: { label: 'Completado', color: '#22c55e', bg: 'rgba(34,197,94,0.12)',   dot: '#22c55e' },
}

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return 'hace un momento'
  if (diff < 3600) return `hace ${Math.floor(diff/60)}m`
  if (diff < 86400) return `hace ${Math.floor(diff/3600)}h`
  return `hace ${Math.floor(diff/86400)}d`
}

// ── Task Drawer ───────────────────────────────────────────────────────────────
function TaskDrawer({
  task, projectId, onClose, onStatusChange,
}: {
  task: Task; projectId: string; onClose: () => void; onStatusChange: (taskId: string, status: Task['status']) => void
}) {
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState('')
  const [postingComment, setPostingComment] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const commentsEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch(`/api/projects/${projectId}/tasks/${task.id}/comments`)
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setComments(d) })
  }, [task.id, projectId])

  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [comments])

  async function changeStatus(newStatus: Task['status']) {
    if (newStatus === task.status) return
    setUpdatingStatus(true)
    await fetch(`/api/projects/${projectId}/tasks`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId: task.id, status: newStatus, author: 'Equipo' }),
    })
    onStatusChange(task.id, newStatus)
    setUpdatingStatus(false)
  }

  async function addComment() {
    if (!newComment.trim()) return
    setPostingComment(true)
    const res = await fetch(`/api/projects/${projectId}/tasks/${task.id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: newComment.trim(), author: 'Equipo' }),
    })
    const data = await res.json()
    if (data.id) {
      setComments(prev => [...prev, data])
      setNewComment('')
    }
    setPostingComment(false)
  }

  const cfg = STATUS_CONFIG[task.status] || STATUS_CONFIG.pendiente

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 40,
        }}
      />
      {/* Drawer */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: '400px', maxWidth: '95vw',
        background: '#0f172a', borderLeft: '1px solid rgba(255,255,255,0.08)',
        zIndex: 50, display: 'flex', flexDirection: 'column',
        boxShadow: '-4px 0 24px rgba(0,0,0,0.4)',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px', borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'flex-start', gap: '12px',
        }}>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#f1f5f9', margin: '0 0 10px', lineHeight: 1.4 }}>
              {task.title}
            </h2>
            {/* Status selector */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {(Object.entries(STATUS_CONFIG) as [Task['status'], typeof STATUS_CONFIG[keyof typeof STATUS_CONFIG]][]).map(([key, c]) => (
                <button
                  key={key}
                  onClick={() => changeStatus(key)}
                  disabled={updatingStatus}
                  style={{
                    padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600,
                    cursor: updatingStatus ? 'wait' : 'pointer',
                    background: task.status === key ? c.bg : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${task.status === key ? c.dot : 'rgba(255,255,255,0.08)'}`,
                    color: task.status === key ? c.color : '#475569',
                    transition: 'all 0.15s',
                  }}
                >
                  <span style={{
                    display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%',
                    background: task.status === key ? c.dot : '#475569', marginRight: '5px',
                    verticalAlign: 'middle',
                  }} />
                  {c.label}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#475569', fontSize: '18px', padding: '2px', flexShrink: 0,
            }}
          >✕</button>
        </div>

        {/* Comments */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          <p style={{ fontSize: '11px', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
            Comentarios ({comments.length})
          </p>
          {comments.length === 0 && (
            <p style={{ fontSize: '13px', color: '#334155', textAlign: 'center', padding: '24px 0' }}>
              Sin comentarios todavía
            </p>
          )}
          {comments.map(c => (
            <div key={c.id} style={{
              marginBottom: '12px', padding: '10px 12px', borderRadius: '8px',
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#E8792F' }}>{c.author}</span>
                <span style={{ fontSize: '11px', color: '#334155' }}>{timeAgo(c.created_at)}</span>
              </div>
              <p style={{ fontSize: '13px', color: '#cbd5e0', margin: 0, lineHeight: 1.5 }}>{c.content}</p>
            </div>
          ))}
          <div ref={commentsEndRef} />
        </div>

        {/* Add comment */}
        <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <textarea
            value={newComment}
            onChange={e => setNewComment(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) addComment() }}
            placeholder="Agregar comentario... (Ctrl+Enter para enviar)"
            rows={3}
            style={{
              width: '100%', boxSizing: 'border-box', resize: 'none',
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)',
              borderRadius: '8px', padding: '10px 12px', fontSize: '13px', color: '#f1f5f9',
              outline: 'none', fontFamily: 'inherit',
            }}
          />
          <button
            onClick={addComment}
            disabled={postingComment || !newComment.trim()}
            style={{
              marginTop: '8px', width: '100%', padding: '9px', borderRadius: '8px',
              background: postingComment || !newComment.trim() ? 'rgba(255,255,255,0.06)' : '#E8792F',
              border: 'none', cursor: postingComment || !newComment.trim() ? 'not-allowed' : 'pointer',
              color: postingComment || !newComment.trim() ? '#334155' : '#fff',
              fontSize: '13px', fontWeight: 600,
            }}
          >
            {postingComment ? '⟳ Enviando...' : '💬 Enviar comentario'}
          </button>
        </div>
      </div>
    </>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function ProjectTasksTab({ projectId, canAddTasks = false }: { projectId: string; canAddTasks?: boolean }) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [addingTask, setAddingTask] = useState(false)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [savingTask, setSavingTask] = useState(false)

  useEffect(() => {
    fetch(`/api/projects/${projectId}/tasks`)
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setTasks(d) })
      .finally(() => setLoading(false))
  }, [projectId])

  const completed = tasks.filter(t => t.status === 'completado' || t.completed).length
  const total = tasks.length
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0

  function handleStatusChange(taskId: string, newStatus: Task['status']) {
    setTasks(prev => prev.map(t =>
      t.id === taskId ? { ...t, status: newStatus, completed: newStatus === 'completado' } : t
    ))
    if (selectedTask?.id === taskId) {
      setSelectedTask(prev => prev ? { ...prev, status: newStatus, completed: newStatus === 'completado' } : null)
    }
  }

  async function addTask() {
    if (!newTaskTitle.trim()) return
    setSavingTask(true)
    const res = await fetch(`/api/projects/${projectId}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTaskTitle.trim(), author: 'Equipo' }),
    })
    const data = await res.json()
    if (data.id) {
      setTasks(prev => [...prev, data])
      setNewTaskTitle('')
      setAddingTask(false)
    }
    setSavingTask(false)
  }

  if (loading) {
    return (
      <div style={{ padding: '32px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
        Cargando tareas...
      </div>
    )
  }

  return (
    <>
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
          {/* Status summary pills */}
          <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
            {(Object.entries(STATUS_CONFIG) as [Task['status'], typeof STATUS_CONFIG[keyof typeof STATUS_CONFIG]][]).map(([key, c]) => {
              const count = tasks.filter(t => (t.status || 'pendiente') === key).length
              if (count === 0) return null
              return (
                <span key={key} style={{
                  fontSize: '11px', padding: '2px 8px', borderRadius: '20px',
                  background: c.bg, color: c.color, fontWeight: 600, border: `1px solid ${c.dot}33`,
                }}>
                  {c.label}: {count}
                </span>
              )
            })}
          </div>
        </div>

        {/* Add task button */}
        {canAddTasks && (
          <div style={{ marginBottom: '12px' }}>
            {!addingTask ? (
              <button
                onClick={() => setAddingTask(true)}
                style={{
                  padding: '8px 16px', borderRadius: '8px', cursor: 'pointer',
                  background: 'rgba(232,121,47,0.1)', border: '1px dashed rgba(232,121,47,0.4)',
                  color: '#E8792F', fontSize: '13px', fontWeight: 600,
                }}
              >
                + Agregar tarea
              </button>
            ) : (
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  autoFocus
                  type="text"
                  value={newTaskTitle}
                  onChange={e => setNewTaskTitle(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addTask(); if (e.key === 'Escape') setAddingTask(false) }}
                  placeholder="Nombre de la nueva tarea..."
                  style={{
                    flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(232,121,47,0.4)',
                    borderRadius: '8px', padding: '8px 12px', fontSize: '13px', color: '#f1f5f9', outline: 'none',
                  }}
                />
                <button onClick={addTask} disabled={savingTask || !newTaskTitle.trim()} style={{ padding: '8px 14px', borderRadius: '8px', background: '#E8792F', border: 'none', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                  {savingTask ? '...' : '✓'}
                </button>
                <button onClick={() => setAddingTask(false)} style={{ padding: '8px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.06)', border: 'none', color: '#64748b', fontSize: '13px', cursor: 'pointer' }}>
                  ✕
                </button>
              </div>
            )}
          </div>
        )}

        {/* Task list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {tasks.length === 0 && (
            <div style={{ textAlign: 'center', padding: '32px', color: '#334155', fontSize: '13px' }}>
              Sin tareas. Completa el onboarding para generarlas.
            </div>
          )}
          {tasks.map((task, idx) => {
            const prevTask = tasks[idx - 1]
            const showCategoryHeader = task.category && task.category !== prevTask?.category
            const multiCat = [...new Set(tasks.map(t => t.category).filter(Boolean))].length > 1
            const status = (task.status || 'pendiente') as Task['status']
            const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pendiente

            return (
              <div key={task.id}>
                {multiCat && showCategoryHeader && (
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#E8792F', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '10px 4px 5px', marginTop: idx > 0 ? '6px' : 0 }}>
                    {task.category === 'Agente de Voz' ? '🎙 Agente de Voz' : '💬 WhatsApp / Texto'}
                  </div>
                )}
                <div
                  onClick={() => setSelectedTask(task)}
                  style={{
                    display: 'flex', gap: '12px', alignItems: 'center',
                    padding: '11px 14px', borderRadius: '8px', cursor: 'pointer',
                    background: task.completed ? 'rgba(34,197,94,0.04)' : 'rgba(17,24,39,0.8)',
                    border: `1px solid ${task.completed ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.07)'}`,
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(232,121,47,0.3)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = task.completed ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.07)')}
                >
                  {/* Step number */}
                  <div style={{
                    width: '22px', height: '22px', borderRadius: '50%', flexShrink: 0,
                    background: task.completed ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.06)',
                    border: `1px solid ${task.completed ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.12)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '10px', fontWeight: 700,
                    color: task.completed ? '#22c55e' : '#475569',
                  }}>
                    {task.completed ? '✓' : idx + 1}
                  </div>

                  {/* Title */}
                  <span style={{
                    flex: 1, fontSize: '13px',
                    color: task.completed ? '#475569' : '#e2e8f0',
                    textDecoration: task.completed ? 'line-through' : 'none',
                    lineHeight: 1.5,
                  }}>
                    {task.title}
                  </span>

                  {/* Status badge */}
                  <span style={{
                    fontSize: '10px', padding: '2px 7px', borderRadius: '20px',
                    background: cfg.bg, color: cfg.color, fontWeight: 600,
                    border: `1px solid ${cfg.dot}44`, flexShrink: 0,
                  }}>
                    {cfg.label}
                  </span>

                  {/* Arrow */}
                  <span style={{ color: '#334155', fontSize: '12px', flexShrink: 0 }}>›</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Task Drawer */}
      {selectedTask && (
        <TaskDrawer
          task={selectedTask}
          projectId={projectId}
          onClose={() => setSelectedTask(null)}
          onStatusChange={handleStatusChange}
        />
      )}
    </>
  )
}
