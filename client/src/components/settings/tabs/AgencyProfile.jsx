import { useState, useEffect } from 'react'
import { useAuth } from '../../../context/AuthContext'
import { useWorkspace } from '../../../context/WorkspaceContext'
import { API, ACCENT, ACCENT_LIGHT, NAVY } from '../../../utils/constants'

function Field({ label, hint, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{label}</label>
      {hint && <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 6 }}>{hint}</div>}
      {children}
    </div>
  )
}

function Input({ value, onChange, placeholder, type = 'text', disabled }) {
  return (
    <input type={type} value={value || ''} onChange={onChange} placeholder={placeholder} disabled={disabled}
      style={{ width: '100%', padding: '9px 12px', border: '0.5px solid #e5e7eb', borderRadius: 8, fontSize: 13, outline: 'none', background: disabled ? '#f9fafb' : '#fff', color: '#111827', boxSizing: 'border-box' }} />
  )
}

function Select({ value, onChange, options }) {
  return (
    <select value={value || ''} onChange={onChange}
      style={{ width: '100%', padding: '9px 12px', border: '0.5px solid #e5e7eb', borderRadius: 8, fontSize: 13, outline: 'none', background: '#fff', color: '#111827' }}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

function Card({ children, style }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e5e7eb', padding: 20, marginBottom: 16, ...style }}>
      {children}
    </div>
  )
}

function CardHeader({ title, subtitle }) {
  return (
    <div style={{ marginBottom: 14, paddingBottom: 10, borderBottom: '0.5px solid #f1f4f9' }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>{title}</div>
      {subtitle && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{subtitle}</div>}
    </div>
  )
}

function Btn({ onClick, children, variant = 'primary', disabled }) {
  const variants = {
    primary: { background: ACCENT, color: '#fff', border: 'none' },
    ghost: { background: 'transparent', color: '#6b7280', border: '0.5px solid #e5e7eb' },
  }
  return (
    <button onClick={!disabled ? onClick : undefined}
      style={{ padding: '8px 16px', fontSize: 12, ...variants[variant], borderRadius: 8, cursor: disabled ? 'default' : 'pointer', fontWeight: 500, opacity: disabled ? 0.6 : 1, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      {children}
    </button>
  )
}

const TIMEZONES = [
  { value: 'Asia/Singapore', label: 'Singapore (SGT, UTC+8)' },
  { value: 'Asia/Kuala_Lumpur', label: 'Malaysia (MYT, UTC+8)' },
  { value: 'Asia/Jakarta', label: 'Indonesia WIB (UTC+7)' },
  { value: 'Asia/Makassar', label: 'Indonesia WITA (UTC+8)' },
  { value: 'Asia/Jayapura', label: 'Indonesia WIT (UTC+9)' },
  { value: 'Asia/Manila', label: 'Philippines (PHT, UTC+8)' },
  { value: 'Asia/Bangkok', label: 'Thailand (ICT, UTC+7)' },
  { value: 'Asia/Ho_Chi_Minh', label: 'Vietnam (ICT, UTC+7)' },
  { value: 'Asia/Hong_Kong', label: 'Hong Kong (HKT, UTC+8)' },
  { value: 'Asia/Taipei', label: 'Taiwan (CST, UTC+8)' },
  { value: 'Asia/Tokyo', label: 'Japan (JST, UTC+9)' },
  { value: 'Asia/Seoul', label: 'South Korea (KST, UTC+9)' },
  { value: 'Asia/Shanghai', label: 'China (CST, UTC+8)' },
  { value: 'Asia/Kolkata', label: 'India (IST, UTC+5:30)' },
  { value: 'Asia/Dubai', label: 'UAE (GST, UTC+4)' },
  { value: 'Asia/Riyadh', label: 'Saudi Arabia (AST, UTC+3)' },
  { value: 'Europe/London', label: 'United Kingdom (GMT/BST)' },
  { value: 'America/New_York', label: 'US Eastern (EST/EDT)' },
  { value: 'America/Los_Angeles', label: 'US Pacific (PST/PDT)' },
  { value: 'Australia/Sydney', label: 'Australia Eastern (AEST)' },
]

export default function AgencyProfile() {
  const { token } = useAuth()
  const { workspace, updateWorkspace } = useWorkspace()
  const [form, setForm] = useState({
    name: '', email: '', phone: '', address: '',
    registration_number: '', timezone: 'Asia/Singapore',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (workspace) {
      setForm({
        name: workspace.name || '',
        email: workspace.email || '',
        phone: workspace.phone || '',
        address: workspace.address || '',
        registration_number: workspace.registration_number || '',
        timezone: workspace.timezone || 'Asia/Singapore',
      })
    }
  }, [workspace])

  async function save() {
    if (!form.name.trim()) { setError('Agency name is required'); return }
    setError(''); setSaving(true)
    try {
      const r = await fetch(`${API}/workspace`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify(form)
      })
      if (r.ok) {
        updateWorkspace(form)
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      }
    } catch {
      setError('Failed to save. Please try again.')
    } finally { setSaving(false) }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>Agency Profile</div>
          <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 3 }}>Your agency information displayed across the platform and in client-facing communications</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div>
          <Card>
            <CardHeader title="Basic Information" />
            <Field label="Agency Name" hint="This name appears in the platform header and all outgoing communications">
              <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Eque Pte. Ltd." />
            </Field>
            <Field label="Business Email" hint="Primary contact email for your agency">
              <Input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="info@yourcompany.com.sg" />
            </Field>
            <Field label="Office Phone" hint="Main office number — shown in email signatures if not overridden">
              <Input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="+65 6123 4567" />
            </Field>
            <Field label="UEN / Registration Number" hint="Singapore UEN or business registration number">
              <Input value={form.registration_number} onChange={e => setForm(p => ({ ...p, registration_number: e.target.value }))} placeholder="e.g. 202012345A" />
            </Field>
          </Card>

          <Card>
            <CardHeader title="Platform Plan" subtitle="Your current Tel-Cloud subscription" />
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', background: '#f9fafb', borderRadius: 10, border: '0.5px solid #e5e7eb' }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: NAVY, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>⭐</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', textTransform: 'capitalize' }}>{workspace?.plan || 'Starter'} Plan</div>
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                  {workspace?.billing_exempt ? '✓ Internal workspace — no billing' : 'Manage billing in Billing tab'}
                </div>
              </div>
              {workspace?.billing_exempt && (
                <span style={{ fontSize: 9, padding: '3px 10px', borderRadius: 10, background: '#dcfce7', color: '#16a34a', fontWeight: 700 }}>INTERNAL</span>
              )}
            </div>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader title="Location & Timezone" />
            <Field label="Office Address" hint="Full office address — used in email footers and PDPA records">
              <textarea value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))}
                placeholder={'e.g. Level 12, One Raffles Place\nSingapore 048616'}
                rows={3}
                style={{ width: '100%', padding: '9px 12px', border: '0.5px solid #e5e7eb', borderRadius: 8, fontSize: 13, outline: 'none', background: '#fff', color: '#111827', resize: 'none', fontFamily: 'inherit', boxSizing: 'border-box', lineHeight: 1.5 }} />
            </Field>
            <Field label="Primary Timezone" hint="All timestamps across Tel-Cloud will display in this timezone">
              <Select value={form.timezone} onChange={e => setForm(p => ({ ...p, timezone: e.target.value }))} options={TIMEZONES} />
            </Field>
            <div style={{ padding: '10px 12px', background: '#f9fafb', borderRadius: 8, border: '0.5px solid #e5e7eb', fontSize: 11, color: '#6b7280' }}>
              Current time in selected timezone: <strong>{new Date().toLocaleTimeString('en-GB', { timeZone: form.timezone, hour: '2-digit', minute: '2-digit', hour12: false })}</strong>
            </div>
          </Card>

          <Card>
            <CardHeader title="Agency Logo" subtitle="Displayed in the platform header and PDF exports" />
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14 }}>
              <div style={{ width: 72, height: 72, borderRadius: 14, background: '#f1f4f9', border: '1.5px dashed #d1d5db', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, flexShrink: 0 }}>
                🏢
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 500, color: '#111827', marginBottom: 4 }}>Upload your agency logo</div>
                <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 10, lineHeight: 1.5 }}>PNG or JPG recommended. Min 200×200px. Max 2MB. Square format works best.</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Btn variant="ghost" onClick={() => alert('File upload will be available once storage is configured.')}>Upload Logo</Btn>
                </div>
              </div>
            </div>
            <div style={{ padding: '10px 12px', background: '#fffbeb', borderRadius: 8, border: '0.5px solid #fde68a', fontSize: 11, color: '#92400e', lineHeight: 1.5 }}>
              💡 For best results, use a white or transparent background logo. Avoid text-heavy logos as they may not be legible at small sizes.
            </div>
          </Card>

          <Card>
            <CardHeader title="Workspace ID" subtitle="For technical reference and support" />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input value={workspace?.id || 'Loading…'} readOnly
                style={{ flex: 1, padding: '8px 12px', border: '0.5px solid #e5e7eb', borderRadius: 8, fontSize: 12, background: '#f9fafb', color: '#9ca3af', outline: 'none', fontFamily: 'monospace' }} />
              <Btn variant="ghost" onClick={() => { navigator.clipboard.writeText(workspace?.id || ''); alert('Workspace ID copied') }}>Copy</Btn>
            </div>
          </Card>
        </div>
      </div>

      {error && (
        <div style={{ padding: '10px 14px', background: '#fef2f2', border: '0.5px solid #fecaca', borderRadius: 8, fontSize: 12, color: '#dc2626', marginBottom: 12 }}>
          ⚠ {error}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        {saved && <div style={{ fontSize: 12, color: '#16a34a', display: 'flex', alignItems: 'center', gap: 5 }}>✓ Profile saved successfully</div>}
        <Btn onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Profile'}</Btn>
      </div>
    </div>
  )
}