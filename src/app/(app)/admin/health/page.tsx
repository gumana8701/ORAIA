'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type Check = { slack: boolean; whatsapp: boolean; notion: boolean; devs: boolean; kpis: boolean }
type ProjectHealth = {
  id: string; nombre: string; cliente: string; project_type: string | null
  onboarded_at: string | null; score: number
  checks: Check; tasks: { total: number; completado: number }
}

const CHECK_META: { key: keyof Check; label: string; icon: string; fix: string }[] = [
  { key: 'slack',    label: 'Slack',    icon: '💬', fix: '/admin/onboarding' },
  { key: 'whatsapp', label: 'WhatsApp', icon: '📱', fix: '/admin/onboarding' },
  { key: 'notion',   label: 'Notion',   icon: '📝', fix: '/admin/notion-link' },
  { key: 'devs',     label: 'Dev asignado', icon: '👤', fix: '/admin/usuarios' },
  { key: 'kpis',     label: 'KPIs',     icon: '📊', fix: '' },
]

function ScoreRing({ score }: { score: number }) {
  const r = 22; const circ = 2 * Math.PI * r
  const color = score === 100 ? '#22c55e' : score >= 60 ? '#E8792F' : '#ef4444'
  return (
    <svg width="54" height="54" viewBox="0 0 54 54">
      <circle cx="27" cy="27" r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="5" />
      <circle cx="27" cy="27" r={r} fill="none" stroke={color} strokeWidth="5"
        strokeDasharray={circ} strokeDashoffset={circ * (1 - score / 100)}
        strokeLinecap="round" transform="rotate(-90 27 27)" style={{ transition: 'stroke-dashoffset 0.5s' }} />
      <text x="27" y="31" textAnchor="middle" fontSize="11" fontWeight="700" fill={color}>{score}%</text>
    </svg>
  )
}

