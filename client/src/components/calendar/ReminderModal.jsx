import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../../context/AuthContext'
import { API } from '../../utils/constants'
import { ink, accent, fonts, textSize, textWeight, space, radius } from '../../utils/designTokens'
import Modal from '../ui/Modal'
import Button from '../ui/Button'

// Three offset presets in hours, with display labels.
const OFFSET_OPTIONS = [
  { hours: 3, label: '3 hours before' },
  { hours: 12, label: '12 hours before' },
  { hours: 24, label: '24 hours before' },
]

// Compute the send time for a given event date/time and offset hours.
// If event has no time, treats it as 09:00 SGT (matches backend logic).
function computeSendTime(eventDate, eventTime, offsetHours) {
  if (!eventDate) return null
  const timeStr = eventTime || '09:00'
  const eventDt = new Date(`${eventDate}T${timeStr}:00+08:00`)
  return new Date(eventDt.getTime() - (offsetHours * 60 * 60 * 1000))
}

// Substitutes {{varName}} or {{1}} placeholders in body with values.
function substituteBody(body, ordered, values) {
  if (!body) return ''
  return body.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, vname) => {
    if (values[vname] !== undefined && values[vname] !== '') return values[vname]
    if (/^\d+$/.test(vname)) {
      const idx = parseInt(vname) - 1
      const mapped = ordered[idx]
      if (mapped && values[mapped] !== undefined && values[mapped] !== '') return values[mapped]
    }
    return match
  })
}

// Format event date for display in the body preview ("07 May 2026" SGT)
function formatEventDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Singapore' })
}

