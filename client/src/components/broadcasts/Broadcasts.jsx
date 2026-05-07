import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { API } from '../../utils/constants'
import { ACCENT, ACCENT_LIGHT, NAVY } from '../../utils/designTokens'
import Button from '../ui/Button'
import Modal from '../ui/Modal'
import BroadcastComposer from './BroadcastComposer'

// Status visual styles. Mirrors the Scheduled Messages convention so users
// learn one vocabulary across both surfaces.
const STATUS_STYLES = {
  draft:     { bg: '#f5f3ef', color: '#6e6a63', label: 'Draft' },
  scheduled: { bg: '#fef3c7', color: '#92400e', label: 'Scheduled' },
  sending:   { bg: '#eeedf5', color: '#2d2a7a', label: 'Sending' },
  completed: { bg: '#dcfce7', color: '#16a34a', label: 'Completed' },
  failed:    { bg: '#fee2e2', color: '#dc2626', label: 'Failed' },
  cancelled: { bg: '#f5f3ef', color: '#9a958c', label: 'Cancelled' },
}

const FILTER_TABS = [
  { key: 'all',       label: 'All' },
  { key: 'draft',     label: 'Drafts' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'sending',   label: 'Sending' },
  { key: 'completed', label: 'Completed' },
  { key: 'failed',    label: 'Failed' },
  { key: 'cancelled', label: 'Cancelled' },
]

// Format a timestamp for display. Returns '-' if null. Local SG time.
function fmtTs(ts) {
  if (!ts) return '\u2014'
  const d = new Date(ts)
  return d.toLocaleString('en-SG', {
    year: 'numeric', month: 'short', day: '2-digit',
    hour: '2-digit', minute: '2-digit'
  })
}

