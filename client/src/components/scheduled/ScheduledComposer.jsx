import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { API } from '../../utils/constants'
import { ACCENT, ACCENT_LIGHT, NAVY } from '../../utils/designTokens'
import { fmtSGT } from '../../utils/dates'

function Field({ label, hint, children, required }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: '#4a4742', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
        {label}{required && <span style={{ color: '#ef4444', marginLeft: 3 }}>*</span>}
      </label>
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

function Select({ value, onChange, options, disabled }) {
  return (
    <select value={value || ''} onChange={onChange} disabled={disabled}
      style={{ width: '100%', padding: '9px 12px', border: '0.5px solid #dcd8d0', borderRadius: 8, fontSize: 13, outline: 'none', background: disabled ? '#faf9f7' : '#fff', color: '#14130f' }}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

function Btn({ onClick, children, variant = 'primary', size = 'md', disabled, style: extra }) {
  const sizes = { sm: { padding: '5px 10px', fontSize: 11 }, md: { padding: '9px 16px', fontSize: 13 } }
  const variants = {
    primary: { background: ACCENT, color: '#fff', border: 'none' },
    ghost: { background: 'transparent', color: '#6e6a63', border: '0.5px solid #dcd8d0' },
    dark: { background: NAVY, color: '#fff', border: 'none' },
    amber: { background: '#fef3c7', color: '#92400e', border: '0.5px solid #fde68a' },
  }
  return (
    <button onClick={!disabled ? onClick : undefined}
      style={{ ...sizes[size], ...variants[variant], borderRadius: 8, cursor: disabled ? 'default' : 'pointer', fontWeight: 500, opacity: disabled ? 0.6 : 1, display: 'inline-flex', alignItems: 'center', gap: 6, ...extra }}>
      {children}
    </button>
  )
}

// Fill template variables with contact data
function fillVariables(body, vars) {
  if (!body || !vars) return body
  return body.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] || `{{${key}}}`)
}

// Extract variable names from template body
function extractVariables(body) {
  if (!body) return []
  const matches = body.match(/\{\{(\w+)\}\}/g) || []
  return [...new Set(matches.map(m => m.replace(/\{\{|\}\}/g, '')))]
}

const SEND_MODES = [
  { value: 'scheduled', label: 'Scheduled Send', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/></svg>, desc: 'Sends at the exact date and time you set' },
  { value: 'immediate', label: 'Send Immediately', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>, desc: 'Sends right now — for executive search and urgent placements' },
]

const CHANNELS = [
  { value: 'whatsapp', label: 'WhatsApp', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>, desc: 'Sends via WhatsApp to candidate\'s number' },
  { value: 'email', label: 'Email (Outlook)', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>, desc: 'Sends via connected Outlook account' },
]

export default function ScheduledComposer({ onClose, onSaved, prefillContact, prefillConversation }) {
  const { token, user } = useAuth()
  const [step, setStep] = useState(1) // 1: compose, 2: preview, 3: confirm
  const [channel, setChannel] = useState('whatsapp')
  const [sendMode, setSendMode] = useState('scheduled')
  const [contacts, setContacts] = useState([])
  const [templates, setTemplates] = useState([])
  const [phoneNumbers, setPhoneNumbers] = useState([])
  const [contactSearch, setContactSearch] = useState('')
  const [selectedContact, setSelectedContact] = useState(prefillContact || null)
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [variables, setVariables] = useState({})
  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledTime, setScheduledTime] = useState('')
  const [phoneNumberId, setPhoneNumberId] = useState('')
  const [emailCc, setEmailCc] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showContactSearch, setShowContactSearch] = useState(!prefillContact)

  // Get tomorrow 9am as default
  useEffect(() => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(9, 0, 0, 0)
    const dateStr = tomorrow.toLocaleDateString('en-CA', { timeZone: 'Asia/Singapore' })
    setScheduledDate(dateStr)
    setScheduledTime('09:00')
  }, [])

  useEffect(() => { loadData() }, [])

  async function loadData() {
    try {
      const [c, t, p] = await Promise.all([
        fetch(`${API}/contacts`, { headers: { Authorization: 'Bearer ' + token } }).then(r => r.json()),
        fetch(`${API}/templates`, { headers: { Authorization: 'Bearer ' + token } }).then(r => r.json()),
        fetch(`${API}/phone-numbers`, { headers: { Authorization: 'Bearer ' + token } }).then(r => r.json()),
      ])
      setContacts(Array.isArray(c) ? c : [])
      setTemplates(Array.isArray(t) ? t.filter(tp => tp.status === 'approved') : [])
      setPhoneNumbers(Array.isArray(p) ? p : [])
      const primary = Array.isArray(p) ? p.find(n => n.is_primary) : null
      if (primary) setPhoneNumberId(primary.id)
    } catch {}
  }

  function selectTemplate(t) {
    setSelectedTemplate(t)
    setBody(t.body)
    if (t.subject) setSubject(t.subject)
    // Auto-fill variables from contact
    const vars = {}
    if (selectedContact) {
      vars.name = selectedContact.name
      vars.phone = selectedContact.phone
    }
    setVariables(vars)
  }

  function selectContact(c) {
    setSelectedContact(c)
    setShowContactSearch(false)
    // Auto-fill name variable
    if (body) {
      setVariables(prev => ({ ...prev, name: c.name }))
    }
  }

  const bodyVars = extractVariables(body)
  const previewBody = fillVariables(body, variables)
  const hasUnfilledVars = bodyVars.some(v => !variables[v])

  function isBlackedOut() {
    if (sendMode === 'immediate') return false
    if (!scheduledTime) return false
    const [h, m] = scheduledTime.split(':').map(Number)
    const mins = h * 60 + m
    const blackoutStart = 22 * 60
    const blackoutEnd = 8 * 60
    return mins >= blackoutStart || mins < blackoutEnd
  }

  function getScheduledISO() {
    if (!scheduledDate || !scheduledTime) return null
    return new Date(`${scheduledDate}T${scheduledTime}:00+08:00`).toISOString()
  }

  function validate() {
    setError('')
    if (!selectedContact) { setError('Please select a contact'); return false }
    if (!body.trim()) { setError('Message body is required'); return false }
    if (channel === 'email' && !subject.trim()) { setError('Email subject is required'); return false }
    if (sendMode === 'scheduled') {
      if (!scheduledDate || !scheduledTime) { setError('Please set a scheduled date and time'); return false }
      const scheduled = new Date(getScheduledISO())
      if (scheduled <= new Date()) { setError('Scheduled time must be in the future'); return false }
    }
    if (hasUnfilledVars) { setError(`Please fill in all variables: ${bodyVars.filter(v => !variables[v]).join(', ')}`); return false }
    if (!selectedContact.pdpa_consented && channel === 'whatsapp') {
      setError('This contact has not given PDPA consent. Cannot send WhatsApp messages.')
      return false
    }
    if (selectedContact.dnc) {
      setError('This contact is flagged as Do Not Contact. Cannot send any messages.')
      return false
    }
    if (selectedContact.opted_out) {
      setError('This contact has opted out of messages.')
      return false
    }
    return true
  }

  async function save() {
    if (!validate()) return
    setSaving(true)
    try {
      const scheduledAt = sendMode === 'immediate' ? new Date().toISOString() : getScheduledISO()
      await fetch(`${API}/scheduled`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({
          contact_id: selectedContact.id,
          phone_number_id: phoneNumberId,
          channel,
          template_id: selectedTemplate?.id,
          subject: channel === 'email' ? subject : null,
          body: previewBody,
          variables,
          scheduled_at: scheduledAt,
          send_mode: sendMode,
          email_to: channel === 'email' ? selectedContact.email : null,
          email_cc: channel === 'email' ? emailCc : null,
        })
      })
      onSaved()
    } catch {
      setError('Failed to schedule message. Please try again.')
    } finally { setSaving(false) }
  }

  const filteredContacts = contacts.filter(c =>
    !contactSearch || c.name?.toLowerCase().includes(contactSearch.toLowerCase()) || c.phone?.includes(contactSearch) || c.email?.toLowerCase().includes(contactSearch.toLowerCase())
  )

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 800, maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Modal header */}
        <div style={{ padding: '18px 24px', borderBottom: '0.5px solid #f5f3ef', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, background: '#fff' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#14130f' }}>Schedule Message</div>
            <div style={{ fontSize: 11, color: '#9a958c', marginTop: 2 }}>
              Step {step} of 2 — {step === 1 ? 'Compose your message' : 'Preview and confirm'}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Step indicator */}
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {[1, 2].map(s => (
                <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 24, height: 24, borderRadius: '50%', background: step >= s ? ACCENT : '#f5f3ef', color: step >= s ? '#fff' : '#9a958c', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>{s}</div>
                  {s < 2 && <div style={{ width: 20, height: 1.5, background: step > s ? ACCENT : '#dcd8d0' }} />}
                </div>
              ))}
            </div>
            <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 7, border: '0.5px solid #dcd8d0', background: '#faf9f7', cursor: 'pointer', fontSize: 14, color: '#6e6a63', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          {step === 1 ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              {/* Left column */}
              <div>
                {/* Channel selector */}
                <Field label="Channel" required>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {CHANNELS.map(c => (
                      <div key={c.value} onClick={() => setChannel(c.value)}
                        style={{ flex: 1, padding: '10px 12px', borderRadius: 9, border: `1.5px solid ${channel === c.value ? ACCENT : '#dcd8d0'}`, cursor: 'pointer', background: channel === c.value ? ACCENT_LIGHT : '#fff', transition: 'all .15s' }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: channel === c.value ? ACCENT : '#14130f', marginBottom: 3, display: 'flex', alignItems: 'center', gap: 6 }}>{c.icon} {c.label}</div>
                        <div style={{ fontSize: 10, color: '#9a958c' }}>{c.desc}</div>
                      </div>
                    ))}
                  </div>
                </Field>

                {/* Send mode */}
                <Field label="Send Mode" required>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {SEND_MODES.map(m => (
                      <div key={m.value} onClick={() => setSendMode(m.value)}
                        style={{ flex: 1, padding: '10px 12px', borderRadius: 9, border: `1.5px solid ${sendMode === m.value ? ACCENT : '#dcd8d0'}`, cursor: 'pointer', background: sendMode === m.value ? ACCENT_LIGHT : '#fff', transition: 'all .15s' }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: sendMode === m.value ? ACCENT : '#14130f', marginBottom: 3, display: 'flex', alignItems: 'center', gap: 6 }}>{m.icon} {m.label}</div>
                        <div style={{ fontSize: 10, color: '#9a958c' }}>{m.desc}</div>
                      </div>
                    ))}
                  </div>
                </Field>

                {/* Contact */}
                <Field label="Send To" required hint="Select the candidate or client to send to">
                  {selectedContact && !showContactSearch ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: '#f0fdf4', borderRadius: 8, border: '0.5px solid #86efac' }}>
                      <div style={{ width: 34, height: 34, borderRadius: 9, background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#16a34a', flexShrink: 0 }}>
                        {selectedContact.name?.[0]?.toUpperCase()}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#14130f' }}>{selectedContact.name}</div>
                        <div style={{ fontSize: 11, color: '#9a958c' }}>{channel === 'email' ? selectedContact.email : selectedContact.phone}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {!selectedContact.pdpa_consented && <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: '#fee2e2', color: '#dc2626', fontWeight: 600 }}>No PDPA</span>}
                        {selectedContact.dnc && <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: '#fee2e2', color: '#dc2626', fontWeight: 600 }}>DNC</span>}
                        <button onClick={() => setShowContactSearch(true)} style={{ fontSize: 11, color: ACCENT, background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 6px' }}>Change</button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ position: 'relative', marginBottom: 6 }}>
                        <svg style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', width: 12, height: 12, color: '#9a958c', pointerEvents: 'none' }} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="7" cy="7" r="4"/><path d="M10.5 10.5l3 3" strokeLinecap="round"/></svg>
                        <input value={contactSearch} onChange={e => setContactSearch(e.target.value)} placeholder="Search by name, phone or email…" autoFocus
                          style={{ width: '100%', padding: '8px 10px 8px 27px', border: '0.5px solid #dcd8d0', borderRadius: 8, fontSize: 12, outline: 'none', background: '#faf9f7', color: '#14130f', boxSizing: 'border-box' }} />
                      </div>
                      <div style={{ maxHeight: 180, overflowY: 'auto', border: '0.5px solid #dcd8d0', borderRadius: 8 }}>
                        {filteredContacts.slice(0, 20).map(c => (
                          <div key={c.id} onClick={() => selectContact(c)}
                            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', cursor: 'pointer', borderBottom: '0.5px solid #faf9f7' }}
                            onMouseEnter={e => e.currentTarget.style.background = '#faf9f7'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                            <div style={{ width: 30, height: 30, borderRadius: 8, background: c.type === 'candidate' ? '#ede9fe' : '#eeedf5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: c.type === 'candidate' ? '#5b21b6' : '#2d2a7a', flexShrink: 0 }}>
                              {c.name?.[0]?.toUpperCase()}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 12, fontWeight: 500, color: '#14130f' }}>{c.name}</div>
                              <div style={{ fontSize: 10, color: '#9a958c' }}>{c.phone} {c.email ? `· ${c.email}` : ''}</div>
                            </div>
                            <div style={{ display: 'flex', gap: 4 }}>
                              {c.dnc && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: '#fee2e2', color: '#dc2626', fontWeight: 600 }}>DNC</span>}
                              {!c.pdpa_consented && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: '#fef3c7', color: '#92400e', fontWeight: 600 }}>No PDPA</span>}
                            </div>
                          </div>
                        ))}
                        {filteredContacts.length === 0 && (
                          <div style={{ padding: '20px 0', textAlign: 'center', fontSize: 12, color: '#9a958c' }}>No contacts found</div>
                        )}
                      </div>
                    </div>
                  )}
                </Field>

                {/* Schedule time — only if scheduled mode */}
                {sendMode === 'scheduled' && (
                  <Field label="Schedule Date & Time (SGT)" required>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input type="date" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)}
                        style={{ flex: 1, padding: '9px 12px', border: '0.5px solid #dcd8d0', borderRadius: 8, fontSize: 13, outline: 'none', background: '#fff', color: '#14130f' }} />
                      <input type="time" value={scheduledTime} onChange={e => setScheduledTime(e.target.value)}
                        style={{ width: 110, padding: '9px 12px', border: `0.5px solid ${isBlackedOut() ? '#fde68a' : '#dcd8d0'}`, borderRadius: 8, fontSize: 13, outline: 'none', background: isBlackedOut() ? '#fffbeb' : '#fff', color: '#14130f' }} />
                    </div>
                    {isBlackedOut() && (
                      <div style={{ fontSize: 11, color: '#92400e', marginTop: 6, display: 'flex', gap: 5 }}>
                        <span>⚠️</span> This time falls within the blackout window (22:00–08:00 SGT). The message will be queued and sent at 08:00 SGT.
                      </div>
                    )}
                    {scheduledDate && scheduledTime && !isBlackedOut() && new Date(getScheduledISO()) > new Date() && (
                      <div style={{ fontSize: 11, color: '#16a34a', marginTop: 6 }}>
                        ✓ Will send {fmtSGT(getScheduledISO())}
                      </div>
                    )}
                  </Field>
                )}

                {/* Phone number — WhatsApp only */}
                {channel === 'whatsapp' && (
                  <Field label="Send From" hint="Which WhatsApp number to send from">
                    <Select value={phoneNumberId} onChange={e => setPhoneNumberId(e.target.value)} options={phoneNumbers.map(p => ({ value: p.id, label: `${p.display_name || p.number}${p.is_primary ? ' (Primary)' : ''}` }))} />
                  </Field>
                )}

                {/* CC — email only */}
                {channel === 'email' && (
                  <Field label="CC (optional)" hint="Add CC email addresses separated by commas">
                    <Input value={emailCc} onChange={e => setEmailCc(e.target.value)} placeholder="cc@company.com, another@company.com" />
                  </Field>
                )}
              </div>

              {/* Right column */}
              <div>
                {/* Template selector */}
                <Field label="Template (optional)" hint="Select an approved template or type your own message below">
                  <select value={selectedTemplate?.id || ''} onChange={e => {
                    const t = templates.find(tp => tp.id === parseInt(e.target.value))
                    if (t) selectTemplate(t)
                    else { setSelectedTemplate(null); setBody(''); setSubject('') }
                  }}
                    style={{ width: '100%', padding: '9px 12px', border: '0.5px solid #dcd8d0', borderRadius: 8, fontSize: 13, outline: 'none', background: '#fff', color: '#14130f', marginBottom: 8 }}>
                    <option value="">— Type your own message —</option>
                    {templates.filter(t => channel === 'email' ? t.type === 'email' : t.type !== 'email').map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </Field>

                {/* Email subject */}
                {channel === 'email' && (
                  <Field label="Email Subject" required>
                    <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="e.g. Interview Confirmation — HR Executive at ABC Pte Ltd" />
                  </Field>
                )}

                {/* Message body */}
                <Field label="Message" required>
                  <textarea value={body} onChange={e => setBody(e.target.value)} rows={8}
                    placeholder={channel === 'email'
                      ? 'Dear {{name}},\n\nWe are pleased to confirm your interview…\n\nBest regards,\n{{agent_name}}'
                      : 'Dear {{name}},\n\nWe would like to confirm your interview for {{role}} at {{company}}…'}
                    style={{ width: '100%', padding: '10px 12px', border: '0.5px solid #dcd8d0', borderRadius: 8, fontSize: 12, outline: 'none', background: '#fff', color: '#14130f', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box', lineHeight: 1.6, minHeight: 180 }} />
                  <div style={{ fontSize: 11, color: '#9a958c', marginTop: 5 }}>
                    Use {'{{name}}'}, {'{{role}}'}, {'{{company}}'}, {'{{date}}'}, {'{{time}}'}, {'{{venue}}'} as variables
                  </div>
                </Field>

                {/* Variable filler */}
                {bodyVars.length > 0 && (
                  <Field label="Fill Variables" hint="Replace placeholders with actual values">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '12px', background: '#faf9f7', borderRadius: 8, border: '0.5px solid #dcd8d0' }}>
                      {bodyVars.map(v => (
                        <div key={v} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ fontSize: 11, fontFamily: 'monospace', color: '#5b21b6', background: '#ede9fe', padding: '3px 8px', borderRadius: 4, minWidth: 80, textAlign: 'center', flexShrink: 0 }}>
                            {`{{${v}}}`}
                          </div>
                          <input value={variables[v] || ''} onChange={e => setVariables(p => ({ ...p, [v]: e.target.value }))}
                            placeholder={`Enter ${v}…`}
                            style={{ flex: 1, padding: '7px 10px', border: `0.5px solid ${variables[v] ? '#86efac' : '#dcd8d0'}`, borderRadius: 7, fontSize: 12, outline: 'none', background: '#fff', color: '#14130f' }} />
                          {variables[v] && <span style={{ fontSize: 12, color: '#16a34a' }}>✓</span>}
                        </div>
                      ))}
                      {hasUnfilledVars && (
                        <div style={{ fontSize: 11, color: '#d97706', marginTop: 4 }}>
                          ⚠ Fill all variables before scheduling
                        </div>
                      )}
                    </div>
                  </Field>
                )}
              </div>
            </div>
          ) : (
            /* Step 2 — Preview */
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              {/* Preview */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#4a4742', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Message Preview</div>
                <div style={{ background: '#faf9f7', borderRadius: 12, border: '0.5px solid #dcd8d0', overflow: 'hidden' }}>
                  {/* Preview header */}
                  <div style={{ padding: '12px 16px', background: channel === 'email' ? '#eeedf5' : '#f0fdf4', borderBottom: '0.5px solid #dcd8d0', display: 'flex', gap: 10, alignItems: 'center' }}>
                    <span style={{ fontSize: 20 }}>{channel === 'email' ? '📧' : '💬'}</span>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#14130f' }}>
                        {channel === 'email' ? 'Email to' : 'WhatsApp to'} {selectedContact?.name}
                      </div>
                      <div style={{ fontSize: 11, color: '#9a958c' }}>
                        {channel === 'email' ? selectedContact?.email : selectedContact?.phone}
                      </div>
                    </div>
                  </div>

                  {/* Email subject */}
                  {channel === 'email' && subject && (
                    <div style={{ padding: '10px 16px', borderBottom: '0.5px solid #dcd8d0', fontSize: 13, fontWeight: 600, color: '#14130f' }}>
                      {subject}
                    </div>
                  )}

                  {/* Body */}
                  <div style={{ padding: '14px 16px', fontSize: 12, color: '#4a4742', lineHeight: 1.7, whiteSpace: 'pre-wrap', maxHeight: 300, overflowY: 'auto' }}>
                    {previewBody || <span style={{ color: '#9a958c', fontStyle: 'italic' }}>No message content</span>}
                  </div>
                </div>

                {/* Unfilled vars warning */}
                {hasUnfilledVars && (
                  <div style={{ marginTop: 10, padding: '10px 12px', background: '#fef3c7', border: '0.5px solid #fde68a', borderRadius: 8, fontSize: 12, color: '#92400e' }}>
                    ⚠️ Some variables are not filled: {bodyVars.filter(v => !variables[v]).map(v => `{{${v}}}`).join(', ')}
                  </div>
                )}
              </div>

              {/* Summary */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#4a4742', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Send Summary</div>
                <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #dcd8d0', overflow: 'hidden' }}>
                  {[
                    ['Recipient', selectedContact?.name],
                    ['Contact', channel === 'email' ? selectedContact?.email : selectedContact?.phone],
                    ['Channel', channel === 'email' ? '📧 Email' : '💬 WhatsApp'],
                    ['Send mode', sendMode === 'immediate' ? '⚡ Immediate' : '📅 Scheduled'],
                    sendMode === 'scheduled' ? ['Scheduled for', fmtSGT(getScheduledISO())] : null,
                    isBlackedOut() ? ['⚠ Blackout', 'Will send at 08:00 SGT'] : null,
                    channel === 'email' && emailCc ? ['CC', emailCc] : null,
                    ['PDPA consent', selectedContact?.pdpa_consented ? '✓ Consented' : '✗ Not consented'],
                    ['DNC status', selectedContact?.dnc ? '⚠ DNC flagged' : '✓ Clear'],
                  ].filter(Boolean).map(([label, value]) => value && (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '11px 16px', borderBottom: '0.5px solid #faf9f7', fontSize: 12 }}>
                      <span style={{ color: '#9a958c' }}>{label}</span>
                      <span style={{ color: '#14130f', fontWeight: 500, textAlign: 'right', maxWidth: '60%' }}>{value}</span>
                    </div>
                  ))}
                </div>

                {/* Scheduled bubble preview */}
                {sendMode === 'scheduled' && (
                  <div style={{ marginTop: 14 }}>
                    <div style={{ fontSize: 11, color: '#9a958c', marginBottom: 8 }}>How it appears in the conversation thread:</div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                      <div style={{ maxWidth: '80%', padding: '10px 14px', borderRadius: 12, borderBottomRightRadius: 3, background: '#fef3c7', border: '1px solid #fde68a', fontSize: 12, color: '#92400e', lineHeight: 1.5 }}>
                        <div style={{ fontSize: 10, fontWeight: 600, color: '#d97706', marginBottom: 5, display: 'flex', alignItems: 'center', gap: 5 }}>
                          <span>📅</span> SCHEDULED
                        </div>
                        <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{previewBody?.slice(0, 80)}{previewBody?.length > 80 ? '…' : ''}</div>
                        <div style={{ fontSize: 10, color: '#d97706', marginTop: 6, textAlign: 'right' }}>
                          Sends {fmtSGT(getScheduledISO())}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: '0.5px solid #f5f3ef', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, background: '#fff' }}>
          <div style={{ flex: 1 }}>
            {error && (
              <div style={{ fontSize: 12, color: '#dc2626', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>⚠</span> {error}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            {step === 1 ? (
              <>
                <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
                <Btn onClick={() => { if (validate()) setStep(2) }}>Preview →</Btn>
              </>
            ) : (
              <>
                <Btn variant="ghost" onClick={() => setStep(1)}>← Edit</Btn>
                <Btn onClick={save} disabled={saving || hasUnfilledVars}>
                  {saving ? 'Scheduling…' : sendMode === 'immediate' ? '⚡ Send Now' : '📅 Confirm Schedule'}
                </Btn>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}