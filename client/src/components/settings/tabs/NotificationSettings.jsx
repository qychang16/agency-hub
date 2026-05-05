import { useState, useEffect } from 'react'
import { useAuth } from '../../../context/AuthContext'
import { useApiSave } from '../../../hooks/useApiSave'
import { API } from '../../../utils/constants'
import { ACCENT } from '../../../utils/designTokens'

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
  const { token } = useAuth()
  const [prefs, setPrefs] = useState({})
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)
  const { save: apiSave, saving, error } = useApiSave(token)

  const categories = [...new Set(NOTIFICATION_EVENTS.map(e => e.category))]

  // Load preferences from backend on mount. Backend returns a complete map
  // (defaults merged with user customizations), so we never have to guess
  // what unchecked toggles "should" be.
  useEffect(() => {
    if (!token) return
    let cancelled = false
    fetch(`${API}/notification-preferences`, { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.json())
      .then(data => {
        if (cancelled) return
        if (data && typeof data === 'object' && !data.error) {
          setPrefs(data)
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [token])

  function toggle(key, channel) {
    setPrefs(prev => ({
      ...prev,
      [key]: {
        in_app: prev[key]?.in_app ?? true,
        email: prev[key]?.email ?? false,
        [channel]: !(prev[key]?.[channel] ?? (channel === 'in_app'))
      }
    }))
  }

  async function save() {
    const result = await apiSave(`${API}/notification-preferences`, { method: 'PATCH', body: prefs })
    if (!result.ok) return
    if (result.data?.preferences) {
      setPrefs(result.data.preferences)  // sync with sanitized server response
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  if (loading) {
    return (
      <div style={{ padding: 28, maxWidth: 720 }}>
        <div style={{ textAlign: 'center', padding: 60, color: '#9a958c' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9a958c" strokeWidth="2" strokeLinecap="round" style={{ marginBottom: 10, animation: 'spin 0.9s linear infinite' }}><path d="M21 12a9 9 0 11-6.219-8.56"/></svg>
          <div style={{ fontSize: 12 }}>Loading preferences…</div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: 28, maxWidth: 720 }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: '#14130f', marginBottom: 4 }}>Notifications</div>
        <div style={{ fontSize: 12, color: '#9a958c' }}>Choose how and when you are notified. In-app notifications appear in real time.</div>
      </div>

      <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #dcd8d0', overflow: 'hidden', marginBottom: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px', padding: '10px 18px', background: '#faf9f7', borderBottom: '0.5px solid #f5f3ef' }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: '#9a958c', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Event</div>
          <div style={{ fontSize: 10, fontWeight: 600, color: '#9a958c', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'center' }}>In-App</div>
          <div style={{ fontSize: 10, fontWeight: 600, color: '#9a958c', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'center' }}>Email</div>
        </div>
        {categories.map(cat => (
          <div key={cat}>
            <div style={{ padding: '8px 18px', background: '#faf9f7', borderBottom: '0.5px solid #f5f3ef' }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#4a4742', textTransform: 'uppercase', letterSpacing: '0.6px' }}>{cat}</span>
            </div>
            {NOTIFICATION_EVENTS.filter(e => e.category === cat).map(event => {
              const inApp = prefs[event.key]?.in_app ?? true
              const email = prefs[event.key]?.email ?? false
              return (
                <div key={event.key} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px', padding: '10px 18px', borderBottom: '0.5px solid #faf9f7', alignItems: 'center' }}>
                  <div style={{ fontSize: 12, color: '#4a4742' }}>{event.label}</div>
                  <div style={{ textAlign: 'center' }}>
                    <button onClick={() => toggle(event.key, 'in_app')}
                      style={{ width: 36, height: 20, borderRadius: 10, border: 'none', background: inApp ? ACCENT : '#c2bdb3', cursor: 'pointer', position: 'relative', transition: 'background .2s' }}>
                      <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: inApp ? 19 : 3, transition: 'left .2s' }} />
                    </button>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <button onClick={() => toggle(event.key, 'email')}
                      style={{ width: 36, height: 20, borderRadius: 10, border: 'none', background: email ? ACCENT : '#c2bdb3', cursor: 'pointer', position: 'relative', transition: 'background .2s' }}>
                      <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: email ? 19 : 3, transition: 'left .2s' }} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {error && (
        <div style={{ padding: '10px 14px', background: '#fef2f2', border: '0.5px solid #fecaca', borderRadius: 8, fontSize: 12, color: '#dc2626', marginBottom: 12 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={save} disabled={saving} style={{ padding: '10px 24px', background: ACCENT, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.6 : 1 }}>
          {saving ? 'Saving…' : 'Save Preferences'}
        </button>
        {saved && <div style={{ fontSize: 12, color: '#16a34a', display: 'flex', alignItems: 'center', gap: 4 }}>✓ Saved</div>}
      </div>
    </div>
  )
}