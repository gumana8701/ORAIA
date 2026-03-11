'use client'
import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'

interface KPI {
  id: string
  kpi_text: string
  categoria: string
  meta: string | null
  confirmado: boolean
}

interface Props {
  projectId: string
  initialKpis: KPI[]
}

const CATEGORIAS = [
  { value: 'general',      label: 'General',      color: '#a78bfa' },
  { value: 'ventas',       label: 'Ventas',        color: '#4ade80' },
  { value: 'satisfaccion', label: 'Satisfacción',  color: '#60a5fa' },
  { value: 'tiempo',       label: 'Tiempo',        color: '#f59e0b' },
  { value: 'crecimiento',  label: 'Crecimiento',   color: '#f97316' },
  { value: 'retencion',    label: 'Retención',     color: '#34d399' },
]

const catColor = (cat: string) => CATEGORIAS.find(c => c.value === cat)?.color ?? '#a78bfa'

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export default function ProjectKPIsEditor({ projectId, initialKpis }: Props) {
  const [kpis, setKpis] = useState<KPI[]>(initialKpis)
  const [adding, setAdding] = useState(false)
  const [newText, setNewText] = useState('')
  const [newMeta, setNewMeta] = useState('')
  const [newCat, setNewCat] = useState('general')
  const [saving, setSaving] = useState(false)

  async function addKpi() {
    if (!newText.trim()) return
    setSaving(true)
    const { data, error } = await sb()
      .from('project_kpis')
      .insert({ project_id: projectId, kpi_text: newText.trim(), meta: newMeta.trim() || null, categoria: newCat, confirmado: false })
      .select()
      .single()
    if (!error && data) {
      setKpis(prev => [...prev, data as KPI])
      setNewText(''); setNewMeta(''); setNewCat('general'); setAdding(false)
    }
    setSaving(false)
  }

  async function toggleConfirmado(kpi: KPI) {
    const { error } = await sb()
      .from('project_kpis')
      .update({ confirmado: !kpi.confirmado })
      .eq('id', kpi.id)
    if (!error) setKpis(prev => prev.map(k => k.id === kpi.id ? { ...k, confirmado: !k.confirmado } : k))
  }

  async function deleteKpi(id: string) {
    const { error } = await sb().from('project_kpis').delete().eq('id', id)
    if (!error) setKpis(prev => prev.filter(k => k.id !== id))
  }

  const confirmed = kpis.filter(k => k.confirmado).length

  return (
    <div style={{ maxWidth: '680px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div>
          <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#fff', margin: '0 0 2px' }}>
            🎯 KPIs de Éxito
          </h2>
          <p style={{ fontSize: '12px', color: '#4a5568', margin: 0 }}>
            {kpis.length === 0
              ? 'Agrega los indicadores clave que definen el éxito de este proyecto'
              : `${confirmed}/${kpis.length} confirmados`}
          </p>
        </div>
        <button
          onClick={() => setAdding(true)}
          style={{
            padding: '7px 14px', borderRadius: '8px', border: '1px solid rgba(232,121,47,0.3)',
            background: 'rgba(232,121,47,0.1)', color: '#E8792F', fontSize: '12px',
            fontWeight: 700, cursor: 'pointer',
          }}
        >
          + Agregar KPI
        </button>
      </div>

      {/* Add form */}
      {adding && (
        <div style={{
          background: 'rgba(17,24,39,0.85)', border: '1px solid rgba(232,121,47,0.2)',
          borderRadius: '10px', padding: '16px', marginBottom: '16px',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <input
              autoFocus
              placeholder="Ej: Reducir tiempo de respuesta a clientes en 50%"
              value={newText}
              onChange={e => setNewText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addKpi()}
              style={{
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '6px', padding: '8px 12px', color: '#fff', fontSize: '13px', outline: 'none',
              }}
            />
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <input
                placeholder="Meta (opcional) — ej: 48h"
                value={newMeta}
                onChange={e => setNewMeta(e.target.value)}
                style={{
                  flex: 1, minWidth: '120px', background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px',
                  padding: '7px 10px', color: '#fff', fontSize: '12px', outline: 'none',
                }}
              />
              <select
                value={newCat}
                onChange={e => setNewCat(e.target.value)}
                style={{
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '6px', padding: '7px 10px', color: '#fff', fontSize: '12px', outline: 'none', cursor: 'pointer',
                }}
              >
                {CATEGORIAS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={addKpi}
                disabled={saving || !newText.trim()}
                style={{
                  padding: '7px 16px', borderRadius: '6px', border: 'none',
                  background: newText.trim() ? '#E8792F' : 'rgba(255,255,255,0.05)',
                  color: newText.trim() ? '#fff' : '#4a5568', fontSize: '12px',
                  fontWeight: 700, cursor: newText.trim() ? 'pointer' : 'default',
                }}
              >
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
              <button
                onClick={() => { setAdding(false); setNewText(''); setNewMeta(''); setNewCat('general') }}
                style={{
                  padding: '7px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.08)',
                  background: 'none', color: '#64748b', fontSize: '12px', cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* KPI list */}
      {kpis.length === 0 && !adding ? (
        <div style={{
          textAlign: 'center', padding: '48px 24px',
          background: 'rgba(17,24,39,0.6)', border: '1px dashed rgba(255,255,255,0.08)',
          borderRadius: '12px', color: '#4a5568',
        }}>
          <div style={{ fontSize: '28px', marginBottom: '8px' }}>🎯</div>
          <p style={{ margin: '0 0 12px', fontSize: '14px', color: '#64748b' }}>
            Sin KPIs definidos aún
          </p>
          <button
            onClick={() => setAdding(true)}
            style={{
              padding: '8px 16px', borderRadius: '8px', border: '1px solid rgba(232,121,47,0.3)',
              background: 'rgba(232,121,47,0.1)', color: '#E8792F', fontSize: '12px',
              fontWeight: 700, cursor: 'pointer',
            }}
          >
            + Agregar primer KPI
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {kpis.map(kpi => {
            const color = catColor(kpi.categoria)
            const cat = CATEGORIAS.find(c => c.value === kpi.categoria)
            return (
              <div key={kpi.id} style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '10px 14px', borderRadius: '8px',
                background: kpi.confirmado ? `${color}08` : 'rgba(17,24,39,0.6)',
                border: `1px solid ${kpi.confirmado ? `${color}25` : 'rgba(255,255,255,0.06)'}`,
                borderLeft: `3px solid ${kpi.confirmado ? color : 'rgba(255,255,255,0.1)'}`,
                opacity: kpi.confirmado ? 1 : 0.85,
              }}>
                {/* Checkbox */}
                <button
                  onClick={() => toggleConfirmado(kpi)}
                  title={kpi.confirmado ? 'Marcar pendiente' : 'Marcar confirmado'}
                  style={{
                    width: '18px', height: '18px', borderRadius: '4px', flexShrink: 0,
                    border: `2px solid ${kpi.confirmado ? color : 'rgba(255,255,255,0.2)'}`,
                    background: kpi.confirmado ? `${color}20` : 'none',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px',
                  }}
                >
                  {kpi.confirmado ? <span style={{ color }}>✓</span> : ''}
                </button>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    fontSize: '13px', color: kpi.confirmado ? '#e2e8f0' : '#94a3b8',
                    margin: 0, lineHeight: 1.4,
                    textDecoration: kpi.confirmado ? 'none' : 'none',
                  }}>
                    {kpi.kpi_text}
                  </p>
                  <div style={{ display: 'flex', gap: '6px', marginTop: '3px', alignItems: 'center' }}>
                    <span style={{
                      fontSize: '10px', padding: '1px 5px', borderRadius: '3px',
                      background: `${color}15`, color, fontWeight: 600,
                    }}>
                      {cat?.label ?? kpi.categoria}
                    </span>
                    {kpi.meta && (
                      <span style={{ fontSize: '11px', color, fontWeight: 600 }}>→ {kpi.meta}</span>
                    )}
                  </div>
                </div>

                {/* Delete */}
                <button
                  onClick={() => deleteKpi(kpi.id)}
                  title="Eliminar"
                  style={{
                    background: 'none', border: 'none', color: '#374151', fontSize: '14px',
                    cursor: 'pointer', padding: '2px 4px', flexShrink: 0,
                    lineHeight: 1,
                  }}
                >
                  ×
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
