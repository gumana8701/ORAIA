'use client'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'

type TipoLeads = 'campaña' | 'base_de_datos' | 'ambos'

function InlineField({
  label, value, placeholder, onSave, saving,
}: {
  label: string; value: string; placeholder: string
  onSave: (v: string) => Promise<void>; saving: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [input, setInput]     = useState(value)
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => { if (editing) ref.current?.focus() }, [editing])
  useEffect(() => { setInput(value) }, [value])

  const save = () => {
    setEditing(false)
    onSave(input.trim())
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
      <span style={{ fontSize: '10px', color: '#475569', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}>{label}</span>
      {editing ? (
        <input
          ref={ref}
          value={input}
          onChange={e => setInput(e.target.value)}
          onBlur={save}
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { setEditing(false); setInput(value) } }}
          placeholder={placeholder}
          style={{
            fontSize: '11px', color: '#e2e8f0', fontWeight: 500,
            background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(232,121,47,0.40)',
            borderRadius: '4px', padding: '2px 8px', outline: 'none', width: '130px',
          }}
        />
      ) : (
        <button
          onClick={() => setEditing(true)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '4px',
            fontSize: '11px', fontWeight: value ? 600 : 400,
            padding: '2px 8px', borderRadius: '4px', cursor: 'pointer',
            border: '1px solid rgba(255,255,255,0.07)',
            background: value ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.02)',
            color: value ? '#e2e8f0' : '#334155',
            transition: 'all 0.15s', whiteSpace: 'nowrap',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(232,121,47,0.35)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)' }}
        >
          {saving ? '⏳' : value || placeholder}
          <span style={{ fontSize: '8px', opacity: 0.35 }}>✎</span>
        </button>
      )}
    </div>
  )
}

const TIPO_OPTIONS: { value: TipoLeads; label: string; color: string; bg: string; border: string }[] = [
  { value: 'campaña',       label: '📣 Campaña',       color: '#60a5fa', bg: 'rgba(59,130,246,0.10)',  border: 'rgba(59,130,246,0.20)' },
  { value: 'base_de_datos', label: '🗃 Base de datos', color: '#4ade80', bg: 'rgba(34,197,94,0.10)',   border: 'rgba(34,197,94,0.20)' },
  { value: 'ambos',         label: '📣🗃 Ambos',        color: '#E8792F', bg: 'rgba(232,121,47,0.10)',  border: 'rgba(232,121,47,0.20)' },
]

