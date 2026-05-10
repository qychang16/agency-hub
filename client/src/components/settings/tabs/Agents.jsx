import { useState, useEffect } from 'react'
import { useAuth } from '../../../context/AuthContext'
import { useApiSave } from '../../../hooks/useApiSave'
import { API } from '../../../utils/constants'
import { ACCENT, ACCENT_LIGHT, ACCENT_MID, NAVY } from '../../../utils/designTokens'
import { getRoleColor, getRoleLabel } from '../../../utils/permissions'
import Button from '../../ui/Button'
import PasswordStrengthMeter from '../../auth/PasswordStrengthMeter'
import CredentialsRevealModal from '../../auth/CredentialsRevealModal'
import { validatePassword } from '../../../utils/passwordPolicy'

const ROLE_OPTIONS = [
  { value: 'director', label: 'Director' },
  { value: 'manager', label: 'Manager' },
  { value: 'senior_consultant', label: 'Senior Consultant' },
  { value: 'consultant', label: 'Consultant' },
  { value: 'admin', label: 'Admin' },
  { value: 'viewer', label: 'Viewer' },
]

const PERMISSIONS_LIST = [
  { key: 'view_all_conversations', label: 'View all conversations', category: 'Conversations' },
  { key: 'view_team_conversations', label: 'View team conversations', category: 'Conversations' },
  { key: 'view_own_conversations', label: 'View own conversations', category: 'Conversations' },
  { key: 'send_messages', label: 'Send messages', category: 'Conversations' },
  { key: 'send_any_template', label: 'Use any template', category: 'Templates' },
  { key: 'send_approved_templates', label: 'Use approved templates only', category: 'Templates' },
  { key: 'create_templates', label: 'Create templates', category: 'Templates' },
  { key: 'approve_templates', label: 'Approve templates', category: 'Templates' },
  { key: 'send_broadcasts', label: 'Send broadcasts to all', category: 'Broadcasts' },
  { key: 'send_own_broadcasts', label: 'Send broadcasts to own contacts', category: 'Broadcasts' },
  { key: 'schedule_messages', label: 'Schedule messages', category: 'Scheduled' },
  { key: 'bulk_schedule', label: 'Bulk schedule via CSV', category: 'Scheduled' },
  { key: 'assign_anyone', label: 'Assign to anyone', category: 'Assignment' },
  { key: 'assign_within_team', label: 'Assign within team', category: 'Assignment' },
  { key: 'self_assign', label: 'Self-assign conversations', category: 'Assignment' },
  { key: 'add_contacts', label: 'Add contacts', category: 'Contacts' },
  { key: 'delete_contacts', label: 'Delete contacts', category: 'Contacts' },
  { key: 'import_contacts', label: 'Import contacts via CSV', category: 'Contacts' },
  { key: 'export_contacts', label: 'Export contacts', category: 'Contacts' },
  { key: 'flag_dnc', label: 'Flag Do Not Contact', category: 'Contacts' },
  { key: 'view_all_analytics', label: 'View all analytics', category: 'Analytics' },
  { key: 'view_team_analytics', label: 'View team analytics', category: 'Analytics' },
  { key: 'view_own_analytics', label: 'View own analytics', category: 'Analytics' },
  { key: 'export_reports', label: 'Export reports', category: 'Analytics' },
  { key: 'manage_agents', label: 'Manage agents', category: 'Settings' },
  { key: 'manage_teams', label: 'Manage teams', category: 'Settings' },
  { key: 'manage_routing', label: 'Manage routing rules', category: 'Settings' },
  { key: 'manage_settings', label: 'Full settings access', category: 'Settings' },
  { key: 'reset_passwords', label: 'Reset agent passwords', category: 'Settings' },
  { key: 'manage_pdpa', label: 'Manage PDPA consent', category: 'Compliance' },
  { key: 'view_audit_log', label: 'View audit log', category: 'Compliance' },
  { key: 'manage_billing', label: 'Manage billing', category: 'Billing' },
  { key: 'manage_job_orders', label: 'Manage job orders', category: 'CRM' },
  { key: 'view_pipeline', label: 'View candidate pipeline', category: 'CRM' },
  { key: 'manage_pipeline', label: 'Manage candidate pipeline', category: 'CRM' },
]

