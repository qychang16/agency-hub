import { useState } from 'react'
import { useWorkspace } from '../../../context/WorkspaceContext'
import { ACCENT, ACCENT_LIGHT, NAVY } from '../../../utils/constants'

export default function WhatsAppAPI() {
  const { workspace, updateWorkspace, agents } = useWorkspace()
  const [phoneNumbers, setPhoneNumbers] = useState([
    { id: 1, number: '+6591234567', display_name: 'Main Line', is_primary: true, connected: false, status: 'active', team: 'recruitment', daily_limit: 1000 }
  ])
  const [showAddNumber, setShowAddNumber] = useState(false)
  const [form, setForm] = useState({ number: '', display_name: '', is_primary: false, team: '', daily_limit: 1000 })
  const [apiForm, setApiForm] = useState({ phone_id: workspace?.whatsapp_phone_id || '', token: '', account_id: '' })
  const [saved, setSaved] = useState(false)
  const [showToken, setShowToken] = useState(false)

  function addNumber() {
    if (!form.number.trim() || !form.display_name.trim()) return alert('Number and display name required.')
    setPhoneNumbers(prev => [...prev, { ...form, id: Date.now(), connected: false, status: 'active' }])
    setForm({ number: '', display_name: '', is_primary: false, team: '', daily_limit: 1000 })
    setShowAddNumber(false)
  }

  function removeNumber(id) {
    if (!confirm('Remove this number?')) return
    setPhoneNumbers(prev => prev.filter(p => p.id !== id))
  }

  function setPrimary(id) {
    setPhoneNumbers(prev => prev.map(p => ({ ...p, is_primary: p.id === id })))
  }

  return (
    <div style={{ padding: 28, maxWidth: 720 }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: '#111827', marginBottom: 4 }}>WhatsApp API</div>
        <div style={{ fontSize: 12, color: '#9ca3af' }}>Connect your Meta WhatsApp Business API. Each phone number is independent with its own routing and limits.</div>
      </div>

      {/* Connection status */}
      <div style={{ background: workspace?.whatsapp_connected ? '#f0fdf4' : '#fffbeb', borderRadius: 12, border: `0.5px solid ${workspace?.whatsapp_connected ? '#86efac' : '#fde68a'}`, padding: 16, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: workspace?.whatsapp_connected ? '#16a34a' : '#d97706', flexShrink: 0 }} />
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: workspace?.whatsapp_connected ? '#16a34a' : '#92400e' }}>
            {workspace?.whatsapp_connected ? 'Connected to Meta WhatsApp API' : 'Not connected — simulation mode active'}
          </div>
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>
            {workspace?.whatsapp_connected ? 'Live messaging enabled.' : 'Connect your Meta API credentials below to enable live messaging.'}
          </div>
        </div>
      </div>

      {/* API Credentials */}
      <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e5e7eb', padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Meta API Credentials</div>
        <div style={{ display: 'grid', gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 500, color: '#6b7280', display: 'block', marginBottom: 5 }}>WhatsApp Business Account ID</label>
            <input value={apiForm.account_id} onChange={e => setApiForm(p => ({ ...p, account_id: e.target.value }))} placeholder="e.g. 123456789012345"
              style={{ width: '100%', padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: 7, fontSize: 12, outline: 'none', background: '#f9fafb', color: '#111827', boxSizing: 'border-box', fontFamily: 'monospace' }} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 500, color: '#6b7280', display: 'block', marginBottom: 5 }}>Phone Number ID</label>
            <input value={apiForm.phone_id} onChange={e => setApiForm(p => ({ ...p, phone_id: e.target.value }))} placeholder="e.g. 987654321098765"
              style={{ width: '100%', padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: 7, fontSize: 12, outline: 'none', background: '#f9fafb', color: '#111827', boxSizing: 'border-box', fontFamily: 'monospace' }} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 500, color: '#6b7280', display: 'block', marginBottom: 5 }}>Permanent Access Token</label>
            <div style={{ position: 'relative' }}>
              <input type={showToken ? 'text' : 'password'} value={apiForm.token} onChange={e => setApiForm(p => ({ ...p, token: e.target.value }))} placeholder="EAAxxxxxxxxxx..."
                style={{ width: '100%', padding: '8px 36px 8px 10px', border: '1px solid #e5e7eb', borderRadius: 7, fontSize: 12, outline: 'none', background: '#f9fafb', color: '#111827', boxSizing: 'border-box', fontFamily: 'monospace' }} />
              <button onClick={() => setShowToken(!showToken)} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 11 }}>
                {showToken ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>
        </div>
        <div style={{ marginTop: 14, padding: '10px 12px', background: '#f9fafb', borderRadius: 7, fontSize: 11, color: '#6b7280' }}>
          📋 Your token is encrypted and stored securely. Never share it with anyone outside your organisation.
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <button onClick={() => alert('Test connection — requires live Meta API')}
            style={{ padding: '8px 16px', border: '1px solid #e5e7eb', borderRadius: 7, fontSize: 12, background: '#fff', color: '#374151', cursor: 'pointer', fontWeight: 500 }}>
            Test Connection
          </button>
          <button onClick={() => { updateWorkspace({ whatsapp_phone_id: apiForm.phone_id, whatsapp_token: apiForm.token }); setSaved(true); setTimeout(() => setSaved(false), 3000) }}
            style={{ padding: '8px 20px', background: ACCENT, color: '#fff', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            Save Credentials
          </button>
          {saved && <div style={{ fontSize: 12, color: '#16a34a', display: 'flex', alignItems: 'center', gap: 4 }}>✓ Saved</div>}
        </div>
      </div>

      {/* Phone Numbers */}
      <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e5e7eb', overflow: 'hidden', marginBottom: 16 }}>
        <div style={{ padding: '14px 18px', borderBottom: '0.5px solid #f1f4f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>Phone Numbers</div>
            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>Each number has its own inbox, routing and daily message limits.</div>
          </div>
          <button onClick={() => setShowAddNumber(true)}
            style={{ padding: '6px 14px', background: ACCENT_LIGHT, border: `1px solid #bfdbfe`, borderRadius: 7, fontSize: 12, color: ACCENT, cursor: 'pointer', fontWeight: 500 }}>
            + Add Number
          </button>
        </div>
        {phoneNumbers.map(pn => (
          <div key={pn.id} style={{ padding: '14px 18px', borderBottom: '0.5px solid #f9fafb', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: pn.is_primary ? NAVY : '#f1f4f9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={pn.is_primary ? '#fff' : '#9ca3af'} strokeWidth="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.68A2 2 0 012.18 1h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 8.15a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 15.92z"/></svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', fontFamily: 'monospace' }}>{pn.number}</div>
                {pn.is_primary && <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: NAVY, color: '#fff', fontWeight: 600 }}>PRIMARY</span>}
                <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: pn.connected ? '#dcfce7' : '#fef3c7', color: pn.connected ? '#16a34a' : '#92400e', fontWeight: 600 }}>
                  {pn.connected ? 'Connected' : 'Not Connected'}
                </span>
              </div>
              <div style={{ fontSize: 11, color: '#6b7280' }}>{pn.display_name} · {pn.daily_limit.toLocaleString()} msgs/day limit</div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {!pn.is_primary && (
                <button onClick={() => setPrimary(pn.id)}
                  style={{ padding: '4px 10px', border: '0.5px solid #d1d5db', borderRadius: 6, fontSize: 10, background: 'transparent', color: '#374151', cursor: 'pointer' }}>
                  Set Primary
                </button>
              )}
              <button onClick={() => removeNumber(pn.id)}
                style={{ padding: '4px 10px', border: '0.5px solid #fca5a5', borderRadius: 6, fontSize: 10, background: 'transparent', color: '#dc2626', cursor: 'pointer' }}>
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Webhook */}
      <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e5e7eb', padding: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Webhook Configuration</div>
        <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 12 }}>Add this webhook URL to your Meta App Dashboard to receive incoming messages.</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ flex: 1, padding: '8px 12px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 7, fontSize: 12, color: '#374151', fontFamily: 'monospace' }}>
            https://agency-hub-production-e5af.up.railway.app/webhook
          </div>
          <button onClick={() => { navigator.clipboard.writeText('https://agency-hub-production-e5af.up.railway.app/webhook'); alert('Copied!') }}
            style={{ padding: '8px 14px', background: ACCENT_LIGHT, border: `1px solid #bfdbfe`, borderRadius: 7, fontSize: 12, color: ACCENT, cursor: 'pointer', fontWeight: 500, flexShrink: 0 }}>
            Copy
          </button>
        </div>
      </div>

      {/* Add number modal */}
      {showAddNumber && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 80, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 24, width: '100%', maxWidth: 420 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 16 }}>Add Phone Number</div>
            <div style={{ display: 'grid', gap: 12, marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 500, color: '#6b7280', display: 'block', marginBottom: 4 }}>Phone Number (with country code)</label>
                <input value={form.number} onChange={e => setForm(p => ({ ...p, number: e.target.value }))} placeholder="+65 9123 4567"
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: 7, fontSize: 12, outline: 'none', background: '#f9fafb', color: '#111827', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 500, color: '#6b7280', display: 'block', marginBottom: 4 }}>Display Name</label>
                <input value={form.display_name} onChange={e => setForm(p => ({ ...p, display_name: e.target.value }))} placeholder="e.g. Singapore Main Line"
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: 7, fontSize: 12, outline: 'none', background: '#f9fafb', color: '#111827', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 500, color: '#6b7280', display: 'block', marginBottom: 4 }}>Daily Message Limit</label>
                <select value={form.daily_limit} onChange={e => setForm(p => ({ ...p, daily_limit: parseInt(e.target.value) }))}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: 7, fontSize: 12, background: '#f9fafb', color: '#111827', outline: 'none' }}>
                  <option value={250}>250 / day (New number)</option>
                  <option value={1000}>1,000 / day (Tier 1)</option>
                  <option value={10000}>10,000 / day (Tier 2)</option>
                  <option value={100000}>100,000 / day (Tier 3)</option>
                </select>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={form.is_primary} onChange={e => setForm(p => ({ ...p, is_primary: e.target.checked }))} style={{ accentColor: ACCENT }} />
                <span style={{ fontSize: 12, color: '#374151' }}>Set as primary number</span>
              </label>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowAddNumber(false)} style={{ flex: 1, padding: '8px', border: '1px solid #e5e7eb', borderRadius: 7, fontSize: 12, color: '#6b7280', background: '#fff', cursor: 'pointer' }}>Cancel</button>
              <button onClick={addNumber} style={{ flex: 2, padding: '8px', background: ACCENT, color: '#fff', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Add Number</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}