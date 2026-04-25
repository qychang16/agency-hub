import { useState, useEffect, useRef } from 'react'
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
    success: { background: '#dcfce7', color: '#16a34a', border: '0.5px solid #86efac' },
    danger: { background: '#fee2e2', color: '#dc2626', border: '0.5px solid #fca5a5' },
  }
  return (
    <button onClick={!disabled ? onClick : undefined}
      style={{ ...sizes[size], ...variants[variant], borderRadius: 8, cursor: disabled ? 'default' : 'pointer', fontWeight: 500, opacity: disabled ? 0.6 : 1, display: 'inline-flex', alignItems: 'center', gap: 6, ...extra }}>
      {children}
    </button>
  )
}

// Parse CSV text into rows
function parseCSV(text) {
  const lines = text.trim().split('\n')
  if (lines.length < 2) return { headers: [], rows: [] }
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, '').toLowerCase())
  const rows = lines.slice(1).map((line, idx) => {
    const values = []
    let current = ''
    let inQuotes = false
    for (const char of line) {
      if (char === '"') { inQuotes = !inQuotes }
      else if (char === ',' && !inQuotes) { values.push(current.trim()); current = '' }
      else { current += char }
    }
    values.push(current.trim())
    const row = {}
    headers.forEach((h, i) => { row[h] = values[i] || '' })
    row._line = idx + 2
    return row
  }).filter(r => Object.values(r).some(v => v && v !== ''))
  return { headers, rows }
}

// Fill template variables from a row
function fillFromRow(body, row) {
  if (!body || !row) return body
  return body.replace(/\{\{(\w+)\}\}/g, (_, key) => row[key.toLowerCase()] || `{{${key}}}`)
}

// Validate a single row
function validateRow(row, channel, contacts) {
  const errors = []
  const phone = row.phone || row.number || row.mobile || ''
  const email = row.email || ''
  if (!row.name) errors.push('Missing name')
  if (channel === 'whatsapp' && !phone) errors.push('Missing phone number')
  if (channel === 'email' && !email) errors.push('Missing email')
  // Check if contact exists and has PDPA
  const contact = contacts.find(c =>
    phone ? c.phone === phone || c.phone === '+' + phone.replace(/^\+/, '') : c.email?.toLowerCase() === email.toLowerCase()
  )
  if (!contact) errors.push('Contact not found in system')
  else if (!contact.pdpa_consented && channel === 'whatsapp') errors.push('No PDPA consent')
  else if (contact.dnc) errors.push('Contact is DNC')
  else if (contact.opted_out) errors.push('Contact opted out')
  return { errors, contact }
}

const SAMPLE_CSV_WHATSAPP = `phone,name,role,company,date,time,venue
+6591234001,Sarah Lim,HR Executive,ABC Pte Ltd,25 Apr 2026,10:00 AM,Level 12 OUE Tower
+6591234002,John Tan,Accountant,XYZ Corp,26 Apr 2026,2:00 PM,Raffles Place Tower 1
+6591234003,Mary Wong,Marketing Manager,DEF Pte Ltd,27 Apr 2026,11:00 AM,Marina Bay Sands`

const SAMPLE_CSV_EMAIL = `email,name,role,company,date,time,venue,salary,deadline
sarah@example.com,Sarah Lim,HR Executive,ABC Pte Ltd,25 Apr 2026,10:00 AM,Level 12 OUE,$4500,30 Apr 2026
john@example.com,John Tan,Accountant,XYZ Corp,26 Apr 2026,2:00 PM,Raffles Place,$5000,1 May 2026`

