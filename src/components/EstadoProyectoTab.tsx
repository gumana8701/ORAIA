'use client'
import { useState, useEffect, useCallback } from 'react'

interface EstadoMeta {
  pct: number
  total: number
  completadas: number
  bloqueadas: number
  enProgreso: number
  pendientes: number
  alertas: number
}

interface Alerta {
  tipo: string
  nivel: string
  descripcion: string
  created_at: string
}

const nivelColor: Record<string, string> = {
  critico: '#ef4444',
  alto:    '#f97316',
  medio:   '#f59e0b',
  bajo:    '#6b7280',
}

const tipoIcon: Record<string, string> = {
  cancelacion: '🚪', reembolso: '💸', enojo: '😡', pago: '💳',
  entrega: '📦', urgente: '⚡', silencio: '🔇', otro: '⚠️',
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(mins / 60)
  const days = Math.floor(hours / 24)
  if (days > 0) return `hace ${days}d`
  if (hours > 0) return `hace ${hours}h`
  if (mins > 0) return `hace ${mins}m`
  return 'ahora'
}

// Renders markdown-lite: **bold**, bullet lists, line breaks
function MarkdownText({ text }: { text: string }) {
  const lines = text.split('\n')
  return (
    <div style={{ lineHeight: 1.7, fontSize: '14px', color: '#cbd5e0' }}>
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} style={{ height: '10px' }} />

        // Bullet
        if (line.trim().startsWith('- ') || line.trim().startsWith('• ')) {
          const content = line.replace(/^[\s\-•]+/, '')
          return (
            <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '4px' }}>
              <span style={{ color: '#E8792F', flexShrink: 0, marginTop: '2px' }}>▸</span>
              <span>{renderBold(content)}</span>
            </div>
          )
        }

        // Heading-like (starts with **)
        if (line.trim().startsWith('**') && line.trim().endsWith('**')) {
          const content = line.replace(/\*\*/g, '').trim()
          return (
            <div key={i} style={{ fontSize: '13px', fontWeight: 700, color: '#E8792F', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '18px', marginBottom: '6px' }}>
              {content}
            </div>
          )
        }

        return <p key={i} style={{ margin: '0 0 8px' }}>{renderBold(line)}</p>
      })}
    </div>
  )
}

function renderBold(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} style={{ color: '#f1f5f9', fontWeight: 700 }}>{part.slice(2, -2)}</strong>
    }
    return part
  })
}

