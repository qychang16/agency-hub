import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { API } from '../../utils/constants'
import { ACCENT, ACCENT_LIGHT, NAVY } from '../../utils/designTokens'
import Button from '../ui/Button'

// Status pill styles. Reused from list view for consistency.
const BROADCAST_STATUS_STYLES = {
  draft:     { bg: '#f5f3ef', color: '#6e6a63', label: 'Draft' },
  scheduled: { bg: '#fef3c7', color: '#92400e', label: 'Scheduled' },
  sending:   { bg: '#eeedf5', color: '#2d2a7a', label: 'Sending' },
  completed: { bg: '#dcfce7', color: '#16a34a', label: 'Completed' },
  failed:    { bg: '#fee2e2', color: '#dc2626', label: 'Failed' },
  cancelled: { bg: '#f5f3ef', color: '#9a958c', label: 'Cancelled' },
}

const RECIPIENT_STATUS_STYLES = {
  pending: { bg: '#f5f3ef', color: '#6e6a63', label: 'Pending' },
  sending: { bg: '#eeedf5', color: '#2d2a7a', label: 'Sending' },
  sent:    { bg: '#dcfce7', color: '#16a34a', label: 'Sent' },
  failed:  { bg: '#fee2e2', color: '#dc2626', label: 'Failed' },
  skipped: { bg: '#fff7ed', color: '#9a6a00', label: 'Skipped' },
}

function fmtTs(ts) {
  if (!ts) return '\u2014'
  const d = new Date(ts)
  return d.toLocaleString('en-SG', {
    year: 'numeric', month: 'short', day: '2-digit',
    hour: '2-digit', minute: '2-digit'
  })
}

