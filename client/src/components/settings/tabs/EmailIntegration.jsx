import { useState } from 'react'
import { useAuth } from '../../../context/AuthContext'
import { ACCENT, ACCENT_LIGHT, NAVY } from '../../../utils/designTokens'

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

function Btn({ onClick, children, variant = 'primary', size = 'md', disabled }) {
  const sizes = { sm: { padding: '5px 12px', fontSize: 11 }, md: { padding: '8px 16px', fontSize: 12 } }
  const variants = {
    primary: { background: ACCENT, color: '#fff', border: 'none' },
    ghost: { background: 'transparent', color: '#6b7280', border: '0.5px solid #e5e7eb' },
    danger: { background: '#fee2e2', color: '#dc2626', border: '0.5px solid #fca5a5' },
  }
  return (
    <button onClick={!disabled ? onClick : undefined}
      style={{ ...sizes[size], ...variants[variant], borderRadius: 8, cursor: disabled ? 'default' : 'pointer', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 6, opacity: disabled ? 0.6 : 1 }}>
      {children}
    </button>
  )
}

export default function EmailIntegration() {
  const { user } = useAuth()
  const [connected, setConnected] = useState(false)
  const [connectedEmail, setConnectedEmail] = useState('')
  const [senderName, setSenderName] = useState('')
  const [replyTo, setReplyTo] = useState('')
  const [blackoutStart, setBlackoutStart] = useState('22:00')
  const [blackoutEnd, setBlackoutEnd] = useState('08:00')
  const [defaultSignature, setDefaultSignature] = useState('')
  const [sendMode, setSendMode] = useState('manual')
  const [saved, setSaved] = useState(false)

  function connectOutlook() {
    alert('Outlook OAuth requires your Azure app credentials to be configured in the server.\n\nSteps:\n1. Register an app in Azure Active Directory under Y.E.C Consultancy\n2. Add Client ID and Client Secret to your Railway environment variables\n3. Return here to connect\n\nThis will be set up when you are ready to go live.')
  }

  function disconnect() {
    if (!confirm('Disconnect Outlook? Email sending will be disabled until reconnected.')) return
    setConnected(false)
    setConnectedEmail('')
  }

  function save() {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>Email Integration</div>
          <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 3 }}>Connect Outlook to send confirmation emails alongside WhatsApp messages</div>
        </div>
      </div>

      {/* How it works */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { icon: '📅', title: 'Manual Scheduled Email', desc: 'Agent reviews conversation, confirms candidate is ready, then manually schedules email at a specific date and time. Full control — nothing sends without agent approval.', tag: 'Primary', tagColor: '#1e40af', tagBg: '#dbeafe' },
          { icon: '⚡', title: 'Immediate Send', desc: 'For executive search placements where speed matters. Agent triggers email and it sends straight away. Used for C-suite confirmations and VIP client communications.', tag: 'Executive Search', tagColor: '#92400e', tagBg: '#fef3c7' },
        ].map(m => (
          <div key={m.title} style={{ background: '#fff', borderRadius: 10, border: '0.5px solid #e5e7eb', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <span style={{ fontSize: 24 }}>{m.icon}</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{m.title}</div>
                <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 10, background: m.tagBg, color: m.tagColor, fontWeight: 700 }}>{m.tag}</span>
              </div>
            </div>
            <div style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.6 }}>{m.desc}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div>
          {/* Outlook Connection */}
          <Card>
            <CardHeader title="Outlook Connection" subtitle="One company email account for all agents. Each agent uses their own signature." />
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', background: connected ? '#f0fdf4' : '#f9fafb', borderRadius: 10, marginBottom: 14, border: `1px solid ${connected ? '#86efac' : '#e5e7eb'}` }}>
              <div style={{ fontSize: 36, flexShrink: 0 }}>📧</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{connected ? connectedEmail : 'No account connected'}</div>
                <div style={{ fontSize: 11, color: connected ? '#16a34a' : '#9ca3af', marginTop: 2 }}>
                  {connected ? '● Outlook connected and ready' : '○ Connect your company Outlook account'}
                </div>
              </div>
              {connected ? (
                <Btn variant="danger" size="sm" onClick={disconnect}>Disconnect</Btn>
              ) : (
                <Btn size="sm" onClick={connectOutlook}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                  Connect Outlook
                </Btn>
              )}
            </div>
            <div style={{ background: ACCENT_LIGHT, border: '0.5px solid #bfdbfe', borderRadius: 8, padding: '10px 12px', fontSize: 11, color: '#1e40af', lineHeight: 1.6 }}>
              <strong>Privacy:</strong> Tel-Cloud uses OAuth — we never store your Outlook password.
              Only a secure access token is saved. You can disconnect at any time.
            </div>
          </Card>

          {/* Sender Settings */}
          <Card>
            <CardHeader title="Sender Settings" />
            <Field label="Sender Name" hint="Displayed as the sender name in the candidate's email client">
              <Input value={senderName} onChange={e => setSenderName(e.target.value)} placeholder="e.g. Eque Recruitment Team" />
            </Field>
            <Field label="Reply-To Address" hint="Where candidate email replies will be directed">
              <Input type="email" value={replyTo} onChange={e => setReplyTo(e.target.value)} placeholder="e.g. recruitment@eque.com.sg" />
            </Field>
          </Card>

          {/* Default send mode */}
          <Card>
            <CardHeader title="Default Send Mode" subtitle="Agents can override this per email" />
            {[
              { value: 'manual', label: 'Manual Scheduled', desc: 'Agent sets specific date and time before confirming send' },
              { value: 'immediate', label: 'Immediate Send', desc: 'Email sends right away — used for executive search placements' },
            ].map(m => (
              <div key={m.value} onClick={() => setSendMode(m.value)}
                style={{ display: 'flex', gap: 10, padding: '10px 12px', borderRadius: 8, border: `1.5px solid ${sendMode === m.value ? ACCENT : '#e5e7eb'}`, marginBottom: 8, cursor: 'pointer', background: sendMode === m.value ? ACCENT_LIGHT : '#fff' }}>
                <div style={{ width: 16, height: 16, borderRadius: '50%', border: `2px solid ${sendMode === m.value ? ACCENT : '#d1d5db'}`, background: sendMode === m.value ? ACCENT : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                  {sendMode === m.value && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />}
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#111827' }}>{m.label}</div>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{m.desc}</div>
                </div>
              </div>
            ))}
          </Card>
        </div>

        <div>
          {/* Blackout hours */}
          <Card>
            <CardHeader title="Email Blackout Hours" subtitle="No emails sent during this window — they queue and send after blackout ends" />
            <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
              <Field label="Blackout start">
                <Input type="time" value={blackoutStart} onChange={e => setBlackoutStart(e.target.value)} />
              </Field>
              <Field label="Blackout end">
                <Input type="time" value={blackoutEnd} onChange={e => setBlackoutEnd(e.target.value)} />
              </Field>
            </div>
            <div style={{ fontSize: 11, color: '#9ca3af', padding: '8px 10px', background: '#f9fafb', borderRadius: 7, lineHeight: 1.5 }}>
              Current blackout: <strong>{blackoutStart} – {blackoutEnd} SGT</strong>. Emails scheduled during this window will send at {blackoutEnd} SGT automatically.
            </div>
          </Card>

          {/* Default signature */}
          <Card>
            <CardHeader title="Default Email Signature" subtitle="Agents can set their own signature in their profile — this is the fallback" />
            <textarea value={defaultSignature} onChange={e => setDefaultSignature(e.target.value)} rows={7}
              placeholder={'Best regards,\n\n{Agent Name}\n{Role}\n\nEque Pte. Ltd.\nT: +65 6123 4567\nE: recruitment@eque.com.sg\nW: www.eque.com.sg\n\n---\nThis email and any attachments are confidential.'}
              style={{ width: '100%', padding: '10px 12px', border: '0.5px solid #e5e7eb', borderRadius: 8, fontSize: 12, outline: 'none', background: '#fff', color: '#111827', resize: 'none', fontFamily: 'inherit', boxSizing: 'border-box', lineHeight: 1.6 }} />
            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 6 }}>
              Use <code style={{ background: '#f1f4f9', padding: '1px 5px', borderRadius: 3 }}>{'{Agent Name}'}</code> and <code style={{ background: '#f1f4f9', padding: '1px 5px', borderRadius: 3 }}>{'{Role}'}</code> — auto-filled from each agent's profile
            </div>
          </Card>

          {/* Email tracking */}
          <Card>
            <CardHeader title="Email Tracking" subtitle="Know when candidates open your emails" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {[
                { label: 'Open tracking', hint: 'Know when candidate opens the email', enabled: true },
                { label: 'Bounce alerts', hint: 'Alert agent if email fails to deliver', enabled: true },
                { label: 'Unsubscribe footer', hint: 'Required by law in Singapore — auto-added', enabled: true, locked: true },
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '0.5px solid #f9fafb' }}>
                  <div>
                    <div style={{ fontSize: 13, color: '#111827', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
                      {item.label}
                      {item.locked && <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: '#f1f4f9', color: '#9ca3af', fontWeight: 600 }}>REQUIRED</span>}
                    </div>
                    <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{item.hint}</div>
                  </div>
                  <button disabled={item.locked}
                    style={{ width: 44, height: 24, borderRadius: 12, border: 'none', background: item.enabled ? ACCENT : '#d1d5db', cursor: item.locked ? 'not-allowed' : 'pointer', position: 'relative' }}>
                    <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: item.enabled ? 23 : 3 }} />
                  </button>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        {saved && <div style={{ fontSize: 12, color: '#16a34a', display: 'flex', alignItems: 'center', gap: 5 }}>✓ Saved successfully</div>}
        <Btn onClick={save}>Save Email Settings</Btn>
      </div>
    </div>
  )
}