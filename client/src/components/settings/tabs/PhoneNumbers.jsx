import { useState, useEffect } from 'react'
import { useAuth } from '../../../context/AuthContext'
import { API, ACCENT, ACCENT_LIGHT, ACCENT_MID, NAVY } from '../../../utils/constants'

function Field({ label, hint, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{label}</label>
      {hint && <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 6 }}>{hint}</div>}
      {children}
    </div>
  )
}

function Input({ value, onChange, placeholder, type = 'text', disabled }) {
  return (
    <input type={type} value={value || ''} onChange={onChange} placeholder={placeholder} disabled={disabled}
      style={{ width: '100%', padding: '9px 12px', border: '0.5px solid #e5e7eb', borderRadius: 8, fontSize: 13, outline: 'none', background: disabled ? '#f9fafb' : '#fff', color: '#111827', boxSizing: 'border-box' }} />
  )
}

function Toggle({ value, onChange, label, hint }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '0.5px solid #f9fafb' }}>
      <div>
        <div style={{ fontSize: 13, color: '#111827', fontWeight: 500 }}>{label}</div>
        {hint && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{hint}</div>}
      </div>
      <button onClick={() => onChange(!value)}
        style={{ width: 44, height: 24, borderRadius: 12, border: 'none', background: value ? ACCENT : '#d1d5db', cursor: 'pointer', position: 'relative', transition: 'background .2s', flexShrink: 0 }}>
        <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: value ? 23 : 3, transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
      </button>
    </div>
  )
}

function Btn({ onClick, children, variant = 'primary', size = 'md', disabled }) {
  const sizes = { sm: { padding: '5px 12px', fontSize: 11 }, md: { padding: '8px 16px', fontSize: 12 }, lg: { padding: '10px 20px', fontSize: 13 } }
  const variants = {
    primary: { background: ACCENT, color: '#fff', border: 'none' },
    ghost: { background: 'transparent', color: '#6b7280', border: '0.5px solid #e5e7eb' },
    danger: { background: '#fee2e2', color: '#dc2626', border: '0.5px solid #fca5a5' },
    dark: { background: NAVY, color: '#fff', border: 'none' },
  }
  return (
    <button onClick={!disabled ? onClick : undefined} disabled={disabled}
      style={{ ...sizes[size], ...variants[variant], borderRadius: 8, cursor: disabled ? 'default' : 'pointer', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 6, opacity: disabled ? 0.6 : 1, transition: 'opacity .15s' }}>
      {children}
    </button>
  )
}

function Modal({ title, subtitle, onClose, children, width = 480 }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: width, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ padding: '18px 20px', borderBottom: '0.5px solid #f1f4f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{title}</div>
            {subtitle && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{subtitle}</div>}
          </div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 7, border: '0.5px solid #e5e7eb', background: '#f9fafb', cursor: 'pointer', fontSize: 14, color: '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>
        <div style={{ padding: 20 }}>{children}</div>
      </div>
    </div>
  )
}

