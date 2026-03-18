'use client'
import { useState, useRef, useEffect } from 'react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const SUGGESTIONS = [
  '¿Cómo está el cliente?',
  '¿Qué pasó en la última reunión?',
  '¿Hay alertas activas?',
  '¿En qué etapa estamos?',
  '¿Cuáles son los KPIs?',
]

export default function ProjectChat({ projectId, projectName }: { projectId: string; projectName: string }) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{
        role: 'assistant',
        content: `Hola 👋 Soy el PM Agent de **${projectName}**. Tengo acceso a todos los mensajes, reuniones, alertas y KPIs de este proyecto. ¿En qué puedo ayudarte?`,
      }])
    }
    if (open) setTimeout(() => inputRef.current?.focus(), 100)
  }, [open])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function send(text?: string) {
    const msg = (text || input).trim()
    if (!msg || loading) return
    setInput('')

    const userMsg: Message = { role: 'user', content: msg }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)

    try {
      const history = messages.slice(-8).map(m => ({ role: m.role, content: m.content }))
      const res = await fetch(`/api/projects/${projectId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, history }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.reply || data.error || 'Sin respuesta.',
      }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Error de conexión. Intenta de nuevo.' }])
    } finally {
      setLoading(false)
    }
  }

  function renderText(text: string) {
    // Basic markdown: **bold**, bullet points, line breaks
    return text.split('\n').map((line, i) => {
      const parts = line.split(/\*\*(.*?)\*\*/g)
      const content = parts.map((p, j) =>
        j % 2 === 1
          ? <strong key={j} style={{ color: '#f1f5f9', fontWeight: 600 }}>{p}</strong>
          : <span key={j}>{p}</span>
      )
      if (!line.trim()) return <div key={i} style={{ height: '6px' }} />
      return <div key={i} style={{ marginBottom: '2px' }}>{content}</div>
    })
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          position: 'fixed', bottom: '24px', right: '24px', zIndex: 1000,
          width: '52px', height: '52px', borderRadius: '50%',
          background: 'linear-gradient(135deg, #E8792F, #d4651f)',
          border: 'none', cursor: 'pointer',
          boxShadow: '0 4px 20px rgba(232,121,47,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '22px', transition: 'all 0.2s',
          transform: open ? 'rotate(45deg) scale(0.9)' : 'scale(1)',
        }}>
        {open ? '✕' : '🤖'}
      </button>

      {/* Chat window */}
      {open && (
        <div style={{
          position: 'fixed', bottom: '88px', right: '24px', zIndex: 999,
          width: '380px', height: '520px',
          background: '#0f172a', border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '16px', display: 'flex', flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)',
            background: 'linear-gradient(135deg, rgba(232,121,47,0.12), rgba(232,121,47,0.06))',
            display: 'flex', alignItems: 'center', gap: '10px',
          }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '50%',
              background: 'linear-gradient(135deg, #E8792F, #d4651f)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '16px', flexShrink: 0,
            }}>🤖</div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#f1f5f9' }}>PM Agent</div>
              <div style={{ fontSize: '11px', color: '#E8792F' }}>{projectName}</div>
            </div>
            <div style={{
              marginLeft: 'auto', width: '8px', height: '8px', borderRadius: '50%',
              background: '#22c55e', boxShadow: '0 0 6px #22c55e',
            }} />
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {messages.map((m, i) => (
              <div key={i} style={{
                display: 'flex',
                justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
              }}>
                <div style={{
                  maxWidth: '85%', padding: '10px 13px', borderRadius: m.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                  background: m.role === 'user'
                    ? 'linear-gradient(135deg, #E8792F, #d4651f)'
                    : 'rgba(255,255,255,0.06)',
                  border: m.role === 'user' ? 'none' : '1px solid rgba(255,255,255,0.08)',
                  fontSize: '13px', color: '#e2e8f0', lineHeight: '1.55',
                }}>
                  {renderText(m.content)}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{
                  padding: '10px 14px', borderRadius: '14px 14px 14px 4px',
                  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)',
                  display: 'flex', gap: '4px', alignItems: 'center',
                }}>
                  {[0,1,2].map(i => (
                    <div key={i} style={{
                      width: '6px', height: '6px', borderRadius: '50%',
                      background: '#E8792F', opacity: 0.7,
                      animation: `bounce 1s ease-in-out ${i * 0.15}s infinite`,
                    }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Suggestions (only when no user messages yet) */}
          {messages.length <= 1 && (
            <div style={{ padding: '0 12px 8px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {SUGGESTIONS.map(s => (
                <button key={s} onClick={() => send(s)} style={{
                  fontSize: '11px', padding: '5px 10px', borderRadius: '20px',
                  background: 'rgba(232,121,47,0.10)', border: '1px solid rgba(232,121,47,0.25)',
                  color: '#E8792F', cursor: 'pointer', fontWeight: 500,
                }}>
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div style={{
            padding: '12px', borderTop: '1px solid rgba(255,255,255,0.07)',
            display: 'flex', gap: '8px',
          }}>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
              placeholder="Pregunta sobre el proyecto..."
              style={{
                flex: 1, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '10px', padding: '9px 12px', fontSize: '13px', color: '#f1f5f9',
                outline: 'none',
              }}
            />
            <button
              onClick={() => send()}
              disabled={!input.trim() || loading}
              style={{
                width: '38px', height: '38px', borderRadius: '10px',
                background: !input.trim() || loading ? 'rgba(255,255,255,0.06)' : '#E8792F',
                border: 'none', cursor: !input.trim() || loading ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '16px', transition: 'all 0.15s',
              }}>
              ↑
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
      `}</style>
    </>
  )
}
