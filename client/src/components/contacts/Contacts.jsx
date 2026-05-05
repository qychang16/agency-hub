import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../../context/AuthContext'
import { API } from '../../utils/constants'
import { ACCENT, ACCENT_LIGHT, NAVY } from '../../utils/designTokens'
import Btn from '../ui/Btn'
import Modal from '../ui/Modal'

const TYPE_STYLES = {
  candidate: { bg: '#eeedf5', color: '#2d2a7a', label: 'Candidate' },
  client:    { bg: '#dcfce7', color: '#16a34a', label: 'Client' },
  vendor:    { bg: '#fef3c7', color: '#92400e', label: 'Vendor' },
  other:     { bg: '#f5f3ef', color: '#6e6a63', label: 'Other' },
}

// Pipeline stages — common recruitment funnel. Extends as needed by the org.
const PIPELINE_STAGES = [
  'new', 'contacted', 'screened', 'shortlisted',
  'interviewing', 'offered', 'hired', 'rejected', 'archived'
]

const FILTER_TABS = [
  { key: 'all',          label: 'All' },
  { key: 'new',          label: 'New' },
  { key: 'contacted',    label: 'Contacted' },
  { key: 'shortlisted',  label: 'Shortlisted' },
  { key: 'interviewing', label: 'Interviewing' },
  { key: 'offered',      label: 'Offered' },
  { key: 'hired',        label: 'Hired' },
  { key: 'rejected',     label: 'Rejected' },
]

function fmtTs(ts) {
  if (!ts) return '\u2014'
  return new Date(ts).toLocaleDateString('en-SG', { year: 'numeric', month: 'short', day: '2-digit' })
}

