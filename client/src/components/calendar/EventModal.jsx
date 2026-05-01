import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { API } from '../../utils/constants'
import { ink, accent, fonts, textSize, textWeight, space, radius, border } from '../../utils/designTokens'
import Modal from '../ui/Modal'
import Btn from '../ui/Btn'

// Formats a Date as YYYY-MM-DD for HTML date input
function ymd(d) {
  const date = d instanceof Date ? d : new Date(d)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default function EventModal({ event, defaultDate, eventTypes, onClose, onSaved }) {
  const { token } = useAuth()
  const isEdit = !!(event && event.id)

  // Form state
  const [title, setTitle] = useState(event?.title || '')
  const [eventDate, setEventDate] = useState(() => {
    if (event?.event_date) return ymd(new Date(event.event_date))
    if (defaultDate) return ymd(defaultDate)
    return ymd(new Date())
  })
  const [eventTime, setEventTime] = useState(event?.event_time?.slice(0, 5) || '')
  const [eventTypeId, setEventTypeId] = useState(event?.event_type_id || (eventTypes[0]?.id || ''))
  const [location, setLocation] = useState(event?.location || '')
  const [notes, setNotes] = useState(event?.notes || '')

  // Conversation linker state
  const [conversationId, setConversationId] = useState(event?.conversation_id || null)
  const [conversations, setConversations] = useState([])
  const [convoSearch, setConvoSearch] = useState('')
  const [showConvoDropdown, setShowConvoDropdown] = useState(false)

  // Load conversations once when modal opens (we filter client-side)
  useEffect(() => {
    if (!token) return
    fetch(`${API}/conversations?status=open`, { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.json())
      .then(data => setConversations(Array.isArray(data) ? data : []))
      .catch(() => setConversations([]))
  }, [token])

  // The currently linked conversation object (for display)
  const linkedConvo = conversations.find(c => c.id === conversationId)

  // Filter conversations by search query
  const filteredConvos = conversations.filter(c => {
    if (!convoSearch.trim()) return true
    const q = convoSearch.toLowerCase().trim()
    return (c.name || '').toLowerCase().includes(q)
        || (c.phone || '').includes(q)
  })

  // UI state
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    setError('')
    if (!title.trim()) { setError('Title is required'); return }
    if (!eventDate) { setError('Date is required'); return }
    if (!eventTypeId) { setError('Event type is required'); return }

    setSaving(true)
    try {
      const url = isEdit ? `${API}/calendar/${event.id}` : `${API}/calendar`
      const method = isEdit ? 'PATCH' : 'POST'
      const body = {
        title: title.trim(),
        event_date: eventDate,
        event_time: eventTime || null,
        event_type_id: parseInt(eventTypeId),
        location: location.trim() || null,
        notes: notes.trim() || null,
        conversation_id: conversationId || null,
      }
      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify(body)
      })
      if (!r.ok) {
        const d = await r.json().catch(() => ({}))
        setError(d.error || 'Failed to save event')
        return
      }
      onSaved()
      onClose()
    } catch (err) {
      setError('Network error. Try again.')
    } finally {
      setSaving(false)
    }
  }

  async function deleteEvent() {
    if (!isEdit) return
    if (!confirm(`Delete "${event.title}"? This cannot be undone.`)) return
    setDeleting(true)
    try {
      const r = await fetch(`${API}/calendar/${event.id}`, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer ' + token }
      })
      if (!r.ok) {
        setError('Failed to delete event')
        return
      }
      onSaved()
      onClose()
    } catch (err) {
      setError('Network error. Try again.')
    } finally {
      setDeleting(false)
    }
  }

  const labelStyle = {
    fontSize: 11, fontWeight: 600, color: '#4a4742',
    display: 'block', marginBottom: 4,
    textTransform: 'uppercase', letterSpacing: '0.4px',
    fontFamily: fonts.body,
  }
  const inputStyle = {
    width: '100%', padding: '9px 12px',
    border: `0.5px solid ${ink[300]}`, borderRadius: 8,
    fontSize: 13, outline: 'none',
    background: '#fff', color: ink[900],
    boxSizing: 'border-box', fontFamily: fonts.body,
  }

  const selectedType = eventTypes.find(t => t.id === parseInt(eventTypeId))

  return (
    <Modal
      title={isEdit ? `Edit event - ${event.title}` : 'New Event'}
      subtitle={isEdit ? 'Update event details, or delete this event' : 'Schedule an interview, meeting, or follow-up'}
      onClose={onClose}>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Title */}
        <div>
          <label style={labelStyle}>
            Title <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Interview with Mary Lim"
            style={inputStyle}
            autoFocus
          />
        </div>

        {/* Date + Time row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={labelStyle}>
              Date <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              type="date"
              value={eventDate}
              onChange={e => setEventDate(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Time (optional)</label>
            <input
              type="time"
              value={eventTime}
              onChange={e => setEventTime(e.target.value)}
              style={inputStyle}
            />
          </div>
        </div>

        {/* Event Type */}
        <div>
          <label style={labelStyle}>
            Type <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {eventTypes.map(t => {
              const isSelected = parseInt(eventTypeId) === t.id
              return (
                <button key={t.id}
                  type="button"
                  onClick={() => setEventTypeId(t.id)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 7,
                    border: `1px solid ${isSelected ? t.color_fg : ink[300]}`,
                    background: isSelected ? t.color_bg : '#fff',
                    color: isSelected ? t.color_fg : ink[700],
                    fontSize: 12,
                    fontWeight: isSelected ? 600 : 500,
                    cursor: 'pointer',
                    fontFamily: fonts.body,
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: t.color_fg,
                    flexShrink: 0,
                  }} />
                  {t.name}
                </button>
              )
            })}
          </div>
        </div>

        {/* Linked conversation */}
        <div style={{ position: 'relative' }}>
          <label style={labelStyle}>Linked conversation (optional)</label>
          {linkedConvo ? (
            <div style={{
              padding: '9px 12px',
              border: `0.5px solid ${ink[300]}`,
              borderRadius: 8,
              background: '#ede9fe',
              display: 'flex', alignItems: 'center', gap: 10,
              fontFamily: fonts.body,
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: linkedConvo.type === 'client' ? accent.DEFAULT : '#f5e9d6',
                color: linkedConvo.type === 'client' ? '#fff' : '#7a5a1f',
                fontSize: 11, fontWeight: 600,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                {(linkedConvo.name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: ink[900], marginBottom: 1 }}>
                  {linkedConvo.name}
                </div>
                <div style={{ fontSize: 11, color: ink[600], fontFamily: fonts.mono }}>
                  {linkedConvo.phone}
                </div>
              </div>
              <button type="button" onClick={() => { setConversationId(null); setConvoSearch('') }}
                title="Remove link"
                style={{
                  width: 26, height: 26, borderRadius: 6,
                  border: `0.5px solid ${ink[300]}`,
                  background: '#fff', cursor: 'pointer',
                  color: ink[600],
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M3 3l10 10M13 3l-10 10" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
          ) : (
            <>
              <input
                value={convoSearch}
                onChange={e => { setConvoSearch(e.target.value); setShowConvoDropdown(true) }}
                onFocus={() => setShowConvoDropdown(true)}
                onBlur={() => setTimeout(() => setShowConvoDropdown(false), 200)}
                placeholder="Search by name or phone..."
                style={inputStyle}
              />
              {showConvoDropdown && filteredConvos.length > 0 && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0,
                  marginTop: 4,
                  background: '#fff',
                  border: `0.5px solid ${ink[300]}`,
                  borderRadius: 8,
                  maxHeight: 240,
                  overflowY: 'auto',
                  zIndex: 50,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                }}>
                  {filteredConvos.slice(0, 10).map(c => (
                    <button key={c.id}
                      type="button"
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => {
                        setConversationId(c.id)
                        setShowConvoDropdown(false)
                        setConvoSearch('')
                      }}
                      style={{
                        width: '100%', textAlign: 'left',
                        padding: '8px 12px',
                        background: 'transparent',
                        border: 'none',
                        borderBottom: `0.5px solid ${ink[200]}`,
                        cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 8,
                        fontFamily: fonts.body,
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = ink[100]}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <div style={{
                        width: 26, height: 26, borderRadius: '50%',
                        background: c.type === 'client' ? accent.DEFAULT : '#f5e9d6',
                        color: c.type === 'client' ? '#fff' : '#7a5a1f',
                        fontSize: 10, fontWeight: 600,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                        {(c.name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 1 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: ink[900], overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {c.name}
                          </span>
                          <span style={{ fontSize: 10, color: ink[600], fontFamily: fonts.mono, flexShrink: 0 }}>
                            {c.phone}
                          </span>
                        </div>
                        <div style={{ fontSize: 10, color: ink[600], overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {c.preview || c.last_message_text || '(no messages)'}
                        </div>
                      </div>
                    </button>
                  ))}
                  {filteredConvos.length > 10 && (
                    <div style={{ padding: '6px 12px', fontSize: 10, color: ink[600], textAlign: 'center', fontStyle: 'italic' }}>
                      Showing first 10 of {filteredConvos.length}. Refine search to narrow.
                    </div>
                  )}
                </div>
              )}
              {showConvoDropdown && filteredConvos.length === 0 && convoSearch.trim() && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0,
                  marginTop: 4,
                  padding: '12px',
                  background: '#fff',
                  border: `0.5px solid ${ink[300]}`,
                  borderRadius: 8,
                  fontSize: 11, color: ink[600], textAlign: 'center',
                  zIndex: 50,
                  fontFamily: fonts.body,
                }}>
                  No conversations match "{convoSearch}"
                </div>
              )}
            </>
          )}
        </div>

        {/* Location */}
        <div>
          <label style={labelStyle}>Location (optional)</label>
          <input
            value={location}
            onChange={e => setLocation(e.target.value)}
            placeholder="e.g. Office, Zoom, client site"
            style={inputStyle}
          />
        </div>

        {/* Notes */}
        <div>
          <label style={labelStyle}>Notes (optional)</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Any additional context, agenda, or reminders"
            rows={4}
            style={{ ...inputStyle, resize: 'vertical', fontFamily: fonts.body, lineHeight: 1.5 }}
          />
        </div>

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
        <div style={{ display: 'flex', gap: 10, marginTop: 8, paddingTop: 16, borderTop: `0.5px solid ${ink[200]}` }}>
          {isEdit && (
            <Btn variant="danger" onClick={deleteEvent} disabled={saving || deleting}>
              {deleting ? 'Deleting...' : 'Delete'}
            </Btn>
          )}
          <Btn variant="ghost" onClick={onClose} style={{ marginLeft: isEdit ? 'auto' : 0, flex: isEdit ? 0 : 1 }}>
            Cancel
          </Btn>
          <Btn onClick={save} disabled={saving || deleting} style={{ flex: isEdit ? 0 : 2, minWidth: 120 }}>
            {saving ? 'Saving...' : (isEdit ? 'Save Changes' : 'Create Event')}
          </Btn>
        </div>
      </div>
    </Modal>
  )
}