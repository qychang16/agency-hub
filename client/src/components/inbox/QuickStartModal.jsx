// QuickStartModal
//
// Start a new WhatsApp conversation by entering a phone number and a first
// message. Auto-creates the contact + conversation if they don't already
// exist for this workspace. Reuses the wallet billing pipeline via
// POST /conversations/quick-start.
//
// Features:
//   - Country selector + libphonenumber-js normalisation (shared with NewContactModal)
//   - Optional name (defaults to E.164 phone if blank)
//   - Sender phone selector (auto-pick if only one connected)
//   - Free-form text OR pre-saved template (with variable substitution)
//   - Template variable inputs auto-populated by template body parsing
//   - Cold-contact warning when free-form is selected
//   - Live error states for INSUFFICIENT_BALANCE / WINDOW_CLOSED / SENDER_DISCONNECTED / META_SEND_FAILED
//   - On success, calls onCreated(conversation_id) so InboxList navigates

import { useState, useEffect, useMemo, useRef } from 'react'
import { useAuth } from '../../context/AuthContext'
import { API } from '../../utils/constants'
import { ink, accent, semantic, fonts, textSize, textWeight, space, radius, border, shadow } from '../../utils/designTokens'
import { getExampleNumber } from 'libphonenumber-js'
import examples from 'libphonenumber-js/examples.mobile.json'
import {
  COUNTRIES,
  toTitleCase,
  normalizePhone,
  displayPhone,
  Field,
  inputBase,
  inputFocus,
} from './phoneUtils'

