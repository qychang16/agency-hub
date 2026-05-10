import { useState, useEffect } from 'react'

// ─── VERIFY EMAIL PAGE (Chunk 31) ───────────────────────────────────────────
// Public page — no auth required.
// Activated by URL pattern /verify-email/:token
//
// State machine:
//   loading    — calling POST /me/verify-email/:token
//   success    — change confirmed, show new email + sign-in link
//   error      — token invalid, expired (>1h old), or already used

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000'

export default function VerifyEmail({ token }) {
  const [state, setState] = useState('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const [newEmail, setNewEmail] = useState('')

  useEffect(() => {
    let cancelled = false
    if (!token) { setState('error'); setErrorMessage('No verification token provided.'); return }

    fetch(`${API_BASE}/me/verify-email/${encodeURIComponent(token)}`, {
      method: 'POST',
    })
      .then(r => r.json().then(d => ({ ok: r.ok, data: d })))
      .then(({ ok, data }) => {
        if (cancelled) return
        if (!ok) {
          setErrorMessage(data?.error || 'This verification link is invalid or has expired.')
          setState('error')
          return
        }
        setNewEmail(data?.email || '')
        setState('success')
      })
      .catch(() => {
        if (cancelled) return
        setErrorMessage('Could not reach the server. Please try again later.')
        setState('error')
      })

    return () => { cancelled = true }
  }, [token])

  return (
    <div style={{
      minHeight: '100vh', background: '#faf9f7',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16, fontFamily: 'Inter, -apple-system, sans-serif',
    }}>
      <div style={{
        background: '#fff', borderRadius: 14,
        width: '100%', maxWidth: 440,
        boxShadow: '0 1px 3px rgba(20, 19, 15, 0.04), 0 4px 16px rgba(20, 19, 15, 0.04)',
      }}>
        {/* Header */}
        <div style={{
          padding: '32px 32px 24px',
          textAlign: 'center',
          borderBottom: '0.5px solid #f5f3ef',
        }}>
          <Logo />
          <div style={{ fontSize: 11, fontWeight: 600, color: '#534ab7', textTransform: 'uppercase', letterSpacing: '0.6px', marginTop: 14 }}>
            Tel-Cloud
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '36px 32px' }}>

          {state === 'loading' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 13, color: '#6e6a63' }}>Confirming email change…</div>
            </div>
          )}

          {state === 'success' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%',
                background: '#dcfce7', margin: '0 auto 18px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 28, color: '#16a34a',
              }}>✓</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#14130f', marginBottom: 8 }}>
                Email address updated
              </div>
              {newEmail && (
                <div style={{ fontSize: 13, color: '#6e6a63', lineHeight: 1.6, marginBottom: 24 }}>
                  Your sign-in email is now <strong style={{ color: '#14130f' }}>{newEmail}</strong>.
                </div>
              )}
              <a href="/" style={{
                display: 'inline-block',
                padding: '11px 22px',
                background: '#14134a', color: '#fff', textDecoration: 'none',
                borderRadius: 8, fontSize: 13, fontWeight: 500,
              }}>Sign in to Tel-Cloud</a>
            </div>
          )}

          {state === 'error' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: 48, height: 48, borderRadius: '50%',
                background: '#fef2f2', margin: '0 auto 16px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22, color: '#dc2626',
              }}>!</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#14130f', marginBottom: 8 }}>
                Verification link not valid
              </div>
              <div style={{ fontSize: 13, color: '#6e6a63', lineHeight: 1.6, marginBottom: 20 }}>
                {errorMessage}
              </div>
              <div style={{ fontSize: 12, color: '#9a958c', lineHeight: 1.6, marginBottom: 24 }}>
                Verification links expire after 1 hour. Sign in and request a new email change from your profile, or contact <a href="mailto:support@tel-cloud.sg" style={{ color: '#534ab7' }}>support@tel-cloud.sg</a>.
              </div>
              <a href="/" style={{
                display: 'inline-block',
                padding: '11px 22px',
                background: '#fff', color: '#14130f', textDecoration: 'none',
                border: '0.5px solid #dcd8d0',
                borderRadius: 8, fontSize: 13, fontWeight: 500,
              }}>Back to sign in</a>
            </div>
          )}

        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 32px',
          borderTop: '0.5px solid #f5f3ef',
          textAlign: 'center',
          fontSize: 11, color: '#9a958c',
        }}>
          Need help? <a href="mailto:support@tel-cloud.sg" style={{ color: '#534ab7' }}>support@tel-cloud.sg</a>
        </div>
      </div>
    </div>
  )
}

// ─── Tel-Cloud chrome rings logo ────────────────────────────────────────────
function Logo() {
  return (
    <svg width="56" height="56" viewBox="0 0 34 34" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block', margin: '0 auto', filter: 'drop-shadow(0 2px 6px rgba(10, 9, 7, 0.18))' }}>
      <defs>
        <radialGradient id="verify-indigo-ring" cx="11" cy="14" r="11" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#8a87ff"/>
          <stop offset="0.5" stopColor="#3d3a9e"/>
          <stop offset="1" stopColor="#14134a"/>
        </radialGradient>
        <radialGradient id="verify-indigo-hl" cx="10" cy="13" r="4" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.9"/>
          <stop offset="1" stopColor="#ffffff" stopOpacity="0"/>
        </radialGradient>
        <radialGradient id="verify-white-ring" cx="19" cy="14" r="11" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffffff"/>
          <stop offset="0.5" stopColor="#b8b6cf"/>
          <stop offset="1" stopColor="#4a4760"/>
        </radialGradient>
        <radialGradient id="verify-white-hl" cx="18" cy="13" r="4" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffffff" stopOpacity="1"/>
          <stop offset="1" stopColor="#ffffff" stopOpacity="0"/>
        </radialGradient>
      </defs>
      <circle cx="13" cy="17" r="6.5" stroke="url(#verify-indigo-ring)" strokeWidth="2.8" fill="none"/>
      <circle cx="13" cy="17" r="6.5" stroke="url(#verify-indigo-hl)" strokeWidth="2.8" fill="none"/>
      <circle cx="21" cy="17" r="6.5" stroke="url(#verify-white-ring)" strokeWidth="2.8" fill="none"/>
      <circle cx="21" cy="17" r="6.5" stroke="url(#verify-white-hl)" strokeWidth="2.8" fill="none"/>
    </svg>
  )
}