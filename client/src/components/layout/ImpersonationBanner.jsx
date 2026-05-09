import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { API } from '../../utils/constants'

// Banner shown at the very top of the app when the current session is
// an impersonation. Displays:
// - Who you really are (original_super_admin_email)
// - Who you're acting as (user.email + workspace_name)
// - Time remaining until the 30-min impersonation token expires
// - Stop Impersonating button -> backend revokes session, returns a
//   fresh super-admin token, app snaps to /admin/workspaces
//
// Mounts unconditionally; renders nothing when not impersonating.
export default function ImpersonationBanner() {
  const { user, token, applyStopImpersonation } = useAuth()
  const [stopping, setStopping] = useState(false)
  const [error, setError] = useState('')
  const [now, setNow] = useState(Date.now())

  // Tick the clock every 10 seconds for the countdown. Cheap, readable.
  useEffect(() => {
    if (!user?.is_impersonating) return
    const t = setInterval(() => setNow(Date.now()), 10 * 1000)
    return () => clearInterval(t)
  }, [user?.is_impersonating])

  if (!user?.is_impersonating) return null

  // Decode the JWT exp claim for the countdown. JWT exp is seconds since
  // epoch; we don't trust client clocks for security, only for display.
  let expiresMs = null
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    if (payload.exp) expiresMs = payload.exp * 1000
  } catch {}
  const remainingSec = expiresMs ? Math.max(0, Math.floor((expiresMs - now) / 1000)) : null
  const remainingLabel = remainingSec === null ? '' :
    remainingSec >= 60 ? Math.floor(remainingSec / 60) + 'm ' + (remainingSec % 60) + 's' :
    remainingSec + 's'

  async function handleStop() {
    setError('')
    setStopping(true)
    try {
      const res = await fetch(`${API}/admin/impersonate/stop`, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to stop impersonation')
      if (!data.token || !data.user) {
        throw new Error('Server did not return a fresh super admin token. Please sign in again.')
      }
      applyStopImpersonation(data.token, data.user)
      // Snap to AdminPanel -- it's the natural starting point for the
      // super admin and avoids landing them on a workspace-2 page they
      // can no longer see.
      window.location.href = '/admin/workspaces'
    } catch (e) {
      setError(e.message)
      setStopping(false)
    }
  }

  return (
    <div style={{
      position: 'sticky',
      top: 0,
      zIndex: 1500,
      background: 'linear-gradient(90deg, #2d2a7a 0%, #3d3a9e 100%)',
      color: '#fff',
      padding: '8px 16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 16,
      flexWrap: 'wrap',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      borderBottom: '0.5px solid rgba(255,255,255,0.15)',
      boxShadow: '0 1px 4px rgba(45,42,122,0.25)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', minWidth: 0 }}>
        {/* Eye icon to make impersonation state unmistakable */}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
        <div style={{ fontSize: 12, lineHeight: 1.4, minWidth: 0 }}>
          <span style={{ fontWeight: 700, letterSpacing: '0.4px', textTransform: 'uppercase', fontSize: 10, padding: '2px 7px', background: 'rgba(255,255,255,0.18)', borderRadius: 8, marginRight: 8 }}>
            Impersonating
          </span>
          <span>
            Acting as <strong>{user.name}</strong> ({user.email}) in <strong>{user.workspace_name}</strong>
            {user.original_super_admin_email && (
              <span style={{ opacity: 0.85 }}> &middot; logged in as {user.original_super_admin_email}</span>
            )}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        {remainingLabel && (
          <span style={{ fontSize: 11, opacity: 0.85, fontFeatureSettings: '"tnum"' }}>
            Expires in {remainingLabel}
          </span>
        )}
        {error && (
          <span style={{ fontSize: 11, color: '#fecaca', maxWidth: 240 }}>{error}</span>
        )}
        <button
          onClick={handleStop}
          disabled={stopping}
          style={{
            padding: '6px 14px',
            background: stopping ? 'rgba(255,255,255,0.15)' : '#fff',
            color: stopping ? 'rgba(255,255,255,0.7)' : '#2d2a7a',
            border: 'none',
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 600,
            cursor: stopping ? 'wait' : 'pointer',
            letterSpacing: '0.2px',
            transition: 'background .15s'
          }}>
          {stopping ? 'Stopping...' : 'Stop Impersonating'}
        </button>
      </div>
    </div>
  )
}