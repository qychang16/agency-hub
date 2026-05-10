import { useState, useEffect } from 'react'
import PasswordStrengthMeter from '../auth/PasswordStrengthMeter'
import { validatePassword } from '../../utils/passwordPolicy'

// ─── PROFILE PAGE (Chunk 31) ────────────────────────────────────────────────
// Self-service profile management for any logged-in user.
// Six independent sections, each with its own save action.
//
// Backend endpoints used (from server/routes/profile.js):
//   GET    /me                       — load current user
//   PATCH  /me                       — update full_name, phone, email_signature, send_behaviour
//   POST   /me/change-password       — { currentPassword, newPassword }
//   POST   /me/request-email-change  — { newEmail } (sends verification email)
//   POST   /me/cancel-email-change   — clear pending change

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000'

export default function Profile({ token, onClose }) {
  const [me, setMe] = useState(null)
  const [loadError, setLoadError] = useState('')

  function loadMe() {
    fetch(`${API_BASE}/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json().then(d => ({ ok: r.ok, data: d })))
      .then(({ ok, data }) => {
        if (!ok) { setLoadError(data?.error || 'Could not load profile.'); return }
        setMe(data)
      })
      .catch(() => setLoadError('Network error loading profile.'))
  }

  useEffect(() => { loadMe() }, [])

  if (loadError) {
    return (
      <PageShell title="Profile" onClose={onClose}>
        <ErrorBanner>{loadError}</ErrorBanner>
      </PageShell>
    )
  }

  if (!me) {
    return (
      <PageShell title="Profile" onClose={onClose}>
        <div style={{ padding: 40, textAlign: 'center', color: '#9a958c', fontSize: 13 }}>Loading…</div>
      </PageShell>
    )
  }

  return (
    <PageShell title="Profile" onClose={onClose}>
      <PersonalInfoSection me={me} token={token} onSaved={loadMe} />
      <ChangePasswordSection me={me} token={token} />
      <EmailAddressSection me={me} token={token} onChanged={loadMe} />
      <EmailSignatureSection me={me} token={token} onSaved={loadMe} />
      <SendBehaviourSection me={me} token={token} onSaved={loadMe} />
      <AccountSnapshotSection me={me} />
    </PageShell>
  )
}

// ─── SECTION 1: Personal info ────────────────────────────────────────────────
function PersonalInfoSection({ me, token, onSaved }) {
  const [fullName, setFullName] = useState(me.full_name || '')
  const [phone, setPhone] = useState(me.phone || '')
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState(null)

  function handleSave() {
    setSaving(true); setStatus(null)
    fetch(`${API_BASE}/me`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ full_name: fullName, phone }),
    })
      .then(r => r.json().then(d => ({ ok: r.ok, data: d })))
      .then(({ ok, data }) => {
        setSaving(false)
        if (!ok) { setStatus({ type: 'error', text: data?.error || 'Could not save.' }); return }
        setStatus({ type: 'ok', text: 'Saved' })
        if (onSaved) onSaved()
        setTimeout(() => setStatus(null), 2000)
      })
      .catch(() => { setSaving(false); setStatus({ type: 'error', text: 'Network error.' }) })
  }

  return (
    <Section title="Personal info" subtitle="How you appear to your team in the inbox and on outgoing messages.">
      <Field label="Full name">
        <input style={inputStyle} value={fullName} onChange={e => setFullName(e.target.value)} placeholder="e.g. Wei Ming Tan" />
      </Field>
      <Field label="Phone (optional)">
        <input style={inputStyle} value={phone} onChange={e => setPhone(e.target.value)} placeholder="+65 9xxx xxxx" />
      </Field>
      <SaveRow status={status} disabled={saving} onSave={handleSave} label={saving ? 'Saving…' : 'Save'} />
    </Section>
  )
}

// ─── SECTION 2: Change password ──────────────────────────────────────────────
function ChangePasswordSection({ me, token }) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState(null)

  function handleSave() {
    setStatus(null)
    if (!currentPassword) { setStatus({ type: 'error', text: 'Enter your current password.' }); return }

    const v = validatePassword(newPassword, me.email)
    if (!v.valid) { setStatus({ type: 'error', text: v.errors[0] }); return }
    if (newPassword !== confirmPassword) { setStatus({ type: 'error', text: 'New passwords do not match.' }); return }

    setSaving(true)
    fetch(`${API_BASE}/me/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ currentPassword, newPassword }),
    })
      .then(r => r.json().then(d => ({ ok: r.ok, data: d })))
      .then(({ ok, data }) => {
        setSaving(false)
        if (!ok) { setStatus({ type: 'error', text: data?.error || 'Could not change password.' }); return }
        setStatus({ type: 'ok', text: 'Password changed' })
        setCurrentPassword(''); setNewPassword(''); setConfirmPassword('')
        setTimeout(() => setStatus(null), 3000)
      })
      .catch(() => { setSaving(false); setStatus({ type: 'error', text: 'Network error.' }) })
  }

  return (
    <Section title="Change password" subtitle="Choose a strong password unique to Tel-Cloud.">
      <Field label="Current password">
        <input style={inputStyle} type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} autoComplete="current-password" />
      </Field>
      <Field label="New password">
        <input style={inputStyle} type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} autoComplete="new-password" />
        <PasswordStrengthMeter password={newPassword} userEmail={me.email} />
      </Field>
      <Field label="Confirm new password">
        <input style={inputStyle} type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} autoComplete="new-password" />
        {confirmPassword && newPassword !== confirmPassword && (
          <div style={{ fontSize: 11, color: '#dc2626', marginTop: 4 }}>Passwords do not match</div>
        )}
      </Field>
      <SaveRow status={status} disabled={saving} onSave={handleSave} label={saving ? 'Changing…' : 'Change password'} />
    </Section>
  )
}