const ROLE_DEFAULTS = {
  director: PERMISSIONS_LIST.map(p => p.key),
  manager: ['view_all_conversations','view_team_conversations','view_own_conversations','send_messages','send_any_template','create_templates','approve_templates','send_broadcasts','send_own_broadcasts','schedule_messages','bulk_schedule','assign_anyone','assign_within_team','self_assign','add_contacts','delete_contacts','import_contacts','export_contacts','flag_dnc','view_all_analytics','view_team_analytics','view_own_analytics','export_reports','manage_agents','manage_teams','manage_routing','reset_passwords','manage_pdpa','view_audit_log','manage_job_orders','view_pipeline','manage_pipeline'],
  senior_consultant: ['view_team_conversations','view_own_conversations','send_messages','send_any_template','create_templates','send_own_broadcasts','schedule_messages','assign_within_team','self_assign','add_contacts','import_contacts','export_contacts','flag_dnc','view_team_analytics','view_own_analytics','manage_pdpa','view_pipeline','manage_pipeline','manage_job_orders'],
  consultant: ['view_own_conversations','send_messages','send_approved_templates','self_assign','add_contacts','flag_dnc','view_own_analytics','view_pipeline'],
  admin: ['add_contacts','delete_contacts','import_contacts','export_contacts','flag_dnc','manage_pdpa','view_pipeline'],
  viewer: ['view_all_conversations','view_all_analytics','view_pipeline'],
}

// ─── SHARED UI ─────────────────────────────────────────────────────────────────
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

function Select({ value, onChange, options, disabled }) {
  return (
    <select value={value || ''} onChange={onChange} disabled={disabled}
      style={{ width: '100%', padding: '9px 12px', border: '0.5px solid #dcd8d0', borderRadius: 8, fontSize: 13, outline: 'none', background: disabled ? '#faf9f7' : '#fff', color: '#14130f' }}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

function RoleBadge({ role }) {
  const rc = getRoleColor(role)
  return (
    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: rc.bg, color: rc.color, fontWeight: 600, whiteSpace: 'nowrap' }}>
      {getRoleLabel(role)}
    </span>
  )
}

function StatusDot({ status }) {
  const colors = { online: '#22c55e', away: '#f59e0b', offline: '#9a958c', busy: '#ef4444' }
  return <div style={{ width: 8, height: 8, borderRadius: '50%', background: colors[status] || '#9a958c', flexShrink: 0 }} />
}

function Modal({ title, subtitle, onClose, children, width = 480 }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: width, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ padding: '18px 20px', borderBottom: '0.5px solid #f5f3ef', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#14130f' }}>{title}</div>
            {subtitle && <div style={{ fontSize: 11, color: '#9a958c', marginTop: 2 }}>{subtitle}</div>}
          </div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 7, border: '0.5px solid #dcd8d0', background: '#faf9f7', cursor: 'pointer', fontSize: 14, color: '#6e6a63', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>
        <div style={{ padding: 20 }}>{children}</div>
      </div>
    </div>
  )
}

