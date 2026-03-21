'use client'
import { useState, useEffect, useRef } from 'react'

interface Task {
  id: string
  title: string
  completed: boolean
  status: 'pendiente' | 'en_progreso' | 'bloqueado' | 'completado'
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
  pendiente:   { label: 'Pendiente',   color: '#64748b', bg: 'rgba(100,116,139,0.15)', dot: '#64748b' },
  en_progreso: { label: 'En Progreso', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)',  dot: '#3b82f6' },
  bloqueado:   { label: 'Bloqueado',   color: '#f87171', bg: 'rgba(248,113,113,0.12)', dot: '#ef4444' },
  completado:  { label: 'Completado',  color: '#22c55e', bg: 'rgba(34,197,94,0.12)',   dot: '#22c55e' },
}

const TICKET_TEAM = ['Jennifer Serrano','Trina Gomez','Enzo ORA IA','Brenda Cruz','Luca Fonzo','Victor Ramirez','Héctor Ramirez']

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return 'hace un momento'
  if (diff < 3600) return `hace ${Math.floor(diff/60)}m`
  if (diff < 86400) return `hace ${Math.floor(diff/3600)}h`
  return `hace ${Math.floor(diff/86400)}d`
}

// ── Ticket Modal ─────────────────────────────────────────────────────────────
function TicketModal({
  task, projectId, onClose, onCreated, currentUser = 'Equipo',
}: {
  task: Task; projectId: string; onClose: () => void
  onCreated: (ticket: any) => void; currentUser?: string
}) {
  const [desc, setDesc]           = useState('')
  const [assignee, setAssignee]   = useState('')
  const [markBlocked, setBlock]   = useState(false)
  const [saving, setSaving]       = useState(false)

  async function submit() {
    if (!desc.trim() || !assignee) return
    setSaving(true)
    const res = await fetch(`/api/projects/${projectId}/tasks/${task.id}/tickets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: desc.trim(), assignee, requested_by: currentUser, mark_blocked: markBlocked }),
    })
    const data = await res.json()
    if (data.id) { onCreated(data); onClose() }
    setSaving(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '16px', padding: '28px', width: '440px', maxWidth: '95vw' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#f1f5f9' }}>🎫 Pedir ayuda</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '18px', cursor: 'pointer' }}>✕</button>
        </div>
        <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 16px' }}>Tarea: <span style={{ color: '#94a3b8', fontWeight: 600 }}>{task.title}</span></p>

        <label style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '6px' }}>¿Qué necesitas?</label>
        <textarea
          autoFocus value={desc} onChange={e => setDesc(e.target.value)}
          placeholder="Describe el problema o lo que necesitas para continuar..."
          rows={4}
          style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', color: '#f1f5f9', outline: 'none', resize: 'vertical', marginBottom: '14px' }}
        />

        <label style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '6px' }}>Asignar a</label>
        <select value={assignee} onChange={e => setAssignee(e.target.value)}
          style={{ width: '100%', background: '#fff', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', padding: '8px 12px', fontSize: '13px', color: '#111827', marginBottom: '14px', outline: 'none' }}>
          <option value="">— Seleccionar persona —</option>
          {TICKET_TEAM.map(n => <option key={n} value={n} style={{ color: '#111827' }}>{n}</option>)}
        </select>

        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#94a3b8', cursor: 'pointer', marginBottom: '20px' }}>
          <input type="checkbox" checked={markBlocked} onChange={e => setBlock(e.target.checked)}
            style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
          Marcar tarea como <strong style={{ color: '#f87171' }}>Bloqueada</strong>
        </label>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={submit} disabled={saving || !desc.trim() || !assignee}
            style={{ flex: 1, padding: '10px', borderRadius: '8px', background: '#E8792F', border: 'none', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
            {saving ? 'Enviando...' : '🎫 Crear ticket'}
          </button>
          <button onClick={onClose} style={{ padding: '10px 14px', borderRadius: '8px', background: 'rgba(255,255,255,0.06)', border: 'none', color: '#64748b', fontSize: '13px', cursor: 'pointer' }}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Task Drawer ───────────────────────────────────────────────────────────────
function TaskDrawer({
  task, projectId, onClose, onStatusChange, onAssigneeChange,
}: {
  task: Task; projectId: string; onClose: () => void
  onStatusChange: (taskId: string, status: Task['status']) => void
  onAssigneeChange: (taskId: string, assignee: string | null) => void
}) {
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState('')
  const [postingComment, setPostingComment] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [showTicketModal, setShowTicketModal] = useState(false)
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
    // Auto-open ticket modal when marking as bloqueado
    if (newStatus === 'bloqueado') setShowTicketModal(true)
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
              <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#f1f5f9', margin: 0, lineHeight: 1.4, flex: 1 }}>
                {task.title}
              </h2>
              <button
                onClick={() => setShowTicketModal(true)}
                style={{ marginLeft: '10px', padding: '4px 10px', borderRadius: '6px', flexShrink: 0, background: 'rgba(232,121,47,0.1)', border: '1px solid rgba(232,121,47,0.3)', color: '#E8792F', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                title="Pedir ayuda para esta tarea"
              >
                🎫 Pedir ayuda
              </button>
            </div>
            {/* Assignee selector */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '4px' }}>
                👤 Asignado a
              </label>
              <select
                defaultValue={task.assignee || ''}
                onChange={async e => {
                  const newAssignee = e.target.value || null
                  await fetch(`/api/projects/${projectId}/tasks`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ taskId: task.id, assignee: newAssignee }),
                  })
                  onAssigneeChange(task.id, newAssignee)
                }}
                style={{
                  width: '100%', background: '#fff', border: '1px solid #e2e8f0',
                  borderRadius: '8px', padding: '7px 10px', fontSize: '13px', color: '#111827', outline: 'none',
                }}
              >
                <option value="">— Sin asignar —</option>
                {(['Enzo ORA IA','Héctor Ramirez','Victor Ramirez','Brenda Cruz','Kevin ORA IA','Luca Fonzo','Jennifer Serrano','Trina Gomez'] as string[]).map(n => (
                  <option key={n} value={n} style={{ color: '#111827' }}>{n}</option>
                ))}
              </select>
            </div>
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

      {/* Ticket Modal */}
      {showTicketModal && (
        <TicketModal
          task={task}
          projectId={projectId}
          onClose={() => setShowTicketModal(false)}
          onCreated={ticket => {
            // Add system comment locally
            setComments(prev => [...prev, {
              id: Date.now().toString(), task_id: task.id,
              author: 'Sistema', content: `🎫 Ticket abierto para **${ticket.assignee}**: ${ticket.description}`,
              created_at: new Date().toISOString(),
            }])
          }}
        />
      )}
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
  const [newTaskAssignee, setNewTaskAssignee] = useState('')
  const [savingTask, setSavingTask] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'voice' | 'chat'>('all')

  const TEAM = [
    'Enzo ORA IA', 'Héctor Ramirez', 'Victor Ramirez', 'Brenda Cruz',
    'Kevin ORA IA', 'Luca Fonzo', 'Jennifer Serrano', 'Trina Gomez',
  ]

  useEffect(() => {
    fetch(`/api/projects/${projectId}/tasks`)
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setTasks(d) })
      .finally(() => setLoading(false))
  }, [projectId])

  const completed = tasks.filter(t => t.status === 'completado' || t.completed).length
  const total = tasks.length
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0

  const hasVoice = tasks.some(t => t.category === 'Agente de Voz')
  const hasChat  = tasks.some(t => t.category === 'WhatsApp/Texto')
  const multiCat = hasVoice && hasChat

  const filteredTasks = tasks
    .filter(t => {
      if (categoryFilter === 'voice') return t.category === 'Agente de Voz'
      if (categoryFilter === 'chat')  return t.category === 'WhatsApp/Texto'
      return true
    })
    .sort((a, b) => {
      // Group by category first: Agente de Voz → WhatsApp/Texto → null
      const catOrder = (c: string | null) =>
        c === 'Agente de Voz' ? 0 : c === 'WhatsApp/Texto' ? 1 : 2
      const catDiff = catOrder(a.category) - catOrder(b.category)
      if (catDiff !== 0) return catDiff
      return (a.order_index ?? 0) - (b.order_index ?? 0)
    })

  function handleStatusChange(taskId: string, newStatus: Task['status']) {
    setTasks(prev => prev.map(t =>
      t.id === taskId ? { ...t, status: newStatus, completed: newStatus === 'completado' } : t
    ))
    setSelectedTask(prev => prev?.id === taskId ? { ...prev, status: newStatus, completed: newStatus === 'completado' } : prev)
  }

  function handleAssigneeChange(taskId: string, assignee: string | null) {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, assignee } : t))
    setSelectedTask(prev => prev?.id === taskId ? { ...prev, assignee } : prev)
  }

  async function addTask() {
    if (!newTaskTitle.trim()) return
    setSavingTask(true)
    const res = await fetch(`/api/projects/${projectId}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTaskTitle.trim(), assignee: newTaskAssignee || null, author: 'Equipo' }),
    })
    const data = await res.json()
    if (data.id) {
      setTasks(prev => [...prev, data])
      setNewTaskTitle('')
      setNewTaskAssignee('')
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
        {/* ── Top bar: 60% progress | 25% filters | 15% add task ── */}
        <div style={{
          background: 'rgba(17,24,39,0.8)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '12px', padding: '14px 16px', marginBottom: '16px',
          display: 'flex', gap: '12px', alignItems: 'center',
        }}>
          {/* Progress — grows to fill */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#f1f5f9' }}>Progreso</span>
              <span style={{ fontSize: '12px', fontWeight: 700, color: pct === 100 ? '#22c55e' : '#E8792F' }}>
                {completed}/{total} · {pct}%
              </span>
            </div>
            <div style={{ height: '8px', borderRadius: '4px', background: 'rgba(255,255,255,0.12)', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{
                height: '100%', borderRadius: '4px', transition: 'width 0.4s ease',
                width: pct > 0 ? `${pct}%` : '0%',
                background: pct === 100 ? '#22c55e' : 'linear-gradient(90deg, #E8792F, #f59e0b)',
                minWidth: pct > 0 ? '8px' : '0',
              }} />
            </div>
          </div>

          {/* Filters — fixed */}
          <div style={{ flexShrink: 0, display: 'flex', gap: '6px', justifyContent: 'center' }}>
            {([
              { key: 'all',   label: 'Todos' },
              ...(hasVoice ? [{ key: 'voice', label: '🎙 Voz' }] : []),
              ...(hasChat  ? [{ key: 'chat',  label: '💬 Chat' }] : []),
            ] as { key: typeof categoryFilter; label: string }[]).map(f => (
              <button
                key={f.key}
                onClick={() => setCategoryFilter(f.key)}
                style={{
                  padding: '5px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 600,
                  cursor: 'pointer', border: '1px solid transparent',
                  background: categoryFilter === f.key ? '#E8792F' : 'rgba(255,255,255,0.06)',
                  borderColor: categoryFilter === f.key ? '#E8792F' : 'rgba(255,255,255,0.10)',
                  color: categoryFilter === f.key ? '#fff' : '#94a3b8',
                  transition: 'all 0.15s',
                }}
              >{f.label}</button>
            ))}
          </div>

          {/* Add task — fixed */}
          <div style={{ flexShrink: 0 }}>
            {canAddTasks && !addingTask && (
              <button
                onClick={() => setAddingTask(true)}
                style={{
                  padding: '5px 12px', borderRadius: '6px', cursor: 'pointer',
                  background: 'rgba(232,121,47,0.12)', border: '1px solid rgba(232,121,47,0.35)',
                  color: '#E8792F', fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap',
                }}
              >+ Agregar Tarea</button>
            )}
          </div>
        </div>

        {/* Add task input row */}
        {canAddTasks && addingTask && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px', padding: '12px', borderRadius: '8px', background: 'rgba(232,121,47,0.06)', border: '1px solid rgba(232,121,47,0.2)' }}>
            <input
              autoFocus
              type="text"
              value={newTaskTitle}
              onChange={e => setNewTaskTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addTask(); if (e.key === 'Escape') setAddingTask(false) }}
              placeholder="Nombre de la nueva tarea..."
              style={{
                width: '100%', boxSizing: 'border-box',
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '8px', padding: '8px 12px', fontSize: '13px', color: '#f1f5f9', outline: 'none',
              }}
            />
            <div style={{ display: 'flex', gap: '8px' }}>
              <select
                value={newTaskAssignee}
                onChange={e => setNewTaskAssignee(e.target.value)}
                style={{
                  flex: 1, background: '#fff', border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '8px', padding: '7px 12px', fontSize: '13px', color: '#111827', outline: 'none',
                }}
              >
                <option value="">— Asignar a... —</option>
                {TEAM.map(name => <option key={name} value={name} style={{ color: '#111827' }}>{name}</option>)}
              </select>
              <button onClick={addTask} disabled={savingTask || !newTaskTitle.trim()} style={{ padding: '8px 16px', borderRadius: '8px', background: '#E8792F', border: 'none', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
                {savingTask ? '...' : '✓ Agregar'}
              </button>
              <button onClick={() => { setAddingTask(false); setNewTaskTitle(''); setNewTaskAssignee('') }} style={{ padding: '8px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.06)', border: 'none', color: '#64748b', fontSize: '13px', cursor: 'pointer', flexShrink: 0 }}>
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Task list — grouped by category */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {tasks.length === 0 && (
            <div style={{ textAlign: 'center', padding: '32px', color: '#334155', fontSize: '13px' }}>
              Sin tareas. Completa el onboarding para generarlas.
            </div>
          )}
          {filteredTasks.map((task, idx) => {
            const prevTask = filteredTasks[idx - 1]
            const showCategoryHeader = multiCat && task.category && task.category !== prevTask?.category
            const status = (task.status || 'pendiente') as Task['status']
            const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pendiente

            return (
              <div key={task.id}>
                {showCategoryHeader && (
                  <div style={{
                    fontSize: '11px', fontWeight: 700, color: '#E8792F',
                    textTransform: 'uppercase', letterSpacing: '0.06em',
                    padding: '14px 4px 6px', marginTop: idx > 0 ? '4px' : 0,
                    borderTop: idx > 0 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                  }}>
                    {task.category === 'Agente de Voz' ? '🎙 Agente de Voz' : '💬 WhatsApp / Texto'}
                  </div>
                )}
                <div
                  style={{
                    padding: '10px 14px', borderRadius: '8px',
                    background: task.completed ? 'rgba(34,197,94,0.04)' : 'rgba(17,24,39,0.8)',
                    border: `1px solid ${task.completed ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.07)'}`,
                    transition: 'border-color 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(232,121,47,0.3)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = task.completed ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.07)')}
                >
                  {/* Single row: number · title · assignee pill · status · arrow */}
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    {/* Step number */}
                    <div
                      onClick={() => setSelectedTask(task)}
                      style={{
                        width: '22px', height: '22px', borderRadius: '50%', flexShrink: 0, cursor: 'pointer',
                        background: task.completed ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.06)',
                        border: `1px solid ${task.completed ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.12)'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '10px', fontWeight: 700,
                        color: task.completed ? '#22c55e' : '#475569',
                      }}
                    >
                      {task.completed ? '✓' : idx + 1}
                    </div>

                    {/* Title — clickable */}
                    <span
                      onClick={() => setSelectedTask(task)}
                      style={{ flex: 1, fontSize: '13px', color: task.completed ? '#475569' : '#e2e8f0', textDecoration: task.completed ? 'line-through' : 'none', lineHeight: 1.4, cursor: 'pointer' }}
                    >
                      {task.title}
                    </span>

                    {/* Assignee inline select — not clickable to open drawer */}
                    <select
                      value={task.assignee || ''}
                      onClick={e => e.stopPropagation()}
                      onChange={async e => {
                        e.stopPropagation()
                        const newAssignee = e.target.value || null
                        await fetch(`/api/projects/${projectId}/tasks`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ taskId: task.id, assignee: newAssignee }),
                        })
                        handleAssigneeChange(task.id, newAssignee)
                      }}
                      style={{
                        flexShrink: 0, maxWidth: '130px',
                        background: task.assignee ? 'rgba(232,121,47,0.08)' : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${task.assignee ? 'rgba(232,121,47,0.25)' : 'rgba(255,255,255,0.10)'}`,
                        borderRadius: '6px', color: task.assignee ? '#E8792F' : '#475569',
                        fontSize: '11px', fontWeight: 600, cursor: 'pointer', outline: 'none',
                        padding: '3px 7px',
                      }}
                    >
                      <option value="" style={{ background: '#1e293b', color: '#94a3b8', fontWeight: 400 }}>👤 Asignar</option>
                      {TEAM.map(n => (
                        <option key={n} value={n} style={{ background: '#1e293b', color: '#f1f5f9', fontWeight: 400 }}>{n}</option>
                      ))}
                    </select>

                    {/* Status badge */}
                    <span
                      onClick={() => setSelectedTask(task)}
                      style={{ fontSize: '10px', padding: '3px 8px', borderRadius: '20px', background: cfg.bg, color: cfg.color, fontWeight: 600, border: `1px solid ${cfg.dot}44`, flexShrink: 0, cursor: 'pointer' }}
                    >
                      {cfg.label}
                    </span>

                    <span onClick={() => setSelectedTask(task)} style={{ color: '#334155', fontSize: '12px', flexShrink: 0, cursor: 'pointer' }}>›</span>
                  </div>
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
          onAssigneeChange={handleAssigneeChange}
        />
      )}
    </>
  )
}
