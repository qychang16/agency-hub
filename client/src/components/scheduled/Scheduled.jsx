import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { API, ACCENT, ACCENT_LIGHT, NAVY } from '../../utils/constants'
import { fmtSGT, isFuture, minutesUntil } from '../../utils/dates'
import ScheduledComposer from './ScheduledComposer'
import BulkScheduler from './BulkScheduler'

function Btn({ onClick, children, variant = 'primary', size = 'md', disabled, style: extra }) {
  const sizes = { sm: { padding: '5px 10px', fontSize: 11 }, md: { padding: '8px 14px', fontSize: 12 } }
  const variants = {
    primary: { background: ACCENT, color: '#fff', border: 'none' },
    ghost: { background: 'transparent', color: '#6b7280', border: '0.5px solid #e5e7eb' },
    danger: { background: '#fee2e2', color: '#dc2626', border: '0.5px solid #fca5a5' },
    dark: { background: NAVY, color: '#fff', border: 'none' },
  }
  return (
    <button onClick={!disabled ? onClick : undefined}
      style={{ ...sizes[size], ...variants[variant], borderRadius: 8, cursor: disabled ? 'default' : 'pointer', fontWeight: 500, opacity: disabled ? 0.6 : 1, display: 'inline-flex', alignItems: 'center', gap: 6, ...extra }}>
      {children}
    </button>
  )
}

function StatusBadge({ status }) {
  const styles = {
    pending: { bg: '#fef3c7', color: '#92400e', label: '⏳ Scheduled' },
    sending: { bg: '#dbeafe', color: '#1e40af', label: '📤 Sending' },
    sent: { bg: '#dcfce7', color: '#16a34a', label: '✓ Sent' },
    failed: { bg: '#fee2e2', color: '#dc2626', label: '✗ Failed' },
    cancelled: { bg: '#f1f4f9', color: '#9ca3af', label: '— Cancelled' },
  }
  const s = styles[status] || styles.pending
  return (
    <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 10, background: s.bg, color: s.color, fontWeight: 600, whiteSpace: 'nowrap' }}>
      {s.label}
    </span>
  )
}

function ChannelBadge({ channel }) {
  return (
    <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 6, background: channel === 'email' ? '#eff6ff' : '#f0fdf4', color: channel === 'email' ? '#1e40af' : '#16a34a', fontWeight: 600 }}>
      {channel === 'email' ? '📧 Email' : '💬 WhatsApp'}
    </span>
  )
}

const FILTER_TABS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Scheduled' },
  { key: 'sent', label: 'Sent' },
  { key: 'failed', label: 'Failed' },
  { key: 'cancelled', label: 'Cancelled' },
]