// ─────────────────────────────────────────────────────────────
// Card for a contact in the list
// ─────────────────────────────────────────────────────────────
function ContactCard({ c, canManage, onEdit, onDelete }) {
  const ts = TYPE_STYLES[c.type] || TYPE_STYLES.other
  return (
    <div style={{ background: '#fff', borderRadius: 10, border: '0.5px solid #dcd8d0', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: '#faf9f7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 600, color: '#6e6a63', flexShrink: 0 }}>
        {(c.name || '?').slice(0, 1).toUpperCase()}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#14130f' }}>{c.name || '(no name)'}</span>
          <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 6, background: ts.bg, color: ts.color, fontWeight: 600 }}>{ts.label}</span>
          {c.pipeline_stage && (
            <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 6, background: '#f5f3ef', color: '#6e6a63', textTransform: 'capitalize' }}>{c.pipeline_stage}</span>
          )}
          {c.dnc && <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 6, background: '#fee2e2', color: '#dc2626', fontWeight: 600 }}>DNC</span>}
          {c.opted_out && <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 6, background: '#fff7ed', color: '#9a6a00', fontWeight: 600 }}>Opted Out</span>}
        </div>
        <div style={{ fontSize: 11, color: '#6e6a63', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {c.phone && <span>{c.phone}</span>}
          {c.email && <span>{c.email}</span>}
          {c.candidate_role && <span>{'\u00b7'} {c.candidate_role}</span>}
          {c.current_company && <span>at {c.current_company}</span>}
        </div>
      </div>
      {canManage && (
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <Btn variant="ghost" size="sm" onClick={() => onEdit(c)}>Edit</Btn>
          <Btn variant="danger" size="sm" onClick={() => onDelete(c)}>Delete</Btn>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Add/Edit modal — all 16 fields organized into 3 sections
// ─────────────────────────────────────────────────────────────
function ContactEditor({ contact, onClose, onSaved }) {
  const { token } = useAuth()
  const isEdit = !!contact?.id
  const [form, setForm] = useState({
    name: contact?.name || '',
    phone: contact?.phone || '',
    email: contact?.email || '',
    type: contact?.type || 'candidate',
    pipeline_stage: contact?.pipeline_stage || 'new',
    candidate_role: contact?.candidate_role || '',
    current_company: contact?.current_company || '',
    expected_salary: contact?.expected_salary || '',
    notice_period: contact?.notice_period || '',
    linkedin_url: contact?.linkedin_url || '',
    notes: contact?.notes || '',
    source: contact?.source || '',
    pdpa_consented: contact?.pdpa_consented || false,
    dnc: contact?.dnc || false,
    dnc_reason: contact?.dnc_reason || '',
    opted_out: contact?.opted_out || false,
    tags: contact?.tags || [],
  })
  const [tagInput, setTagInput] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  function update(field, value) { setForm(p => ({ ...p, [field]: value })) }

  function addTag() {
    const t = tagInput.trim()
    if (!t) return
    if (form.tags.includes(t)) { setTagInput(''); return }
    update('tags', [...form.tags, t])
    setTagInput('')
  }
  function removeTag(t) { update('tags', form.tags.filter(x => x !== t)) }

  async function save() {
    setError('')
    if (!form.name.trim()) { setError('Name is required'); return }
    setSaving(true)
    try {
      const url = isEdit ? `${API}/contacts/${contact.id}` : `${API}/contacts`
      const method = isEdit ? 'PATCH' : 'POST'
      // Build payload — convert empty strings to null for cleanliness
      const payload = {
        ...form,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        candidate_role: form.candidate_role.trim() || null,
        current_company: form.current_company.trim() || null,
        notice_period: form.notice_period.trim() || null,
        linkedin_url: form.linkedin_url.trim() || null,
        notes: form.notes.trim() || null,
        source: form.source.trim() || null,
        dnc_reason: form.dnc_reason.trim() || null,
        expected_salary: form.expected_salary === '' ? null : Number(form.expected_salary),
      }
      // PATCH uses current_role not candidate_role due to legacy column name in PATCH endpoint
      if (isEdit) {
        payload.current_role = payload.candidate_role
        delete payload.candidate_role
      }
      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify(payload),
      })
      if (!r.ok) {
        const d = await r.json()
        setError(d.error || 'Failed to save')
        return
      }
      onSaved()
      onClose()
    } catch (err) {
      setError('Failed to save: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const fieldStyle = { width: '100%', padding: '8px 11px', border: '0.5px solid #dcd8d0', borderRadius: 7, fontSize: 12, outline: 'none', background: '#fff', color: '#14130f', boxSizing: 'border-box' }
  const labelStyle = { fontSize: 10, fontWeight: 600, color: '#4a4742', display: 'block', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.4px' }

  return (
    <Modal title={isEdit ? `Edit Contact - ${contact.name}` : 'New Contact'} subtitle={isEdit ? 'Update details for this contact' : 'Add a new candidate, client, or vendor'} onClose={onClose} width={760}>
      {/* Section: Identity */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#4a4742', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 10, paddingBottom: 6, borderBottom: '0.5px solid #f5f3ef' }}>Identity</div>
        <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 10 }}>
          <div>
            <label style={labelStyle}>Name <span style={{ color: '#ef4444' }}>*</span></label>
            <input value={form.name} onChange={e => update('name', e.target.value)} style={fieldStyle} placeholder="Full name" />
          </div>
          <div>
            <label style={labelStyle}>Phone (E.164 format)</label>
            <input value={form.phone} onChange={e => update('phone', e.target.value)} style={fieldStyle} placeholder="+6591234567" />
          </div>
          <div>
            <label style={labelStyle}>Email</label>
            <input type="email" value={form.email} onChange={e => update('email', e.target.value)} style={fieldStyle} placeholder="name@example.com" />
          </div>
          <div>
            <label style={labelStyle}>Type</label>
            <select value={form.type} onChange={e => update('type', e.target.value)} style={fieldStyle}>
              <option value="candidate">Candidate</option>
              <option value="client">Client</option>
              <option value="vendor">Vendor</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Pipeline Stage</label>
            <select value={form.pipeline_stage} onChange={e => update('pipeline_stage', e.target.value)} style={fieldStyle}>
              {PIPELINE_STAGES.map(s => <option key={s} value={s} style={{ textTransform: 'capitalize' }}>{s}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Source</label>
            <input value={form.source} onChange={e => update('source', e.target.value)} style={fieldStyle} placeholder="LinkedIn, referral, job board..." />
          </div>
        </div>
      </div>

      {/* Section: Career details */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#4a4742', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 10, paddingBottom: 6, borderBottom: '0.5px solid #f5f3ef' }}>Career Details</div>
        <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 10 }}>
          <div>
            <label style={labelStyle}>Role / Position</label>
            <input value={form.candidate_role} onChange={e => update('candidate_role', e.target.value)} style={fieldStyle} placeholder="Software Engineer" />
          </div>
          <div>
            <label style={labelStyle}>Current Company</label>
            <input value={form.current_company} onChange={e => update('current_company', e.target.value)} style={fieldStyle} placeholder="Acme Corp" />
          </div>
          <div>
            <label style={labelStyle}>Expected Salary (SGD)</label>
            <input type="number" value={form.expected_salary} onChange={e => update('expected_salary', e.target.value)} style={fieldStyle} placeholder="6500" />
          </div>
          <div>
            <label style={labelStyle}>Notice Period</label>
            <input value={form.notice_period} onChange={e => update('notice_period', e.target.value)} style={fieldStyle} placeholder="1 month, immediate, etc." />
          </div>
          <div className="sm:col-span-2">
            <label style={labelStyle}>LinkedIn URL</label>
            <input value={form.linkedin_url} onChange={e => update('linkedin_url', e.target.value)} style={fieldStyle} placeholder="https://linkedin.com/in/..." />
          </div>
        </div>
      </div>

      {/* Section: Tags */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#4a4742', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 10, paddingBottom: 6, borderBottom: '0.5px solid #f5f3ef' }}>Tags & Notes</div>
        <div style={{ marginBottom: 10 }}>
          <label style={labelStyle}>Tags</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
            {form.tags.map(t => (
              <span key={t} style={{ fontSize: 11, padding: '3px 9px', borderRadius: 6, background: ACCENT_LIGHT, color: ACCENT, display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                {t}
                <button onClick={() => removeTag(t)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: ACCENT, padding: 0, fontSize: 12 }}>×</button>
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <input value={tagInput} onChange={e => setTagInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
              style={{ ...fieldStyle, flex: 1 }} placeholder="Type a tag and press Enter" />
            <Btn variant="ghost" size="sm" onClick={addTag}>Add</Btn>
          </div>
        </div>
        <div>
          <label style={labelStyle}>Notes</label>
          <textarea value={form.notes} onChange={e => update('notes', e.target.value)} rows={3}
            style={{ ...fieldStyle, resize: 'vertical', fontFamily: 'inherit' }}
            placeholder="Internal notes, hiring history, conversation context..." />
        </div>
      </div>

      {/* Section: Compliance */}
      <div style={{ marginBottom: 18, padding: 12, background: '#faf9f7', borderRadius: 10, border: '0.5px solid #dcd8d0' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#4a4742', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 10 }}>PDPA & Compliance</div>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10, cursor: 'pointer' }}>
          <input type="checkbox" checked={form.pdpa_consented} onChange={e => update('pdpa_consented', e.target.checked)} style={{ accentColor: ACCENT }} />
          <span style={{ fontSize: 12, color: '#14130f' }}>PDPA consent received</span>
        </label>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10, cursor: 'pointer' }}>
          <input type="checkbox" checked={form.opted_out} onChange={e => update('opted_out', e.target.checked)} style={{ accentColor: ACCENT }} />
          <span style={{ fontSize: 12, color: '#14130f' }}>Opted out of communications</span>
        </label>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10, cursor: 'pointer' }}>
          <input type="checkbox" checked={form.dnc} onChange={e => update('dnc', e.target.checked)} style={{ accentColor: ACCENT }} />
          <span style={{ fontSize: 12, color: '#14130f' }}>Do Not Contact (DNC)</span>
        </label>
        {form.dnc && (
          <div style={{ paddingLeft: 26 }}>
            <label style={labelStyle}>DNC Reason</label>
            <input value={form.dnc_reason} onChange={e => update('dnc_reason', e.target.value)} style={fieldStyle}
              placeholder="Why is this contact on DNC?" />
          </div>
        )}
      </div>

      {error && (
        <div style={{ padding: '10px 12px', background: '#fef2f2', border: '0.5px solid #fecaca', borderRadius: 8, fontSize: 12, color: '#dc2626', marginBottom: 12 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, paddingTop: 14, borderTop: '0.5px solid #f5f3ef' }}>
        <Btn variant="ghost" onClick={onClose} style={{ flex: 1 }}>Cancel</Btn>
        <Btn onClick={save} disabled={saving} style={{ flex: 2 }}>
          {saving ? 'Saving...' : (isEdit ? 'Save Changes' : 'Create Contact')}
        </Btn>
      </div>
    </Modal>
  )
}

// ─────────────────────────────────────────────────────────────
// CSV Import Modal
// Frontend parses CSV (no library), maps columns to contact fields,
// shows preview, then POSTs to /contacts/bulk and displays results.
// ─────────────────────────────────────────────────────────────
function CsvImportModal({ onClose, onImported }) {
  const { token } = useAuth()
  const [stage, setStage] = useState('upload')  // upload | preview | result
  const [parsedRows, setParsedRows] = useState([])
  const [headers, setHeaders] = useState([])
  const [error, setError] = useState('')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState(null)

  // Map common CSV header variations to contact field names.
  // Lowercase, no spaces, no underscores for matching.
  const HEADER_MAP = {
    name: 'name', fullname: 'name', contactname: 'name',
    phone: 'phone', mobile: 'phone', whatsapp: 'phone', phonenumber: 'phone',
    email: 'email', emailaddress: 'email',
    type: 'type', contacttype: 'type',
    pipelinestage: 'pipeline_stage', stage: 'pipeline_stage', status: 'pipeline_stage',
    role: 'candidate_role', position: 'candidate_role', jobtitle: 'candidate_role', candidaterole: 'candidate_role',
    company: 'current_company', currentcompany: 'current_company', employer: 'current_company',
    notes: 'notes', remarks: 'notes',
    source: 'source',
  }

  function parseCsv(text) {
    // Minimal CSV parser. Handles quoted fields and commas inside quotes.
    // Returns { headers: string[], rows: object[] }
    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0)
    if (lines.length < 2) throw new Error('CSV needs at least a header row and one data row')
    const parseLine = (line) => {
      const result = []
      let cur = '', inQuotes = false
      for (let i = 0; i < line.length; i++) {
        const ch = line[i]
        if (inQuotes) {
          if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++ }
          else if (ch === '"') { inQuotes = false }
          else { cur += ch }
        } else {
          if (ch === '"') inQuotes = true
          else if (ch === ',') { result.push(cur); cur = '' }
          else { cur += ch }
        }
      }
      result.push(cur)
      return result.map(s => s.trim())
    }
    const rawHeaders = parseLine(lines[0])
    // Map headers to field names
    const mappedHeaders = rawHeaders.map(h => {
      const norm = h.toLowerCase().replace(/[\s_-]/g, '')
      return HEADER_MAP[norm] || null
    })
    const rows = []
    for (let i = 1; i < lines.length; i++) {
      const cells = parseLine(lines[i])
      const obj = {}
      mappedHeaders.forEach((field, idx) => {
        if (field) obj[field] = cells[idx] || ''
      })
      rows.push(obj)
    }
    return { headers: rawHeaders, mappedHeaders, rows }
  }

  function handleFile(e) {
    setError('')
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError('Please select a .csv file')
      return
    }
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const { headers, mappedHeaders, rows } = parseCsv(ev.target.result)
        setHeaders(headers.map((h, i) => ({ raw: h, mapped: mappedHeaders[i] })))
        setParsedRows(rows)
        setStage('preview')
      } catch (err) {
        setError(err.message)
      }
    }
    reader.onerror = () => setError('Failed to read file')
    reader.readAsText(file)
  }

  async function doImport() {
    setImporting(true)
    setError('')
    try {
      const r = await fetch(`${API}/contacts/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ rows: parsedRows }),
      })
      const data = await r.json()
      if (!r.ok) {
        setError(data.error || 'Import failed')
        return
      }
      setResult(data)
      setStage('result')
      onImported()
    } catch (err) {
      setError('Import failed: ' + err.message)
    } finally {
      setImporting(false)
    }
  }

  return (
    <Modal title="Import Contacts from CSV" subtitle="Upload a CSV file with contact data" onClose={onClose} width={720}>
      {stage === 'upload' && (
        <div style={{ padding: '20px 0' }}>
          <div style={{ fontSize: 12, color: '#6e6a63', marginBottom: 14 }}>
            Your CSV should have a header row. Common column names are auto-detected: Name, Phone, Email, Type, Stage, Role, Company, Notes, Source.
          </div>
          <div style={{ padding: 12, background: '#faf9f7', border: '0.5px solid #dcd8d0', borderRadius: 8, fontSize: 11, color: '#6e6a63', marginBottom: 14, lineHeight: 1.6 }}>
            <strong style={{ color: '#14130f' }}>Tips:</strong> Phones should be in E.164 format (+6591234567). Duplicate phones will be flagged. Maximum 5,000 rows per import. Required field: Name.
          </div>
          <label htmlFor="csv-upload-input" style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            width: '100%', padding: '32px 20px',
            border: '1px dashed #dcd8d0', borderRadius: 10,
            background: '#faf9f7', cursor: 'pointer', textAlign: 'center',
            transition: 'border-color .15s, background .15s'
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = ACCENT; e.currentTarget.style.background = ACCENT_LIGHT }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#dcd8d0'; e.currentTarget.style.background = '#faf9f7' }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#9a958c" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 10 }}>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#14130f', marginBottom: 4 }}>
              Click to choose a CSV file
            </div>
            <div style={{ fontSize: 11, color: '#9a958c' }}>
              or drag a .csv file onto this area
            </div>
          </label>
          <input id="csv-upload-input" type="file" accept=".csv" onChange={handleFile}
            style={{ display: 'none' }} />
          {error && (
            <div style={{ marginTop: 12, padding: '10px 12px', background: '#fef2f2', border: '0.5px solid #fecaca', borderRadius: 8, fontSize: 12, color: '#dc2626' }}>
              {error}
            </div>
          )}
        </div>
      )}

      {stage === 'preview' && (
        <div>
          <div style={{ fontSize: 13, color: '#14130f', marginBottom: 6 }}>
            <strong>{parsedRows.length}</strong> row{parsedRows.length !== 1 ? 's' : ''} parsed from CSV
          </div>
          <div style={{ marginBottom: 14, fontSize: 11, color: '#6e6a63' }}>
            Column mapping (auto-detected). Unmapped columns will be ignored.
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
            {headers.map((h, i) => (
              <span key={i} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6,
                background: h.mapped ? '#dcfce7' : '#f5f3ef',
                color: h.mapped ? '#16a34a' : '#9a958c',
                fontWeight: 500 }}>
                {h.raw} {h.mapped ? `${'\u2192'} ${h.mapped}` : '(ignored)'}
              </span>
            ))}
          </div>
          <div style={{ maxHeight: 280, overflowY: 'auto', border: '0.5px solid #dcd8d0', borderRadius: 8 }}>
            <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
              <thead style={{ position: 'sticky', top: 0, background: '#faf9f7' }}>
                <tr>
                  {['name', 'phone', 'email', 'type', 'pipeline_stage', 'candidate_role', 'current_company'].map(f => (
                    <th key={f} style={{ padding: '6px 8px', textAlign: 'left', borderBottom: '0.5px solid #dcd8d0', fontSize: 10, color: '#6e6a63', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{f}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {parsedRows.slice(0, 10).map((r, i) => (
                  <tr key={i} style={{ borderBottom: '0.5px solid #f5f3ef' }}>
                    {['name', 'phone', 'email', 'type', 'pipeline_stage', 'candidate_role', 'current_company'].map(f => (
                      <td key={f} style={{ padding: '5px 8px', color: '#4a4742' }}>{r[f] || '\u2014'}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {parsedRows.length > 10 && (
              <div style={{ padding: 10, textAlign: 'center', fontSize: 11, color: '#9a958c', background: '#faf9f7' }}>
                + {parsedRows.length - 10} more rows
              </div>
            )}
          </div>
          {error && (
            <div style={{ marginTop: 12, padding: '10px 12px', background: '#fef2f2', border: '0.5px solid #fecaca', borderRadius: 8, fontSize: 12, color: '#dc2626' }}>
              {error}
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, marginTop: 16, paddingTop: 14, borderTop: '0.5px solid #f5f3ef' }}>
            <Btn variant="ghost" onClick={() => { setStage('upload'); setParsedRows([]); setHeaders([]) }}>Back</Btn>
            <Btn onClick={doImport} disabled={importing} style={{ marginLeft: 'auto' }}>
              {importing ? 'Importing...' : `Import ${parsedRows.length} contact${parsedRows.length !== 1 ? 's' : ''}`}
            </Btn>
          </div>
        </div>
      )}

      {stage === 'result' && result && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
            <div style={{ background: '#dcfce7', padding: 14, borderRadius: 8, textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#16a34a' }}>{result.imported}</div>
              <div style={{ fontSize: 10, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.4px', fontWeight: 600 }}>Imported</div>
            </div>
            <div style={{ background: '#fef3c7', padding: 14, borderRadius: 8, textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#92400e' }}>{result.duplicates}</div>
              <div style={{ fontSize: 10, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.4px', fontWeight: 600 }}>Duplicates</div>
            </div>
            <div style={{ background: '#fee2e2', padding: 14, borderRadius: 8, textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#dc2626' }}>{result.invalid}</div>
              <div style={{ fontSize: 10, color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.4px', fontWeight: 600 }}>Invalid</div>
            </div>
          </div>
          {result.errors && result.errors.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#4a4742', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 8 }}>Issues by Row</div>
              <div style={{ maxHeight: 240, overflowY: 'auto', border: '0.5px solid #dcd8d0', borderRadius: 8 }}>
                {result.errors.map((e, i) => (
                  <div key={i} style={{ padding: '8px 12px', borderBottom: '0.5px solid #f5f3ef', fontSize: 11, display: 'flex', gap: 10 }}>
                    <span style={{ fontFamily: 'monospace', color: '#9a958c', minWidth: 50 }}>Row {e.row}</span>
                    <span style={{ color: '#4a4742' }}>{e.reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, marginTop: 16, paddingTop: 14, borderTop: '0.5px solid #f5f3ef' }}>
            <Btn onClick={onClose} style={{ marginLeft: 'auto' }}>Done</Btn>
          </div>
        </div>
      )}
    </Modal>
  )
}

// ─────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────
export default function Contacts() {
  const { token, user, hasPermission } = useAuth()
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('all')
  const [typeFilter, setTypeFilter] = useState('')
  const [search, setSearch] = useState('')
  const [showEditor, setShowEditor] = useState(false)
  const [editingContact, setEditingContact] = useState(null)
  const [showImport, setShowImport] = useState(false)

  useEffect(() => { if (!token) return; load() }, [token])

  async function load() {
    try {
      const r = await fetch(`${API}/contacts`, { headers: { Authorization: 'Bearer ' + token } })
      const data = await r.json()
      setContacts(Array.isArray(data) ? data : [])
    } catch {} finally { setLoading(false) }
  }

  async function deleteContact(c) {
    if (!confirm(`Delete contact "${c.name}"? This cannot be undone.`)) return
    try {
      const r = await fetch(`${API}/contacts/${c.id}`, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer ' + token },
      })
      if (!r.ok) {
        const d = await r.json()
        alert(d.error || 'Failed to delete')
        return
      }
      load()
    } catch (err) {
      alert('Failed to delete: ' + err.message)
    }
  }

  const canManage = hasPermission('manage_contacts')

  const filtered = useMemo(() => {
    return contacts.filter(c => {
      if (activeTab !== 'all' && c.pipeline_stage !== activeTab) return false
      if (typeFilter && c.type !== typeFilter) return false
      if (search) {
        const s = search.toLowerCase()
        const inName = c.name?.toLowerCase().includes(s)
        const inPhone = c.phone?.toLowerCase().includes(s)
        const inEmail = c.email?.toLowerCase().includes(s)
        const inCompany = c.current_company?.toLowerCase().includes(s)
        if (!inName && !inPhone && !inEmail && !inCompany) return false
      }
      return true
    })
  }, [contacts, activeTab, typeFilter, search])

  const counts = useMemo(() => {
    const c = { all: contacts.length }
    PIPELINE_STAGES.forEach(s => { c[s] = contacts.filter(x => x.pipeline_stage === s).length })
    return c
  }, [contacts])

  const totalCandidates = contacts.filter(c => c.type === 'candidate').length
  const totalClients = contacts.filter(c => c.type === 'client').length
  const totalDnc = contacts.filter(c => c.dnc).length
  const totalOptedOut = contacts.filter(c => c.opted_out).length

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#faf9f7' }}>
      <div className="px-4 pt-5 pb-4 md:px-7 md:pt-6" style={{ flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 14, marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#14130f', marginBottom: 4, letterSpacing: '-0.3px' }}>Contacts</div>
            <div style={{ fontSize: 12, color: '#6e6a63' }}>
              {totalCandidates} candidate{totalCandidates !== 1 ? 's' : ''} {'\u00b7'} {totalClients} client{totalClients !== 1 ? 's' : ''}
            </div>
          </div>
          {canManage && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Btn variant="ghost" onClick={() => setShowImport(true)}>Import CSV</Btn>
              <Btn onClick={() => { setEditingContact(null); setShowEditor(true) }}>+ New Contact</Btn>
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          {[
            { label: 'Total Contacts', value: contacts.length, color: contacts.length === 0 ? '#9a958c' : '#14130f' },
            { label: 'Candidates', value: totalCandidates, color: totalCandidates === 0 ? '#9a958c' : '#2d2a7a' },
            { label: 'Opted Out', value: totalOptedOut, color: totalOptedOut === 0 ? '#9a958c' : '#9a6a00' },
            { label: 'On DNC', value: totalDnc, color: totalDnc === 0 ? '#9a958c' : '#8e2a2a' },
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
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          style={{ padding: '5px 10px', border: '0.5px solid #dcd8d0', borderRadius: 7, fontSize: 12, background: '#faf9f7', color: '#14130f' }}>
          <option value="">All types</option>
          <option value="candidate">Candidates</option>
          <option value="client">Clients</option>
          <option value="vendor">Vendors</option>
          <option value="other">Other</option>
        </select>
        <div className="w-full md:w-auto md:ml-auto" style={{ position: 'relative' }}>
          <svg style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', width: 12, height: 12, color: '#9a958c', pointerEvents: 'none' }} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="7" cy="7" r="4"/>
            <path d="M10.5 10.5l3 3" strokeLinecap="round"/>
          </svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={`Search name, phone, email${'\u2026'}`}
            className="w-full md:w-[260px]"
            style={{ padding: '6px 10px 6px 26px', border: '0.5px solid #dcd8d0', borderRadius: 8, fontSize: 12, outline: 'none', background: '#faf9f7', color: '#14130f', boxSizing: 'border-box' }} />
        </div>
      </div>

      <div className="px-4 py-5 md:px-7" style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#9a958c', fontSize: 13 }}>Loading contacts{'\u2026'}</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#4a4742', marginBottom: 6 }}>
              {contacts.length === 0 ? 'No contacts yet' : 'No matching contacts'}
            </div>
            <div style={{ fontSize: 13, color: '#9a958c', marginBottom: 24, maxWidth: 380, margin: '0 auto 24px' }}>
              {contacts.length === 0
                ? 'Add candidates and clients to your workspace. Use them in broadcasts, conversations, and the recruitment pipeline.'
                : 'Try changing the filters or search query.'}
            </div>
            {canManage && contacts.length === 0 && (
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                <Btn onClick={() => { setEditingContact(null); setShowEditor(true) }}>+ Add your first contact</Btn>
                <Btn variant="ghost" onClick={() => setShowImport(true)}>Import CSV</Btn>
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map(c => (
              <ContactCard key={c.id} c={c} canManage={canManage}
                onEdit={(c) => { setEditingContact(c); setShowEditor(true) }}
                onDelete={deleteContact} />
            ))}
          </div>
        )}
      </div>

      {showEditor && (
        <ContactEditor
          contact={editingContact}
          onClose={() => { setShowEditor(false); setEditingContact(null) }}
          onSaved={load} />
      )}
      {showImport && (
        <CsvImportModal
          onClose={() => setShowImport(false)}
          onImported={load} />
      )}
    </div>
  )
}