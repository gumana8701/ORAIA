'use client'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const DOCS = [
  { key: 'doc_expediente',   label: 'Expediente',        icon: '📁', isUrl: true  },
  { key: 'doc_flujograma',   label: 'Flujograma',        icon: '🔀', isUrl: true  },
  { key: 'doc_cableado',     label: 'Cableado',          icon: '🔌', isUrl: true  },
  { key: 'accesos_brindados',label: 'Accesos brindados', icon: '🔑', isUrl: false },
] as const

type DocKey = typeof DOCS[number]['key']

function DocRow({
  docKey, label, icon, isUrl, value, projectId, onSaved,
}: {
  docKey: string; label: string; icon: string; isUrl: boolean
  value: string; projectId: string; onSaved: (key: string, val: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [input, setInput]     = useState(value)
  const [saving, setSaving]   = useState(false)
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => { if (editing) ref.current?.focus() }, [editing])
  useEffect(() => { setInput(value) }, [value])

  const save = async () => {
    setEditing(false)
    const val = input.trim()
    if (val === value) return
    setSaving(true)
    try {
      await fetch(`/api/projects/${projectId}/meta`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [docKey]: val || null }),
      })
      onSaved(docKey, val)
    } finally { setSaving(false) }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <span style={{ fontSize: '13px', flexShrink: 0 }}>{icon}</span>
      <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, width: '130px', flexShrink: 0 }}>{label}</span>

      {editing ? (
        <input
          ref={ref}
          value={input}
          onChange={e => setInput(e.target.value)}
          onBlur={save}
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { setEditing(false); setInput(value) } }}
          placeholder={isUrl ? 'https://...' : 'Escribe aquí...'}
          style={{
            flex: 1, fontSize: '11px', color: '#e2e8f0', fontWeight: 500,
            background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(232,121,47,0.40)',
            borderRadius: '5px', padding: '3px 10px', outline: 'none',
          }}
        />
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          {value && isUrl ? (
            <a
              href={value}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              style={{
                fontSize: '11px', color: '#E8792F', fontWeight: 500,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                textDecoration: 'none', flex: 1,
              }}
            >
              {value.replace(/^https?:\/\//, '').slice(0, 50)}{value.length > 53 ? '…' : ''}
            </a>
          ) : value ? (
            <span style={{
              fontSize: '11px', color: '#94a3b8',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
            }}>
              {value}
            </span>
          ) : (
            <span style={{ fontSize: '11px', color: '#1e293b' }}>—</span>
          )}
          <button
            onClick={() => setEditing(true)}
            style={{
              fontSize: '10px', color: '#334155', background: 'transparent',
              border: '1px solid rgba(255,255,255,0.06)', borderRadius: '4px',
              padding: '1px 6px', cursor: 'pointer', flexShrink: 0,
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(232,121,47,0.35)'; e.currentTarget.style.color = '#E8792F' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#334155' }}
          >
            {saving ? '⏳' : '✎'}
          </button>
        </div>
      )}
    </div>
  )
}

export default function ProjectDocs({
  projectId,
  initialDocs,
}: {
  projectId: string
  initialDocs: Partial<Record<DocKey, string>>
}) {
  const router = useRouter()
  const [docs, setDocs] = useState<Partial<Record<DocKey, string>>>(initialDocs)

  const handleSaved = (key: string, val: string) => {
    setDocs(prev => ({ ...prev, [key]: val }))
    router.refresh()
  }

  return (
    <div style={{
      background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: '10px', padding: '14px 16px', marginTop: '16px',
    }}>
      <p style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 10px' }}>
        📎 Documentos & Accesos
      </p>
      {DOCS.map(d => (
        <DocRow
          key={d.key}
          docKey={d.key}
          label={d.label}
          icon={d.icon}
          isUrl={d.isUrl}
          value={docs[d.key] ?? ''}
          projectId={projectId}
          onSaved={handleSaved}
        />
      ))}
    </div>
  )
}
