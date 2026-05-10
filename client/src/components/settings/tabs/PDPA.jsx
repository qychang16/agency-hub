import { useState, useEffect } from 'react'
import { useAuth } from '../../../context/AuthContext'
import { useApiSave } from '../../../hooks/useApiSave'
import { API } from '../../../utils/constants'
import { ACCENT, ACCENT_LIGHT, NAVY } from '../../../utils/designTokens'

// Status display config — color, label, description for each effective status.
// Drives the dashboard stat cards AND the per-contact pill in the list.
const STATUS_CONFIG = {
  consented:     { label: 'Consented',     color: '#16a34a', bg: '#dcfce7', desc: 'Active consent on file' },
  expiring:      { label: 'Expiring',      color: '#d97706', bg: '#fef3c7', desc: 'Expires within 30 days' },
  expired:       { label: 'Expired',       color: '#b45309', bg: '#fef3c7', desc: 'Consent has expired' },
  withdrawn:     { label: 'Withdrawn',     color: '#dc2626', bg: '#fee2e2', desc: 'Contact withdrew consent' },
  pending:       { label: 'Pending',       color: '#6e6a63', bg: '#f5f3ef', desc: 'Awaiting confirmation' },
  not_consented: { label: 'Not Consented', color: '#9a958c', bg: '#faf9f7', desc: 'No consent record yet' },
}

// Method display labels for the consent collection method dropdown.
const METHOD_OPTIONS = [
  { value: 'manual',           label: 'Manual entry' },
  { value: 'inbound_whatsapp', label: 'Inbound WhatsApp opt-in' },
  { value: 'web_form',         label: 'Web form' },
  { value: 'csv_import',       label: 'CSV import' },
  { value: 'verbal',           label: 'Verbal (with notes)' },
]

