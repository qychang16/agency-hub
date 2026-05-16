import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { API } from '../../utils/constants'

// Renders a global banner at the top of the app when any phone_number
// belonging to the current workspace has connection_status='DISCONNECTED'.
// Re-fetches every 60s so it appears quickly after a Meta disconnect webhook
// without requiring a manual refresh. Hidden during impersonation since the
// impersonator already sees ImpersonationBanner above.
export default function DisconnectBanner() {
  const { token, user } = useAuth()
  const [disconnected, setDisconnected] = useState([])

  useEffect(() => {
    if (!token || !user) return
    let cancelled = false

    async function load() {
      try {
        const r = await fetch(`${API}/phone-numbers`, {
          headers: { Authorization: 'Bearer ' + token }
        })
        if (!r.ok) return
        const phones = await r.json()
        if (cancelled) return
        const bad = phones.filter(p => p.connection_status === 'DISCONNECTED')
        setDisconnected(bad)
      } catch {
        // Silent fail - banner is opportunistic, not critical
      }
    }

    load()
    const interval = setInterval(load, 60000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [token, user])

  if (disconnected.length === 0) return null

  const reasonHuman = {
    PRIMARY_INACTIVITY: 'inactive for ~14 days',
    COMPANION_INACTIVITY: 'companion device inactive ~30 days',
    ACCOUNT_DISCONNECTED: 'disconnected by Meta',
    BUSINESS_DOWNGRADE: 'downgraded to consumer WhatsApp',
    CHANGE_NUMBER: 'number changed',
    USER_RE_REGISTERED: 're-registered on new device',
  }

  return (
    <div style={{
      background: '#fef2f2',
      borderBottom: '1px solid #fca5a5',
      padding: '10px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      flexShrink: 0,
    }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#b91c1c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/>
        <line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
      <div style={{ fontSize: 13, color: '#7f1d1d', flex: 1 }}>
        <strong>WhatsApp disconnected:</strong>{' '}
        {disconnected.map((p, i) => (
          <span key={p.id}>
            {p.number} ({reasonHuman[p.disconnect_reason] || p.disconnect_reason || 'reason unknown'})
            {i < disconnected.length - 1 ? ', ' : ''}
          </span>
        ))}
        . Sending and receiving are blocked until reconnected via WhatsApp Business app.
      </div>
    </div>
  )
}