import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../../context/AuthContext'
import { API } from '../../utils/constants'
import { ACCENT, ACCENT_LIGHT, NAVY } from '../../utils/designTokens'
import Btn from '../ui/Btn'

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const STAGE_COLORS = {
  new:          '#9a958c',
  contacted:    '#6366f1',
  screened:     '#5b21b6',
  shortlisted:  '#7c3aed',
  interviewing: ACCENT,
  offered:      '#0891b2',
  hired:        '#16a34a',
  rejected:     '#dc2626',
  archived:     '#6b6660',
}

// Funnel order — only "active funnel" stages, hired/rejected/archived are end states
const FUNNEL_STAGES = ['new', 'contacted', 'screened', 'shortlisted', 'interviewing', 'offered', 'hired']

const TYPE_STYLES = {
  candidate: { bg: '#eeedf5', color: '#2d2a7a', label: 'Candidate' },
  client:    { bg: '#dcfce7', color: '#16a34a', label: 'Client' },
  vendor:    { bg: '#fef3c7', color: '#92400e', label: 'Vendor' },
  other:     { bg: '#f5f3ef', color: '#6e6a63', label: 'Other' },
}

const BROADCAST_STATUS_STYLES = {
  draft:     { bg: '#f5f3ef', color: '#6e6a63', label: 'Draft' },
  scheduled: { bg: '#fef3c7', color: '#92400e', label: 'Scheduled' },
  sending:   { bg: '#eeedf5', color: '#2d2a7a', label: 'Sending' },
  completed: { bg: '#dcfce7', color: '#16a34a', label: 'Completed' },
  failed:    { bg: '#fee2e2', color: '#dc2626', label: 'Failed' },
  cancelled: { bg: '#f5f3ef', color: '#9a958c', label: 'Cancelled' },
}

const CARD_STYLE = {
  background: '#fff',
  borderRadius: 12,
  boxShadow: '0 1px 2px rgba(20,19,15,0.04), 0 4px 12px rgba(20,19,15,0.04)',
  border: '0.5px solid rgba(220,216,208,0.6)',
}

function fmtDate(ts) {
  if (!ts) return '\u2014'
  const d = new Date(ts)
  const now = new Date()
  const diffMs = now - d
  const diffMin = Math.floor(diffMs / 60000)
  const diffHr = Math.floor(diffMs / 3600000)
  const diffDay = Math.floor(diffMs / 86400000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHr < 24) return `${diffHr}h ago`
  if (diffDay < 7) return `${diffDay}d ago`
  return d.toLocaleDateString('en-SG', { month: 'short', day: '2-digit' })
}