function StatCard({ label, value, color, bg, desc, onClick, active, isMobile }) {
  return (
    <button onClick={onClick}
      style={{
        textAlign: 'left',
        padding: isMobile ? 12 : 16,
        background: active ? color + '18' : '#fff',
        border: `1.5px solid ${active ? color : '#dcd8d0'}`,
        borderRadius: 10, cursor: 'pointer',
        // Mobile: 2 per row via calc minus the gap. Desktop: as before.
        flex: isMobile ? '1 1 calc(50% - 5px)' : '1 1 140px',
        minWidth: isMobile ? 0 : 140,
        transition: 'all .12s'
      }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
        <span style={{ fontSize: 10, fontWeight: 600, color: color, textTransform: 'uppercase', letterSpacing: '0.4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      </div>
      <div style={{ fontSize: isMobile ? 20 : 24, fontWeight: 700, color: '#14130f', marginBottom: isMobile ? 0 : 2 }}>{value}</div>
      {/* Description hides on mobile — label + number is enough at a glance.
          Desktop has room to show the helper text. */}
      {!isMobile && (
        <div style={{ fontSize: 11, color: '#9a958c', lineHeight: 1.4 }}>{desc}</div>
      )}
    </button>
  )
}

function ConsentModal({ contact, history, onClose, onSaved, token }) {
  const [action, setAction] = useState('record_consent')  // record_consent | record_withdrawal
  const [method, setMethod] = useState('manual')
  const [notes, setNotes] = useState('')
  const [expiresMonths, setExpiresMonths] = useState(24)
  const { save: apiSave, saving, error } = useApiSave(token)

  async function submit() {
    const body = {
      contact_id: contact.id,
      status: action === 'record_consent' ? 'consented' : 'withdrawn',
      method,
      notes: notes.trim() || null,
    }
    if (action === 'record_consent') {
      body.expires_in_months = expiresMonths
    }
    const result = await apiSave(`${API}/pdpa/records`, { method: 'POST', body })
    if (!result.ok) return
    onSaved()
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' }}>
        {/* Header */}
        <div style={{ padding: '18px 20px', borderBottom: '0.5px solid #f5f3ef', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#14130f' }}>{contact.name || '(no name)'}</div>
            <div style={{ fontSize: 11, color: '#9a958c', marginTop: 2, fontFamily: 'monospace' }}>{contact.phone}</div>
          </div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 7, border: '0.5px solid #dcd8d0', background: '#faf9f7', cursor: 'pointer', fontSize: 14, color: '#6e6a63' }}>✕</button>
        </div>

        {/* History */}
        <div style={{ padding: 20, borderBottom: '0.5px solid #f5f3ef' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#9a958c', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 10 }}>Consent History</div>
          {history.length === 0 ? (
            <div style={{ padding: '20px 0', textAlign: 'center', fontSize: 12, color: '#9a958c' }}>
              No consent records yet
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {history.map(h => {
                const cfg = STATUS_CONFIG[h.status] || STATUS_CONFIG.pending
                return (
                  <div key={h.id} style={{ padding: '10px 12px', borderRadius: 8, background: '#faf9f7', border: '0.5px solid #f5f3ef' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 5, background: cfg.bg, color: cfg.color, fontWeight: 700 }}>
                        {cfg.label.toUpperCase()}
                      </span>
                      <span style={{ fontSize: 10, color: '#9a958c' }}>
                        {new Date(h.created_at).toLocaleString('en-SG', { dateStyle: 'medium', timeStyle: 'short' })}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: '#4a4742' }}>
                      Method: <strong>{(METHOD_OPTIONS.find(m => m.value === h.method) || {}).label || 'Manual entry'}</strong>
                      {h.collected_by_name && <> · Recorded by <strong>{h.collected_by_name}</strong></>}
                      {h.expires_at && <> · Expires {new Date(h.expires_at).toLocaleDateString('en-SG', { dateStyle: 'medium' })}</>}
                    </div>
                    {h.notes && (
                      <div style={{ fontSize: 11, color: '#6e6a63', marginTop: 6, fontStyle: 'italic' }}>{h.notes}</div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Action form */}
        <div style={{ padding: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#9a958c', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 10 }}>Record Action</div>

          {/* Action toggle */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            {[
              { value: 'record_consent',    label: 'Record Consent',    color: '#16a34a' },
              { value: 'record_withdrawal', label: 'Record Withdrawal', color: '#dc2626' },
            ].map(a => (
              <button key={a.value} onClick={() => setAction(a.value)}
                style={{
                  flex: 1, padding: '10px',
                  border: `1.5px solid ${action === a.value ? a.color : '#dcd8d0'}`,
                  background: action === a.value ? a.color + '18' : '#fff',
                  color: action === a.value ? a.color : '#6e6a63',
                  borderRadius: 8, cursor: 'pointer',
                  fontSize: 12, fontWeight: 600,
                }}>
                {a.label}
              </button>
            ))}
          </div>

          {/* Method dropdown */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#4a4742', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Method</label>
            <select value={method} onChange={e => setMethod(e.target.value)}
              style={{ width: '100%', padding: '9px 12px', border: '0.5px solid #dcd8d0', borderRadius: 8, fontSize: 13, outline: 'none', background: '#fff', color: '#14130f', boxSizing: 'border-box' }}>
              {METHOD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {/* Expiry only for consent */}
          {action === 'record_consent' && (
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#4a4742', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Consent valid for</label>
              <div style={{ display: 'flex', gap: 6 }}>
                {[12, 18, 24, 36].map(m => (
                  <button key={m} onClick={() => setExpiresMonths(m)}
                    style={{
                      flex: 1, padding: '7px',
                      border: `1px solid ${expiresMonths === m ? ACCENT : '#dcd8d0'}`,
                      background: expiresMonths === m ? ACCENT_LIGHT : '#fff',
                      color: expiresMonths === m ? ACCENT : '#6e6a63',
                      borderRadius: 6, cursor: 'pointer',
                      fontSize: 12, fontWeight: expiresMonths === m ? 600 : 500,
                    }}>
                    {m} months
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#4a4742', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Notes (optional)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
              placeholder={action === 'record_consent' ? 'e.g. Verbal consent during phone call on Tuesday' : 'e.g. Contact requested removal via email'}
              style={{ width: '100%', padding: '9px 12px', border: '0.5px solid #dcd8d0', borderRadius: 8, fontSize: 13, outline: 'none', background: '#fff', color: '#14130f', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }} />
          </div>

          {error && (
            <div style={{ padding: '10px 12px', background: '#fef2f2', border: '0.5px solid #fecaca', borderRadius: 8, fontSize: 12, color: '#dc2626', marginBottom: 12 }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose}
              style={{ flex: 1, padding: '10px', border: '0.5px solid #dcd8d0', background: 'transparent', color: '#6e6a63', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 500 }}>
              Cancel
            </button>
            <button onClick={submit} disabled={saving}
              style={{ flex: 2, padding: '10px', border: 'none', background: action === 'record_consent' ? '#16a34a' : '#dc2626', color: '#fff', borderRadius: 8, cursor: saving ? 'default' : 'pointer', fontSize: 12, fontWeight: 600, opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Recording…' : (action === 'record_consent' ? 'Record Consent' : 'Record Withdrawal')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function PDPA({ onNavigate }) {
  const { token, hasPermission } = useAuth()
  const [dashboard, setDashboard] = useState(null)
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [openContact, setOpenContact] = useState(null)
  const [openHistory, setOpenHistory] = useState([])
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth < 768)
  const [exporting, setExporting] = useState(false)

  // Download all PDPA records as CSV. Uses fetch + Blob + manual link click
  // to make the browser save the file with the server-provided filename.
  // We can't just navigate to the URL because that doesn't carry the auth
  // header — the browser would issue a no-auth GET and 401.
  async function exportCsv() {
    setExporting(true)
    try {
      const r = await fetch(`${API}/pdpa/export`, {
        headers: { Authorization: 'Bearer ' + token }
      })
      if (!r.ok) {
        const err = await r.json().catch(() => ({ error: 'Export failed' }))
        alert(err.error || 'Export failed')
        return
      }
      // Honour the server's content-disposition filename if available;
      // otherwise build a sensible default.
      const disposition = r.headers.get('content-disposition') || ''
      const match = disposition.match(/filename="([^"]+)"/)
      const filename = match ? match[1] : `pdpa-records_${new Date().toISOString().slice(0, 10)}.csv`
      const blob = await r.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      alert('Export failed: ' + err.message)
    } finally {
      setExporting(false)
    }
  }

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    if (!token) return
    loadAll()
  }, [token])

  async function loadAll() {
    setLoading(true)
    try {
      const [d, c] = await Promise.all([
        fetch(`${API}/pdpa/dashboard`, { headers: { Authorization: 'Bearer ' + token } }).then(r => r.json()),
        fetch(`${API}/pdpa/contacts`, { headers: { Authorization: 'Bearer ' + token } }).then(r => r.json()),
      ])
      if (d && !d.error) setDashboard(d)
      if (Array.isArray(c)) setContacts(c)
    } catch {} finally {
      setLoading(false)
    }
  }

  async function openContactDetail(contact) {
    setOpenContact(contact)
    setOpenHistory([])
    try {
      const r = await fetch(`${API}/pdpa/contacts/${contact.id}/history`, { headers: { Authorization: 'Bearer ' + token } })
      const data = await r.json()
      if (Array.isArray(data)) setOpenHistory(data)
    } catch {}
  }

  // Filter contacts by search + status filter
  const filtered = contacts.filter(c => {
    if (filter !== 'all' && c.effective_status !== filter) return false
    if (search) {
      const s = search.toLowerCase()
      const name = (c.name || '').toLowerCase()
      const phone = (c.phone || '').toLowerCase()
      const email = (c.email || '').toLowerCase()
      if (!name.includes(s) && !phone.includes(s) && !email.includes(s)) return false
    }
    return true
  })

  const canManage = hasPermission('manage_pdpa')

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#faf9f7' }}>
      {/* Header */}
      <div style={{ padding: '20px 28px 16px', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 auto', minWidth: 0 }}>
          {onNavigate && (
            <button onClick={() => onNavigate('contacts')}
              className="md:hidden"
              style={{ background: '#fff', border: '0.5px solid #dcd8d0', color: '#4a4742', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 5, marginBottom: 12 }}>
              ← Back to Contacts
            </button>
          )}
          <div style={{ fontSize: 22, fontWeight: 700, color: '#14130f', marginBottom: 4, letterSpacing: '-0.3px' }}>PDPA Compliance</div>
          <div style={{ fontSize: 12, color: '#6e6a63' }}>
            Track and audit consent for every contact in your workspace. Required for Singapore PDPA compliance.
          </div>
        </div>
        {canManage && (
          <button onClick={exportCsv} disabled={exporting}
            style={{
              padding: '9px 14px', borderRadius: 8,
              border: '0.5px solid #dcd8d0', background: '#fff', color: '#4a4742',
              cursor: exporting ? 'default' : 'pointer',
              fontSize: 12, fontWeight: 500,
              display: 'inline-flex', alignItems: 'center', gap: 6,
              flexShrink: 0,
              opacity: exporting ? 0.6 : 1,
            }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            {exporting ? 'Exporting…' : 'Export Records'}
          </button>
        )}
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 28px 28px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#9a958c' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#9a958c" strokeWidth="2" strokeLinecap="round" style={{ marginBottom: 10, animation: 'spin 0.9s linear infinite' }}><path d="M21 12a9 9 0 11-6.219-8.56"/></svg>
            <div style={{ fontSize: 12 }}>Loading consent data…</div>
          </div>
        ) : (
          <>
            {/* Stat cards row */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
              <StatCard label="All Contacts" value={dashboard?.total_contacts || 0}
                color={NAVY} bg="#f5f3ef" desc="Total in workspace"
                onClick={() => setFilter('all')} active={filter === 'all'} isMobile={isMobile} />
              <StatCard label="Consented" value={dashboard?.consented || 0}
                color={STATUS_CONFIG.consented.color} bg={STATUS_CONFIG.consented.bg} desc={STATUS_CONFIG.consented.desc}
                onClick={() => setFilter('consented')} active={filter === 'consented'} isMobile={isMobile} />
              <StatCard label="Expiring" value={dashboard?.expiring || 0}
                color={STATUS_CONFIG.expiring.color} bg={STATUS_CONFIG.expiring.bg} desc={STATUS_CONFIG.expiring.desc}
                onClick={() => setFilter('expiring')} active={filter === 'expiring'} isMobile={isMobile} />
              <StatCard label="Expired" value={dashboard?.expired || 0}
                color={STATUS_CONFIG.expired.color} bg={STATUS_CONFIG.expired.bg} desc={STATUS_CONFIG.expired.desc}
                onClick={() => setFilter('expired')} active={filter === 'expired'} isMobile={isMobile} />
              <StatCard label="Withdrawn" value={dashboard?.withdrawn || 0}
                color={STATUS_CONFIG.withdrawn.color} bg={STATUS_CONFIG.withdrawn.bg} desc={STATUS_CONFIG.withdrawn.desc}
                onClick={() => setFilter('withdrawn')} active={filter === 'withdrawn'} isMobile={isMobile} />
              <StatCard label="Not Consented" value={dashboard?.not_consented || 0}
                color={STATUS_CONFIG.not_consented.color} bg={STATUS_CONFIG.not_consented.bg} desc={STATUS_CONFIG.not_consented.desc}
                onClick={() => setFilter('not_consented')} active={filter === 'not_consented'} isMobile={isMobile} />
            </div>

            {/* Search */}
            <div style={{ marginBottom: 14 }}>
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search by name, phone, or email…"
                style={{ width: '100%', padding: '10px 14px', border: '0.5px solid #dcd8d0', borderRadius: 8, fontSize: 13, outline: 'none', background: '#fff', color: '#14130f', boxSizing: 'border-box' }} />
            </div>

            {/* Active filter indicator */}
            {filter !== 'all' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontSize: 12, color: '#6e6a63' }}>
                <span>Filtered by:</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 16, background: STATUS_CONFIG[filter]?.bg, color: STATUS_CONFIG[filter]?.color, fontWeight: 600, fontSize: 11 }}>
                  {STATUS_CONFIG[filter]?.label}
                  <button onClick={() => setFilter('all')} style={{ border: 'none', background: 'transparent', color: 'inherit', cursor: 'pointer', padding: 0, fontSize: 14, lineHeight: 1 }}>×</button>
                </span>
                <span style={{ color: '#9a958c' }}>{filtered.length} contact{filtered.length !== 1 ? 's' : ''}</span>
              </div>
            )}

            {/* Contact list */}
            {filtered.length === 0 ? (
              <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #dcd8d0', padding: '50px 20px', textAlign: 'center' }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#9a958c" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 12 }}>
                  <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
                </svg>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#6e6a63', marginBottom: 4 }}>No contacts match</div>
                <div style={{ fontSize: 12, color: '#9a958c' }}>Try a different filter or search term</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {filtered.map(c => {
                  const cfg = STATUS_CONFIG[c.effective_status] || STATUS_CONFIG.not_consented
                  return (
                    <div key={c.id} onClick={() => openContactDetail(c)}
                      style={{
                        background: '#fff', borderRadius: 10, border: '0.5px solid #dcd8d0',
                        padding: 14, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 12,
                        transition: 'all .12s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#faf9f7'}
                      onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                      {/* Avatar */}
                      <div style={{ width: 36, height: 36, borderRadius: 9, background: '#faf9f7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 600, color: '#6e6a63', flexShrink: 0 }}>
                        {(c.name || '?').slice(0, 1).toUpperCase()}
                      </div>

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#14130f', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {c.name || '(no name)'}
                        </div>
                        <div style={{ fontSize: 11, color: '#9a958c', fontFamily: 'monospace', marginTop: 2 }}>
                          {c.phone || '—'}
                        </div>
                      </div>

                      {/* Status pill */}
                      <div style={{ flexShrink: 0, textAlign: 'right' }}>
                        <span style={{ fontSize: 10, padding: '3px 9px', borderRadius: 12, background: cfg.bg, color: cfg.color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                          {cfg.label}
                        </span>
                        {c.expires_at && c.effective_status === 'consented' && (
                          <div style={{ fontSize: 10, color: '#9a958c', marginTop: 4 }}>
                            Expires {new Date(c.expires_at).toLocaleDateString('en-SG', { dateStyle: 'medium' })}
                          </div>
                        )}
                        {c.expires_at && c.effective_status === 'expiring' && (
                          <div style={{ fontSize: 10, color: STATUS_CONFIG.expiring.color, marginTop: 4, fontWeight: 600 }}>
                            Expires {new Date(c.expires_at).toLocaleDateString('en-SG', { dateStyle: 'medium' })}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Contact detail modal */}
      {openContact && canManage && (
        <ConsentModal contact={openContact} history={openHistory}
          onClose={() => setOpenContact(null)}
          onSaved={loadAll}
          token={token} />
      )}
    </div>
  )
}