// Format hour for display in safety summary
function fmtHour(h) {
  if (h === null || h === undefined) return '\u2014'
  const ampm = h >= 12 ? 'PM' : 'AM'
  const display = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${display}:00 ${ampm}`
}

const FILTER_TABS = [
  { key: 'all',     label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'sent',    label: 'Sent' },
  { key: 'failed',  label: 'Failed' },
  { key: 'skipped', label: 'Skipped' },
]

export default function BroadcastDetail({ broadcastId, onBack }) {
  const { token, user, hasPermission } = useAuth()
  const [broadcast, setBroadcast] = useState(null)
  const [recipients, setRecipients] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('all')
  const [search, setSearch] = useState('')
  const [actionRunning, setActionRunning] = useState(false)

  useEffect(() => {
    if (!token || !broadcastId) return
    load()
    // Auto-refresh every 5 seconds while broadcast is in motion
    const interval = setInterval(() => {
      // Only refresh if broadcast might be changing state
      if (broadcast && ['scheduled', 'sending'].includes(broadcast.status)) {
        load()
      }
    }, 5000)
    return () => clearInterval(interval)
  }, [token, broadcastId, broadcast?.status])

  async function load() {
    try {
      const [bRes, rRes] = await Promise.all([
        fetch(`${API}/broadcasts/${broadcastId}`, { headers: { Authorization: 'Bearer ' + token } }),
        fetch(`${API}/broadcasts/${broadcastId}/recipients?limit=500`, { headers: { Authorization: 'Bearer ' + token } }),
      ])
      if (!bRes.ok) {
        const d = await bRes.json()
        setError(d.error || 'Failed to load broadcast')
        setLoading(false)
        return
      }
      const bData = await bRes.json()
      const rData = await rRes.json()
      setBroadcast(bData)
      setRecipients(rData.recipients || [])
      setError('')
    } catch (err) {
      setError('Failed to load: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  async function cancelBroadcast() {
    if (!confirm(`Cancel broadcast "${broadcast.name}"? Any pending recipients will be skipped. In-flight sends cannot be unsent.`)) return
    setActionRunning(true)
    try {
      const r = await fetch(`${API}/broadcasts/${broadcastId}/cancel`, {
        method: 'PATCH',
        headers: { Authorization: 'Bearer ' + token },
      })
      if (!r.ok) {
        const d = await r.json()
        alert(d.error || 'Failed to cancel')
        return
      }
      load()
    } catch (err) {
      alert('Failed to cancel: ' + err.message)
    } finally {
      setActionRunning(false)
    }
  }

  async function retryFailed() {
    if (!confirm('Retry failed recipients? They will be reset to pending and the worker will re-attempt sends on the next poll cycle.')) return
    setActionRunning(true)
    try {
      const r = await fetch(`${API}/broadcasts/${broadcastId}/retry-failed`, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token },
      })
      if (!r.ok) {
        const d = await r.json()
        alert(d.error || 'Failed to retry')
        return
      }
      const data = await r.json()
      alert(`${data.retried_count} recipient(s) reset. Broadcast back to scheduled.`)
      load()
    } catch (err) {
      alert('Failed to retry: ' + err.message)
    } finally {
      setActionRunning(false)
    }
  }

  if (loading) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#faf9f7' }}>
        <div style={{ textAlign: 'center', color: '#9a958c', fontSize: 13 }}>Loading broadcast{'\u2026'}</div>
      </div>
    )
  }

  if (error || !broadcast) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#faf9f7', gap: 16 }}>
        <div style={{ fontSize: 14, color: '#dc2626' }}>{error || 'Broadcast not found'}</div>
        <Button variant="secondary" onClick={onBack}>Back to Broadcasts</Button>
      </div>
    )
  }

  const statusStyle = BROADCAST_STATUS_STYLES[broadcast.status] || BROADCAST_STATUS_STYLES.draft
  const isDirector = user?.role === 'director'
  const canManage = hasPermission('manage_broadcasts')

  // Filter recipients by tab + search
  const filtered = recipients.filter(r => {
    const matchTab = activeTab === 'all' || r.status === activeTab
    const matchSearch = !search ||
      r.contact_name?.toLowerCase().includes(search.toLowerCase()) ||
      r.contact_phone?.toLowerCase().includes(search.toLowerCase())
    return matchTab && matchSearch
  })

  const counts = {
    all:     recipients.length,
    pending: recipients.filter(r => r.status === 'pending').length,
    sending: recipients.filter(r => r.status === 'sending').length,
    sent:    recipients.filter(r => r.status === 'sent').length,
    failed:  recipients.filter(r => r.status === 'failed').length,
    skipped: recipients.filter(r => r.status === 'skipped').length,
  }

  const canCancel = canManage && ['scheduled', 'sending'].includes(broadcast.status)
  const canRetry = canManage && ['failed', 'completed'].includes(broadcast.status) && counts.failed > 0

  // Safety description for sidebar
  const safetyDescription = (() => {
    if (!broadcast.quiet_hours_enabled) return 'Quiet hours disabled (sends anytime)'
    if (broadcast.force_send_outside_hours) return `Force send outside ${fmtHour(broadcast.quiet_hours_start_hour)}-${fmtHour(broadcast.quiet_hours_end_hour)}`
    return `Pause sends ${fmtHour(broadcast.quiet_hours_start_hour)} to ${fmtHour(broadcast.quiet_hours_end_hour)}`
  })()

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#faf9f7' }}>
      {/* Header */}
      <div className="px-4 pt-5 pb-4 md:px-7 md:pt-6" style={{ flexShrink: 0 }}>
        <div style={{ marginBottom: 12 }}>
          <button onClick={onBack} style={{ background: 'transparent', border: 'none', color: '#6e6a63', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, padding: 0 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>
            Back to Broadcasts
          </button>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 14, marginBottom: 20 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#14130f', letterSpacing: '-0.3px' }}>{broadcast.name}</div>
              <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, background: statusStyle.bg, color: statusStyle.color, fontWeight: 600 }}>
                {statusStyle.label}
              </span>
            </div>
            <div style={{ fontSize: 12, color: '#6e6a63' }}>
              Template: {broadcast.template_name || '\u2014'} {'\u00b7'} Created by {broadcast.created_by_name || 'unknown'} {'\u00b7'} {fmtTs(broadcast.created_at)}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {canRetry && (
              <Button variant="primary" onClick={retryFailed} loading={actionRunning}>
                Retry Failed ({counts.failed})
              </Button>
            )}
            {canCancel && (
              <Button variant="danger" onClick={cancelBroadcast} loading={actionRunning}>
                Cancel Broadcast
              </Button>
            )}
          </div>
        </div>

        {broadcast.error_summary && (
          <div style={{ marginBottom: 16, padding: '10px 14px', background: '#fef2f2', border: '0.5px solid #fecaca', borderRadius: 8, fontSize: 12, color: '#dc2626' }}>
            {broadcast.error_summary}
          </div>
        )}

        {broadcast.cancelled_at && (
          <div style={{ marginBottom: 16, padding: '10px 14px', background: '#f5f3ef', border: '0.5px solid #dcd8d0', borderRadius: 8, fontSize: 12, color: '#6e6a63' }}>
            Cancelled at {fmtTs(broadcast.cancelled_at)} {broadcast.cancelled_by_name ? `by ${broadcast.cancelled_by_name}` : ''}
          </div>
        )}

        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
          {[
            { label: 'Total', value: broadcast.total_recipients || 0, color: '#14130f' },
            { label: 'Pending', value: broadcast.pending_recipients || 0, color: counts.pending === 0 ? '#9a958c' : '#9a6a00' },
            { label: 'Sent', value: broadcast.sent_recipients || 0, color: broadcast.sent_recipients ? '#2d6a4f' : '#9a958c' },
            { label: 'Failed', value: broadcast.failed_recipients || 0, color: broadcast.failed_recipients ? '#8e2a2a' : '#9a958c' },
            { label: 'Skipped', value: broadcast.skipped_recipients || 0, color: broadcast.skipped_recipients ? '#9a6a00' : '#9a958c' },
          ].map(s => (
            <div key={s.label} style={{ background: '#fff', borderRadius: 8, padding: '12px 14px', border: '0.5px solid #dcd8d0' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: s.color, letterSpacing: '-0.3px' }}>{s.value}</div>
              <div style={{ fontSize: 10, color: '#6e6a63', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 500 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Filter row */}
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
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={`Search name or phone${'\u2026'}`}
            className="w-full md:w-[220px]"
            style={{ padding: '6px 10px 6px 26px', border: '0.5px solid #dcd8d0', borderRadius: 8, fontSize: 12, outline: 'none', background: '#faf9f7', color: '#14130f', boxSizing: 'border-box' }} />
        </div>
        <Button variant="secondary" size="sm" onClick={load}>Refresh</Button>
      </div>

      {/* Body: recipient list + sidebar */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex' }}>
        {/* Recipient list */}
        <div className="px-4 py-5 md:px-7" style={{ flex: 1 }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9a958c', fontSize: 12 }}>
              {recipients.length === 0
                ? 'No recipients in this broadcast'
                : 'No recipients match these filters'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {filtered.map(r => {
                const ss = RECIPIENT_STATUS_STYLES[r.status] || RECIPIENT_STATUS_STYLES.pending
                return (
                  <div key={r.id} style={{ background: '#fff', borderRadius: 8, border: '0.5px solid #dcd8d0', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#14130f' }}>{r.contact_name || '(no name)'}</span>
                        <span style={{ fontSize: 11, color: '#9a958c' }}>{r.contact_phone || '(no phone)'}</span>
                        <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 6, background: ss.bg, color: ss.color, fontWeight: 600 }}>
                          {ss.label}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: '#6e6a63' }}>
                        {r.contact_type ? r.contact_type : ''}
                        {r.contact_pipeline_stage ? ` ${'\u00b7'} ${r.contact_pipeline_stage}` : ''}
                        {r.sent_at ? ` ${'\u00b7'} sent ${fmtTs(r.sent_at)}` : ''}
                        {r.whatsapp_message_id ? ` ${'\u00b7'} wa_id ${r.whatsapp_message_id.slice(0, 12)}\u2026` : ''}
                      </div>
                      {r.failed_reason && (
                        <div style={{ fontSize: 11, color: '#dc2626', marginTop: 4, padding: '4px 8px', background: '#fef2f2', borderRadius: 5, border: '0.5px solid #fecaca' }}>
                          {r.failed_reason}
                        </div>
                      )}
                      {r.skipped_reason && (
                        <div style={{ fontSize: 11, color: '#9a6a00', marginTop: 4, padding: '4px 8px', background: '#fff7ed', borderRadius: 5, border: '0.5px solid #fed7aa' }}>
                          {r.skipped_reason}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Sidebar — broadcast metadata */}
        <div className="hidden lg:block" style={{ width: 280, flexShrink: 0, padding: '20px 28px 28px 0' }}>
          <div style={{ background: '#fff', borderRadius: 10, border: '0.5px solid #dcd8d0', padding: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#4a4742', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 12 }}>Configuration</div>
            {[
              ['Status', statusStyle.label],
              ['Created', fmtTs(broadcast.created_at)],
              ['Scheduled for', fmtTs(broadcast.scheduled_at)],
              broadcast.started_at ? ['Started at', fmtTs(broadcast.started_at)] : null,
              broadcast.sent_at ? ['Finished at', fmtTs(broadcast.sent_at)] : null,
              broadcast.cancelled_at ? ['Cancelled at', fmtTs(broadcast.cancelled_at)] : null,
              ['Quiet hours', safetyDescription],
              ['Fail limit', `${broadcast.consecutive_fail_limit} consecutive`],
            ].filter(Boolean).map(([label, value]) => (
              <div key={label} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 10, color: '#9a958c', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 2 }}>{label}</div>
                <div style={{ fontSize: 12, color: '#14130f' }}>{value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}