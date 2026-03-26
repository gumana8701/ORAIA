'use client'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const DOCS = [
  { key: 'doc_expediente',    label: 'Expediente',        icon: '📁', isUrl: true  },
  { key: 'doc_flujograma',    label: 'Flujograma',        icon: '🔀', isUrl: true  },
  { key: 'doc_cableado',      label: 'Cableado',          icon: '🔌', isUrl: true  },
  { key: 'accesos_brindados', label: 'Accesos brindados', icon: '🔑', isUrl: false },
] as const

const DOCS_ROW2 = [
  { key: 'reunion_link', label: 'Link reuniones', icon: '📅', isUrl: true },
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
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <span style={{ fontSize: '10px', color: '#475569', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}>
        {icon} {label}
      </span>
      {editing ? (
        <input
          ref={ref}
          value={input}
          onChange={e => setInput(e.target.value)}
          onBlur={save}
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { setEditing(false); setInput(value) } }}
          placeholder={isUrl ? 'https://...' : 'Escribe aquí...'}
          style={{
            fontSize: '11px', color: '#e2e8f0', fontWeight: 500,
            background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(232,121,47,0.40)',
            borderRadius: '4px', padding: '2px 8px', outline: 'none', width: '200px',
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
            color: value ? (isUrl ? '#E8792F' : '#e2e8f0') : '#334155',
            transition: 'all 0.15s', whiteSpace: 'nowrap', maxWidth: '220px',
            overflow: 'hidden', textOverflow: 'ellipsis',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(232,121,47,0.35)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)' }}
          title={value || undefined}
        >
          {saving ? '⏳' : value ? (isUrl ? value.replace(/^https?:\/\//, '').slice(0, 30) + (value.length > 33 ? '…' : '') : value.slice(0, 30) + (value.length > 30 ? '…' : '')) : '—'}
          <span style={{ fontSize: '8px', opacity: 0.35, flexShrink: 0 }}>✎</span>
        </button>
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
      {/* Row 1: docs */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
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
      {/* Row 2: link reuniones */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        {DOCS_ROW2.map(d => (
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
    </div>
  )
}
