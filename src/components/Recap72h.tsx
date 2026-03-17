'use client'
import { useState, useEffect } from 'react'

interface RecapData {
  recap_text: string
  msg_count_72h: number
  meeting_count_72h: number
  alert_count_72h: number
  last_client_msg: string | null
  generated_at: string
  cached: boolean
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(mins / 60)
  if (hours > 0) return `hace ${hours}h`
  if (mins > 0) return `hace ${mins}m`
  return 'ahora'
}

export default function Recap72h({ projectId }: { projectId: string }) {
  const [data, setData] = useState<RecapData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  async function fetchRecap(refresh = false) {
    if (refresh) setRefreshing(true)
    else setLoading(true)
    try {
      const url = `/api/projects/${projectId}/recap${refresh ? '?refresh=1' : ''}`
      const res = await fetch(url)
      const json = await res.json()
      if (!json.error) setData(json)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { fetchRecap() }, [projectId])

  if (loading) {
    return (
      <div style={{
        background: 'rgba(232,121,47,0.04)', border: '1px solid rgba(232,121,47,0.15)',
        borderRadius: '12px', padding: '16px 20px', marginBottom: '20px',
        display: 'flex', alignItems: 'center', gap: '10px',
      }}>
        <div style={{
          width: '16px', height: '16px', borderRadius: '50%',
          border: '2px solid rgba(232,121,47,0.3)', borderTopColor: '#E8792F',
          animation: 'spin 0.8s linear infinite', flexShrink: 0,
        }} />
        <span style={{ fontSize: '13px', color: '#64748b' }}>Generando recap de las últimas 72h...</span>
      </div>
    )
  }

  if (!data) return null

  const hasActivity = data.msg_count_72h > 0 || data.meeting_count_72h > 0 || data.alert_count_72h > 0
  const accentColor = data.alert_count_72h > 0 ? '#f59e0b' : hasActivity ? '#E8792F' : '#64748b'
  const bgColor = data.alert_count_72h > 0 ? 'rgba(245,158,11,0.05)' : hasActivity ? 'rgba(232,121,47,0.05)' : 'rgba(255,255,255,0.02)'
  const borderColor = data.alert_count_72h > 0 ? 'rgba(245,158,11,0.20)' : hasActivity ? 'rgba(232,121,47,0.18)' : 'rgba(255,255,255,0.07)'

  return (
    <div style={{
      background: bgColor,
      border: `1px solid ${borderColor}`,
      borderLeft: `3px solid ${accentColor}`,
      borderRadius: '12px',
      padding: '16px 20px',
      marginBottom: '24px',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '14px' }}>🕐</span>
          <span style={{ fontSize: '12px', fontWeight: 700, color: accentColor, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Recap 72h
          </span>
          {/* Stats pills */}
          <div style={{ display: 'flex', gap: '6px', marginLeft: '4px' }}>
            {data.msg_count_72h > 0 && (
              <span style={{
                fontSize: '10px', padding: '2px 7px', borderRadius: '10px',
                background: 'rgba(255,255,255,0.07)', color: '#94a3b8', fontWeight: 600,
              }}>
                💬 {data.msg_count_72h} msg
              </span>
            )}
            {data.meeting_count_72h > 0 && (
              <span style={{
                fontSize: '10px', padding: '2px 7px', borderRadius: '10px',
                background: 'rgba(255,255,255,0.07)', color: '#94a3b8', fontWeight: 600,
              }}>
                🎙 {data.meeting_count_72h} reunión{data.meeting_count_72h > 1 ? 'es' : ''}
              </span>
            )}
            {data.alert_count_72h > 0 && (
              <span style={{
                fontSize: '10px', padding: '2px 7px', borderRadius: '10px',
                background: 'rgba(245,158,11,0.15)', color: '#f59e0b', fontWeight: 600,
              }}>
                ⚠️ {data.alert_count_72h} alerta{data.alert_count_72h > 1 ? 's' : ''}
              </span>
            )}
            {!hasActivity && (
              <span style={{
                fontSize: '10px', padding: '2px 7px', borderRadius: '10px',
                background: 'rgba(255,255,255,0.05)', color: '#475569', fontWeight: 600,
              }}>
                Sin actividad
              </span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {data.last_client_msg && (
            <span style={{ fontSize: '11px', color: '#475569' }}>
              Último cliente: {timeAgo(data.last_client_msg)}
            </span>
          )}
          <button
            onClick={() => fetchRecap(true)}
            disabled={refreshing}
            style={{
              fontSize: '11px', padding: '3px 8px', borderRadius: '6px',
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)',
              color: refreshing ? '#334155' : '#64748b', cursor: refreshing ? 'not-allowed' : 'pointer',
              fontWeight: 500,
            }}>
            {refreshing ? '⟳ ...' : '⟳ Refresh'}
          </button>
        </div>
      </div>

      {/* Recap text */}
      <p style={{
        fontSize: '13px', color: '#cbd5e0', lineHeight: '1.6',
        margin: 0,
      }}>
        {data.recap_text}
      </p>

      {/* Footer */}
      <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'flex-end' }}>
        <span style={{ fontSize: '10px', color: '#334155' }}>
          {data.cached ? 'Cache' : 'Generado'} {timeAgo(data.generated_at)} · Gemini AI
        </span>
      </div>
    </div>
  )
}
