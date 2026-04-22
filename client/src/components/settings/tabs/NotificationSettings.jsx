import { useState } from 'react'
import { useWorkspace } from '../../../context/WorkspaceContext'
import { ACCENT } from '../../../utils/constants'

const NOTIFICATION_EVENTS = [
  { key: 'new_conversation', label: 'New conversation assigned to me', category: 'Conversations' },
  { key: 'conversation_reassigned', label: 'Conversation reassigned away from me', category: 'Conversations' },
  { key: 'message_received', label: 'New message on my conversation', category: 'Conversations' },
  { key: 'watching_message', label: 'New message on conversation I am watching', category: 'Conversations' },
  { key: 'sla_warning', label: 'SLA approaching breach (30 mins before)', category: 'SLA' },
  { key: 'sla_breach', label: 'SLA breached', category: 'SLA' },
  { key: 'escalation', label: 'Conversation escalated to me', category: 'SLA' },
  { key: 'broadcast_sent', label: 'Broadcast sent successfully', category: 'Broadcasts' },
  { key: 'broadcast_failed', label: 'Broadcast failed to send', category: 'Broadcasts' },
  { key: 'scheduled_sent', label: 'Scheduled message sent', category: 'Scheduled' },
  { key: 'scheduled_failed', label: 'Scheduled message failed', category: 'Scheduled' },
  { key: 'new_agent', label: 'New agent added to workspace', category: 'Team' },
  { key: 'agent_offline', label: 'Co-handler went offline during active conversation', category: 'Team' },
  { key: 'placement_logged', label: 'Placement successfully logged', category: 'CRM' },
  { key: 'pdpa_expiring', label: 'PDPA consent expiring in 30 days', category: 'Compliance' },
]

export default function NotificationSettings() {
  const { notifications, updateNotifications } = useWorkspace()
  const [prefs, setPrefs] = useState(notifications || {})
  const [saved, setSaved] = useState(false)

  const categories = [...new Set(NOTIFICATION_EVENTS.map(e => e.category))]

  function toggle(key, channel) {
    setPrefs(prev => ({
      ...prev,
      [key]: { ...prev[key], [channel]: !prev[key]?.[channel] }
    }))
  }

  function save() {
    updateNotifications(prefs)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div style={{ padding: 28, maxWidth: 720 }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: '#111827', marginBottom: 4 }}>Notifications</div>
        <div style={{ fontSize: 12, color: '#9ca3af' }}>Choose how and when you are notified. In-app notifications appear in real time.</div>
      </div>

      <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e5e7eb', overflow: 'hidden', marginBottom: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px', padding: '10px 18px', background: '#f9fafb', borderBottom: '0.5px solid #f1f4f9' }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Event</div>
          <div style={{ fontSize: 10, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'center' }}>In-App</div>
          <div style={{ fontSize: 10, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'center' }}>Email</div>
        </div>
        {categories.map(cat => (
          <div key={cat}>
            <div style={{ padding: '8px 18px', background: '#fafafa', borderBottom: '0.5px solid #f1f4f9' }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.6px' }}>{cat}</span>
            </div>
            {NOTIFICATION_EVENTS.filter(e => e.category === cat).map(event => (
              <div key={event.key} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px', padding: '10px 18px', borderBottom: '0.5px solid #f9fafb', alignItems: 'center' }}>
                <div style={{ fontSize: 12, color: '#374151' }}>{event.label}</div>
                <div style={{ textAlign: 'center' }}>
                  <button onClick={() => toggle(event.key, 'in_app')}
                    style={{ width: 36, height: 20, borderRadius: 10, border: 'none', background: prefs[event.key]?.in_app !== false ? ACCENT : '#d1d5db', cursor: 'pointer', position: 'relative', transition: 'background .2s' }}>
                    <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: prefs[event.key]?.in_app !== false ? 19 : 3, transition: 'left .2s' }} />
                  </button>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <button onClick={() => toggle(event.key, 'email')}
                    style={{ width: 36, height: 20, borderRadius: 10, border: 'none', background: prefs[event.key]?.email ? ACCENT : '#d1d5db', cursor: 'pointer', position: 'relative', transition: 'background .2s' }}>
                    <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: prefs[event.key]?.email ? 19 : 3, transition: 'left .2s' }} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={save} style={{ padding: '10px 24px', background: ACCENT, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Save Preferences</button>
        {saved && <div style={{ fontSize: 12, color: '#16a34a', display: 'flex', alignItems: 'center', gap: 4 }}><span>✓</span> Saved</div>}
      </div>
    </div>
  )
}