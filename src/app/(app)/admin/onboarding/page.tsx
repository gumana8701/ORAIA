'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const DEVS = [
  { name: 'Enzo ORA IA', emoji: '🟠' },
  { name: 'Héctor Ramirez', emoji: '🔵' },
  { name: 'Luca Fonzo', emoji: '🟢' },
  { name: 'Kevin ORA IA', emoji: '🟣' },
  { name: 'Brenda Cruz', emoji: '🟡' },
  { name: 'Victor Ramirez', emoji: '🔴' },
]

function slugify(str: string) {
  return str.toLowerCase()
    .replace(/[áàä]/g, 'a').replace(/[éèë]/g, 'e').replace(/[íìï]/g, 'i')
    .replace(/[óòö]/g, 'o').replace(/[úùü]/g, 'u').replace(/ñ/g, 'n')
    .replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
    .substring(0, 40)
}

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)

  // Step 1
  const [projectName, setProjectName] = useState('')
  const [projectTypes, setProjectTypes] = useState<string[]>([])

  // Step 2
  const [notionProjects, setNotionProjects] = useState<{ id: string; nombre: string }[]>([])
  const [notionProjectId, setNotionProjectId] = useState('')
  const [selectedDevs, setSelectedDevs] = useState<string[]>([])
  const [slackName, setSlackName] = useState('')

  useEffect(() => {
    fetch('/api/notion/projects-list').then(r => r.json()).then(d => {
      if (Array.isArray(d)) setNotionProjects(d)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (projectName) setSlackName(slugify(projectName))
  }, [projectName])

  function toggleType(t: string) {
    setProjectTypes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])
  }

  function toggleDev(name: string) {
    setSelectedDevs(prev => prev.includes(name) ? prev.filter(d => d !== name) : [...prev, name])
  }

  async function submit() {
    if (!notionProjectId) {
      alert('⚠️ Debes seleccionar un proyecto de Notion antes de continuar.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectName,
          projectTypes,
          notionProjectId: notionProjectId || null,
          assignedDevs: selectedDevs,
          slackChannelName: slackName,
        }),
      })
      const data = await res.json()
      setResult(data)
      setStep(3)
    } catch (e: any) {
      setResult({ error: e.message })
      setStep(3)
    } finally {
      setLoading(false)
    }
  }

  function reset() {
    setStep(1); setProjectName(''); setProjectTypes([])
    setNotionProjectId(''); setSelectedDevs([]); setSlackName(''); setResult(null)
  }

  const card = {
    background: 'rgba(17,24,39,0.8)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '12px', padding: '24px',
  }

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '32px 16px' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#f1f5f9', margin: '0 0 6px' }}>
          🚀 Onboarding de Proyecto
        </h1>
        <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>
          Configura un nuevo proyecto y conéctalo a WhatsApp, Slack, Notion y tareas en un solo paso.
        </p>
      </div>

      {/* Step indicator */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '28px', alignItems: 'center' }}>
        {[1, 2, 3].map(s => (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '28px', height: '28px', borderRadius: '50%',
              background: step === s ? '#E8792F' : step > s ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.06)',
              border: step > s ? '1px solid rgba(34,197,94,0.5)' : step === s ? 'none' : '1px solid rgba(255,255,255,0.10)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '12px', fontWeight: 700,
              color: step === s ? '#fff' : step > s ? '#22c55e' : '#475569',
            }}>
              {step > s ? '✓' : s}
            </div>
            {s < 3 && <div style={{ width: '40px', height: '1px', background: step > s ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.08)' }} />}
          </div>
        ))}
        <span style={{ fontSize: '12px', color: '#475569', marginLeft: '4px' }}>
          {step === 1 ? 'Proyecto' : step === 2 ? 'Equipo' : 'Resultado'}
        </span>
      </div>

      {/* ── STEP 1 ── */}
      {step === 1 && (
        <div style={card}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#f1f5f9', margin: '0 0 20px' }}>
            Información del proyecto
          </h2>

          {/* Project name */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: '6px' }}>
              NOMBRE DEL GRUPO DE WHATSAPP
            </label>
            <input
              type="text"
              value={projectName}
              onChange={e => setProjectName(e.target.value)}
              placeholder="Pega el nombre exacto del grupo..."
              style={{
                width: '100%', boxSizing: 'border-box',
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '8px', padding: '10px 14px', fontSize: '14px', color: '#f1f5f9',
                outline: 'none',
              }}
            />
            <div style={{
              marginTop: '6px', padding: '8px 12px', borderRadius: '6px',
              background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)',
              fontSize: '11px', color: '#f59e0b',
            }}>
              ⚠️ Debe ser <strong>idéntico</strong> al nombre del grupo en WhatsApp — se usará para vincular el monitoreo automático
            </div>
          </div>

          {/* Project type — multi select */}
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: '6px' }}>
              TIPO DE SERVICIOS <span style={{ color: '#475569', fontWeight: 400 }}>(puede ser ambos)</span>
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {[
                { type: 'voice', icon: '🎙', title: 'Agente de Voz', desc: 'IVR, Callbot, Agente de voz' },
                { type: 'whatsapp', icon: '💬', title: 'WhatsApp / Texto', desc: 'Chatbot, Agente de texto' },
              ].map(opt => {
                const sel = projectTypes.includes(opt.type)
                return (
                  <button
                    key={opt.type}
                    onClick={() => toggleType(opt.type)}
                    style={{
                      padding: '16px', borderRadius: '10px', cursor: 'pointer', textAlign: 'left',
                      background: sel ? 'rgba(232,121,47,0.12)' : 'rgba(255,255,255,0.03)',
                      border: sel ? '2px solid #E8792F' : '1px solid rgba(255,255,255,0.08)',
                      transition: 'all 0.15s', position: 'relative',
                    }}
                  >
                    {sel && (
                      <div style={{
                        position: 'absolute', top: '8px', right: '10px',
                        width: '16px', height: '16px', borderRadius: '50%',
                        background: '#E8792F', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '9px', color: '#fff', fontWeight: 700,
                      }}>✓</div>
                    )}
                    <div style={{ fontSize: '24px', marginBottom: '6px' }}>{opt.icon}</div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: sel ? '#E8792F' : '#f1f5f9', marginBottom: '2px' }}>
                      {opt.title}
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>{opt.desc}</div>
                  </button>
                )
              })}
            </div>
            {projectTypes.length === 2 && (
              <div style={{
                marginTop: '8px', padding: '6px 10px', borderRadius: '6px',
                background: 'rgba(232,121,47,0.08)', border: '1px solid rgba(232,121,47,0.2)',
                fontSize: '11px', color: '#E8792F',
              }}>
                ✅ Se generarán las 20 tareas combinadas (10 voz + 10 WhatsApp)
              </div>
            )}
          </div>

          <button
            onClick={() => setStep(2)}
            disabled={!projectName.trim() || projectTypes.length === 0}
            style={{
              marginTop: '24px', width: '100%', padding: '12px', borderRadius: '8px',
              background: !projectName.trim() || projectTypes.length === 0 ? 'rgba(255,255,255,0.06)' : '#E8792F',
              border: 'none', cursor: !projectName.trim() || projectTypes.length === 0 ? 'not-allowed' : 'pointer',
              color: !projectName.trim() || projectTypes.length === 0 ? '#334155' : '#fff',
              fontSize: '14px', fontWeight: 600, transition: 'all 0.15s',
            }}
          >
            Siguiente →
          </button>
        </div>
      )}

      {/* ── STEP 2 ── */}
      {step === 2 && (
        <div style={card}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#f1f5f9', margin: '0 0 20px' }}>
            Equipo y conexiones
          </h2>

          {/* Notion — REQUIRED */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: '6px' }}>
              PROYECTO EN NOTION <span style={{ color: '#f87171' }}>*</span>
            </label>
            <select
              value={notionProjectId}
              onChange={e => setNotionProjectId(e.target.value)}
              style={{
                width: '100%', boxSizing: 'border-box',
                background: '#fff', border: '1px solid rgba(255,255,255,0.20)',
                borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: '#111827',
                outline: 'none',
              }}
            >
              <option value="" style={{ color: '#6b7280' }}>— Selecciona el proyecto en Notion —</option>
              {notionProjects.map(n => (
                <option key={n.id} value={n.id} style={{ color: '#111827' }}>{n.nombre}</option>
              ))}
            </select>
            {!notionProjectId && (
              <p style={{ fontSize: '11px', color: '#f87171', margin: '5px 0 0' }}>
                ⚠️ Debes vincular un proyecto de Notion para continuar
              </p>
            )}
          </div>

          {/* Devs */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: '8px' }}>
              DESARROLLADORES ASIGNADOS
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {DEVS.map(dev => {
                const selected = selectedDevs.includes(dev.name)
                return (
                  <button
                    key={dev.name}
                    onClick={() => toggleDev(dev.name)}
                    style={{
                      padding: '7px 14px', borderRadius: '20px', cursor: 'pointer',
                      background: selected ? 'rgba(232,121,47,0.15)' : 'rgba(255,255,255,0.05)',
                      border: selected ? '1px solid rgba(232,121,47,0.4)' : '1px solid rgba(255,255,255,0.10)',
                      color: selected ? '#E8792F' : '#94a3b8', fontSize: '13px', fontWeight: selected ? 600 : 400,
                      transition: 'all 0.15s',
                    }}
                  >
                    {dev.emoji} {dev.name}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Slack channel name */}
          <div style={{ marginBottom: '8px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: '6px' }}>
              NOMBRE DEL CANAL DE SLACK
            </label>
            <div style={{ position: 'relative' }}>
              <span style={{
                position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)',
                fontSize: '13px', color: '#475569',
              }}>#</span>
              <input
                type="text"
                value={slackName}
                onChange={e => setSlackName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '8px', padding: '10px 14px 10px 24px', fontSize: '13px', color: '#f1f5f9',
                  outline: 'none',
                }}
              />
            </div>
            <p style={{ fontSize: '11px', color: '#475569', margin: '5px 0 0' }}>
              Se creará un canal privado con: Jennifer, Trina, Guillermo, Enzo + devs seleccionados
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
            <button
              onClick={() => setStep(1)}
              style={{
                flex: 1, padding: '12px', borderRadius: '8px',
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)',
                color: '#94a3b8', fontSize: '14px', cursor: 'pointer',
              }}
            >
              ← Atrás
            </button>
            <button
              onClick={submit}
              disabled={loading || !notionProjectId}
              style={{
                flex: 2, padding: '12px', borderRadius: '8px',
                background: loading || !notionProjectId ? 'rgba(255,255,255,0.06)' : '#E8792F',
                border: 'none', cursor: loading || !notionProjectId ? 'not-allowed' : 'pointer',
                color: loading || !notionProjectId ? '#334155' : '#fff', fontSize: '14px', fontWeight: 700,
              }}
            >
              {loading ? '⟳ Procesando...' : '🚀 Hacer Onboarding'}
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 3 — Results ── */}
      {step === 3 && result && (
        <div style={card}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#f1f5f9', margin: '0 0 20px' }}>
            {result.error ? '❌ Error' : '✅ Onboarding completado'}
          </h2>

          {result.error ? (
            <p style={{ fontSize: '13px', color: '#f87171' }}>{result.error}</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {/* Project */}
              <ResultItem
                ok={true}
                title={`Proyecto ${result.project?.action === 'created' ? 'creado' : 'actualizado'}`}
                desc={result.project?.nombre}
              />

              {/* Tasks */}
              <ResultItem
                ok={(result.tasks?.created || 0) > 0}
                title={`${result.tasks?.created || 0} tareas generadas`}
                desc={`Checklist de ${projectTypes.includes('voice') && projectTypes.includes('whatsapp') ? 'Voz + WhatsApp' : projectTypes.includes('voice') ? 'Agente de Voz' : 'WhatsApp/Texto'}`}
              />

              {/* Slack */}
              <ResultItem
                ok={!!result.slack?.id}
                title={result.slack?.id ? `Canal #${result.slack.name} creado en Slack` : 'Canal Slack no creado'}
                desc={result.slack?.error ? `Error: ${result.slack.error} — agrega el scope groups:write en la app de Slack` : undefined}
                warn={!result.slack?.id}
              />

              {/* Welcome call */}
              <ResultItem
                ok={result.welcomeCall?.found}
                title={result.welcomeCall?.found
                  ? `Llamada de bienvenida encontrada: "${result.welcomeCall?.title}"`
                  : 'Llamada de bienvenida no encontrada'}
                desc={result.welcomeCall?.found ? undefined : 'Agregada a "Llamadas Pendientes" para revisión'}
                warn={!result.welcomeCall?.found}
              />

              {/* Notion se vincula desde /admin/notion-link cuando corresponda */}
              {result.notion && (
                <ResultItem ok={true} title="Notion vinculado" />
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
            {result.projectId && (
              <button
                onClick={() => router.push(`/proyectos/${result.projectId}`)}
                style={{
                  flex: 2, padding: '12px', borderRadius: '8px',
                  background: '#E8792F', border: 'none', cursor: 'pointer',
                  color: '#fff', fontSize: '14px', fontWeight: 700,
                }}
              >
                Ver proyecto →
              </button>
            )}
            <button
              onClick={reset}
              style={{
                flex: 1, padding: '12px', borderRadius: '8px',
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)',
                color: '#94a3b8', fontSize: '14px', cursor: 'pointer',
              }}
            >
              Nuevo onboarding
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function ResultItem({ ok, title, desc, warn }: { ok: boolean; title: string; desc?: string; warn?: boolean }) {
  return (
    <div style={{
      display: 'flex', gap: '10px', padding: '10px 12px', borderRadius: '8px',
      background: ok ? 'rgba(34,197,94,0.06)' : warn ? 'rgba(245,158,11,0.06)' : 'rgba(239,68,68,0.06)',
      border: `1px solid ${ok ? 'rgba(34,197,94,0.15)' : warn ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)'}`,
    }}>
      <span style={{ fontSize: '14px', flexShrink: 0, marginTop: '1px' }}>
        {ok ? '✅' : warn ? '⚠️' : '❌'}
      </span>
      <div>
        <div style={{ fontSize: '13px', color: '#e2e8f0', fontWeight: 500 }}>{title}</div>
        {desc && <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>{desc}</div>}
      </div>
    </div>
  )
}
