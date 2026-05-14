import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { API } from '../../utils/constants'
import { ACCENT, ACCENT_LIGHT, NAVY } from '../../utils/designTokens'
import TemplateLibraryModal from '../TemplateLibraryModal'
import MetaLibraryModal from '../MetaLibraryModal'
import IPhonePreview from '../IPhonePreview'
import Button from '../ui/Button'
import Modal from '../ui/Modal'
import { formatLanguage, STATUS_COLORS } from '../../utils/templateDisplay'

const CATEGORIES = [
  { value: 'utility', label: 'Utility', desc: 'Transactional - confirmations, reminders, updates' },
  { value: 'marketing', label: 'Marketing', desc: 'Promotional - job alerts, opportunities' },
  { value: 'authentication', label: 'Authentication', desc: 'OTP and verification messages' },
]

// Status badge colors keyed by the 'color' value returned by backend's getTemplateDisplayStatus()

// Meta-style language display: 'en' -> 'English', 'en_US' -> 'English (US)', etc.

// Smart name suggestion for cloning. Detects existing siblings of pattern
// "{base}_v{n}" and proposes the next available v-number. Falls back to _v2 if
// no siblings exist.
function suggestCloneName(originalName, existingTemplates) {
  if (!originalName) return ''
  const base = originalName.replace(/_v\d+$/, '')
  const siblings = existingTemplates
    .map(t => (t.name || '').toLowerCase())
    .filter(n => n === base.toLowerCase() || n.startsWith(base.toLowerCase() + '_v'))
  let maxV = 1
  for (const n of siblings) {
    const m = n.match(/_v(\d+)$/)
    if (m) {
      const v = parseInt(m[1])
      if (v > maxV) maxV = v
    }
  }
  return `${base}_v${maxV + 1}`
}

// Sections describe each template source with caption and visual accent
const SECTIONS = [
  {
    key: 'meta_library',
    label: 'Meta Library',
    caption: 'Pre-approved by Meta. Install instantly, no review wait. Body content is locked.',
    accentColor: '#1877f2',
    accentBg: '#e7f0fd',
    emptyHint: 'No Meta Library templates installed yet. Click the Meta Library button (top right) to browse and install pre-approved templates.',
  },
  {
    key: 'tel_cloud_library',
    label: 'Tel-Cloud Suggested',
    caption: 'Recruitment-vertical templates curated for you. Customise and submit to Meta for approval.',
    accentColor: '#5b21b6',
    accentBg: '#ede9fe',
    emptyHint: 'No suggested templates installed yet. Click the Suggested button (top right) to browse the recruitment library.',
  },
  {
    key: 'tenant',
    label: 'Custom Templates',
    caption: 'Your own custom-drafted templates. Write from scratch and submit to Meta for approval.',
    accentColor: '#fff',
    accentBg: ACCENT,
    emptyHint: 'No custom templates yet. Click + Custom Template (top right) to draft your own from scratch.',
  },
]