function Card({ children, style }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e5e7eb', padding: 20, marginBottom: 16, ...style }}>
      {children}
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

  useEffect(() => { load(); loadAgents(); loadProjects() }, [])

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
    try {
      const url = showEdit ? `${API}/phone-numbers/${showEdit.id}` : `${API}/phone-numbers`
      const method = showEdit ? 'PATCH' : 'POST'
      await fetch(url, { method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify(form) })
      setShowAdd(false); setShowEdit(null)
      setForm({ number: '', display_name: '', whatsapp_phone_id: '', is_primary: false, owner_user_id: '', project_id: '' })
      load()
    } catch {}
  }

  async function remove(id) {
    if (!confirm('Remove this phone number? All conversation history will be preserved.')) return
    await fetch(`${API}/phone-numbers/${id}`, { method: 'DELETE', headers: { Authorization: 'Bearer ' + token } })
    load()
  }

  async function setPrimary(id) {
    await fetch(`${API}/phone-numbers/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ is_primary: true }) })
    load()
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>Phone Numbers</div>
          <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 3 }}>Manage WhatsApp numbers connected to your workspace. No limit on numbers.</div>
        </div>
        {hasPermission('manage_phone_numbers') && <Btn onClick={() => { setForm({ number: '', display_name: '', whatsapp_phone_id: '', is_primary: false, owner_user_id: '', project_id: '' }); setShowAdd(true) }}>+ Add Number</Btn>}
      </div>

      {/* Info banner */}
      <div style={{ background: '#fffbeb', border: '0.5px solid #fde68a', borderRadius: 10, padding: '12px 16px', marginBottom: 20, display: 'flex', gap: 10 }}>
        <span style={{ fontSize: 16, flexShrink: 0 }}>💡</span>
        <div style={{ fontSize: 12, color: '#92400e', lineHeight: 1.6 }}>
          <strong>Multiple numbers fully supported.</strong> Each number can have its own team, routing rules and business hours.
          If a number gets restricted by Meta, mark another as primary instantly — zero downtime for your team or candidates.
        </div>
      </div>

      {/* Scenario guide */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { icon: '🔄', title: 'Number restricted?', desc: 'Mark backup as primary instantly. Conversations continue on new number.' },
          { icon: '👥', title: '1 agent, 2 numbers', desc: 'Assign agent to both lines. They see all conversations in one unified inbox.' },
          { icon: '🌏', title: 'Regional offices', desc: 'SG, MY, ID, PH numbers each assigned to their local team.' },
        ].map(s => (
          <div key={s.title} style={{ background: '#fff', borderRadius: 10, border: '0.5px solid #e5e7eb', padding: '14px 16px' }}>
            <div style={{ fontSize: 20, marginBottom: 6 }}>{s.icon}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#111827', marginBottom: 4 }}>{s.title}</div>
            <div style={{ fontSize: 11, color: '#9ca3af', lineHeight: 1.5 }}>{s.desc}</div>
          </div>
        ))}
      </div>

      {/* Numbers list */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>Loading…</div>
      ) : numbers.length === 0 ? (
        <Card>
          <div style={{ textAlign: 'center', padding: '30px 0' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📱</div>
            <div style={{ fontSize: 13, fontWeight: 500, color: '#6b7280', marginBottom: 4 }}>No phone numbers added yet</div>
            <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 16 }}>Add your WhatsApp Business number to start receiving messages</div>
            {hasPermission('manage_phone_numbers') && <Btn onClick={() => setShowAdd(true)}>+ Add First Number</Btn>}
          </div>
        </Card>
      ) : (
        numbers.map(n => (
          <Card key={n.id} style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              {/* Icon */}
              <div style={{ width: 48, height: 48, borderRadius: 12, background: n.connected ? '#dcfce7' : n.status === 'restricted' ? '#fee2e2' : '#f1f4f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
                📱
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, flexWrap: 'wrap' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{n.display_name || n.number}</div>
                  {n.is_primary && (
                    <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 10, background: ACCENT_MID, color: '#1e40af', fontWeight: 700 }}>PRIMARY</span>
                  )}
                  <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 10, fontWeight: 600, background: n.connected ? '#dcfce7' : '#f1f4f9', color: n.connected ? '#16a34a' : '#9ca3af' }}>
                    {n.connected ? '● Connected' : '○ Not connected'}
                  </span>
                  {n.status === 'restricted' && (
                    <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 10, background: '#fee2e2', color: '#dc2626', fontWeight: 600 }}>⚠ Restricted by Meta</span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, color: '#9ca3af', fontFamily: 'monospace' }}>{n.number}</span>
                  {n.display_name && n.display_name !== n.number && (
                    <span style={{ fontSize: 11, color: '#9ca3af' }}>Display: {n.display_name}</span>
                  )}
                  <span style={{ fontSize: 11, color: '#9ca3af' }}>Daily limit: {n.daily_limit?.toLocaleString() || '1,000'} conversations</span>
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 4 }}>
                  {n.owner_name ? (
                    <span style={{ fontSize: 11, color: '#374151', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ color: '#9ca3af' }}>Owner:</span> <strong>{n.owner_name}</strong>
                    </span>
                  ) : (
                    <span style={{ fontSize: 11, color: '#9ca3af', fontStyle: 'italic' }}>No owner assigned</span>
                  )}
                  {n.project_name ? (
                    <span style={{ fontSize: 11, color: '#374151', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ color: '#9ca3af' }}>Project:</span>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: n.project_colour || '#6b7280', display: 'inline-block' }} />
                      <strong>{n.project_name}</strong>
                    </span>
                  ) : (
                    <span style={{ fontSize: 11, color: '#9ca3af', fontStyle: 'italic' }}>Workspace-level (no project)</span>
                  )}
                </div>
              </div>

              {/* Actions */}
              {hasPermission('manage_phone_numbers') && (
              <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap' }}>
                {!n.is_primary && (
                  <Btn variant="dark" size="sm" onClick={() => setPrimary(n.id)}>Set Primary</Btn>
                )}
                <Btn variant="ghost" size="sm" onClick={() => {
                  setShowEdit(n)
                  setForm({ number: n.number, display_name: n.display_name || '', whatsapp_phone_id: n.whatsapp_phone_id || '', is_primary: n.is_primary, owner_user_id: n.owner_user_id || '', project_id: n.project_id || '' })
                }}>Edit</Btn>
                {!n.is_primary && (
                  <Btn variant="danger" size="sm" onClick={() => remove(n.id)}>Remove</Btn>
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
              style={{ width: '100%', padding: '9px 12px', border: '0.5px solid #e5e7eb', borderRadius: 8, fontSize: 13, outline: 'none', background: '#fff', color: '#111827', boxSizing: 'border-box', cursor: 'pointer' }}>
              <option value="">— Unassigned —</option>
              {agents.map(a => <option key={a.id} value={a.id}>{a.name} ({a.email})</option>)}
            </select>
          </Field>

          <Field label="Project" hint="Tie this number to a specific client project. Leave blank for office/workspace-level lines (e.g. main reception).">
            <select
              value={form.project_id || ''}
              onChange={e => setForm(p => ({ ...p, project_id: e.target.value ? parseInt(e.target.value) : '' }))}
              style={{ width: '100%', padding: '9px 12px', border: '0.5px solid #e5e7eb', borderRadius: 8, fontSize: 13, outline: 'none', background: '#fff', color: '#111827', boxSizing: 'border-box', cursor: 'pointer' }}>
              <option value="">— Workspace-level (no project) —</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.client_name} · {p.start_month} {p.start_year}</option>)}
            </select>
          </Field>

          <Toggle
            value={form.is_primary}
            onChange={v => setForm(p => ({ ...p, is_primary: v }))}
            label="Set as primary number"
            hint="Primary number handles all new conversations by default" />

          <div style={{ background: '#f9fafb', borderRadius: 8, padding: '10px 12px', fontSize: 11, color: '#6b7280', marginTop: 12, marginBottom: 16, lineHeight: 1.6 }}>
            After adding, go to <strong>WhatsApp API</strong> tab to configure the API token and webhook for this number.
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <Btn variant="ghost" onClick={() => { setShowAdd(false); setShowEdit(null) }} style={{ flex: 1 }}>Cancel</Btn>
            <Btn onClick={save} style={{ flex: 2 }}>{showEdit ? 'Save Changes' : 'Add Number'}</Btn>
          </div>
        </Modal>
      )}
    </div>
  )
}