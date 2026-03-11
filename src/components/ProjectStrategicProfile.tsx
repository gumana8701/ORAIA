'use client'

import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const STAGE_LABELS: Record<number, string> = {
  1: 'Tareas aisladas',
  2: 'Plataforma unificada',
  3: 'Estrategia empresarial',
  4: 'AI-enhanced',
}

const MODERNIZATION_OPTIONS = ['Rehosting', 'Replatforming', 'Refactoring', 'Combinado']

const CHALLENGE_KEYS = [
  'entorno_it_complejo',
  'disrupciones_tecnologicas',
  'falta_de_personal',
  'brechas_de_skills',
]
const CHALLENGE_LABELS: Record<string, string> = {
  entorno_it_complejo: 'Entorno IT complejo',
  disrupciones_tecnologicas: 'Disrupciones tecnológicas',
  falta_de_personal: 'Falta de personal',
  brechas_de_skills: 'Brechas de skills',
}

const OBJECTIVE_KEYS = ['eficiencia', 'agilidad', 'escalabilidad']
const OBJECTIVE_LABELS: Record<string, string> = {
  eficiencia: 'Eficiencia',
  agilidad: 'Agilidad',
  escalabilidad: 'Escalabilidad',
}

function semaforo(val: number | null | undefined): string {
  if (val === 1) return '🔴'
  if (val === 2) return '🟡'
  if (val === 3) return '🟢'
  return '⚪'
}

function cycleObjective(val: number | null | undefined): number | null {
  if (val === null || val === undefined) return 1
  if (val === 1) return 2
  if (val === 2) return 3
  return null
}

interface ProfileData {
  maturity_stage: number | null
  business_objectives: Record<string, number | null> | null
  org_challenges: Record<string, boolean> | null
  modernization_approach: string | null
}

interface Props {
  projectId: string
  initialData: ProfileData
}

function hasData(data: ProfileData): boolean {
  return !!(
    data.maturity_stage ||
    (data.business_objectives && Object.values(data.business_objectives).some(v => v !== null)) ||
    (data.org_challenges && Object.values(data.org_challenges).some(Boolean)) ||
    data.modernization_approach
  )
}