// ─── PERMISSIONS MODAL ─────────────────────────────────────────────────────────
function PermissionsModal({ agent, onClose, onSave }) {
  const { token } = useAuth()
  const basePerms = ROLE_DEFAULTS[agent.role] || []
  const [perms, setPerms] = useState(agent.permissions || basePerms)
  const { save: apiSave, saving, error } = useApiSave(token)
  const categories = [...new Set(PERMISSIONS_LIST.map(p => p.category))]

  function toggle(key) {
    setPerms(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])
  }

  function resetToRole() {
    if (!confirm(`Reset to ${getRoleLabel(agent.role)} defaults? All custom permissions will be lost.`)) return
    setPerms(ROLE_DEFAULTS[agent.role] || [])
  }

  async function save() {
    const result = await apiSave(`${API}/agents/${agent.id}`, {
      method: 'PATCH',
      body: { ...agent, permissions: perms }
    })
    if (!result.ok) return
    onSave()
    onClose()
  }

  const isCustomised = JSON.stringify([...perms].sort()) !== JSON.stringify([...(ROLE_DEFAULTS[agent.role] || [])].sort())

  return (
    <Modal title={`Permissions — ${agent.name}`} subtitle={`Base role: ${getRoleLabel(agent.role)}${isCustomised ? ' · ⚠ Customised' : ' · Using role defaults'}`} onClose={onClose} width={580}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, padding: '10px 12px', background: isCustomised ? '#fffbeb' : '#faf9f7', borderRadius: 8, border: `0.5px solid ${isCustomised ? '#fde68a' : '#dcd8d0'}` }}>
        <div style={{ fontSize: 12, color: isCustomised ? '#92400e' : '#6e6a63' }}>
          {perms.length} of {PERMISSIONS_LIST.length} permissions enabled
          {isCustomised && ' · Custom permissions active'}
        </div>
        <Button variant="secondary" size="sm" onClick={resetToRole}>↺ Reset to role defaults</Button>
      </div>

      {categories.map(cat => (
        <div key={cat} style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#9a958c', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 8, paddingBottom: 6, borderBottom: '0.5px solid #f5f3ef', display: 'flex', justifyContent: 'space-between' }}>
            <span>{cat}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => {
                const catKeys = PERMISSIONS_LIST.filter(p => p.category === cat).map(p => p.key)
                setPerms(prev => [...new Set([...prev, ...catKeys])])
              }} style={{ fontSize: 9, color: ACCENT, background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 600 }}>All on</button>
              <button onClick={() => {
                const catKeys = PERMISSIONS_LIST.filter(p => p.category === cat).map(p => p.key)
                setPerms(prev => prev.filter(k => !catKeys.includes(k)))
              }} style={{ fontSize: 9, color: '#9a958c', background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 600 }}>All off</button>
            </div>
          </div>
          {PERMISSIONS_LIST.filter(p => p.category === cat).map(p => (
            <div key={p.key} onClick={() => toggle(p.key)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 6px', borderRadius: 6, cursor: 'pointer', transition: 'background .1s' }}
              onMouseEnter={e => e.currentTarget.style.background = '#faf9f7'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <div style={{ width: 16, height: 16, borderRadius: 4, border: `1.5px solid ${perms.includes(p.key) ? ACCENT : '#c2bdb3'}`, background: perms.includes(p.key) ? ACCENT : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all .15s' }}>
                {perms.includes(p.key) && (
                  <svg width="9" height="9" viewBox="0 0 10 10"><path d="M1.5 5l2.5 2.5 5-5" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
                )}
              </div>
              <span style={{ fontSize: 12, color: perms.includes(p.key) ? '#14130f' : '#6e6a63' }}>{p.label}</span>
              {!basePerms.includes(p.key) && perms.includes(p.key) && (
                <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: '#fef3c7', color: '#92400e', fontWeight: 600, marginLeft: 'auto' }}>Added</span>
              )}
              {basePerms.includes(p.key) && !perms.includes(p.key) && (
                <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: '#fee2e2', color: '#dc2626', fontWeight: 600, marginLeft: 'auto' }}>Removed</span>
              )}
            </div>
          ))}
        </div>
      ))}

      {error && (
        <div style={{ padding: '10px 12px', background: '#fef2f2', border: '0.5px solid #fecaca', borderRadius: 8, fontSize: 12, color: '#dc2626', marginBottom: 12 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, paddingTop: 12, borderTop: '0.5px solid #f5f3ef', position: 'sticky', bottom: 0, background: '#fff' }}>
        <Button variant="secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</Button>
        <Button onClick={save} loading={saving} style={{ flex: 2 }}>{saving ? 'Saving...' : 'Save Permissions'}</Button>
      </div>
    </Modal>
  )
}

