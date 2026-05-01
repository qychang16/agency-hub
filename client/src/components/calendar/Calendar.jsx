import { useState, useMemo } from 'react'
import { useAuth } from '../../context/AuthContext'
import { ink, accent, fonts, textSize, textWeight, space, radius, border } from '../../utils/designTokens'
import Btn from '../ui/Btn'

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

export default function Calendar() {
  const { hasPermission } = useAuth()
  const canManage = hasPermission('manage_calendar')

  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())

  const cells = useMemo(() => buildMonthGrid(viewYear, viewMonth), [viewYear, viewMonth])

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
            <Btn disabled title="Event creation coming in next update">
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
            fontFamily: fonts.display,
            fontSize: textSize.lg,
            fontWeight: textWeight.semibold,
            color: ink[900],
            letterSpacing: '-0.2px',
            marginLeft: space[2],
          }}>
            {MONTH_LABELS[viewMonth]} {viewYear}
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
                  {/* Events will render here in Chunk C */}
                </div>
              )
            })}
          </div>
        </div>

        {/* Helpful caption below grid */}
        <div style={{
          marginTop: space[3],
          fontSize: 11,
          color: ink[600],
          textAlign: 'center',
          fontFamily: fonts.body,
        }}>
          Event creation and visualisation coming in the next update.
        </div>
      </div>
    </div>
  )
}