// Card for a single broadcast in the list. Stats come straight from the
// JOIN-aggregated API response. Pending/sending/sent/failed/skipped are
// computed server-side, not derived here, so display is cheap.
function BroadcastCard({ b, isDirector, onOpen, onDelete }) {
  const ss = STATUS_STYLES[b.status] || STATUS_STYLES.draft
  const total = b.total_recipients || 0
  const sent = b.sent_recipients || 0
  const failed = b.failed_recipients || 0
  const skipped = b.skipped_recipients || 0
  const pct = total > 0 ? Math.round((sent / total) * 100) : 0

  return (
    <div
      onClick={() => onOpen(b)}
      style={{
        background: '#fff', borderRadius: 12, border: '0.5px solid #dcd8d0',
        overflow: 'hidden', display: 'flex', flexDirection: 'column',
        cursor: 'pointer', transition: 'border-color .15s'
      }}>
      <div style={{ padding: '14px 16px', borderBottom: '0.5px solid #f5f3ef' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 6 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#14130f', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {b.name}
          </div>
          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 6, background: ss.bg, color: ss.color, fontWeight: 600, flexShrink: 0 }}>
            {ss.label}
          </span>
        </div>
        <div style={{ fontSize: 11, color: '#9a958c' }}>
          {b.template_name ? `Template: ${b.template_name}` : 'No template selected'}
        </div>
      </div>

      <div style={{ padding: '12px 16px', flex: 1 }}>
        <div style={{ fontSize: 11, color: '#6e6a63', marginBottom: 8 }}>
          {total} {total === 1 ? 'recipient' : 'recipients'}
          {b.status === 'sending' || b.status === 'completed' ? ` \u00b7 ${sent} sent (${pct}%)` : ''}
          {failed > 0 ? ` \u00b7 ${failed} failed` : ''}
          {skipped > 0 ? ` \u00b7 ${skipped} skipped` : ''}
        </div>
        {(b.status === 'sending' || b.status === 'completed') && total > 0 && (
          <div style={{ height: 4, background: '#f5f3ef', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${pct}%`,
              background: failed > 0 ? '#f59e0b' : '#16a34a',
              transition: 'width .3s'
            }} />
          </div>
        )}
        {b.scheduled_at && b.status === 'scheduled' && (
          <div style={{ fontSize: 11, color: '#92400e', marginTop: 8 }}>
            Sends: {fmtTs(b.scheduled_at)}
          </div>
        )}
        {b.error_summary && (
          <div style={{ fontSize: 11, color: '#dc2626', marginTop: 8, padding: '6px 8px', background: '#fef2f2', borderRadius: 6, border: '0.5px solid #fecaca' }}>
            {b.error_summary}
          </div>
        )}
      </div>

      <div style={{ padding: '10px 16px', borderTop: '0.5px solid #f5f3ef', display: 'flex', gap: 8, alignItems: 'center', fontSize: 11, color: '#9a958c' }}>
        <span>By {b.created_by_name || 'unknown'}</span>
        <span>{'\u00b7'}</span>
        <span>{fmtTs(b.created_at)}</span>
        {isDirector && b.status === 'draft' && (
          <Button
            variant="danger"
            size="sm"
            onClick={(e) => { e.stopPropagation(); onDelete(b) }}
            style={{ marginLeft: 'auto' }}>
            Delete
          </Button>
        )}
      </div>
    </div>
  )
}

export default function Broadcasts({ onOpen }) {
  const { token, user, hasPermission } = useAuth()
  const [broadcasts, setBroadcasts] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('all')
  const [search, setSearch] = useState('')
  const [showComposer, setShowComposer] = useState(false)

  useEffect(() => { if (!token) return; load() }, [token])

  async function load() {
    try {
      const r = await fetch(`${API}/broadcasts`, { headers: { Authorization: 'Bearer ' + token } })
      const data = await r.json()
      setBroadcasts(Array.isArray(data) ? data : [])
    } catch {} finally { setLoading(false) }
  }

  async function deleteBroadcast(b) {
    if (!confirm(`Delete broadcast "${b.name}"? This cannot be undone.`)) return
    try {
      const r = await fetch(`${API}/broadcasts/${b.id}`, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer ' + token }
      })
      if (!r.ok) {
        const d = await r.json()
        alert(d.error || 'Failed to delete broadcast')
        return
      }
      load()
    } catch {
      alert('Failed to delete broadcast')
    }
  }

  // Filter all broadcasts by tab + search.
  const filtered = broadcasts.filter(b => {
    const matchTab = activeTab === 'all' || b.status === activeTab
    const matchSearch = !search ||
      b.name?.toLowerCase().includes(search.toLowerCase()) ||
      b.template_name?.toLowerCase().includes(search.toLowerCase())
    return matchTab && matchSearch
  })

  const counts = {
    all:       broadcasts.length,
    draft:     broadcasts.filter(b => b.status === 'draft').length,
    scheduled: broadcasts.filter(b => b.status === 'scheduled').length,
    sending:   broadcasts.filter(b => b.status === 'sending').length,
    completed: broadcasts.filter(b => b.status === 'completed').length,
    failed:    broadcasts.filter(b => b.status === 'failed').length,
    cancelled: broadcasts.filter(b => b.status === 'cancelled').length,
  }

  const isDirector = user?.role === 'director'
  const canCreate = hasPermission('manage_broadcasts')

  // Stat tile values for the header strip
  const totalSent = broadcasts.reduce((sum, b) => sum + (b.sent_recipients || 0), 0)
  const totalFailed = broadcasts.reduce((sum, b) => sum + (b.failed_recipients || 0), 0)

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#faf9f7' }}>
      <div className="px-4 pt-5 pb-4 md:px-7 md:pt-6" style={{ flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 14, marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#14130f', marginBottom: 4, letterSpacing: '-0.3px' }}>Broadcasts</div>
            <div style={{ fontSize: 12, color: '#6e6a63' }}>
              {counts.scheduled} scheduled {'\u00b7'} {counts.sending} sending {'\u00b7'} {counts.completed} completed
            </div>
          </div>
          {canCreate && (
            <Button variant="primary" onClick={() => setShowComposer(true)}>+ New Broadcast</Button>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          {[
            { label: 'Total Broadcasts', value: counts.all,        color: counts.all === 0 ? '#9a958c' : '#14130f' },
            { label: 'Scheduled',        value: counts.scheduled,  color: counts.scheduled === 0 ? '#9a958c' : '#9a6a00' },
            { label: 'Messages Sent',    value: totalSent,         color: totalSent === 0 ? '#9a958c' : '#2d6a4f' },
            { label: 'Failed',           value: totalFailed,       color: totalFailed === 0 ? '#9a958c' : '#8e2a2a' },
          ].map(s => (
            <div key={s.label} style={{ background: '#fff', borderRadius: 8, padding: '14px 16px', border: '0.5px solid #dcd8d0' }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: s.color, letterSpacing: '-0.3px' }}>{s.value}</div>
              <div style={{ fontSize: 10, color: '#6e6a63', marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 500 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 md:px-7 py-3 gap-3 md:gap-4" style={{ background: '#fff', borderBottom: '0.5px solid #dcd8d0', display: 'flex', alignItems: 'center', flexWrap: 'wrap', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {FILTER_TABS.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              style={{ padding: '5px 12px', borderRadius: 7, border: 'none', background: activeTab === t.key ? ACCENT : 'transparent', color: activeTab === t.key ? '#fff' : '#6e6a63', fontSize: 12, cursor: 'pointer', fontWeight: activeTab === t.key ? 600 : 400, display: 'flex', alignItems: 'center', gap: 5 }}>
              {t.label}
              {counts[t.key] > 0 && (
                <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 10, background: activeTab === t.key ? 'rgba(255,255,255,0.3)' : '#f5f3ef', color: activeTab === t.key ? '#fff' : '#6e6a63' }}>
                  {counts[t.key]}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="w-full md:w-auto md:ml-auto" style={{ position: 'relative' }}>
          <svg style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', width: 12, height: 12, color: '#9a958c', pointerEvents: 'none' }} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="7" cy="7" r="4"/>
            <path d="M10.5 10.5l3 3" strokeLinecap="round"/>
          </svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search broadcasts..."
            className="w-full md:w-[220px]"
            style={{ padding: '6px 10px 6px 26px', border: '0.5px solid #dcd8d0', borderRadius: 8, fontSize: 12, outline: 'none', background: '#faf9f7', color: '#14130f', boxSizing: 'border-box' }} />
        </div>
      </div>

      <div className="px-4 py-5 md:px-7" style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#9a958c' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#9a958c" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 12 }}>
              <path d="M3 11l18-8v18l-18-8v-2z"/>
              <path d="M11.6 16.8a3 3 0 11-5.8-1.6"/>
            </svg>
            <div>Loading broadcasts...</div>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#9a958c" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 16 }}>
              <path d="M3 11l18-8v18l-18-8v-2z"/>
              <path d="M11.6 16.8a3 3 0 11-5.8-1.6"/>
            </svg>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#4a4742', marginBottom: 6 }}>
              {activeTab === 'all' ? 'No broadcasts yet' : `No ${activeTab} broadcasts`}
            </div>
            <div style={{ fontSize: 13, color: '#9a958c', marginBottom: 24, maxWidth: 380, margin: '0 auto 24px' }}>
              {activeTab === 'all'
                ? 'Send a templated WhatsApp message to many candidates at once. Pick a template, choose your recipients, schedule the send.'
                : 'Broadcasts matching this filter will appear here.'}
            </div>
            {canCreate && activeTab === 'all' && (
              <Button variant="primary" onClick={() => setShowComposer(true)}>+ Create your first broadcast</Button>
            )}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14 }}>
            {filtered.map(b => (
              <BroadcastCard
                key={b.id}
                b={b}
                isDirector={isDirector}
                onOpen={onOpen ? () => onOpen(b.id) : undefined}
                onDelete={deleteBroadcast}
              />
            ))}
          </div>
        )}
      </div>

      {showComposer && <BroadcastComposer onClose={() => setShowComposer(false)} onSaved={load} />}
    </div>
  )
}