// ─── AGENT FORM MODAL ──────────────────────────────────────────────────────────
function AgentModal({ agent, teams, onClose, onSave, onCredentialsRevealed }) {
  const { token } = useAuth()
  const isEdit = !!agent
  const [tab, setTab] = useState('invite')

  const [name, setName] = useState(agent?.name || '')
  const [email, setEmail] = useState(agent?.email || '')
  const [role, setRole] = useState(agent?.role || 'consultant')
  const [teamId, setTeamId] = useState(agent?.team_id || '')
  const [capacity, setCapacity] = useState(agent?.capacity || 20)

  const [autoGen, setAutoGen] = useState(true)
  const [password, setPassword] = useState('')
  const [forceChange, setForceChange] = useState(false)

  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  function handleSave() {
    setErrorMessage('')
    if (!name.trim()) { setErrorMessage('Name is required.'); return }
    if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) { setErrorMessage('Valid email is required.'); return }

    if (isEdit) {
      saveEdit()
      return
    }

    if (tab === 'invite') {
      sendInvitation()
    } else {
      createWithCredentials()
    }
  }

  function saveEdit() {
    setSaving(true)
    fetch(`${API}/agents/${agent.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name, email, role, team_id: teamId || null, capacity }),
    })
      .then(r => r.json().then(d => ({ ok: r.ok, data: d })))
      .then(({ ok, data }) => {
        setSaving(false)
        if (!ok) { setErrorMessage(data?.error || 'Could not save changes.'); return }
        if (onSave) onSave()
        onClose()
      })
      .catch(() => { setSaving(false); setErrorMessage('Network error.') })
  }

  function sendInvitation() {
    setSaving(true)
    fetch(`${API}/invitations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ email, name, role, team_id: teamId || null, capacity }),
    })
      .then(r => r.json().then(d => ({ ok: r.ok, data: d })))
      .then(({ ok, data }) => {
        setSaving(false)
        if (!ok) { setErrorMessage(data?.error || 'Could not send invitation.'); return }
        if (onSave) onSave()
        onClose()
      })
      .catch(() => { setSaving(false); setErrorMessage('Network error.') })
  }

  function createWithCredentials() {
    if (!autoGen) {
      const v = validatePassword(password, email)
      if (!v.valid) { setErrorMessage(v.errors[0]); return }
    }

    setSaving(true)
    fetch(`${API}/agents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        name, email, role, team_id: teamId || null, capacity,
        password: autoGen ? null : password,
        force_password_change: forceChange,
      }),
    })
      .then(r => r.json().then(d => ({ ok: r.ok, data: d })))
      .then(({ ok, data }) => {
        setSaving(false)
        if (!ok) { setErrorMessage(data?.error || 'Could not create agent.'); return }
        if (onSave) onSave()
        if (onCredentialsRevealed && data.initial_password) {
          onCredentialsRevealed({
            email,
            password: data.initial_password,
            agentName: name,
            wasAutoGenerated: autoGen,
            actionLabel: 'created',
          })
        }
        onClose()
      })
      .catch(() => { setSaving(false); setErrorMessage('Network error.') })
  }

  return (
    <Modal title={isEdit ? `Edit Agent — ${agent.name}` : 'Add a teammate'} subtitle={isEdit ? 'Update agent details and role' : null} onClose={onClose} width={500}>
      {!isEdit && (
        <div style={{ display: 'flex', gap: 4, marginBottom: 18, borderBottom: '0.5px solid #e8e5dc' }}>
          <TabButton active={tab === 'invite'} onClick={() => setTab('invite')}>Send invitation</TabButton>
          <TabButton active={tab === 'manual'} onClick={() => setTab('manual')}>Set credentials directly</TabButton>
        </div>
      )}

      {!isEdit && tab === 'invite' && (
        <div style={{ fontSize: 12, color: '#9a958c', lineHeight: 1.5, marginTop: -8, marginBottom: 16 }}>
          They'll get an email with a link to set their own password. Link expires in 24 hours.
        </div>
      )}
      {!isEdit && tab === 'manual' && (
        <div style={{ fontSize: 12, color: '#92400e', background: '#fef9ef', padding: '10px 12px', borderRadius: 8, border: '0.5px solid #f5e6c0', lineHeight: 1.5, marginTop: -8, marginBottom: 16 }}>
          ⚠ Use this only when email isn't possible. You'll need to share the password with them yourself.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Full Name">
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Sarah Lim" />
        </Field>
        <Field label="Email Address">
          <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="sarah@company.com" disabled={isEdit} />
        </Field>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Role">
          <Select value={role} onChange={e => setRole(e.target.value)} options={ROLE_OPTIONS} />
        </Field>
        <Field label="Team">
          <Select value={teamId} onChange={e => setTeamId(e.target.value)} options={[{ value: '', label: 'No team assigned' }, ...teams.map(t => ({ value: t.id, label: t.name }))]} />
        </Field>
      </div>

      <Field label="Max Conversation Capacity" hint="Maximum open conversations this agent handles at once">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <input type="range" min={1} max={100} value={capacity} onChange={e => setCapacity(parseInt(e.target.value))} style={{ flex: 1, accentColor: ACCENT }} />
          <div style={{ fontSize: 15, fontWeight: 700, color: '#14130f', minWidth: 32, textAlign: 'center' }}>{capacity}</div>
        </div>
      </Field>

      {!isEdit && tab === 'manual' && (
        <>
          <div style={{ marginTop: 6, marginBottom: 10 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: '#4a4742' }}>
              <input type="checkbox" checked={autoGen} onChange={e => setAutoGen(e.target.checked)} style={{ accentColor: ACCENT }} />
              Generate a random password (recommended)
            </label>
          </div>

          {!autoGen && (
            <Field label="Initial password">
              <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Choose a strong password" />
              <PasswordStrengthMeter password={password} userEmail={email} />
            </Field>
          )}

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: '#4a4742', marginTop: 10 }}>
            <input type="checkbox" checked={forceChange} onChange={e => setForceChange(e.target.checked)} style={{ accentColor: ACCENT }} />
            Require them to change this password on first sign-in
          </label>
        </>
      )}

      {errorMessage && (
        <div style={{ padding: '10px 12px', background: '#fef2f2', border: '0.5px solid #fecaca', borderRadius: 8, fontSize: 12, color: '#991b1b', marginTop: 14, marginBottom: 12, lineHeight: 1.5 }}>
          ⚠ {errorMessage}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <Button variant="secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</Button>
        <Button onClick={handleSave} loading={saving} style={{ flex: 2 }}>
          {saving
            ? 'Working…'
            : isEdit ? 'Save Changes'
            : tab === 'invite' ? 'Send invitation'
            : 'Create Agent'}
        </Button>
      </div>
    </Modal>
  )
}

function TabButton({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      padding: '10px 14px', background: 'none', border: 'none',
      borderBottom: active ? `2px solid ${ACCENT}` : '2px solid transparent',
      marginBottom: -1,
      fontSize: 13, fontWeight: active ? 600 : 500,
      color: active ? '#14130f' : '#6e6a63',
      cursor: 'pointer',
    }}>{children}</button>
  )
}

// ─── RESET PASSWORD MODAL ──────────────────────────────────────────────────────
function ResetPasswordModal({ agent, onClose, onCredentialsRevealed }) {
  const { token } = useAuth()
  const [autoGen, setAutoGen] = useState(true)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  async function save() {
    setErrorMessage('')

    if (!autoGen) {
      const v = validatePassword(password, agent.email)
      if (!v.valid) { setErrorMessage(v.errors[0]); return }
    }

    setSaving(true)
    try {
      const r = await fetch(`${API}/agents/${agent.id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ password: autoGen ? null : password }),
      })
      const data = await r.json()
      setSaving(false)

      if (!r.ok) { setErrorMessage(data?.error || 'Could not reset password.'); return }

      if (onCredentialsRevealed && data.initial_password) {
        onCredentialsRevealed({
          email: agent.email,
          password: data.initial_password,
          agentName: agent.name,
          wasAutoGenerated: autoGen,
          actionLabel: 'reset',
        })
      }
      onClose()
    } catch {
      setSaving(false)
      setErrorMessage('Network error.')
    }
  }

  return (
    <Modal title={`Reset Password — ${agent.name}`} subtitle={`A new password will be set for ${agent.email}`} onClose={onClose} width={460}>
      <div style={{ marginBottom: 14 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: '#4a4742' }}>
          <input type="checkbox" checked={autoGen} onChange={e => setAutoGen(e.target.checked)} style={{ accentColor: ACCENT }} />
          Generate a random password (recommended)
        </label>
      </div>

      {!autoGen && (
        <Field label="New password">
          <div style={{ position: 'relative' }}>
            <Input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Choose a strong password" />
            <button onClick={() => setShowPassword(!showPassword)} type="button"
              style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', color: '#9a958c', fontSize: 14 }}>
              {showPassword ? '🙈' : '👁'}
            </button>
          </div>
          <PasswordStrengthMeter password={password} userEmail={agent.email} />
        </Field>
      )}

      <div style={{ padding: '10px 12px', background: '#fef9ef', border: '0.5px solid #f5e6c0', borderRadius: 8, fontSize: 11, color: '#92400e', marginTop: 6, marginBottom: 16, lineHeight: 1.5 }}>
        ⚠ The new password will be shown to you once after this dialog closes. Send it to <strong>{agent.name}</strong> securely. They'll be required to change it on first sign-in.
      </div>

      {errorMessage && (
        <div style={{ padding: '10px 12px', background: '#fef2f2', border: '0.5px solid #fecaca', borderRadius: 8, fontSize: 12, color: '#dc2626', marginBottom: 12 }}>
          {errorMessage}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10 }}>
        <Button variant="secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</Button>
        <Button onClick={save} loading={saving} style={{ flex: 2 }}>{saving ? 'Resetting...' : 'Reset Password'}</Button>
      </div>
    </Modal>
  )
}