// ─── SECTION 3: Email address (with verification flow) ───────────────────────
function EmailAddressSection({ me, token, onChanged }) {
  const [editing, setEditing] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState(null)

  const hasPending = !!me.pending_email_change

  function requestChange() {
    setStatus(null)
    if (!newEmail || !newEmail.includes('@')) { setStatus({ type: 'error', text: 'Enter a valid email.' }); return }
    if (newEmail.toLowerCase() === me.email.toLowerCase()) { setStatus({ type: 'error', text: 'New email is the same as current.' }); return }

    setSaving(true)
    fetch(`${API_BASE}/me/request-email-change`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ newEmail }),
    })
      .then(r => r.json().then(d => ({ ok: r.ok, data: d })))
      .then(({ ok, data }) => {
        setSaving(false)
        if (!ok) { setStatus({ type: 'error', text: data?.error || 'Could not send verification.' }); return }
        setStatus({ type: 'ok', text: `Verification email sent to ${newEmail}` })
        setEditing(false); setNewEmail('')
        if (onChanged) onChanged()
      })
      .catch(() => { setSaving(false); setStatus({ type: 'error', text: 'Network error.' }) })
  }

  function cancelChange() {
    if (!confirm('Cancel the pending email change?')) return
    fetch(`${API_BASE}/me/cancel-email-change`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(() => { if (onChanged) onChanged() })
  }

  return (
    <Section title="Email address" subtitle="The email you use to sign in. Changing it requires verification of the new address.">
      <Field label="Current email">
        <div style={readOnlyStyle}>{me.email}</div>
      </Field>

      {hasPending ? (
        <div style={{
          background: '#fef9ef', border: '0.5px solid #f5e6c0', borderRadius: 8,
          padding: '12px 14px', marginTop: 10,
        }}>
          <div style={{ fontSize: 12, color: '#92400e', marginBottom: 8, lineHeight: 1.5 }}>
            <strong>Pending change to {me.pending_email_change}</strong><br />
            Check that inbox and click the link within 1 hour to confirm.
          </div>
          <button onClick={cancelChange} style={btnSecondaryStyle}>Cancel pending change</button>
        </div>
      ) : !editing ? (
        <button onClick={() => setEditing(true)} style={{ ...btnSecondaryStyle, marginTop: 4 }}>Change email</button>
      ) : (
        <>
          <Field label="New email">
            <input style={inputStyle} type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="you@newdomain.com" autoFocus />
          </Field>
          <div style={{ fontSize: 11, color: '#9a958c', marginTop: -4, marginBottom: 12, lineHeight: 1.5 }}>
            We'll send a verification link to the new address. Your email won't change until you click it.
          </div>
          <SaveRow
            status={status}
            disabled={saving}
            onSave={requestChange}
            label={saving ? 'Sending…' : 'Send verification email'}
            secondaryAction={() => { setEditing(false); setNewEmail(''); setStatus(null) }}
            secondaryLabel="Cancel"
          />
        </>
      )}

      {status && !editing && (
        <div style={{ marginTop: 8 }}>
          {status.type === 'ok'
            ? <div style={{ fontSize: 12, color: '#16a34a' }}>✓ {status.text}</div>
            : <div style={{ fontSize: 12, color: '#dc2626' }}>{status.text}</div>}
        </div>
      )}
    </Section>
  )
}

