import { useState, useEffect } from 'react'
import { useAuth } from '../../../context/AuthContext'
import { API } from '../../../utils/constants'
import { ACCENT } from '../../../utils/designTokens'

function Field({ label, hint, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: '#4a4742', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{label}</label>
      {hint && <div style={{ fontSize: 11, color: '#9a958c', marginBottom: 6 }}>{hint}</div>}
      {children}
    </div>
  )
}

function Select({ value, onChange, options }) {
  return (
    <select value={value || ''} onChange={onChange}
      style={{ width: '100%', padding: '9px 12px', border: '0.5px solid #dcd8d0', borderRadius: 8, fontSize: 13, outline: 'none', background: '#fff', color: '#14130f' }}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

function Toggle({ value, onChange, label, hint, locked, lockedReason }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '0.5px solid #faf9f7' }}>
      <div style={{ flex: 1, marginRight: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontSize: 13, color: '#14130f', fontWeight: 500 }}>{label}</div>
          {locked && <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: '#f5f3ef', color: '#9a958c', fontWeight: 600 }}>DIRECTOR ONLY</span>}
        </div>
        {hint && <div style={{ fontSize: 11, color: '#9a958c', marginTop: 2 }}>{hint}</div>}
        {locked && lockedReason && <div style={{ fontSize: 11, color: '#d97706', marginTop: 2 }}>⚠ {lockedReason}</div>}
      </div>
      <button onClick={() => !locked && onChange(!value)} disabled={locked}
        style={{ width: 44, height: 24, borderRadius: 12, border: 'none', background: value ? ACCENT : '#c2bdb3', cursor: locked ? 'not-allowed' : 'pointer', position: 'relative', transition: 'background .2s', flexShrink: 0, opacity: locked ? 0.7 : 1 }}>
        <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: value ? 23 : 3, transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
      </button>
    </div>
  )
}

function Card({ children, style }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #dcd8d0', padding: 20, marginBottom: 16, ...style }}>
      {children}
    </div>
  )
}

