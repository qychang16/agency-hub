import { useState } from 'react'
import { useWorkspace } from '../../../context/WorkspaceContext'
import { ACCENT, ACCENT_LIGHT, ACCENT_MID, NAVY } from '../../../utils/constants'

export default function AgencyProfile() {
  const { workspace, updateWorkspace } = useWorkspace()
  const [form, setForm] = useState({
    name: workspace?.name || '',
    email: workspace?.email || '',
    phone: workspace?.phone || '',
    address: workspace?.address || '',
    registration: workspace?.registration || '',
    timezone: workspace?.timezone || 'Asia/Singapore',
    website: workspace?.website || '',
  })
  const [saved, setSaved] = useState(false)

  function handleSave() {
    updateWorkspace(form)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div style={{ padding: 28, maxWidth: 680 }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: '#111827', marginBottom: 4 }}>Agency Profile</div>
        <div style={{ fontSize: 12, color: '#9ca3af' }}>This information appears on system emails and reports sent to candidates and clients.</div>
      </div>

      {/* Logo */}
      <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e5e7eb', padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Agency Logo</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 72, height: 72, borderRadius: 14, background: NAVY, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
            {form.name?.[0] || 'T'}
          </div>
          <div>
            <button style={{ padding: '7px 14px', background: ACCENT_LIGHT, border: `1px solid ${ACCENT_MID}`, borderRadius: 7, fontSize: 12, color: ACCENT, cursor: 'pointer', fontWeight: 500, marginBottom: 6, display: 'block' }}>
              Upload Logo
            </button>
            <div style={{ fontSize: 11, color: '#9ca3af' }}>PNG or JPG. Max 2MB. Recommended 200×200px.</div>
          </div>
        </div>
      </div>

      {/* Basic info */}
      <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e5e7eb', padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Basic Information</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {[
            { key: 'name', label: 'Agency Name', placeholder: 'e.g. Eque Pte. Ltd.', required: true },
            { key: 'registration', label: 'Registration Number', placeholder: 'e.g. 202012345A' },
            { key: 'email', label: 'Business Email', placeholder: 'contact@yourcompany.com', type: 'email' },
            { key: 'phone', label: 'Business Phone', placeholder: '+65 6123 4567' },
            { key: 'website', label: 'Website', placeholder: 'https://yourcompany.com' },
            { key: 'timezone', label: 'Timezone', type: 'select', options: [
              'Asia/Singapore', 'Asia/Kuala_Lumpur', 'Asia/Jakarta',
              'Asia/Manila', 'Asia/Bangkok', 'Asia/Ho_Chi_Minh',
              'Asia/Hong_Kong', 'Asia/Tokyo', 'Asia/Seoul',
              'Asia/Kolkata', 'Europe/London', 'America/New_York'
            ]},
          ].map(field => (
            <div key={field.key}>
              <label style={{ fontSize: 11, fontWeight: 500, color: '#6b7280', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                {field.label} {field.required && <span style={{ color: '#ef4444' }}>*</span>}
              </label>
              {field.type === 'select' ? (
                <select value={form[field.key]} onChange={e => setForm(p => ({ ...p, [field.key]: e.target.value }))}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12, background: '#f9fafb', color: '#111827', outline: 'none' }}>
                  {field.options.map(o => <option key={o} value={o}>{o.replace('_', ' ')}</option>)}
                </select>
              ) : (
                <input type={field.type || 'text'} value={form[field.key]} onChange={e => setForm(p => ({ ...p, [field.key]: e.target.value }))}
                  placeholder={field.placeholder}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12, background: '#f9fafb', color: '#111827', outline: 'none', boxSizing: 'border-box' }} />
              )}
            </div>
          ))}
        </div>
        <div style={{ marginTop: 14 }}>
          <label style={{ fontSize: 11, fontWeight: 500, color: '#6b7280', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Office Address</label>
          <textarea value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))}
            placeholder="e.g. 1 Raffles Place, #20-01, One Raffles Place, Singapore 048616"
            rows={2}
            style={{ width: '100%', padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12, background: '#f9fafb', color: '#111827', outline: 'none', resize: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
        </div>
      </div>

      {/* Save */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={handleSave}
          style={{ padding: '10px 24px', background: ACCENT, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          Save Changes
        </button>
        {saved && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#16a34a' }}>
            <span>✓</span> Saved successfully
          </div>
        )}
      </div>
    </div>
  )
}