function TemplateEditor({ template, onClose, onSaved }) {
  const { token, user } = useAuth()
  const [name, setName] = useState(template?.name || '')
  const [category, setCategory] = useState(template?.category || 'utility')
  const [body, setBody] = useState(template?.body || '')
  const [buttons, setButtons] = useState(template?.buttons || [])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const isEdit = !!(template && template.id)
  const isClone = !!template?._clonedFrom
  const [nameWarning, setNameWarning] = useState('')

  // Variables state: { ordered: [name1, name2], defaults: { name1: 'val1', name2: 'val2' } }
  // Source affects behaviour:
  //   - meta_library: ordered list locked, only defaults editable
  //   - tenant + template_library (Suggested): everything editable
  //   - clone: treated as fresh tenant draft, all locks lifted
  const isMetaLibrary = template?.source === 'meta_library' && !isClone
  const initialVariables = (() => {
    const v = template?.variables
    if (v && v.ordered && Array.isArray(v.ordered)) return v
    return { ordered: [], defaults: {}, labels: {} }
  })()
  const [varOrdered, setVarOrdered] = useState(initialVariables.ordered)
  const [varDefaults, setVarDefaults] = useState(initialVariables.defaults)
  // Clones drop labels (clones are fresh tenant templates; labels are Meta-library metadata)
  const [varLabels] = useState(isClone ? {} : (initialVariables.labels || {}))
  // Event field mapping: { varName: 'contact_name' | 'event_date' | 'event_time' | 'location' | 'event_title' }
  // Used by Send Template auto-fill when conversation has linked calendar events.
  // Clones drop the map (fresh template, recruiter sets it themselves).
  const [varEventFieldMap, setVarEventFieldMap] = useState(isClone ? {} : (initialVariables.event_field_map || {}))
  const [varErrors, setVarErrors] = useState({})

  // Validates variable name: lowercase, starts with letter, only letters/digits/underscores
  function isValidVarName(n) {
    return /^[a-z][a-z0-9_]{0,29}$/.test(n)
  }

  function addVariable() {
    if (isMetaLibrary) return
    let i = 1
    while (varOrdered.includes(`field_${i}`)) i++
    const newName = `field_${i}`
    setVarOrdered(p => [...p, newName])
    setVarDefaults(p => ({ ...p, [newName]: '' }))
  }

  function renameVariable(oldName, newName) {
    if (isMetaLibrary) return
    const trimmed = newName.toLowerCase().trim()
    setVarErrors(p => ({ ...p, [oldName]: '' }))
    if (!isValidVarName(trimmed)) {
      setVarErrors(p => ({ ...p, [oldName]: 'Use letters, digits, underscores. Start with a letter.' }))
      return
    }
    if (trimmed !== oldName && varOrdered.includes(trimmed)) {
      setVarErrors(p => ({ ...p, [oldName]: 'Already used' }))
      return
    }
    if (trimmed === oldName) return
    setVarOrdered(p => p.map(n => n === oldName ? trimmed : n))
    setVarDefaults(p => {
      const next = { ...p }
      next[trimmed] = next[oldName] || ''
      delete next[oldName]
      return next
    })
    setBody(p => p.replace(new RegExp(`\\{\\{\\s*${oldName}\\s*\\}\\}`, 'g'), `{{${trimmed}}}`))
  }

  function updateVariableDefault(name, value) {
    setVarDefaults(p => ({ ...p, [name]: value }))
  }

  function deleteVariable(name) {
    if (isMetaLibrary) return
    if (!confirm(`Delete variable "${name}"? Any {{${name}}} references in the body will remain as plain text.`)) return
    setVarOrdered(p => p.filter(n => n !== name))
    setVarDefaults(p => {
      const next = { ...p }
      delete next[name]
      return next
    })
    setVarErrors(p => {
      const next = { ...p }
      delete next[name]
      return next
    })
    // Also clean up the event field mapping if it was set
    setVarEventFieldMap(p => {
      const next = { ...p }
      delete next[name]
      return next
    })
  }

  // Update the event field mapping for a variable. Empty string clears the mapping.
  function updateEventFieldMap(varName, eventField) {
    setVarEventFieldMap(p => {
      const next = { ...p }
      if (eventField) {
        next[varName] = eventField
      } else {
        delete next[varName]
      }
      return next
    })
  }

  // Live duplicate name check (debounced).
  // For clones, never exclude by id (clones have no id yet) so the check works correctly.
  useEffect(() => {
    if (!name.trim()) { setNameWarning(''); return }
    const trimmed = name.trim().toLowerCase()
    if (template?.name && template.name.toLowerCase() === trimmed && !isClone) { setNameWarning(''); return }
    const handle = setTimeout(async () => {
      try {
        const r = await fetch(`${API}/templates`, { headers: { Authorization: 'Bearer ' + token } })
        const all = await r.json()
        if (Array.isArray(all)) {
          const conflict = all.find(t => t.name?.toLowerCase() === trimmed && (isClone || t.id !== template?.id))
          if (conflict) setNameWarning(`A template named "${name.trim()}" already exists. Approval will be rejected by Meta if you submit a duplicate.`)
          else setNameWarning('')
        }
      } catch { /* ignore */ }
    }, 400)
    return () => clearTimeout(handle)
  }, [name, template?.id, template?.name, token, isClone])

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
    const errored = Object.entries(varErrors).find(([, v]) => v)
    if (errored) { setError(`Fix variable name issues before saving: ${errored[0]}`); return }
    setSaving(true)
    try {
      // Clones are always POSTs (new template), never PATCHes - even though template object exists.
      const url = (isEdit && !isClone) ? `${API}/templates/${template.id}` : `${API}/templates`
      const method = (isEdit && !isClone) ? 'PATCH' : 'POST'
      const variables = {
        ordered: varOrdered,
        defaults: varDefaults,
        ...(Object.keys(varLabels).length > 0 ? { labels: varLabels } : {}),
        ...(Object.keys(varEventFieldMap).length > 0 ? { event_field_map: varEventFieldMap } : {})
      }
      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({
          name, category, body, buttons,
          status: status || (isEdit && !isClone ? template.status : 'draft'),
          type: 'whatsapp',
          variables
        })
      })
      if (!r.ok) { const d = await r.json(); setError(d.error || 'Failed to save'); return }
      onSaved()
      onClose()
    } catch { setError('Failed to save. Please try again.') }
    finally { setSaving(false) }
  }

  const QUICK_VARS = ['name', 'role', 'company', 'date', 'time', 'venue', 'salary', 'deadline', 'start_date', 'hr_name', 'candidate']

  // Modal title reflects mode: edit, clone, customise (defaults), or new.
  const modalTitle = (() => {
    if (isClone) return `Clone - new template from ${template._clonedFrom}`
    if (isEdit) return `Edit - ${template.name}`
    if (template?.name) return `Customise - ${template.name}`
    return 'New Custom Template'
  })()

  return (
    <Modal
      title={modalTitle}
      subtitle="WhatsApp Business template - requires Meta approval before sending"
      onClose={onClose}>

      {isClone && (
        <div style={{ marginBottom: 16, padding: '10px 14px', background: '#ede9fe', border: '0.5px solid #d4ccf4', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5b21b6" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <polyline points="1 4 1 10 7 10" />
            <polyline points="23 20 23 14 17 14" />
            <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" />
          </svg>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: '#14130f', fontWeight: 500 }}>
              Cloned from <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{template._clonedFrom}</span>
            </div>
            <div style={{ fontSize: 10, color: '#6e6a63', marginTop: 2 }}>
              Edit freely, then save and submit to Meta for re-approval. Your original template remains untouched.
            </div>
          </div>
        </div>
      )}

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
              {nameWarning && (
                <div style={{ fontSize: 11, color: '#9a6a00', marginTop: 6, padding: '6px 10px', background: '#fef3c7', border: '0.5px solid #fde68a', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9a6a00" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                  <span>{nameWarning}</span>
                </div>
              )}
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#4a4742', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                Category <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <select value={category} onChange={e => setCategory(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', border: '0.5px solid #dcd8d0', borderRadius: 8, fontSize: 13, outline: 'none', background: '#fff', color: '#14130f' }}>
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label} - {c.desc}</option>)}
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
              onBlur={() => {
                const matches = body.match(/\{\{\s*([a-z][a-z0-9_]{0,29})\s*\}\}/g) || []
                const inBody = []
                const seen = new Set()
                for (const m of matches) {
                  const n = m.replace(/[{}\s]/g, '')
                  if (!seen.has(n)) { seen.add(n); inBody.push(n) }
                }
                const missing = inBody.filter(n => !varOrdered.includes(n))
                if (missing.length > 0 && !isMetaLibrary) {
                  setVarOrdered(p => [...p, ...missing])
                  setVarDefaults(p => {
                    const next = { ...p }
                    for (const n of missing) next[n] = ''
                    return next
                  })
                }
              }}
              rows={10}
              placeholder={'Dear {{name}},\n\nWe are pleased to confirm your interview for the position of {{role}} at {{company}}.\n\nDate: {{date}}\nTime: {{time}}\nVenue: {{venue}}\n\nWe look forward to meeting you.'}
              style={{ width: '100%', padding: '10px 12px', border: '0.5px solid #dcd8d0', borderRadius: 8, fontSize: 12, outline: 'none', background: '#fff', color: '#14130f', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box', lineHeight: 1.6 }} />
          </div>

          <div style={{ marginBottom: 16, padding: '12px 14px', background: '#faf9f7', borderRadius: 8, border: '0.5px solid #dcd8d0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#4a4742', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                Variables {varOrdered.length > 0 && <span style={{ color: '#9a958c', fontWeight: 400 }}>({varOrdered.length})</span>}
              </div>
              {!isMetaLibrary && (
                <Button variant="ghost" size="sm" onClick={addVariable}>+ Add Variable</Button>
              )}
            </div>

            {varOrdered.length > 0 && (
              <div style={{ fontSize: 10, color: '#6e6a63', marginBottom: 8, fontStyle: 'italic' }}>
                Map a variable to an event field (e.g. Contact name, Event date) so it auto-fills when the conversation has a linked calendar event.
              </div>
            )}

            {isMetaLibrary && (
              <div style={{ fontSize: 11, color: '#6e6a63', marginBottom: 10, padding: '6px 10px', background: '#e7f0fd', borderRadius: 6, border: '0.5px solid #cfe0fb' }}>
                Meta Library template. Variable names and positions are locked. You may only edit default values below.
              </div>
            )}

            {varOrdered.length === 0 ? (
              <div style={{ fontSize: 11, color: '#9a958c', textAlign: 'center', padding: '12px 0', fontStyle: 'italic' }}>
                {isMetaLibrary ? 'No variables in this template.' : 'No variables yet. Click "+ Add Variable" or type {{name}} in the message body.'}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {varOrdered.map((vname, idx) => (
                  <div key={`${vname}_${idx}`}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <div style={{ fontSize: 10, color: '#9a958c', width: 24, textAlign: 'right', fontFamily: 'monospace' }}>
                        {`{{${idx + 1}}}`}
                      </div>
                      {isMetaLibrary && varLabels[vname] ? (
                        <div style={{
                          width: 160, padding: '7px 10px', borderRadius: 6,
                          fontSize: 12, color: '#4a4742', background: '#f5f3ef',
                          border: '0.5px solid #dcd8d0', display: 'flex', alignItems: 'center',
                          fontWeight: 500
                        }}
                          title={vname}>
                          {varLabels[vname]}
                        </div>
                      ) : (
                        <input
                          defaultValue={vname}
                          onBlur={e => renameVariable(vname, e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') e.target.blur() }}
                          disabled={isMetaLibrary}
                          placeholder="variable_name"
                          style={{
                            width: 160, padding: '7px 10px', border: '0.5px solid #dcd8d0', borderRadius: 6,
                            fontSize: 12, outline: 'none', background: isMetaLibrary ? '#f5f3ef' : '#fff',
                            color: '#14130f', fontFamily: 'monospace',
                            cursor: isMetaLibrary ? 'not-allowed' : 'text'
                          }} />
                      )}
                      <input
                        value={varDefaults[vname] || ''}
                        onChange={e => updateVariableDefault(vname, e.target.value)}
                        placeholder="Default value (used if not overridden when sending)"
                        style={{
                          flex: 1, padding: '7px 10px', border: '0.5px solid #dcd8d0', borderRadius: 6,
                          fontSize: 12, outline: 'none', background: '#fff', color: '#14130f'
                        }} />
                      <select
                        value={varEventFieldMap[vname] || ''}
                        onChange={e => updateEventFieldMap(vname, e.target.value)}
                        title="Auto-fill from event field when sending"
                        style={{
                          width: 130, padding: '7px 8px', border: '0.5px solid #dcd8d0', borderRadius: 6,
                          fontSize: 11, outline: 'none', background: '#fff', color: '#14130f',
                          cursor: 'pointer', flexShrink: 0
                        }}>
                        <option value="">- Manual fill -</option>
                        <option value="contact_name">Contact name</option>
                        <option value="event_date">Event date</option>
                        <option value="event_time">Event time</option>
                        <option value="location">Event venue</option>
                        <option value="event_title">Event title</option>
                      </select>
                      {!isMetaLibrary && (
                        <button onClick={() => deleteVariable(vname)}
                          style={{ width: 26, height: 26, borderRadius: 6, border: '0.5px solid #fca5a5', background: '#fee2e2', cursor: 'pointer', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 14, lineHeight: 1 }}>
                          x
                        </button>
                      )}
                    </div>
                    {varErrors[vname] && (
                      <div style={{ fontSize: 10, color: '#dc2626', marginTop: 3, marginLeft: 32 }}>
                        {varErrors[vname]}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ padding: '10px 12px', background: '#faf9f7', borderRadius: 8, border: '0.5px solid #dcd8d0', marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#4a4742', marginBottom: 6 }}>WhatsApp Formatting</div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {[['*bold*', 'Bold'], ['_italic_', 'Italic'], ['~strike~', 'Strikethrough'], ['`code`', 'Monospace']].map(([syntax, label]) => (
                <div key={label} style={{ fontSize: 11, color: '#6e6a63', display: 'flex', gap: 5, alignItems: 'center' }}>
                  <code style={{ background: '#dcd8d0', padding: '1px 5px', borderRadius: 3, fontSize: 10 }}>{syntax}</code>
                  <span>renders as {label}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#4a4742', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                Buttons {!isMetaLibrary && '(optional, max 3)'}
              </label>
              {!isMetaLibrary && buttons.length < 3 && <Button variant="ghost" size="sm" onClick={addButton}>+ Add Button</Button>}
            </div>
            {isMetaLibrary && buttons.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
                {buttons.map((b, i) => (
                  <div key={i} style={{ padding: '8px 12px', background: '#f5f3ef', border: '0.5px solid #dcd8d0', borderRadius: 7, fontSize: 12, color: '#6e6a63', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 10, color: '#9a958c', fontFamily: 'monospace', minWidth: 90 }}>{b.type || 'BUTTON'}</span>
                    <span style={{ color: '#14130f', fontWeight: 500 }}>{b.text || b.label || '(no label)'}</span>
                    {b.url && <span style={{ fontSize: 10, color: '#9a958c', fontFamily: 'monospace' }}>{b.url}</span>}
                    {b.phone_number && <span style={{ fontSize: 10, color: '#9a958c', fontFamily: 'monospace' }}>{b.phone_number}</span>}
                  </div>
                ))}
              </div>
            )}
            {isMetaLibrary && buttons.length === 0 && (
              <div style={{ fontSize: 11, color: '#9a958c', fontStyle: 'italic', padding: '8px 0' }}>No buttons on this template.</div>
            )}
            {!isMetaLibrary && buttons.map((b, i) => (
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
                  <input value={b.url || ''} onChange={e => updateButton(i, 'url', e.target.value)} placeholder="https://..."
                    style={{ flex: 1, padding: '8px 10px', border: '0.5px solid #dcd8d0', borderRadius: 7, fontSize: 12, outline: 'none', background: '#fff', color: '#14130f' }} />
                )}
                <button onClick={() => removeButton(i)}
                  style={{ width: 28, height: 28, borderRadius: 7, border: '0.5px solid #fca5a5', background: '#fee2e2', cursor: 'pointer', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 16, lineHeight: 1 }}>✕</button>
              </div>
            ))}
          </div>

          {error && (
            <div style={{ padding: '10px 12px', background: '#fef2f2', border: '0.5px solid #fecaca', borderRadius: 8, fontSize: 12, color: '#dc2626', marginTop: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 20, paddingTop: 16, borderTop: '0.5px solid #f5f3ef' }}>
            <Button variant="ghost" onClick={onClose} style={{ flex: 1 }}>Cancel</Button>
            <Button variant="ghost" onClick={() => save('draft')} disabled={saving} style={{ flex: 1 }}>Save as Draft</Button>
            {(user?.role === 'director' || user?.role === 'manager') ? (
              <Button onClick={() => save('approved')} disabled={saving} style={{ flex: 2 }}>
                {saving ? 'Saving...' : (isEdit && !isClone) ? 'Save & Approve' : 'Create & Approve'}
              </Button>
            ) : (
              <Button onClick={() => save('pending')} disabled={saving} style={{ flex: 2 }}>
                {saving ? 'Saving...' : 'Submit for Approval'}
              </Button>
            )}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#4a4742', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 12 }}>Live Preview</div>
          <IPhonePreview body={body} buttons={buttons} variableDefaults={varDefaults} variableOrder={varOrdered} />
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

// Renders a single template card. Extracted so we can render it inside each section.
function TemplateCard({ t, canCreate, canApprove, onPreview, onEdit, onDelete, onApprove, onReject, onCopy, onSubmitToMeta }) {
  const display = t.display_status || { label: t.status || 'Draft', color: 'gray' }
  const ss = STATUS_COLORS[display.color] || STATUS_COLORS.gray
  const buttons = Array.isArray(t.buttons) ? t.buttons : []
  const isLocked = t.source === 'meta_library' || (t.status === 'approved' && t.source !== 'tenant')

  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #dcd8d0', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '14px 16px', borderBottom: '0.5px solid #f5f3ef', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#14130f', marginBottom: 5, fontFamily: 'monospace' }}>{t.name}</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 6, background: ss.bg, color: ss.color, fontWeight: 600 }}>{display.label}</span>
            <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 6, background: '#f5f3ef', color: '#6e6a63' }}>{formatLanguage(t.language)}</span>
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
          {t.body?.slice(0, 200)}{t.body?.length > 200 ? '...' : ''}
        </div>
      </div>
      {buttons.length > 0 && (
        <div style={{ padding: '0 16px 10px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {buttons.map((b, i) => (
              <span key={i} style={{ fontSize: 10, padding: '3px 9px', borderRadius: 6, background: '#f0fdf4', color: '#16a34a', border: '0.5px solid #86efac', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                {b.type === 'quick_reply' ? (
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 14 4 9 9 4" />
                    <path d="M20 20v-7a4 4 0 0 0-4-4H4" />
                  </svg>
                ) : (
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M7 17L17 7" />
                    <polyline points="7 7 17 7 17 17" />
                  </svg>
                )}
                {b.label || b.text}
              </span>
            ))}
          </div>
        </div>
      )}
      <div style={{ padding: '10px 16px', borderTop: '0.5px solid #f5f3ef', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <Button variant="ghost" size="sm" onClick={() => onPreview(t)}>Preview</Button>
        {canCreate && (
          <Button variant="ghost" size="sm" onClick={() => onEdit(t)}>
            {isLocked ? 'Defaults' : 'Edit'}
          </Button>
        )}
        {canCreate && isLocked && (
          <Button variant="ghost" size="sm" onClick={() => onCopy(t)}>Copy</Button>
        )}
        
        {canCreate && t.status === 'draft' && t.source === 'tenant' && (
          <Button variant="primary" size="sm" onClick={() => onSubmitToMeta(t)}>Submit to Meta</Button>
        )}
        
        {canApprove && t.status === 'pending' && (
          <>
            <Button variant="success" size="sm" onClick={() => onApprove(t.id)}>Approve</Button>
            <Button variant="danger" size="sm" onClick={() => onReject(t.id)}>Reject</Button>
          </>
        )}
        {canCreate && (
          <Button variant="danger" size="sm" onClick={() => onDelete(t.id)} style={{ marginLeft: 'auto' }}>Delete</Button>
        )}
      </div>
    </div>
  )
}

// Renders one source section with header, caption, count, and either cards or empty state.
function SourceSection({ section, templates, canCreate, canApprove, handlers }) {
  const count = templates.length
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{
        display: 'flex', alignItems: 'baseline', gap: 12,
        paddingBottom: 8, marginBottom: 12,
        borderBottom: `1px solid #dcd8d0`
      }}>
        <div style={{
          fontSize: 11, fontWeight: 700, color: section.accentColor,
          textTransform: 'uppercase', letterSpacing: '0.8px',
          background: section.accentBg, padding: '3px 10px', borderRadius: 6
        }}>
          {section.label}
        </div>
        <div style={{ fontSize: 12, color: '#9a958c' }}>{count} {count === 1 ? 'template' : 'templates'}</div>
        <div style={{ flex: 1, fontSize: 11, color: '#6e6a63', textAlign: 'right' }}>{section.caption}</div>
      </div>

      {count === 0 ? (
        <div style={{
          padding: '24px 20px', textAlign: 'center',
          background: '#faf9f7', borderRadius: 10, border: '0.5px dashed #dcd8d0',
          fontSize: 12, color: '#9a958c'
        }}>
          {section.emptyHint}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14 }}>
          {templates.map(t => (
            <TemplateCard
              key={t.id}
              t={t}
              canCreate={canCreate}
              canApprove={canApprove}
              {...handlers}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function Templates() {
  const { token, user, hasPermission } = useAuth()
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('all')
  const [search, setSearch] = useState('')
  const [showEditor, setShowEditor] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState(null)
  const [previewTemplate, setPreviewTemplate] = useState(null)
  const [showLibrary, setShowLibrary] = useState(false)
  const [showMetaLibrary, setShowMetaLibrary] = useState(false)

  useEffect(() => { if (!token) return; load() }, [token])

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

  async function submitToMeta(t) {
    if (!confirm(`Submit "${t.name}" to Meta for approval? This cannot be undone.`)) return
    try {
      const r = await fetch(`${API}/templates/${t.id}/submit-to-meta`, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token }
      })
      const data = await r.json()
      if (!r.ok) {
        const errMsg = data.error || 'Submission failed'
        const metaCode = data.meta_error_code ? ` (Meta code ${data.meta_error_code})` : ''
        alert(`Failed to submit to Meta:\n\n${errMsg}${metaCode}`)
        return
      }
      load()
    } catch (err) {
      alert(`Network error submitting to Meta: ${err.message}`)
    }
  }

  async function rejectTemplate(id) {
    await fetch(`${API}/templates/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ status: 'rejected' })
    })
    load()
  }

  // Filter all templates by tab + search first; sectioning happens after.
  const filtered = templates.filter(t => {
    const matchTab = activeTab === 'all' || t.status === activeTab
    const matchSearch = !search || t.name?.toLowerCase().includes(search.toLowerCase()) || t.body?.toLowerCase().includes(search.toLowerCase())
    return matchTab && matchSearch
  })

  // Group filtered templates by source. A template with no source defaults to 'tenant'.
  const grouped = {
    meta_library: filtered.filter(t => t.source === 'meta_library'),
    tel_cloud_library: filtered.filter(t => t.source === 'tel_cloud_library'),
    tenant: filtered.filter(t => !t.source || t.source === 'tenant')
  }

  const counts = {
    all: templates.length,
    approved: templates.filter(t => t.status === 'approved').length,
    pending: templates.filter(t => t.status === 'pending').length,
    draft: templates.filter(t => t.status === 'draft').length,
    rejected: templates.filter(t => t.status === 'rejected').length,
  }

  const canApprove = user?.role === 'director'
  const canCreate = hasPermission('manage_templates')

  const cardHandlers = {
    onPreview: setPreviewTemplate,
    onEdit: (t) => { setEditingTemplate(t); setShowEditor(true) },
    onCopy: (t) => {
      // Build a cloned template object: stripped of id and Meta-specific metadata,
      // forced to source='tenant' status='draft', name auto-suggested with smart _v{n} pattern.
      const cloned = {
        name: suggestCloneName(t.name, templates),
        category: t.category,
        body: t.body,
        header: t.header,
        footer: t.footer,
        buttons: t.buttons || [],
        variables: t.variables || { ordered: [], defaults: {} },
        status: 'draft',
        source: 'tenant',
        _clonedFrom: t.name
      }
      setEditingTemplate(cloned)
      setShowEditor(true)
    },
    onDelete: deleteTemplate,
    onApprove: approveTemplate,
    onSubmitToMeta: submitToMeta,
    onReject: rejectTemplate,
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#faf9f7' }}>
      <div className="px-4 pt-5 pb-4 md:px-7 md:pt-6" style={{ flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 14, marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#14130f', marginBottom: 4, letterSpacing: '-0.3px' }}>Templates</div>
            <div style={{ fontSize: 12, color: '#6e6a63' }}>
              {counts.approved} approved {'\u00b7'} {counts.pending} pending approval {'\u00b7'} {counts.draft} {counts.draft === 1 ? 'draft' : 'drafts'}
            </div>
          </div>
          {canCreate && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Button variant="meta" onClick={() => setShowMetaLibrary(true)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2 2 7l10 5 10-5-10-5Z" />
                  <path d="m2 17 10 5 10-5" />
                  <path d="m2 12 10 5 10-5" />
                </svg>
                Meta Library
              </Button>
              <Button variant="suggested" onClick={() => setShowLibrary(true)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="7" y="6" width="14" height="15" rx="2" />
                  <path d="M3 18V4a1 1 0 0 1 1-1h11" />
                  <path d="M11 11h6" />
                  <path d="M11 15h6" />
                </svg>
                Suggested
              </Button>
              <Button onClick={() => { setEditingTemplate(null); setShowEditor(true) }}>
                + Custom Template
              </Button>
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          {[
            { label: 'Approved', value: counts.approved, color: counts.approved === 0 ? '#9a958c' : '#2d6a4f' },
            { label: 'Pending', value: counts.pending, color: counts.pending === 0 ? '#9a958c' : '#9a6a00' },
            { label: 'Drafts', value: counts.draft, color: counts.draft === 0 ? '#9a958c' : '#6e6a63' },
            { label: 'Rejected', value: counts.rejected, color: counts.rejected === 0 ? '#9a958c' : '#8e2a2a' },
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
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search templates..."
            className="w-full md:w-[200px]"
            style={{ padding: '6px 10px 6px 26px', border: '0.5px solid #dcd8d0', borderRadius: 8, fontSize: 12, outline: 'none', background: '#faf9f7', color: '#14130f', boxSizing: 'border-box' }} />
        </div>
      </div>

      <div className="px-4 py-5 md:px-7" style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#9a958c' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#9a958c" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 12 }}><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8"/><path d="M8 11h8"/><path d="M8 15h5"/></svg>
            <div>Loading templates...</div>
          </div>
        ) : (
          SECTIONS.map(section => (
            <SourceSection
              key={section.key}
              section={section}
              templates={grouped[section.key]}
              canCreate={canCreate}
              canApprove={canApprove}
              handlers={cardHandlers}
            />
          ))
        )}
      </div>

      {showEditor && (
        <TemplateEditor
          template={editingTemplate}
          onClose={() => { setShowEditor(false); setEditingTemplate(null) }}
          onSaved={load} />
      )}

      {showLibrary && (
        <TemplateLibraryModal
          isOpen={showLibrary}
          onClose={() => setShowLibrary(false)}
          onSelect={(libraryTpl) => {
            setShowLibrary(false)
            const vmap = libraryTpl.variables || {}
            let convertedBody = libraryTpl.body || ''
            const ordered = []
            const defaults = {}
            const positions = Object.keys(vmap).filter(k => /^\d+$/.test(k)).sort((a, b) => parseInt(a) - parseInt(b))
            for (const pos of positions) {
              const name = vmap[pos]
              if (typeof name !== 'string' || !name) continue
              const cleanName = name.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/^[^a-z]/, 'v')
              const re = new RegExp(`\\{\\{\\s*${pos}\\s*\\}\\}`, 'g')
              convertedBody = convertedBody.replace(re, `{{${cleanName}}}`)
              if (!ordered.includes(cleanName)) {
                ordered.push(cleanName)
                defaults[cleanName] = ''
              }
            }
            setEditingTemplate({
              name: libraryTpl.template_key,
              category: libraryTpl.category === 'marketing' ? 'marketing' : 'utility',
              body: convertedBody,
              buttons: (libraryTpl.buttons || []).map(b => ({
                type: 'quick_reply',
                label: b.text || b.label || ''
              })),
              status: 'draft',
              variables: { ordered, defaults }
            })
            setShowEditor(true)
          }}
        />
      )}

      <MetaLibraryModal
        open={showMetaLibrary}
        onClose={() => setShowMetaLibrary(false)}
        onInstalled={() => { setShowMetaLibrary(false); load() }}
      />

      {previewTemplate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}
          onClick={() => setPreviewTemplate(null)}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, maxWidth: 400, width: '100%' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#14130f' }}>{previewTemplate.name}</div>
              <button onClick={() => setPreviewTemplate(null)}
                style={{ width: 28, height: 28, borderRadius: 7, border: '0.5px solid #dcd8d0', background: '#faf9f7', cursor: 'pointer', color: '#6e6a63', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <line x1="4" y1="4" x2="12" y2="12" />
                  <line x1="12" y1="4" x2="4" y2="12" />
                </svg>
              </button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <IPhonePreview
                body={previewTemplate.body}
                buttons={previewTemplate.buttons || []}
                variableDefaults={previewTemplate.variables?.defaults || {}}
                variableOrder={previewTemplate.variables?.ordered || []}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}