import { useState, useEffect, useMemo, useRef } from 'react'
import { useAuth } from '../../context/AuthContext'
import { API } from '../../utils/constants'
import { ACCENT, ACCENT_LIGHT, NAVY } from '../../utils/designTokens'
import Btn from '../ui/Btn'
import Modal from '../ui/Modal'

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const TYPE_STYLES = {
  candidate: { bg: '#eeedf5', color: '#2d2a7a', label: 'Candidate' },
  client:    { bg: '#dcfce7', color: '#16a34a', label: 'Client' },
  vendor:    { bg: '#fef3c7', color: '#92400e', label: 'Vendor' },
  other:     { bg: '#f5f3ef', color: '#6e6a63', label: 'Other' },
}

const STAGE_STYLES = {
  new:          { bg: '#f5f3ef', color: '#6e6a63' },
  contacted:    { bg: '#eeedf5', color: '#2d2a7a' },
  screened:     { bg: '#ede9fe', color: '#5b21b6' },
  shortlisted:  { bg: '#ddd6fe', color: '#7c3aed' },
  interviewing: { bg: ACCENT_LIGHT, color: ACCENT },
  offered:      { bg: '#cffafe', color: '#0891b2' },
  hired:        { bg: '#dcfce7', color: '#16a34a' },
  rejected:     { bg: '#fee2e2', color: '#dc2626' },
  archived:     { bg: '#f5f3ef', color: '#9a958c' },
}

const PIPELINE_STAGES = [
  'new', 'contacted', 'screened', 'shortlisted',
  'interviewing', 'offered', 'hired', 'rejected', 'archived'
]

// Column definitions. Order = display order. Configurable later via column picker.
const ALL_COLUMNS = [
  { key: 'name',            label: 'Name',           width: 200, sortable: true,  required: true },
  { key: 'type',            label: 'Type',           width: 100, sortable: true },
  { key: 'pipeline_stage',  label: 'Stage',          width: 130, sortable: true },
  { key: 'phone',           label: 'Phone',          width: 140, sortable: true },
  { key: 'email',           label: 'Email',          width: 180, sortable: true },
  { key: 'candidate_role',  label: 'Role',           width: 160, sortable: true },
  { key: 'current_company', label: 'Company',        width: 140, sortable: true },
  { key: 'updated_at',      label: 'Last Updated',   width: 120, sortable: true },
  { key: 'flags',           label: 'Flags',          width: 100, sortable: false },
]

const DEFAULT_VISIBLE = ALL_COLUMNS.map(c => c.key)
const PAGE_SIZE_OPTIONS = [25, 50, 100, 200]

function capitalize(s) {
  if (!s) return ''
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function fmtDate(ts) {
  if (!ts) return '\u2014'
  const d = new Date(ts)
  const now = new Date()
  const diffDays = Math.floor((now - d) / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  return d.toLocaleDateString('en-SG', { year: 'numeric', month: 'short', day: '2-digit' })
}

// ─────────────────────────────────────────────────────────────
// Contact Editor — same as before, kept inline. PDPA + identity + career
// + tags. Used by both "+ New" button and row click.
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
    if (!t || form.tags.includes(t)) { setTagInput(''); return }
    update('tags', [...form.tags, t]); setTagInput('')
  }
  function removeTag(t) { update('tags', form.tags.filter(x => x !== t)) }

  async function save() {
    setError('')
    if (!form.name.trim()) { setError('Name is required'); return }
    setSaving(true)
    try {
      const url = isEdit ? `${API}/contacts/${contact.id}` : `${API}/contacts`
      const method = isEdit ? 'PATCH' : 'POST'
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
      if (isEdit) {
        payload.current_role = payload.candidate_role
        delete payload.candidate_role
      }
      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify(payload),
      })
      if (!r.ok) { const d = await r.json(); setError(d.error || 'Failed to save'); return }
      onSaved(); onClose()
    } catch (err) { setError('Failed: ' + err.message) }
    finally { setSaving(false) }
  }

  const fieldStyle = { width: '100%', padding: '8px 11px', border: '0.5px solid #dcd8d0', borderRadius: 7, fontSize: 12, outline: 'none', background: '#fff', color: '#14130f', boxSizing: 'border-box' }
  const labelStyle = { fontSize: 10, fontWeight: 600, color: '#4a4742', display: 'block', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.4px' }
  const sectionTitleStyle = { fontSize: 11, fontWeight: 600, color: '#4a4742', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 10, paddingBottom: 6, borderBottom: '0.5px solid #f5f3ef' }

  return (
    <Modal title={isEdit ? `Edit Contact - ${contact.name}` : 'New Contact'} subtitle={isEdit ? 'Update details' : 'Add a candidate, client, or vendor'} onClose={onClose} width={760}>
      <div style={{ marginBottom: 18 }}>
        <div style={sectionTitleStyle}>Identity</div>
        <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 10 }}>
          <div><label style={labelStyle}>Name <span style={{ color: '#ef4444' }}>*</span></label><input value={form.name} onChange={e => update('name', e.target.value)} style={fieldStyle} placeholder="Full name" /></div>
          <div><label style={labelStyle}>Phone (E.164)</label><input value={form.phone} onChange={e => update('phone', e.target.value)} style={fieldStyle} placeholder="+6591234567" /></div>
          <div><label style={labelStyle}>Email</label><input type="email" value={form.email} onChange={e => update('email', e.target.value)} style={fieldStyle} placeholder="name@example.com" /></div>
          <div><label style={labelStyle}>Type</label>
            <select value={form.type} onChange={e => update('type', e.target.value)} style={fieldStyle}>
              <option value="candidate">Candidate</option><option value="client">Client</option>
              <option value="vendor">Vendor</option><option value="other">Other</option>
            </select>
          </div>
          <div><label style={labelStyle}>Pipeline Stage</label>
            <select value={form.pipeline_stage} onChange={e => update('pipeline_stage', e.target.value)} style={fieldStyle}>
              {PIPELINE_STAGES.map(s => <option key={s} value={s}>{capitalize(s)}</option>)}
            </select>
          </div>
          <div><label style={labelStyle}>Source</label><input value={form.source} onChange={e => update('source', e.target.value)} style={fieldStyle} placeholder="LinkedIn, referral..." /></div>
        </div>
      </div>

      <div style={{ marginBottom: 18 }}>
        <div style={sectionTitleStyle}>Career Details</div>
        <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 10 }}>
          <div><label style={labelStyle}>Role / Position</label><input value={form.candidate_role} onChange={e => update('candidate_role', e.target.value)} style={fieldStyle} placeholder="Software Engineer" /></div>
          <div><label style={labelStyle}>Current Company</label><input value={form.current_company} onChange={e => update('current_company', e.target.value)} style={fieldStyle} placeholder="Acme Corp" /></div>
          <div><label style={labelStyle}>Expected Salary (SGD)</label><input type="number" value={form.expected_salary} onChange={e => update('expected_salary', e.target.value)} style={fieldStyle} placeholder="6500" /></div>
          <div><label style={labelStyle}>Notice Period</label><input value={form.notice_period} onChange={e => update('notice_period', e.target.value)} style={fieldStyle} placeholder="1 month" /></div>
          <div className="sm:col-span-2"><label style={labelStyle}>LinkedIn URL</label><input value={form.linkedin_url} onChange={e => update('linkedin_url', e.target.value)} style={fieldStyle} placeholder="https://linkedin.com/in/..." /></div>
        </div>
      </div>

      <div style={{ marginBottom: 18 }}>
        <div style={sectionTitleStyle}>Tags & Notes</div>
        <div style={{ marginBottom: 10 }}>
          <label style={labelStyle}>Tags</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
            {form.tags.map(t => (
              <span key={t} style={{ fontSize: 11, padding: '3px 9px', borderRadius: 6, background: ACCENT_LIGHT, color: ACCENT, display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                {t}<button onClick={() => removeTag(t)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: ACCENT, padding: 0, fontSize: 12 }}>×</button>
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
            style={{ ...fieldStyle, resize: 'vertical', fontFamily: 'inherit' }} placeholder="Internal notes..." />
        </div>
      </div>

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
            <input value={form.dnc_reason} onChange={e => update('dnc_reason', e.target.value)} style={fieldStyle} placeholder="Why is this contact on DNC?" />
          </div>
        )}
      </div>

      {error && (<div style={{ padding: '10px 12px', background: '#fef2f2', border: '0.5px solid #fecaca', borderRadius: 8, fontSize: 12, color: '#dc2626', marginBottom: 12 }}>{error}</div>)}

      <div style={{ display: 'flex', gap: 10, paddingTop: 14, borderTop: '0.5px solid #f5f3ef' }}>
        <Btn variant="ghost" onClick={onClose} style={{ flex: 1 }}>Cancel</Btn>
        <Btn onClick={save} disabled={saving} style={{ flex: 2 }}>{saving ? 'Saving...' : (isEdit ? 'Save Changes' : 'Create Contact')}</Btn>
      </div>
    </Modal>
  )
}

