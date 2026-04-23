import { useState, useEffect } from 'react'
import { useAuth } from '../../../context/AuthContext'
import { useWorkspace } from '../../../context/WorkspaceContext'
import { API } from '../../../utils/constants'
import { ACCENT, ACCENT_LIGHT, NAVY } from '../../../utils/designTokens'

function Field({ label, hint, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: '#4a4742', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{label}</label>
      {hint && <div style={{ fontSize: 11, color: '#9a958c', marginBottom: 6 }}>{hint}</div>}
      {children}
    </div>
  )
}

function Input({ value, onChange, placeholder, type = 'text', disabled, readOnly }) {
  return (
    <input type={type} value={value || ''} onChange={onChange} placeholder={placeholder} disabled={disabled} readOnly={readOnly}
      style={{ width: '100%', padding: '9px 12px', border: '0.5px solid #dcd8d0', borderRadius: 8, fontSize: 13, outline: 'none', background: disabled || readOnly ? '#faf9f7' : '#fff', color: disabled || readOnly ? '#9a958c' : '#14130f', boxSizing: 'border-box', fontFamily: type === 'password' ? 'monospace' : 'inherit' }} />
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

function Btn({ onClick, children, variant = 'primary', size = 'md', disabled, style: extra }) {
  const sizes = { sm: { padding: '5px 10px', fontSize: 11 }, md: { padding: '8px 14px', fontSize: 12 } }
  const variants = {
    primary: { background: ACCENT, color: '#fff', border: 'none' },
    ghost: { background: 'transparent', color: '#6e6a63', border: '0.5px solid #dcd8d0' },
    dark: { background: NAVY, color: '#fff', border: 'none' },
    success: { background: '#dcfce7', color: '#16a34a', border: '0.5px solid #86efac' },
    danger: { background: '#fee2e2', color: '#dc2626', border: '0.5px solid #fca5a5' },
  }
  return (
    <button onClick={!disabled ? onClick : undefined}
      style={{ ...sizes[size], ...variants[variant], borderRadius: 8, cursor: disabled ? 'default' : 'pointer', fontWeight: 500, opacity: disabled ? 0.6 : 1, display: 'inline-flex', alignItems: 'center', gap: 6, ...extra }}>
      {children}
    </button>
  )
}

const SETUP_STEPS = [
  {
    step: 1,
    title: 'Create Meta Business Account',
    desc: 'Go to business.facebook.com and create or verify your business. You will need a Facebook account and a valid business registration.',
    link: 'https://business.facebook.com',
    linkLabel: 'Open Meta Business →',
  },
  {
    step: 2,
    title: 'Apply for WhatsApp Business API',
    desc: 'In Meta Business Manager, navigate to WhatsApp → Get Started. Complete business verification — this may take 1–3 business days.',
    link: null,
  },
  {
    step: 3,
    title: 'Add Your Phone Number',
    desc: 'Add and verify your WhatsApp Business phone number. Note: This number cannot be used on a regular WhatsApp account simultaneously.',
    link: null,
  },
  {
    step: 4,
    title: 'Create a System User',
    desc: 'In Meta Business Manager → System Users, create a new System User with Admin role. Generate a permanent access token with whatsapp_business_messaging and whatsapp_business_management permissions.',
    link: null,
  },
  {
    step: 5,
    title: 'Note Your Credentials',
    desc: 'Copy your WhatsApp Business Account ID (from the WhatsApp section), Phone Number ID (from the phone number settings), and the System User access token.',
    link: null,
  },
  {
    step: 6,
    title: 'Configure Webhook',
    desc: 'In Meta App settings → Webhooks, add your Tel-Cloud webhook URL and verify token shown below. Subscribe to: messages, message_deliveries, message_reads.',
    link: null,
  },
  {
    step: 7,
    title: 'Enter Credentials & Test',
    desc: 'Paste your credentials in the fields on the left, click Save, then Test Connection to verify everything is working.',
    link: null,
  },
]

export default function WhatsAppAPI() {
  const { token } = useAuth()
  const { workspace } = useWorkspace()
  const [form, setForm] = useState({
    whatsapp_account_id: '',
    whatsapp_token: '',
  })
  const [showToken, setShowToken] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [activeStep, setActiveStep] = useState(null)
  const [phoneNumbers, setPhoneNumbers] = useState([])

  const webhookUrl = `${API}/webhook/whatsapp`
  const verifyToken = 'telcloud_webhook_2026'

  useEffect(() => {
    if (workspace) {
      setForm({
        whatsapp_account_id: workspace.whatsapp_account_id || '',
        whatsapp_token: workspace.whatsapp_token || '',
      })
    }
    loadNumbers()
  }, [workspace])

  async function loadNumbers() {
    try {
      const r = await fetch(`${API}/phone-numbers`, { headers: { Authorization: 'Bearer ' + token } })
      const data = await r.json()
      setPhoneNumbers(Array.isArray(data) ? data : [])
    } catch {}
  }

  async function save() {
    setSaving(true)
    try {
      await fetch(`${API}/workspace`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify(form)
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {} finally { setSaving(false) }
  }

  function testConnection() {
    if (!form.whatsapp_account_id || !form.whatsapp_token) {
      setTestResult({ success: false, message: 'Please enter your WhatsApp Business Account ID and API token first.' })
      return
    }
    setTesting(true)
    setTestResult(null)
    setTimeout(() => {
      setTesting(false)
      setTestResult({
        success: false,
        message: 'Connection test requires Meta API to be active. Add your credentials, save, then deploy to Railway for the test to work against the live Meta API endpoint.',
      })
    }, 1500)
  }

  function copyToClipboard(text, label) {
    navigator.clipboard.writeText(text)
    alert(`${label} copied to clipboard`)
  }

  const isConnected = workspace?.whatsapp_connected
  const connectedNumbers = phoneNumbers.filter(n => n.connected)

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#14130f' }}>WhatsApp API</div>
          <div style={{ fontSize: 12, color: '#9a958c', marginTop: 3 }}>
            Connect your Meta WhatsApp Business API to enable live messaging with candidates and clients
          </div>
        </div>
        {/* Connection status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 8, background: isConnected ? '#f0fdf4' : '#faf9f7', border: `0.5px solid ${isConnected ? '#86efac' : '#dcd8d0'}` }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: isConnected ? '#22c55e' : '#9a958c' }} />
          <span style={{ fontSize: 12, fontWeight: 500, color: isConnected ? '#16a34a' : '#9a958c' }}>
            {isConnected ? 'API Connected' : 'Not Connected'}
          </span>
        </div>
      </div>

      {/* Connection summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Phone Numbers', value: phoneNumbers.length, sub: `${connectedNumbers.length} connected`, icon: '📱', color: ACCENT, bg: ACCENT_LIGHT },
          { label: 'API Status', value: isConnected ? 'Live' : 'Offline', sub: isConnected ? 'Receiving messages' : 'No API connection', icon: isConnected ? '✅' : '⚠️', color: isConnected ? '#16a34a' : '#d97706', bg: isConnected ? '#dcfce7' : '#fef3c7' },
          { label: 'Messaging Tier', value: 'Tier 1', sub: 'Up to 1,000 conv/day', icon: '📊', color: '#7c3aed', bg: '#ede9fe' },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', borderRadius: 10, border: '0.5px solid #dcd8d0', padding: '14px 16px', display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{s.icon}</div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 10, color: '#9a958c', marginTop: 1 }}>{s.label}</div>
              <div style={{ fontSize: 10, color: '#6e6a63', marginTop: 1 }}>{s.sub}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Left column */}
        <div>
          {/* API Credentials */}
          <Card>
            <CardHeader title="API Credentials" subtitle="From Meta Business Manager — keep these secure, never share" />

            <Field label="WhatsApp Business Account ID" hint="Found in Meta Business Manager → WhatsApp → Account overview">
              <Input
                value={form.whatsapp_account_id}
                onChange={e => setForm(p => ({ ...p, whatsapp_account_id: e.target.value }))}
                placeholder="e.g. 123456789012345" />
            </Field>

            <Field label="System User Access Token" hint="Permanent token from Meta System User — starts with EAA…">
              <div style={{ position: 'relative' }}>
                <Input
                  type={showToken ? 'text' : 'password'}
                  value={form.whatsapp_token}
                  onChange={e => setForm(p => ({ ...p, whatsapp_token: e.target.value }))}
                  placeholder="EAAxxxxxxxxxxxxxxxx…" />
                <button onClick={() => setShowToken(!showToken)} type="button"
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', color: '#9a958c', fontSize: 14 }}>
                  {showToken ? '🙈' : '👁'}
                </button>
              </div>
            </Field>

            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <Btn variant="ghost" onClick={testConnection} disabled={testing} style={{ flex: 1 }}>
                {testing ? (
                  <>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4"/></svg>
                    Testing…
                  </>
                ) : '🔌 Test Connection'}
              </Btn>
              <Btn onClick={save} disabled={saving} style={{ flex: 1 }}>
                {saving ? 'Saving…' : '💾 Save Credentials'}
              </Btn>
            </div>

            {saved && (
              <div style={{ marginTop: 10, padding: '8px 12px', background: '#f0fdf4', border: '0.5px solid #86efac', borderRadius: 8, fontSize: 12, color: '#16a34a' }}>
                ✓ Credentials saved successfully
              </div>
            )}

            {testResult && (
              <div style={{ marginTop: 10, padding: '10px 12px', background: testResult.success ? '#f0fdf4' : '#fef2f2', border: `0.5px solid ${testResult.success ? '#86efac' : '#fecaca'}`, borderRadius: 8, fontSize: 12, color: testResult.success ? '#16a34a' : '#dc2626', lineHeight: 1.5 }}>
                {testResult.success ? '✅ ' : '⚠️ '}{testResult.message}
              </div>
            )}
          </Card>

          {/* Webhook */}
          <Card>
            <CardHeader title="Webhook Configuration" subtitle="Add these values to Meta Business Manager → App settings → Webhooks" />

            <Field label="Webhook URL" hint="Copy this exact URL into Meta's Callback URL field">
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={webhookUrl} readOnly
                  style={{ flex: 1, padding: '9px 12px', border: '0.5px solid #dcd8d0', borderRadius: 8, fontSize: 11, background: '#faf9f7', color: '#6e6a63', outline: 'none', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis' }} />
                <Btn variant="ghost" size="sm" onClick={() => copyToClipboard(webhookUrl, 'Webhook URL')}>Copy</Btn>
              </div>
            </Field>

            <Field label="Verify Token" hint="Enter this exact value in Meta's Verify Token field">
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={verifyToken} readOnly
                  style={{ flex: 1, padding: '9px 12px', border: '0.5px solid #dcd8d0', borderRadius: 8, fontSize: 11, background: '#faf9f7', color: '#6e6a63', outline: 'none', fontFamily: 'monospace' }} />
                <Btn variant="ghost" size="sm" onClick={() => copyToClipboard(verifyToken, 'Verify Token')}>Copy</Btn>
              </div>
            </Field>

            <div style={{ padding: '10px 12px', background: '#fffbeb', border: '0.5px solid #fde68a', borderRadius: 8, fontSize: 11, color: '#92400e', lineHeight: 1.6 }}>
              <strong>Required webhook subscriptions:</strong> messages · message_deliveries · message_reads · messaging_postbacks
            </div>
          </Card>

          {/* Phone numbers linked */}
          <Card>
            <CardHeader title="Connected Phone Numbers" subtitle="Numbers registered under this WhatsApp Business Account" />
            {phoneNumbers.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px 0', color: '#9a958c' }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>📱</div>
                <div style={{ fontSize: 12 }}>No phone numbers added yet</div>
                <div style={{ fontSize: 11, marginTop: 4 }}>Go to <strong>Phone Numbers</strong> tab to add numbers</div>
              </div>
            ) : (
              phoneNumbers.map(n => (
                <div key={n.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: '#faf9f7', borderRadius: 8, marginBottom: 8, border: '0.5px solid #dcd8d0' }}>
                  <span style={{ fontSize: 20 }}>📱</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#14130f' }}>{n.display_name || n.number}</div>
                    <div style={{ fontSize: 11, color: '#9a958c', fontFamily: 'monospace' }}>{n.number}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {n.is_primary && <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 10, background: '#eeedf5', color: '#2d2a7a', fontWeight: 700 }}>PRIMARY</span>}
                    <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 10, fontWeight: 600, background: n.connected ? '#dcfce7' : '#f5f3ef', color: n.connected ? '#16a34a' : '#9a958c' }}>
                      {n.connected ? '● Connected' : '○ Not connected'}
                    </span>
                    {n.status === 'restricted' && (
                      <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 10, background: '#fee2e2', color: '#dc2626', fontWeight: 600 }}>⚠ Restricted</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </Card>
        </div>

        {/* Right column — Setup guide */}
        <div>
          <Card style={{ marginBottom: 16 }}>
            <CardHeader title="Setup Guide" subtitle="Follow these steps to connect Meta WhatsApp Business API" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {SETUP_STEPS.map((s, i) => {
                const isActive = activeStep === s.step
                return (
                  <div key={s.step}>
                    <div onClick={() => setActiveStep(isActive ? null : s.step)}
                      style={{ display: 'flex', gap: 12, padding: '10px 12px', borderRadius: 8, cursor: 'pointer', background: isActive ? ACCENT_LIGHT : 'transparent', border: `0.5px solid ${isActive ? ACCENT + '40' : 'transparent'}`, transition: 'all .15s' }}
                      onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#faf9f7' }}
                      onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}>
                      <div style={{ width: 26, height: 26, borderRadius: '50%', background: isActive ? ACCENT : NAVY, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{s.step}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: isActive ? ACCENT : '#14130f' }}>{s.title}</div>
                        {isActive && (
                          <div style={{ marginTop: 6 }}>
                            <div style={{ fontSize: 11, color: '#6e6a63', lineHeight: 1.6 }}>{s.desc}</div>
                            {s.link && (
                              <a href={s.link} target="_blank" rel="noopener noreferrer"
                                style={{ fontSize: 11, color: ACCENT, fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 6 }}>
                                {s.linkLabel} ↗
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: '#9a958c' }}>{isActive ? '▲' : '▼'}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>

          {/* Messaging tiers */}
          <Card>
            <CardHeader title="WhatsApp Messaging Tiers" subtitle="Meta automatically upgrades your tier based on volume and quality" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { tier: 'New Number', limit: '250 conversations/day', status: 'Starting point for all new numbers', color: '#9a958c', active: false },
                { tier: 'Tier 1', limit: '1,000 conversations/day', status: 'After sending 250+ conversations', color: '#2563eb', active: true },
                { tier: 'Tier 2', limit: '10,000 conversations/day', status: 'After consistent high volume', color: '#7c3aed', active: false },
                { tier: 'Tier 3', limit: '100,000 conversations/day', status: 'High-volume verified accounts', color: '#16a34a', active: false },
                { tier: 'Unlimited', limit: 'No daily limit', status: 'Applied by Meta for enterprise accounts', color: '#d97706', active: false },
              ].map(t => (
                <div key={t.tier} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 8, background: t.active ? ACCENT_LIGHT : '#faf9f7', border: `0.5px solid ${t.active ? ACCENT + '40' : '#dcd8d0'}` }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: t.color, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#14130f' }}>{t.tier}</span>
                      {t.active && <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 10, background: ACCENT, color: '#fff', fontWeight: 700 }}>CURRENT</span>}
                    </div>
                    <div style={{ fontSize: 11, color: '#6e6a63' }}>{t.limit}</div>
                  </div>
                  <div style={{ fontSize: 10, color: '#9a958c', maxWidth: 120, textAlign: 'right' }}>{t.status}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 12, padding: '10px 12px', background: '#faf9f7', borderRadius: 8, fontSize: 11, color: '#6e6a63', lineHeight: 1.6 }}>
              💡 Tiers upgrade automatically when you maintain high message volume with a good quality rating. Avoid sending to unengaged contacts to keep your rating high.
            </div>
          </Card>

          {/* Important notes */}
          <Card style={{ background: '#fef2f2', border: '0.5px solid #fecaca' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#dc2626', marginBottom: 10 }}>⚠️ Important Notes</div>
            {[
              'A phone number registered with Meta WhatsApp API cannot be used on regular WhatsApp simultaneously.',
              'Never share your API access token. Treat it like a password.',
              'If your number gets restricted by Meta, immediately go to Phone Numbers tab and set your backup number as primary.',
              'Template messages require Meta approval before they can be sent. Allow 24–48 hours for approval.',
              'Free-form messages (replies within 24hr window) do not require templates and have no per-message cost.',
            ].map((note, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, fontSize: 11, color: '#7f1d1d', lineHeight: 1.5 }}>
                <span style={{ flexShrink: 0 }}>•</span>
                <span>{note}</span>
              </div>
            ))}
          </Card>
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
      `}</style>
    </div>
  )
}