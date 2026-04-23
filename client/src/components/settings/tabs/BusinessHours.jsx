import { useState, useEffect } from 'react'
import { useAuth } from '../../../context/AuthContext'
import { API } from '../../../utils/constants'
import { ACCENT, ACCENT_LIGHT } from '../../../utils/designTokens'

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

const QUICK_PRESETS = [
  { label: '9am – 6pm', open: '09:00', close: '18:00' },
  { label: '8:30am – 5:30pm', open: '08:30', close: '17:30' },
  { label: '9am – 5pm', open: '09:00', close: '17:00' },
  { label: '8am – 8pm', open: '08:00', close: '20:00' },
  { label: '10am – 7pm', open: '10:00', close: '19:00' },
  { label: '24 hours', open: '00:00', close: '23:59' },
]

function Btn({ onClick, children, variant = 'primary', size = 'md', disabled, style: extra }) {
  const sizes = { sm: { padding: '5px 10px', fontSize: 11 }, md: { padding: '8px 14px', fontSize: 12 } }
  const variants = {
    primary: { background: ACCENT, color: '#fff', border: 'none' },
    ghost: { background: 'transparent', color: '#6b7280', border: '0.5px solid #e5e7eb' },
    light: { background: ACCENT_LIGHT, color: ACCENT, border: `0.5px solid ${ACCENT}30` },
  }
  return (
    <button onClick={!disabled ? onClick : undefined}
      style={{ ...sizes[size], ...variants[variant], borderRadius: 8, cursor: disabled ? 'default' : 'pointer', fontWeight: 500, opacity: disabled ? 0.6 : 1, display: 'inline-flex', alignItems: 'center', gap: 5, ...extra }}>
      {children}
    </button>
  )
}

function Toggle({ value, onChange }) {
  return (
    <button onClick={() => onChange(!value)}
      style={{ width: 44, height: 24, borderRadius: 12, border: 'none', background: value ? ACCENT : '#d1d5db', cursor: 'pointer', position: 'relative', transition: 'background .2s', flexShrink: 0 }}>
      <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: value ? 23 : 3, transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
    </button>
  )
}

function TimeInput({ value, onChange, disabled }) {
  return (
    <input type="time" value={value || ''} onChange={onChange} disabled={disabled}
      style={{ padding: '7px 10px', border: `0.5px solid ${disabled ? '#f1f4f9' : '#e5e7eb'}`, borderRadius: 8, fontSize: 12, outline: 'none', background: disabled ? '#f9fafb' : '#fff', color: disabled ? '#d1d5db' : '#111827', cursor: disabled ? 'not-allowed' : 'auto', width: 100 }} />
  )
}