// ─────────────────────────────────────────────────────────────
// CSV Import — kept as-is from previous version
// ─────────────────────────────────────────────────────────────
function CsvImportModal({ onClose, onImported }) {
  const { token } = useAuth()
  const [stage, setStage] = useState('upload')
  const [parsedRows, setParsedRows] = useState([])
  const [headers, setHeaders] = useState([])
  const [error, setError] = useState('')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState(null)

  const HEADER_MAP = {
    name: 'name', fullname: 'name', contactname: 'name',
    phone: 'phone', mobile: 'phone', whatsapp: 'phone', phonenumber: 'phone',
    email: 'email', emailaddress: 'email', type: 'type', contacttype: 'type',
    pipelinestage: 'pipeline_stage', stage: 'pipeline_stage', status: 'pipeline_stage',
    role: 'candidate_role', position: 'candidate_role', jobtitle: 'candidate_role', candidaterole: 'candidate_role',
    company: 'current_company', currentcompany: 'current_company', employer: 'current_company',
    notes: 'notes', remarks: 'notes', source: 'source',
  }

  function parseCsv(text) {
    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0)
    if (lines.length < 2) throw new Error('CSV needs header + at least one data row')
    const parseLine = (line) => {
      const result = []; let cur = '', inQuotes = false
      for (let i = 0; i < line.length; i++) {
        const ch = line[i]
        if (inQuotes) {
          if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++ }
          else if (ch === '"') inQuotes = false
          else cur += ch
        } else {
          if (ch === '"') inQuotes = true
          else if (ch === ',') { result.push(cur); cur = '' }
          else cur += ch
        }
      }
      result.push(cur); return result.map(s => s.trim())
    }
    const rawHeaders = parseLine(lines[0])
    const mappedHeaders = rawHeaders.map(h => {
      const norm = h.toLowerCase().replace(/[\s_-]/g, '')
      return HEADER_MAP[norm] || null
    })
    const rows = []
    for (let i = 1; i < lines.length; i++) {
      const cells = parseLine(lines[i]); const obj = {}
      mappedHeaders.forEach((field, idx) => { if (field) obj[field] = cells[idx] || '' })
      rows.push(obj)
    }
    return { headers: rawHeaders, mappedHeaders, rows }
  }

  function handleFile(e) {
    setError('')
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.csv')) { setError('Please select a .csv file'); return }
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const { headers, mappedHeaders, rows } = parseCsv(ev.target.result)
        setHeaders(headers.map((h, i) => ({ raw: h, mapped: mappedHeaders[i] })))
        setParsedRows(rows); setStage('preview')
      } catch (err) { setError(err.message) }
    }
    reader.onerror = () => setError('Failed to read file')
    reader.readAsText(file)
  }

  async function doImport() {
    setImporting(true); setError('')
    try {
      const r = await fetch(`${API}/contacts/bulk`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ rows: parsedRows }),
      })
      const data = await r.json()
      if (!r.ok) { setError(data.error || 'Import failed'); return }
      setResult(data); setStage('result'); onImported()
    } catch (err) { setError('Failed: ' + err.message) }
    finally { setImporting(false) }
  }

  return (
    <Modal title="Import Contacts from CSV" subtitle="Upload a CSV file with contact data" onClose={onClose} width={720}>
      {stage === 'upload' && (
        <div style={{ padding: '20px 0' }}>
          <div style={{ fontSize: 12, color: '#6e6a63', marginBottom: 14 }}>
            Your CSV should have a header row. Common column names auto-detected: Name, Phone, Email, Type, Stage, Role, Company, Notes, Source.
          </div>
          <div style={{ padding: 12, background: '#faf9f7', border: '0.5px solid #dcd8d0', borderRadius: 8, fontSize: 11, color: '#6e6a63', marginBottom: 14, lineHeight: 1.6 }}>
            <strong style={{ color: '#14130f' }}>Tips:</strong> Phones in E.164 format (+6591234567). Duplicate phones flagged. Max 5,000 rows. Required: Name.
          </div>
          <label htmlFor="csv-upload-input" style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            width: '100%', padding: '32px 20px', border: '1px dashed #dcd8d0', borderRadius: 10,
            background: '#faf9f7', cursor: 'pointer', textAlign: 'center', transition: 'border-color .15s, background .15s'
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = ACCENT; e.currentTarget.style.background = ACCENT_LIGHT }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#dcd8d0'; e.currentTarget.style.background = '#faf9f7' }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#9a958c" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 10 }}>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#14130f', marginBottom: 4 }}>Click to choose a CSV file</div>
            <div style={{ fontSize: 11, color: '#9a958c' }}>or drag a .csv file onto this area</div>
          </label>
          <input id="csv-upload-input" type="file" accept=".csv" onChange={handleFile} style={{ display: 'none' }} />
          {error && (<div style={{ marginTop: 12, padding: '10px 12px', background: '#fef2f2', border: '0.5px solid #fecaca', borderRadius: 8, fontSize: 12, color: '#dc2626' }}>{error}</div>)}
        </div>
      )}
      {stage === 'preview' && (
        <div>
          <div style={{ fontSize: 13, color: '#14130f', marginBottom: 6 }}>
            <strong>{parsedRows.length}</strong> row{parsedRows.length !== 1 ? 's' : ''} parsed
          </div>
          <div style={{ marginBottom: 14, fontSize: 11, color: '#6e6a63' }}>Column mapping (auto-detected). Unmapped columns ignored.</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
            {headers.map((h, i) => (
              <span key={i} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, background: h.mapped ? '#dcfce7' : '#f5f3ef', color: h.mapped ? '#16a34a' : '#9a958c', fontWeight: 500 }}>
                {h.raw} {h.mapped ? `\u2192 ${h.mapped}` : '(ignored)'}
              </span>
            ))}
          </div>
          <div style={{ maxHeight: 280, overflowY: 'auto', border: '0.5px solid #dcd8d0', borderRadius: 8 }}>
            <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
              <thead style={{ position: 'sticky', top: 0, background: '#faf9f7' }}>
                <tr>{['name', 'phone', 'email', 'type', 'pipeline_stage', 'candidate_role', 'current_company'].map(f => (
                  <th key={f} style={{ padding: '6px 8px', textAlign: 'left', borderBottom: '0.5px solid #dcd8d0', fontSize: 10, color: '#6e6a63', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{f}</th>
                ))}</tr>
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
            {parsedRows.length > 10 && (<div style={{ padding: 10, textAlign: 'center', fontSize: 11, color: '#9a958c', background: '#faf9f7' }}>+ {parsedRows.length - 10} more rows</div>)}
          </div>
          {error && (<div style={{ marginTop: 12, padding: '10px 12px', background: '#fef2f2', border: '0.5px solid #fecaca', borderRadius: 8, fontSize: 12, color: '#dc2626' }}>{error}</div>)}
          <div style={{ display: 'flex', gap: 10, marginTop: 16, paddingTop: 14, borderTop: '0.5px solid #f5f3ef' }}>
            <Btn variant="ghost" onClick={() => { setStage('upload'); setParsedRows([]); setHeaders([]) }}>Back</Btn>
            <Btn onClick={doImport} disabled={importing} style={{ marginLeft: 'auto' }}>{importing ? 'Importing...' : `Import ${parsedRows.length} contact${parsedRows.length !== 1 ? 's' : ''}`}</Btn>
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
// Small filter chip — name + remove button. Used in the active filter strip.
// ─────────────────────────────────────────────────────────────
function FilterChip({ label, onRemove }) {
  return (
    <span style={{
      fontSize: 11, padding: '3px 4px 3px 9px', borderRadius: 14,
      background: '#fff', border: `0.5px solid ${ACCENT}`, color: ACCENT,
      display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 500
    }}>
      {label}
      <button onClick={onRemove} aria-label={`Remove ${label}`}
        style={{
          background: 'transparent', border: 'none', cursor: 'pointer',
          padding: 0, color: ACCENT, display: 'inline-flex',
          width: 16, height: 16, borderRadius: '50%',
          alignItems: 'center', justifyContent: 'center'
        }}
        onMouseEnter={e => e.currentTarget.style.background = ACCENT_LIGHT}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <line x1="3" y1="3" x2="9" y2="9"/>
          <line x1="9" y1="3" x2="3" y2="9"/>
        </svg>
      </button>
    </span>
  )
}

// ─────────────────────────────────────────────────────────────
// Filter Drawer — slide-in panel from the left with all filter sections.
// Each section is collapsible. State lives in the parent (Contacts) so
// changes apply immediately without an "Apply" button.
// ─────────────────────────────────────────────────────────────
function FilterDrawer({
  open, onClose,
  contacts,
  filterStages, setFilterStages,
  filterTypes, setFilterTypes,
  filterTags, setFilterTags,
  filterPdpa, setFilterPdpa,
  filterDnc, setFilterDnc,
  filterOptedOut, setFilterOptedOut,
  filterHasPhone, setFilterHasPhone,
  filterHasEmail, setFilterHasEmail,
  filterDateRange, setFilterDateRange,
  toggleSetMember,
  clearAllFilters,
  activeFilterCount,
}) {
  // Compute available tags from current contacts (only show tags that exist)
  const availableTags = useMemo(() => {
    const tagSet = new Set()
    contacts.forEach(c => {
      if (Array.isArray(c.tags)) c.tags.forEach(t => tagSet.add(t))
    })
    return [...tagSet].sort()
  }, [contacts])

  // Stage counts for the filter UI — show how many contacts are in each stage
  const stageCounts = useMemo(() => {
    const counts = {}
    contacts.forEach(c => {
      const k = c.pipeline_stage || 'new'
      counts[k] = (counts[k] || 0) + 1
    })
    return counts
  }, [contacts])

  const typeCounts = useMemo(() => {
    const counts = {}
    contacts.forEach(c => {
      const k = c.type || 'other'
      counts[k] = (counts[k] || 0) + 1
    })
    return counts
  }, [contacts])

  if (!open) return null

  const sectionTitleStyle = {
    fontSize: 10, fontWeight: 600, color: '#4a4742',
    textTransform: 'uppercase', letterSpacing: '0.5px',
    marginBottom: 8, paddingBottom: 6,
    borderBottom: '0.5px solid #f5f3ef'
  }

  const checkboxRowStyle = {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '4px 0', cursor: 'pointer',
    fontSize: 12, color: '#4a4742'
  }

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(20,19,15,0.3)', zIndex: 50
      }} />

      {/* Drawer */}
      <div style={{
        position: 'fixed', top: 0, left: 0, bottom: 0,
        width: 320, background: '#fff',
        boxShadow: '4px 0 16px rgba(0,0,0,0.1)',
        zIndex: 51,
        display: 'flex', flexDirection: 'column',
        animation: 'slideInLeft .2s ease-out'
      }}>
        <style>{`
          @keyframes slideInLeft {
            from { transform: translateX(-100%); }
            to { transform: translateX(0); }
          }
        `}</style>

        {/* Header */}
        <div style={{
          padding: '16px 20px', borderBottom: '0.5px solid #dcd8d0',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0
        }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#14130f' }}>Filters</div>
            <div style={{ fontSize: 11, color: '#9a958c', marginTop: 2 }}>
              {activeFilterCount === 0 ? 'No filters active' : `${activeFilterCount} active filter${activeFilterCount !== 1 ? 's' : ''}`}
            </div>
          </div>
          <button onClick={onClose}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 4, color: '#9a958c' }}
            aria-label="Close filters">
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <line x1="4" y1="4" x2="12" y2="12"/>
              <line x1="12" y1="4" x2="4" y2="12"/>
            </svg>
          </button>
        </div>

        {/* Body — scrollable filter sections */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {/* Pipeline Stage */}
          <div style={{ marginBottom: 18 }}>
            <div style={sectionTitleStyle}>Pipeline Stage</div>
            {PIPELINE_STAGES.map(s => {
              const checked = filterStages.has(s)
              const count = stageCounts[s] || 0
              return (
                <label key={s} style={{ ...checkboxRowStyle, opacity: count === 0 ? 0.5 : 1 }}>
                  <input type="checkbox" checked={checked} onChange={() => toggleSetMember(setFilterStages, s)}
                    style={{ accentColor: ACCENT, cursor: 'pointer' }} />
                  <span style={{ flex: 1 }}>{capitalize(s)}</span>
                  <span style={{ fontSize: 10, color: '#9a958c' }}>{count}</span>
                </label>
              )
            })}
          </div>

          {/* Type */}
          <div style={{ marginBottom: 18 }}>
            <div style={sectionTitleStyle}>Type</div>
            {['candidate', 'client', 'vendor', 'other'].map(t => {
              const checked = filterTypes.has(t)
              const count = typeCounts[t] || 0
              return (
                <label key={t} style={{ ...checkboxRowStyle, opacity: count === 0 ? 0.5 : 1 }}>
                  <input type="checkbox" checked={checked} onChange={() => toggleSetMember(setFilterTypes, t)}
                    style={{ accentColor: ACCENT, cursor: 'pointer' }} />
                  <span style={{ flex: 1 }}>{capitalize(t)}</span>
                  <span style={{ fontSize: 10, color: '#9a958c' }}>{count}</span>
                </label>
              )
            })}
          </div>

          {/* Tags */}
          {availableTags.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <div style={sectionTitleStyle}>Tags</div>
              <div style={{ maxHeight: 180, overflowY: 'auto' }}>
                {availableTags.map(t => {
                  const checked = filterTags.has(t)
                  return (
                    <label key={t} style={checkboxRowStyle}>
                      <input type="checkbox" checked={checked} onChange={() => toggleSetMember(setFilterTags, t)}
                        style={{ accentColor: ACCENT, cursor: 'pointer' }} />
                      <span style={{ flex: 1 }}>{t}</span>
                    </label>
                  )
                })}
              </div>
            </div>
          )}

          {/* Last Updated */}
          <div style={{ marginBottom: 18 }}>
            <div style={sectionTitleStyle}>Last Updated</div>
            {[
              { key: 'all',   label: 'Any time' },
              { key: 'today', label: 'Today' },
              { key: '7d',    label: 'Last 7 days' },
              { key: '30d',   label: 'Last 30 days' },
            ].map(opt => (
              <label key={opt.key} style={checkboxRowStyle}>
                <input type="radio" name="dateRange" checked={filterDateRange === opt.key}
                  onChange={() => setFilterDateRange(opt.key)}
                  style={{ accentColor: ACCENT, cursor: 'pointer' }} />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>

          {/* Compliance */}
          <div style={{ marginBottom: 18 }}>
            <div style={sectionTitleStyle}>Compliance</div>
            <label style={checkboxRowStyle}>
              <input type="checkbox" checked={filterPdpa} onChange={e => setFilterPdpa(e.target.checked)}
                style={{ accentColor: ACCENT, cursor: 'pointer' }} />
              <span>PDPA consented</span>
            </label>
            <label style={checkboxRowStyle}>
              <input type="checkbox" checked={filterDnc} onChange={e => setFilterDnc(e.target.checked)}
                style={{ accentColor: ACCENT, cursor: 'pointer' }} />
              <span>On DNC list</span>
            </label>
            <label style={checkboxRowStyle}>
              <input type="checkbox" checked={filterOptedOut} onChange={e => setFilterOptedOut(e.target.checked)}
                style={{ accentColor: ACCENT, cursor: 'pointer' }} />
              <span>Opted out of comms</span>
            </label>
          </div>

          {/* Data completeness */}
          <div style={{ marginBottom: 18 }}>
            <div style={sectionTitleStyle}>Data Completeness</div>
            <label style={checkboxRowStyle}>
              <input type="checkbox" checked={filterHasPhone} onChange={e => setFilterHasPhone(e.target.checked)}
                style={{ accentColor: ACCENT, cursor: 'pointer' }} />
              <span>Has phone number</span>
            </label>
            <label style={checkboxRowStyle}>
              <input type="checkbox" checked={filterHasEmail} onChange={e => setFilterHasEmail(e.target.checked)}
                style={{ accentColor: ACCENT, cursor: 'pointer' }} />
              <span>Has email address</span>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px', borderTop: '0.5px solid #dcd8d0',
          display: 'flex', gap: 10, flexShrink: 0
        }}>
          <Btn variant="ghost" onClick={clearAllFilters} disabled={activeFilterCount === 0} style={{ flex: 1 }}>
            Clear all
          </Btn>
          <Btn onClick={onClose} style={{ flex: 1 }}>Done</Btn>
        </div>
      </div>
    </>
  )
}

