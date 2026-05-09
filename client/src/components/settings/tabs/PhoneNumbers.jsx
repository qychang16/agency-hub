import { useState, useEffect } from 'react'
import { useAuth } from '../../../context/AuthContext'
import { useApiSave } from '../../../hooks/useApiSave'
import { API } from '../../../utils/constants'
import { ACCENT, ACCENT_LIGHT, ACCENT_MID, NAVY } from '../../../utils/designTokens'
import Button from '../../ui/Button'

function Field({ label, hint, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: '#4a4742', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{label}</label>
      {hint && <div style={{ fontSize: 11, color: '#9a958c', marginBottom: 6 }}>{hint}</div>}
      {children}
    </div>
  )
}

function Input({ value, onChange, placeholder, type = 'text', disabled }) {
  return (
    <input type={type} value={value || ''} onChange={onChange} placeholder={placeholder} disabled={disabled}
      style={{ width: '100%', padding: '9px 12px', border: '0.5px solid #dcd8d0', borderRadius: 8, fontSize: 13, outline: 'none', background: disabled ? '#faf9f7' : '#fff', color: '#14130f', boxSizing: 'border-box' }} />
  )
}

function Toggle({ value, onChange, label, hint }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '0.5px solid #faf9f7' }}>
      <div>
        <div style={{ fontSize: 13, color: '#14130f', fontWeight: 500 }}>{label}</div>
        {hint && <div style={{ fontSize: 11, color: '#9a958c', marginTop: 2 }}>{hint}</div>}
      </div>
      <button onClick={() => onChange(!value)}
        style={{ width: 44, height: 24, borderRadius: 12, border: 'none', background: value ? ACCENT : '#c2bdb3', cursor: 'pointer', position: 'relative', transition: 'background .2s', flexShrink: 0 }}>
        <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: value ? 23 : 3, transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
      </button>
    </div>
  )
}

function Modal({ title, subtitle, onClose, children, width = 480 }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: width, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ padding: '18px 20px', borderBottom: '0.5px solid #f5f3ef', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#14130f' }}>{title}</div>
            {subtitle && <div style={{ fontSize: 11, color: '#9a958c', marginTop: 2 }}>{subtitle}</div>}
          </div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 7, border: '0.5px solid #dcd8d0', background: '#faf9f7', cursor: 'pointer', fontSize: 14, color: '#6e6a63', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>
        <div style={{ padding: 20 }}>{children}</div>
      </div>
    </div>
  )
}

function Card({ children, style }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #dcd8d0', padding: 20, marginBottom: 16, ...style }}>
      {children}
    </div>
  )
}

// Convert ISO timestamp to human-readable relative time. Falls back to
// the absolute date if older than 30 days.
function relativeTime(iso) {
  if (!iso) return 'never'
  const then = new Date(iso).getTime()
  const now = Date.now()
  const diffSec = Math.floor((now - then) / 1000)
  if (diffSec < 60) return 'just now'
  if (diffSec < 3600) return Math.floor(diffSec / 60) + 'm ago'
  if (diffSec < 86400) return Math.floor(diffSec / 3600) + 'h ago'
  if (diffSec < 86400 * 30) return Math.floor(diffSec / 86400) + 'd ago'
  return new Date(iso).toLocaleDateString()
}

// Returns true if the row needs an auto-refresh on tab mount.
function isStale(iso, hoursThreshold = 6) {
  if (!iso) return true
  const ageMs = Date.now() - new Date(iso).getTime()
  return ageMs > hoursThreshold * 3600 * 1000
}

// Map connection_status to UI styling (color, background, label).
function statusStyle(status) {
  switch (status) {
    case 'CONNECTED':
      return { bg: '#dcfce7', fg: '#15803d', label: 'Connected', dot: '#16a34a' }
    case 'TOKEN_INVALID':
      return { bg: '#fee2e2', fg: '#b91c1c', label: 'Token invalid', dot: '#dc2626' }
    case 'NUMBER_NOT_FOUND':
      return { bg: '#fef3c7', fg: '#92400e', label: 'Number not found', dot: '#d97706' }
    case 'RESTRICTED':
      return { bg: '#fee2e2', fg: '#b91c1c', label: 'Restricted by Meta', dot: '#dc2626' }
    case 'ERROR':
      return { bg: '#fef3c7', fg: '#92400e', label: 'Check failed', dot: '#d97706' }
    case 'UNCHECKED':
    default:
      return { bg: '#f5f3ef', fg: '#6e6a63', label: 'Not yet checked', dot: '#9a958c' }
  }
}