export default function ReminderModal({ eventId, eventDate, eventTime, onClose, onScheduled }) {
  const { token } = useAuth()
  const [event, setEvent] = useState(null)
  const [templates, setTemplates] = useState([])
  const [selectedTemplateId, setSelectedTemplateId] = useState(null)
  const [offsetHours, setOffsetHours] = useState(null)  // null until user picks
  const [scheduling, setScheduling] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  // Fetch event detail (for body preview rendering) + approved templates
  useEffect(() => {
    if (!eventId || !token) return
    setLoading(true)
    Promise.all([
      fetch(`${API}/calendar/${eventId}`, { headers: { Authorization: 'Bearer ' + token } })
        .then(r => r.json())
        .then(setEvent)
        .catch(() => setEvent(null)),
      fetch(`${API}/templates`, { headers: { Authorization: 'Bearer ' + token } })
        .then(r => r.json())
        .then(data => {
          if (Array.isArray(data)) {
            // Only approved templates can be used for reminders
            setTemplates(data.filter(t => t.status === 'approved'))
          }
        })
        .catch(() => setTemplates([]))
    ]).finally(() => setLoading(false))
  }, [eventId, token])

  const selectedTemplate = useMemo(
    () => templates.find(t => t.id === selectedTemplateId) || null,
    [templates, selectedTemplateId]
  )

  // Compute which offsets are valid given the event time
  // (offset can't put send time in the past)
  const offsetValidity = useMemo(() => {
    const now = new Date()
    return OFFSET_OPTIONS.map(opt => {
      const sendTime = computeSendTime(eventDate, eventTime, opt.hours)
      const isValid = sendTime && sendTime > now
      return { ...opt, sendTime, isValid }
    })
  }, [eventDate, eventTime])

  const allOffsetsInvalid = offsetValidity.every(o => !o.isValid)

  // Build the rendered preview using current event data + template
  const previewBody = useMemo(() => {
    if (!selectedTemplate || !event) return ''
    const ordered = selectedTemplate.variables?.ordered || []
    const defaults = selectedTemplate.variables?.defaults || {}
    const fieldMap = selectedTemplate.variables?.event_field_map || {}

    const values = {}
    for (const vname of ordered) {
      values[vname] = defaults[vname] || ''
      const field = fieldMap[vname]
      if (!field) continue
      if (field === 'contact_name') values[vname] = event.contact_name || ''
      else if (field === 'event_date') values[vname] = formatEventDate(event.event_date)
      else if (field === 'event_time') values[vname] = event.event_time ? String(event.event_time).slice(0, 5) : ''
      else if (field === 'location') values[vname] = event.location || ''
      else if (field === 'event_title') values[vname] = event.title || ''
    }
    return substituteBody(selectedTemplate.body, ordered, values)
  }, [selectedTemplate, event])

  async function schedule() {
    setError('')
    if (!selectedTemplateId) { setError('Please pick a template'); return }
    if (!offsetHours) { setError('Please pick when to send the reminder'); return }
    setScheduling(true)
    try {
      const r = await fetch(`${API}/calendar/${eventId}/reminder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ template_id: selectedTemplateId, offset_hours: offsetHours })
      })
      if (!r.ok) {
        const d = await r.json().catch(() => ({}))
        setError(d.error || 'Failed to schedule reminder')
        return
      }
      onScheduled()
    } catch {
      setError('Network error. Try again.')
    } finally {
      setScheduling(false)
    }
  }

  const labelStyle = {
    fontSize: 11, fontWeight: 600, color: '#4a4742',
    display: 'block', marginBottom: 6,
    textTransform: 'uppercase', letterSpacing: '0.4px',
    fontFamily: fonts.body,
  }

  if (loading) {
    return (
      <Modal title="Schedule reminder" subtitle="Loading..." onClose={onClose}>
        <div style={{ padding: 40, textAlign: 'center', color: ink[600], fontSize: 12 }}>
          Loading event and templates...
        </div>
      </Modal>
    )
  }

  return (
    <Modal
      title="Schedule reminder"
      subtitle={event ? `For: ${event.title}` : 'For event'}
      onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Past offsets warning */}
        {allOffsetsInvalid && (
          <div style={{
            padding: '12px 14px',
            background: '#fef3c7',
            border: '0.5px solid #fde68a',
            borderRadius: 8,
            fontSize: 12, color: '#92400e',
            fontFamily: fonts.body,
          }}>
            Event is too soon for any reminder offset. Send a manual message from the chat instead.
          </div>
        )}

        {/* Template picker */}
        <div>
          <label style={labelStyle}>
            Template <span style={{ color: '#ef4444' }}>*</span>
          </label>
          {templates.length === 0 ? (
            <div style={{
              padding: '10px 12px',
              border: `0.5px solid ${ink[300]}`,
              borderRadius: 8,
              background: '#faf9f7',
              fontSize: 11, color: ink[600],
              fontFamily: fonts.body,
            }}>
              No approved templates available. Create and approve a template first.
            </div>
          ) : (
            <select
              value={selectedTemplateId || ''}
              onChange={e => setSelectedTemplateId(e.target.value ? parseInt(e.target.value) : null)}
              disabled={allOffsetsInvalid}
              style={{
                width: '100%', padding: '9px 12px',
                border: `0.5px solid ${ink[300]}`, borderRadius: 8,
                fontSize: 13, outline: 'none',
                background: '#fff', color: ink[900],
                cursor: allOffsetsInvalid ? 'not-allowed' : 'pointer',
                fontFamily: fonts.body,
                opacity: allOffsetsInvalid ? 0.6 : 1,
              }}>
              <option value="">Select a template...</option>
              {templates.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          )}
        </div>

        {/* Offset picker - 3 buttons, smart-disable past offsets */}
        <div>
          <label style={labelStyle}>
            Send when <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            {offsetValidity.map(opt => {
              const isSelected = offsetHours === opt.hours
              return (
                <button key={opt.hours}
                  type="button"
                  onClick={() => opt.isValid && setOffsetHours(opt.hours)}
                  disabled={!opt.isValid}
                  title={opt.isValid
                    ? `Sends ${opt.sendTime?.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Singapore' })} SGT`
                    : 'This offset puts the send time in the past'}
                  style={{
                    flex: 1,
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: `1px solid ${isSelected ? accent.DEFAULT : ink[300]}`,
                    background: !opt.isValid ? '#faf9f7' : (isSelected ? '#ede9fe' : '#fff'),
                    color: !opt.isValid ? ink[400] : (isSelected ? accent.DEFAULT : ink[800]),
                    cursor: opt.isValid ? 'pointer' : 'not-allowed',
                    fontSize: 12,
                    fontWeight: isSelected ? 600 : 500,
                    fontFamily: fonts.body,
                    textDecoration: !opt.isValid ? 'line-through' : 'none',
                  }}>
                  {opt.label}
                </button>
              )
            })}
          </div>
          {offsetHours && (
            <div style={{ marginTop: 6, fontSize: 11, color: ink[600], fontFamily: fonts.body }}>
              Will send {offsetValidity.find(o => o.hours === offsetHours)?.sendTime?.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Singapore' })} SGT
            </div>
          )}
        </div>

        {/* Live preview */}
        {selectedTemplate && (
          <div>
            <label style={labelStyle}>Message preview</label>
            <div style={{
              padding: '12px 14px',
              background: '#ede9fe',
              border: '0.5px solid #d4ccf4',
              borderRadius: 10,
              fontSize: 12, color: ink[900],
              whiteSpace: 'pre-wrap',
              fontFamily: fonts.body,
              lineHeight: 1.5,
              maxHeight: 200,
              overflowY: 'auto',
            }}>
              {previewBody || selectedTemplate.body}
            </div>
            <div style={{ marginTop: 6, fontSize: 10, color: ink[600], fontStyle: 'italic', fontFamily: fonts.body }}>
              Variables auto-fill from event at send time. Body re-renders if event changes before sending.
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{
            padding: '10px 12px',
            background: '#fef2f2',
            border: '0.5px solid #fecaca',
            borderRadius: 8,
            fontSize: 12, color: '#dc2626',
            fontFamily: fonts.body,
          }}>
            {error}
          </div>
        )}

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 10, marginTop: 4, paddingTop: 16, borderTop: `0.5px solid ${ink[200]}` }}>
          <Button variant="secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</Button>
          <Button
            variant="primary"
            onClick={schedule}
            loading={scheduling}
            disabled={!selectedTemplateId || !offsetHours || allOffsetsInvalid}
            style={{ flex: 2 }}>
            {scheduling ? 'Scheduling...' : 'Schedule reminder'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}