export default function HealthDashboard() {
  const [projects, setProjects] = useState<ProjectHealth[]>([])
  const [loading, setLoading]   = useState(true)
  const [filter, setFilter]     = useState<'all' | 'ok' | 'warn' | 'critical'>('all')
  const router = useRouter()

  useEffect(() => {
    fetch('/api/admin/health').then(r => r.json()).then(d => { setProjects(d.projects || []); setLoading(false) })
  }, [])

  const filtered = projects.filter(p =>
    filter === 'all'      ? true :
    filter === 'ok'       ? p.score === 100 :
    filter === 'warn'     ? p.score >= 60 && p.score < 100 :
    /* critical */          p.score < 60
  )

  const total    = projects.length
  const ok       = projects.filter(p => p.score === 100).length
  const warn     = projects.filter(p => p.score >= 60 && p.score < 100).length
  const critical = projects.filter(p => p.score < 60).length
  const avgScore = total > 0 ? Math.round(projects.reduce((s, p) => s + p.score, 0) / total) : 0

  // Per-check stats
  const checkStats = CHECK_META.map(c => ({
    ...c,
    connected: projects.filter(p => p.checks[c.key]).length,
    pct: total > 0 ? Math.round(projects.filter(p => p.checks[c.key]).length / total * 100) : 0,
  }))

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: '#475569', fontSize: '14px' }}>
      Verificando conexiones...
    </div>
  )

  return (
    <div style={{ padding: '24px', maxWidth: '1100px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#f1f5f9', margin: 0 }}>🔍 Health Check — Proyectos</h1>
        <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0' }}>
          Verificación de conexiones por proyecto · Solo visible para Admin y Supervisor
        </p>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
        {[
          { label: 'Score promedio', value: `${avgScore}%`, color: avgScore >= 80 ? '#22c55e' : avgScore >= 50 ? '#E8792F' : '#ef4444', sub: `${total} proyectos activos` },
          { label: '✅ Completos',   value: ok,       color: '#22c55e', sub: `${total > 0 ? Math.round(ok/total*100) : 0}% del total` },
          { label: '⚠️ Incompletos', value: warn,     color: '#E8792F', sub: 'Score 60–99%' },
          { label: '🔴 Críticos',    value: critical, color: '#ef4444', sub: 'Score < 60%' },
        ].map(card => (
          <div key={card.label} style={{ background: 'rgba(17,24,39,0.8)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '16px' }}>
            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>{card.label}</div>
            <div style={{ fontSize: '26px', fontWeight: 800, color: card.color, lineHeight: 1 }}>{card.value}</div>
            <div style={{ fontSize: '11px', color: '#475569', marginTop: '4px' }}>{card.sub}</div>
          </div>
        ))}
      </div>

      {/* Check stats bars */}
      <div style={{ background: 'rgba(17,24,39,0.8)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '16px 20px', marginBottom: '24px' }}>
        <div style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '14px' }}>Conexiones por tipo</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {checkStats.map(c => (
            <div key={c.key} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '13px', width: '130px', flexShrink: 0, color: '#cbd5e1' }}>{c.icon} {c.label}</span>
              <div style={{ flex: 1, height: '8px', borderRadius: '4px', background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: '4px', width: `${c.pct}%`, background: c.pct === 100 ? '#22c55e' : c.pct >= 50 ? '#E8792F' : '#ef4444', transition: 'width 0.5s' }} />
              </div>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', width: '60px', textAlign: 'right', flexShrink: 0 }}>{c.connected}/{total} · {c.pct}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        {([['all','Todos'], ['ok','✅ OK'], ['warn','⚠️ Incompletos'], ['critical','🔴 Críticos']] as [typeof filter, string][]).map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} style={{ padding: '5px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', border: '1px solid transparent', background: filter === k ? '#E8792F' : 'rgba(255,255,255,0.06)', borderColor: filter === k ? '#E8792F' : 'rgba(255,255,255,0.10)', color: filter === k ? '#fff' : '#94a3b8' }}>
            {l} {k !== 'all' && <span style={{ opacity: 0.7 }}>({k === 'ok' ? ok : k === 'warn' ? warn : critical})</span>}
          </button>
        ))}
      </div>

      {/* Project table */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {filtered.map(p => (
          <div key={p.id} style={{ background: 'rgba(17,24,39,0.8)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '14px', cursor: 'pointer', transition: 'border-color 0.15s' }}
            onClick={() => router.push(`/proyectos/${p.id}`)}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(232,121,47,0.35)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)')}
          >
            {/* Score ring */}
            <ScoreRing score={p.score} />

            {/* Name + type */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#f1f5f9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.nombre}</div>
              <div style={{ fontSize: '11px', color: '#475569', marginTop: '2px' }}>
                {p.project_type === 'voice' ? '🎙 Voz' : p.project_type === 'whatsapp' ? '💬 Chat' : p.project_type === 'both' ? '🎙💬' : '—'}
                {p.onboarded_at && ` · onboarded ${new Date(p.onboarded_at).toLocaleDateString('es', { day:'2-digit', month:'short' })}`}
              </div>
            </div>

            {/* Tasks progress */}
            <div style={{ textAlign: 'center', flexShrink: 0, width: '64px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: p.tasks.total > 0 && p.tasks.completado === p.tasks.total ? '#22c55e' : '#64748b' }}>
                {p.tasks.completado}/{p.tasks.total}
              </div>
              <div style={{ fontSize: '10px', color: '#475569' }}>tareas</div>
            </div>

            {/* Check pills */}
            <div style={{ display: 'flex', gap: '5px', flexShrink: 0 }}>
              {CHECK_META.map(c => (
                <span key={c.key}
                  title={c.label + (p.checks[c.key] ? ' ✅' : ' — falta conectar')}
                  onClick={e => { e.stopPropagation(); if (!p.checks[c.key] && c.fix) router.push(c.fix) }}
                  style={{
                    fontSize: '13px', cursor: p.checks[c.key] ? 'default' : 'pointer',
                    opacity: p.checks[c.key] ? 1 : 0.25,
                    filter: p.checks[c.key] ? 'none' : 'grayscale(1)',
                  }}
                >{c.icon}</span>
              ))}
            </div>

            <span style={{ color: '#334155', fontSize: '14px', flexShrink: 0 }}>›</span>
          </div>
        ))}
      </div>
    </div>
  )
}