function capitalize(s) {
  if (!s) return ''
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// ─────────────────────────────────────────────────────────────
// Status Strip — single line of system health indicators
// Each indicator is a dot + label + count. Click navigates.
// ─────────────────────────────────────────────────────────────
function StatusStrip({ data }) {
  const b = data.broadcasts
  const t = data.templates
  const c = data.contacts

  // Compute statuses. Each item: { tone: ok|warn|bad, label, detail }
  const items = []

  // Broadcasts health
  if (b.failed > 0) {
    items.push({ tone: 'warn', label: 'Broadcasts', detail: `${b.failed} failed` })
  } else if (b.active > 0) {
    items.push({ tone: 'ok', label: 'Broadcasts', detail: `${b.active} active` })
  } else if (b.total === 0) {
    items.push({ tone: 'idle', label: 'Broadcasts', detail: 'none yet' })
  } else {
    items.push({ tone: 'ok', label: 'Broadcasts', detail: 'all healthy' })
  }

  // Templates
  if (t.rejected > 0) {
    items.push({ tone: 'warn', label: 'Templates', detail: `${t.rejected} rejected` })
  } else if (t.pending > 0) {
    items.push({ tone: 'idle', label: 'Templates', detail: `${t.pending} pending review` })
  } else if (t.approved > 0) {
    items.push({ tone: 'ok', label: 'Templates', detail: `${t.approved} approved` })
  } else {
    items.push({ tone: 'idle', label: 'Templates', detail: 'none yet' })
  }

  // Compliance
  if (c.dnc > 0) {
    items.push({ tone: 'warn', label: 'Compliance', detail: `${c.dnc} on DNC` })
  } else if (c.opted_out > 0) {
    items.push({ tone: 'idle', label: 'Compliance', detail: `${c.opted_out} opted out` })
  } else {
    items.push({ tone: 'ok', label: 'Compliance', detail: 'all clear' })
  }

  // Activity
  if (data.active_conversations > 0) {
    items.push({ tone: 'ok', label: 'Conversations', detail: `${data.active_conversations} active this week` })
  } else {
    items.push({ tone: 'idle', label: 'Conversations', detail: 'none active' })
  }

  const toneColor = (tone) => {
    if (tone === 'ok') return '#16a34a'
    if (tone === 'warn') return '#dc2626'
    if (tone === 'idle') return '#9a958c'
    return '#9a958c'
  }

  return (
    <div style={{
      ...CARD_STYLE,
      padding: '14px 22px',
      display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 28,
      marginBottom: 16,
    }}>
      {items.map((item, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: toneColor(item.tone),
            boxShadow: item.tone === 'ok' || item.tone === 'warn'
              ? `0 0 0 4px ${item.tone === 'ok' ? 'rgba(22,163,74,0.12)' : 'rgba(220,38,38,0.12)'}`
              : 'none'
          }} />
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#14130f', letterSpacing: '-0.1px' }}>
              {item.label}
            </div>
            <div style={{ fontSize: 11, color: '#6e6a63', marginTop: 1 }}>
              {item.detail}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Pipeline at a glance — compact stage tiles in a row
// Each tile shows stage name + count, tile width proportional to count.
// Empty stages render as faint placeholders so the structure is visible
// regardless of data scale.
// ─────────────────────────────────────────────────────────────
function PipelineGlance({ pipelineData, totalContacts }) {
  // All stages in canonical order, with counts (0 if absent)
  const ALL_STAGES = [
    'new', 'contacted', 'screened', 'shortlisted',
    'interviewing', 'offered', 'hired', 'rejected', 'archived'
  ]
  const counts = {}
  pipelineData.forEach(p => { counts[p.pipeline_stage] = p.count })

  const tiles = ALL_STAGES.map(stage => ({
    stage,
    count: counts[stage] || 0,
  }))

  const total = tiles.reduce((sum, t) => sum + t.count, 0)
  const maxCount = Math.max(...tiles.map(t => t.count), 1)

  // Compute flex-grow for each tile based on count, with a minimum so empty
  // tiles still take some space and the grid stays readable.
  const tileFlex = (count) => {
    if (total === 0) return 1  // all equal when empty
    return Math.max(0.6, (count / maxCount))
  }

  return (
    <div style={{ ...CARD_STYLE, padding: 24, marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: '#14130f', letterSpacing: '-0.2px' }}>
          Pipeline at a Glance
        </div>
        <div style={{ fontSize: 12, color: '#9a958c' }}>
          {totalContacts} total contact{totalContacts !== 1 ? 's' : ''}
        </div>
      </div>
      <div style={{ fontSize: 12, color: '#9a958c', marginBottom: 18 }}>
        Distribution across your workspace stages
      </div>

      {total === 0 ? (
        <div style={{ padding: '36px 20px', textAlign: 'center', background: '#faf9f7', borderRadius: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#4a4742', marginBottom: 4 }}>
            No contacts in your pipeline yet
          </div>
          <div style={{ fontSize: 12, color: '#9a958c' }}>
            Add contacts to see them distributed across stages
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {tiles.map(t => {
            const isEmpty = t.count === 0
            const pct = total > 0 ? Math.round((t.count / total) * 100) : 0
            return (
              <div key={t.stage} style={{
                flex: tileFlex(t.count),
                minWidth: 110,
                padding: '14px 14px 12px',
                background: isEmpty ? '#faf9f7' : '#fff',
                border: `0.5px solid ${isEmpty ? 'rgba(220,216,208,0.5)' : STAGE_COLORS[t.stage]}33`,
                borderRadius: 10,
                position: 'relative',
                overflow: 'hidden',
                transition: 'transform .15s'
              }}>
                {/* Color accent bar at top */}
                <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0, height: 3,
                  background: STAGE_COLORS[t.stage],
                  opacity: isEmpty ? 0.25 : 1,
                }} />
                <div style={{
                  fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px',
                  color: isEmpty ? '#9a958c' : STAGE_COLORS[t.stage],
                  marginBottom: 6
                }}>
                  {capitalize(t.stage)}
                </div>
                <div style={{
                  display: 'flex', alignItems: 'baseline', gap: 6,
                }}>
                  <span style={{
                    fontSize: 22, fontWeight: 700, letterSpacing: '-0.4px',
                    color: isEmpty ? '#c4bfb6' : '#14130f',
                    lineHeight: 1
                  }}>
                    {t.count}
                  </span>
                  {!isEmpty && (
                    <span style={{ fontSize: 11, color: '#9a958c' }}>
                      {pct}%
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div style={{ marginTop: 16, fontSize: 11, color: '#9a958c', display: 'flex', alignItems: 'center', gap: 6 }}>
        <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <circle cx="8" cy="8" r="6.5"/>
          <line x1="8" y1="5" x2="8" y2="9"/>
          <circle cx="8" cy="11.5" r="0.5" fill="currentColor"/>
        </svg>
        Customize stages for your workspace in Settings (coming soon)
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Activity Stream — unified feed of broadcasts + contacts in chrono order
// Filterable by type. Each item has its own visual treatment.
// ─────────────────────────────────────────────────────────────
function ActivityStream({ broadcasts, contacts }) {
  const [filter, setFilter] = useState('all')

  // Merge into single sorted timeline
  const items = useMemo(() => {
    const all = []
    broadcasts.forEach(b => all.push({
      type: 'broadcast',
      ts: b.created_at,
      data: b,
    }))
    contacts.forEach(c => all.push({
      type: 'contact',
      ts: c.created_at,
      data: c,
    }))
    all.sort((a, b) => new Date(b.ts) - new Date(a.ts))
    return all
  }, [broadcasts, contacts])

  const filtered = useMemo(() => {
    if (filter === 'all') return items
    return items.filter(it => it.type === filter)
  }, [items, filter])

  const tabs = [
    { key: 'all',       label: 'All',         count: items.length },
    { key: 'broadcast', label: 'Broadcasts',  count: items.filter(i => i.type === 'broadcast').length },
    { key: 'contact',   label: 'Contacts',    count: items.filter(i => i.type === 'contact').length },
  ]

  return (
    <div style={{ ...CARD_STYLE, padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#14130f', letterSpacing: '-0.2px' }}>Recent Activity</div>
          <div style={{ fontSize: 12, color: '#9a958c', marginTop: 2 }}>Latest events in your workspace</div>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => setFilter(t.key)}
              style={{
                padding: '5px 12px', borderRadius: 7, border: 'none',
                background: filter === t.key ? ACCENT : 'transparent',
                color: filter === t.key ? '#fff' : '#6e6a63',
                fontSize: 12, cursor: 'pointer',
                fontWeight: filter === t.key ? 600 : 500,
                display: 'inline-flex', alignItems: 'center', gap: 5
              }}>
              {t.label}
              <span style={{
                fontSize: 10, padding: '1px 6px', borderRadius: 10,
                background: filter === t.key ? 'rgba(255,255,255,0.25)' : '#f5f3ef',
                color: filter === t.key ? '#fff' : '#6e6a63',
                fontWeight: 600
              }}>
                {t.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div style={{ padding: '48px 20px', textAlign: 'center', background: '#faf9f7', borderRadius: 10 }}>
          <div style={{ fontSize: 13, color: '#9a958c' }}>No activity to show.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {filtered.map((item, idx) => {
            const isLast = idx === filtered.length - 1
            return (
              <div key={`${item.type}-${item.data.id}`} style={{
                display: 'flex', gap: 14,
                paddingBottom: isLast ? 0 : 16,
                position: 'relative'
              }}>
                {/* Timeline dot + line */}
                <div style={{ position: 'relative', flexShrink: 0, width: 32 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8,
                    background: item.type === 'broadcast' ? ACCENT_LIGHT : '#dcfce7',
                    color: item.type === 'broadcast' ? ACCENT : '#16a34a',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: '0.5px solid rgba(220,216,208,0.6)',
                    zIndex: 1, position: 'relative'
                  }}>
                    {item.type === 'broadcast' ? (
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M2 9l12-6v10z"/>
                        <path d="M5 8v3"/>
                      </svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="8" cy="6" r="3"/>
                        <path d="M3 14c0-2.5 2.2-4 5-4s5 1.5 5 4"/>
                      </svg>
                    )}
                  </div>
                  {!isLast && (
                    <div style={{
                      position: 'absolute', left: 16, top: 32, bottom: -16,
                      width: 1, background: 'rgba(220,216,208,0.6)'
                    }} />
                  )}
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0, paddingTop: 4 }}>
                  {item.type === 'broadcast' ? <BroadcastActivity b={item.data} /> : <ContactActivity c={item.data} />}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function BroadcastActivity({ b }) {
  const ss = BROADCAST_STATUS_STYLES[b.status] || BROADCAST_STATUS_STYLES.draft
  const total = b.total_recipients || 0
  const sent = b.sent_recipients || 0
  const failed = b.failed_recipients || 0
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 4 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#14130f', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            Broadcast: {b.name}
          </div>
          <div style={{ fontSize: 11, color: '#9a958c', marginTop: 2 }}>
            {sent}/{total} sent {failed > 0 ? `${'\u00b7'} ${failed} failed` : ''} {'\u00b7'} {fmtDate(b.created_at)}
          </div>
        </div>
        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 6, background: ss.bg, color: ss.color, fontWeight: 600, flexShrink: 0 }}>
          {ss.label}
        </span>
      </div>
    </div>
  )
}

function ContactActivity({ c }) {
  const ts = TYPE_STYLES[c.type] || TYPE_STYLES.other
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, color: '#14130f' }}>
            <span style={{ fontWeight: 600 }}>{c.name || '(no name)'}</span>
            <span style={{ color: '#9a958c', fontWeight: 400 }}> added as {ts.label.toLowerCase()}</span>
            {c.pipeline_stage && c.pipeline_stage !== 'new' && (
              <span style={{ color: '#9a958c', fontWeight: 400 }}>
                {' '}{'\u00b7'} {capitalize(c.pipeline_stage)}
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: '#9a958c', marginTop: 2 }}>
            {fmtDate(c.created_at)}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────
export default function Analytics() {
  const { token } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => { if (!token) return; load() }, [token])

  async function load() {
    setRefreshing(true)
    try {
      const r = await fetch(`${API}/analytics/dashboard`, { headers: { Authorization: 'Bearer ' + token } })
      if (!r.ok) {
        const d = await r.json()
        setError(d.error || 'Failed to load analytics')
        return
      }
      const json = await r.json()
      setData(json)
      setError('')
    } catch (err) {
      setError('Failed to load: ' + err.message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  if (loading) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#faf9f7' }}>
        <div style={{ color: '#9a958c', fontSize: 13 }}>Loading analytics{'\u2026'}</div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#faf9f7', gap: 14 }}>
        <div style={{ fontSize: 14, color: '#dc2626' }}>{error || 'No data available'}</div>
        <Btn variant="ghost" onClick={load}>Retry</Btn>
      </div>
    )
  }

  // Pipeline funnel total — uses candidates as the funnel population since
  // funnel stages (new..hired) only apply to candidates in the typical use
  // case. For non-recruitment workspaces, this still reflects "people moving
  // through the workflow" — which is what the funnel measures.
  const totalCandidates = data.contacts.candidates

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#faf9f7' }}>
      {/* Header */}
      <div className="px-4 pt-5 pb-3 md:px-7 md:pt-6" style={{ flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 14 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#14130f', marginBottom: 4, letterSpacing: '-0.3px' }}>Analytics</div>
            <div style={{ fontSize: 12, color: '#6e6a63' }}>
              Workspace overview {'\u00b7'} updated {fmtDate(data.computed_at)}
            </div>
          </div>
          <Btn variant="ghost" onClick={load} disabled={refreshing}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 8a6 6 0 11-1.5-3.97" />
                <polyline points="14 2 14 5 11 5" />
              </svg>
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </span>
          </Btn>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 md:px-7" style={{ flex: 1, overflowY: 'auto', paddingBottom: 24 }}>

        {/* Section 1: Status Strip */}
        <StatusStrip data={data} />

        {/* Section 2: Pipeline at a Glance */}
        <PipelineGlance pipelineData={data.pipeline} totalContacts={data.contacts.total} />

        {/* Section 3: Activity Stream */}
        <ActivityStream
          broadcasts={data.recent_broadcasts || []}
          contacts={data.recent_contacts || []}
        />
      </div>
    </div>
  )
}