// ─────────────────────────────────────────────────────────────
// Saved view tab with kebab menu for owner actions.
// Uses a click-outside handler so the popover dismisses cleanly.
// ─────────────────────────────────────────────────────────────
function SavedViewTab({ view, isActive, isOwner, onClick, onDelete }) {
  const [menuPos, setMenuPos] = useState(null)  // null = closed; {top, right} = open with position
  const kebabRef = useRef(null)
  const popoverRef = useRef(null)

  useEffect(() => {
    if (!menuPos) return
    function onClickOutside(e) {
      // Close if click is outside both the kebab button and the popover
      if (
        kebabRef.current && !kebabRef.current.contains(e.target) &&
        popoverRef.current && !popoverRef.current.contains(e.target)
      ) {
        setMenuPos(null)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [menuPos])

  function openMenu(e) {
    e.stopPropagation()
    if (menuPos) { setMenuPos(null); return }
    const rect = kebabRef.current.getBoundingClientRect()
    setMenuPos({
      top: rect.bottom + 4,
      right: window.innerWidth - rect.right
    })
  }

  return (
    <div style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        onClick={onClick}
        style={{
          padding: '10px 8px 10px 14px',
          fontSize: 12, fontWeight: isActive ? 600 : 500,
          border: 'none', background: 'transparent',
          color: isActive ? ACCENT : '#6e6a63',
          borderBottom: isActive ? `2px solid ${ACCENT}` : '2px solid transparent',
          cursor: 'pointer', whiteSpace: 'nowrap',
          display: 'inline-flex', alignItems: 'center', gap: 6,
          transition: 'color .15s'
        }}>
        {view.is_shared && (
          <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="6" cy="5" r="2.5"/>
            <circle cx="11" cy="5" r="2.5"/>
            <path d="M2 13c0-2 2-3.5 4-3.5s4 1.5 4 3.5"/>
            <path d="M9 13c0-2 2-3.5 4-3.5"/>
          </svg>
        )}
        {view.name}
      </button>
      {isOwner && (
        <button
          ref={kebabRef}
          onClick={openMenu}
          style={{
            padding: '6px 8px',
            border: 'none', background: 'transparent',
            color: menuPos ? ACCENT : '#9a958c',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center',
            borderRadius: 4
          }}
          onMouseEnter={e => { if (!menuPos) e.currentTarget.style.background = '#f5f3ef' }}
          onMouseLeave={e => { if (!menuPos) e.currentTarget.style.background = 'transparent' }}
          aria-label={`More actions for ${view.name}`}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <circle cx="8" cy="3" r="1.4"/>
            <circle cx="8" cy="8" r="1.4"/>
            <circle cx="8" cy="13" r="1.4"/>
          </svg>
        </button>
      )}
      {menuPos && (
        <div ref={popoverRef} style={{
          position: 'fixed',
          top: menuPos.top, right: menuPos.right,
          minWidth: 160,
          background: '#fff', border: '0.5px solid #dcd8d0', borderRadius: 8,
          boxShadow: '0 6px 20px rgba(0,0,0,0.08)',
          zIndex: 100, padding: 4
        }}>
          <button
            onClick={() => { setMenuPos(null); onDelete() }}
            style={{
              width: '100%', padding: '8px 12px',
              fontSize: 12, color: '#dc2626', fontWeight: 500,
              background: 'transparent', border: 'none', cursor: 'pointer',
              textAlign: 'left', borderRadius: 5,
              display: 'flex', alignItems: 'center', gap: 8
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#fef2f2'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 5 13 5"/>
              <path d="M5 5v8a1 1 0 001 1h4a1 1 0 001-1V5"/>
              <path d="M6 5V3a1 1 0 011-1h2a1 1 0 011 1v2"/>
            </svg>
            Delete view
          </button>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Save view modal — name + share toggle
// ─────────────────────────────────────────────────────────────
function SaveViewModal({ onSave, onClose }) {
  const [name, setName] = useState('')
  const [isShared, setIsShared] = useState(false)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!name.trim()) return
    setSaving(true)
    await onSave(name.trim(), isShared)
    setSaving(false)
    onClose()
  }

  return (
    <Modal title="Save current view" subtitle="Save your current filters and sort as a reusable view" onClose={onClose} width={420}>
      <div style={{ padding: '12px 0' }}>
        <label style={{ fontSize: 11, fontWeight: 600, color: '#4a4742', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.4px' }}>View Name</label>
        <input value={name} onChange={e => setName(e.target.value)} autoFocus
          onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
          placeholder="e.g. Active Engineering Candidates"
          style={{ width: '100%', padding: '9px 12px', border: '0.5px solid #dcd8d0', borderRadius: 7, fontSize: 13, background: '#fff', color: '#14130f', boxSizing: 'border-box', outline: 'none' }} />
      </div>
      <div style={{ padding: '8px 0 12px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input type="checkbox" checked={isShared} onChange={e => setIsShared(e.target.checked)}
            style={{ accentColor: ACCENT, cursor: 'pointer' }} />
          <span style={{ fontSize: 12, color: '#14130f' }}>Share with workspace</span>
        </label>
        <div style={{ fontSize: 11, color: '#9a958c', marginLeft: 24, marginTop: 4 }}>
          Shared views are visible to all teammates. Only you can edit or delete them.
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, paddingTop: 14, borderTop: '0.5px solid #f5f3ef' }}>
        <Btn variant="ghost" onClick={onClose} style={{ flex: 1 }}>Cancel</Btn>
        <Btn onClick={handleSave} disabled={!name.trim() || saving} style={{ flex: 2 }}>
          {saving ? 'Saving...' : 'Save view'}
        </Btn>
      </div>
    </Modal>
  )
}

// ─────────────────────────────────────────────────────────────
// Bulk Stage Change Modal
// ─────────────────────────────────────────────────────────────
function BulkStageModal({ count, onConfirm, onClose }) {
  const [stage, setStage] = useState('contacted')
  return (
    <Modal title={`Change stage for ${count} contact${count !== 1 ? 's' : ''}`} onClose={onClose} width={420}>
      <div style={{ padding: '12px 0' }}>
        <label style={{ fontSize: 11, fontWeight: 600, color: '#4a4742', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.4px' }}>New Stage</label>
        <select value={stage} onChange={e => setStage(e.target.value)}
          style={{ width: '100%', padding: '9px 12px', border: '0.5px solid #dcd8d0', borderRadius: 7, fontSize: 13, background: '#fff', color: '#14130f' }}>
          {PIPELINE_STAGES.map(s => <option key={s} value={s}>{capitalize(s)}</option>)}
        </select>
      </div>
      <div style={{ display: 'flex', gap: 10, paddingTop: 14, borderTop: '0.5px solid #f5f3ef' }}>
        <Btn variant="ghost" onClick={onClose} style={{ flex: 1 }}>Cancel</Btn>
        <Btn onClick={() => onConfirm(stage)} style={{ flex: 1 }}>Apply</Btn>
      </div>
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
  const [search, setSearch] = useState('')
  const [showEditor, setShowEditor] = useState(false)
  const [editingContact, setEditingContact] = useState(null)
  const [showImport, setShowImport] = useState(false)
  const [showBulkStage, setShowBulkStage] = useState(false)

  // Sort state
  const [sortBy, setSortBy] = useState('updated_at')
  const [sortDir, setSortDir] = useState('desc')

  // Selection state
  const [selected, setSelected] = useState(new Set())
  const [bulkRunning, setBulkRunning] = useState(false)

  // Pagination + density
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [density, setDensity] = useState('comfortable')
  // Card layout below 768px — table swiping is broken on mobile and there
  // are too many columns to display anyway. Same breakpoint as Settings.jsx.
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth < 768)
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  useEffect(() => { if (!token) return; load(); loadViews() }, [token])

  async function load() {
    try {
      const r = await fetch(`${API}/contacts`, { headers: { Authorization: 'Bearer ' + token } })
      const data = await r.json()
      setContacts(Array.isArray(data) ? data : [])
    } catch {} finally { setLoading(false) }
  }

  async function loadViews() {
    try {
      const r = await fetch(`${API}/contact-views`, { headers: { Authorization: 'Bearer ' + token } })
      if (!r.ok) return
      const data = await r.json()
      setViews(Array.isArray(data) ? data : [])
    } catch {}
  }

  // Apply a saved view's config to the current table state.
  // Null = reset to "All Contacts" defaults.
  function applyView(view) {
    if (!view) {
      // Default: clear all filters and reset sort
      clearAllFilters()
      setSortBy('updated_at')
      setSortDir('desc')
      setActiveViewId(null)
      return
    }
    const f = view.filters || {}
    setFilterStages(new Set(f.stages || []))
    setFilterTypes(new Set(f.types || []))
    setFilterTags(new Set(f.tags || []))
    setFilterPdpa(!!f.pdpa)
    setFilterDnc(!!f.dnc)
    setFilterOptedOut(!!f.opted_out)
    setFilterHasPhone(!!f.has_phone)
    setFilterHasEmail(!!f.has_email)
    setFilterDateRange(f.date_range || 'all')
    if (view.sort?.by) setSortBy(view.sort.by)
    if (view.sort?.dir) setSortDir(view.sort.dir)
    setActiveViewId(view.id)
  }

  // Snapshot current filter/sort state for saving as a view
  function getCurrentViewConfig() {
    return {
      filters: {
        stages: [...filterStages],
        types: [...filterTypes],
        tags: [...filterTags],
        pdpa: filterPdpa,
        dnc: filterDnc,
        opted_out: filterOptedOut,
        has_phone: filterHasPhone,
        has_email: filterHasEmail,
        date_range: filterDateRange,
      },
      sort: { by: sortBy, dir: sortDir },
      columns: [],  // column visibility — not implemented yet, future use
    }
  }

  async function saveView(name, isShared) {
    const config = getCurrentViewConfig()
    try {
      const r = await fetch(`${API}/contact-views`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ name, ...config, is_shared: isShared }),
      })
      if (!r.ok) { const d = await r.json(); alert(d.error || 'Failed to save view'); return }
      const newView = await r.json()
      setViews(prev => [newView, ...prev])
      setActiveViewId(newView.id)
    } catch (err) {
      alert('Failed: ' + err.message)
    }
  }

  async function deleteView(viewId) {
    if (!confirm('Delete this saved view?')) return
    try {
      const r = await fetch(`${API}/contact-views/${viewId}`, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer ' + token },
      })
      if (!r.ok) { const d = await r.json(); alert(d.error || 'Failed to delete'); return }
      setViews(prev => prev.filter(v => v.id !== viewId))
      if (activeViewId === viewId) setActiveViewId(null)
    } catch (err) {
      alert('Failed: ' + err.message)
    }
  }

  async function deleteOne(c) {
    if (!confirm(`Delete "${c.name}"?`)) return
    try {
      const r = await fetch(`${API}/contacts/${c.id}`, { method: 'DELETE', headers: { Authorization: 'Bearer ' + token } })
      if (!r.ok) { const d = await r.json(); alert(d.error || 'Failed'); return }
      load()
    } catch (err) { alert('Failed: ' + err.message) }
  }

  async function bulkAction(action, payload) {
    const ids = [...selected]
    if (ids.length === 0) return
    setBulkRunning(true)
    try {
      const r = await fetch(`${API}/contacts/bulk-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ ids, action, payload }),
      })
      if (!r.ok) { const d = await r.json(); alert(d.error || 'Bulk action failed'); return }
      const data = await r.json()
      setSelected(new Set())
      load()
      // Lightweight feedback. Could be toasts later.
      console.log(`Bulk ${action}: ${data.affected} affected`)
    } catch (err) {
      alert('Failed: ' + err.message)
    } finally {
      setBulkRunning(false)
    }
  }

  const canManage = hasPermission('manage_contacts')
  const isDirector = user?.role === 'director'

  // Faceted filter state. Sets for multi-select, plain values for single toggles.
  // Default: empty filters means "show everything" (no constraint).
  const [filterStages, setFilterStages] = useState(new Set())
  const [filterTypes, setFilterTypes] = useState(new Set())
  const [filterTags, setFilterTags] = useState(new Set())
  const [filterPdpa, setFilterPdpa] = useState(false)        // only PDPA-consented
  const [filterDnc, setFilterDnc] = useState(false)          // only on DNC
  const [filterOptedOut, setFilterOptedOut] = useState(false) // only opted-out
  const [filterDateRange, setFilterDateRange] = useState('all')   // all | today | 7d | 30d
  const [filterHasPhone, setFilterHasPhone] = useState(false)
  const [filterHasEmail, setFilterHasEmail] = useState(false)
  const [showFilterDrawer, setShowFilterDrawer] = useState(false)

  // Saved views state
  const [views, setViews] = useState([])
  const [activeViewId, setActiveViewId] = useState(null)  // null = "All Contacts" default
  const [showSaveViewModal, setShowSaveViewModal] = useState(false)

  // Apply all filters together. Search is OR across fields; faceted filters
  // are AND with each other (must match all active filters).
  const filtered = useMemo(() => {
    const now = Date.now()
    const dayMs = 24 * 60 * 60 * 1000
    return contacts.filter(c => {
      // Search
      if (search) {
        const s = search.toLowerCase()
        const inSearch =
          c.name?.toLowerCase().includes(s) ||
          c.phone?.toLowerCase().includes(s) ||
          c.email?.toLowerCase().includes(s) ||
          c.candidate_role?.toLowerCase().includes(s) ||
          c.current_company?.toLowerCase().includes(s)
        if (!inSearch) return false
      }
      // Stage filter
      if (filterStages.size > 0 && !filterStages.has(c.pipeline_stage)) return false
      // Type filter
      if (filterTypes.size > 0 && !filterTypes.has(c.type)) return false
      // Tag filter — contact must have at least one of the selected tags
      if (filterTags.size > 0) {
        const cTags = Array.isArray(c.tags) ? c.tags : []
        if (!cTags.some(t => filterTags.has(t))) return false
      }
      // Compliance toggles
      if (filterPdpa && !c.pdpa_consented) return false
      if (filterDnc && !c.dnc) return false
      if (filterOptedOut && !c.opted_out) return false
      // Data completeness toggles
      if (filterHasPhone && !c.phone) return false
      if (filterHasEmail && !c.email) return false
      // Date range filter on updated_at
      if (filterDateRange !== 'all' && c.updated_at) {
        const updated = new Date(c.updated_at).getTime()
        const cutoff =
          filterDateRange === 'today' ? now - dayMs :
          filterDateRange === '7d'    ? now - 7 * dayMs :
          filterDateRange === '30d'   ? now - 30 * dayMs : 0
        if (updated < cutoff) return false
      }
      return true
    })
  }, [contacts, search, filterStages, filterTypes, filterTags, filterPdpa, filterDnc, filterOptedOut, filterHasPhone, filterHasEmail, filterDateRange])

  // Total count of active filters (for the badge on the Filters button)
  const activeFilterCount =
    filterStages.size + filterTypes.size + filterTags.size +
    (filterPdpa ? 1 : 0) + (filterDnc ? 1 : 0) + (filterOptedOut ? 1 : 0) +
    (filterHasPhone ? 1 : 0) + (filterHasEmail ? 1 : 0) +
    (filterDateRange !== 'all' ? 1 : 0)

  function clearAllFilters() {
    setFilterStages(new Set())
    setFilterTypes(new Set())
    setFilterTags(new Set())
    setFilterPdpa(false)
    setFilterDnc(false)
    setFilterOptedOut(false)
    setFilterHasPhone(false)
    setFilterHasEmail(false)
    setFilterDateRange('all')
  }

  function toggleSetMember(setState, value) {
    setState(prev => {
      const next = new Set(prev)
      if (next.has(value)) next.delete(value); else next.add(value)
      return next
    })
  }

  // Sort
  const sorted = useMemo(() => {
    const arr = [...filtered]
    arr.sort((a, b) => {
      const va = a[sortBy] ?? ''
      const vb = b[sortBy] ?? ''
      // Date columns
      if (sortBy === 'updated_at' || sortBy === 'created_at') {
        return sortDir === 'asc'
          ? new Date(va || 0) - new Date(vb || 0)
          : new Date(vb || 0) - new Date(va || 0)
      }
      // String columns
      const cmp = String(va).toLowerCase().localeCompare(String(vb).toLowerCase())
      return sortDir === 'asc' ? cmp : -cmp
    })
    return arr
  }, [filtered, sortBy, sortDir])

  // Paginate
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const pageRows = sorted.slice((safePage - 1) * pageSize, safePage * pageSize)

  // Selection helpers
  const allOnPageSelected = pageRows.length > 0 && pageRows.every(r => selected.has(r.id))
  const someOnPageSelected = pageRows.some(r => selected.has(r.id))

  function toggleSelectAllOnPage() {
    const next = new Set(selected)
    if (allOnPageSelected) {
      pageRows.forEach(r => next.delete(r.id))
    } else {
      pageRows.forEach(r => next.add(r.id))
    }
    setSelected(next)
  }
  function toggleOne(id) {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id); else next.add(id)
    setSelected(next)
  }
  function clearSelection() { setSelected(new Set()) }

  function toggleSort(col) {
    if (sortBy === col) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(col)
      setSortDir('asc')
    }
  }

  // Density-driven row padding
  const rowPadY = density === 'compact' ? '5px' : '9px'
  const rowFontSize = density === 'compact' ? 11 : 12

  // Stats
  const totalCandidates = contacts.filter(c => c.type === 'candidate').length
  const totalClients = contacts.filter(c => c.type === 'client').length

  function renderCell(c, col) {
    switch (col.key) {
      case 'name':
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 24, height: 24, borderRadius: 6, background: '#faf9f7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600, color: '#6e6a63', flexShrink: 0 }}>
              {(c.name || '?').slice(0, 1).toUpperCase()}
            </div>
            <span style={{ fontWeight: 600, color: '#14130f', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name || '(no name)'}</span>
          </div>
        )
      case 'type': {
        const ts = TYPE_STYLES[c.type] || TYPE_STYLES.other
        return <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 5, background: ts.bg, color: ts.color, fontWeight: 600 }}>{ts.label}</span>
      }
      case 'pipeline_stage': {
        const ss = STAGE_STYLES[c.pipeline_stage] || STAGE_STYLES.new
        return <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 5, background: ss.bg, color: ss.color, fontWeight: 600, textTransform: 'capitalize' }}>{c.pipeline_stage || 'new'}</span>
      }
      case 'phone': return <span style={{ fontFamily: 'monospace', color: '#6e6a63' }}>{c.phone || '\u2014'}</span>
      case 'email': return <span style={{ color: '#6e6a63', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>{c.email || '\u2014'}</span>
      case 'candidate_role': return <span style={{ color: '#4a4742', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>{c.candidate_role || '\u2014'}</span>
      case 'current_company': return <span style={{ color: '#4a4742', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>{c.current_company || '\u2014'}</span>
      case 'updated_at': return <span style={{ color: '#9a958c' }}>{fmtDate(c.updated_at)}</span>
      case 'flags':
        return (
          <div style={{ display: 'flex', gap: 4 }}>
            {c.dnc && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: '#fee2e2', color: '#dc2626', fontWeight: 600 }}>DNC</span>}
            {c.opted_out && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: '#fff7ed', color: '#9a6a00', fontWeight: 600 }}>OPT</span>}
            {c.pdpa_consented && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: '#dcfce7', color: '#16a34a', fontWeight: 600 }}>PDPA</span>}
          </div>
        )
      default: return null
    }
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#faf9f7' }}>
      {/* Header */}
      <div className="px-4 pt-5 pb-4 md:px-7 md:pt-6" style={{ flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 14, marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#14130f', marginBottom: 4, letterSpacing: '-0.3px' }}>Contacts</div>
            <div style={{ fontSize: 12, color: '#6e6a63' }}>
              {contacts.length} total {'\u00b7'} {totalCandidates} candidate{totalCandidates !== 1 ? 's' : ''} {'\u00b7'} {totalClients} client{totalClients !== 1 ? 's' : ''}
            </div>
          </div>
          {canManage && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Btn variant="ghost" onClick={() => setShowImport(true)}>Import CSV</Btn>
              <Btn onClick={() => { setEditingContact(null); setShowEditor(true) }}>+ New Contact</Btn>
            </div>
          )}
        </div>
      </div>

      {/* Saved views tab strip */}
      <div className="px-4 md:px-7" style={{
        background: '#fff', borderBottom: '0.5px solid #dcd8d0',
        display: 'flex', alignItems: 'center', gap: 4,
        overflowX: 'auto', flexShrink: 0
      }}>
        <button
          onClick={() => applyView(null)}
          style={{
            padding: '10px 14px', fontSize: 12, fontWeight: activeViewId === null ? 600 : 500,
            border: 'none', background: 'transparent',
            color: activeViewId === null ? ACCENT : '#6e6a63',
            borderBottom: activeViewId === null ? `2px solid ${ACCENT}` : '2px solid transparent',
            cursor: 'pointer', whiteSpace: 'nowrap',
            transition: 'color .15s'
          }}>
          All Contacts
          <span style={{ marginLeft: 6, fontSize: 10, color: activeViewId === null ? ACCENT : '#9a958c' }}>
            {contacts.length}
          </span>
        </button>
        {views.map(v => {
          const isActive = activeViewId === v.id
          const isOwner = v.user_id === user?.id
          return (
            <SavedViewTab
              key={v.id}
              view={v}
              isActive={isActive}
              isOwner={isOwner}
              onClick={() => applyView(v)}
              onDelete={() => deleteView(v.id)}
            />
          )
        })}
        {canManage && activeFilterCount > 0 && (
          <button
            onClick={() => setShowSaveViewModal(true)}
            style={{
              marginLeft: 'auto',
              padding: '6px 12px', fontSize: 11, fontWeight: 500,
              border: `0.5px dashed ${ACCENT}`, borderRadius: 6,
              background: ACCENT_LIGHT, color: ACCENT,
              cursor: 'pointer', whiteSpace: 'nowrap',
              display: 'inline-flex', alignItems: 'center', gap: 4
            }}>
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <line x1="6" y1="2" x2="6" y2="10"/>
              <line x1="2" y1="6" x2="10" y2="6"/>
            </svg>
            Save view
          </button>
        )}
      </div>

      {/* Toolbar: search + density + page size */}
      <div className="px-4 md:px-7 py-3 gap-3 md:gap-4" style={{ background: '#fff', borderBottom: '0.5px solid #dcd8d0', display: 'flex', alignItems: 'center', flexWrap: 'wrap', flexShrink: 0 }}>
        <div className="w-full md:w-auto" style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
          <svg style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', width: 12, height: 12, color: '#9a958c', pointerEvents: 'none' }} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="7" cy="7" r="4"/><path d="M10.5 10.5l3 3" strokeLinecap="round"/>
          </svg>
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder={`Search name, phone, email, role, company${'\u2026'}`}
            style={{ width: '100%', padding: '6px 10px 6px 26px', border: '0.5px solid #dcd8d0', borderRadius: 8, fontSize: 12, outline: 'none', background: '#faf9f7', color: '#14130f', boxSizing: 'border-box' }} />
        </div>
        <button
          onClick={() => setShowFilterDrawer(true)}
          style={{
            padding: '6px 12px', fontSize: 12,
            border: `0.5px solid ${activeFilterCount > 0 ? ACCENT : '#dcd8d0'}`,
            borderRadius: 8,
            background: activeFilterCount > 0 ? ACCENT_LIGHT : '#fff',
            color: activeFilterCount > 0 ? ACCENT : '#4a4742',
            fontWeight: activeFilterCount > 0 ? 600 : 500,
            cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: 6
          }}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="2 3 14 3 9.5 8.5 9.5 13 6.5 13 6.5 8.5 2 3"/>
          </svg>
          Filters
          {activeFilterCount > 0 && (
            <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 10, background: ACCENT, color: '#fff', fontWeight: 600 }}>
              {activeFilterCount}
            </span>
          )}
        </button>
        <div className="md:ml-auto" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: '#9a958c' }}>Density:</span>
          {['compact', 'comfortable'].map(d => (
            <button key={d} onClick={() => setDensity(d)}
              style={{ padding: '4px 10px', fontSize: 11, borderRadius: 6, border: '0.5px solid #dcd8d0',
                background: density === d ? ACCENT : '#fff',
                color: density === d ? '#fff' : '#6e6a63',
                fontWeight: density === d ? 600 : 400, cursor: 'pointer', textTransform: 'capitalize' }}>
              {d}
            </button>
          ))}
          <span style={{ width: 1, height: 18, background: '#dcd8d0', margin: '0 4px' }} />
          <span style={{ fontSize: 11, color: '#9a958c' }}>Per page:</span>
          <select value={pageSize} onChange={e => { setPageSize(parseInt(e.target.value)); setPage(1) }}
            style={{ padding: '4px 8px', fontSize: 11, border: '0.5px solid #dcd8d0', borderRadius: 6, background: '#fff', color: '#14130f' }}>
            {PAGE_SIZE_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>

      {/* Active filter chips */}
      {activeFilterCount > 0 && (
        <div className="px-4 md:px-7 py-2" style={{
          background: '#faf9f7', borderBottom: '0.5px solid #dcd8d0',
          display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', flexShrink: 0
        }}>
          <span style={{ fontSize: 11, color: '#9a958c', marginRight: 4 }}>Active:</span>
          {[...filterStages].map(s => (
            <FilterChip key={`stage-${s}`} label={`Stage: ${capitalize(s)}`} onRemove={() => toggleSetMember(setFilterStages, s)} />
          ))}
          {[...filterTypes].map(t => (
            <FilterChip key={`type-${t}`} label={`Type: ${capitalize(t)}`} onRemove={() => toggleSetMember(setFilterTypes, t)} />
          ))}
          {[...filterTags].map(t => (
            <FilterChip key={`tag-${t}`} label={`Tag: ${t}`} onRemove={() => toggleSetMember(setFilterTags, t)} />
          ))}
          {filterPdpa && <FilterChip label="PDPA Consented" onRemove={() => setFilterPdpa(false)} />}
          {filterDnc && <FilterChip label="On DNC" onRemove={() => setFilterDnc(false)} />}
          {filterOptedOut && <FilterChip label="Opted Out" onRemove={() => setFilterOptedOut(false)} />}
          {filterHasPhone && <FilterChip label="Has Phone" onRemove={() => setFilterHasPhone(false)} />}
          {filterHasEmail && <FilterChip label="Has Email" onRemove={() => setFilterHasEmail(false)} />}
          {filterDateRange !== 'all' && <FilterChip
            label={`Updated: ${filterDateRange === 'today' ? 'Today' : filterDateRange === '7d' ? 'Last 7 days' : 'Last 30 days'}`}
            onRemove={() => setFilterDateRange('all')} />
          }
          <button onClick={clearAllFilters} style={{ marginLeft: 'auto', fontSize: 11, padding: '2px 8px', background: 'transparent', border: 'none', color: '#6e6a63', cursor: 'pointer', textDecoration: 'underline' }}>
            Clear all
          </button>
        </div>
      )}

      {/* Table */}
      <div style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#9a958c', fontSize: 13 }}>Loading contacts{'\u2026'}</div>
        ) : sorted.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#4a4742', marginBottom: 6 }}>
              {contacts.length === 0 ? 'No contacts yet' : 'No matching contacts'}
            </div>
            <div style={{ fontSize: 13, color: '#9a958c', marginBottom: 24, maxWidth: 380, margin: '0 auto 24px' }}>
              {contacts.length === 0 ? 'Add candidates and clients to your workspace.' : 'Try a different search query.'}
            </div>
            {canManage && contacts.length === 0 && (
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                <Btn onClick={() => { setEditingContact(null); setShowEditor(true) }}>+ Add your first contact</Btn>
                <Btn variant="ghost" onClick={() => setShowImport(true)}>Import CSV</Btn>
              </div>
            )}
          </div>
        ) : isMobile ? (
          // ─── Mobile: card list ────────────────────────────────────────
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 12px' }}>
            {pageRows.map(c => {
              const isSelected = selected.has(c.id)
              const ts = TYPE_STYLES[c.type] || TYPE_STYLES.other
              const ss = STAGE_STYLES[c.pipeline_stage] || STAGE_STYLES.new
              return (
                <div key={c.id}
                  onClick={() => { setEditingContact(c); setShowEditor(true) }}
                  style={{
                    background: isSelected ? ACCENT_LIGHT : '#fff',
                    border: `0.5px solid ${isSelected ? ACCENT : '#dcd8d0'}`,
                    borderRadius: 10,
                    padding: 14,
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8
                  }}>
                  {/* Top row: checkbox + avatar + name + flags */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    {canManage && (
                      <input type="checkbox" checked={isSelected}
                        onClick={e => e.stopPropagation()}
                        onChange={() => toggleOne(c.id)}
                        style={{ accentColor: ACCENT, cursor: 'pointer', marginTop: 4, flexShrink: 0 }} />
                    )}
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: '#faf9f7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, color: '#6e6a63', flexShrink: 0 }}>
                      {(c.name || '?').slice(0, 1).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#14130f', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {c.name || '(no name)'}
                      </div>
                      {c.phone && (
                        <div style={{ fontSize: 12, fontFamily: 'monospace', color: '#6e6a63', marginTop: 2 }}>
                          {c.phone}
                        </div>
                      )}
                    </div>
                    {/* Flags column */}
                    <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', justifyContent: 'flex-end', flexShrink: 0 }}>
                      {c.dnc && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: '#fee2e2', color: '#dc2626', fontWeight: 600 }}>DNC</span>}
                      {c.opted_out && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: '#fff7ed', color: '#9a6a00', fontWeight: 600 }}>OPT</span>}
                      {c.pdpa_consented && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: '#dcfce7', color: '#16a34a', fontWeight: 600 }}>PDPA</span>}
                    </div>
                  </div>

                  {/* Badge row: type + stage */}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 5, background: ts.bg, color: ts.color, fontWeight: 600 }}>{ts.label}</span>
                    <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 5, background: ss.bg, color: ss.color, fontWeight: 600, textTransform: 'capitalize' }}>{c.pipeline_stage || 'new'}</span>
                  </div>

                  {/* Optional context row: role at company OR email */}
                  {(c.candidate_role || c.current_company || c.email) && (
                    <div style={{ fontSize: 11, color: '#9a958c', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.candidate_role && c.current_company
                        ? `${c.candidate_role} @ ${c.current_company}`
                        : (c.candidate_role || c.current_company || c.email)}
                    </div>
                  )}

                  {/* Updated timestamp */}
                  <div style={{ fontSize: 10, color: '#c2bdb3', textTransform: 'uppercase', letterSpacing: '0.4px', fontWeight: 600 }}>
                    Updated {fmtDate(c.updated_at)}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          // ─── Desktop: table ──────────────────────────────────────────
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: rowFontSize }}>
            <thead style={{ position: 'sticky', top: 0, background: '#fff', zIndex: 1, borderBottom: '0.5px solid #dcd8d0' }}>
              <tr>
                {canManage && (
                  <th style={{ padding: `${rowPadY} 10px`, width: 36, textAlign: 'center' }}>
                    <input type="checkbox" checked={allOnPageSelected}
                      ref={el => { if (el) el.indeterminate = !allOnPageSelected && someOnPageSelected }}
                      onChange={toggleSelectAllOnPage}
                      style={{ accentColor: ACCENT, cursor: 'pointer' }} />
                  </th>
                )}
                {ALL_COLUMNS.map(col => {
                  const isActive = sortBy === col.key
                  return (
                    <th key={col.key}
                      onClick={() => col.sortable && toggleSort(col.key)}
                      onMouseEnter={e => { if (col.sortable) e.currentTarget.style.background = '#faf9f7' }}
                      onMouseLeave={e => { if (col.sortable) e.currentTarget.style.background = 'transparent' }}
                      style={{
                        padding: `${rowPadY} 10px`, textAlign: 'left',
                        fontSize: 10, fontWeight: 600,
                        color: isActive ? ACCENT : '#4a4742',
                        textTransform: 'uppercase', letterSpacing: '0.4px',
                        cursor: col.sortable ? 'pointer' : 'default',
                        whiteSpace: 'nowrap',
                        width: col.width,
                        userSelect: 'none',
                        transition: 'background .12s, color .12s'
                      }}
                      title={col.sortable ? `Click to sort by ${col.label}` : undefined}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        {col.label}
                        {col.sortable && (
                          isActive ? (
                            // Active sort — show direction with strong visible icon
                            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke={ACCENT} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              {sortDir === 'asc' ? (
                                <polyline points="4 10 8 6 12 10"/>
                              ) : (
                                <polyline points="4 6 8 10 12 6"/>
                              )}
                            </svg>
                          ) : (
                            // Inactive but sortable — dim chevron pair to signal "clickable"
                            <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="#c4bfb6" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="4 6 8 3 12 6"/>
                              <polyline points="4 10 8 13 12 10"/>
                            </svg>
                          )
                        )}
                      </span>
                    </th>
                  )
                })}
                <th style={{ padding: `${rowPadY} 10px`, width: 100, textAlign: 'right' }}></th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map(c => {
                const isSelected = selected.has(c.id)
                return (
                  <tr key={c.id}
                    style={{
                      borderBottom: '0.5px solid #f5f3ef',
                      background: isSelected ? ACCENT_LIGHT : '#fff',
                      cursor: 'pointer'
                    }}
                    onClick={() => { setEditingContact(c); setShowEditor(true) }}>
                    {canManage && (
                      <td style={{ padding: `${rowPadY} 10px`, textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                        <input type="checkbox" checked={isSelected} onChange={() => toggleOne(c.id)}
                          style={{ accentColor: ACCENT, cursor: 'pointer' }} />
                      </td>
                    )}
                    {ALL_COLUMNS.map(col => (
                      <td key={col.key} style={{ padding: `${rowPadY} 10px`, color: '#4a4742', overflow: 'hidden', maxWidth: col.width }}>
                        {renderCell(c, col)}
                      </td>
                    ))}
                    <td style={{ padding: `${rowPadY} 10px`, textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                      {canManage && (
                        <button onClick={() => deleteOne(c)}
                          style={{ fontSize: 10, padding: '3px 8px', borderRadius: 5, border: '0.5px solid #fca5a5', background: '#fee2e2', color: '#dc2626', cursor: 'pointer', fontWeight: 500 }}>
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {sorted.length > 0 && (
        <div className="px-4 md:px-7 py-3" style={{ background: '#fff', borderTop: '0.5px solid #dcd8d0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, fontSize: 12, color: '#6e6a63' }}>
          <div>
            Showing {(safePage - 1) * pageSize + 1}{'\u2013'}{Math.min(safePage * pageSize, sorted.length)} of {sorted.length}
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <Btn variant="ghost" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage === 1}>Prev</Btn>
            <span style={{ padding: '0 8px' }}>{safePage} / {totalPages}</span>
            <Btn variant="ghost" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}>Next</Btn>
          </div>
        </div>
      )}

      {/* Sticky bulk action bar */}
      {selected.size > 0 && (
        <div style={{
          position: 'sticky', bottom: 0, left: 0, right: 0,
          background: NAVY, color: '#fff',
          padding: '12px 20px',
          display: 'flex', alignItems: 'center', gap: 12,
          boxShadow: '0 -4px 12px rgba(0,0,0,0.15)', zIndex: 10, flexShrink: 0
        }}>
          <span style={{ fontWeight: 600 }}>{selected.size} selected</span>
          <button onClick={clearSelection} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.7)', fontSize: 11, cursor: 'pointer', textDecoration: 'underline' }}>Clear</button>
          <span style={{ flex: 1 }} />
          <button onClick={() => setShowBulkStage(true)} disabled={bulkRunning}
            style={{ padding: '6px 12px', fontSize: 12, background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 6, color: '#fff', cursor: 'pointer', fontWeight: 500 }}>
            Change Stage
          </button>
          <button onClick={() => bulkAction('mark_opted_out')} disabled={bulkRunning}
            style={{ padding: '6px 12px', fontSize: 12, background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 6, color: '#fff', cursor: 'pointer', fontWeight: 500 }}>
            Mark Opt-Out
          </button>
          <button onClick={() => bulkAction('mark_dnc', { dnc_reason: 'Bulk marked' })} disabled={bulkRunning}
            style={{ padding: '6px 12px', fontSize: 12, background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 6, color: '#fff', cursor: 'pointer', fontWeight: 500 }}>
            Mark DNC
          </button>
          {isDirector && (
            <button onClick={() => {
              if (confirm(`Permanently delete ${selected.size} contacts? This cannot be undone.`)) bulkAction('delete')
            }} disabled={bulkRunning}
              style={{ padding: '6px 12px', fontSize: 12, background: '#dc2626', border: 'none', borderRadius: 6, color: '#fff', cursor: 'pointer', fontWeight: 500 }}>
              Delete
            </button>
          )}
        </div>
      )}

      {/* Modals */}
      {showEditor && <ContactEditor contact={editingContact} onClose={() => { setShowEditor(false); setEditingContact(null) }} onSaved={load} />}
      {showImport && <CsvImportModal onClose={() => setShowImport(false)} onImported={load} />}
        <FilterDrawer
        open={showFilterDrawer}
        onClose={() => setShowFilterDrawer(false)}
        contacts={contacts}
        filterStages={filterStages} setFilterStages={setFilterStages}
        filterTypes={filterTypes} setFilterTypes={setFilterTypes}
        filterTags={filterTags} setFilterTags={setFilterTags}
        filterPdpa={filterPdpa} setFilterPdpa={setFilterPdpa}
        filterDnc={filterDnc} setFilterDnc={setFilterDnc}
        filterOptedOut={filterOptedOut} setFilterOptedOut={setFilterOptedOut}
        filterHasPhone={filterHasPhone} setFilterHasPhone={setFilterHasPhone}
        filterHasEmail={filterHasEmail} setFilterHasEmail={setFilterHasEmail}
        filterDateRange={filterDateRange} setFilterDateRange={setFilterDateRange}
        toggleSetMember={toggleSetMember}
        clearAllFilters={clearAllFilters}
        activeFilterCount={activeFilterCount}
      />
      
      {showSaveViewModal && (
        <SaveViewModal
          onSave={saveView}
          onClose={() => setShowSaveViewModal(false)}
        />
      )}

      {showBulkStage && (
        <BulkStageModal
          count={selected.size}
          onConfirm={(stage) => { bulkAction('change_stage', { pipeline_stage: stage }); setShowBulkStage(false) }}
          onClose={() => setShowBulkStage(false)} />
      )}
    </div>
  )
}