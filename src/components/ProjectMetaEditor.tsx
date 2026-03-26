'use client'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'

type TipoLeads = 'campaña' | 'base_de_datos' | 'ambos'

const TIPO_OPTIONS: { value: TipoLeads; label: string; color: string; bg: string; border: string }[] = [
  { value: 'campaña',       label: '📣 Campaña',       color: '#60a5fa', bg: 'rgba(59,130,246,0.10)',  border: 'rgba(59,130,246,0.20)' },
  { value: 'base_de_datos', label: '🗃 Base de datos', color: '#4ade80', bg: 'rgba(34,197,94,0.10)',   border: 'rgba(34,197,94,0.20)' },
  { value: 'ambos',         label: '📣🗃 Ambos',        color: '#E8792F', bg: 'rgba(232,121,47,0.10)',  border: 'rgba(232,121,47,0.20)' },
]

export default function ProjectMetaEditor({
  projectId,
  initialNicho,
  initialTipoLeads,
}: {
  projectId: string
  initialNicho?: string | null
  initialTipoLeads?: TipoLeads | null
}) {
  const router = useRouter()
  const [nicho, setNicho]           = useState(initialNicho ?? '')
  const [tipoLeads, setTipoLeads]   = useState<TipoLeads | null>(initialTipoLeads ?? null)
  const [editingNicho, setEditingNicho] = useState(false)
  const [nichoInput, setNichoInput] = useState(initialNicho ?? '')
  const [showTipoPicker, setShowTipoPicker] = useState(false)
  const [saving, setSaving]         = useState(false)
  const inputRef  = useRef<HTMLInputElement>(null)
  const pickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (editingNicho) inputRef.current?.focus()
  }, [editingNicho])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowTipoPicker(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const patch = async (fields: Record<string, any>) => {
    setSaving(true)
    try {
      await fetch(`/api/projects/${projectId}/meta`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      })
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  const saveNicho = async () => {
    setEditingNicho(false)
    const val = nichoInput.trim() || null
    setNicho(val ?? '')
    await patch({ nicho: val })
  }

  const saveTipo = async (val: TipoLeads | null) => {
    setTipoLeads(val)
    setShowTipoPicker(false)
    await patch({ tipo_leads: val })
  }

  const currentTipo = TIPO_OPTIONS.find(o => o.value === tipoLeads)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>

      {/* Nicho editor */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        {editingNicho ? (
          <input
            ref={inputRef}
            value={nichoInput}
            onChange={e => setNichoInput(e.target.value)}
            onBlur={saveNicho}
            onKeyDown={e => { if (e.key === 'Enter') saveNicho(); if (e.key === 'Escape') { setEditingNicho(false); setNichoInput(nicho) } }}
            placeholder="Escribe el nicho..."
            style={{
              fontSize: '11px', color: '#e2e8f0', fontWeight: 500,
              background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(232,121,47,0.40)',
              borderRadius: '5px', padding: '3px 10px', outline: 'none',
              width: '180px',
            }}
          />
        ) : (
          <button
            onClick={() => { setEditingNicho(true); setNichoInput(nicho) }}
            title="Editar nicho"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '5px',
              fontSize: '11px', fontWeight: 500, letterSpacing: '0.02em',
              padding: '2px 10px', borderRadius: '5px', cursor: 'pointer',
              border: '1px solid rgba(255,255,255,0.09)',
              background: nicho ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.03)',
              color: nicho ? '#94a3b8' : '#334155',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(232,121,47,0.35)'; e.currentTarget.style.color = '#94a3b8' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)'; e.currentTarget.style.color = nicho ? '#94a3b8' : '#334155' }}
          >
            {saving ? '⏳' : nicho || '+ Agregar nicho'}
            <span style={{ fontSize: '9px', opacity: 0.4 }}>✎</span>
          </button>
        )}
      </div>

      {/* Tipo de leads editor */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }} ref={pickerRef}>
        <span style={{ fontSize: '11px', color: '#475569', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Tipo de leads
        </span>
        <button
          onClick={() => setShowTipoPicker(o => !o)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '5px',
            fontSize: '11px', fontWeight: 700, padding: '2px 10px', borderRadius: '5px',
            cursor: 'pointer', transition: 'all 0.15s',
            background: currentTipo ? currentTipo.bg : 'rgba(255,255,255,0.04)',
            color: currentTipo ? currentTipo.color : '#334155',
            border: `1px solid ${currentTipo ? currentTipo.border : 'rgba(255,255,255,0.08)'}`,
          }}
        >
          {saving ? '⏳' : currentTipo ? currentTipo.label : '+ Seleccionar'}
          <span style={{ fontSize: '8px', opacity: 0.5 }}>▾</span>
        </button>

        {showTipoPicker && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 6px)', left: '80px', zIndex: 200,
            background: 'rgba(8,13,26,0.98)', backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,0.10)', borderRadius: '10px',
            overflow: 'hidden', minWidth: '170px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          }}>
            {TIPO_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => saveTipo(opt.value)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  width: '100%', padding: '9px 14px', textAlign: 'left',
                  border: 'none', cursor: 'pointer',
                  background: tipoLeads === opt.value ? opt.bg : 'transparent',
                  color: tipoLeads === opt.value ? opt.color : '#94a3b8',
                  fontSize: '12px', fontWeight: tipoLeads === opt.value ? 700 : 400,
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                onMouseLeave={e => (e.currentTarget.style.background = tipoLeads === opt.value ? opt.bg : 'transparent')}
              >
                {opt.label}
                {tipoLeads === opt.value && <span style={{ marginLeft: 'auto', fontSize: '10px', color: opt.color }}>✓</span>}
              </button>
            ))}
            {tipoLeads && (
              <button
                onClick={() => saveTipo(null)}
                style={{
                  display: 'flex', width: '100%', padding: '8px 14px', border: 'none',
                  borderTop: '1px solid rgba(255,255,255,0.05)',
                  background: 'transparent', color: '#475569', fontSize: '11px',
                  cursor: 'pointer', transition: 'background 0.1s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                ✕ Quitar
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