// ─── SECTION 4: Email signature ──────────────────────────────────────────────
function EmailSignatureSection({ me, token, onSaved }) {
  const [signature, setSignature] = useState(me.email_signature || '')
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState(null)

  function handleSave() {
    setSaving(true); setStatus(null)
    fetch(`${API_BASE}/me`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ email_signature: signature }),
    })
      .then(r => r.json().then(d => ({ ok: r.ok, data: d })))
      .then(({ ok, data }) => {
        setSaving(false)
        if (!ok) { setStatus({ type: 'error', text: data?.error || 'Could not save.' }); return }
        setStatus({ type: 'ok', text: 'Saved' })
        if (onSaved) onSaved()
        setTimeout(() => setStatus(null), 2000)
      })
      .catch(() => { setSaving(false); setStatus({ type: 'error', text: 'Network error.' }) })
  }

  return (
    <Section title="Email signature" subtitle="Appended to outgoing emails sent from Tel-Cloud.">
      <Field label="Signature">
        <textarea
          style={{ ...inputStyle, minHeight: 90, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }}
          value={signature}
          onChange={e => setSignature(e.target.value)}
          placeholder={`e.g.\nWei Ming Tan\nSenior Recruiter, Y.E.C Consultancy\n+65 9xxx xxxx`}
        />
      </Field>
      <SaveRow status={status} disabled={saving} onSave={handleSave} label={saving ? 'Saving…' : 'Save'} />
    </Section>
  )
}

// ─── SECTION 5: Send behaviour ───────────────────────────────────────────────
function SendBehaviourSection({ me, token, onSaved }) {
  const [behaviour, setBehaviour] = useState(me.send_behaviour || 'immediate')
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState(null)

  function handleSave() {
    setSaving(true); setStatus(null)
    fetch(`${API_BASE}/me`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ send_behaviour: behaviour }),
    })
      .then(r => r.json().then(d => ({ ok: r.ok, data: d })))
      .then(({ ok, data }) => {
        setSaving(false)
        if (!ok) { setStatus({ type: 'error', text: data?.error || 'Could not save.' }); return }
        setStatus({ type: 'ok', text: 'Saved' })
        if (onSaved) onSaved()
        setTimeout(() => setStatus(null), 2000)
      })
      .catch(() => { setSaving(false); setStatus({ type: 'error', text: 'Network error.' }) })
  }

  return (
    <Section title="Send behaviour" subtitle="Default behaviour when you click Send on a message.">
      <Radio value="immediate" current={behaviour} onChange={setBehaviour}
        title="Send immediately"
        desc="Messages go out as soon as you click Send. Fastest workflow." />
      <Radio value="confirm" current={behaviour} onChange={setBehaviour}
        title="Require confirmation"
        desc="A small confirm dialog appears for every Send. Helps avoid mis-sends." />
      <Radio value="preview" current={behaviour} onChange={setBehaviour}
        title="Always preview"
        desc="Opens a full preview of the message before sending. Best for high-stakes outreach." />
      <SaveRow status={status} disabled={saving} onSave={handleSave} label={saving ? 'Saving…' : 'Save'} />
    </Section>
  )
}

// ─── SECTION 6: Account snapshot (read-only) ─────────────────────────────────
function AccountSnapshotSection({ me }) {
  return (
    <Section title="Account" subtitle="Read-only — contact your director for changes.">
      <Row label="Workspace" value={me.workspace_name || '—'} />
      <Row label="Role" value={prettyRole(me.role)} />
      <Row label="Joined" value={formatDate(me.created_at)} />
      <Row label="Last sign-in" value={me.last_login_at ? formatDateTime(me.last_login_at) : 'Never'} />
    </Section>
  )
}

