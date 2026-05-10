import { useState, useEffect } from 'react'
import PasswordStrengthMeter from './PasswordStrengthMeter'
import { validatePassword } from '../../utils/passwordPolicy'

// ─── INVITE ACCEPT PAGE (Chunk 30) ──────────────────────────────────────────
// Public page — no auth required.
// Activated by URL pattern /invite/:token
//
// State machine:
//   loading        — looking up token via GET /invitations/lookup/:token
//   error_invalid  — token not found, expired, already used, or revoked
//   ready          — token valid; show password form
//   submitting     — accepting invitation via POST /invitations/lookup/:token/accept
//   success        — show "redirecting to login" briefly, then redirect

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000'

export default function InviteAccept({ token, onAccepted }) {
  const [state, setState] = useState('loading')
  const [invitation, setInvitation] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitError, setSubmitError] = useState('')

  // ─── Step 1: Look up the token on mount ──────────────────────────────
  useEffect(() => {
    let cancelled = false
    if (!token) { setState('error_invalid'); setErrorMessage('No invitation token provided.'); return }

    fetch(`${API_BASE}/invitations/lookup/${encodeURIComponent(token)}`)
      .then(r => r.json().then(d => ({ ok: r.ok, status: r.status, data: d })))
      .then(({ ok, data }) => {
        if (cancelled) return
        if (!ok) {
          setErrorMessage(data?.error || 'This invitation link is invalid or has expired.')
          setState('error_invalid')
          return
        }
        setInvitation(data)
        setState('ready')
      })
      .catch(() => {
        if (cancelled) return
        setErrorMessage('Could not reach the server. Please try again later.')
        setState('error_invalid')
      })

    return () => { cancelled = true }
  }, [token])

  // ─── Step 2: Submit password ─────────────────────────────────────────
  function handleSubmit() {
    setSubmitError('')

    const validation = validatePassword(password, invitation?.email)
    if (!validation.valid) { setSubmitError(validation.errors[0]); return }
    if (password !== confirmPassword) { setSubmitError('Passwords do not match.'); return }

    setState('submitting')

    fetch(`${API_BASE}/invitations/lookup/${encodeURIComponent(token)}/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
      .then(r => r.json().then(d => ({ ok: r.ok, data: d })))
      .then(({ ok, data }) => {
        if (!ok) {
          setSubmitError(data?.error || 'Could not activate your account.')
          setState('ready')
          return
        }
        setState('success')
        setTimeout(() => {
          if (onAccepted) onAccepted()
          else window.location.href = '/'
        }, 1800)
      })
      .catch(() => {
        setSubmitError('Network error. Please try again.')
        setState('ready')
      })
  }

  // ─── Render ──────────────────────────────────────────────────────────
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
        {/* Header — Tel-Cloud branded */}
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

        {/* Body — varies by state */}
        <div style={{ padding: '28px 32px 32px' }}>

          {state === 'loading' && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: 13, color: '#6e6a63' }}>Checking your invitation…</div>
            </div>
          )}

          {state === 'error_invalid' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: 48, height: 48, borderRadius: '50%',
                background: '#fef2f2', margin: '0 auto 16px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22, color: '#dc2626',
              }}>!</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#14130f', marginBottom: 8 }}>
                Invitation link not valid
              </div>
              <div style={{ fontSize: 13, color: '#6e6a63', lineHeight: 1.6, marginBottom: 24 }}>
                {errorMessage}
              </div>
              <div style={{ fontSize: 12, color: '#9a958c', lineHeight: 1.6 }}>
                Ask your director to send you a fresh invitation, or contact <a href="mailto:support@tel-cloud.sg" style={{ color: '#534ab7' }}>support@tel-cloud.sg</a>.
              </div>
            </div>
          )}

          {(state === 'ready' || state === 'submitting') && invitation && (
            <>
              <div style={{ fontSize: 18, fontWeight: 600, color: '#14130f', marginBottom: 4 }}>
                Welcome{invitation.full_name ? `, ${invitation.full_name.split(' ')[0]}` : ''}
              </div>
              <div style={{ fontSize: 13, color: '#6e6a63', lineHeight: 1.6, marginBottom: 20 }}>
                You've been invited to join <strong style={{ color: '#14130f' }}>{invitation.workspace_name}</strong>. Set a password below to activate your account.
              </div>

              {/* Email (read-only display) */}
              <div style={{ marginBottom: 16 }}>
                <Label>Your login email</Label>
                <div style={{
                  padding: '10px 12px',
                  background: '#faf9f7', border: '0.5px solid #e8e5dc', borderRadius: 8,
                  fontSize: 13, color: '#4a4742',
                }}>{invitation.email}</div>
              </div>

              {/* Password */}
              <div style={{ marginBottom: 12 }}>
                <Label>Choose a password</Label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  disabled={state === 'submitting'}
                  style={inputStyle}
                  autoFocus
                />
                <PasswordStrengthMeter password={password} userEmail={invitation.email} />
              </div>

              {/* Confirm */}
              <div style={{ marginBottom: 16 }}>
                <Label>Confirm password</Label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Type it again"
                  disabled={state === 'submitting'}
                  style={inputStyle}
                />
                {confirmPassword && password !== confirmPassword && (
                  <div style={{ fontSize: 11, color: '#dc2626', marginTop: 4 }}>Passwords do not match</div>
                )}
              </div>

              {submitError && (
                <div style={{
                  background: '#fef2f2', border: '0.5px solid #fecaca', borderRadius: 8,
                  padding: '10px 12px', fontSize: 12, color: '#991b1b', marginBottom: 14, lineHeight: 1.5,
                }}>{submitError}</div>
              )}

              <button
                onClick={handleSubmit}
                disabled={state === 'submitting'}
                style={{
                  width: '100%', padding: '12px',
                  background: state === 'submitting' ? '#9a958c' : '#14134a',
                  border: 'none', borderRadius: 8,
                  fontSize: 13, fontWeight: 600, color: '#fff',
                  cursor: state === 'submitting' ? 'not-allowed' : 'pointer',
                }}
              >
                {state === 'submitting' ? 'Activating…' : 'Activate my account'}
              </button>
            </>
          )}

          {state === 'success' && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%',
                background: '#dcfce7', margin: '0 auto 16px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 28, color: '#16a34a',
              }}>✓</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#14130f', marginBottom: 6 }}>
                Account activated
              </div>
              <div style={{ fontSize: 13, color: '#6e6a63' }}>
                Redirecting you to sign in…
              </div>
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

// ─── Tel-Cloud chrome rings logo (inline SVG) ───────────────────────────────
function Logo() {
  return (
    <svg width="56" height="56" viewBox="0 0 34 34" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block', margin: '0 auto', filter: 'drop-shadow(0 2px 6px rgba(10, 9, 7, 0.18))' }}>
      <defs>
        <radialGradient id="invite-indigo-ring" cx="11" cy="14" r="11" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#8a87ff"/>
          <stop offset="0.5" stopColor="#3d3a9e"/>
          <stop offset="1" stopColor="#14134a"/>
        </radialGradient>
        <radialGradient id="invite-indigo-hl" cx="10" cy="13" r="4" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.9"/>
          <stop offset="1" stopColor="#ffffff" stopOpacity="0"/>
        </radialGradient>
        <radialGradient id="invite-white-ring" cx="19" cy="14" r="11" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffffff"/>
          <stop offset="0.5" stopColor="#b8b6cf"/>
          <stop offset="1" stopColor="#4a4760"/>
        </radialGradient>
        <radialGradient id="invite-white-hl" cx="18" cy="13" r="4" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffffff" stopOpacity="1"/>
          <stop offset="1" stopColor="#ffffff" stopOpacity="0"/>
        </radialGradient>
      </defs>
      <circle cx="13" cy="17" r="6.5" stroke="url(#invite-indigo-ring)" strokeWidth="2.8" fill="none"/>
      <circle cx="13" cy="17" r="6.5" stroke="url(#invite-indigo-hl)" strokeWidth="2.8" fill="none"/>
      <circle cx="21" cy="17" r="6.5" stroke="url(#invite-white-ring)" strokeWidth="2.8" fill="none"/>
      <circle cx="21" cy="17" r="6.5" stroke="url(#invite-white-hl)" strokeWidth="2.8" fill="none"/>
    </svg>
  )
}

function Label({ children }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 600, color: '#9a958c',
      textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 6,
    }}>{children}</div>
  )
}

const inputStyle = {
  width: '100%', padding: '10px 12px',
  border: '0.5px solid #dcd8d0', borderRadius: 8,
  background: '#fff',
  fontSize: 13, color: '#14130f',
  outline: 'none', boxSizing: 'border-box',
  fontFamily: 'inherit',
}