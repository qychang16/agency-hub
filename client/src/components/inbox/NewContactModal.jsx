import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../context/AuthContext'
import { API } from '../../utils/constants'
import { ink, accent, semantic, fonts, textSize, textWeight, space, radius, border, shadow, microLabel } from '../../utils/designTokens'
import { AsYouType, parsePhoneNumberFromString, getExampleNumber } from 'libphonenumber-js'
import examples from 'libphonenumber-js/examples.mobile.json'

// Country list — order matters (SG first as default, then by relevance to SG employment agency)
const COUNTRIES = [
  { iso: 'SG', code: '+65',  name: 'Singapore' },
  { iso: 'MY', code: '+60',  name: 'Malaysia' },
  { iso: 'ID', code: '+62',  name: 'Indonesia' },
  { iso: 'CN', code: '+86',  name: 'China' },
  { iso: 'IN', code: '+91',  name: 'India' },
  { iso: 'PH', code: '+63',  name: 'Philippines' },
  { iso: 'VN', code: '+84',  name: 'Vietnam' },
  { iso: 'TH', code: '+66',  name: 'Thailand' },
  { iso: 'HK', code: '+852', name: 'Hong Kong' },
  { iso: 'TW', code: '+886', name: 'Taiwan' },
  { iso: 'JP', code: '+81',  name: 'Japan' },
  { iso: 'KR', code: '+82',  name: 'South Korea' },
  { iso: 'US', code: '+1',   name: 'United States' },
  { iso: 'GB', code: '+44',  name: 'United Kingdom' },
  { iso: 'AU', code: '+61',  name: 'Australia' },
  { iso: 'CA', code: '+1',   name: 'Canada' },
  { iso: 'NZ', code: '+64',  name: 'New Zealand' },
  { iso: 'AE', code: '+971', name: 'UAE' },
  { iso: 'SA', code: '+966', name: 'Saudi Arabia' },
]

