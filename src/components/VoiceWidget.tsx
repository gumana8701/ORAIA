'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useConversation } from '@11labs/react'

const AGENT_ID = 'agent_3701kk4s3g38f2rspd33affqa1b4'

type ConvStatus = 'idle' | 'connecting' | 'connected' | 'error'

interface TranscriptEntry {
  id: number
  source: 'user' | 'ai'
  text: string
  ts: Date
}

interface ProjectContext {
  resumen: {
    total: number
    activos: number
    en_riesgo: number
    pausados: number
    completados: number
    alertas_abiertas: number
  }
  proyectos_en_riesgo: Array<{ nombre: string; alertas: number; ultimo_mensaje: string | null; desarrollador: string }>
  proyectos_activos: Array<{ nombre: string; mensajes: number; ultimo_mensaje: string | null; desarrollador: string }>
  alertas_urgentes: Array<{ tipo: string; nivel: string; descripcion: string }>
}

function formatContext(ctx: ProjectContext): string {
  const { resumen, proyectos_en_riesgo, proyectos_activos, alertas_urgentes } = ctx
  const lines: string[] = [
    `RESUMEN: ${resumen.total} proyectos total — ${resumen.activos} activos, ${resumen.en_riesgo} en riesgo, ${resumen.pausados} pausados, ${resumen.completados} completados. ${resumen.alertas_abiertas} alertas abiertas.`,
  ]
  if (proyectos_en_riesgo.length > 0) {
    lines.push(`\nPROYECTOS EN RIESGO (${proyectos_en_riesgo.length}):`)
    for (const p of proyectos_en_riesgo) {
      lines.push(`  - ${p.nombre}: ${p.alertas} alerta(s), último mensaje ${p.ultimo_mensaje ?? 'desconocido'}, dev: ${p.desarrollador}`)
    }
  }
  if (proyectos_activos.length > 0) {
    lines.push(`\nPROYECTOS ACTIVOS (muestra):`)
    for (const p of proyectos_activos.slice(0, 8)) {
      lines.push(`  - ${p.nombre}: ${p.mensajes} mensajes, último ${p.ultimo_mensaje ?? '—'}, dev: ${p.desarrollador}`)
    }
  }
  if (alertas_urgentes.length > 0) {
    lines.push(`\nALERTAS CRÍTICAS/ALTAS:`)
    for (const a of alertas_urgentes.slice(0, 5)) {
      lines.push(`  - [${a.nivel.toUpperCase()}] ${a.tipo}: ${a.descripcion}`)
    }
  }
  return lines.join('\n')
}

let transcriptIdCounter = 0