export default function BulkScheduler({ onClose, onSaved }) {
  const { token } = useAuth()
  const fileRef = useRef(null)
  const [step, setStep] = useState(1) // 1: setup, 2: upload, 3: preview, 4: confirm
  const [channel, setChannel] = useState('whatsapp')
  const [templates, setTemplates] = useState([])
  const [phoneNumbers, setPhoneNumbers] = useState([])
  const [contacts, setContacts] = useState([])
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [subject, setSubject] = useState('')
  const [phoneNumberId, setPhoneNumberId] = useState('')
  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledTime, setScheduledTime] = useState('')
  const [csvText, setCsvText] = useState('')
  const [parsed, setParsed] = useState(null)
  const [validated, setValidated] = useState([])
  const [dragOver, setDragOver] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [savedCount, setSavedCount] = useState(0)
  const [error, setError] = useState('')

  // Get tomorrow 9am as default
  useEffect(() => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const dateStr = tomorrow.toLocaleDateString('en-CA', { timeZone: 'Asia/Singapore' })
    setScheduledDate(dateStr)
    setScheduledTime('09:00')
  }, [])

  useEffect(() => { loadData() }, [])

  async function loadData() {
    try {
      const [t, p, c] = await Promise.all([
        fetch(`${API}/templates`, { headers: { Authorization: 'Bearer ' + token } }).then(r => r.json()),
        fetch(`${API}/phone-numbers`, { headers: { Authorization: 'Bearer ' + token } }).then(r => r.json()),
        fetch(`${API}/contacts`, { headers: { Authorization: 'Bearer ' + token } }).then(r => r.json()),
      ])
      setTemplates(Array.isArray(t) ? t.filter(tp => tp.status === 'approved') : [])
      setPhoneNumbers(Array.isArray(p) ? p : [])
      setContacts(Array.isArray(c) ? c : [])
      const primary = Array.isArray(p) ? p.find(n => n.is_primary) : null
      if (primary) setPhoneNumberId(primary.id)
    } catch {}
  }

  function handleFile(file) {
    if (!file) return
    if (!file.name.match(/\.(csv|txt)$/i) && file.type !== 'text/csv') {
      setError('Please upload a CSV file (.csv or .txt)')
      return
    }
    const reader = new FileReader()
    reader.onload = e => {
      const text = e.target.result
      setCsvText(text)
      processCSV(text)
    }
    reader.readAsText(file)
  }

  function processCSV(text) {
    const { headers, rows } = parseCSV(text)
    if (rows.length === 0) { setError('CSV file appears to be empty or invalid'); return }
    setParsed({ headers, rows })
    // Validate each row
    const results = rows.map(row => {
      const { errors, contact } = validateRow(row, channel, contacts)
      const filledBody = selectedTemplate ? fillFromRow(selectedTemplate.body, row) : ''
      const hasUnfilled = filledBody.includes('{{')
      return { row, errors, contact, filledBody, hasUnfilled, status: errors.length === 0 && !hasUnfilled ? 'valid' : errors.length > 0 ? 'error' : 'warning' }
    })
    setValidated(results)
    setStep(3)
  }

  function downloadSample() {
    const csv = channel === 'email' ? SAMPLE_CSV_EMAIL : SAMPLE_CSV_WHATSAPP
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `telcloud-bulk-sample-${channel}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function downloadErrors() {
    const errorRows = validated.filter(v => v.status === 'error')
    if (errorRows.length === 0) return
    const headers = parsed.headers.join(',')
    const rows = errorRows.map(v => {
      const values = parsed.headers.map(h => `"${v.row[h] || ''}"`)
      return values.join(',') + ',"' + v.errors.join('; ') + '"'
    })
    const csv = headers + ',errors\n' + rows.join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `telcloud-bulk-errors-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function schedule() {
    const validRows = validated.filter(v => v.status === 'valid')
    if (validRows.length === 0) { setError('No valid rows to schedule'); return }
    setSaving(true)
    const batchId = `batch_${Date.now()}`
    const scheduledAt = new Date(`${scheduledDate}T${scheduledTime}:00+08:00`).toISOString()
    let successCount = 0
    for (const v of validRows) {
      try {
        await fetch(`${API}/scheduled`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
          body: JSON.stringify({
            contact_id: v.contact.id,
            phone_number_id: channel === 'whatsapp' ? phoneNumberId : null,
            channel,
            template_id: selectedTemplate?.id,
            subject: channel === 'email' ? fillFromRow(subject, v.row) : null,
            body: v.filledBody,
            variables: v.row,
            scheduled_at: scheduledAt,
            send_mode: 'scheduled',
            email_to: channel === 'email' ? v.contact.email : null,
            bulk_batch_id: batchId,
          })
        })
        successCount++
      } catch {}
    }
    setSavedCount(successCount)
    setSaved(true)
    setSaving(false)
    setTimeout(() => onSaved(), 2000)
  }

  const validCount = validated.filter(v => v.status === 'valid').length
  const errorCount = validated.filter(v => v.status === 'error').length
  const warningCount = validated.filter(v => v.status === 'warning').length

  const STEPS = ['Setup', 'Upload CSV', 'Preview', 'Confirm']

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 900, maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '18px 24px', borderBottom: '0.5px solid #f5f3ef', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#14130f' }}>Bulk Schedule via CSV</div>
            <div style={{ fontSize: 11, color: '#9a958c', marginTop: 2 }}>Send personalised messages to multiple contacts at once</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {/* Step indicators */}
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              {STEPS.map((s, i) => (
                <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <div style={{ width: 22, height: 22, borderRadius: '50%', background: step > i + 1 ? '#16a34a' : step === i + 1 ? ACCENT : '#f5f3ef', color: step >= i + 1 ? '#fff' : '#9a958c', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
                      {step > i + 1 ? '✓' : i + 1}
                    </div>
                    <span style={{ fontSize: 10, color: step === i + 1 ? ACCENT : step > i + 1 ? '#16a34a' : '#9a958c', fontWeight: step === i + 1 ? 600 : 400, whiteSpace: 'nowrap' }}>{s}</span>
                  </div>
                  {i < STEPS.length - 1 && <div style={{ width: 16, height: 1.5, background: step > i + 1 ? '#16a34a' : '#dcd8d0', marginLeft: 4 }} />}
                </div>
              ))}
            </div>
            <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 7, border: '0.5px solid #dcd8d0', background: '#faf9f7', cursor: 'pointer', fontSize: 14, color: '#6e6a63', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>

          {/* STEP 1 — Setup */}
          {step === 1 && (
            <div style={{ maxWidth: 600, margin: '0 auto' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#14130f', marginBottom: 4 }}>Configure your bulk send</div>
              <div style={{ fontSize: 12, color: '#9a958c', marginBottom: 24 }}>Set up the channel, template and send time before uploading your CSV.</div>

              <Field label="Channel" required>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {[
                    { value: 'whatsapp', label: 'WhatsApp', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>, desc: 'Requires PDPA consent. Uses approved templates.' },
                  { value: 'email', label: 'Email', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>, desc: 'Via connected Outlook. Requires candidate email address.' },
                  ].map(c => (
                    <div key={c.value} onClick={() => setChannel(c.value)}
                      style={{ padding: '12px 14px', borderRadius: 9, border: `1.5px solid ${channel === c.value ? ACCENT : '#dcd8d0'}`, cursor: 'pointer', background: channel === c.value ? ACCENT_LIGHT : '#fff', transition: 'all .15s' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: channel === c.value ? ACCENT : '#14130f', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>{c.icon} {c.label}</div>
                      <div style={{ fontSize: 11, color: '#9a958c' }}>{c.desc}</div>
                    </div>
                  ))}
                </div>
              </Field>

              <Field label="Message Template" required hint="Select an approved template — variables will be filled from your CSV columns">
                <select value={selectedTemplate?.id || ''} onChange={e => {
                  const t = templates.find(tp => tp.id === parseInt(e.target.value))
                  setSelectedTemplate(t || null)
                  if (t?.subject) setSubject(t.subject)
                }}
                  style={{ width: '100%', padding: '9px 12px', border: '0.5px solid #dcd8d0', borderRadius: 8, fontSize: 13, outline: 'none', background: '#fff', color: '#14130f' }}>
                  <option value="">Select a template…</option>
                  {templates.filter(t => channel === 'email' ? t.type === 'email' : t.type !== 'email').map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                {selectedTemplate && (
                  <div style={{ marginTop: 8, padding: '10px 12px', background: '#faf9f7', borderRadius: 8, fontSize: 12, color: '#4a4742', lineHeight: 1.6, border: '0.5px solid #dcd8d0', whiteSpace: 'pre-wrap', maxHeight: 120, overflowY: 'auto' }}>
                    {selectedTemplate.body}
                  </div>
                )}
              </Field>

              {channel === 'email' && (
                <Field label="Email Subject" required hint="Use {{name}} or other variables — auto-filled per recipient">
                  <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="e.g. Interview Confirmation — {{role}} at {{company}}"
                    style={{ width: '100%', padding: '9px 12px', border: '0.5px solid #dcd8d0', borderRadius: 8, fontSize: 13, outline: 'none', background: '#fff', color: '#14130f', boxSizing: 'border-box' }} />
                </Field>
              )}

              {channel === 'whatsapp' && (
                <Field label="Send From" hint="Which WhatsApp number to send from">
                  <Select value={phoneNumberId} onChange={e => setPhoneNumberId(e.target.value)} options={phoneNumbers.map(p => ({ value: p.id, label: `${p.display_name || p.number}${p.is_primary ? ' (Primary)' : ''}` }))} />
                </Field>
              )}

              <Field label="Schedule Date & Time (SGT)" required hint="All messages in this batch will send at the same time">
                <div style={{ display: 'flex', gap: 8 }}>
                  <input type="date" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)}
                    style={{ flex: 1, padding: '9px 12px', border: '0.5px solid #dcd8d0', borderRadius: 8, fontSize: 13, outline: 'none', background: '#fff', color: '#14130f' }} />
                  <input type="time" value={scheduledTime} onChange={e => setScheduledTime(e.target.value)}
                    style={{ width: 110, padding: '9px 12px', border: '0.5px solid #dcd8d0', borderRadius: 8, fontSize: 13, outline: 'none', background: '#fff', color: '#14130f' }} />
                </div>
                {scheduledDate && scheduledTime && (
                  <div style={{ fontSize: 11, color: '#16a34a', marginTop: 6 }}>
                    ✓ Will send {new Date(`${scheduledDate}T${scheduledTime}:00+08:00`).toLocaleString('en-GB', { timeZone: 'Asia/Singapore', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })} SGT
                  </div>
                )}
              </Field>
            </div>
          )}

          {/* STEP 2 — Upload */}
          {step === 2 && (
            <div style={{ maxWidth: 600, margin: '0 auto' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#14130f', marginBottom: 4 }}>Upload your CSV file</div>
              <div style={{ fontSize: 12, color: '#9a958c', marginBottom: 20 }}>
                Your CSV must include a <code style={{ background: '#f5f3ef', padding: '1px 5px', borderRadius: 3 }}>phone</code> {channel === 'email' ? 'or ' : 'and '}
                {channel === 'email' && <code style={{ background: '#f5f3ef', padding: '1px 5px', borderRadius: 3 }}>email</code>} column and a <code style={{ background: '#f5f3ef', padding: '1px 5px', borderRadius: 3 }}>name</code> column.
                Other columns are used to fill template variables.
              </div>

              {/* Required columns info */}
              {selectedTemplate && (
                <div style={{ background: ACCENT_LIGHT, border: `0.5px solid ${ACCENT}30`, borderRadius: 10, padding: '12px 16px', marginBottom: 20 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: ACCENT, marginBottom: 8 }}>Required CSV columns for this template:</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {['name', channel === 'whatsapp' ? 'phone' : 'email', ...((selectedTemplate.body.match(/\{\{(\w+)\}\}/g) || []).map(m => m.replace(/\{\{|\}\}/g, '')).filter(v => v !== 'name'))].map(col => (
                      <span key={col} style={{ fontSize: 11, padding: '2px 9px', borderRadius: 6, background: '#fff', color: ACCENT, border: `0.5px solid ${ACCENT}40`, fontFamily: 'monospace' }}>{col}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Drop zone */}
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]) }}
                onClick={() => fileRef.current?.click()}
                style={{ border: `2px dashed ${dragOver ? ACCENT : '#c2bdb3'}`, borderRadius: 12, padding: '40px 20px', textAlign: 'center', cursor: 'pointer', background: dragOver ? ACCENT_LIGHT : '#faf9f7', transition: 'all .2s', marginBottom: 16 }}>
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#9a958c" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 12 }}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/></svg>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#4a4742', marginBottom: 6 }}>
                  {dragOver ? 'Drop your CSV here' : 'Drag & drop your CSV file'}
                </div>
                <div style={{ fontSize: 12, color: '#9a958c', marginBottom: 14 }}>or click to browse files · CSV or TXT format</div>
                <Btn variant="ghost" size="sm" onClick={e => { e.stopPropagation(); fileRef.current?.click() }}>Browse Files</Btn>
                <input ref={fileRef} type="file" accept=".csv,.txt,text/csv" style={{ display: 'none' }} onChange={e => handleFile(e.target.files[0])} />
              </div>

              {/* Or paste CSV */}
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#9a958c', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Or paste CSV text directly</span>
                  <button onClick={downloadSample} style={{ fontSize: 11, color: ACCENT, background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 600 }}>⬇ Download sample CSV</button>
                </div>
                <textarea value={csvText} onChange={e => setCsvText(e.target.value)} rows={6} placeholder={`phone,name,role,company,date,time\n+6591234001,Sarah Lim,HR Executive,ABC Pte Ltd,25 Apr,10am`}
                  style={{ width: '100%', padding: '10px 12px', border: '0.5px solid #dcd8d0', borderRadius: 8, fontSize: 11, outline: 'none', background: '#fff', color: '#4a4742', resize: 'vertical', fontFamily: 'monospace', boxSizing: 'border-box', lineHeight: 1.5 }} />
                {csvText && (
                  <Btn size="sm" onClick={() => processCSV(csvText)} style={{ marginTop: 8 }}>Process CSV →</Btn>
                )}
              </div>

              {error && (
                <div style={{ padding: '10px 12px', background: '#fef2f2', border: '0.5px solid #fecaca', borderRadius: 8, fontSize: 12, color: '#dc2626' }}>
                  ⚠ {error}
                </div>
              )}
            </div>
          )}

          {/* STEP 3 — Preview */}
          {step === 3 && (
            <div>
              {/* Summary bar */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
                {[
                  { label: 'Valid — will schedule', value: validCount, color: '#16a34a', bg: '#dcfce7', icon: '✓' },
                  { label: 'Warnings — needs review', value: warningCount, color: '#d97706', bg: '#fef3c7', icon: '⚠' },
                  { label: 'Errors — will skip', value: errorCount, color: '#dc2626', bg: '#fee2e2', icon: '✗' },
                ].map(s => (
                  <div key={s.label} style={{ padding: '14px 16px', borderRadius: 10, background: s.bg, border: `0.5px solid ${s.color}30`, display: 'flex', gap: 12, alignItems: 'center' }}>
                    <div style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{s.value}</div>
                    <div style={{ fontSize: 11, color: s.color, fontWeight: 500 }}>{s.icon} {s.label}</div>
                  </div>
                ))}
              </div>

              {errorCount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                  <Btn variant="ghost" size="sm" onClick={downloadErrors}>⬇ Download error rows as CSV</Btn>
                </div>
              )}

              {/* Preview table */}
              <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #dcd8d0', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#faf9f7' }}>
                      <th style={{ padding: '10px 14px', fontSize: 10, fontWeight: 600, color: '#9a958c', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '0.5px solid #f5f3ef' }}>Row</th>
                      <th style={{ padding: '10px 14px', fontSize: 10, fontWeight: 600, color: '#9a958c', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '0.5px solid #f5f3ef' }}>Contact</th>
                      <th style={{ padding: '10px 14px', fontSize: 10, fontWeight: 600, color: '#9a958c', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '0.5px solid #f5f3ef' }}>Message Preview</th>
                      <th style={{ padding: '10px 14px', fontSize: 10, fontWeight: 600, color: '#9a958c', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '0.5px solid #f5f3ef' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validated.map((v, i) => (
                      <tr key={i} style={{ borderBottom: '0.5px solid #faf9f7', background: v.status === 'error' ? '#fff5f5' : v.status === 'warning' ? '#fffbeb' : 'transparent' }}
                        onMouseEnter={e => e.currentTarget.style.background = v.status === 'error' ? '#fef2f2' : v.status === 'warning' ? '#fef9c3' : '#faf9f7'}
                        onMouseLeave={e => e.currentTarget.style.background = v.status === 'error' ? '#fff5f5' : v.status === 'warning' ? '#fffbeb' : 'transparent'}>
                        <td style={{ padding: '10px 14px', fontSize: 12, color: '#9a958c' }}>{v.row._line}</td>
                        <td style={{ padding: '10px 14px' }}>
                          <div style={{ fontSize: 12, fontWeight: 500, color: '#14130f' }}>{v.row.name || '—'}</div>
                          <div style={{ fontSize: 11, color: '#9a958c' }}>{v.row.phone || v.row.email || '—'}</div>
                        </td>
                        <td style={{ padding: '10px 14px', maxWidth: 300 }}>
                          <div style={{ fontSize: 11, color: '#4a4742', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {v.filledBody?.slice(0, 80) || <span style={{ color: '#9a958c', fontStyle: 'italic' }}>No template selected</span>}
                            {v.filledBody?.length > 80 ? '…' : ''}
                          </div>
                          {v.hasUnfilled && (
                            <div style={{ fontSize: 10, color: '#d97706', marginTop: 3 }}>⚠ Contains unfilled variables</div>
                          )}
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          {v.status === 'valid' ? (
                            <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 8, background: '#dcfce7', color: '#16a34a', fontWeight: 600 }}>✓ Ready</span>
                          ) : v.status === 'warning' ? (
                            <div>
                              <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 8, background: '#fef3c7', color: '#92400e', fontWeight: 600, display: 'block', marginBottom: 3 }}>⚠ Warning</span>
                              {v.errors.map(e => <div key={e} style={{ fontSize: 10, color: '#d97706' }}>{e}</div>)}
                            </div>
                          ) : (
                            <div>
                              <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 8, background: '#fee2e2', color: '#dc2626', fontWeight: 600, display: 'block', marginBottom: 3 }}>✗ Error</span>
                              {v.errors.map(e => <div key={e} style={{ fontSize: 10, color: '#dc2626' }}>{e}</div>)}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* STEP 4 — Confirm */}
          {step === 4 && (
            <div style={{ maxWidth: 500, margin: '0 auto', textAlign: 'center' }}>
              {saved ? (
                <div style={{ padding: '40px 20px' }}>
                  <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 16 }}><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#14130f', marginBottom: 8 }}>{savedCount} messages scheduled</div>
                  <div style={{ fontSize: 13, color: '#9a958c', marginBottom: 20 }}>
                    All {savedCount} messages will send on {new Date(`${scheduledDate}T${scheduledTime}:00+08:00`).toLocaleString('en-GB', { timeZone: 'Asia/Singapore', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })} SGT
                  </div>
                  <div style={{ fontSize: 12, color: '#9a958c' }}>Closing in a moment…</div>
                </div>
              ) : (
                <div style={{ padding: '20px 0' }}>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#9a958c" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 16 }}><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/></svg>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#14130f', marginBottom: 8 }}>Ready to schedule</div>
                  <div style={{ fontSize: 13, color: '#9a958c', marginBottom: 24 }}>
                    {validCount} message{validCount !== 1 ? 's' : ''} will be scheduled.
                    {errorCount > 0 && ` ${errorCount} row${errorCount !== 1 ? 's' : ''} with errors will be skipped.`}
                  </div>

                  {/* Final summary */}
                  <div style={{ background: '#faf9f7', borderRadius: 12, border: '0.5px solid #dcd8d0', padding: '16px 20px', textAlign: 'left', marginBottom: 24 }}>
                    {[
                      ['Recipients', `${validCount} contact${validCount !== 1 ? 's' : ''}`],
                      ['Channel', channel === 'email' ? '📧 Email' : '💬 WhatsApp'],
                      ['Template', selectedTemplate?.name || 'Custom message'],
                      ['Send time', `${scheduledDate} ${scheduledTime} SGT`],
                      errorCount > 0 ? ['Skipping', `${errorCount} row${errorCount !== 1 ? 's' : ''} with errors`] : null,
                    ].filter(Boolean).map(([label, value]) => (
                      <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '0.5px solid #f5f3ef', fontSize: 13 }}>
                        <span style={{ color: '#9a958c' }}>{label}</span>
                        <span style={{ color: '#14130f', fontWeight: 500 }}>{value}</span>
                      </div>
                    ))}
                  </div>

                  <div style={{ padding: '12px 16px', background: '#fffbeb', border: '0.5px solid #fde68a', borderRadius: 10, fontSize: 12, color: '#92400e', marginBottom: 24, textAlign: 'left', lineHeight: 1.6 }}>
                    ⚠️ <strong>Final check:</strong> Once scheduled, messages will send automatically at the set time.
                    You can cancel individual messages from the Scheduled Messages panel before they send.
                  </div>

                  {error && (
                    <div style={{ padding: '10px 12px', background: '#fef2f2', border: '0.5px solid #fecaca', borderRadius: 8, fontSize: 12, color: '#dc2626', marginBottom: 16 }}>
                      ⚠ {error}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: '0.5px solid #f5f3ef', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, background: '#fff' }}>
          <div>
            {step === 3 && (
              <div style={{ fontSize: 12, color: '#9a958c' }}>
                {validCount} ready · {warningCount} warnings · {errorCount} errors
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            {!saved && (
              <>
                {step > 1 && <Btn variant="ghost" onClick={() => { setStep(s => s - 1); setError('') }}>← Back</Btn>}
                <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
                {step === 1 && (
                  <Btn onClick={() => {
                    if (!selectedTemplate && channel === 'whatsapp') { setError('Please select a template'); return }
                    if (channel === 'email' && !subject.trim()) { setError('Email subject is required'); return }
                    if (!scheduledDate || !scheduledTime) { setError('Please set a schedule date and time'); return }
                    setError(''); setStep(2)
                  }}>Next →</Btn>
                )}
                {step === 2 && (
                  <Btn onClick={() => {
                    if (!csvText.trim()) { setError('Please upload or paste a CSV file'); return }
                    processCSV(csvText)
                  }}>Process CSV →</Btn>
                )}
                {step === 3 && (
                  <Btn onClick={() => { if (validCount === 0) { setError('No valid rows to schedule'); return }; setStep(4) }}
                    disabled={validCount === 0}>
                    Confirm {validCount} message{validCount !== 1 ? 's' : ''} →
                  </Btn>
                )}
                {step === 4 && (
                  <Btn onClick={schedule} disabled={saving || validCount === 0}>
                    {saving ? `Scheduling ${validCount} messages…` : `📅 Schedule ${validCount} Messages`}
                  </Btn>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}