// Map quality_rating to color. Meta uses GREEN/YELLOW/RED, with UNKNOWN
// for new numbers without enough message history.
function qualityColor(rating) {
  switch (rating) {
    case 'GREEN': return '#16a34a'
    case 'YELLOW': return '#d97706'
    case 'RED': return '#dc2626'
    default: return '#9a958c'
  }
}

// Connection status block: renders inline beneath the main phone row.
// Takes a phone object plus a "checking" flag and an onCheckClick handler.
function ConnectionStatusBlock({ phone, checking, canManage, onCheckClick }) {
  const cs = phone.connection_status || 'UNCHECKED'
  const sty = statusStyle(cs)
  const stale = isStale(phone.last_connection_check_at, 24)
  const fadedColor = stale && cs !== 'UNCHECKED' ? 0.6 : 1

  return (
    <div style={{
      marginTop: 12,
      padding: '12px 14px',
      background: '#faf9f7',
      borderRadius: 10,
      border: '0.5px solid #ece8e0'
    }}>
      {/* Top row: status pill + last checked + button */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: cs === 'UNCHECKED' ? 0 : 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, padding: '3px 9px', borderRadius: 10, fontWeight: 700, background: sty.bg, color: sty.fg, display: 'inline-flex', alignItems: 'center', gap: 5, letterSpacing: '0.3px' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: sty.dot, display: 'inline-block' }} />
            {sty.label.toUpperCase()}
          </span>
          {phone.last_connection_check_at && (
            <span
              title={new Date(phone.last_connection_check_at).toLocaleString()}
              style={{ fontSize: 11, color: stale ? '#92400e' : '#9a958c' }}>
              Checked {relativeTime(phone.last_connection_check_at)}
              {stale && cs !== 'UNCHECKED' ? ' (stale)' : ''}
            </span>
          )}
          {checking && (
            <span style={{ fontSize: 11, color: '#6e6a63', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 10, height: 10, border: '1.5px solid #c2bdb3', borderTopColor: '#6e6a63', borderRadius: '50%', display: 'inline-block', animation: 'tcSpin 0.8s linear infinite' }} />
              Checking with Meta...
            </span>
          )}
        </div>
        {canManage && (
          <Button variant="secondary" size="sm" onClick={onCheckClick} disabled={checking}>
            {checking ? 'Checking...' : 'Test Connection'}
          </Button>
        )}
      </div>

      {/* Metadata grid: only shown when we have data */}
      {cs !== 'UNCHECKED' && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 10,
          opacity: fadedColor
        }}>
          <div style={{ background: '#fff', borderRadius: 8, padding: '8px 10px', border: '0.5px solid #ece8e0' }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#9a958c', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 3 }}>Quality</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: qualityColor(phone.quality_rating), display: 'flex', alignItems: 'center', gap: 5 }}>
              {phone.quality_rating && phone.quality_rating !== 'UNKNOWN' && (
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: qualityColor(phone.quality_rating), display: 'inline-block' }} />
              )}
              {phone.quality_rating || '—'}
            </div>
          </div>
          <div style={{ background: '#fff', borderRadius: 8, padding: '8px 10px', border: '0.5px solid #ece8e0' }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#9a958c', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 3 }}>Send Tier</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#14130f' }}>
              {phone.messaging_limit_tier ? phone.messaging_limit_tier.replace('TIER_', '') + '/24h' : '—'}
            </div>
          </div>
          <div style={{ background: '#fff', borderRadius: 8, padding: '8px 10px', border: '0.5px solid #ece8e0' }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#9a958c', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 3 }}>Display Name</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#14130f' }} title={phone.name_status || ''}>
              {phone.name_status === 'AVAILABLE_WITHOUT_REVIEW' ? 'Available' :
               phone.name_status === 'APPROVED' ? 'Approved' :
               phone.name_status === 'PENDING_REVIEW' ? 'Pending review' :
               phone.name_status === 'DECLINED' ? 'Declined' :
               phone.name_status || '—'}
            </div>
          </div>
        </div>
      )}

      {/* Error block: only when connection_error is set */}
      {phone.connection_error && (
        <div style={{
          marginTop: 10,
          padding: '10px 12px',
          background: '#fef2f2',
          border: '0.5px solid #fecaca',
          borderRadius: 8,
          fontSize: 12,
          color: '#b91c1c',
          display: 'flex',
          gap: 8
        }}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
            <circle cx="8" cy="8" r="6.5"/>
            <line x1="8" y1="5" x2="8" y2="9"/>
            <circle cx="8" cy="11.5" r="0.5" fill="currentColor"/>
          </svg>
          <div style={{ lineHeight: 1.5 }}><strong>Meta says:</strong> {phone.connection_error}</div>
        </div>
      )}
    </div>
  )
}

