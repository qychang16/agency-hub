import { useState } from 'react'
import { useWorkspace } from '../../../context/WorkspaceContext'
import { ACCENT, ACCENT_LIGHT } from '../../../utils/constants'
import { WEEKDAYS } from '../../../utils/dates'

const DEFAULT_HOURS = WEEKDAYS.reduce((acc, day) => ({
  ...acc,
  [day]: { open: !['Saturday','Sunday'].includes(day), start: '09:00', end: '18:00' }
}), {})

export default function BusinessHours() {
  const { workspace } = useWorkspace()
  const [hours, setHours] = useState(workspace?.business_hours || DEFAULT_HOURS)
  const [afterHoursMsg, setAfterHoursMsg] = useState('Thank you for reaching out. Our office is currently closed. We will respond to your message on the next working day.')
  const [saved, setSaved] = useState(false)

  function toggleDay(day) {
    setHours(prev => ({ ...prev, [day]: { ...prev[day], open: !prev[day].open } }))
  }

  function updateTime(day, field, value) {
    setHours(prev => ({ ...prev, [day]: { ...prev[day], [field]: value } }))
  }

  function applyToWeekdays() {
    const mon = hours['Monday']
    const updated = { ...hours }
    WEEKDAYS.slice(0, 5).forEach(day => { updated[day] = { ...updated[day], start: mon.start, end: mon.end } })
    setHours(updated)
  }

  return (
    <div style={{ padding: 28, maxWidth: 680 }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: '#111827', marginBottom: 4 }}>Business Hours</div>
        <div style={{ fontSize: 12, color: '#9ca3af' }}>Set your operating hours. After-hours messages will receive an automatic reply.</div>
      </div>

      <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e5e7eb', overflow: 'hidden', marginBottom: 16 }}>
        <div style={{ padding: '14px 18px', borderBottom: '0.5px solid #f1f4f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>Operating Hours</div>
          <button onClick={applyToWeekdays}
            style={{ padding: '5px 12px', border: '0.5px solid #d1d5db', borderRadius: 6, fontSize: 11, background: '#fff', color: '#6b7280', cursor: 'pointer' }}>
            Apply Monday hours to all weekdays
          </button>
        </div>
        {WEEKDAYS.map(day => (
          <div key={day} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 18px', borderBottom: '0.5px solid #f9fafb' }}>
            <div style={{ width: 100, fontSize: 12, fontWeight: 500, color: hours[day]?.open ? '#374151' : '#9ca3af' }}>{day}</div>
            <button onClick={() => toggleDay(day)}
              style={{ width: 40, height: 22, borderRadius: 11, border: 'none', background: hours[day]?.open ? ACCENT : '#d1d5db', cursor: 'pointer', position: 'relative', flexShrink: 0, transition: 'background .2s' }}>
              <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: hours[day]?.open ? 21 : 3, transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
            </button>
            {hours[day]?.open ? (
              <>
                <input type="time" value={hours[day]?.start || '09:00'} onChange={e => updateTime(day, 'start', e.target.value)}
                  style={{ padding: '6px 10px', border: '1px solid #e5e7eb', borderRadius: 7, fontSize: 12, outline: 'none', background: '#f9fafb', color: '#111827' }} />
                <span style={{ fontSize: 11, color: '#9ca3af' }}>to</span>
                <input type="time" value={hours[day]?.end || '18:00'} onChange={e => updateTime(day, 'end', e.target.value)}
                  style={{ padding: '6px 10px', border: '1px solid #e5e7eb', borderRadius: 7, fontSize: 12, outline: 'none', background: '#f9fafb', color: '#111827' }} />
              </>
            ) : (
              <span style={{ fontSize: 12, color: '#9ca3af', fontStyle: 'italic' }}>Closed</span>
            )}
          </div>
        ))}
      </div>

      <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e5e7eb', padding: 20, marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>After-Hours Auto Reply</div>
        <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 10 }}>This message is automatically sent to candidates and clients who message outside business hours.</div>
        <textarea value={afterHoursMsg} onChange={e => setAfterHoursMsg(e.target.value)} rows={3}
          style={{ width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12, background: '#f9fafb', color: '#111827', resize: 'none', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', lineHeight: 1.6 }} />
        <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 4 }}>{afterHoursMsg.length} characters</div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => { setSaved(true); setTimeout(() => setSaved(false), 3000) }}
          style={{ padding: '10px 24px', background: ACCENT, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          Save Changes
        </button>
        {saved && <div style={{ fontSize: 12, color: '#16a34a', display: 'flex', alignItems: 'center', gap: 4 }}><span>✓</span> Saved</div>}
      </div>
    </div>
  )
}