export default function BusinessHours() {
  const { token } = useAuth()
  const [hours, setHours] = useState(
    WEEKDAYS.map(day => ({
      day_of_week: day,
      is_open: !['Saturday', 'Sunday'].includes(day),
      open_time: '09:00',
      close_time: '18:00',
    }))
  )
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [hoveredDay, setHoveredDay] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const r = await fetch(`${API}/business-hours`, { headers: { Authorization: 'Bearer ' + token } })
      const data = await r.json()
      if (Array.isArray(data) && data.length > 0) {
        setHours(WEEKDAYS.map(day => {
          const found = data.find(d => d.day_of_week === day)
          return found || { day_of_week: day, is_open: !['Saturday', 'Sunday'].includes(day), open_time: '09:00', close_time: '18:00' }
        }))
      }
    } catch {} finally { setLoading(false) }
  }

  async function save() {
    setSaving(true)
    try {
      await fetch(`${API}/business-hours`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ hours })
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {} finally { setSaving(false) }
  }

  function update(day, field, val) {
    setHours(prev => prev.map(h => h.day_of_week === day ? { ...h, [field]: val } : h))
  }

  function applyToWeekdays(open_time, close_time) {
    setHours(prev => prev.map(h =>
      ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].includes(h.day_of_week)
        ? { ...h, open_time, close_time, is_open: true }
        : h
    ))
  }

  function applyToAll(open_time, close_time) {
    setHours(prev => prev.map(h => ({ ...h, open_time, close_time, is_open: true })))
  }

  function copyFromPreviousDay(day) {
    const idx = WEEKDAYS.indexOf(day)
    if (idx === 0) return
    const prev = hours[idx - 1]
    update(day, 'is_open', prev.is_open)
    update(day, 'open_time', prev.open_time)
    update(day, 'close_time', prev.close_time)
  }

  function getTotalHours(h) {
    if (!h.is_open) return null
    const [oh, om] = h.open_time.split(':').map(Number)
    const [ch, cm] = h.close_time.split(':').map(Number)
    const total = (ch * 60 + cm) - (oh * 60 + om)
    if (total <= 0) return null
    const hrs = Math.floor(total / 60)
    const mins = total % 60
    return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`
  }

  function getWeekSummary() {
    const openDays = hours.filter(h => h.is_open).length
    const totalMins = hours.filter(h => h.is_open).reduce((acc, h) => {
      const [oh, om] = h.open_time.split(':').map(Number)
      const [ch, cm] = h.close_time.split(':').map(Number)
      return acc + Math.max(0, (ch * 60 + cm) - (oh * 60 + om))
    }, 0)
    const totalHrs = Math.floor(totalMins / 60)
    return { openDays, totalHrs }
  }

  const summary = getWeekSummary()

  if (loading) return (
    <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>
      <div style={{ fontSize: 28, marginBottom: 10 }}>⏳</div>
      <div>Loading business hours…</div>
    </div>
  )

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>Business Hours</div>
          <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 3 }}>
            Set when your team is available. After-hours routing rules apply outside these times.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ padding: '6px 12px', background: '#f9fafb', borderRadius: 8, border: '0.5px solid #e5e7eb', fontSize: 11, color: '#374151' }}>
            <span style={{ color: '#9ca3af' }}>Open: </span><strong>{summary.openDays} days</strong>
            <span style={{ color: '#9ca3af', marginLeft: 8 }}>Total: </span><strong>{summary.totalHrs}h/week</strong>
          </div>
        </div>
      </div>

      {/* Quick presets */}
      <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e5e7eb', padding: '16px 20px', marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 12 }}>Quick Set</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
          {QUICK_PRESETS.map(p => (
            <button key={p.label}
              onClick={() => applyToWeekdays(p.open, p.close)}
              style={{ padding: '6px 12px', borderRadius: 7, border: '0.5px solid #e5e7eb', fontSize: 11, background: '#f9fafb', color: '#374151', cursor: 'pointer', fontWeight: 500, transition: 'all .1s' }}
              onMouseEnter={e => { e.currentTarget.style.background = ACCENT_LIGHT; e.currentTarget.style.color = ACCENT; e.currentTarget.style.borderColor = ACCENT }}
              onMouseLeave={e => { e.currentTarget.style.background = '#f9fafb'; e.currentTarget.style.color = '#374151'; e.currentTarget.style.borderColor = '#e5e7eb' }}>
              {p.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: '#9ca3af' }}>Apply to:</span>
          <button onClick={() => applyToWeekdays(hours.find(h => h.is_open)?.open_time || '09:00', hours.find(h => h.is_open)?.close_time || '18:00')}
            style={{ padding: '4px 10px', borderRadius: 6, border: '0.5px solid #e5e7eb', fontSize: 11, background: 'transparent', color: '#6b7280', cursor: 'pointer' }}>
            Weekdays only (Mon–Fri)
          </button>
          <button onClick={() => applyToAll(hours.find(h => h.is_open)?.open_time || '09:00', hours.find(h => h.is_open)?.close_time || '18:00')}
            style={{ padding: '4px 10px', borderRadius: 6, border: '0.5px solid #e5e7eb', fontSize: 11, background: 'transparent', color: '#6b7280', cursor: 'pointer' }}>
            All 7 days
          </button>
          <button onClick={() => setHours(prev => prev.map((h, i) => i >= 5 ? { ...h, is_open: false } : h))}
            style={{ padding: '4px 10px', borderRadius: 6, border: '0.5px solid #fca5a5', fontSize: 11, background: '#fee2e2', color: '#dc2626', cursor: 'pointer' }}>
            Close weekends
          </button>
        </div>
      </div>

      {/* Hours table */}
      <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e5e7eb', overflow: 'hidden', marginBottom: 16 }}>
        {/* Table header */}
        <div style={{ display: 'grid', gridTemplateColumns: '140px 80px 1fr 1fr 80px 100px', gap: 0, padding: '10px 20px', background: '#f9fafb', borderBottom: '0.5px solid #f1f4f9' }}>
          {['Day', 'Status', 'Opens', 'Closes', 'Hours', ''].map(h => (
            <div key={h} style={{ fontSize: 10, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</div>
          ))}
        </div>

        {/* Day rows */}
        {WEEKDAYS.map((day, idx) => {
          const h = hours.find(x => x.day_of_week === day) || { day_of_week: day, is_open: false, open_time: '09:00', close_time: '18:00' }
          const isWeekend = ['Saturday', 'Sunday'].includes(day)
          const totalHrs = getTotalHours(h)
          const isHovered = hoveredDay === day

          return (
            <div key={day}
              onMouseEnter={() => setHoveredDay(day)}
              onMouseLeave={() => setHoveredDay(null)}
              style={{ display: 'grid', gridTemplateColumns: '140px 80px 1fr 1fr 80px 100px', gap: 0, padding: '14px 20px', borderBottom: idx < WEEKDAYS.length - 1 ? '0.5px solid #f9fafb' : 'none', background: isHovered ? '#fafafa' : h.is_open ? '#fff' : '#fafafa', transition: 'background .1s', alignItems: 'center' }}>

              {/* Day name */}
              <div>
                <div style={{ fontSize: 13, fontWeight: h.is_open ? 600 : 400, color: h.is_open ? '#111827' : '#9ca3af' }}>{day}</div>
                {isWeekend && <div style={{ fontSize: 10, color: '#d1d5db' }}>Weekend</div>}
              </div>

              {/* Toggle */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Toggle value={h.is_open} onChange={v => update(day, 'is_open', v)} />
              </div>

              {/* Open time */}
              <div>
                <TimeInput
                  value={h.open_time}
                  onChange={e => update(day, 'open_time', e.target.value)}
                  disabled={!h.is_open} />
              </div>

              {/* Close time */}
              <div>
                <TimeInput
                  value={h.close_time}
                  onChange={e => update(day, 'close_time', e.target.value)}
                  disabled={!h.is_open} />
              </div>

              {/* Hours */}
              <div>
                {h.is_open && totalHrs ? (
                  <span style={{ fontSize: 12, fontWeight: 500, color: '#374151', background: ACCENT_LIGHT, padding: '3px 8px', borderRadius: 6 }}>{totalHrs}</span>
                ) : h.is_open ? (
                  <span style={{ fontSize: 11, color: '#ef4444' }}>Invalid</span>
                ) : (
                  <span style={{ fontSize: 12, color: '#d1d5db' }}>Closed</span>
                )}
              </div>

              {/* Copy action */}
              <div>
                {isHovered && idx > 0 && (
                  <button onClick={() => copyFromPreviousDay(day)}
                    style={{ fontSize: 10, padding: '3px 8px', borderRadius: 6, border: '0.5px solid #e5e7eb', background: '#fff', color: '#6b7280', cursor: 'pointer' }}>
                    Copy {WEEKDAYS[idx - 1].slice(0, 3)}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Weekly overview visual */}
      <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e5e7eb', padding: '16px 20px', marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 12 }}>Weekly Overview</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          {hours.map(h => {
            const mins = h.is_open ? (() => {
              const [oh, om] = h.open_time.split(':').map(Number)
              const [ch, cm] = h.close_time.split(':').map(Number)
              return Math.max(0, (ch * 60 + cm) - (oh * 60 + om))
            })() : 0
            const maxMins = 24 * 60
            const heightPct = mins / maxMins
            return (
              <div key={h.day_of_week} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <div style={{ fontSize: 10, color: '#9ca3af' }}>{getTotalHours(h) || '—'}</div>
                <div style={{ width: '100%', height: 60, background: '#f1f4f9', borderRadius: 5, overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                  <div style={{ width: '100%', height: `${heightPct * 100}%`, background: h.is_open ? ACCENT : '#e5e7eb', borderRadius: 5, transition: 'height .3s ease', minHeight: h.is_open ? 4 : 0 }} />
                </div>
                <div style={{ fontSize: 10, color: h.is_open ? '#374151' : '#d1d5db', fontWeight: h.is_open ? 600 : 400 }}>
                  {h.day_of_week.slice(0, 3)}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* After hours note */}
      <div style={{ padding: '12px 16px', background: '#fef3c7', border: '0.5px solid #fde68a', borderRadius: 10, fontSize: 12, color: '#92400e', lineHeight: 1.6, marginBottom: 20 }}>
        🌙 <strong>After-hours routing:</strong> When a message arrives outside business hours, Tel-Cloud follows the after-hours action set in <strong>Routing Rules → After-Hours Action</strong>.
        Configure whether to send an auto-reply, queue for next business day, or assign to an on-call agent.
      </div>

      {/* Save */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        {saved && (
          <div style={{ fontSize: 12, color: '#16a34a', display: 'flex', alignItems: 'center', gap: 5 }}>
            ✓ Business hours saved
          </div>
        )}
        <Btn onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Business Hours'}</Btn>
      </div>
    </div>
  )
}