// ─── SHARED LAYOUT ───────────────────────────────────────────────────────────
function PageShell({ title, children, onClose }) {
  return (
    <div style={{ minHeight: '100vh', background: '#faf9f7', padding: '0 0 60px' }}>
      <div style={{
        background: '#fff', borderBottom: '0.5px solid #e8e5dc',
        padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 12,
      }}>
        {onClose && (
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 13, color: '#6e6a63', padding: '4px 8px',
          }}>← Back</button>
        )}
        <div style={{ fontSize: 15, fontWeight: 600, color: '#14130f' }}>{title}</div>
      </div>
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px 24px' }}>
        {children}
      </div>
    </div>
  )
}

function Section({ title, subtitle, children }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 12, border: '0.5px solid #e8e5dc',
      padding: 24, marginBottom: 16,
    }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: '#14130f', marginBottom: 4 }}>{title}</div>
      {subtitle && <div style={{ fontSize: 12, color: '#9a958c', lineHeight: 1.5, marginBottom: 18 }}>{subtitle}</div>}
      {children}
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: '#9a958c', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '0.5px solid #f5f3ef' }}>
      <span style={{ fontSize: 12, color: '#6e6a63' }}>{label}</span>
      <span style={{ fontSize: 13, color: '#14130f' }}>{value}</span>
    </div>
  )
}

function Radio({ value, current, onChange, title, desc }) {
  const selected = value === current
  return (
    <label style={{
      display: 'flex', alignItems: 'flex-start', gap: 12,
      padding: 14, marginBottom: 8,
      border: selected ? '0.5px solid #534ab7' : '0.5px solid #e8e5dc',
      background: selected ? '#f5f3ff' : '#fff',
      borderRadius: 10, cursor: 'pointer', transition: 'all 0.15s',
    }}>
      <input type="radio" checked={selected} onChange={() => onChange(value)} style={{ marginTop: 3, accentColor: '#534ab7' }} />
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, color: '#14130f' }}>{title}</div>
        <div style={{ fontSize: 11, color: '#6e6a63', marginTop: 2, lineHeight: 1.5 }}>{desc}</div>
      </div>
    </label>
  )
}

function SaveRow({ status, disabled, onSave, label, secondaryAction, secondaryLabel }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
      <button onClick={onSave} disabled={disabled} style={{
        padding: '9px 16px',
        background: disabled ? '#9a958c' : '#14134a',
        border: 'none', borderRadius: 8,
        fontSize: 12, fontWeight: 500, color: '#fff',
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}>{label}</button>
      {secondaryAction && (
        <button onClick={secondaryAction} style={btnSecondaryStyle}>{secondaryLabel}</button>
      )}
      {status && (
        <span style={{ fontSize: 12, color: status.type === 'ok' ? '#16a34a' : '#dc2626' }}>
          {status.type === 'ok' ? '✓ ' : ''}{status.text}
        </span>
      )}
    </div>
  )
}

function ErrorBanner({ children }) {
  return (
    <div style={{
      background: '#fef2f2', border: '0.5px solid #fecaca', borderRadius: 8,
      padding: '12px 16px', fontSize: 13, color: '#991b1b',
    }}>{children}</div>
  )
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function prettyRole(role) {
  const map = { super_admin: 'Super admin', director: 'Director', agent: 'Agent' }
  return map[role] || role || '—'
}

function formatDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('en-SG', { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatDateTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('en-SG', { dateStyle: 'medium', timeStyle: 'short' })
}

// ─── STYLES ──────────────────────────────────────────────────────────────────
const inputStyle = {
  width: '100%', padding: '10px 12px',
  border: '0.5px solid #dcd8d0', borderRadius: 8,
  background: '#fff',
  fontSize: 13, color: '#14130f',
  outline: 'none', boxSizing: 'border-box',
  fontFamily: 'inherit',
}

const readOnlyStyle = {
  padding: '10px 12px',
  background: '#faf9f7', border: '0.5px solid #e8e5dc', borderRadius: 8,
  fontSize: 13, color: '#4a4742',
}

const btnSecondaryStyle = {
  padding: '8px 14px',
  background: '#fff', border: '0.5px solid #dcd8d0', borderRadius: 8,
  fontSize: 12, fontWeight: 500, color: '#4a4742', cursor: 'pointer',
}