export default function VoiceWidget() {
  const [open, setOpen]               = useState(false)
  const [status, setStatus]           = useState<ConvStatus>('idle')
  const [context, setContext]         = useState<ProjectContext | null>(null)
  const [contextLoading, setContextLoading] = useState(false)
  const [isMuted, setIsMuted]         = useState(false)
  const [agentTalking, setAgentTalking] = useState(false)
  const [transcript, setTranscript]   = useState<TranscriptEntry[]>([])
  const transcriptEndRef              = useRef<HTMLDivElement>(null)

  const addEntry = useCallback((source: 'user' | 'ai', text: string) => {
    if (!text?.trim()) return
    setTranscript(prev => [...prev, {
      id: ++transcriptIdCounter,
      source,
      text: text.trim(),
      ts: new Date(),
    }])
  }, [])

  const conversation = useConversation({
    onConnect:    () => setStatus('connected'),
    onDisconnect: () => { setStatus('idle'); setAgentTalking(false) },
    onError:      (err: any) => { console.error('Voice error:', err); setStatus('error') },
    onMessage:    (msg: any) => {
      const source: 'user' | 'ai' = msg?.source === 'ai' ? 'ai' : 'user'
      setAgentTalking(source === 'ai')
      // ElevenLabs sends message text in msg.message or msg.text
      const text = msg?.message ?? msg?.text ?? ''
      if (text) addEntry(source, text)
    },
  })

  // Auto-scroll transcript to bottom
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [transcript])

  // Fetch project context when widget opens
  useEffect(() => {
    if (open && !context) {
      setContextLoading(true)
      fetch('/api/voice/projects')
        .then(r => r.json())
        .then(data => { setContext(data); setContextLoading(false) })
        .catch(() => setContextLoading(false))
    }
  }, [open, context])

  const startConversation = useCallback(async () => {
    if (!context) return
    setStatus('connecting')
    setTranscript([]) // clear transcript on new session
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true })
      await conversation.startSession({
        agentId: AGENT_ID,
        connectionType: 'webrtc' as const,
        dynamicVariables: { project_context: formatContext(context) },
      })
    } catch (err) {
      console.error('Failed to start:', err)
      setStatus('error')
    }
  }, [conversation, context])

  const stopConversation = useCallback(async () => {
    await conversation.endSession()
    setStatus('idle')
  }, [conversation])

  const toggleMute = useCallback(() => {
    conversation.setVolume({ volume: isMuted ? 1 : 0 })
    setIsMuted(m => !m)
  }, [conversation, isMuted])

  const isConnected  = status === 'connected'
  const isConnecting = status === 'connecting'

  return (
    <>
      {/* ── Floating avatar button ──────────────────────────────────────── */}
      <button
        onClick={() => setOpen(o => !o)}
        title="BOB — Asistente de voz"
        style={{
          position: 'fixed', bottom: '28px', right: '28px', zIndex: 1000,
          width: '64px', height: '64px', borderRadius: '50%',
          background: 'transparent',
          border: `2.5px solid ${isConnected ? 'rgba(232,121,47,0.8)' : 'rgba(232,121,47,0.35)'}`,
          cursor: 'pointer',
          padding: 0, overflow: 'hidden',
          boxShadow: isConnected
            ? '0 0 28px rgba(232,121,47,0.6), 0 0 56px rgba(232,121,47,0.2), 0 4px 16px rgba(0,0,0,0.5)'
            : '0 0 14px rgba(232,121,47,0.25), 0 4px 12px rgba(0,0,0,0.4)',
          transition: 'all 0.25s',
          animation: isConnected && agentTalking ? 'avatarPulse 1.2s ease-in-out infinite' : 'none',
        }}
      >
        <img
          src="/aria-avatar.png"
          alt="BOB"
          style={{
            width: '100%', height: '100%',
            objectFit: 'cover', borderRadius: '50%',
            filter: isConnected ? 'brightness(1.1)' : 'brightness(0.9)',
            display: 'block',
          }}
        />
        {isConnected && (
          <span style={{
            position: 'absolute', bottom: '2px', right: '2px',
            width: '12px', height: '12px', borderRadius: '50%',
            background: agentTalking ? '#E8792F' : '#22c55e',
            border: '2px solid #0A0F1E',
            boxShadow: agentTalking ? '0 0 8px rgba(232,121,47,0.8)' : '0 0 8px rgba(34,197,94,0.8)',
          }}/>
        )}
      </button>

      {/* ── Widget panel ────────────────────────────────────────────────── */}
      {open && (
        <div style={{
          position: 'fixed', bottom: '96px', right: '28px', zIndex: 1000,
          width: '340px',
          background: 'rgba(13,18,32,0.97)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(232,121,47,0.2)',
          borderRadius: '16px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(255,255,255,0.04)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '540px',
        }}>

          {/* Header */}
          <div style={{
            padding: '14px 16px',
            background: 'linear-gradient(135deg, rgba(232,121,47,0.12), rgba(13,18,32,0))',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            display: 'flex', alignItems: 'center', gap: '10px',
            flexShrink: 0,
          }}>
            <div style={{
              width: '38px', height: '38px', borderRadius: '50%', flexShrink: 0,
              border: `1.5px solid ${isConnected ? 'rgba(232,121,47,0.6)' : 'rgba(232,121,47,0.2)'}`,
              boxShadow: isConnected ? '0 0 12px rgba(232,121,47,0.35)' : 'none',
              overflow: 'hidden',
              animation: isConnected && agentTalking ? 'avatarPulse 1s ease-in-out infinite' : 'none',
            }}>
              <img src="/aria-avatar.png" alt="BOB" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#fff' }}>BOB</p>
              <p style={{ margin: 0, fontSize: '11px', color: '#64748b' }}>
                {isConnected
                  ? (agentTalking ? '🗣 Hablando...' : '🎧 Escuchando')
                  : isConnecting ? '⏳ Conectando...'
                  : 'Asistente de Proyectos ORA IA'}
              </p>
            </div>
            <button onClick={() => setOpen(false)} style={{
              background: 'none', border: 'none', color: '#475569',
              cursor: 'pointer', fontSize: '16px', padding: '2px 6px',
            }}>✕</button>
          </div>

          {/* ── Live Transcript ──────────────────────────────────────────── */}
          {(isConnected || transcript.length > 0) && (
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '12px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              minHeight: '120px',
              maxHeight: '260px',
              borderBottom: '1px solid rgba(255,255,255,0.05)',
            }}>
              {/* Label */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                marginBottom: '2px',
              }}>
                <div style={{
                  width: '6px', height: '6px', borderRadius: '50%',
                  background: isConnected ? '#22c55e' : '#475569',
                  boxShadow: isConnected ? '0 0 6px rgba(34,197,94,0.7)' : 'none',
                  animation: isConnected ? 'livePulse 1.5s ease-in-out infinite' : 'none',
                }}/>
                <span style={{ fontSize: '9px', color: '#475569', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  {isConnected ? 'En vivo' : 'Transcripción'}
                </span>
              </div>

              {transcript.length === 0 && isConnected && (
                <p style={{ fontSize: '11px', color: '#334155', fontStyle: 'italic', margin: 0, paddingLeft: '4px' }}>
                  Comienza a hablar…
                </p>
              )}

              {transcript.map(entry => (
                <div
                  key={entry.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: entry.source === 'user' ? 'flex-end' : 'flex-start',
                    gap: '2px',
                  }}
                >
                  <div style={{
                    maxWidth: '85%',
                    padding: '7px 10px',
                    borderRadius: entry.source === 'user' ? '10px 10px 2px 10px' : '10px 10px 10px 2px',
                    background: entry.source === 'user'
                      ? 'rgba(232,121,47,0.15)'
                      : 'rgba(255,255,255,0.06)',
                    border: `1px solid ${entry.source === 'user' ? 'rgba(232,121,47,0.25)' : 'rgba(255,255,255,0.08)'}`,
                    fontSize: '12px',
                    color: entry.source === 'user' ? '#fed7aa' : '#cbd5e1',
                    lineHeight: 1.5,
                  }}>
                    {entry.text}
                  </div>
                  <span style={{ fontSize: '9px', color: '#334155' }}>
                    {entry.source === 'user' ? 'Tú' : 'BOB'} · {entry.ts.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
              ))}
              <div ref={transcriptEndRef} />
            </div>
          )}

          {/* ── Controls ────────────────────────────────────────────────── */}
          <div style={{ padding: '14px 16px', flexShrink: 0 }}>
            {/* Context status */}
            <div style={{
              padding: '8px 11px', borderRadius: '7px',
              background: contextLoading
                ? 'rgba(245,158,11,0.06)'
                : context ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.06)',
              border: `1px solid ${contextLoading ? 'rgba(245,158,11,0.2)' : context ? 'rgba(34,197,94,0.18)' : 'rgba(239,68,68,0.2)'}`,
              marginBottom: '12px', fontSize: '11px',
            }}>
              {contextLoading ? (
                <span style={{ color: '#fbbf24' }}>⏳ Cargando datos de proyectos...</span>
              ) : context ? (
                <span style={{ color: '#4ade80' }}>
                  ✅ {context.resumen.total} proyectos · {context.resumen.en_riesgo} en riesgo · {context.resumen.alertas_abiertas} alertas
                </span>
              ) : (
                <span style={{ color: '#f87171' }}>❌ Sin datos — abre el panel primero</span>
              )}
            </div>

            {/* Action buttons */}
            {!isConnected ? (
              <button
                onClick={startConversation}
                disabled={!context || isConnecting}
                style={{
                  width: '100%', padding: '12px',
                  borderRadius: '10px', fontSize: '13px',
                  fontWeight: 700, cursor: (!context || isConnecting) ? 'not-allowed' : 'pointer',
                  border: '1px solid rgba(232,121,47,0.3)',
                  background: (!context || isConnecting)
                    ? 'rgba(232,121,47,0.05)'
                    : 'linear-gradient(135deg, rgba(232,121,47,0.15), rgba(232,121,47,0.08))',
                  color: (!context || isConnecting) ? '#475569' : '#E8792F',
                  letterSpacing: '0.04em', textTransform: 'uppercase',
                  boxShadow: context && !isConnecting ? '0 0 16px rgba(232,121,47,0.1)' : 'none',
                  transition: 'all 0.2s',
                }}
              >
                {isConnecting ? '⏳ Conectando...' : '🎙️ Iniciar Conversación'}
              </button>
            ) : (
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={toggleMute}
                  style={{
                    flex: 1, padding: '10px',
                    borderRadius: '8px', fontSize: '12px',
                    fontWeight: 600, cursor: 'pointer',
                    border: '1px solid rgba(255,255,255,0.08)',
                    background: isMuted ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.04)',
                    color: isMuted ? '#f87171' : '#94a3b8',
                  }}
                >
                  {isMuted ? '🔇 Silenciado' : '🔊 Activo'}
                </button>
                <button
                  onClick={stopConversation}
                  style={{
                    flex: 1, padding: '10px',
                    borderRadius: '8px', fontSize: '12px',
                    fontWeight: 600, cursor: 'pointer',
                    border: '1px solid rgba(239,68,68,0.25)',
                    background: 'rgba(239,68,68,0.08)',
                    color: '#f87171', letterSpacing: '0.03em',
                  }}
                >
                  ⏹ Terminar
                </button>
              </div>
            )}

            {status === 'error' && (
              <p style={{ fontSize: '11px', color: '#f87171', textAlign: 'center', marginTop: '8px' }}>
                Error de conexión. Verifica los permisos del micrófono.
              </p>
            )}

            <p style={{ fontSize: '10px', color: '#334155', textAlign: 'center', marginTop: '10px', lineHeight: 1.5 }}>
              Pregunta sobre proyectos, alertas o estado del equipo.
            </p>
          </div>
        </div>
      )}

      <style>{`
        @keyframes avatarPulse {
          0%, 100% { box-shadow: 0 0 16px rgba(232,121,47,0.4); }
          50%       { box-shadow: 0 0 36px rgba(232,121,47,0.75), 0 0 60px rgba(232,121,47,0.2); }
        }
        @keyframes livePulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.4; }
        }
      `}</style>
    </>
  )
}
