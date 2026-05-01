import { useState, useMemo, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { API } from '../../utils/constants'
import { ink, accent, fonts, textSize, textWeight, space, radius, border } from '../../utils/designTokens'
import Btn from '../ui/Btn'
import EventModal from './EventModal'

// Day name labels for the grid header (Mon-Sun, Singapore convention)
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// Month name labels for the header
const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

// Builds the 6-week grid for a given year/month. Always returns 42 cells
// (6 rows of 7 days) so the grid is visually stable across months.
// First day is Monday (Singapore convention).
function buildMonthGrid(year, month) {
  const firstOfMonth = new Date(year, month, 1)
  const lastOfMonth = new Date(year, month + 1, 0)
  const daysInMonth = lastOfMonth.getDate()

  // getDay() returns 0=Sun..6=Sat. Convert to Mon=0..Sun=6.
  const firstDayMonIdx = (firstOfMonth.getDay() + 6) % 7

  // Days from previous month to fill the first row
  const prevMonthLastDay = new Date(year, month, 0).getDate()

  const cells = []

  // Previous month tail
  for (let i = firstDayMonIdx - 1; i >= 0; i--) {
    const d = prevMonthLastDay - i
    const date = new Date(year, month - 1, d)
    cells.push({ date, day: d, isCurrentMonth: false })
  }

  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d)
    cells.push({ date, day: d, isCurrentMonth: true })
  }

  // Next month head — fill until we have 42 cells (6 rows)
  let nextDay = 1
  while (cells.length < 42) {
    const date = new Date(year, month + 1, nextDay)
    cells.push({ date, day: nextDay, isCurrentMonth: false })
    nextDay++
  }

  return cells
}

// Returns true if two dates are the same calendar day (Singapore time)
function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate()
}