export default function EstadoProyectoTab({ projectId }: { projectId: string }) {
  const [estado, setEstado]       = useState<string | null>(null)
  const [meta, setMeta]           = useState<EstadoMeta | null>(null)
  const [alertas, setAlertas]     = useState<Alerta[]>([])
  const [loading, setLoading]     = useState(true)
  const [generatedAt, setAt]      = useState<string | null>(null)
  const [regenerating, setRegen]  = useState(false)
  const [error, setError]         = useState<string | null>(null)

  const fetchEstado = useCallback(async () => {
    setError(null)
    try {
      const res = await fetch(`/api/projects/${projectId}/estado`)
      const data = await res.json()
      if (data.error) { setError(data.error); return }
      setEstado(data.estado)
      setMeta(data.meta)
      setAlertas(data.alertas || [])
      setAt(data.generatedAt)
    } catch {
      setError('Error cargando el estado del proyecto.')
    }
  }, [projectId])

  useEffect(() => {
    setLoading(true)
    fetchEstado().finally(() => setLoading(false))
  }, [fetchEstado])

  async function regenerate() {
    setRegen(true)
    await fetchEstado()
    setRegen(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* ── Stat bar ── */}
      {meta && (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px',
        }}>
          {[
            { label: 'Avance',      value: `${meta.pct}%`,        color: meta.pct === 100 ? '#22c55e' : '#E8792F' },
            { label: 'Completadas', value: meta.completadas,       color: '#22c55e' },
            { label: 'En progreso', value: meta.enProgreso,        color: '#3b82f6' },
            { label: 'Pendientes',  value: meta.pendientes,        color: '#64748b' },
            { label: 'Bloqueadas',  value: meta.bloqueadas,        color: meta.bloqueadas > 0 ? '#ef4444' : '#22c55e' },
          ].map(s => (
            <div key={s.label} style={{
              background: 'rgba(17,24,39,0.8)', border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: '10px', padding: '12px 14px', textAlign: 'center',
            }}>
              <div style={{ fontSize: '22px', fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '2px' }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── AI Analysis card ── */}
      <div style={{
        background: 'rgba(17,24,39,0.85)', border: '1px solid rgba(255,255,255,0.09)',
        borderLeft: '3px solid #E8792F', borderRadius: '12px', padding: '24px',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Halo */}
        <div style={{ position: 'absolute', top: 0, right: 0, width: '200px', height: '200px', background: 'radial-gradient(circle, rgba(232,121,47,0.06) 0%, transparent 70%)', borderRadius: '50%', filter: 'blur(40px)', pointerEvents: 'none' }} />

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#E8792F', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>
              🤖 Análisis IA — Gemini
            </div>
            {generatedAt && (
              <div style={{ fontSize: '11px', color: '#475569' }}>
                Generado {timeAgo(generatedAt)}
              </div>
            )}
          </div>
          <button
            onClick={regenerate}
            disabled={regenerating || loading}
            style={{
              padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 700,
              background: 'rgba(232,121,47,0.12)', border: '1px solid rgba(232,121,47,0.3)',
              color: '#E8792F', cursor: 'pointer',
              opacity: regenerating ? 0.6 : 1,
            }}
          >
            {regenerating ? '⏳ Actualizando...' : '↻ Actualizar'}
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '32px', color: '#475569' }}>
            <div style={{ fontSize: '24px', marginBottom: '12px' }}>🤖</div>
            <div style={{ fontSize: '13px' }}>Gemini está analizando el proyecto...</div>
          </div>
        ) : error ? (
          <div style={{ padding: '20px', borderRadius: '8px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', fontSize: '13px' }}>
            ⚠️ {error}
          </div>
        ) : estado ? (
          <MarkdownText text={estado} />
        ) : null}
      </div>

      {/* ── Alertas ── */}
      <div>
        <div style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
          ⚠️ Alertas activas {alertas.length > 0 ? `(${alertas.length})` : ''}
        </div>
        {alertas.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '24px',
            background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.15)',
            borderRadius: '10px', color: '#22c55e', fontSize: '13px', fontWeight: 600,
          }}>
            ✅ Sin alertas activas
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {alertas.map((a, i) => (
              <div key={i} style={{
                background: 'rgba(17,24,39,0.85)',
                border: `1px solid ${nivelColor[a.nivel] || '#6b7280'}30`,
                borderLeft: `3px solid ${nivelColor[a.nivel] || '#6b7280'}`,
                borderRadius: '8px', padding: '12px 16px',
                display: 'flex', gap: '12px', alignItems: 'flex-start',
              }}>
                <span style={{ fontSize: '18px', flexShrink: 0 }}>{tipoIcon[a.tipo] ?? '⚠️'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px', flexWrap: 'wrap' }}>
                    <span style={{
                      fontSize: '10px', padding: '1px 6px', borderRadius: '4px',
                      background: `${nivelColor[a.nivel] || '#6b7280'}20`,
                      color: nivelColor[a.nivel] || '#6b7280',
                      fontWeight: 700, textTransform: 'uppercase',
                    }}>{a.nivel}</span>
                    <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'capitalize' }}>{a.tipo}</span>
                    <span style={{ fontSize: '11px', color: '#334155', marginLeft: 'auto' }}>{timeAgo(a.created_at)}</span>
                  </div>
                  <p style={{ fontSize: '13px', color: '#cbd5e0', margin: 0, lineHeight: 1.5 }}>{a.descripcion}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