export default function ProjectMetaEditor({
  projectId,
  initialNicho,
  initialTipoLeads,
  initialTwilioCuenta,
  initialTwilioBundle,
  initialTwilioNumero,
  initialTwilioSaldo,
  initialTipoIntegracion,
}: {
  projectId: string
  initialNicho?: string | null
  initialTipoLeads?: TipoLeads | null
  initialTwilioCuenta?: string | null
  initialTwilioBundle?: string | null
  initialTwilioNumero?: string | null
  initialTwilioSaldo?: string | null
  initialTipoIntegracion?: 'chatbot' | 'app_level' | null
}) {
  const router = useRouter()
  const [nicho, setNicho]           = useState(initialNicho ?? '')
  const [tipoLeads, setTipoLeads]   = useState<TipoLeads | null>(initialTipoLeads ?? null)
  const [twilioCuenta, setTwilioCuenta] = useState(initialTwilioCuenta ?? '')
  const [twilioBundle, setTwilioBundle] = useState(initialTwilioBundle ?? '')
  const [twilioNumero, setTwilioNumero] = useState(initialTwilioNumero ?? '')
  const [twilioSaldo,  setTwilioSaldo]  = useState(initialTwilioSaldo ?? '')
  const [tipoIntegracion, setTipoIntegracion] = useState<'chatbot' | 'app_level' | null>(initialTipoIntegracion ?? null)
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

  const saveTipoIntegracion = async (val: 'chatbot' | 'app_level') => {
    const next = tipoIntegracion === val ? null : val
    setTipoIntegracion(next)
    await patch({ tipo_integracion: next })
  }

  const saveTwilio = async (field: string, val: string) => {
    const setters: Record<string, (v: string) => void> = {
      twilio_cuenta: setTwilioCuenta,
      twilio_bundle: setTwilioBundle,
      twilio_numero: setTwilioNumero,
      twilio_saldo:  setTwilioSaldo,
    }
    setters[field]?.(val)
    await patch({ [field]: val || null })
  }

  return (
    <div style={{ display: 'flex', gap: '24px', marginTop: '10px', flexWrap: 'wrap', alignItems: 'flex-start' }}>

      {/* Left: Nicho + Tipo de leads */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>

        {/* Nicho */}
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
                borderRadius: '5px', padding: '3px 10px', outline: 'none', width: '180px',
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
                color: nicho ? '#94a3b8' : '#334155', transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(232,121,47,0.35)'; e.currentTarget.style.color = '#94a3b8' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)'; e.currentTarget.style.color = nicho ? '#94a3b8' : '#334155' }}
            >
              {saving ? '⏳' : nicho || '+ Agregar nicho'}
              <span style={{ fontSize: '9px', opacity: 0.4 }}>✎</span>
            </button>
          )}
        </div>

        {/* Tipo de leads */}
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

      {/* Divider */}
      <div style={{ width: '1px', background: 'rgba(255,255,255,0.06)', alignSelf: 'stretch', minHeight: '40px' }} />

      {/* Right: Twilio */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <span style={{ fontSize: '11px', color: '#E8792F', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>
          📞 Twilio
        </span>
        <InlineField label="Cuenta"  value={twilioCuenta} placeholder="+ cuenta"  onSave={v => saveTwilio('twilio_cuenta', v)} saving={saving} />
        <InlineField label="Bundle"  value={twilioBundle} placeholder="+ bundle"  onSave={v => saveTwilio('twilio_bundle', v)} saving={saving} />
        <InlineField label="Número"  value={twilioNumero} placeholder="+ número"  onSave={v => saveTwilio('twilio_numero', v)} saving={saving} />
        <InlineField label="Saldo"   value={twilioSaldo}  placeholder="+ saldo"   onSave={v => saveTwilio('twilio_saldo',  v)} saving={saving} />
      </div>

      {/* Divider */}
      <div style={{ width: '1px', background: 'rgba(255,255,255,0.06)', alignSelf: 'stretch', minHeight: '40px' }} />

      {/* Tipo de integración */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>
          Integración
        </span>
        <div style={{ display: 'flex', gap: '6px' }}>
          {([
            { value: 'chatbot'  as const, label: '🤖 Chatbot',   color: '#a78bfa', bg: 'rgba(167,139,250,0.10)', border: 'rgba(167,139,250,0.25)' },
            { value: 'app_level' as const, label: '⚡ App Level', color: '#38bdf8', bg: 'rgba(56,189,248,0.10)',  border: 'rgba(56,189,248,0.25)' },
          ] as const).map(opt => {
            const isActive = tipoIntegracion === opt.value
            return (
              <button
                key={opt.value}
                onClick={() => saveTipoIntegracion(opt.value)}
                style={{
                  fontSize: '11px', fontWeight: 700, padding: '4px 12px',
                  borderRadius: '6px', cursor: 'pointer', transition: 'all 0.15s',
                  background: isActive ? opt.bg : 'rgba(255,255,255,0.03)',
                  color: isActive ? opt.color : '#475569',
                  border: `1px solid ${isActive ? opt.border : 'rgba(255,255,255,0.07)'}`,
                  boxShadow: isActive ? `0 0 10px ${opt.bg}` : 'none',
                }}
                onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = opt.bg; e.currentTarget.style.color = opt.color; e.currentTarget.style.borderColor = opt.border } }}
                onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.color = '#475569'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)' } }}
              >
                {saving ? '⏳' : opt.label}
              </button>
            )
          })}
        </div>
      </div>

    </div>
  )
}