export default function QuickStartModal({ onClose, onCreated }) {
  const { token } = useAuth()

  // Form state
  const [phoneIso, setPhoneIso] = useState('SG')
  const [phoneRaw, setPhoneRaw] = useState('')
  const [phoneFocused, setPhoneFocused] = useState(false)
  const [name, setName] = useState('')
  const [senderPhoneId, setSenderPhoneId] = useState(null)
  const [messageType, setMessageType] = useState('text')  // 'text' | 'template'
  const [text, setText] = useState('')
  const [templateId, setTemplateId] = useState(null)
  const [templateVars, setTemplateVars] = useState({})  // { varName: value }

  // Data loaded async
  const [phoneNumbers, setPhoneNumbers] = useState([])
  const [templates, setTemplates] = useState([])
  const [loadingMeta, setLoadingMeta] = useState(true)

  // UI state
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState(null)  // { error, code, ...extras }
  const [submitting, setSubmitting] = useState(false)

  const phoneInputRef = useRef(null)
  const currentCountry = COUNTRIES.find(c => c.iso === phoneIso) || COUNTRIES[0]
  const selectedTemplate = useMemo(
    () => templates.find(t => t.id === templateId) || null,
    [templates, templateId]
  )

  // Parse template body to extract variable names (matches broadcast worker pattern)
  const templateVarNames = useMemo(() => {
    if (!selectedTemplate?.body) return []
    const matches = [...selectedTemplate.body.matchAll(/\{\{\s*(\w+)\s*\}\}/g)]
    return [...new Set(matches.map(m => m[1]))]
  }, [selectedTemplate])

  // ESC closes modal
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape' && !submitting) onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, submitting])

  // Load phone numbers (only connected ones) + templates (only approved ones)
  useEffect(() => {
    let cancelled = false
    Promise.all([
      fetch(`${API}/phone-numbers`, { headers: { Authorization: 'Bearer ' + token } }).then(r => r.json()).catch(() => []),
      fetch(`${API}/templates?status=approved`, { headers: { Authorization: 'Bearer ' + token } }).then(r => r.json()).catch(() => []),
    ]).then(([phones, tpls]) => {
      if (cancelled) return
      const connected = Array.isArray(phones) ? phones.filter(p => p.connection_status !== 'DISCONNECTED' && p.status === 'active') : []
      setPhoneNumbers(connected)
      if (connected.length === 1) setSenderPhoneId(connected[0].id)
      else if (connected.length > 1) {
        const primary = connected.find(p => p.is_primary)
        if (primary) setSenderPhoneId(primary.id)
      }
      setTemplates(Array.isArray(tpls) ? tpls : [])
      setLoadingMeta(false)
    })
    return () => { cancelled = true }
  }, [token])

  // Focus phone input on open
  useEffect(() => {
    if (!loadingMeta && phoneInputRef.current) phoneInputRef.current.focus()
  }, [loadingMeta])

  function handlePhoneBlur() {
    setPhoneFocused(false)
    if (phoneRaw.trim()) {
      const normalized = normalizePhone(phoneRaw, phoneIso)
      if (normalized) setPhoneRaw(displayPhone(normalized, phoneIso))
    }
  }

  function handleCountryChange(e) {
    setPhoneIso(e.target.value)
    setPhoneRaw('')
    if (errors.phone) setErrors(prev => ({ ...prev, phone: null }))
  }

  function handleTemplateSelect(e) {
    const id = parseInt(e.target.value) || null
    setTemplateId(id)
    setTemplateVars({})  // reset vars when switching templates
    setServerError(null)
  }

  function handleVarChange(varName, value) {
    setTemplateVars(prev => ({ ...prev, [varName]: value }))
  }

  function handleMessageTypeChange(newType) {
    setMessageType(newType)
    setServerError(null)
    if (newType === 'text') {
      setTemplateId(null)
      setTemplateVars({})
    } else {
      setText('')
    }
  }

  // Preview substituted template body
  const templatePreview = useMemo(() => {
    if (!selectedTemplate?.body) return ''
    return selectedTemplate.body.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k) => {
      return templateVars[k] || `{{${k}}}`
    })
  }, [selectedTemplate, templateVars])

  function validate() {
    const err = {}
    const normalized = normalizePhone(phoneRaw, phoneIso)
    if (!phoneRaw.trim()) {
      err.phone = 'Phone number is required'
    } else if (!normalized) {
      const example = getExampleNumber(phoneIso, examples)
      const expectedFormat = example ? example.formatInternational() : ''
      err.phone = `Invalid ${currentCountry.name} number${expectedFormat ? `. Example: ${expectedFormat}` : ''}`
    }
    if (!senderPhoneId) err.sender = 'Choose which phone to send from'
    if (messageType === 'text' && !text.trim()) err.text = 'Type a message to send'
    if (messageType === 'template' && !templateId) err.template = 'Choose a template'
    if (messageType === 'template' && templateVarNames.some(v => !templateVars[v] || !templateVars[v].trim())) {
      err.template = 'Fill in all template variables'
    }
    setErrors(err)
    return Object.keys(err).length === 0
  }

  async function handleSubmit() {
    setServerError(null)
    if (!validate()) return
    setSubmitting(true)
    try {
      const phone = normalizePhone(phoneRaw, phoneIso)
      const finalName = name.trim() ? toTitleCase(name) : null
      const body = {
        phone,
        name: finalName,
        sender_phone_number_id: senderPhoneId,
        message_type: messageType,
        ...(messageType === 'text' ? { text: text.trim() } : {}),
        ...(messageType === 'template' ? { template_id: templateId, template_variables: templateVars } : {}),
      }
      const r = await fetch(`${API}/conversations/quick-start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify(body),
      })
      const data = await r.json()
      if (!r.ok) {
        setServerError(data)
        setSubmitting(false)
        return
      }
      // Success — navigate to new conversation
      onCreated?.(data.conversation_id)
      onClose()
    } catch (err) {
      setServerError({ error: err.message || 'Network error. Please try again.', code: 'NETWORK' })
      setSubmitting(false)
    }
  }

  // No connected phones — show inline message instead of full form
  if (!loadingMeta && phoneNumbers.length === 0) {
    return (
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(10, 9, 7, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16, fontFamily: fonts.body }}>
        <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 420, background: '#fff', borderRadius: radius.lg, boxShadow: shadow.overlay, padding: space[5] }}>
          <div style={{ fontSize: textSize.base, fontWeight: textWeight.semibold, color: ink[900], marginBottom: space[2] }}>No connected phone numbers</div>
          <div style={{ fontSize: textSize.sm, color: ink[600], marginBottom: space[4] }}>
            Connect a WhatsApp Business phone number in Settings → Phone Numbers before starting new conversations.
          </div>
          <button onClick={onClose} style={{ padding: '8px 14px', borderRadius: radius.md, border: `0.5px solid ${ink[300]}`, background: '#fff', color: ink[700], fontSize: textSize.sm, fontWeight: textWeight.medium, cursor: 'pointer' }}>Close</button>
        </div>
      </div>
    )
  }

  return (
    <div onClick={() => !submitting && onClose()}
      style={{ position: 'fixed', inset: 0, background: 'rgba(10, 9, 7, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16, fontFamily: fonts.body }}>
      <div onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 480, background: '#fff', borderRadius: radius.lg, boxShadow: shadow.overlay, maxHeight: 'calc(100vh - 40px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: `${space[4]}px ${space[5]}px`, borderBottom: `0.5px solid ${ink[200]}` }}>
          <div style={{ fontFamily: fonts.display, fontSize: textSize.lg, fontWeight: textWeight.semibold, color: ink[900], letterSpacing: '-0.2px' }}>
            New conversation
          </div>
          <div style={{ fontSize: textSize.xs, color: ink[600], marginTop: 3 }}>
            Send a message to any phone number. Country code is required.
          </div>
        </div>

        {/* Body — scrollable */}
        <div style={{ padding: space[5], overflowY: 'auto', flex: 1 }}>
          {loadingMeta ? (
            <div style={{ textAlign: 'center', padding: space[5], color: ink[500], fontSize: textSize.sm }}>Loading…</div>
          ) : (
            <>
              {/* Phone */}
              <Field label="Phone number" required error={errors.phone}>
                <div style={{ display: 'flex', gap: space[2] }}>
                  <select value={phoneIso} onChange={handleCountryChange} disabled={submitting}
                    style={{ ...inputBase, width: 130, flexShrink: 0 }}>
                    {COUNTRIES.map(c => (
                      <option key={c.iso} value={c.iso}>{c.iso} {c.code}</option>
                    ))}
                  </select>
                  <input
                    ref={phoneInputRef}
                    type="tel"
                    value={phoneRaw}
                    onChange={e => { setPhoneRaw(e.target.value); if (errors.phone) setErrors(prev => ({ ...prev, phone: null })) }}
                    onFocus={() => setPhoneFocused(true)}
                    onBlur={handlePhoneBlur}
                    placeholder={getExampleNumber(phoneIso, examples)?.nationalNumber || ''}
                    disabled={submitting}
                    style={{ ...inputBase, flex: 1, ...(phoneFocused ? inputFocus : {}) }}
                  />
                </div>
              </Field>

              {/* Name (optional) */}
              <Field label="Name (optional)">
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  onBlur={() => name.trim() && setName(toTitleCase(name))}
                  placeholder="Leave blank to use phone as name"
                  disabled={submitting}
                  style={inputBase}
                />
              </Field>

              {/* Sender selector */}
              <Field label="Send from" required error={errors.sender}>
                {phoneNumbers.length === 1 ? (
                  <div style={{ ...inputBase, color: ink[700], background: ink[100], cursor: 'default' }}>
                    {phoneNumbers[0].display_name || phoneNumbers[0].number}
                  </div>
                ) : (
                  <select value={senderPhoneId || ''} onChange={e => setSenderPhoneId(parseInt(e.target.value) || null)} disabled={submitting} style={inputBase}>
                    <option value="">Choose a sender phone…</option>
                    {phoneNumbers.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.display_name || p.number} {p.is_primary ? '(primary)' : ''}
                      </option>
                    ))}
                  </select>
                )}
              </Field>

              {/* Message type toggle */}
              <Field label="Message type" required>
                <div style={{ display: 'flex', gap: space[2] }}>
                  <button type="button" onClick={() => handleMessageTypeChange('text')} disabled={submitting}
                    style={{
                      flex: 1, padding: '10px 12px', borderRadius: radius.md,
                      border: `1px solid ${messageType === 'text' ? accent.DEFAULT : ink[300]}`,
                      background: messageType === 'text' ? accent.DEFAULT : '#fff',
                      color: messageType === 'text' ? '#fff' : ink[700],
                      fontSize: textSize.sm, fontWeight: textWeight.medium, cursor: submitting ? 'not-allowed' : 'pointer',
                    }}>
                    Free-form text
                  </button>
                  <button type="button" onClick={() => handleMessageTypeChange('template')} disabled={submitting}
                    style={{
                      flex: 1, padding: '10px 12px', borderRadius: radius.md,
                      border: `1px solid ${messageType === 'template' ? accent.DEFAULT : ink[300]}`,
                      background: messageType === 'template' ? accent.DEFAULT : '#fff',
                      color: messageType === 'template' ? '#fff' : ink[700],
                      fontSize: textSize.sm, fontWeight: textWeight.medium, cursor: submitting ? 'not-allowed' : 'pointer',
                    }}>
                    Template
                  </button>
                </div>
              </Field>

              {/* Cold-contact warning for free-form */}
              {messageType === 'text' && (
                <div style={{ padding: '10px 12px', background: '#fef3c7', border: '0.5px solid #fde68a', borderRadius: radius.md, marginBottom: space[3], display: 'flex', gap: space[2], alignItems: 'flex-start' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#92400e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginTop: 1, flexShrink: 0 }}>
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  <div style={{ fontSize: 11, color: '#78350f', lineHeight: 1.5 }}>
                    Free-form messages require the recipient to have messaged you in the last 24 hours.
                    For cold outreach, use a template instead.
                  </div>
                </div>
              )}

              {/* Free-form text input */}
              {messageType === 'text' && (
                <Field label="Message" required error={errors.text}>
                  <textarea
                    value={text}
                    onChange={e => { setText(e.target.value); if (errors.text) setErrors(prev => ({ ...prev, text: null })) }}
                    rows={4}
                    placeholder="Type your message…"
                    disabled={submitting}
                    style={{ ...inputBase, resize: 'vertical', minHeight: 80, fontFamily: 'inherit' }}
                  />
                </Field>
              )}

              {/* Template selector */}
              {messageType === 'template' && (
                <>
                  <Field label="Template" required error={errors.template}>
                    <select value={templateId || ''} onChange={handleTemplateSelect} disabled={submitting} style={inputBase}>
                      <option value="">Choose a template…</option>
                      {templates.map(t => (
                        <option key={t.id} value={t.id}>
                          {t.name} {t.category ? `(${t.category})` : ''}
                        </option>
                      ))}
                    </select>
                  </Field>

                  {/* Variable inputs */}
                  {templateVarNames.length > 0 && (
                    <div style={{ marginBottom: space[3] }}>
                      <div style={{ fontSize: 10, fontWeight: textWeight.semibold, color: ink[700], marginBottom: space[2], letterSpacing: '0.4px', textTransform: 'uppercase' }}>
                        Variables
                      </div>
                      {templateVarNames.map(varName => (
                        <div key={varName} style={{ marginBottom: space[2] }}>
                          <input
                            type="text"
                            value={templateVars[varName] || ''}
                            onChange={e => handleVarChange(varName, e.target.value)}
                            placeholder={`{{${varName}}}`}
                            disabled={submitting}
                            style={inputBase}
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Preview */}
                  {selectedTemplate && (
                    <div style={{ marginBottom: space[3] }}>
                      <div style={{ fontSize: 10, fontWeight: textWeight.semibold, color: ink[700], marginBottom: space[1] + 1, letterSpacing: '0.4px', textTransform: 'uppercase' }}>Preview</div>
                      <div style={{ padding: '10px 12px', background: '#dcf8c6', borderRadius: radius.md, fontSize: textSize.sm, color: ink[800], whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                        {templatePreview}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Server error */}
              {serverError && (
                <div style={{ padding: '10px 12px', background: '#fef2f2', border: '0.5px solid #fecaca', borderRadius: radius.md, marginBottom: space[3] }}>
                  <div style={{ fontSize: textSize.sm, fontWeight: textWeight.semibold, color: '#b91c1c' }}>{serverError.error}</div>
                  {serverError.code === 'INSUFFICIENT_BALANCE' && (
                    <div style={{ fontSize: 11, color: '#7f1d1d', marginTop: 4 }}>
                      Balance: S${(serverError.balance_cents / 100).toFixed(2)} · Required: S${(serverError.required_cents / 100).toFixed(2)} · Short: S${(serverError.shortfall_cents / 100).toFixed(2)}.
                      {serverError.suggestion && <> {serverError.suggestion}</>}
                    </div>
                  )}
                  {serverError.code === 'WINDOW_CLOSED' && (
                    <button onClick={() => { setServerError(null); handleMessageTypeChange('template') }}
                      style={{ marginTop: 6, padding: '4px 8px', borderRadius: radius.sm, border: 'none', background: '#b91c1c', color: '#fff', fontSize: 11, cursor: 'pointer' }}>
                      Switch to template
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: `${space[3]}px ${space[5]}px`, borderTop: `0.5px solid ${ink[200]}`, display: 'flex', justifyContent: 'flex-end', gap: space[2] }}>
          <button onClick={onClose} disabled={submitting}
            style={{ padding: '8px 14px', borderRadius: radius.md, border: `0.5px solid ${ink[300]}`, background: '#fff', color: ink[700], fontSize: textSize.sm, fontWeight: textWeight.medium, cursor: submitting ? 'not-allowed' : 'pointer' }}>
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={submitting || loadingMeta}
            style={{ padding: '8px 16px', borderRadius: radius.md, border: 'none', background: submitting || loadingMeta ? ink[400] : accent.DEFAULT, color: '#fff', fontSize: textSize.sm, fontWeight: textWeight.semibold, cursor: submitting || loadingMeta ? 'not-allowed' : 'pointer' }}>
            {submitting ? 'Sending…' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  )
}