export default function ProjectStrategicProfile({ projectId, initialData }: Props) {
  const [data, setData] = useState<ProfileData>(initialData)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<ProfileData>(initialData)
  const [saving, setSaving] = useState(false)

  const profileExists = hasData(data)

  function startEdit() {
    setDraft({ ...data })
    setEditing(true)
  }

  async function handleSave() {
    setSaving(true)
    const { error } = await supabase
      .from('projects')
      .update({
        maturity_stage: draft.maturity_stage,
        business_objectives: draft.business_objectives,
        org_challenges: draft.org_challenges,
        modernization_approach: draft.modernization_approach,
      })
      .eq('id', projectId)

    if (!error) {
      setData({ ...draft })
      setEditing(false)
    } else {
      console.error('Error saving strategic profile:', error)
    }
    setSaving(false)
  }

  function setObjective(key: string, val: number | null) {
    setDraft(d => ({
      ...d,
      business_objectives: { ...(d.business_objectives ?? {}), [key]: val },
    }))
  }

  function setChallenge(key: string, val: boolean) {
    setDraft(d => ({
      ...d,
      org_challenges: { ...(d.org_challenges ?? {}), [key]: val },
    }))
  }

  const cardStyle: React.CSSProperties = {
    background: 'rgba(17,24,39,0.85)',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: '12px',
    padding: '20px',
    marginTop: '16px',
  }

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '20px',
  }

  const titleStyle: React.CSSProperties = {
    fontSize: '15px',
    fontWeight: 700,
    color: '#fff',
    margin: 0,
  }

  const btnStyle = (primary?: boolean): React.CSSProperties => ({
    padding: '6px 14px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
    border: primary ? 'none' : '1px solid rgba(232,121,47,0.4)',
    background: primary ? '#E8792F' : 'transparent',
    color: primary ? '#fff' : '#E8792F',
    transition: 'opacity 0.15s',
  })

  const sectionLabelStyle: React.CSSProperties = {
    fontSize: '10px',
    fontWeight: 700,
    color: '#4a5568',
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    marginBottom: '10px',
  }

  // Empty state
  if (!profileExists && !editing) {
    return (
      <div style={cardStyle}>
        <div style={headerStyle}>
          <h3 style={titleStyle}>🧭 Perfil Estratégico</h3>
        </div>
        <div style={{
          textAlign: 'center',
          padding: '32px 16px',
          color: '#A0AEC0',
          fontSize: '13px',
        }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>📋</div>
          <div style={{ marginBottom: '16px', fontWeight: 500 }}>Sin perfil estratégico</div>
          <button onClick={startEdit} style={btnStyle(true)}>
            Completar perfil
          </button>
        </div>
      </div>
    )
  }

  const currentData = editing ? draft : data

  return (
    <div style={cardStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <h3 style={titleStyle}>🧭 Perfil Estratégico</h3>
        <div style={{ display: 'flex', gap: '8px' }}>
          {editing ? (
            <>
              <button
                onClick={() => setEditing(false)}
                style={btnStyle(false)}
                disabled={saving}
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                style={btnStyle(true)}
                disabled={saving}
              >
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </>
          ) : (
            <button onClick={startEdit} style={btnStyle(false)}>
              Editar
            </button>
          )}
        </div>
      </div>

      {/* 3-column grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3,1fr)',
        gap: '16px',
        marginBottom: '20px',
      }}>
        {/* MADUREZ */}
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: '8px',
          padding: '14px',
        }}>
          <div style={sectionLabelStyle}>Madurez</div>
          {editing ? (
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {[1, 2, 3, 4].map(s => (
                <button
                  key={s}
                  onClick={() => setDraft(d => ({ ...d, maturity_stage: d.maturity_stage === s ? null : s }))}
                  style={{
                    width: '32px', height: '32px', borderRadius: '6px',
                    border: 'none', cursor: 'pointer', fontWeight: 700,
                    fontSize: '13px',
                    background: draft.maturity_stage === s ? '#E8792F' : 'rgba(255,255,255,0.08)',
                    color: draft.maturity_stage === s ? '#fff' : '#A0AEC0',
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          ) : (
            <div>
              <div style={{ fontSize: '20px', letterSpacing: '3px', marginBottom: '6px', color: '#E8792F' }}>
                {[1, 2, 3, 4].map(s => (
                  <span key={s} style={{ opacity: (currentData.maturity_stage ?? 0) >= s ? 1 : 0.2 }}>●</span>
                ))}
              </div>
            </div>
          )}
          <div style={{ fontSize: '12px', color: '#A0AEC0', marginTop: '8px' }}>
            {currentData.maturity_stage ? STAGE_LABELS[currentData.maturity_stage] : '—'}
          </div>
        </div>

        {/* OBJETIVOS */}
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: '8px',
          padding: '14px',
        }}>
          <div style={sectionLabelStyle}>Objetivos</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {OBJECTIVE_KEYS.map(key => {
              const val = (currentData.business_objectives as Record<string, number | null> | null)?.[key] ?? null
              return (
                <div
                  key={key}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    cursor: editing ? 'pointer' : 'default',
                  }}
                  onClick={editing ? () => setObjective(key, cycleObjective(val)) : undefined}
                >
                  <span style={{ fontSize: '16px' }}>{semaforo(val)}</span>
                  <span style={{ fontSize: '12px', color: '#A0AEC0' }}>{OBJECTIVE_LABELS[key]}</span>
                </div>
              )
            })}
          </div>
          {editing && (
            <div style={{ fontSize: '10px', color: '#4a5568', marginTop: '8px' }}>
              Click para ciclar ⚪→🔴→🟡→🟢→⚪
            </div>
          )}
        </div>

        {/* MODERNIZACIÓN */}
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: '8px',
          padding: '14px',
        }}>
          <div style={sectionLabelStyle}>Modernización</div>
          {editing ? (
            <select
              value={draft.modernization_approach ?? ''}
              onChange={e => setDraft(d => ({ ...d, modernization_approach: e.target.value || null }))}
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '6px',
                color: '#fff',
                fontSize: '12px',
                padding: '6px 10px',
                width: '100%',
                cursor: 'pointer',
              }}
            >
              <option value="">— Sin definir —</option>
              {MODERNIZATION_OPTIONS.map(o => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          ) : (
            <div>
              {currentData.modernization_approach ? (
                <span style={{
                  display: 'inline-block',
                  padding: '4px 12px',
                  borderRadius: '6px',
                  background: 'rgba(232,121,47,0.12)',
                  border: '1px solid rgba(232,121,47,0.25)',
                  color: '#E8792F',
                  fontSize: '13px',
                  fontWeight: 600,
                }}>
                  {currentData.modernization_approach}
                </span>
              ) : (
                <span style={{ fontSize: '13px', color: '#4a5568' }}>—</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* DESAFÍOS — full width */}
      <div style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: '8px',
        padding: '14px',
      }}>
        <div style={sectionLabelStyle}>Desafíos organizacionales</div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2,1fr)',
          gap: '8px',
        }}>
          {CHALLENGE_KEYS.map(key => {
            const checked = (currentData.org_challenges as Record<string, boolean> | null)?.[key] ?? false
            return (
              <label
                key={key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: editing ? 'pointer' : 'default',
                  fontSize: '13px',
                  color: checked ? '#fff' : '#A0AEC0',
                }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={!editing}
                  onChange={editing ? e => setChallenge(key, e.target.checked) : undefined}
                  style={{ accentColor: '#E8792F', cursor: editing ? 'pointer' : 'default' }}
                />
                {CHALLENGE_LABELS[key]}
              </label>
            )
          })}
        </div>
      </div>
    </div>
  )
}
