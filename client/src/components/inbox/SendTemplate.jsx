import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../../context/AuthContext'
import { API } from '../../utils/constants'
import IPhonePreview from '../IPhonePreview'
import Btn from '../ui/Btn'
import Modal from '../ui/Modal'
import { ACCENT } from '../../utils/designTokens'

// Substitutes {{varName}} placeholders in body with their corresponding values.
// Handles both named placeholders ({{candidate_name}}) and positional ({{1}}).
function substituteBody(body, ordered, values) {
  if (!body) return ''
  return body.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, vname) => {
    // Named lookup
    if (values[vname] !== undefined && values[vname] !== '') return values[vname]
    // Positional lookup via ordered
    if (/^\d+$/.test(vname)) {
      const idx = parseInt(vname) - 1
      const mappedName = ordered[idx]
      if (mappedName && values[mappedName] !== undefined && values[mappedName] !== '') return values[mappedName]
    }
    return match // leave as {{name}} if unfilled
  })
}

// Smart variable name matcher. Maps a template variable name (e.g. "candidate_name",
// "interview_date") to the corresponding event field. Returns null if no match.
// Case-insensitive, ignores underscores/hyphens.
function matchVarToEventField(varName) {
  const norm = (varName || '').toLowerCase().replace(/[_\-\s]/g, '')

  // Contact name patterns
  if (['name', 'candidate', 'candidatename', 'contactname', 'recipient', 'recipientname', 'customer', 'customername', 'client', 'clientname'].includes(norm)) {
    return 'contact_name'
  }
  // Date patterns
  if (['date', 'eventdate', 'interviewdate', 'meetingdate', 'appointmentdate'].includes(norm)) {
    return 'event_date'
  }
  // Time patterns
  if (['time', 'eventtime', 'interviewtime', 'meetingtime', 'appointmenttime'].includes(norm)) {
    return 'event_time'
  }
  // Location/venue patterns
  if (['venue', 'location', 'place', 'address', 'where'].includes(norm)) {
    return 'location'
  }
  // Event title patterns
  if (['event', 'eventtitle', 'interview', 'interviewtitle', 'meeting', 'meetingtitle'].includes(norm)) {
    return 'event_title'
  }
  return null
}

// Format event_date (e.g. "2026-04-30T16:00:00.000Z") as "07 May 2026" in SGT.
function formatEventDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Singapore' })
}

// Format event_time (e.g. "14:30:00") as "14:30".
function formatEventTime(timeStr) {
  if (!timeStr) return ''
  return timeStr.slice(0, 5)
}

// Resolve a template variable to an event field value.
// Priority: explicit event_field_map (from template metadata) > pattern matcher fallback.
function resolveVarToEventField(vname, eventFieldMap) {
  // Explicit mapping from template editor takes precedence
  if (eventFieldMap && eventFieldMap[vname]) {
    return eventFieldMap[vname]
  }
  // Fallback: pattern matcher
  return matchVarToEventField(vname)
}

// Build an autofill values object by matching event fields to template variable names.
// Returns { autoFilledValues, autoFilledKeys (Set of var names that got filled) }.
function buildAutofillValues(event, contactName, ordered, eventFieldMap) {
  const filled = {}
  const filledKeys = new Set()
  if (!event) return { values: filled, keys: filledKeys }

  for (const vname of ordered) {
    const field = resolveVarToEventField(vname, eventFieldMap)
    if (!field) continue
    let val = ''
    if (field === 'contact_name') val = contactName || event.contact_name || ''
    else if (field === 'event_date') val = formatEventDate(event.event_date)
    else if (field === 'event_time') val = formatEventTime(event.event_time)
    else if (field === 'location') val = event.location || ''
    else if (field === 'event_title') val = event.title || ''
    if (val) {
      filled[vname] = val
      filledKeys.add(vname)
    }
  }
  return { values: filled, keys: filledKeys }
}