// Formats a Date as YYYY-MM-DD (local time) for matching against event_date
// strings returned by the API.
function ymd(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export default function Calendar({ onOpenConversation }) {
  const { token, hasPermission } = useAuth()
  const canManage = hasPermission('manage_calendar')

  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [events, setEvents] = useState([])
  const [eventTypes, setEventTypes] = useState([])
  const [loading, setLoading] = useState(false)
  const [modalState, setModalState] = useState(null) // { event } for edit, { defaultDate } for create, null for closed
  const cells = useMemo(() => buildMonthGrid(viewYear, viewMonth), [viewYear, viewMonth])

  // Build a lookup of events keyed by YYYY-MM-DD for fast cell rendering.
  // event_date comes back from the API as 'YYYY-MM-DDT00:00:00.000Z' so we
  // slice to the date portion for matching.
  const eventsByDay = useMemo(() => {
    const map = {}
    for (const ev of events) {
      if (!ev.event_date) continue
      // Postgres returns event_date as a UTC ISO timestamp at midnight SGT,
      // which is 16:00 UTC the previous day. Parse and convert back to a
      // local date so it matches the cell's local YYYY-MM-DD key.
      const d = new Date(ev.event_date)
      const key = ymd(d)
      if (!map[key]) map[key] = []
      map[key].push(ev)
    }
    // Sort each day's events by time (events without time go to the end)
    for (const k of Object.keys(map)) {
      map[k].sort((a, b) => {
        if (!a.event_time && !b.event_time) return 0
        if (!a.event_time) return 1
        if (!b.event_time) return -1
        return a.event_time.localeCompare(b.event_time)
      })
    }
    return map
  }, [events])

  // Fetch event types once on mount
  useEffect(() => {
    if (!token) return
    fetch(`${API}/event-types`, { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.json())
      .then(data => setEventTypes(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [token])

  // Fetch events when the visible month changes. Range covers the entire grid
  // (including prev/next month tail/head days) so events bleeding into adjacent
  // weeks still render in their cells.
  function loadEvents() {
    if (!token) return
    setLoading(true)
    const firstCell = cells[0].date
    const lastCell = cells[cells.length - 1].date
    const fmt = d => ymd(d)
    const url = `${API}/calendar?from=${fmt(firstCell)}&to=${fmt(lastCell)}`
    fetch(url, { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.json())
      .then(data => setEvents(Array.isArray(data) ? data : []))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false))
  }
  useEffect(() => {
    loadEvents()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, viewYear, viewMonth])

  function prevMonth() {
    if (viewMonth === 0) {
      setViewYear(y => y - 1)
      setViewMonth(11)
    } else {
      setViewMonth(m => m - 1)
    }
  }

  function nextMonth() {
    if (viewMonth === 11) {
      setViewYear(y => y + 1)
      setViewMonth(0)
    } else {
      setViewMonth(m => m + 1)
    }
  }

  function jumpToToday() {
    const now = new Date()
    setViewYear(now.getFullYear())
    setViewMonth(now.getMonth())
  }

  const isViewingCurrentMonth = viewYear === today.getFullYear() && viewMonth === today.getMonth()

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      overflow: 'hidden', background: '#faf9f7',
      fontFamily: fonts.body,
    }}>
      {/* Header */}
      <div className="px-4 pt-5 pb-4 md:px-7 md:pt-6" style={{ flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 14, marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: ink[900], marginBottom: 4, letterSpacing: '-0.3px' }}>Calendar</div>
            <div style={{ fontSize: 12, color: ink[600] }}>
              Schedule interviews, meetings, and follow-ups linked to conversations
            </div>
          </div>
          {canManage && (
            <Btn onClick={() => setModalState({ defaultDate: new Date() })}>
              + New Event
            </Btn>
          )}
        </div>

        {/* Month navigation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: space[2], flexWrap: 'wrap' }}>
          <button onClick={prevMonth}
            title="Previous month"
            style={{
              width: 32, height: 32, borderRadius: radius.md,
              border: `0.5px solid ${ink[300]}`,
              background: '#fff', cursor: 'pointer',
              color: ink[700], display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M10 4L6 8l4 4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          <button onClick={nextMonth}
            title="Next month"
            style={{
              width: 32, height: 32, borderRadius: radius.md,
              border: `0.5px solid ${ink[300]}`,
              background: '#fff', cursor: 'pointer',
              color: ink[700], display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M6 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          <div style={{
            display: 'flex', alignItems: 'center', gap: space[2],
            marginLeft: space[2],
          }}>
            <select value={viewMonth} onChange={e => setViewMonth(parseInt(e.target.value))}
              style={{
                padding: '6px 10px',
                border: `0.5px solid ${ink[300]}`,
                borderRadius: radius.md,
                background: '#fff',
                fontSize: textSize.sm,
                fontWeight: textWeight.semibold,
                color: ink[900],
                cursor: 'pointer',
                fontFamily: fonts.body,
                outline: 'none',
                letterSpacing: '-0.1px',
              }}>
              {MONTH_LABELS.map((label, i) => (
                <option key={i} value={i}>{label}</option>
              ))}
            </select>
            <select value={viewYear} onChange={e => setViewYear(parseInt(e.target.value))}
              style={{
                padding: '6px 10px',
                border: `0.5px solid ${ink[300]}`,
                borderRadius: radius.md,
                background: '#fff',
                fontSize: textSize.sm,
                fontWeight: textWeight.semibold,
                color: ink[900],
                cursor: 'pointer',
                fontFamily: fonts.body,
                outline: 'none',
                fontVariantNumeric: 'tabular-nums',
              }}>
              {Array.from({ length: 11 }, (_, i) => today.getFullYear() - 2 + i).map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {!isViewingCurrentMonth && (
            <button onClick={jumpToToday}
              style={{
                marginLeft: space[2],
                padding: `${space[1]}px ${space[3]}px`,
                borderRadius: radius.md,
                border: `0.5px solid ${ink[300]}`,
                background: 'transparent',
                fontSize: textSize.xs,
                color: ink[700],
                cursor: 'pointer',
                fontWeight: textWeight.medium,
                fontFamily: fonts.body,
              }}>
              Today
            </button>
          )}
        </div>
      </div>

      {/* Grid */}
      <div className="px-4 md:px-7 pb-5" style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{
          background: '#fff',
          borderRadius: radius.md,
          border: border.subtle,
          overflow: 'hidden',
        }}>
          {/* Day labels row */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            borderBottom: border.subtle,
            background: ink[50],
          }}>
            {DAY_LABELS.map((label, i) => (
              <div key={label} style={{
                padding: `${space[2]}px ${space[3]}px`,
                fontSize: 10,
                fontWeight: textWeight.semibold,
                color: ink[600],
                textTransform: 'uppercase',
                letterSpacing: '0.6px',
                textAlign: 'center',
                borderRight: i < 6 ? border.subtle : 'none',
              }}>
                {label}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gridAutoRows: 'minmax(110px, 1fr)',
          }}>
            {cells.map((cell, i) => {
              const isToday = isSameDay(cell.date, today)
              const isWeekend = i % 7 >= 5
              const colIdx = i % 7
              const rowIdx = Math.floor(i / 7)
              return (
                <div key={i} style={{
                  padding: `${space[2]}px`,
                  borderRight: colIdx < 6 ? border.subtle : 'none',
                  borderBottom: rowIdx < 5 ? border.subtle : 'none',
                  background: cell.isCurrentMonth
                    ? (isWeekend ? '#fdfcfa' : '#fff')
                    : '#faf9f7',
                  display: 'flex',
                  flexDirection: 'column',
                  position: 'relative',
                  cursor: cell.isCurrentMonth && canManage ? 'pointer' : 'default',
                  transition: 'background 0.08s',
                }}
                  onClick={() => {
                    if (cell.isCurrentMonth && canManage) {
                      setModalState({ defaultDate: cell.date })
                    }
                  }}
                  onMouseEnter={e => {
                    if (cell.isCurrentMonth && canManage) {
                      e.currentTarget.style.background = ink[100]
                    }
                  }}
                  onMouseLeave={e => {
                    if (cell.isCurrentMonth) {
                      e.currentTarget.style.background = isWeekend ? '#fdfcfa' : '#fff'
                    }
                  }}>
                  <div style={{
                    fontSize: textSize.xs,
                    fontWeight: isToday ? textWeight.bold : textWeight.medium,
                    color: !cell.isCurrentMonth ? ink[500] : isToday ? '#fff' : ink[800],
                    background: isToday ? accent.DEFAULT : 'transparent',
                    width: isToday ? 22 : 'auto',
                    height: isToday ? 22 : 'auto',
                    borderRadius: isToday ? radius.pill : 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: isToday ? 0 : '2px 4px',
                    marginBottom: 4,
                    flexShrink: 0,
                    fontFamily: fonts.body,
                  }}>
                    {cell.day}
                  </div>

                  {/* Events for this day */}
                  {(() => {
                    const dayEvents = eventsByDay[ymd(cell.date)] || []
                    if (dayEvents.length === 0) return null
                    const visible = dayEvents.slice(0, 2)
                    const overflow = dayEvents.length - 2
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, overflow: 'hidden' }}>
                        {visible.map(ev => (
                          <div key={ev.id}
                            title={`${ev.title}${ev.event_time ? ' - ' + ev.event_time.slice(0, 5) : ''}`}
                            onClick={e => {
                              e.stopPropagation()
                              if (canManage) setModalState({ event: ev })
                            }}
                            style={{
                              fontSize: 10,
                              padding: '2px 5px',
                              borderRadius: 4,
                              background: ev.event_type_bg || '#ede9fe',
                              color: ev.event_type_fg || '#5b21b6',
                              fontWeight: textWeight.medium,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              fontFamily: fonts.body,
                              opacity: cell.isCurrentMonth ? 1 : 0.55,
                              cursor: canManage ? 'pointer' : 'default',
                            }}>
                            {ev.event_time && (
                              <span style={{ fontVariantNumeric: 'tabular-nums', marginRight: 4, opacity: 0.75 }}>
                                {ev.event_time.slice(0, 5)}
                              </span>
                            )}
                            {ev.title}
                          </div>
                        ))}
                        {overflow > 0 && (
                          <div style={{
                            fontSize: 9,
                            padding: '1px 5px',
                            color: ink[600],
                            fontWeight: textWeight.medium,
                            fontFamily: fonts.body,
                          }}>
                            +{overflow} more
                          </div>
                        )}
                      </div>
                    )
                  })()}
                </div>
              )
            })}
          </div>
        </div>

        </div>

      {modalState && (
        <EventModal
          event={modalState.event}
          defaultDate={modalState.defaultDate}
          eventTypes={eventTypes}
          onClose={() => setModalState(null)}
          onSaved={loadEvents}
          onOpenConversation={onOpenConversation}
        />
      )}
    </div>
  )
}