export default function Scheduled() {
  const { token, user } = useAuth()
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('pending')
  const [channelFilter, setChannelFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [showComposer, setShowComposer] = useState(false)
  const [showBulk, setShowBulk] = useState(false)
  const [expandedId, setExpandedId] = useState(null)
  const [cancelling, setCancelling] = useState(null)

  useEffect(() => { load() }, [])

  // Auto-refresh every 30 seconds for pending messages
  useEffect(() => {
    const interval = setInterval(() => {
      if (messages.some(m => m.status === 'pending')) load()
    }, 30000)
    return () => clearInterval(interval)
  }, [messages])

  async function load() {
    try {
      const r = await fetch(`${API}/scheduled`, { headers: { Authorization: 'Bearer ' + token } })
      const data = await r.json()
      setMessages(Array.isArray(data) ? data : [])
    } catch {} finally { setLoading(false) }
  }

  async function cancel(id) {
    if (!confirm('Cancel this scheduled message? This cannot be undone.')) return
    setCancelling(id)
    try {
      await fetch(`${API}/scheduled/${id}/cancel`, {
        method: 'PATCH',
        headers: { Authorization: 'Bearer ' + token }
      })
      load()
    } catch {} finally { setCancelling(null) }
  }

  const filtered = messages.filter(m => {
    const matchTab = activeTab === 'all' || m.status === activeTab
    const matchChannel = channelFilter === 'all' || m.channel === channelFilter
    const matchSearch = !search || m.contact_name?.toLowerCase().includes(search.toLowerCase()) || m.body?.toLowerCase().includes(search.toLowerCase())
    return matchTab && matchChannel && matchSearch
  })

  const counts = {
    all: messages.length,
    pending: messages.filter(m => m.status === 'pending').length,
    sent: messages.filter(m => m.status === 'sent').length,
    failed: messages.filter(m => m.status === 'failed').length,
    cancelled: messages.filter(m => m.status === 'cancelled').length,
  }

  const pendingCount = counts.pending
  const nextMessage = messages.filter(m => m.status === 'pending').sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at))[0]

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#f1f4f9' }}>
      {/* Header */}
      <div style={{ background: NAVY, padding: '20px 28px', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 14 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 4 }}>Scheduled Messages</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>
              {pendingCount > 0 ? `${pendingCount} message${pendingCount !== 1 ? 's' : ''} scheduled` : 'No messages scheduled'}
              {nextMessage && ` · Next: ${fmtSGT(nextMessage.scheduled_at)}`}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn variant="ghost" onClick={() => setShowBulk(true)}
              style={{ border: '0.5px solid rgba(255,255,255,0.3)', color: '#fff' }}>
              📊 Bulk CSV
            </Btn>
            <Btn onClick={() => setShowComposer(true)}
              style={{ background: '#fff', color: NAVY }}>
              + Schedule Message
            </Btn>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginTop: 18 }}>
          {[
            { label: 'Scheduled', value: counts.pending, icon: '⏳', color: '#fbbf24' },
            { label: 'Sent', value: counts.sent, icon: '✓', color: '#34d399' },
            { label: 'Failed', value: counts.failed, icon: '✗', color: '#f87171' },
            { label: 'Cancelled', value: counts.cancelled, icon: '—', color: '#94a3b8' },
          ].map(s => (
            <div key={s.label} style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 10, padding: '12px 14px', border: '0.5px solid rgba(255,255,255,0.1)' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 3 }}>{s.icon} {s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div style={{ background: '#fff', borderBottom: '0.5px solid #e5e7eb', padding: '12px 28px', display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', flexShrink: 0 }}>
        {/* Status tabs */}
        <div style={{ display: 'flex', gap: 4 }}>
          {FILTER_TABS.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              style={{ padding: '5px 12px', borderRadius: 7, border: 'none', background: activeTab === t.key ? ACCENT : 'transparent', color: activeTab === t.key ? '#fff' : '#6b7280', fontSize: 12, cursor: 'pointer', fontWeight: activeTab === t.key ? 600 : 400, display: 'flex', alignItems: 'center', gap: 5 }}>
              {t.label}
              {counts[t.key] > 0 && (
                <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 10, background: activeTab === t.key ? 'rgba(255,255,255,0.3)' : '#f1f4f9', color: activeTab === t.key ? '#fff' : '#6b7280' }}>
                  {counts[t.key]}
                </span>
              )}
            </button>
          ))}
        </div>

        <div style={{ width: 1, height: 20, background: '#e5e7eb' }} />

        {/* Channel filter */}
        <div style={{ display: 'flex', gap: 4 }}>
          {[['all', 'All Channels'], ['whatsapp', '💬 WhatsApp'], ['email', '📧 Email']].map(([k, l]) => (
            <button key={k} onClick={() => setChannelFilter(k)}
              style={{ padding: '4px 10px', borderRadius: 6, border: `0.5px solid ${channelFilter === k ? ACCENT : '#e5e7eb'}`, background: channelFilter === k ? ACCENT_LIGHT : 'transparent', color: channelFilter === k ? ACCENT : '#6b7280', fontSize: 11, cursor: 'pointer', fontWeight: channelFilter === k ? 600 : 400 }}>
              {l}
            </button>
          ))}
        </div>

        {/* Search */}
        <div style={{ marginLeft: 'auto', position: 'relative' }}>
          <svg style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', width: 12, height: 12, color: '#9ca3af', pointerEvents: 'none' }} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="7" cy="7" r="4"/><path d="M10.5 10.5l3 3" strokeLinecap="round"/></svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search contact or message…"
            style={{ padding: '6px 10px 6px 26px', border: '0.5px solid #e5e7eb', borderRadius: 8, fontSize: 12, outline: 'none', background: '#f9fafb', color: '#111827', width: 220 }} />
        </div>

        <Btn variant="ghost" size="sm" onClick={load}>↻ Refresh</Btn>
      </div>

      {/* Message list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 28px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
            <div>Loading scheduled messages…</div>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📅</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
              {activeTab === 'pending' ? 'No messages scheduled' : `No ${activeTab} messages`}
            </div>
            <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 24, maxWidth: 360, margin: '0 auto 24px' }}>
              {activeTab === 'pending'
                ? 'Schedule a WhatsApp or email message to send to a candidate or client at a specific time.'
                : 'Messages matching this filter will appear here.'}
            </div>
            {activeTab === 'pending' && (
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                <Btn onClick={() => setShowComposer(true)}>+ Schedule Single Message</Btn>
                <Btn variant="ghost" onClick={() => setShowBulk(true)}>📊 Bulk CSV Upload</Btn>
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map(msg => {
              const isExpanded = expandedId === msg.id
              const minsLeft = msg.status === 'pending' ? minutesUntil(msg.scheduled_at) : null
              const isImminent = minsLeft !== null && minsLeft <= 60 && minsLeft > 0
              const isPast = minsLeft !== null && minsLeft <= 0

              return (
                <div key={msg.id} style={{ background: '#fff', borderRadius: 12, border: `0.5px solid ${isImminent ? '#fde68a' : '#e5e7eb'}`, overflow: 'hidden', transition: 'border-color .2s' }}>
                  {/* Imminent warning */}
                  {isImminent && (
                    <div style={{ background: '#fffbeb', padding: '6px 16px', fontSize: 11, color: '#92400e', borderBottom: '0.5px solid #fde68a', display: 'flex', alignItems: 'center', gap: 6 }}>
                      ⚡ Sending in {minsLeft < 60 ? `${minsLeft} minute${minsLeft !== 1 ? 's' : ''}` : '< 1 minute'} — cancel now if needed
                    </div>
                  )}

                  {/* Main row */}
                  <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'flex-start', gap: 14, cursor: 'pointer' }}
                    onClick={() => setExpandedId(isExpanded ? null : msg.id)}>
                    {/* Channel icon */}
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: msg.channel === 'email' ? '#eff6ff' : '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                      {msg.channel === 'email' ? '📧' : '💬'}
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{msg.contact_name || 'Unknown contact'}</span>
                        <ChannelBadge channel={msg.channel} />
                        <StatusBadge status={msg.status} />
                        {msg.bulk_batch_id && (
                          <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 6, background: '#ede9fe', color: '#5b21b6', fontWeight: 600 }}>BULK</span>
                        )}
                      </div>

                      {/* Message preview */}
                      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '80%' }}>
                        {msg.subject ? <><strong>{msg.subject}</strong> — </> : ''}{msg.body?.slice(0, 100)}{msg.body?.length > 100 ? '…' : ''}
                      </div>

                      {/* Meta info */}
                      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 11, color: '#9ca3af' }}>
                          📅 {fmtSGT(msg.scheduled_at)}
                        </span>
                        {msg.phone_line && (
                          <span style={{ fontSize: 11, color: '#9ca3af' }}>
                            📱 {msg.phone_line}
                          </span>
                        )}
                        {msg.created_by_name && (
                          <span style={{ fontSize: 11, color: '#9ca3af' }}>
                            👤 {msg.created_by_name}
                          </span>
                        )}
                        {msg.status === 'sent' && msg.sent_at && (
                          <span style={{ fontSize: 11, color: '#16a34a' }}>
                            ✓ Sent {fmtSGT(msg.sent_at)}
                          </span>
                        )}
                        {msg.status === 'failed' && msg.failed_reason && (
                          <span style={{ fontSize: 11, color: '#dc2626' }}>
                            ✗ {msg.failed_reason}
                          </span>
                        )}
                        {msg.email_opened_at && (
                          <span style={{ fontSize: 11, color: '#7c3aed' }}>
                            👁 Opened {fmtSGT(msg.email_opened_at)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
                      {msg.status === 'pending' && (
                        <Btn variant="danger" size="sm" disabled={cancelling === msg.id} onClick={e => { e.stopPropagation(); cancel(msg.id) }}>
                          {cancelling === msg.id ? 'Cancelling…' : 'Cancel'}
                        </Btn>
                      )}
                      {msg.status === 'failed' && (
                        <Btn variant="ghost" size="sm" onClick={e => { e.stopPropagation(); /* retry */ }}>
                          ↻ Retry
                        </Btn>
                      )}
                      <span style={{ fontSize: 12, color: '#9ca3af' }}>{isExpanded ? '▲' : '▼'}</span>
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div style={{ padding: '0 18px 16px', borderTop: '0.5px solid #f1f4f9' }}>
                      <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        {/* Message body */}
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 8 }}>Message Content</div>
                          {msg.subject && (
                            <div style={{ fontSize: 12, fontWeight: 600, color: '#111827', marginBottom: 6 }}>Subject: {msg.subject}</div>
                          )}
                          <div style={{ fontSize: 12, color: '#374151', background: '#f9fafb', borderRadius: 8, padding: '10px 12px', lineHeight: 1.6, whiteSpace: 'pre-wrap', maxHeight: 200, overflowY: 'auto', border: '0.5px solid #e5e7eb' }}>
                            {msg.body}
                          </div>
                          {msg.email_cc && (
                            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 6 }}>CC: {msg.email_cc}</div>
                          )}
                        </div>

                        {/* Details */}
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 8 }}>Details</div>
                          {[
                            ['Contact', msg.contact_name],
                            ['Phone', msg.contact_phone],
                            ['Channel', msg.channel === 'email' ? 'Email' : 'WhatsApp'],
                            ['Scheduled for', fmtSGT(msg.scheduled_at)],
                            ['Created by', msg.created_by_name],
                            ['Status', msg.status],
                            msg.sent_at ? ['Sent at', fmtSGT(msg.sent_at)] : null,
                            msg.failed_reason ? ['Failure reason', msg.failed_reason] : null,
                            msg.email_opened_at ? ['Email opened', fmtSGT(msg.email_opened_at)] : null,
                            msg.bulk_batch_id ? ['Batch ID', msg.bulk_batch_id] : null,
                          ].filter(Boolean).map(([label, value]) => (
                            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '0.5px solid #f9fafb', fontSize: 12 }}>
                              <span style={{ color: '#9ca3af' }}>{label}</span>
                              <span style={{ color: '#374151', fontWeight: 500, textAlign: 'right', maxWidth: '60%' }}>{value || '—'}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modals */}
      {showComposer && <ScheduledComposer onClose={() => setShowComposer(false)} onSaved={() => { setShowComposer(false); load() }} />}
      {showBulk && <BulkScheduler onClose={() => setShowBulk(false)} onSaved={() => { setShowBulk(false); load() }} />}
    </div>
  )
}