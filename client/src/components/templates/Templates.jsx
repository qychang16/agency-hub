import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { API } from '../../utils/constants'
import { ACCENT, ACCENT_LIGHT, NAVY } from '../../utils/designTokens'

function IPhonePreview({ body, buttons = [] }) {
  const now = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
  const highlighted = (body || '').replace(/\{\{(\w+)\}\}/g, (_, v) =>
    `<span style="background:#eeedf5;color:#2d2a7a;padding:1px 4px;border-radius:3px;font-weight:600;font-size:11px;">{{${v}}}</span>`
  )
  return (
    <div style={{ width: 240, flexShrink: 0 }}>
      <div style={{ width: 240, background: '#111', borderRadius: 36, padding: '10px 5px 14px', boxShadow: '0 20px 40px rgba(0,0,0,0.4)' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
          <div style={{ width: 80, height: 22, background: '#000', borderRadius: 20 }} />
        </div>
        <div style={{ background: '#ece5dd', borderRadius: 26, overflow: 'hidden', height: 460, display: 'flex', flexDirection: 'column' }}>
          <div style={{ background: '#075e54', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#128c7e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 10, color: '#fff', fontWeight: 700 }}>TC</span>
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#fff', fontWeight: 600 }}>Tel-Cloud</div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.75)' }}>online</div>
            </div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '10px 8px 8px' }}>
            <div style={{ textAlign: 'center', marginBottom: 8 }}>
              <span style={{ background: 'rgba(0,0,0,0.18)', color: '#fff', fontSize: 10, padding: '3px 10px', borderRadius: 10 }}>Today</span>
            </div>
            <div style={{ maxWidth: '90%' }}>
              <div style={{ background: '#fff', borderRadius: 8, borderTopLeftRadius: 2, padding: '8px 10px', boxShadow: '0 1px 2px rgba(0,0,0,0.12)' }}>
                {body
                  ? <div style={{ fontSize: 11, color: '#111', lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }} dangerouslySetInnerHTML={{ __html: highlighted }} />
                  : <div style={{ fontSize: 11, color: '#aaa', fontStyle: 'italic' }}>Your message will appear here…</div>}
                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 3, marginTop: 5 }}>
                  <span style={{ fontSize: 10, color: '#999' }}>{now}</span>
                  <svg width="14" height="10" viewBox="0 0 18 10"><path d="M1 5l3 3 7-7" stroke="#53bdeb" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/><path d="M6 5l3 3 7-7" stroke="#53bdeb" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
              </div>
              {buttons.length > 0 && (
                <div style={{ marginTop: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {buttons.map((b, i) => (
                    <div key={i} style={{ background: '#fff', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                      <span style={{ fontSize: 12, color: '#128c7e', fontWeight: 600 }}>{b.label || 'Button'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div style={{ background: '#f0f0f0', padding: '6px 8px', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <div style={{ flex: 1, background: '#fff', borderRadius: 18, padding: '5px 10px', fontSize: 10, color: '#aaa' }}>Message</div>
            <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#075e54', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="white"><path d="M2 21l21-9L2 3v7l15 2-15 2v7z"/></svg>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}>
          <div style={{ width: 80, height: 4, background: 'rgba(255,255,255,0.25)', borderRadius: 2 }} />
        </div>
      </div>
    </div>
  )
}

function Btn({ onClick, children, variant = 'primary', size = 'md', disabled, style: extra }) {
  const sizes = { sm: { padding: '5px 10px', fontSize: 11 }, md: { padding: '8px 14px', fontSize: 12 } }
  const variants = {
    primary: { background: ACCENT, color: '#fff', border: 'none' },
    ghost: { background: 'transparent', color: '#6e6a63', border: '0.5px solid #dcd8d0' },
    danger: { background: '#fee2e2', color: '#dc2626', border: '0.5px solid #fca5a5' },
    dark: { background: NAVY, color: '#fff', border: 'none' },
    success: { background: '#dcfce7', color: '#16a34a', border: '0.5px solid #86efac' },
  }
  return (
    <button onClick={!disabled ? onClick : undefined}
      style={{ ...sizes[size], ...variants[variant], borderRadius: 8, cursor: disabled ? 'default' : 'pointer', fontWeight: 500, opacity: disabled ? 0.6 : 1, display: 'inline-flex', alignItems: 'center', gap: 6, ...extra }}>
      {children}
    </button>
  )
}

function Modal({ title, subtitle, onClose, children, width = 860 }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: width, maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '18px 24px', borderBottom: '0.5px solid #f5f3ef', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#14130f' }}>{title}</div>
            {subtitle && <div style={{ fontSize: 11, color: '#9a958c', marginTop: 2 }}>{subtitle}</div>}
          </div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 7, border: '0.5px solid #dcd8d0', background: '#faf9f7', cursor: 'pointer', fontSize: 14, color: '#6e6a63', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>{children}</div>
      </div>
    </div>
  )
}

const CATEGORIES = [
  { value: 'utility', label: 'Utility', desc: 'Transactional — confirmations, reminders, updates' },
  { value: 'marketing', label: 'Marketing', desc: 'Promotional — job alerts, opportunities' },
  { value: 'authentication', label: 'Authentication', desc: 'OTP and verification messages' },
]

const STATUS_STYLES = {
  approved: { bg: '#dcfce7', color: '#16a34a', label: '✓ Approved' },
  pending: { bg: '#fef3c7', color: '#92400e', label: '⏳ Pending' },
  draft: { bg: '#f5f3ef', color: '#6e6a63', label: '✏ Draft' },
  rejected: { bg: '#fee2e2', color: '#dc2626', label: '✗ Rejected' },
}

function TemplateEditor({ template, onClose, onSaved }) {
  const { token, user } = useAuth()
  const [name, setName] = useState(template?.name || '')
  const [category, setCategory] = useState(template?.category || 'utility')
  const [body, setBody] = useState(template?.body || '')
  const [buttons, setButtons] = useState(template?.buttons || [])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const isEdit = !!template

  function addButton() {
    if (buttons.length >= 3) return
    setButtons(p => [...p, { type: 'quick_reply', label: '' }])
  }

  function updateButton(i, field, val) {
    setButtons(p => p.map((b, idx) => idx === i ? { ...b, [field]: val } : b))
  }

  function removeButton(i) {
    setButtons(p => p.filter((_, idx) => idx !== i))
  }

  function insertVariable(v) {
    setBody(p => p + `{{${v}}}`)
  }

  async function save(status) {
    setError('')
    if (!name.trim()) { setError('Template name is required'); return }
    if (!body.trim()) { setError('Message body is required'); return }
    setSaving(true)
    try {
      const url = isEdit ? `${API}/templates/${template.id}` : `${API}/templates`
      const method = isEdit ? 'PATCH' : 'POST'
      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ name, category, body, buttons, status: status || (isEdit ? template.status : 'draft'), type: 'whatsapp' })
      })
      if (!r.ok) { const d = await r.json(); setError(d.error || 'Failed to save'); return }
      onSaved()
      onClose()
    } catch { setError('Failed to save. Please try again.') }
    finally { setSaving(false) }
  }

  const QUICK_VARS = ['name', 'role', 'company', 'date', 'time', 'venue', 'salary', 'deadline', 'start_date', 'hr_name', 'candidate']

  return (
    <Modal
      title={isEdit ? `Edit — ${template.name}` : 'New Template'}
      subtitle="WhatsApp Business template — requires Meta approval before sending"
      onClose={onClose}>
      <div className="grid grid-cols-1 md:grid-cols-[1fr_260px]" style={{ gap: 24 }}>
        <div>
          <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#4a4742', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                Template Name <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                value={name}
                onChange={e => setName(e.target.value.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''))}
                placeholder="e.g. interview_confirmation"
                style={{ width: '100%', padding: '9px 12px', border: '0.5px solid #dcd8d0', borderRadius: 8, fontSize: 13, outline: 'none', background: '#fff', color: '#14130f', boxSizing: 'border-box', fontFamily: 'monospace' }} />
              <div style={{ fontSize: 10, color: '#9a958c', marginTop: 4 }}>Lowercase letters and underscores only</div>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#4a4742', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                Category <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <select value={category} onChange={e => setCategory(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', border: '0.5px solid #dcd8d0', borderRadius: 8, fontSize: 13, outline: 'none', background: '#fff', color: '#14130f' }}>
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label} — {c.desc}</option>)}
              </select>
            </div>
          </div>

          <div style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#4a4742', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                Message Body <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <span style={{ fontSize: 11, color: '#9a958c' }}>{body.length} characters</span>
            </div>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              rows={10}
              placeholder={'Dear {{name}},\n\nWe are pleased to confirm your interview for the position of {{role}} at {{company}}.\n\nDate: {{date}}\nTime: {{time}}\nVenue: {{venue}}\n\nWe look forward to meeting you.'}
              style={{ width: '100%', padding: '10px 12px', border: '0.5px solid #dcd8d0', borderRadius: 8, fontSize: 12, outline: 'none', background: '#fff', color: '#14130f', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box', lineHeight: 1.6 }} />
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: '#9a958c', marginBottom: 6 }}>Quick insert variable:</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {QUICK_VARS.map(v => (
                <button key={v} onClick={() => insertVariable(v)}
                  style={{ padding: '3px 9px', borderRadius: 6, border: '0.5px solid #dcd8d0', fontSize: 11, background: '#faf9f7', color: '#4a4742', cursor: 'pointer', fontFamily: 'monospace' }}>
                  {`{{${v}}}`}
                </button>
              ))}
            </div>
          </div>

          <div style={{ padding: '10px 12px', background: '#faf9f7', borderRadius: 8, border: '0.5px solid #dcd8d0', marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#4a4742', marginBottom: 6 }}>WhatsApp Formatting</div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {[['*bold*', 'Bold'], ['_italic_', 'Italic'], ['~strike~', 'Strikethrough'], ['`code`', 'Monospace']].map(([syntax, label]) => (
                <div key={label} style={{ fontSize: 11, color: '#6e6a63', display: 'flex', gap: 5, alignItems: 'center' }}>
                  <code style={{ background: '#dcd8d0', padding: '1px 5px', borderRadius: 3, fontSize: 10 }}>{syntax}</code>
                  <span>→ {label}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#4a4742', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                Buttons (optional, max 3)
              </label>
              {buttons.length < 3 && <Btn variant="ghost" size="sm" onClick={addButton}>+ Add Button</Btn>}
            </div>
            {buttons.map((b, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                <select value={b.type} onChange={e => updateButton(i, 'type', e.target.value)}
                  style={{ width: 140, padding: '8px 10px', border: '0.5px solid #dcd8d0', borderRadius: 7, fontSize: 12, outline: 'none', background: '#fff', color: '#14130f', flexShrink: 0 }}>
                  <option value="quick_reply">Quick Reply</option>
                  <option value="call_to_action">Call to Action</option>
                  <option value="phone">Phone Number</option>
                </select>
                <input value={b.label} onChange={e => updateButton(i, 'label', e.target.value)} placeholder="Button label"
                  style={{ flex: 1, padding: '8px 10px', border: '0.5px solid #dcd8d0', borderRadius: 7, fontSize: 12, outline: 'none', background: '#fff', color: '#14130f' }} />
                {b.type === 'call_to_action' && (
                  <input value={b.url || ''} onChange={e => updateButton(i, 'url', e.target.value)} placeholder="https://…"
                    style={{ flex: 1, padding: '8px 10px', border: '0.5px solid #dcd8d0', borderRadius: 7, fontSize: 12, outline: 'none', background: '#fff', color: '#14130f' }} />
                )}
                <button onClick={() => removeButton(i)}
                  style={{ width: 28, height: 28, borderRadius: 7, border: '0.5px solid #fca5a5', background: '#fee2e2', cursor: 'pointer', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>×</button>
              </div>
            ))}
          </div>

          {error && (
            <div style={{ padding: '10px 12px', background: '#fef2f2', border: '0.5px solid #fecaca', borderRadius: 8, fontSize: 12, color: '#dc2626', marginTop: 12 }}>
              ⚠ {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 20, paddingTop: 16, borderTop: '0.5px solid #f5f3ef' }}>
            <Btn variant="ghost" onClick={onClose} style={{ flex: 1 }}>Cancel</Btn>
            <Btn variant="ghost" onClick={() => save('draft')} disabled={saving} style={{ flex: 1 }}>Save as Draft</Btn>
            {(user?.role === 'director' || user?.role === 'manager') ? (
              <Btn onClick={() => save('approved')} disabled={saving} style={{ flex: 2 }}>
                {saving ? 'Saving…' : isEdit ? 'Save & Approve' : 'Create & Approve'}
              </Btn>
            ) : (
              <Btn onClick={() => save('pending')} disabled={saving} style={{ flex: 2 }}>
                {saving ? 'Saving…' : 'Submit for Approval'}
              </Btn>
            )}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#4a4742', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 12 }}>Live Preview</div>
          <IPhonePreview body={body} buttons={buttons} />
          <div style={{ marginTop: 12, fontSize: 11, color: '#9a958c', lineHeight: 1.5, textAlign: 'center' }}>
            Variables shown in blue will be replaced with actual data when sent
          </div>
        </div>
      </div>
    </Modal>
  )
}

const FILTER_TABS = [
  { key: 'all', label: 'All' },
  { key: 'approved', label: 'Approved' },
  { key: 'pending', label: 'Pending Approval' },
  { key: 'draft', label: 'Drafts' },
  { key: 'rejected', label: 'Rejected' },
]

export default function Templates() {
  const { token, user, hasPermission } = useAuth()
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('all')
  const [search, setSearch] = useState('')
  const [showEditor, setShowEditor] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState(null)
  const [previewTemplate, setPreviewTemplate] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const r = await fetch(`${API}/templates`, { headers: { Authorization: 'Bearer ' + token } })
      const data = await r.json()
      setTemplates(Array.isArray(data) ? data : [])
    } catch {} finally { setLoading(false) }
  }

  async function deleteTemplate(id) {
    if (!confirm('Delete this template? This cannot be undone.')) return
    await fetch(`${API}/templates/${id}`, { method: 'DELETE', headers: { Authorization: 'Bearer ' + token } })
    load()
  }

  async function approveTemplate(id) {
    await fetch(`${API}/templates/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ status: 'approved' })
    })
    load()
  }

  async function rejectTemplate(id) {
    await fetch(`${API}/templates/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ status: 'rejected' })
    })
    load()
  }

  const filtered = templates.filter(t => {
    const matchTab = activeTab === 'all' || t.status === activeTab
    const matchSearch = !search || t.name?.toLowerCase().includes(search.toLowerCase()) || t.body?.toLowerCase().includes(search.toLowerCase())
    return matchTab && matchSearch
  })

  const counts = {
    all: templates.length,
    approved: templates.filter(t => t.status === 'approved').length,
    pending: templates.filter(t => t.status === 'pending').length,
    draft: templates.filter(t => t.status === 'draft').length,
    rejected: templates.filter(t => t.status === 'rejected').length,
  }

  const canApprove = user?.role === 'director'
  const canCreate = hasPermission('manage_templates')

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#f5f3ef' }}>
      <div className="px-4 pt-5 pb-4 md:px-7 md:pt-6" style={{ flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 14, marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#14130f', marginBottom: 4, letterSpacing: '-0.3px' }}>Templates</div>
            <div style={{ fontSize: 12, color: '#6e6a63' }}>
              {counts.approved} approved {'\u00b7'} {counts.pending} pending approval {'\u00b7'} {counts.draft} drafts
            </div>
          </div>
          {canCreate && (
            <Btn onClick={() => { setEditingTemplate(null); setShowEditor(true) }}>
              + New Template
            </Btn>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          {[
            { label: 'Approved', value: counts.approved, color: '#2d6a4f' },
            { label: 'Pending', value: counts.pending, color: '#9a6a00' },
            { label: 'Drafts', value: counts.draft, color: '#6e6a63' },
            { label: 'Rejected', value: counts.rejected, color: '#8e2a2a' },
          ].map(s => (
            <div key={s.label} style={{ background: '#fff', borderRadius: 8, padding: '14px 16px', border: '0.5px solid #dcd8d0' }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: s.color, letterSpacing: '-0.3px' }}>{s.value}</div>
              <div style={{ fontSize: 10, color: '#6e6a63', marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 500 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 md:px-7 py-3 gap-3 md:gap-4" style={{ background: '#fff', borderBottom: '0.5px solid #dcd8d0', display: 'flex', alignItems: 'center', flexWrap: 'wrap', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 4 }}>
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
          <svg style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', width: 12, height: 12, color: '#9a958c', pointerEvents: 'none' }} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="7" cy="7" r="4"/><path d="M10.5 10.5l3 3" strokeLinecap="round"/></svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search templates…"
            className="w-full md:w-[200px]"
            style={{ padding: '6px 10px 6px 26px', border: '0.5px solid #dcd8d0', borderRadius: 8, fontSize: 12, outline: 'none', background: '#faf9f7', color: '#14130f', boxSizing: 'border-box' }} />
        </div>
      </div>

      <div className="px-4 py-5 md:px-7" style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#9a958c' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
            <div>Loading templates…</div>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#4a4742', marginBottom: 6 }}>No templates found</div>
            <div style={{ fontSize: 13, color: '#9a958c', marginBottom: 24 }}>
              {activeTab === 'all' ? 'Create your first WhatsApp template to get started.' : `No ${activeTab} templates.`}
            </div>
            {canCreate && activeTab === 'all' && (
              <Btn onClick={() => { setEditingTemplate(null); setShowEditor(true) }}>+ Create First Template</Btn>
            )}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14 }}>
            {filtered.map(t => {
              const ss = STATUS_STYLES[t.status] || STATUS_STYLES.draft
              const buttons = Array.isArray(t.buttons) ? t.buttons : []
              return (
                <div key={t.id} style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #dcd8d0', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ padding: '14px 16px', borderBottom: '0.5px solid #f5f3ef', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#14130f', marginBottom: 5, fontFamily: 'monospace' }}>{t.name}</div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 6, background: ss.bg, color: ss.color, fontWeight: 600 }}>{ss.label}</span>
                        <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 6, background: '#f5f3ef', color: '#6e6a63', textTransform: 'capitalize' }}>{t.category}</span>
                        {buttons.length > 0 && (
                          <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 6, background: '#ede9fe', color: '#5b21b6' }}>
                            {buttons.length} button{buttons.length !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div style={{ padding: '12px 16px', flex: 1 }}>
                    <div style={{ fontSize: 12, color: '#4a4742', lineHeight: 1.6, maxHeight: 100, overflow: 'hidden' }}>
                      {t.body?.slice(0, 200)}{t.body?.length > 200 ? '…' : ''}
                    </div>
                  </div>
                  {buttons.length > 0 && (
                    <div style={{ padding: '0 16px 10px' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                        {buttons.map((b, i) => (
                          <span key={i} style={{ fontSize: 10, padding: '3px 9px', borderRadius: 6, background: '#f0fdf4', color: '#16a34a', border: '0.5px solid #86efac', fontWeight: 500 }}>
                            {b.type === 'quick_reply' ? '↩ ' : '↗ '}{b.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  <div style={{ padding: '10px 16px', borderTop: '0.5px solid #f5f3ef', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <Btn variant="ghost" size="sm" onClick={() => setPreviewTemplate(t)}>Preview</Btn>
                    {canCreate && (
                      <Btn variant="ghost" size="sm" onClick={() => { setEditingTemplate(t); setShowEditor(true) }}>Edit</Btn>
                    )}
                    {canApprove && t.status === 'pending' && (
                      <>
                        <Btn variant="success" size="sm" onClick={() => approveTemplate(t.id)}>✓ Approve</Btn>
                        <Btn variant="danger" size="sm" onClick={() => rejectTemplate(t.id)}>✗ Reject</Btn>
                      </>
                    )}
                    {canCreate && (
                      <Btn variant="danger" size="sm" onClick={() => deleteTemplate(t.id)} style={{ marginLeft: 'auto' }}>Delete</Btn>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {showEditor && (
        <TemplateEditor
          template={editingTemplate}
          onClose={() => { setShowEditor(false); setEditingTemplate(null) }}
          onSaved={load} />
      )}

      {previewTemplate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}
          onClick={() => setPreviewTemplate(null)}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, maxWidth: 400, width: '100%' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#14130f' }}>{previewTemplate.name}</div>
              <button onClick={() => setPreviewTemplate(null)}
                style={{ width: 28, height: 28, borderRadius: 7, border: '0.5px solid #dcd8d0', background: '#faf9f7', cursor: 'pointer', fontSize: 14, color: '#6e6a63', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <IPhonePreview body={previewTemplate.body} buttons={previewTemplate.buttons || []} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}