// ─── PENDING INVITATIONS PANEL ─────────────────────────────────────────────────
function PendingInvitationsPanel({ token, onChanged }) {
  const [invitations, setInvitations] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const r = await fetch(`${API}/invitations`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await r.json()
      setInvitations(Array.isArray(data) ? data : [])
    } catch {} finally { setLoading(false) }
  }

  async function resend(inv) {
    if (!confirm(`Resend invitation to ${inv.email}? This generates a new link and invalidates the old one.`)) return
    try {
      const r = await fetch(`${API}/invitations/${inv.id}/resend`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!r.ok) { const d = await r.json().catch(() => ({})); alert(d?.error || 'Could not resend.'); return }
      load()
      if (onChanged) onChanged()
    } catch { alert('Network error.') }
  }

  async function cancel(inv) {
    if (!confirm(`Cancel the invitation to ${inv.email}?`)) return
    try {
      const r = await fetch(`${API}/invitations/${inv.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!r.ok) { const d = await r.json().catch(() => ({})); alert(d?.error || 'Could not cancel.'); return }
      load()
      if (onChanged) onChanged()
    } catch { alert('Network error.') }
  }

  if (loading) return null
  if (invitations.length === 0) return null

  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #dcd8d0', marginBottom: 16, overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', borderBottom: '0.5px solid #f5f3ef', background: '#faf9f7' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#14130f' }}>Pending invitations · {invitations.length}</div>
        <div style={{ fontSize: 11, color: '#9a958c', marginTop: 2 }}>People who haven't accepted their invitation yet</div>
      </div>
      {invitations.map(inv => {
        const expiringSoon = inv.hours_until_expiry != null && inv.hours_until_expiry < 4
        return (
          <div key={inv.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: '0.5px solid #f5f3ef' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#14130f', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                {inv.name || inv.email}
                <RoleBadge role={inv.role} />
                {expiringSoon && <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: '#fef3c7', color: '#92400e', fontWeight: 600 }}>Expiring soon</span>}
              </div>
              <div style={{ fontSize: 11, color: '#9a958c', marginTop: 2 }}>
                {inv.email} · sent {formatRelative(inv.created_at)}{inv.hours_until_expiry != null ? ` · expires in ${formatHours(inv.hours_until_expiry)}` : ''}
              </div>
            </div>
            <Button variant="secondary" size="sm" onClick={() => resend(inv)}>Resend</Button>
            <Button variant="secondary" size="sm" onClick={() => cancel(inv)}>Cancel</Button>
          </div>
        )
      })}
    </div>
  )
}

function formatRelative(iso) {
  if (!iso) return ''
  const diffMs = Date.now() - new Date(iso).getTime()
  const hours = Math.floor(diffMs / 3600000)
  if (hours < 1) return 'just now'
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function formatHours(h) {
  if (h < 1) return '<1h'
  if (h < 24) return `${Math.floor(h)}h`
  const days = Math.floor(h / 24)
  return `${days}d`
}

// ─── MAIN AGENTS COMPONENT ─────────────────────────────────────────────────────
export default function Agents() {
  const { token, user, hasPermission } = useAuth()
  const [agents, setAgents] = useState([])
  const [teams, setTeams] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterRole, setFilterRole] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [showAdd, setShowAdd] = useState(false)
  const [showEdit, setShowEdit] = useState(null)
  const [showReset, setShowReset] = useState(null)
  const [showPermissions, setShowPermissions] = useState(null)
  const [revealedCredentials, setRevealedCredentials] = useState(null)
  const [invitationsRefreshKey, setInvitationsRefreshKey] = useState(0)
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth < 768)

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => { if (!token) return; load() }, [token])

  async function load() {
    try {
      const [a, t] = await Promise.all([
        fetch(`${API}/agents`, { headers: { Authorization: 'Bearer ' + token } }).then(r => r.json()),
        fetch(`${API}/teams`, { headers: { Authorization: 'Bearer ' + token } }).then(r => r.json()),
      ])
      setAgents(Array.isArray(a) ? a : [])
      setTeams(Array.isArray(t) ? t : [])
    } catch {} finally { setLoading(false) }
  }

  async function toggleActive(agent) {
    try {
      const r = await fetch(`${API}/agents/${agent.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ ...agent, active: !agent.active })
      })
      if (!r.ok) {
        let msg = `Server returned ${r.status}`
        try { const d = await r.json(); if (d?.error) msg = d.error } catch {}
        alert('Failed to update agent: ' + msg)
        return
      }
      load()
    } catch (err) {
      alert('Failed to update agent: ' + (err.message || 'unknown error'))
    }
  }

  function handleAgentSaved() {
    load()
    setInvitationsRefreshKey(k => k + 1)
  }

  const filtered = agents.filter(a => {
    const matchSearch = !search || a.name?.toLowerCase().includes(search.toLowerCase()) || a.email?.toLowerCase().includes(search.toLowerCase())
    const matchRole = filterRole === 'all' || a.role === filterRole
    const matchStatus = filterStatus === 'all' || (filterStatus === 'active' ? a.active : !a.active)
    return matchSearch && matchRole && matchStatus
  })

  const activeCount = agents.filter(a => a.active).length
  const onlineCount = agents.filter(a => a.active && a.status === 'online').length

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#14130f' }}>Agents</div>
          <div style={{ fontSize: 12, color: '#9a958c', marginTop: 3 }}>
            {activeCount} active · {onlineCount} online now · {agents.filter(a => !a.active).length} inactive
          </div>
        </div>
        {hasPermission('manage_staff') && <Button onClick={() => setShowAdd(true)}>+ Add Agent</Button>}
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
        {[
          { label: 'Total Agents', value: agents.length, color: NAVY, bg: '#f5f3ef' },
          { label: 'Active', value: activeCount, color: '#16a34a', bg: '#dcfce7' },
          { label: 'Online Now', value: onlineCount, color: ACCENT, bg: ACCENT_LIGHT },
          { label: 'Inactive', value: agents.filter(a => !a.active).length, color: '#9a958c', bg: '#faf9f7' },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', borderRadius: 10, border: '0.5px solid #dcd8d0', padding: '14px 16px' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: '#9a958c', marginTop: 3 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Pending invitations */}
      {hasPermission('manage_staff') && (
        <PendingInvitationsPanel key={invitationsRefreshKey} token={token} onChanged={handleAgentSaved} />
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 12, height: 12, color: '#9a958c', pointerEvents: 'none' }} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="7" cy="7" r="4"/><path d="M10.5 10.5l3 3" strokeLinecap="round"/></svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or email…"
            style={{ width: '100%', padding: '8px 10px 8px 28px', border: '0.5px solid #dcd8d0', borderRadius: 8, fontSize: 12, outline: 'none', background: '#fff', color: '#14130f', boxSizing: 'border-box' }} />
        </div>
        <select value={filterRole} onChange={e => setFilterRole(e.target.value)}
          style={{ padding: '8px 12px', border: '0.5px solid #dcd8d0', borderRadius: 8, fontSize: 12, background: '#fff', color: '#4a4742', outline: 'none' }}>
          <option value="all">All Roles</option>
          {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          style={{ padding: '8px 12px', border: '0.5px solid #dcd8d0', borderRadius: 8, fontSize: 12, background: '#fff', color: '#4a4742', outline: 'none' }}>
          <option value="all">All Status</option>
          <option value="active">Active only</option>
          <option value="inactive">Inactive only</option>
        </select>
      </div>

      {/* Agent table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#9a958c' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#9a958c" strokeWidth="2" strokeLinecap="round" style={{ marginBottom: 10, animation: 'spin 0.9s linear infinite' }}><path d="M21 12a9 9 0 11-6.219-8.56"/></svg>
          <div>Loading agents…</div>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #dcd8d0', padding: '60px 20px', textAlign: 'center' }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#9a958c" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 12 }}><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
          <div style={{ fontSize: 13, fontWeight: 500, color: '#6e6a63', marginBottom: 4 }}>No agents found</div>
          <div style={{ fontSize: 12, color: '#9a958c' }}>Try adjusting your search or filters</div>
        </div>
      ) : isMobile ? (
        // ─── Mobile: card list ───────────────────────────────────────────
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(a => {
            const rc = getRoleColor(a.role)
            return (
              <div key={a.id} style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #dcd8d0', padding: 16, opacity: a.active ? 1 : 0.55 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: rc.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: rc.color, flexShrink: 0 }}>
                    {a.name?.[0]?.toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#14130f', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      {a.name}
                      {a.id === user?.id && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: ACCENT_LIGHT, color: ACCENT, fontWeight: 600 }}>You</span>}
                      {a.is_super_admin && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: '#fef3c7', color: '#92400e', fontWeight: 600 }}>Super Admin</span>}
                    </div>
                    <div style={{ fontSize: 12, color: '#9a958c', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.email}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 12, paddingBottom: 12, borderBottom: '0.5px solid #f5f3ef' }}>
                  <RoleBadge role={a.role} />
                  {a.team_name && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: a.team_color || '#9a958c' }} />
                      <span style={{ fontSize: 11, color: '#4a4742' }}>{a.team_name}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <StatusDot status={a.active ? (a.status || 'offline') : 'offline'} />
                    <span style={{ fontSize: 11, color: '#6e6a63', textTransform: 'capitalize' }}>
                      {!a.active ? 'Inactive' : (a.status || 'offline')}
                    </span>
                  </div>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#9a958c', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                    <span>Capacity</span>
                    <span>{a.capacity}</span>
                  </div>
                  <div style={{ height: 4, background: '#f5f3ef', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.min(100, (a.capacity / 50) * 100)}%`, background: ACCENT, borderRadius: 2 }} />
                  </div>
                </div>

                {hasPermission('manage_staff') && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <Button variant="secondary" size="sm" onClick={() => setShowEdit(a)} style={{ flex: '1 1 auto' }}>Edit</Button>
                    <Button variant="secondary" size="sm" onClick={() => setShowReset(a)} style={{ flex: '1 1 auto' }}>Reset PW</Button>
                    {a.id !== user?.id && !a.is_super_admin && (
                      <Button variant={a.active ? 'danger' : 'success'} size="sm" onClick={() => {
                        if (!confirm(`${a.active ? 'Deactivate' : 'Reactivate'} ${a.name}?`)) return
                        toggleActive(a)
                      }} style={{ flex: '1 1 auto' }}>
                        {a.active ? 'Deactivate' : 'Reactivate'}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        // ─── Desktop: table ─────────────────────────────────────────────
        <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #dcd8d0', overflowX: 'auto', overflowY: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
            <thead>
              <tr style={{ background: '#faf9f7' }}>
                {['Agent', 'Role', 'Team', 'Status', 'Capacity', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', fontSize: 10, fontWeight: 600, color: '#9a958c', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '0.5px solid #f5f3ef', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(a => (
                <tr key={a.id} style={{ borderBottom: '0.5px solid #faf9f7', opacity: a.active ? 1 : 0.55 }}
                  onMouseEnter={e => e.currentTarget.style.background = '#faf9f7'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 34, height: 34, borderRadius: 9, background: getRoleColor(a.role).bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: getRoleColor(a.role).color, flexShrink: 0 }}>
                        {a.name?.[0]?.toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: '#14130f', display: 'flex', alignItems: 'center', gap: 6 }}>
                          {a.name}
                          {a.id === user?.id && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: ACCENT_LIGHT, color: ACCENT, fontWeight: 600 }}>You</span>}
                          {a.is_super_admin && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: '#fef3c7', color: '#92400e', fontWeight: 600 }}>Super Admin</span>}
                        </div>
                        <div style={{ fontSize: 11, color: '#9a958c' }}>{a.email}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '12px 14px' }}><RoleBadge role={a.role} /></td>
                  <td style={{ padding: '12px 14px' }}>
                    {a.team_name ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: a.team_color || '#9a958c' }} />
                        <span style={{ fontSize: 12, color: '#4a4742' }}>{a.team_name}</span>
                      </div>
                    ) : <span style={{ fontSize: 12, color: '#c2bdb3' }}>—</span>}
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <StatusDot status={a.active ? (a.status || 'offline') : 'offline'} />
                      <span style={{ fontSize: 11, color: '#6e6a63', textTransform: 'capitalize' }}>
                        {!a.active ? 'Inactive' : (a.status || 'offline')}
                      </span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, height: 4, background: '#f5f3ef', borderRadius: 2, minWidth: 40, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.min(100, (a.capacity / 50) * 100)}%`, background: ACCENT, borderRadius: 2 }} />
                      </div>
                      <span style={{ fontSize: 11, color: '#6e6a63', minWidth: 20 }}>{a.capacity}</span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {hasPermission('manage_staff') && <Button variant="secondary" size="sm" onClick={() => setShowEdit(a)}>Edit</Button>}
                      {hasPermission('manage_staff') && <Button variant="secondary" size="sm" onClick={() => setShowReset(a)}>Reset PW</Button>}
                      {hasPermission('manage_staff') && a.id !== user?.id && !a.is_super_admin && (
                        <Button variant={a.active ? 'danger' : 'success'} size="sm" onClick={() => {
                          if (!confirm(`${a.active ? 'Deactivate' : 'Reactivate'} ${a.name}?`)) return
                          toggleActive(a)
                        }}>
                          {a.active ? 'Deactivate' : 'Reactivate'}
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      {showAdd && <AgentModal teams={teams} onClose={() => setShowAdd(false)} onSave={handleAgentSaved} onCredentialsRevealed={setRevealedCredentials} />}
      {showEdit && <AgentModal agent={showEdit} teams={teams} onClose={() => setShowEdit(null)} onSave={handleAgentSaved} />}
      {showReset && <ResetPasswordModal agent={showReset} onClose={() => setShowReset(null)} onCredentialsRevealed={setRevealedCredentials} />}
      {showPermissions && <PermissionsModal agent={showPermissions} onClose={() => setShowPermissions(null)} onSave={load} />}
      {revealedCredentials && (
        <CredentialsRevealModal
          {...revealedCredentials}
          onClose={() => setRevealedCredentials(null)}
        />
      )}
    </div>
  )
}