// Title-case a name: "sam LIM" -> "Sam Lim"
function toTitleCase(str) {
  if (!str) return ''
  return str.trim().toLowerCase().replace(/(^|\s|-|'|\()\S/g, c => c.toUpperCase())
}

// Format phone as the user types (uses libphonenumber AsYouType)
function formatPhoneAsYouType(raw, iso) {
  if (!raw) return ''
  const formatter = new AsYouType(iso)
  return formatter.input(raw)
}

// Get full E.164 format (e.g. +6591234567) for storing to DB
function normalizePhone(raw, iso) {
  if (!raw) return null
  const parsed = parsePhoneNumberFromString(raw, iso)
  return parsed && parsed.isValid() ? parsed.number : null
}

// Get nicely-formatted international display (e.g. "+65 9123 4567")
function displayPhone(raw, iso) {
  if (!raw) return ''
  const parsed = parsePhoneNumberFromString(raw, iso)
  return parsed && parsed.isValid() ? parsed.formatInternational() : raw
}

function Field({ label, required, error, children }) {
  return (
    <div style={{ marginBottom: space[3] }}>
      <label style={{
        display: 'block',
        fontSize: 10,
        fontWeight: textWeight.semibold,
        color: ink[700],
        marginBottom: space[1] + 1,
        letterSpacing: '0.4px',
        textTransform: 'uppercase',
        fontFamily: fonts.body,
      }}>
        {label}{required && <span style={{ color: semantic.danger, marginLeft: 3 }}>*</span>}
      </label>
      {children}
      {error && (
        <div style={{
          fontSize: 10,
          color: semantic.danger,
          marginTop: 3,
          fontFamily: fonts.body,
          fontWeight: textWeight.medium,
        }}>{error}</div>
      )}
    </div>
  )
}

const inputBase = {
  width: '100%',
  padding: '8px 10px',
  fontSize: textSize.sm,
  fontFamily: 'inherit',
  background: ink[100],
  color: ink[800],
  border: `0.5px solid ${ink[300]}`,
  borderRadius: radius.md,
  outline: 'none',
  boxSizing: 'border-box',
}

const inputFocus = { borderColor: accent.DEFAULT, background: '#fff' }

export default function NewContactModal({ onClose, onCreated, projects }) {
  const { token, user } = useAuth()

  // Core state
  const [type, setType] = useState(null)  // 'candidate' | 'client' | null
  const [name, setName] = useState('')
  const [company, setCompany] = useState('')
  const [role, setRole] = useState('')
  const [phoneIso, setPhoneIso] = useState('SG')
  const [phoneRaw, setPhoneRaw] = useState('')
  const [email, setEmail] = useState('')
  const [projectId, setProjectId] = useState('')
  const [pipelineStage, setPipelineStage] = useState('new')
  const [initialNote, setInitialNote] = useState('')

  // UI state
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [duplicate, setDuplicate] = useState(null)  // { id, name, type } if phone already exists
  const [phoneFocused, setPhoneFocused] = useState(false)

  const phoneInputRef = useRef(null)
  const nameInputRef = useRef(null)

  // Focus name field when type is picked
  useEffect(() => {
    if (type && nameInputRef.current) {
      setTimeout(() => nameInputRef.current.focus(), 50)
    }
  }, [type])

  // Close on ESC
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Check for duplicate phone — only when phone is fully valid, debounced
  useEffect(() => {
    setDuplicate(null)
    if (!phoneRaw || phoneRaw.length < 8) return
    const normalized = normalizePhone(phoneRaw, phoneIso)
    if (!normalized) return  // not a valid complete number yet

    const t = setTimeout(async () => {
      try {
        const r = await fetch(`${API}/contacts`, {
          headers: { Authorization: 'Bearer ' + token }
        })
        const list = await r.json()
        const match = Array.isArray(list) ? list.find(c => c.phone === normalized) : null
        setDuplicate(match || null)
      } catch {}
    }, 800)

    return () => clearTimeout(t)
  }, [phoneRaw, phoneIso, token])

  const currentCountry = COUNTRIES.find(c => c.iso === phoneIso) || COUNTRIES[0]

  function handleNameChange(e) {
    setName(e.target.value)
    if (errors.name) setErrors(prev => ({ ...prev, name: null }))
  }

  function handleNameBlur() {
    // Apply title case on blur
    if (name.trim()) setName(toTitleCase(name))
  }

  function handleCompanyChange(e) {
    setCompany(e.target.value)
    if (errors.company) setErrors(prev => ({ ...prev, company: null }))
  }

  function handleCompanyBlur() {
    if (company.trim()) setCompany(toTitleCase(company))
  }

  function handleRoleBlur() {
    if (role.trim()) setRole(toTitleCase(role))
  }

  function handlePhoneChange(e) {
    setPhoneRaw(e.target.value)
    if (errors.phone) setErrors(prev => ({ ...prev, phone: null }))
  }

  function handlePhoneBlur() {
    setPhoneFocused(false)
    // Format the phone on blur to a clean international display
    if (phoneRaw.trim()) {
      const normalized = normalizePhone(phoneRaw, phoneIso)
      if (normalized) {
        setPhoneRaw(displayPhone(normalized, phoneIso))
      }
    }
  }

  function handleCountryChange(e) {
    setPhoneIso(e.target.value)
    setPhoneRaw('')  // clear phone when country changes to avoid weird state
    setDuplicate(null)
  }

  function validate() {
    const err = {}
    if (!name.trim()) err.name = 'Name is required'
    if (type === 'client' && !company.trim()) err.company = 'Company is required for clients'

    const normalized = normalizePhone(phoneRaw, phoneIso)
    if (!phoneRaw.trim()) {
      err.phone = 'Phone number is required'
    } else if (!normalized) {
      const example = getExampleNumber(phoneIso, examples)
      const expectedFormat = example ? example.formatInternational() : ''
      err.phone = `Invalid ${currentCountry.name} number${expectedFormat ? `. Example: ${expectedFormat}` : ''}`
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      err.email = 'Invalid email format'
    }

    setErrors(err)
    return Object.keys(err).length === 0
  }

  async function handleSubmit() {
    if (!validate()) return
    if (duplicate) return  // blocked by duplicate warning

    setSubmitting(true)
    try {
      const phone = normalizePhone(phoneRaw, phoneIso)
      const finalName = toTitleCase(name)

      // Build notes JSON array if initial note provided
      const notes = initialNote.trim() ? JSON.stringify([{
        id: Date.now(),
        text: initialNote.trim(),
        created_at: new Date().toISOString(),
        author: user?.name || 'Director',
      }]) : '[]'

      // Create contact
      const contactBody = {
        name: finalName,
        phone,
        email: email.trim() || null,
        type,
        pipeline_stage: type === 'candidate' ? pipelineStage : null,
        assigned_to: user?.name || 'Director',
        pdpa_consented: true,  // active jobseekers always consent per Director's rule
        notes,
        current_company: type === 'client' ? toTitleCase(company) : null,
        candidate_role: role.trim() ? toTitleCase(role) : null,
      }

      const r = await fetch(`${API}/contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify(contactBody),
      })

      if (!r.ok) {
        const errData = await r.json().catch(() => ({}))
        throw new Error(errData.error || 'Failed to create contact')
      }

      const contact = await r.json()

      // Create a conversation for this contact
      const convoBody = {
        contact_id: contact.id,
        status: 'open',
        ...(projectId ? { project_id: parseInt(projectId) } : {}),
      }

      const rc = await fetch(`${API}/conversations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify(convoBody),
      })

      if (!rc.ok) {
        const errData = await rc.json().catch(() => ({}))
        throw new Error(errData.error || 'Contact created, but conversation creation failed. You can find them in Contacts.')
      }

      const convo = await rc.json()

      // Done — jump to new conversation
      onCreated?.(convo.id)
      onClose()
    } catch (err) {
      alert(err.message || 'Could not create contact. Please try again.')
      setSubmitting(false)
    }
  }

  function handleOpenDuplicate() {
    if (!duplicate) return
    // Backend now filters by contact_id — fetch only conversations for this contact
    fetch(`${API}/conversations?contact_id=${duplicate.id}`, {
      headers: { Authorization: 'Bearer ' + token }
    }).then(r => r.json()).then(list => {
      if (!Array.isArray(list)) {
        alert('Could not load conversations.')
        return
      }
      const existing = list.find(c => c.status === 'open') || list[0]
      if (existing) {
        onCreated?.(existing.id)
        onClose()
      } else {
        alert(`No conversation exists yet for ${duplicate.name}. Please create one manually from the Contacts screen, or message them from WhatsApp.`)
      }
    }).catch(() => {
      alert('Could not load conversations. Please try again.')
    })
  }

  const phoneDisplayValue = phoneFocused ? phoneRaw : (phoneRaw && !phoneFocused ? phoneRaw : phoneRaw)
  // libphonenumber AsYouType is buggy as user types; we just show the raw value while typing
  // and only apply formatting on blur

  return (
    <div onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(10, 9, 7, 0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 100, padding: 16,
        fontFamily: fonts.body,
      }}>
      <div onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 460,
          background: '#fff',
          borderRadius: radius.lg,
          boxShadow: shadow.overlay,
          maxHeight: 'calc(100vh - 40px)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}>

        {/* Header */}
        <div style={{
          padding: `${space[4]}px ${space[5]}px ${space[3]}px`,
          borderBottom: border.subtle,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div>
            <div style={{ ...microLabel, marginBottom: 2 }}>Create contact</div>
            <div style={{
              fontFamily: fonts.display,
              fontSize: textSize.lg,
              fontWeight: textWeight.semibold,
              color: ink[900],
              letterSpacing: '-0.2px',
            }}>
              {type === 'candidate' ? 'New candidate' : type === 'client' ? 'New client' : 'Choose contact type'}
            </div>
          </div>
          <button onClick={onClose}
            title="Close (ESC)"
            style={{
              width: 26, height: 26, borderRadius: radius.md,
              border: `0.5px solid ${ink[300]}`,
              background: 'transparent', cursor: 'pointer',
              color: ink[600],
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M3 3l10 10" strokeLinecap="round"/>
              <path d="M13 3l-10 10" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: `${space[4]}px ${space[5]}px` }}>

          {/* Step 1 — Choose type */}
          {!type && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: space[3] }}>
              <p style={{ fontSize: textSize.sm, color: ink[700], margin: 0 }}>
                Who are you adding?
              </p>
              <button onClick={() => setType('candidate')}
                style={{
                  padding: space[4],
                  border: `0.5px solid ${ink[300]}`,
                  borderRadius: radius.md,
                  background: '#fff',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: fonts.body,
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#d14a2b'; e.currentTarget.style.background = '#fdfbf8' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = ink[300]; e.currentTarget.style.background = '#fff' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: space[3] }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: radius.pill,
                    background: '#f5e9d6', color: '#7a5a1f',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: textSize.xs, fontWeight: textWeight.bold,
                    flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.5px',
                  }}>CA</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: textSize.md, fontWeight: textWeight.semibold, color: ink[900], marginBottom: 2 }}>
                      Candidate
                    </div>
                    <div style={{ fontSize: textSize.xs, color: ink[600] }}>
                      Jobseeker being placed with a client
                    </div>
                  </div>
                  <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke={ink[500]} strokeWidth="1.5">
                    <path d="M6 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </button>
              <button onClick={() => setType('client')}
                style={{
                  padding: space[4],
                  border: `0.5px solid ${ink[300]}`,
                  borderRadius: radius.md,
                  background: '#fff',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: fonts.body,
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = accent.DEFAULT; e.currentTarget.style.background = accent.soft }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = ink[300]; e.currentTarget.style.background = '#fff' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: space[3] }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: radius.pill,
                    background: accent.DEFAULT, color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: textSize.xs, fontWeight: textWeight.bold,
                    flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.5px',
                  }}>CL</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: textSize.md, fontWeight: textWeight.semibold, color: ink[900], marginBottom: 2 }}>
                      Client
                    </div>
                    <div style={{ fontSize: textSize.xs, color: ink[600] }}>
                      Company contact (HR, hiring manager)
                    </div>
                  </div>
                  <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke={ink[500]} strokeWidth="1.5">
                    <path d="M6 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </button>
            </div>
          )}

          {/* Step 2 — fields */}
          {type && (
            <>
              {/* Name — both */}
              <Field label={type === 'client' ? 'Contact name' : 'Name'} required error={errors.name}>
                <input ref={nameInputRef}
                  value={name}
                  onChange={handleNameChange}
                  onBlur={handleNameBlur}
                  placeholder={type === 'client' ? 'e.g. Sarah Tan' : 'e.g. Sam Lim'}
                  style={{ ...inputBase, ...(errors.name ? { borderColor: semantic.danger } : {}) }} />
              </Field>

              {/* Company — clients only */}
              {type === 'client' && (
                <Field label="Company" required error={errors.company}>
                  <input
                    value={company}
                    onChange={handleCompanyChange}
                    onBlur={handleCompanyBlur}
                    placeholder="e.g. ABC Pte Ltd"
                    style={{ ...inputBase, ...(errors.company ? { borderColor: semantic.danger } : {}) }} />
                </Field>
              )}

              {/* Role — clients: "HR Manager"; candidates: current role */}
              <Field label={type === 'client' ? 'Role at company' : 'Current / desired role'}>
                <input
                  value={role}
                  onChange={e => setRole(e.target.value)}
                  onBlur={handleRoleBlur}
                  placeholder={type === 'client' ? 'e.g. HR Manager' : 'e.g. Operations Executive'}
                  style={inputBase} />
              </Field>

              {/* Phone */}
              <Field label="Phone number" required error={errors.phone}>
                <div style={{ display: 'flex', gap: space[1] + 2 }}>
                  <select value={phoneIso} onChange={handleCountryChange}
                    style={{
                      width: 110,
                      padding: '8px 6px',
                      fontSize: textSize.xs,
                      fontFamily: 'inherit',
                      background: ink[100],
                      color: ink[800],
                      border: `0.5px solid ${ink[300]}`,
                      borderRadius: radius.md,
                      outline: 'none',
                      cursor: 'pointer',
                    }}>
                    {COUNTRIES.map(c => (
                      <option key={c.iso} value={c.iso}>{c.code} {c.iso}</option>
                    ))}
                  </select>
                  <input ref={phoneInputRef}
                    value={phoneRaw}
                    onChange={handlePhoneChange}
                    onFocus={() => setPhoneFocused(true)}
                    onBlur={handlePhoneBlur}
                    placeholder="9123 4567"
                    style={{
                      flex: 1,
                      ...inputBase,
                      fontFamily: fonts.mono,
                      ...(errors.phone ? { borderColor: semantic.danger } : {}),
                    }} />
                </div>
                {phoneRaw && !errors.phone && normalizePhone(phoneRaw, phoneIso) && !phoneFocused && (
                  <div style={{ fontSize: 10, color: semantic.success, marginTop: 3, fontWeight: textWeight.medium }}>
                    ✓ Valid {currentCountry.name} number
                  </div>
                )}
              </Field>

              {/* Duplicate warning */}
              {duplicate && (
                <div style={{
                  padding: space[3],
                  background: '#fde8e1',
                  border: '0.5px solid #d14a2b',
                  borderRadius: radius.md,
                  marginBottom: space[3],
                }}>
                  <div style={{ fontSize: 10, fontWeight: textWeight.bold, color: '#8e2a12', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: space[1] + 1 }}>
                    Already in contacts
                  </div>
                  <div style={{ fontSize: textSize.xs, color: '#8e2a12', marginBottom: space[2] }}>
                    This phone number belongs to <strong>{duplicate.name}</strong> ({duplicate.type}).
                  </div>
                  <button onClick={handleOpenDuplicate}
                    style={{
                      padding: `${space[1] + 1}px ${space[3]}px`,
                      background: '#8e2a12',
                      color: '#fff',
                      border: 'none',
                      borderRadius: radius.sm,
                      fontSize: 10,
                      fontWeight: textWeight.semibold,
                      cursor: 'pointer',
                      fontFamily: fonts.body,
                    }}>
                    Open existing conversation
                  </button>
                </div>
              )}

              {/* Email */}
              <Field label="Email" error={errors.email}>
                <input type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  style={{ ...inputBase, ...(errors.email ? { borderColor: semantic.danger } : {}) }} />
              </Field>

              {/* Candidate-only: Project + Stage */}
              {type === 'candidate' && (
                <>
                  <Field label="Project">
                    <select value={projectId} onChange={e => setProjectId(e.target.value)}
                      style={{ ...inputBase, cursor: 'pointer' }}>
                      <option value="">— No project —</option>
                      {(projects || []).filter(p => p.status === 'active').map(p => (
                        <option key={p.id} value={p.id}>{p.client_name} · {p.start_month} {p.start_year}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Pipeline stage">
                    <select value={pipelineStage} onChange={e => setPipelineStage(e.target.value)}
                      style={{ ...inputBase, cursor: 'pointer', textTransform: 'capitalize' }}>
                      {['new', 'screened', 'interviewed', 'offered', 'placed', 'rejected'].map(s => (
                        <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                      ))}
                    </select>
                  </Field>
                </>
              )}

              {/* Initial note */}
              <Field label="Initial note">
                <textarea
                  value={initialNote}
                  onChange={e => setInitialNote(e.target.value)}
                  placeholder={type === 'client' ? 'e.g. Referred by John. Looking for Ops Executive, remote OK.' : 'e.g. Found on LinkedIn. 5 yrs SaaS sales experience.'}
                  rows={3}
                  style={{ ...inputBase, resize: 'vertical', minHeight: 60, fontFamily: 'inherit' }} />
              </Field>
            </>
          )}
        </div>

        {/* Footer */}
        {type && (
          <div style={{
            padding: `${space[3]}px ${space[5]}px`,
            borderTop: border.subtle,
            background: ink[50],
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            gap: space[3],
            flexShrink: 0,
          }}>
            <button onClick={() => { setType(null); setErrors({}); setDuplicate(null) }}
              style={{
                padding: `${space[1] + 2}px ${space[3]}px`,
                background: 'transparent',
                border: `0.5px solid ${ink[300]}`,
                color: ink[700],
                borderRadius: radius.md,
                fontSize: textSize.xs,
                fontWeight: textWeight.medium,
                cursor: 'pointer',
                fontFamily: fonts.body,
              }}>
              ← Change type
            </button>
            <div style={{ display: 'flex', gap: space[2] }}>
              <button onClick={onClose} disabled={submitting}
                style={{
                  padding: `${space[1] + 2}px ${space[4]}px`,
                  background: 'transparent',
                  border: `0.5px solid ${ink[300]}`,
                  color: ink[700],
                  borderRadius: radius.md,
                  fontSize: textSize.xs,
                  fontWeight: textWeight.medium,
                  cursor: submitting ? 'default' : 'pointer',
                  fontFamily: fonts.body,
                }}>Cancel</button>
              <button onClick={handleSubmit} disabled={submitting || !!duplicate}
                style={{
                  padding: `${space[1] + 2}px ${space[4]}px`,
                  background: (submitting || duplicate) ? ink[400] : accent.DEFAULT,
                  color: '#fff',
                  border: 'none',
                  borderRadius: radius.md,
                  fontSize: textSize.xs,
                  fontWeight: textWeight.semibold,
                  cursor: (submitting || duplicate) ? 'default' : 'pointer',
                  fontFamily: fonts.body,
                  letterSpacing: '0.2px',
                }}>
                {submitting ? 'Creating…' : 'Create contact'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}