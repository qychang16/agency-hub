import { useState, useEffect } from 'react'
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

export default function SendTemplate({ conversationId, onClose, onSent }) {
  const { token } = useAuth()
  const [templates, setTemplates] = useState([])
  const [selected, setSelected] = useState(null)
  const [values, setValues] = useState({})
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

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

  // When user picks a template, populate values from defaults
  function selectTemplate(t) {
    if (t.status !== 'approved') return
    setError('')
    const v = t.variables || {}
    const storedOrdered = Array.isArray(v.ordered) ? v.ordered : []
    const storedDefaults = v.defaults || {}

    // Auto-extract variables from the body ONLY if no variables are registered.
    // For Meta Library templates and any template with a curated ordered list,
    // we trust the stored list (it knows the correct param_N to position mapping).
    const augmentedOrdered = [...storedOrdered]
    const augmentedLabels = { ...(v.labels || {}) }
    if (storedOrdered.length === 0 && t.source !== 'meta_library') {
      // Legacy template with no registered variables: extract from body
      const matches = (t.body || '').match(/\{\{\s*(\w+)\s*\}\}/g) || []
      const seen = new Set()
      for (const m of matches) {
        const name = m.replace(/[{}\s]/g, '')
        if (seen.has(name)) continue
        seen.add(name)
        augmentedOrdered.push(name)
      }
    }

    // Build the augmented template object so render uses the merged ordered list
    const augmented = {
      ...t,
      variables: {
        ordered: augmentedOrdered,
        defaults: storedDefaults,
        labels: augmentedLabels
      }
    }
    setSelected(augmented)
    // Initialise values: use stored defaults; everything else starts empty
    const initialValues = {}
    for (const name of augmentedOrdered) {
      initialValues[name] = storedDefaults[name] !== undefined ? storedDefaults[name] : ''
    }
    setValues(initialValues)
  }

  function updateValue(name, val) {
    setValues(p => ({ ...p, [name]: val }))
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
              <div style={{ marginBottom: 16, padding: '8px 12px', background: '#f5f3ef', borderRadius: 7, fontSize: 10, color: '#6e6a63' }}>
                <span style={{ fontFamily: 'monospace', color: '#14130f', fontWeight: 600 }}>{selected.name}</span>
                {selected.source === 'meta_library' && <span style={{ marginLeft: 8, padding: '1px 6px', background: '#e7f0fd', color: '#1877f2', borderRadius: 3, fontSize: 9 }}>Meta Library</span>}
                {selected.variables?.ordered?.length > 0 && (
                  <span style={{ marginLeft: 8 }}>{selected.variables.ordered.length} variable{selected.variables.ordered.length === 1 ? '' : 's'}</span>
                )}
              </div>

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
                      const displayName = label || vname
                      return (
                        <div key={vname}>
                          <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                            <span style={{ fontSize: 11, color: '#14130f', fontWeight: 500 }}>
                              {displayName}
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
                              border: isEmpty ? '0.5px solid #f5b5b5' : '0.5px solid #dcd8d0',
                              borderRadius: 6,
                              fontSize: 12,
                              outline: 'none',
                              background: '#fff',
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