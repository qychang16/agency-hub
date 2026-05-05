import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../../context/AuthContext'
import { API } from '../../utils/constants'
import { ACCENT, ACCENT_LIGHT, NAVY } from '../../utils/designTokens'
import Btn from '../ui/Btn'
import Modal from '../ui/Modal'

// ─────────────────────────────────────────────────────────────
// Step constants. Order matters: nextDisabled() and the stepper
// strip both index against this array.
// ─────────────────────────────────────────────────────────────
const STEPS = [
  { key: 'details',    label: 'Details',    desc: 'Name and sender phone' },
  { key: 'template',   label: 'Template',   desc: 'Pick approved template' },
  { key: 'recipients', label: 'Recipients', desc: 'Choose who receives this' },
  { key: 'schedule',   label: 'Schedule',   desc: 'When to send' },
  { key: 'review',     label: 'Review',     desc: 'Confirm and launch' },
]

// Format ISO timestamp into the value HTML datetime-local input expects.
// Returns yyyy-MM-ddTHH:mm. Local time (browser timezone).
function isoToLocalInput(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// Inverse of above. datetime-local input gives 'yyyy-MM-ddTHH:mm' (no TZ).
// We treat that as local time and convert to ISO string.
function localInputToIso(local) {
  if (!local) return null
  return new Date(local).toISOString()
}

// Render the body with variable defaults inlined (visual preview only).
function renderTemplatePreview(body, variables) {
  if (!body) return ''
  const defaults = variables?.defaults || {}
  return body.replace(/\{\{\s*([a-z][a-z0-9_]{0,29})\s*\}\}/gi, (_, name) => {
    return defaults[name] || `{{${name}}}`
  })
}

// ─────────────────────────────────────────────────────────────
// Stepper strip at the top of the composer
// ─────────────────────────────────────────────────────────────
function Stepper({ currentIdx, completedIdxs, onJump }) {
  return (
    <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderBottom: '0.5px solid #f5f3ef', paddingBottom: 16 }}>
      {STEPS.map((s, i) => {
        const active = i === currentIdx
        const done = completedIdxs.includes(i)
        const clickable = done || i < currentIdx
        return (
          <div
            key={s.key}
            onClick={() => clickable && onJump(i)}
            style={{
              flex: 1, textAlign: 'center', cursor: clickable ? 'pointer' : 'default',
              padding: '0 8px', position: 'relative'
            }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%', margin: '0 auto 6px',
              background: active ? ACCENT : (done ? '#dcfce7' : '#f5f3ef'),
              color: active ? '#fff' : (done ? '#16a34a' : '#9a958c'),
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 600,
              border: active ? `1px solid ${ACCENT}` : '0.5px solid #dcd8d0'
            }}>
              {done ? '\u2713' : i + 1}
            </div>
            <div style={{ fontSize: 11, fontWeight: active ? 600 : 500, color: active ? '#14130f' : '#6e6a63' }}>
              {s.label}
            </div>
            <div style={{ fontSize: 9, color: '#9a958c', marginTop: 1 }}>{s.desc}</div>
          </div>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Step 1: Details — name + sender phone number
// ─────────────────────────────────────────────────────────────
function StepDetails({ form, setForm, phones }) {
  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 11, fontWeight: 600, color: '#4a4742', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
          Broadcast Name <span style={{ color: '#ef4444' }}>*</span>
        </label>
        <input
          value={form.name}
          onChange={e => setForm({ ...form, name: e.target.value })}
          placeholder="e.g. Q2 candidate outreach - software engineers"
          style={{ width: '100%', padding: '9px 12px', border: '0.5px solid #dcd8d0', borderRadius: 8, fontSize: 13, outline: 'none', background: '#fff', color: '#14130f', boxSizing: 'border-box' }} />
        <div style={{ fontSize: 10, color: '#9a958c', marginTop: 4 }}>
          Internal label only. Recipients won't see this.
        </div>
      </div>
      <div>
        <label style={{ fontSize: 11, fontWeight: 600, color: '#4a4742', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
          Sender Phone Number <span style={{ color: '#ef4444' }}>*</span>
        </label>
        {phones.length === 0 ? (
          <div style={{ padding: 12, background: '#fef3c7', border: '0.5px solid #fde68a', borderRadius: 8, fontSize: 12, color: '#92400e' }}>
            No phone numbers configured. Go to Settings to add one before broadcasting.
          </div>
        ) : (
          <select
            value={form.phone_number_id || ''}
            onChange={e => setForm({ ...form, phone_number_id: e.target.value ? parseInt(e.target.value) : null })}
            style={{ width: '100%', padding: '9px 12px', border: '0.5px solid #dcd8d0', borderRadius: 8, fontSize: 13, outline: 'none', background: '#fff', color: '#14130f' }}>
            <option value="">- Select sender -</option>
            {phones.map(p => (
              <option key={p.id} value={p.id}>
                {p.number} {p.is_primary ? '(primary)' : ''} {p.project_name ? `- ${p.project_name}` : ''}
              </option>
            ))}
          </select>
        )}
        <div style={{ fontSize: 10, color: '#9a958c', marginTop: 4 }}>
          The WhatsApp number messages will appear to come from.
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Step 2: Template — pick from approved-only list
// ─────────────────────────────────────────────────────────────
function StepTemplate({ form, setForm, templates }) {
  const approved = templates.filter(t => t.status === 'approved')
  const selected = approved.find(t => t.id === form.template_id)
  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 11, fontWeight: 600, color: '#4a4742', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
          Approved Template <span style={{ color: '#ef4444' }}>*</span>
        </label>
        <div style={{ fontSize: 10, color: '#9a958c', marginBottom: 8 }}>
          {approved.length} approved template{approved.length !== 1 ? 's' : ''} available. Drafts and pending templates can't be broadcast.
        </div>
      </div>
      {approved.length === 0 ? (
        <div style={{ padding: 16, background: '#fef3c7', border: '0.5px solid #fde68a', borderRadius: 8, fontSize: 12, color: '#92400e' }}>
          No approved templates. Go to Templates and approve one before broadcasting.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10, maxHeight: 380, overflowY: 'auto', padding: 2 }}>
          {approved.map(t => {
            const active = t.id === form.template_id
            return (
              <div
                key={t.id}
                onClick={() => setForm({ ...form, template_id: t.id })}
                style={{
                  padding: 12, borderRadius: 10, cursor: 'pointer',
                  border: active ? `1px solid ${ACCENT}` : '0.5px solid #dcd8d0',
                  background: active ? ACCENT_LIGHT : '#fff',
                  transition: 'border-color .15s'
                }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#14130f', marginBottom: 4, fontFamily: 'monospace' }}>{t.name}</div>
                <div style={{ fontSize: 10, color: '#9a958c', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: 6 }}>{t.category}</div>
                <div style={{ fontSize: 11, color: '#4a4742', lineHeight: 1.5, maxHeight: 60, overflow: 'hidden' }}>
                  {t.body?.slice(0, 140)}{t.body?.length > 140 ? '...' : ''}
                </div>
              </div>
            )
          })}
        </div>
      )}
      {selected && (
        <div style={{ marginTop: 16, padding: 12, background: '#faf9f7', borderRadius: 8, border: '0.5px solid #dcd8d0' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#4a4742', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 8 }}>Preview</div>
          <div style={{ fontSize: 12, color: '#14130f', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
            {renderTemplatePreview(selected.body, selected.variables)}
          </div>
          {selected.variables?.ordered?.length > 0 && (
            <div style={{ fontSize: 10, color: '#9a958c', marginTop: 8 }}>
              Variables: {selected.variables.ordered.join(', ')}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Step 3: Recipients — full picker with type/stage/search filters
// ─────────────────────────────────────────────────────────────
function StepRecipients({ form, setForm, contacts, contactsLoading }) {
  const [typeFilter, setTypeFilter] = useState('')
  const [stageFilter, setStageFilter] = useState('')
  const [searchFilter, setSearchFilter] = useState('')
  const selected = new Set(form.contact_ids || [])

  const filtered = useMemo(() => {
    return contacts.filter(c => {
      if (typeFilter && c.type !== typeFilter) return false
      if (stageFilter && c.pipeline_stage !== stageFilter) return false
      if (searchFilter) {
        const s = searchFilter.toLowerCase()
        const matchName = c.name?.toLowerCase().includes(s)
        const matchPhone = c.phone?.toLowerCase().includes(s)
        const matchEmail = c.email?.toLowerCase().includes(s)
        if (!matchName && !matchPhone && !matchEmail) return false
      }
      return true
    })
  }, [contacts, typeFilter, stageFilter, searchFilter])

  // Available filter values derived from contacts
  const availableTypes = [...new Set(contacts.map(c => c.type).filter(Boolean))].sort()
  const availableStages = [...new Set(contacts.map(c => c.pipeline_stage).filter(Boolean))].sort()

  const toggleContact = (id) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id); else next.add(id)
    setForm({ ...form, contact_ids: [...next] })
  }
  const selectAllVisible = () => {
    const next = new Set(selected)
    filtered.forEach(c => next.add(c.id))
    setForm({ ...form, contact_ids: [...next] })
  }
  const deselectAllVisible = () => {
    const next = new Set(selected)
    filtered.forEach(c => next.delete(c.id))
    setForm({ ...form, contact_ids: [...next] })
  }

  // Skip preview: count contacts that will be auto-skipped server-side
  const skipPreview = useMemo(() => {
    let optedOut = 0, dnc = 0, noPhone = 0, sendable = 0
    for (const cid of selected) {
      const c = contacts.find(x => x.id === cid)
      if (!c) continue
      if (c.opted_out) optedOut++
      else if (c.dnc) dnc++
      else if (!c.phone || !c.phone.trim()) noPhone++
      else sendable++
    }
    return { optedOut, dnc, noPhone, sendable, total: selected.size }
  }, [selected, contacts])

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          style={{ padding: '6px 10px', border: '0.5px solid #dcd8d0', borderRadius: 7, fontSize: 12, background: '#fff', color: '#14130f' }}>
          <option value="">All types</option>
          {availableTypes.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select
          value={stageFilter}
          onChange={e => setStageFilter(e.target.value)}
          style={{ padding: '6px 10px', border: '0.5px solid #dcd8d0', borderRadius: 7, fontSize: 12, background: '#fff', color: '#14130f' }}>
          <option value="">All stages</option>
          {availableStages.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <input
          value={searchFilter}
          onChange={e => setSearchFilter(e.target.value)}
          placeholder="Search name, phone, email..."
          style={{ flex: 1, minWidth: 180, padding: '6px 10px', border: '0.5px solid #dcd8d0', borderRadius: 7, fontSize: 12, background: '#fff', color: '#14130f' }} />
        <Btn variant="ghost" size="sm" onClick={selectAllVisible} disabled={filtered.length === 0}>
          Select all ({filtered.length})
        </Btn>
        {selected.size > 0 && (
          <Btn variant="ghost" size="sm" onClick={deselectAllVisible}>
            Deselect visible
          </Btn>
        )}
      </div>

      <div style={{ marginBottom: 12, padding: '8px 12px', background: '#faf9f7', borderRadius: 7, fontSize: 11, color: '#6e6a63', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <span><strong style={{ color: '#14130f' }}>{selected.size}</strong> selected</span>
        {selected.size > 0 && (
          <span>
            {skipPreview.sendable} sendable
            {skipPreview.optedOut > 0 && <span style={{ color: '#92400e' }}> · {skipPreview.optedOut} opted-out</span>}
            {skipPreview.dnc > 0 && <span style={{ color: '#dc2626' }}> · {skipPreview.dnc} DNC</span>}
            {skipPreview.noPhone > 0 && <span style={{ color: '#9a958c' }}> · {skipPreview.noPhone} no phone</span>}
          </span>
        )}
      </div>

      {contactsLoading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#9a958c', fontSize: 12 }}>Loading contacts...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#9a958c', fontSize: 12 }}>
          {contacts.length === 0 ? 'No contacts in workspace yet.' : 'No contacts match these filters.'}
        </div>
      ) : (
        <div style={{ maxHeight: 320, overflowY: 'auto', border: '0.5px solid #dcd8d0', borderRadius: 8 }}>
          {filtered.map(c => {
            const isSelected = selected.has(c.id)
            const flag = c.opted_out ? 'opted-out' : c.dnc ? 'DNC' : (!c.phone ? 'no phone' : null)
            return (
              <div
                key={c.id}
                onClick={() => toggleContact(c.id)}
                style={{
                  padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 10,
                  cursor: 'pointer',
                  background: isSelected ? ACCENT_LIGHT : '#fff',
                  borderBottom: '0.5px solid #f5f3ef'
                }}>
                <input type="checkbox" checked={isSelected} readOnly style={{ accentColor: ACCENT, cursor: 'pointer' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#14130f' }}>{c.name || '(no name)'}</div>
                  <div style={{ fontSize: 11, color: '#9a958c' }}>
                    {c.phone || '(no phone)'} {c.type ? `\u00b7 ${c.type}` : ''} {c.pipeline_stage ? `\u00b7 ${c.pipeline_stage}` : ''}
                  </div>
                </div>
                {flag && (
                  <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 6, background: '#fef3c7', color: '#92400e', fontWeight: 600 }}>
                    {flag}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Step 4: Schedule — send now or pick datetime
// ─────────────────────────────────────────────────────────────
function StepSchedule({ form, setForm }) {
  const isSendNow = form.send_mode === 'now'

  // Format hour for display (e.g. 22 -> "10:00 PM", 8 -> "8:00 AM")
  const fmtHour = (h) => {
    const ampm = h >= 12 ? 'PM' : 'AM'
    const display = h === 0 ? 12 : h > 12 ? h - 12 : h
    return `${display}:00 ${ampm}`
  }

  // Detect if current quiet hours window means right now is quiet.
  // This drives the "Send Now might wait" warning.
  const nowH = new Date().getHours()
  const inQuietNow = form.quiet_hours_enabled && (
    form.quiet_hours_start_hour < form.quiet_hours_end_hour
      ? (nowH >= form.quiet_hours_start_hour && nowH < form.quiet_hours_end_hour)
      : (nowH >= form.quiet_hours_start_hour || nowH < form.quiet_hours_end_hour)
  )

  return (
    <div>
      {/* Send timing cards */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <div
          onClick={() => setForm({ ...form, send_mode: 'now', scheduled_at_local: '' })}
          style={{
            flex: 1, padding: 16, borderRadius: 10, cursor: 'pointer', textAlign: 'center',
            border: isSendNow ? `1px solid ${ACCENT}` : '0.5px solid #dcd8d0',
            background: isSendNow ? ACCENT_LIGHT : '#fff'
          }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#14130f', marginBottom: 4 }}>Send Now</div>
          <div style={{ fontSize: 11, color: '#9a958c' }}>Worker picks up immediately on next poll (within 60s)</div>
        </div>
        <div
          onClick={() => setForm({ ...form, send_mode: 'scheduled' })}
          style={{
            flex: 1, padding: 16, borderRadius: 10, cursor: 'pointer', textAlign: 'center',
            border: !isSendNow ? `1px solid ${ACCENT}` : '0.5px solid #dcd8d0',
            background: !isSendNow ? ACCENT_LIGHT : '#fff'
          }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#14130f', marginBottom: 4 }}>Schedule for Later</div>
          <div style={{ fontSize: 11, color: '#9a958c' }}>Pick a date and time</div>
        </div>
      </div>

      {!isSendNow && (
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#4a4742', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
            Send At <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <input
            type="datetime-local"
            value={form.scheduled_at_local || ''}
            onChange={e => setForm({ ...form, scheduled_at_local: e.target.value })}
            style={{ width: '100%', padding: '9px 12px', border: '0.5px solid #dcd8d0', borderRadius: 8, fontSize: 13, outline: 'none', background: '#fff', color: '#14130f', boxSizing: 'border-box' }} />
          <div style={{ fontSize: 10, color: '#9a958c', marginTop: 4 }}>
            Time is in your local timezone. The worker polls every 60 seconds, so actual send time may be up to a minute later.
          </div>
        </div>
      )}

      {/* Safety configuration */}
      <div style={{ padding: 14, background: '#faf9f7', borderRadius: 10, border: '0.5px solid #dcd8d0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#14130f' }}>WhatsApp Safety</div>
            <div style={{ fontSize: 10, color: '#9a958c', marginTop: 2 }}>Protects your account quality rating from suspension risk</div>
          </div>
        </div>

        {/* Quiet hours toggle */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={form.quiet_hours_enabled}
              onChange={e => setForm({ ...form, quiet_hours_enabled: e.target.checked })}
              style={{ accentColor: ACCENT }} />
            <span style={{ fontSize: 12, fontWeight: 500, color: '#14130f' }}>Respect quiet hours</span>
            <span style={{ fontSize: 10, color: '#9a958c' }}>(don't send to recipients between these hours)</span>
          </label>
        </div>

        {form.quiet_hours_enabled && (
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12, paddingLeft: 24 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 10, color: '#6e6a63', display: 'block', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Start (no sends after)</label>
              <select
                value={form.quiet_hours_start_hour}
                onChange={e => setForm({ ...form, quiet_hours_start_hour: parseInt(e.target.value) })}
                style={{ width: '100%', padding: '7px 10px', border: '0.5px solid #dcd8d0', borderRadius: 7, fontSize: 12, background: '#fff', color: '#14130f' }}>
                {Array.from({ length: 24 }).map((_, h) => (
                  <option key={h} value={h}>{fmtHour(h)}</option>
                ))}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 10, color: '#6e6a63', display: 'block', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.4px' }}>End (sends resume at)</label>
              <select
                value={form.quiet_hours_end_hour}
                onChange={e => setForm({ ...form, quiet_hours_end_hour: parseInt(e.target.value) })}
                style={{ width: '100%', padding: '7px 10px', border: '0.5px solid #dcd8d0', borderRadius: 7, fontSize: 12, background: '#fff', color: '#14130f' }}>
                {Array.from({ length: 24 }).map((_, h) => (
                  <option key={h} value={h}>{fmtHour(h)}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Quiet-hours-now warning */}
        {form.quiet_hours_enabled && isSendNow && inQuietNow && !form.force_send_outside_hours && (
          <div style={{ padding: '8px 10px', background: '#fef3c7', border: '0.5px solid #fde68a', borderRadius: 6, fontSize: 11, color: '#92400e', marginBottom: 12 }}>
            It's currently within your quiet hours window ({fmtHour(form.quiet_hours_start_hour)} to {fmtHour(form.quiet_hours_end_hour)}). Sends will pause until {fmtHour(form.quiet_hours_end_hour)} unless you enable Force Send below.
          </div>
        )}

        {/* Force send override */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={form.force_send_outside_hours}
              onChange={e => setForm({ ...form, force_send_outside_hours: e.target.checked })}
              style={{ accentColor: ACCENT, marginTop: 2 }} />
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: '#14130f' }}>Force send outside quiet hours</div>
              <div style={{ fontSize: 10, color: '#9a958c', marginTop: 1 }}>
                Override the quiet hours block. Use only for urgent transactional messages. Marketing sends outside business hours dramatically increase block rate.
              </div>
            </div>
          </label>
        </div>

        {/* Circuit breaker */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <label style={{ fontSize: 12, fontWeight: 500, color: '#14130f', flex: 1 }}>
            Stop broadcast after consecutive failures:
          </label>
          <input
            type="number"
            min="1"
            max="50"
            value={form.consecutive_fail_limit}
            onChange={e => {
              const v = parseInt(e.target.value)
              if (!isNaN(v) && v >= 1) setForm({ ...form, consecutive_fail_limit: v })
            }}
            style={{ width: 70, padding: '6px 10px', border: '0.5px solid #dcd8d0', borderRadius: 6, fontSize: 12, background: '#fff', color: '#14130f', textAlign: 'center' }} />
        </div>
        <div style={{ fontSize: 10, color: '#9a958c', marginTop: 4, textAlign: 'right' }}>
          Default 5. If this many recipients fail in a row, broadcast pauses to protect quota.
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Step 5: Review — summary and launch button
// ─────────────────────────────────────────────────────────────
function StepReview({ form, template, phone, contacts, sendable, skipped }) {
  const sendTime = form.send_mode === 'now'
    ? 'Immediately (within 60 seconds of launch)'
    : form.scheduled_at_local
      ? new Date(form.scheduled_at_local).toLocaleString('en-SG', {
          year: 'numeric', month: 'short', day: '2-digit',
          hour: '2-digit', minute: '2-digit'
        })
      : '(not set)'

  // Format hour for display in safety summary
  const fmtHour = (h) => {
    const ampm = h >= 12 ? 'PM' : 'AM'
    const display = h === 0 ? 12 : h > 12 ? h - 12 : h
    return `${display}:00 ${ampm}`
  }

  const safetyDescription = (() => {
    if (!form.quiet_hours_enabled) return 'Quiet hours disabled (send anytime)'
    if (form.force_send_outside_hours) return `Force send outside ${fmtHour(form.quiet_hours_start_hour)}-${fmtHour(form.quiet_hours_end_hour)} window`
    return `Pause sends ${fmtHour(form.quiet_hours_start_hour)} to ${fmtHour(form.quiet_hours_end_hour)}`
  })()

  const summary = [
    ['Name', form.name],
    ['Sender', phone ? `${phone.number}${phone.project_name ? ` (${phone.project_name})` : ''}` : '(not set)'],
    ['Template', template ? template.name : '(not set)'],
    ['Total recipients', form.contact_ids?.length || 0],
    ['Will send to', sendable],
    ['Will skip', skipped],
    ['Send time', sendTime],
    ['Quiet hours', safetyDescription],
    ['Stop after fails', `${form.consecutive_fail_limit} consecutive`],
  ]

  return (
    <div>
      <div style={{ marginBottom: 16, padding: 14, background: '#faf9f7', borderRadius: 10, border: '0.5px solid #dcd8d0' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#4a4742', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 12 }}>Broadcast Summary</div>
        {summary.map(([label, value]) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '0.5px solid #f5f3ef', fontSize: 12 }}>
            <span style={{ color: '#9a958c' }}>{label}</span>
            <span style={{ color: '#14130f', fontWeight: 500, textAlign: 'right' }}>{value}</span>
          </div>
        ))}
      </div>
      {template && (
        <div style={{ padding: 12, background: '#fff', borderRadius: 10, border: '0.5px solid #dcd8d0' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#4a4742', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 8 }}>Message Preview</div>
          <div style={{ fontSize: 12, color: '#14130f', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
            {renderTemplatePreview(template.body, template.variables)}
          </div>
        </div>
      )}
      {sendable === 0 && (
        <div style={{ marginTop: 12, padding: 12, background: '#fef2f2', border: '0.5px solid #fecaca', borderRadius: 8, fontSize: 12, color: '#dc2626' }}>
          No sendable recipients. All selected contacts are opted-out, on DNC, or missing phone numbers. Add or unblock contacts before launching.
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Main composer modal — orchestrates 5 steps + API calls
// ─────────────────────────────────────────────────────────────
export default function BroadcastComposer({ onClose, onSaved }) {
  const { token } = useAuth()
  const [stepIdx, setStepIdx] = useState(0)
  const [completedIdxs, setCompletedIdxs] = useState([])
  const [form, setForm] = useState({
    name: '',
    phone_number_id: null,
    template_id: null,
    contact_ids: [],
    send_mode: 'now',
    scheduled_at_local: '',
    // Safety config — sensible defaults that protect WhatsApp account quality.
    // The worker reads these at send time to skip recipients in quiet hours,
    // honor the force-send override, and trip the consecutive-fail circuit-breaker.
    quiet_hours_enabled: true,
    quiet_hours_start_hour: 22,  // 10 PM
    quiet_hours_end_hour: 8,     // 8 AM
    force_send_outside_hours: false,
    consecutive_fail_limit: 5,
  })
  const [phones, setPhones] = useState([])
  const [templates, setTemplates] = useState([])
  const [contacts, setContacts] = useState([])
  const [contactsLoading, setContactsLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Initial data fetch
  useEffect(() => {
    if (!token) return
    Promise.all([
      fetch(`${API}/phone-numbers`, { headers: { Authorization: 'Bearer ' + token } }).then(r => r.json()),
      fetch(`${API}/templates`, { headers: { Authorization: 'Bearer ' + token } }).then(r => r.json()),
      fetch(`${API}/contacts`, { headers: { Authorization: 'Bearer ' + token } }).then(r => r.json()),
    ]).then(([p, t, c]) => {
      setPhones(Array.isArray(p) ? p : [])
      setTemplates(Array.isArray(t) ? t : [])
      setContacts(Array.isArray(c) ? c : [])
      setContactsLoading(false)
    }).catch(err => {
      setError('Failed to load data: ' + err.message)
      setContactsLoading(false)
    })
  }, [token])

  // Validation: which steps can advance, given current form state
  const canAdvance = (idx) => {
    if (idx === 0) return form.name.trim().length > 0 && form.phone_number_id
    if (idx === 1) return !!form.template_id
    if (idx === 2) return (form.contact_ids?.length || 0) > 0
    if (idx === 3) return form.send_mode === 'now' || (!!form.scheduled_at_local && new Date(form.scheduled_at_local) > new Date())
    return true
  }

  const goNext = () => {
    if (!canAdvance(stepIdx)) return
    if (!completedIdxs.includes(stepIdx)) setCompletedIdxs([...completedIdxs, stepIdx])
    setStepIdx(stepIdx + 1)
  }
  const goBack = () => setStepIdx(Math.max(0, stepIdx - 1))
  const goJump = (i) => setStepIdx(i)

  // Computed for review step
  const selectedTemplate = templates.find(t => t.id === form.template_id)
  const selectedPhone = phones.find(p => p.id === form.phone_number_id)
  const sendablePreview = useMemo(() => {
    let s = 0, sk = 0
    for (const cid of form.contact_ids || []) {
      const c = contacts.find(x => x.id === cid)
      if (!c) continue
      if (c.opted_out || c.dnc || !c.phone) sk++
      else s++
    }
    return { sendable: s, skipped: sk }
  }, [form.contact_ids, contacts])

  // Launch: create broadcast, save recipients, transition to scheduled
  async function launch() {
    setError('')
    setSaving(true)
    try {
      // Step 1: create draft broadcast
      const scheduled_at = form.send_mode === 'now'
        ? new Date().toISOString()
        : localInputToIso(form.scheduled_at_local)
      const createRes = await fetch(`${API}/broadcasts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({
          name: form.name.trim(),
          template_id: form.template_id,
          phone_number_id: form.phone_number_id,
          scheduled_at,
          quiet_hours_enabled: form.quiet_hours_enabled,
          quiet_hours_start_hour: form.quiet_hours_start_hour,
          quiet_hours_end_hour: form.quiet_hours_end_hour,
          force_send_outside_hours: form.force_send_outside_hours,
          consecutive_fail_limit: form.consecutive_fail_limit,
        }),
      })
      if (!createRes.ok) {
        const d = await createRes.json()
        throw new Error(d.error || 'Failed to create broadcast')
      }
      const broadcast = await createRes.json()

      // Step 2: save recipients
      const recRes = await fetch(`${API}/broadcasts/${broadcast.id}/recipients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ contact_ids: form.contact_ids }),
      })
      if (!recRes.ok) {
        const d = await recRes.json()
        throw new Error(d.error || 'Failed to save recipients')
      }

      // Step 3: transition to scheduled
      const schedRes = await fetch(`${API}/broadcasts/${broadcast.id}/schedule`, {
        method: 'PATCH',
        headers: { Authorization: 'Bearer ' + token },
      })
      if (!schedRes.ok) {
        const d = await schedRes.json()
        throw new Error(d.error || 'Failed to schedule broadcast')
      }

      // Done
      onSaved()
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="New Broadcast" subtitle="Send an approved template to a list of contacts" onClose={onClose} width={920}>
      <Stepper currentIdx={stepIdx} completedIdxs={completedIdxs} onJump={goJump} />

      {stepIdx === 0 && <StepDetails form={form} setForm={setForm} phones={phones} />}
      {stepIdx === 1 && <StepTemplate form={form} setForm={setForm} templates={templates} />}
      {stepIdx === 2 && <StepRecipients form={form} setForm={setForm} contacts={contacts} contactsLoading={contactsLoading} />}
      {stepIdx === 3 && <StepSchedule form={form} setForm={setForm} />}
      {stepIdx === 4 && <StepReview form={form} template={selectedTemplate} phone={selectedPhone} contacts={contacts} sendable={sendablePreview.sendable} skipped={sendablePreview.skipped} />}

      {error && (
        <div style={{ padding: '10px 12px', background: '#fef2f2', border: '0.5px solid #fecaca', borderRadius: 8, fontSize: 12, color: '#dc2626', marginTop: 16 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 24, paddingTop: 16, borderTop: '0.5px solid #f5f3ef' }}>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        {stepIdx > 0 && (
          <Btn variant="ghost" onClick={goBack}>Back</Btn>
        )}
        {stepIdx < STEPS.length - 1 ? (
          <Btn onClick={goNext} disabled={!canAdvance(stepIdx)} style={{ marginLeft: 'auto' }}>
            Next
          </Btn>
        ) : (
          <Btn
            onClick={launch}
            disabled={saving || sendablePreview.sendable === 0}
            style={{ marginLeft: 'auto' }}>
            {saving ? 'Launching...' : (form.send_mode === 'now' ? 'Launch Broadcast' : 'Schedule Broadcast')}
          </Btn>
        )}
      </div>
    </Modal>
  )
}