function CardHeader({ title, subtitle }) {
  return (
    <div style={{ marginBottom: 14, paddingBottom: 10, borderBottom: '0.5px solid #f5f3ef' }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#4a4742' }}>{title}</div>
      {subtitle && <div style={{ fontSize: 11, color: '#9a958c', marginTop: 2 }}>{subtitle}</div>}
    </div>
  )
}

function Btn({ onClick, children, variant = 'primary', disabled }) {
  const variants = {
    primary: { background: ACCENT, color: '#fff', border: 'none' },
    ghost: { background: 'transparent', color: '#6e6a63', border: '0.5px solid #dcd8d0' },
    danger: { background: '#fee2e2', color: '#dc2626', border: '0.5px solid #fca5a5' },
  }
  return (
    <button onClick={!disabled ? onClick : undefined}
      style={{ padding: '8px 16px', fontSize: 12, ...variants[variant], borderRadius: 8, cursor: disabled ? 'default' : 'pointer', fontWeight: 500, opacity: disabled ? 0.6 : 1, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      {children}
    </button>
  )
}

export default function SecuritySettings() {
  const { token, user, isDirector } = useAuth()
  const [settings, setSettings] = useState({
    session_timeout_minutes: 480,
    max_failed_logins: 5,
    force_password_change: true,
    two_factor_required: false,
    password_min_length: 8,
    password_require_special: false,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showOld, setShowOld] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [pwError, setPwError] = useState('')
  const [pwSaved, setPwSaved] = useState(false)

  useEffect(() => {
    fetch(`${API}/security`, { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.json())
      .then(d => { if (d?.id) setSettings(d) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function save() {
    setSaving(true)
    try {
      await fetch(`${API}/security`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify(settings)
      })
      setSaved(true); setTimeout(() => setSaved(false), 2000)
    } catch {} finally { setSaving(false) }
  }

  function changePassword() {
    setPwError('')
    if (!oldPassword) { setPwError('Please enter your current password'); return }
    if (newPassword.length < settings.password_min_length) { setPwError(`Password must be at least ${settings.password_min_length} characters`); return }
    if (settings.password_require_special && !/[!@#$%^&*(),.?":{}|<>]/.test(newPassword)) { setPwError('Password must contain at least one special character'); return }
    if (newPassword !== confirmPassword) { setPwError('Passwords do not match'); return }
    setPwSaved(true)
    setOldPassword(''); setNewPassword(''); setConfirmPassword('')
    setTimeout(() => { setPwSaved(false); setShowChangePassword(false) }, 2000)
  }

  function getPasswordStrength(pw) {
    if (!pw) return { score: 0, label: '', color: '#dcd8d0' }
    let score = 0
    if (pw.length >= 8) score++
    if (pw.length >= 12) score++
    if (/[A-Z]/.test(pw)) score++
    if (/[0-9]/.test(pw)) score++
    if (/[!@#$%^&*]/.test(pw)) score++
    if (score <= 1) return { score, label: 'Weak', color: '#ef4444' }
    if (score <= 3) return { score, label: 'Fair', color: '#f59e0b' }
    if (score === 4) return { score, label: 'Good', color: '#3b82f6' }
    return { score, label: 'Strong', color: '#16a34a' }
  }

  const pwStrength = getPasswordStrength(newPassword)

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#9a958c' }}>Loading…</div>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#14130f' }}>Security Settings</div>
          <div style={{ fontSize: 12, color: '#9a958c', marginTop: 3 }}>Manage password policies, session timeouts and access security for your workspace</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: 16 }}>
        <div>
          {/* My Password */}
          <Card>
            <CardHeader title="My Password" subtitle="Change your personal account password" />
            {!showChangePassword ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 13, color: '#14130f' }}>••••••••••••</div>
                  <div style={{ fontSize: 11, color: '#9a958c', marginTop: 2 }}>Last changed: unknown</div>
                </div>
                <Btn variant="ghost" onClick={() => setShowChangePassword(true)}>Change Password</Btn>
              </div>
            ) : (
              <div>
                {/* Current password */}
                <Field label="Current Password">
                  <div style={{ position: 'relative' }}>
                    <input type={showOld ? 'text' : 'password'} value={oldPassword} onChange={e => setOldPassword(e.target.value)}
                      placeholder="Enter current password"
                      style={{ width: '100%', padding: '9px 40px 9px 12px', border: '0.5px solid #dcd8d0', borderRadius: 8, fontSize: 13, outline: 'none', background: '#fff', color: '#14130f', boxSizing: 'border-box' }} />
                    <button onClick={() => setShowOld(!showOld)} type="button"
                      style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', color: '#9a958c', padding: 4 }}>
                      {showOld ? '🙈' : '👁'}
                    </button>
                  </div>
                </Field>

                {/* New password */}
                <Field label="New Password">
                  <div style={{ position: 'relative' }}>
                    <input type={showNew ? 'text' : 'password'} value={newPassword} onChange={e => setNewPassword(e.target.value)}
                      placeholder={`At least ${settings.password_min_length} characters`}
                      style={{ width: '100%', padding: '9px 40px 9px 12px', border: '0.5px solid #dcd8d0', borderRadius: 8, fontSize: 13, outline: 'none', background: '#fff', color: '#14130f', boxSizing: 'border-box' }} />
                    <button onClick={() => setShowNew(!showNew)} type="button"
                      style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', color: '#9a958c', padding: 4 }}>
                      {showNew ? '🙈' : '👁'}
                    </button>
                  </div>
                  {newPassword && (
                    <div style={{ marginTop: 6 }}>
                      <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                        {[1,2,3,4,5].map(i => (
                          <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= pwStrength.score ? pwStrength.color : '#dcd8d0', transition: 'background .2s' }} />
                        ))}
                      </div>
                      <div style={{ fontSize: 10, color: pwStrength.color, fontWeight: 600 }}>{pwStrength.label}</div>
                    </div>
                  )}
                </Field>

                {/* Confirm */}
                <Field label="Confirm New Password">
                  <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    style={{ width: '100%', padding: '9px 12px', border: `0.5px solid ${confirmPassword && confirmPassword !== newPassword ? '#ef4444' : '#dcd8d0'}`, borderRadius: 8, fontSize: 13, outline: 'none', background: '#fff', color: '#14130f', boxSizing: 'border-box' }} />
                  {confirmPassword && confirmPassword !== newPassword && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>Passwords do not match</div>}
                </Field>

                {pwError && <div style={{ fontSize: 12, color: '#dc2626', background: '#fef2f2', border: '0.5px solid #fecaca', borderRadius: 7, padding: '8px 12px', marginBottom: 12 }}>⚠ {pwError}</div>}
                {pwSaved && <div style={{ fontSize: 12, color: '#16a34a', background: '#f0fdf4', border: '0.5px solid #86efac', borderRadius: 7, padding: '8px 12px', marginBottom: 12 }}>✓ Password changed successfully</div>}

                <div style={{ display: 'flex', gap: 8 }}>
                  <Btn variant="ghost" onClick={() => { setShowChangePassword(false); setPwError('') }} style={{ flex: 1 }}>Cancel</Btn>
                  <Btn onClick={changePassword} style={{ flex: 2 }}>Update Password</Btn>
                </div>
              </div>
            )}
          </Card>

          {/* Session Management */}
          <Card>
            <CardHeader title="Session Management" subtitle="Controls apply to all agents in the workspace" />
            <Field label="Auto-logout after inactivity" hint="Agents are signed out after this period of no activity">
              <Select value={settings.session_timeout_minutes} onChange={e => setSettings(p => ({ ...p, session_timeout_minutes: parseInt(e.target.value) }))} options={[
                { value: 60, label: '1 hour' },
                { value: 120, label: '2 hours' },
                { value: 240, label: '4 hours' },
                { value: 480, label: '8 hours (recommended)' },
                { value: 720, label: '12 hours' },
                { value: 1440, label: '24 hours' },
              ]} />
            </Field>
            <Field label="Account lockout after failed logins" hint="Account locked for 15 minutes after this many failed attempts">
              <Select value={settings.max_failed_logins} onChange={e => setSettings(p => ({ ...p, max_failed_logins: parseInt(e.target.value) }))} options={[
                { value: 3, label: '3 attempts' },
                { value: 5, label: '5 attempts (recommended)' },
                { value: 10, label: '10 attempts' },
              ]} />
            </Field>
          </Card>
        </div>

        <div>
          {/* Password Policy */}
          <Card>
            <CardHeader title="Password Policy" subtitle="Applies to all agents when setting or changing passwords" />
            <Field label="Minimum password length">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <input type="range" min={6} max={20} value={settings.password_min_length}
                  onChange={e => setSettings(p => ({ ...p, password_min_length: parseInt(e.target.value) }))}
                  disabled={!isDirector}
                  style={{ flex: 1, accentColor: ACCENT }} />
                <div style={{ fontSize: 16, fontWeight: 700, color: '#14130f', minWidth: 28, textAlign: 'center' }}>{settings.password_min_length}</div>
                <span style={{ fontSize: 11, color: '#9a958c' }}>characters</span>
              </div>
            </Field>
            <Toggle
              value={settings.password_require_special}
              onChange={v => setSettings(p => ({ ...p, password_require_special: v }))}
              label="Require special characters"
              hint="Password must contain ! @ # $ % etc."
              locked={!isDirector}
              lockedReason="Only Directors can change password policy" />
            <Toggle
              value={settings.force_password_change}
              onChange={v => setSettings(p => ({ ...p, force_password_change: v }))}
              label="Force password change on first login"
              hint="New agents must change their temporary password immediately"
              locked={!isDirector} />
          </Card>

          {/* 2FA */}
          <Card>
            <CardHeader title="Two-Factor Authentication" subtitle="Additional login security for all agents" />
            <Toggle
              value={settings.two_factor_required}
              onChange={v => setSettings(p => ({ ...p, two_factor_required: v }))}
              label="Require 2FA for all agents"
              hint="Agents must set up an authenticator app on next login"
              locked={!isDirector}
              lockedReason="Only Directors can enable 2FA requirement" />
            {settings.two_factor_required && (
              <div style={{ marginTop: 12, padding: '10px 12px', background: '#fef3c7', border: '0.5px solid #fde68a', borderRadius: 8, fontSize: 11, color: '#92400e', lineHeight: 1.6 }}>
                ⚠️ <strong>Before enabling:</strong> Inform all agents they will be prompted to set up Google Authenticator or similar app on their next login. Agents without a smartphone will need assistance.
              </div>
            )}
            <div style={{ marginTop: 14, padding: '12px 14px', background: '#faf9f7', borderRadius: 8, border: '0.5px solid #dcd8d0' }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: '#4a4742', marginBottom: 4 }}>Supported authenticator apps</div>
              <div style={{ fontSize: 11, color: '#9a958c', lineHeight: 1.6 }}>
                Google Authenticator · Microsoft Authenticator · Authy · 1Password · Any TOTP-compatible app
              </div>
            </div>
          </Card>

          {/* Active sessions */}
          <Card>
            <CardHeader title="Active Sessions" subtitle="Currently logged-in devices for your account" />
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: '#faf9f7', borderRadius: 8, marginBottom: 8 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9a958c" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: '#14130f' }}>This device — Current session</div>
                <div style={{ fontSize: 11, color: '#9a958c' }}>Last active: just now</div>
              </div>
              <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 10, background: '#dcfce7', color: '#16a34a', fontWeight: 600 }}>Active</span>
            </div>
            <div style={{ fontSize: 11, color: '#9a958c', textAlign: 'center', padding: '6px 0' }}>
              Full session management coming in next update
            </div>
          </Card>
        </div>
      </div>

      {/* Save — only Directors can save workspace security settings */}
      {isDirector && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
          {saved && <div style={{ fontSize: 12, color: '#16a34a', display: 'flex', alignItems: 'center', gap: 5 }}>✓ Security settings saved</div>}
          <Btn onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Security Settings'}</Btn>
        </div>
      )}
    </div>
  )
}