export default function SendTemplate({ conversationId, onClose, onSent }) {
  const { token } = useAuth()
  const [templates, setTemplates] = useState([])
  const [selected, setSelected] = useState(null)
  const [values, setValues] = useState({})
  const [autoFilledKeys, setAutoFilledKeys] = useState(new Set())
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [linkedEvents, setLinkedEvents] = useState([])
  const [selectedEventId, setSelectedEventId] = useState(null)
  const [contactName, setContactName] = useState('')

  // Load templates on mount
  useEffect(() => {
    fetch(`${API}/templates`, { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          // Sort: approved first (alphabetical), then non-approved
          const sorted = [...data].sort((a, b) => {
            if (a.status === 'approved' && b.status !== 'approved') return -1
            if (a.status !== 'approved' && b.status === 'approved') return 1
            return (a.name || '').localeCompare(b.name || '')
          })
          setTemplates(sorted)
        }
      })
      .catch(() => setTemplates([]))
  }, [token])

  // Fetch linked events for this conversation (today forward only)
  useEffect(() => {
    if (!conversationId || !token) return
    const today = new Date()
    const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    fetch(`${API}/calendar?conversation_id=${conversationId}&from=${ymd(today)}`, {
      headers: { Authorization: 'Bearer ' + token }
    })
      .then(r => r.json())
      .then(data => setLinkedEvents(Array.isArray(data) ? data : []))
      .catch(() => setLinkedEvents([]))
  }, [conversationId, token])

  // Fetch the conversation's contact name (for autofill)
  useEffect(() => {
    if (!conversationId || !token) return
    fetch(`${API}/conversations/${conversationId}`, { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.json())
      .then(data => setContactName(data?.name || ''))
      .catch(() => setContactName(''))
  }, [conversationId, token])

  const selectedEvent = useMemo(
    () => linkedEvents.find(e => e.id === selectedEventId) || null,
    [linkedEvents, selectedEventId]
  )

  // Apply autofill whenever template OR event selection changes
  function applyAutofill(template, event) {
    if (!template) return
    const ordered = template.variables?.ordered || []
    const storedDefaults = template.variables?.defaults || {}
    const eventFieldMap = template.variables?.event_field_map || {}
    // Start from stored defaults
    const newValues = {}
    for (const name of ordered) {
      newValues[name] = storedDefaults[name] !== undefined ? storedDefaults[name] : ''
    }
    // Layer event autofill on top
    const { values: autoVals, keys: autoKeys } = buildAutofillValues(event, contactName, ordered, eventFieldMap)
    Object.assign(newValues, autoVals)
    setValues(newValues)
    setAutoFilledKeys(autoKeys)
  }

  // Re-run autofill when event picker changes (template stays the same)
  useEffect(() => {
    if (selected) applyAutofill(selected, selectedEvent)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEventId, contactName])

  // When user picks a template, populate values from defaults + event autofill
  function selectTemplate(t) {
    if (t.status !== 'approved') return
    setError('')
    const v = t.variables || {}
    const storedOrdered = Array.isArray(v.ordered) ? v.ordered : []
    const storedDefaults = v.defaults || {}

    // Auto-extract variables from the body ONLY if no variables are registered.
    const augmentedOrdered = [...storedOrdered]
    const augmentedLabels = { ...(v.labels || {}) }
    if (storedOrdered.length === 0 && t.source !== 'meta_library') {
      const matches = (t.body || '').match(/\{\{\s*(\w+)\s*\}\}/g) || []
      const seen = new Set()
      for (const m of matches) {
        const name = m.replace(/[{}\s]/g, '')
        if (seen.has(name)) continue
        seen.add(name)
        augmentedOrdered.push(name)
      }
    }

    const augmented = {
      ...t,
      variables: {
        ordered: augmentedOrdered,
        defaults: storedDefaults,
        labels: augmentedLabels
      }
    }
    setSelected(augmented)
    applyAutofill(augmented, selectedEvent)
  }

  function updateValue(name, val) {
    setValues(p => ({ ...p, [name]: val }))
    // If user manually edits an auto-filled field, drop it from autoFilledKeys
    if (autoFilledKeys.has(name)) {
      setAutoFilledKeys(prev => {
        const next = new Set(prev)
        next.delete(name)
        return next
      })
    }
  }

  function clearAutofill() {
    if (!selected) return
    const ordered = selected.variables?.ordered || []
    const storedDefaults = selected.variables?.defaults || {}
    const cleared = {}
    for (const name of ordered) {
      cleared[name] = storedDefaults[name] !== undefined ? storedDefaults[name] : ''
    }
    setValues(cleared)
    setAutoFilledKeys(new Set())
    setSelectedEventId(null)
  }

  // Render the final message that will be sent (substituting all values)
  const renderedBody = selected
    ? substituteBody(selected.body, (selected.variables?.ordered || []), values)
    : ''

  // Check whether all required variables have values
  const ordered = selected?.variables?.ordered || []
  const missingVars = ordered.filter(name => !values[name] || !values[name].trim())
  const canSend = selected && selected.status === 'approved' && missingVars.length === 0

  async function send() {
    if (!canSend) return
    setError('')
    setSending(true)
    try {
      const r = await fetch(`${API}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({
          conversation_id: conversationId,
          direction: 'out',
          text: renderedBody,
          template_id: selected.id
        })
      })
      if (!r.ok) {
        const d = await r.json().catch(() => ({}))
        setError(d.error || 'Failed to send')
        return
      }
      onSent && onSent()
      onClose()
    } catch {
      setError('Network error. Try again.')
    } finally {
      setSending(false)
    }
  }

  // Filter templates by search query
  const visibleTemplates = templates.filter(t =>
    !search.trim() ||
    (t.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (t.body || '').toLowerCase().includes(search.toLowerCase())
  )

  const STATUS_STYLE = {
    approved: { bg: '#e7f5e9', color: '#1d6e2c', label: 'Approved' },
    pending: { bg: '#fef3c7', color: '#9a6a00', label: 'Pending' },
    draft: { bg: '#f5f3ef', color: '#6e6a63', label: 'Draft' },
    rejected: { bg: '#fee2e2', color: '#dc2626', label: 'Rejected' }
  }

  return (
    <Modal title="Send Template" subtitle="Pick a template and fill in the values for this message" onClose={onClose} width={920}>
      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr 260px', gap: 20, height: 540 }}>

        {/* LEFT: Template picker */}
        <div style={{ borderRight: '0.5px solid #dcd8d0', paddingRight: 16, display: 'flex', flexDirection: 'column' }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search templates..."
            style={{ padding: '7px 10px', border: '0.5px solid #dcd8d0', borderRadius: 6, fontSize: 12, outline: 'none', marginBottom: 10 }} />
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {visibleTemplates.length === 0 ? (
              <div style={{ fontSize: 11, color: '#9a958c', textAlign: 'center', padding: 16, fontStyle: 'italic' }}>No templates yet.</div>
            ) : visibleTemplates.map(t => {
              const isApproved = t.status === 'approved'
              const isSelected = selected?.id === t.id
              const ss = STATUS_STYLE[t.status] || STATUS_STYLE.draft
              return (
                <button
                  key={t.id}
                  onClick={() => selectTemplate(t)}
                  disabled={!isApproved}
                  style={{
                    textAlign: 'left',
                    padding: '10px 12px',
                    background: isSelected ? ACCENT : (isApproved ? '#fff' : '#faf9f7'),
                    border: isSelected ? `0.5px solid ${ACCENT}` : '0.5px solid #dcd8d0',
                    borderRadius: 7,
                    cursor: isApproved ? 'pointer' : 'not-allowed',
                    opacity: isApproved ? 1 : 0.5,
                    transition: 'all 0.15s ease'
                  }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: isSelected ? '#fff' : '#14130f', marginBottom: 4, fontFamily: 'monospace' }}>
                    {t.name}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, padding: '1px 6px', background: isSelected ? 'rgba(255,255,255,0.18)' : ss.bg, color: isSelected ? '#fff' : ss.color, borderRadius: 3, fontWeight: 500 }}>
                      {ss.label}
                    </span>
                    {t.source === 'meta_library' && (
                      <span style={{ fontSize: 9, padding: '1px 6px', background: isSelected ? 'rgba(255,255,255,0.18)' : '#e7f0fd', color: isSelected ? '#fff' : '#1877f2', borderRadius: 3 }}>Meta</span>
                    )}
                    {Array.isArray(t.variables?.ordered) && t.variables.ordered.length > 0 && (
                      <span style={{ fontSize: 9, color: isSelected ? 'rgba(255,255,255,0.7)' : '#9a958c' }}>{t.variables.ordered.length} var{t.variables.ordered.length === 1 ? '' : 's'}</span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* MIDDLE: Variables fill */}
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
          {!selected ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9a958c', fontSize: 12, fontStyle: 'italic' }}>
              Pick a template from the list to begin.
            </div>
          ) : (
            <>
              <div style={{ marginBottom: 12, padding: '8px 12px', background: '#f5f3ef', borderRadius: 7, fontSize: 10, color: '#6e6a63' }}>
                <span style={{ fontFamily: 'monospace', color: '#14130f', fontWeight: 600 }}>{selected.name}</span>
                {selected.source === 'meta_library' && <span style={{ marginLeft: 8, padding: '1px 6px', background: '#e7f0fd', color: '#1877f2', borderRadius: 3, fontSize: 9 }}>Meta Library</span>}
                {selected.variables?.ordered?.length > 0 && (
                  <span style={{ marginLeft: 8 }}>{selected.variables.ordered.length} variable{selected.variables.ordered.length === 1 ? '' : 's'}</span>
                )}
              </div>

              {/* Event picker - only shown when conversation has linked events AND template has variables */}
              {linkedEvents.length > 0 && ordered.length > 0 && (
                <div style={{ marginBottom: 14, padding: '10px 12px', background: '#fafaff', border: '0.5px solid #e0e0f5', borderRadius: 7 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: '#4a4742', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                      Auto-fill from event
                    </div>
                    {autoFilledKeys.size > 0 && (
                      <button onClick={clearAutofill}
                        style={{ fontSize: 10, color: '#dc2626', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 500 }}>
                        Clear all
                      </button>
                    )}
                  </div>
                  <select
                    value={selectedEventId || ''}
                    onChange={e => setSelectedEventId(e.target.value ? parseInt(e.target.value) : null)}
                    style={{
                      width: '100%', padding: '7px 10px',
                      border: '0.5px solid #dcd8d0', borderRadius: 6,
                      fontSize: 11, outline: 'none', background: '#fff', color: '#14130f',
                      cursor: 'pointer'
                    }}>
                    <option value="">None (manual fill)</option>
                    {linkedEvents.map(ev => {
                      const dateStr = formatEventDate(ev.event_date)
                      const timeStr = formatEventTime(ev.event_time)
                      return (
                        <option key={ev.id} value={ev.id}>
                          {ev.event_type_name ? `[${ev.event_type_name}] ` : ''}{ev.title} - {dateStr}{timeStr ? ` ${timeStr}` : ''}
                        </option>
                      )
                    })}
                  </select>
                  {selectedEvent && autoFilledKeys.size > 0 && (
                    <div style={{ marginTop: 6, fontSize: 10, color: '#5b21b6' }}>
                      Filled {autoFilledKeys.size} field{autoFilledKeys.size === 1 ? '' : 's'} from event. All fields editable below.
                    </div>
                  )}
                </div>
              )}

              {ordered.length === 0 ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 0' }}>
                  <div style={{ fontSize: 11, color: '#6e6a63', textAlign: 'center', maxWidth: 240 }}>
                    This template has no variables. The message above is ready to send.
                  </div>
                </div>
              ) : (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#4a4742', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                      Fill Values
                    </div>
                    <div style={{ fontSize: 10, color: missingVars.length > 0 ? '#9a6a00' : '#1d6e2c' }}>
                      {missingVars.length > 0 ? `${missingVars.length} of ${ordered.length} remaining` : `All ${ordered.length} filled`}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', flex: 1, paddingRight: 4 }}>
                    {ordered.map((vname, idx) => {
                      const label = selected.variables?.labels?.[vname]
                      const isEmpty = !values[vname] || !values[vname].trim()
                      const isAutoFilled = autoFilledKeys.has(vname)
                      const displayName = label || vname
                      return (
                        <div key={vname}>
                          <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                            <span style={{ fontSize: 11, color: '#14130f', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
                              {displayName}
                              {isAutoFilled && (
                                <span style={{
                                  fontSize: 8,
                                  padding: '1px 5px',
                                  background: '#fef3c7',
                                  color: '#92400e',
                                  borderRadius: 3,
                                  fontWeight: 600,
                                  letterSpacing: '0.3px',
                                  textTransform: 'uppercase'
                                }}>
                                  Auto
                                </span>
                              )}
                            </span>
                            <span style={{ fontSize: 9, color: '#9a958c', fontFamily: 'monospace' }}>
                              {`{{${idx + 1}}}`}
                            </span>
                          </label>
                          <input
                            value={values[vname] || ''}
                            onChange={e => updateValue(vname, e.target.value)}
                            placeholder={isEmpty ? `Enter ${displayName.toLowerCase()}` : ''}
                            style={{
                              width: '100%',
                              padding: '8px 11px',
                              border: isEmpty
                                ? '0.5px solid #f5b5b5'
                                : (isAutoFilled ? '0.5px solid #fbbf24' : '0.5px solid #dcd8d0'),
                              borderRadius: 6,
                              fontSize: 12,
                              outline: 'none',
                              background: isAutoFilled ? '#fffbeb' : '#fff',
                              color: '#14130f',
                              boxSizing: 'border-box',
                              transition: 'border-color 0.15s ease'
                            }} />
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          {error && (
            <div style={{ padding: '10px 12px', background: '#fef2f2', border: '0.5px solid #fecaca', borderRadius: 7, fontSize: 12, color: '#dc2626', marginTop: 12 }}>
              {error}
            </div>
          )}

          {selected && (
            <div style={{ display: 'flex', gap: 10, marginTop: 16, paddingTop: 14, borderTop: '0.5px solid #f5f3ef' }}>
              <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
              <Btn onClick={send} disabled={!canSend || sending} style={{ flex: 1 }}>
                {sending ? 'Sending...' : missingVars.length > 0 ? `Fill ${missingVars.length} more value${missingVars.length === 1 ? '' : 's'}` : 'Send Message'}
              </Btn>
            </div>
          )}
        </div>

        {/* RIGHT: Live preview */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#4a4742', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 12 }}>
            Preview
          </div>
          {selected ? (
            <IPhonePreview
              body={renderedBody}
              buttons={selected.buttons || []}
              variableDefaults={values}
              variableOrder={ordered}
            />
          ) : (
            <div style={{ width: 240, height: 460, background: '#faf9f7', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9a958c', fontSize: 11, fontStyle: 'italic', textAlign: 'center', padding: 20 }}>
              Pick a template to see the preview
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}