export default function PhoneNumbers() {
  const { token, hasPermission } = useAuth()
  const [numbers, setNumbers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [showEdit, setShowEdit] = useState(null)
  const [form, setForm] = useState({ number: '', display_name: '', whatsapp_phone_id: '', is_primary: false, owner_user_id: '', project_id: '' })
  const [agents, setAgents] = useState([])
  const [projects, setProjects] = useState([])
  // Per-phone in-flight check state, keyed by phone id. Lets multiple
  // checks run in parallel without blocking each other or the page.
  const [checking, setChecking] = useState({})
  // Hook handles save state, error capture, and UI feedback
  const { save: apiSave, saving, error: saveError, clearError } = useApiSave(token)

  useEffect(() => { load(); loadAgents(); loadProjects() }, [])

  // Lazy auto-check (Layer 2): when numbers load, check any phone whose
  // last_connection_check_at is null or older than 6 hours. Runs once
  // per load. Failures populate connection_error like a manual check.
  useEffect(() => {
    if (loading || numbers.length === 0) return
    const stalePhones = numbers.filter(n => isStale(n.last_connection_check_at, 6))
    stalePhones.forEach(n => {
      if (!checking[n.id]) checkConnection(n.id, { silent: true })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, numbers.length])

  // Update one phone in the list without refetching the whole list.
  // Used by checkConnection to merge connection metadata back in.
  function updatePhoneInState(id, patch) {
    setNumbers(prev => prev.map(p => p.id === id ? { ...p, ...patch } : p))
  }

  // Layer 1 (manual button) and Layer 2 (lazy auto) share this function.
  // silent=true suppresses error popups; manual clicks get an alert on
  // total failure (network etc.) but field-level errors always populate
  // connection_error like a normal failed-check result.
  async function checkConnection(phoneId, opts = {}) {
    const { silent = false } = opts
    setChecking(c => ({ ...c, [phoneId]: true }))
    try {
      const r = await fetch(`${API}/phone-numbers/${phoneId}/check-connection`, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }
      })
      if (!r.ok) {
        // 4xx/5xx with no useful body. Still update last_checked so we
        // don't loop forever on a broken endpoint.
        let body = {}
        try { body = await r.json() } catch {}
        if (!silent) alert('Connection check failed: ' + (body.error || ('HTTP ' + r.status)))
        // Patch row with an ERROR state so the UI shows what happened
        updatePhoneInState(phoneId, {
          connection_status: 'ERROR',
          connection_error: body.error || ('HTTP ' + r.status),
          last_connection_check_at: new Date().toISOString()
        })
        return
      }
      const updated = await r.json()
      // Server returns the full updated phone row — merge it in.
      updatePhoneInState(phoneId, updated)
    } catch (err) {
      if (!silent) alert('Connection check failed: ' + err.message)
      updatePhoneInState(phoneId, {
        connection_status: 'ERROR',
        connection_error: err.message,
        last_connection_check_at: new Date().toISOString()
      })
    } finally {
      setChecking(c => {
        const next = { ...c }
        delete next[phoneId]
        return next
      })
    }
  }

  async function loadAgents() {
    try {
      const r = await fetch(`${API}/agents`, { headers: { Authorization: 'Bearer ' + token } })
      const data = await r.json()
      setAgents(Array.isArray(data) ? data.filter(a => a.active) : [])
    } catch {}
  }

  async function loadProjects() {
    try {
      const r = await fetch(`${API}/projects`, { headers: { Authorization: 'Bearer ' + token } })
      const data = await r.json()
      setProjects(Array.isArray(data) ? data.filter(p => p.status === 'active') : [])
    } catch {}
  }

  async function load() {
    try {
      const r = await fetch(`${API}/phone-numbers`, { headers: { Authorization: 'Bearer ' + token } })
      const data = await r.json()
      setNumbers(Array.isArray(data) ? data : [])
    } catch {} finally { setLoading(false) }
  }

  async function save() {
    const url = showEdit ? `${API}/phone-numbers/${showEdit.id}` : `${API}/phone-numbers`
    const method = showEdit ? 'PATCH' : 'POST'
    const result = await apiSave(url, { method, body: form })
    if (!result.ok) return  // Hook already set error state for UI
    setShowAdd(false); setShowEdit(null)
    setForm({ number: '', display_name: '', whatsapp_phone_id: '', is_primary: false, owner_user_id: '', project_id: '' })
    load()
  }

  async function remove(id) {
    if (!confirm('Remove this phone number? All conversation history will be preserved.')) return
    const result = await apiSave(`${API}/phone-numbers/${id}`, { method: 'DELETE' })
    if (!result.ok) {
      alert('Failed to remove: ' + result.error)
      return
    }
    load()
  }

  async function setPrimary(id) {
    const result = await apiSave(`${API}/phone-numbers/${id}`, {
      method: 'PATCH',
      body: { is_primary: true }
    })
    if (!result.ok) {
      alert('Failed to set primary: ' + result.error)
      return
    }
    load()
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#14130f' }}>Phone Numbers</div>
          <div style={{ fontSize: 12, color: '#9a958c', marginTop: 3 }}>Manage WhatsApp numbers connected to your workspace. No limit on numbers.</div>
        </div>
        {hasPermission('manage_phone_numbers') && <Button onClick={() => { clearError(); setForm({ number: '', display_name: '', whatsapp_phone_id: '', is_primary: false, owner_user_id: '', project_id: '' }); setShowAdd(true) }}>+ Add Number</Button>}
      </div>

      {/* Info banner */}
      <div style={{ background: '#fffbeb', border: '0.5px solid #fde68a', borderRadius: 10, padding: '12px 16px', marginBottom: 20, display: 'flex', gap: 10 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M9 18h6"/><path d="M10 22h4"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0018 8 6 6 0 006 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 018.91 14"/></svg>
        <div style={{ fontSize: 12, color: '#92400e', lineHeight: 1.6 }}>
          <strong>Multiple numbers fully supported.</strong> Each number can have its own team, routing rules and business hours.
          If a number gets restricted by Meta, mark another as primary instantly — zero downtime for your team or candidates.
        </div>
      </div>

      {/* Scenario guide */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { iconKey: 'restricted', title: 'Number restricted?', desc: 'Mark backup as primary instantly. Conversations continue on new number.', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg> },
            { iconKey: 'multi', title: '1 agent, 2 numbers', desc: 'Assign agent to both lines. They see all conversations in one unified inbox.', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg> },
            { iconKey: 'regional', title: 'Regional offices', desc: 'SG, MY, ID, PH numbers each assigned to their local team.', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg> },
        ].map(s => (
          <div key={s.title} style={{ background: '#fff', borderRadius: 10, border: '0.5px solid #dcd8d0', padding: '14px 16px' }}>
            <div style={{ marginBottom: 6, color: 'currentColor', display: 'flex', alignItems: 'center' }}>{s.icon}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#14130f', marginBottom: 4 }}>{s.title}</div>
            <div style={{ fontSize: 11, color: '#9a958c', lineHeight: 1.5 }}>{s.desc}</div>
          </div>
        ))}
      </div>

      {/* Numbers list */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#9a958c' }}>Loading…</div>
      ) : numbers.length === 0 ? (
        <Card>
          <div style={{ textAlign: 'center', padding: '30px 0' }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#9a958c" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 12 }}><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/></svg>
            <div style={{ fontSize: 13, fontWeight: 500, color: '#6e6a63', marginBottom: 4 }}>No phone numbers added yet</div>
            <div style={{ fontSize: 12, color: '#9a958c', marginBottom: 16 }}>Add your WhatsApp Business number to start receiving messages</div>
            {hasPermission('manage_phone_numbers') && <Button onClick={() => { clearError(); setShowAdd(true) }}>+ Add First Number</Button>}
          </div>
        </Card>
      ) : (
        numbers.map(n => (
          <Card key={n.id} style={{ marginBottom: 10 }}>
            <div className="phone-number-card-row" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              {/* Icon */}
              <div style={{ width: 48, height: 48, borderRadius: 12, background: n.connected ? '#dcfce7' : n.status === 'restricted' ? '#fee2e2' : '#f5f3ef', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/></svg>
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, flexWrap: 'wrap' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#14130f' }}>{n.display_name || n.number}</div>
                  {n.is_primary && (
                    <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 10, background: ACCENT_LIGHT, color: '#2d2a7a', fontWeight: 700 }}>PRIMARY</span>
                  )}
                  <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 10, fontWeight: 600, background: n.connected ? '#dcfce7' : '#f5f3ef', color: n.connected ? '#16a34a' : '#9a958c' }}>
                    {n.connected ? '● Connected' : '○ Not connected'}
                  </span>
                  {n.status === 'restricted' && (
                    <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 10, background: '#fee2e2', color: '#dc2626', fontWeight: 600 }}>⚠ Restricted by Meta</span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, color: '#9a958c', fontFamily: 'monospace' }}>{n.number}</span>
                  {n.display_name && n.display_name !== n.number && (
                    <span style={{ fontSize: 11, color: '#9a958c' }}>Display: {n.display_name}</span>
                  )}
                  <span style={{ fontSize: 11, color: '#9a958c' }}>Daily limit: {n.daily_limit?.toLocaleString() || '1,000'} conversations</span>
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 4 }}>
                  {n.owner_name ? (
                    <span style={{ fontSize: 11, color: '#4a4742', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ color: '#9a958c' }}>Owner:</span> <strong>{n.owner_name}</strong>
                    </span>
                  ) : (
                    <span style={{ fontSize: 11, color: '#9a958c', fontStyle: 'italic' }}>No owner assigned</span>
                  )}
                  {n.project_name ? (
                    <span style={{ fontSize: 11, color: '#4a4742', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ color: '#9a958c' }}>Project:</span>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: n.project_colour || '#6e6a63', display: 'inline-block' }} />
                      <strong>{n.project_name}</strong>
                    </span>
                  ) : (
                    <span style={{ fontSize: 11, color: '#9a958c', fontStyle: 'italic' }}>Workspace-level (no project)</span>
                  )}
                </div>
              </div>

              {/* Actions */}
              {hasPermission('manage_phone_numbers') && (
              <div className="phone-number-card-actions" style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap' }}>
                {!n.is_primary && (
                  <Button variant="primary" size="sm" onClick={() => setPrimary(n.id)}>Set Primary</Button>
                )}
                <Button variant="secondary" size="sm" onClick={() => {
                  clearError()
                  setShowEdit(n)
                  setForm({ number: n.number, display_name: n.display_name || '', whatsapp_phone_id: n.whatsapp_phone_id || '', is_primary: n.is_primary, owner_user_id: n.owner_user_id || '', project_id: n.project_id || '' })
                }}>Edit</Button>
                {!n.is_primary && (
                  <Button variant="danger" size="sm" onClick={() => remove(n.id)}>Remove</Button>
                )}
              </div>
              )}
            </div>

            {/* Warning for restricted */}
            {n.status === 'restricted' && (
              <div style={{ marginTop: 12, padding: '10px 12px', background: '#fef2f2', border: '0.5px solid #fecaca', borderRadius: 8, fontSize: 12, color: '#dc2626', display: 'flex', gap: 8 }}>
                <span>⚠️</span>
                <div>
                  This number has been restricted by Meta. Candidates cannot receive messages on this number.
                  <strong> Set another number as primary immediately to avoid disruption.</strong>
                </div>
              </div>
            )}

            {/* Connection status (Unit 2C, Layers 1+2) */}
            <ConnectionStatusBlock
              phone={n}
              checking={!!checking[n.id]}
              canManage={hasPermission('manage_phone_numbers')}
              onCheckClick={() => checkConnection(n.id)}
            />
          </Card>
        ))
      )}

      {/* Add / Edit Modal */}
      {(showAdd || showEdit) && (
        <Modal
          title={showEdit ? 'Edit Phone Number' : 'Add Phone Number'}
          subtitle="Each number connects independently to Meta WhatsApp Business API"
          onClose={() => { setShowAdd(false); setShowEdit(null) }}>

          <Field label="Phone Number" hint="Full number with country code — e.g. +6591234567">
            <Input value={form.number} onChange={e => setForm(p => ({ ...p, number: e.target.value }))} placeholder="+6591234567" disabled={!!showEdit} />
          </Field>

          <Field label="Display Name" hint="Friendly name your agents will see — e.g. 'Main Line', 'SG Recruitment', 'KL Office'">
            <Input value={form.display_name} onChange={e => setForm(p => ({ ...p, display_name: e.target.value }))} placeholder="e.g. Main Line" />
          </Field>

          <Field label="WhatsApp Phone Number ID" hint="From Meta Business Manager → WhatsApp → Phone Numbers → Phone Number ID">
            <Input value={form.whatsapp_phone_id} onChange={e => setForm(p => ({ ...p, whatsapp_phone_id: e.target.value }))} placeholder="e.g. 123456789012345" />
          </Field>

          <Field label="Line Owner" hint="The staff member responsible for this number. They're the default assignee for new conversations.">
            <select
              value={form.owner_user_id || ''}
              onChange={e => setForm(p => ({ ...p, owner_user_id: e.target.value ? parseInt(e.target.value) : '' }))}
              style={{ width: '100%', padding: '9px 12px', border: '0.5px solid #dcd8d0', borderRadius: 8, fontSize: 13, outline: 'none', background: '#fff', color: '#14130f', boxSizing: 'border-box', cursor: 'pointer' }}>
              <option value="">— Unassigned —</option>
              {agents.map(a => <option key={a.id} value={a.id}>{a.name} ({a.email})</option>)}
            </select>
          </Field>

          <Field label="Project" hint="Tie this number to a specific client project. Leave blank for office/workspace-level lines (e.g. main reception).">
            <select
              value={form.project_id || ''}
              onChange={e => setForm(p => ({ ...p, project_id: e.target.value ? parseInt(e.target.value) : '' }))}
              style={{ width: '100%', padding: '9px 12px', border: '0.5px solid #dcd8d0', borderRadius: 8, fontSize: 13, outline: 'none', background: '#fff', color: '#14130f', boxSizing: 'border-box', cursor: 'pointer' }}>
              <option value="">— Workspace-level (no project) —</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.client_name} · {p.start_month} {p.start_year}</option>)}
            </select>
          </Field>

          <Toggle
            value={form.is_primary}
            onChange={v => setForm(p => ({ ...p, is_primary: v }))}
            label="Set as primary number"
            hint="Primary number handles all new conversations by default" />

          <div style={{ background: '#faf9f7', borderRadius: 8, padding: '10px 12px', fontSize: 11, color: '#6e6a63', marginTop: 12, marginBottom: 16, lineHeight: 1.6 }}>
            After adding, go to <strong>WhatsApp API</strong> tab to configure the API token and webhook for this number.
          </div>

          {saveError && (
            <div style={{ padding: '10px 12px', background: '#fef2f2', border: '0.5px solid #fecaca', borderRadius: 8, fontSize: 12, color: '#dc2626', marginBottom: 12, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
                <circle cx="8" cy="8" r="6.5"/>
                <line x1="8" y1="5" x2="8" y2="9"/>
                <circle cx="8" cy="11.5" r="0.5" fill="currentColor"/>
              </svg>
              <div>{saveError}</div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <Button variant="secondary" onClick={() => { clearError(); setShowAdd(false); setShowEdit(null) }} style={{ flex: 1 }}>Cancel</Button>
            <Button onClick={save} loading={saving} style={{ flex: 2 }}>{saving ? 'Saving...' : (showEdit ? 'Save Changes' : 'Add Number')}</Button>
          </div>
        </Modal>
      )}

      {/* Mobile: stack card row vertically below 640px so action buttons
          don't overlap the info block. Desktop layout (horizontal) is the
          default and stays untouched. */}
      <style>{`
        @keyframes tcSpin {
          to { transform: rotate(360deg); }
        }
        @media (max-width: 640px) {
          .phone-number-card-row {
            flex-direction: column;
            align-items: stretch !important;
          }
          .phone-number-card-actions {
            justify-content: flex-end;
            margin-top: 8px;
          }
        }
      `}</style>
    </div>
  )
}