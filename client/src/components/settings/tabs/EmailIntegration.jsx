import { useState, useEffect } from 'react'
import { useAuth } from '../../../context/AuthContext'
import { useApiSave } from '../../../hooks/useApiSave'
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

function Input({ value, onChange, placeholder, type = 'text', disabled }) {
  return (
    <input type={type} value={value || ''} onChange={onChange} placeholder={placeholder} disabled={disabled}
      style={{ width: '100%', padding: '9px 12px', border: '0.5px solid #dcd8d0', borderRadius: 8, fontSize: 13, outline: 'none', background: disabled ? '#faf9f7' : '#fff', color: '#14130f', boxSizing: 'border-box' }} />
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

function Btn({ onClick, children, variant = 'primary', size = 'md', disabled }) {
  const sizes = { sm: { padding: '5px 12px', fontSize: 11 }, md: { padding: '8px 16px', fontSize: 12 } }
  const variants = {
    primary: { background: ACCENT, color: '#fff', border: 'none' },
    ghost: { background: 'transparent', color: '#6e6a63', border: '0.5px solid #dcd8d0' },
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
  const { token, hasPermission } = useAuth()
  const [form, setForm] = useState({
    sender_name: '',
    reply_to: '',
    send_mode: 'manual',
    blackout_start: '22:00',
    blackout_end: '08:00',
    default_signature: '',
    open_tracking: true,
    bounce_alerts: true,
  })
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)
  const { save: apiSave, saving, error } = useApiSave(token)

  // Outlook connection state remains stubbed — real OAuth requires Azure
  // app credentials and redirect URI setup, which is future work.
  const [connected] = useState(false)
  const [connectedEmail] = useState('')

  // Load settings from backend on mount. The migration backfilled a row for
  // every workspace, so GET always returns a complete object.
  useEffect(() => {
    if (!token) return
    let cancelled = false
    fetch(`${API}/email-settings`, { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.json())
      .then(data => {
        if (cancelled || !data || data.error) return
        setForm({
          sender_name: data.sender_name || '',
          reply_to: data.reply_to || '',
          send_mode: data.send_mode || 'manual',
          blackout_start: data.blackout_start || '22:00',
          blackout_end: data.blackout_end || '08:00',
          default_signature: data.default_signature || '',
          open_tracking: data.open_tracking !== false,  // default true
          bounce_alerts: data.bounce_alerts !== false,
        })
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [token])

  function connectOutlook() {
    alert('Outlook OAuth requires your Azure app credentials to be configured in the server.\n\nSteps:\n1. Register an app in Azure Active Directory under Y.E.C Consultancy\n2. Add Client ID and Client Secret to your Railway environment variables\n3. Return here to connect\n\nThis will be set up when you are ready to go live.')
  }

  async function save() {
    const result = await apiSave(`${API}/email-settings`, { method: 'PATCH', body: form })
    if (!result.ok) return
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function toggle(field) {
    setForm(p => ({ ...p, [field]: !p[field] }))
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 60, color: '#9a958c' }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9a958c" strokeWidth="2" strokeLinecap="round" style={{ marginBottom: 10, animation: 'spin 0.9s linear infinite' }}><path d="M21 12a9 9 0 11-6.219-8.56"/></svg>
        <div style={{ fontSize: 12 }}>Loading email settings…</div>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#14130f' }}>Email Integration</div>
          <div style={{ fontSize: 12, color: '#9a958c', marginTop: 3 }}>Connect Outlook to send confirmation emails alongside WhatsApp messages</div>
        </div>
      </div>

      {/* How it works */}
      <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 12, marginBottom: 20 }}>
        {[
          { iconKey: 'manual', title: 'Manual Scheduled Email', desc: 'Agent reviews conversation, confirms candidate is ready, then manually schedules email at a specific date and time. Full control — nothing sends without agent approval.', tag: 'Primary', tagColor: '#2d2a7a', tagBg: '#eeedf5' },
          { iconKey: 'immediate', title: 'Immediate Send', desc: 'For executive search placements where speed matters. Agent triggers email and it sends straight away. Used for C-suite confirmations and VIP client communications.', tag: 'Executive Search', tagColor: '#92400e', tagBg: '#fef3c7' },
        ].map(m => (
          <div key={m.title} style={{ background: '#fff', borderRadius: 10, border: '0.5px solid #dcd8d0', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              {m.iconKey === 'manual' ? (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ color: m.tagColor }}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              ) : (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ color: m.tagColor }}><polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
              )}
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#14130f' }}>{m.title}</div>
                <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 10, background: m.tagBg, color: m.tagColor, fontWeight: 700 }}>{m.tag}</span>
              </div>
            </div>
            <div style={{ fontSize: 11, color: '#6e6a63', lineHeight: 1.6 }}>{m.desc}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: 16 }}>
        <div>
          {/* Outlook Connection */}
          <Card>
            <CardHeader title="Outlook Connection" subtitle="One company email account for all agents. Each agent uses their own signature." />
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', background: connected ? '#f0fdf4' : '#faf9f7', borderRadius: 10, marginBottom: 14, border: `1px solid ${connected ? '#86efac' : '#dcd8d0'}` }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#9a958c" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#14130f' }}>{connected ? connectedEmail : 'No account connected'}</div>
                <div style={{ fontSize: 11, color: connected ? '#16a34a' : '#9a958c', marginTop: 2 }}>
                  {connected ? '● Outlook connected and ready' : '○ Connect your company Outlook account'}
                </div>
              </div>
              {!connected && (
                <Btn size="sm" onClick={connectOutlook}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                  Connect Outlook
                </Btn>
              )}
            </div>
            <div style={{ background: ACCENT_LIGHT, border: '0.5px solid #dcd8d0', borderRadius: 8, padding: '10px 12px', fontSize: 11, color: '#2d2a7a', lineHeight: 1.6 }}>
              <strong>Privacy:</strong> Tel-Cloud uses OAuth — we never store your Outlook password. Only a secure access token is saved. You can disconnect at any time.
            </div>
          </Card>

          {/* Sender Settings */}
          <Card>
            <CardHeader title="Sender Settings" />
            <Field label="Sender Name" hint="Displayed as the sender name in the candidate's email client">
              <Input value={form.sender_name} onChange={e => setForm(p => ({ ...p, sender_name: e.target.value }))} placeholder="e.g. Eque Recruitment Team" />
            </Field>
            <Field label="Reply-To Address" hint="Where candidate email replies will be directed">
              <Input type="email" value={form.reply_to} onChange={e => setForm(p => ({ ...p, reply_to: e.target.value }))} placeholder="e.g. recruitment@eque.com.sg" />
            </Field>
          </Card>

          {/* Default send mode */}
          <Card>
            <CardHeader title="Default Send Mode" subtitle="Agents can override this per email" />
            {[
              { value: 'manual', label: 'Manual Scheduled', desc: 'Agent sets specific date and time before confirming send' },
              { value: 'immediate', label: 'Immediate Send', desc: 'Email sends right away — used for executive search placements' },
            ].map(m => (
              <div key={m.value} onClick={() => setForm(p => ({ ...p, send_mode: m.value }))}
                style={{ display: 'flex', gap: 10, padding: '10px 12px', borderRadius: 8, border: `1.5px solid ${form.send_mode === m.value ? ACCENT : '#dcd8d0'}`, marginBottom: 8, cursor: 'pointer', background: form.send_mode === m.value ? ACCENT_LIGHT : '#fff' }}>
                <div style={{ width: 16, height: 16, borderRadius: '50%', border: `2px solid ${form.send_mode === m.value ? ACCENT : '#c2bdb3'}`, background: form.send_mode === m.value ? ACCENT : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                  {form.send_mode === m.value && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />}
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#14130f' }}>{m.label}</div>
                  <div style={{ fontSize: 11, color: '#9a958c', marginTop: 2 }}>{m.desc}</div>
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
                <Input type="time" value={form.blackout_start} onChange={e => setForm(p => ({ ...p, blackout_start: e.target.value }))} />
              </Field>
              <Field label="Blackout end">
                <Input type="time" value={form.blackout_end} onChange={e => setForm(p => ({ ...p, blackout_end: e.target.value }))} />
              </Field>
            </div>
            <div style={{ fontSize: 11, color: '#9a958c', padding: '8px 10px', background: '#faf9f7', borderRadius: 7, lineHeight: 1.5 }}>
              Current blackout: <strong>{form.blackout_start} — {form.blackout_end} SGT</strong>. Emails scheduled during this window will send at {form.blackout_end} SGT automatically.
            </div>
          </Card>

          {/* Default signature */}
          <Card>
            <CardHeader title="Default Email Signature" subtitle="Agents can set their own signature in their profile — this is the fallback" />
            <textarea value={form.default_signature} onChange={e => setForm(p => ({ ...p, default_signature: e.target.value }))} rows={7}
              placeholder={'Best regards,\n\n{Agent Name}\n{Role}\n\nEque Pte. Ltd.\nT: +65 6123 4567\nE: recruitment@eque.com.sg\nW: www.eque.com.sg\n\n---\nThis email and any attachments are confidential.'}
              style={{ width: '100%', padding: '10px 12px', border: '0.5px solid #dcd8d0', borderRadius: 8, fontSize: 12, outline: 'none', background: '#fff', color: '#14130f', resize: 'none', fontFamily: 'inherit', boxSizing: 'border-box', lineHeight: 1.6 }} />
            <div style={{ fontSize: 11, color: '#9a958c', marginTop: 6 }}>
              Use <code style={{ background: '#f5f3ef', padding: '1px 5px', borderRadius: 3 }}>{'{Agent Name}'}</code> and <code style={{ background: '#f5f3ef', padding: '1px 5px', borderRadius: 3 }}>{'{Role}'}</code> — auto-filled from each agent's profile
            </div>
          </Card>

          {/* Email tracking */}
          <Card>
            <CardHeader title="Email Tracking" subtitle="Know when candidates open your emails" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {[
                { field: 'open_tracking', label: 'Open tracking', hint: 'Know when candidate opens the email', locked: false },
                { field: 'bounce_alerts', label: 'Bounce alerts', hint: 'Alert agent if email fails to deliver', locked: false },
                { field: null, label: 'Unsubscribe footer', hint: 'Required by law in Singapore — auto-added', locked: true, alwaysOn: true },
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '0.5px solid #faf9f7' }}>
                  <div>
                    <div style={{ fontSize: 13, color: '#14130f', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
                      {item.label}
                      {item.locked && <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: '#f5f3ef', color: '#9a958c', fontWeight: 600 }}>REQUIRED</span>}
                    </div>
                    <div style={{ fontSize: 11, color: '#9a958c', marginTop: 2 }}>{item.hint}</div>
                  </div>
                  <button onClick={() => item.field && toggle(item.field)} disabled={item.locked}
                    style={{ width: 44, height: 24, borderRadius: 12, border: 'none', background: (item.alwaysOn || form[item.field]) ? ACCENT : '#c2bdb3', cursor: item.locked ? 'not-allowed' : 'pointer', position: 'relative' }}>
                    <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: (item.alwaysOn || form[item.field]) ? 23 : 3 }} />
                  </button>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {error && (
        <div style={{ padding: '10px 14px', background: '#fef2f2', border: '0.5px solid #fecaca', borderRadius: 8, fontSize: 12, color: '#dc2626', marginBottom: 12 }}>
          {error}
        </div>
      )}

      {hasPermission('manage_workspace_settings') && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          {saved && <div style={{ fontSize: 12, color: '#16a34a', display: 'flex', alignItems: 'center', gap: 5 }}>✓ Email settings saved</div>}
          <Btn onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Email Settings'}</Btn>
        </div>
      )}
    </div>
  )
}