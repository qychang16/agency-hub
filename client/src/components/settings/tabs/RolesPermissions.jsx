import { useState } from 'react'
import { ACCENT, ACCENT_LIGHT, NAVY } from '../../../utils/constants'
import { PERMISSIONS, ROLE_DEFAULTS, ROLES } from '../../../utils/constants'
import { getRoleLabel, getRoleColor } from '../../../utils/permissions'

const ROLE_KEYS = ['director','manager','senior_consultant','consultant','admin','viewer']

export default function RolesPermissions() {
  const [selectedRole, setSelectedRole] = useState('consultant')
  const [permissions, setPermissions] = useState(() => {
    const saved = localStorage.getItem('role_permissions')
    return saved ? JSON.parse(saved) : ROLE_DEFAULTS
  })
  const [saved, setSaved] = useState(false)

  const categories = [...new Set(Object.values(PERMISSIONS).map(p => p.category))]

  function togglePermission(perm) {
    if (selectedRole === 'director') return
    setPermissions(prev => ({
      ...prev,
      [selectedRole]: prev[selectedRole].includes(perm)
        ? prev[selectedRole].filter(p => p !== perm)
        : [...prev[selectedRole], perm]
    }))
  }

  function resetToDefault() {
    setPermissions(prev => ({ ...prev, [selectedRole]: ROLE_DEFAULTS[selectedRole] }))
  }

  function savePermissions() {
    localStorage.setItem('role_permissions', JSON.stringify(permissions))
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div style={{ padding: 28 }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: '#111827', marginBottom: 4 }}>Roles & Permissions</div>
        <div style={{ fontSize: 12, color: '#9ca3af' }}>Customise what each role can access. Director permissions cannot be modified.</div>
      </div>

      <div style={{ display: 'flex', gap: 16, overflow: 'hidden' }}>
        {/* Role selector */}
        <div style={{ width: 180, flexShrink: 0 }}>
          {ROLE_KEYS.map(role => {
            const rc = getRoleColor(role)
            return (
              <button key={role} onClick={() => setSelectedRole(role)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 8, border: `1px solid ${selectedRole === role ? ACCENT : '#e5e7eb'}`, background: selectedRole === role ? ACCENT_LIGHT : '#fff', cursor: 'pointer', marginBottom: 6, textAlign: 'left' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: rc.bg === '#f1f4f9' ? '#9ca3af' : rc.color, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 12, fontWeight: selectedRole === role ? 600 : 400, color: '#374151' }}>{getRoleLabel(role)}</div>
                  <div style={{ fontSize: 10, color: '#9ca3af' }}>{(permissions[role] || []).length} permissions</div>
                </div>
              </button>
            )
          })}
        </div>

        {/* Permissions */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e5e7eb', overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '0.5px solid #f1f4f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{getRoleLabel(selectedRole)}</div>
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{selectedRole === 'director' ? 'All permissions — cannot be modified' : `${(permissions[selectedRole] || []).length} of ${Object.keys(PERMISSIONS).length} permissions enabled`}</div>
              </div>
              {selectedRole !== 'director' && (
                <button onClick={resetToDefault} style={{ padding: '5px 12px', border: '0.5px solid #d1d5db', borderRadius: 6, fontSize: 11, background: 'transparent', color: '#6b7280', cursor: 'pointer' }}>Reset to default</button>
              )}
            </div>
            <div style={{ padding: '16px 18px' }}>
              {categories.map(cat => (
                <div key={cat} style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 10 }}>{cat}</div>
                  {Object.entries(PERMISSIONS).filter(([, v]) => v.category === cat).map(([key, perm]) => {
                    const enabled = selectedRole === 'director' || (permissions[selectedRole] || []).includes(key)
                    return (
                      <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 7, cursor: selectedRole === 'director' ? 'default' : 'pointer', marginBottom: 3, background: enabled ? '#f9fafb' : 'transparent' }}
                        onMouseEnter={e => { if (selectedRole !== 'director') e.currentTarget.style.background = '#f9fafb' }}
                        onMouseLeave={e => { if (!enabled) e.currentTarget.style.background = 'transparent' }}>
                        <input type="checkbox" checked={enabled} onChange={() => togglePermission(key)} disabled={selectedRole === 'director'} style={{ accentColor: ACCENT }} />
                        <span style={{ fontSize: 12, color: enabled ? '#374151' : '#9ca3af' }}>{perm.label}</span>
                      </label>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 20 }}>
        <button onClick={savePermissions} style={{ padding: '10px 24px', background: ACCENT, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Save Permissions</button>
        {saved && <div style={{ fontSize: 12, color: '#16a34a', display: 'flex', alignItems: 'center', gap: 4 }}><span>✓</span> Saved</div>}
      </div>
    </div>
  )
}