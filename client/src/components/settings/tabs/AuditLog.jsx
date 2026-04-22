import { useState, useEffect } from 'react'
import { useAuth } from '../../../context/AuthContext'
import { API, ACCENT } from '../../../utils/constants'
import { fmtSGT } from '../../../utils/dates'

function Btn({ onClick, children, variant = 'primary', size = 'md', disabled }) {
  const sizes = { sm: { padding: '5px 12px', fontSize: 11 }, md: { padding: '8px 16px', fontSize: 12 } }
  const variants = {
    primary: { background: ACCENT, color: '#fff', border: 'none' },
    ghost: { background: 'transparent', color: '#6b7280', border: '0.5px solid #e5e7eb' },
  }
  return (
    <button onClick={!disabled ? onClick : undefined}
      style={{ ...sizes[size], ...variants[variant], borderRadius: 8, cursor: disabled ? 'default' : 'pointer', fontWeight: 500, opacity: disabled ? 0.6 : 1, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      {children}
    </button>
  )
}

const ACTION_META = {
  login: { label: 'Login', bg: '#eff6ff', color: '#1e40af', icon: '🔑' },
  create_agent: { label: 'Agent Created', bg: '#dcfce7', color: '#16a34a', icon: '👤' },
  update_agent: { label: 'Agent Updated', bg: '#fef3c7', color: '#92400e', icon: '✏️' },
  delete_contact: { label: 'Contact Deleted', bg: '#fee2e2', color: '#dc2626', icon: '🗑' },
  create_contact: { label: 'Contact Added', bg: '#dcfce7', color: '#16a34a', icon: '➕' },
  update_contact: { label: 'Contact Updated', bg: '#fef3c7', color: '#92400e', icon: '✏️' },
  reassign_conversation: { label: 'Reassigned', bg: '#ede9fe', color: '#5b21b6', icon: '🔀' },
  reset_password: { label: 'Password Reset', bg: '#fef3c7', color: '#92400e', icon: '🔒' },
  pdpa_update: { label: 'PDPA Updated', bg: '#ecfeff', color: '#0e7490', icon: '📋' },
  update_workspace: { label: 'Workspace Updated', bg: '#f0fdf4', color: '#166534', icon: '🏢' },
  create_team: { label: 'Team Created', bg: '#dcfce7', color: '#16a34a', icon: '👥' },
  update_team: { label: 'Team Updated', bg: '#fef3c7', color: '#92400e', icon: '✏️' },
  delete_team: { label: 'Team Deleted', bg: '#fee2e2', color: '#dc2626', icon: '🗑' },
  add_phone_number: { label: 'Number Added', bg: '#dcfce7', color: '#16a34a', icon: '📱' },
  update_conversation_status: { label: 'Status Changed', bg: '#ede9fe', color: '#5b21b6', icon: '🔄' },
}

const FILTER_CATEGORIES = [
  { value: 'all', label: 'All Actions' },
  { value: 'login', label: 'Logins' },
  { value: 'agent', label: 'Agent Changes' },
  { value: 'contact', label: 'Contact Changes' },
  { value: 'conversation', label: 'Conversations' },
  { value: 'settings', label: 'Settings Changes' },
  { value: 'pdpa', label: 'PDPA & Compliance' },
]

export default function AuditLog() {
  const { token } = useAuth()
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [expandedId, setExpandedId] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const r = await fetch(`${API}/audit-log`, { headers: { Authorization: 'Bearer ' + token } })
      const data = await r.json()
      setLogs(Array.isArray(data) ? data : [])
    } catch {} finally { setLoading(false) }
  }

  function matchesCategory(log) {
    if (category === 'all') return true
    if (category === 'login') return log.action === 'login'
    if (category === 'agent') return log.action?.includes('agent')
    if (category === 'contact') return log.action?.includes('contact')
    if (category === 'conversation') return log.action?.includes('conversation') || log.action?.includes('reassign')
    if (category === 'settings') return log.action?.includes('workspace') || log.action?.includes('team') || log.action?.includes('routing') || log.action?.includes('phone')
    if (category === 'pdpa') return log.action?.includes('pdpa') || log.action?.includes('dnc')
    return true
  }

  const filtered = logs.filter(l => {
    const matchSearch = !search || l.user_name?.toLowerCase().includes(search.toLowerCase()) || l.action?.includes(search.toLowerCase()) || l.entity_type?.includes(search.toLowerCase())
    const matchDate = (!fromDate || new Date(l.created_at) >= new Date(fromDate)) && (!toDate || new Date(l.created_at) <= new Date(toDate + 'T23:59:59'))
    return matchSearch && matchDate && matchesCategory(l)
  })

  function exportCSV() {
    const headers = ['Date & Time (SGT)', 'User', 'Action', 'Entity Type', 'Entity ID', 'Details']
    const rows = filtered.map(l => [
      new Date(l.created_at).toLocaleString('en-GB', { timeZone: 'Asia/Singapore' }),
      l.user_name || 'System',
      l.action?.replace(/_/g, ' ') || '',
      l.entity_type || '',
      l.entity_id || '',
      JSON.stringify(l.new_values || {})
    ])
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `telcloud-audit-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>Audit Log</div>
          <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 3 }}>Complete record of all actions. Showing last 500 entries. Export CSV for full history.</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn variant="ghost" onClick={load}>↻ Refresh</Btn>
          <Btn variant="ghost" onClick={exportCSV}>⬇ Export CSV</Btn>
        </div>
      </div>

      {/* Filters */}
      <div style={{ background: '#fff', borderRadius: 10, border: '0.5px solid #e5e7eb', padding: '14px 16px', marginBottom: 16, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 12, height: 12, color: '#9ca3af', pointerEvents: 'none' }} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="7" cy="7" r="4"/><path d="M10.5 10.5l3 3" strokeLinecap="round"/></svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by user, action…"
            style={{ width: '100%', padding: '7px 10px 7px 28px', border: '0.5px solid #e5e7eb', borderRadius: 7, fontSize: 12, outline: 'none', background: '#f9fafb', color: '#111827', boxSizing: 'border-box' }} />
        </div>

        {/* Category filter */}
        <select value={category} onChange={e => setCategory(e.target.value)}
          style={{ padding: '7px 10px', border: '0.5px solid #e5e7eb', borderRadius: 7, fontSize: 12, background: '#f9fafb', color: '#111827', outline: 'none' }}>
          {FILTER_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>

        {/* Date range */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f9fafb', borderRadius: 7, padding: '4px 10px', border: '0.5px solid #e5e7eb' }}>
          <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
            style={{ border: 'none', outline: 'none', fontSize: 11, color: '#374151', background: 'transparent' }} />
          <span style={{ fontSize: 11, color: '#9ca3af' }}>to</span>
          <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
            style={{ border: 'none', outline: 'none', fontSize: 11, color: '#374151', background: 'transparent' }} />
          {(fromDate || toDate) && (
            <button onClick={() => { setFromDate(''); setToDate('') }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 12, padding: 0 }}>✕</button>
          )}
        </div>

        <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 'auto' }}>{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Log table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>
          <div style={{ fontSize: 28, marginBottom: 10 }}>⏳</div>
          <div style={{ fontSize: 13 }}>Loading audit log…</div>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e5e7eb', padding: '60px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
          <div style={{ fontSize: 13, fontWeight: 500, color: '#6b7280', marginBottom: 4 }}>No audit log entries</div>
          <div style={{ fontSize: 12, color: '#9ca3af' }}>{search || category !== 'all' || fromDate || toDate ? 'Try adjusting your filters' : 'Actions will appear here as agents use the platform'}</div>
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e5e7eb', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                {['Time (SGT)', 'User', 'Action', 'Entity', 'Details', ''].map(h => (
                  <th key={h} style={{ padding: '10px 14px', fontSize: 10, fontWeight: 600, color: '#9ca3af', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '0.5px solid #f1f4f9', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 200).map(log => {
                const meta = ACTION_META[log.action] || { label: log.action?.replace(/_/g, ' '), bg: '#f1f4f9', color: '#6b7280', icon: '📌' }
                const isExpanded = expandedId === log.id
                return [
                  <tr key={log.id} style={{ borderBottom: isExpanded ? 'none' : '0.5px solid #f9fafb', cursor: 'pointer' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                    onMouseLeave={e => e.currentTarget.style.background = isExpanded ? '#fafafa' : 'transparent'}
                    onClick={() => setExpandedId(isExpanded ? null : log.id)}>
                    <td style={{ padding: '11px 14px', fontSize: 11, color: '#9ca3af', whiteSpace: 'nowrap' }}>
                      {new Date(log.created_at).toLocaleString('en-GB', { timeZone: 'Asia/Singapore', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })}
                    </td>
                    <td style={{ padding: '11px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <div style={{ width: 26, height: 26, borderRadius: 7, background: '#f1f4f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#6b7280', flexShrink: 0 }}>
                          {(log.user_name || 'S')[0].toUpperCase()}
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 500, color: '#374151' }}>{log.user_name || 'System'}</span>
                      </div>
                    </td>
                    <td style={{ padding: '11px 14px' }}>
                      <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 6, background: meta.bg, color: meta.color, fontWeight: 600, whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <span>{meta.icon}</span>{meta.label}
                      </span>
                    </td>
                    <td style={{ padding: '11px 14px', fontSize: 11, color: '#6b7280' }}>
                      {log.entity_type && <span style={{ textTransform: 'capitalize' }}>{log.entity_type.replace(/_/g, ' ')}</span>}
                      {log.entity_id && <span style={{ color: '#9ca3af' }}> #{log.entity_id}</span>}
                    </td>
                    <td style={{ padding: '11px 14px', fontSize: 11, color: '#9ca3af', maxWidth: 200 }}>
                      {log.new_values ? (
                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block', maxWidth: 180 }}>
                          {JSON.stringify(log.new_values).slice(0, 50)}{JSON.stringify(log.new_values).length > 50 ? '…' : ''}
                        </span>
                      ) : '—'}
                    </td>
                    <td style={{ padding: '11px 14px' }}>
                      <span style={{ fontSize: 12, color: '#9ca3af' }}>{isExpanded ? '▲' : '▼'}</span>
                    </td>
                  </tr>,
                  isExpanded && (
                    <tr key={`${log.id}-detail`} style={{ borderBottom: '0.5px solid #f9fafb', background: '#fafafa' }}>
                      <td colSpan={6} style={{ padding: '0 14px 14px 14px' }}>
                        <div style={{ background: '#fff', borderRadius: 8, border: '0.5px solid #e5e7eb', padding: '12px 14px' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: log.old_values || log.new_values ? 12 : 0 }}>
                            <div>
                              <div style={{ fontSize: 10, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>Full Timestamp</div>
                              <div style={{ fontSize: 12, color: '#374151' }}>{fmtSGT(log.created_at)}</div>
                            </div>
                            <div>
                              <div style={{ fontSize: 10, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>Action</div>
                              <div style={{ fontSize: 12, color: '#374151' }}>{log.action?.replace(/_/g, ' ')}</div>
                            </div>
                            <div>
                              <div style={{ fontSize: 10, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>IP Address</div>
                              <div style={{ fontSize: 12, color: '#374151', fontFamily: 'monospace' }}>{log.ip_address || 'Not recorded'}</div>
                            </div>
                          </div>
                          {(log.old_values || log.new_values) && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                              {log.old_values && (
                                <div>
                                  <div style={{ fontSize: 10, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 6 }}>Before</div>
                                  <pre style={{ fontSize: 11, color: '#6b7280', background: '#f9fafb', borderRadius: 6, padding: '8px 10px', margin: 0, overflow: 'auto', fontFamily: 'monospace', lineHeight: 1.5 }}>
                                    {JSON.stringify(log.old_values, null, 2)}
                                  </pre>
                                </div>
                              )}
                              {log.new_values && (
                                <div>
                                  <div style={{ fontSize: 10, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 6 }}>After</div>
                                  <pre style={{ fontSize: 11, color: '#374151', background: '#f0fdf4', borderRadius: 6, padding: '8px 10px', margin: 0, overflow: 'auto', fontFamily: 'monospace', lineHeight: 1.5 }}>
                                    {JSON.stringify(log.new_values, null, 2)}
                                  </pre>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                ]
              })}
            </tbody>
          </table>

          {filtered.length > 200 && (
            <div style={{ padding: '12px 16px', background: '#f9fafb', borderTop: '0.5px solid #f1f4f9', fontSize: 11, color: '#9ca3af', textAlign: 'center' }}>
              Showing 200 of {filtered.length} entries. Export CSV to download the full audit log.
            </div>
          )}
        </div>
      )}
    </div>
  )
}