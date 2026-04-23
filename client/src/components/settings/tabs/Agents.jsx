import { useState, useEffect } from 'react'
import { useAuth } from '../../../context/AuthContext'
import { API } from '../../../utils/constants'
import { ACCENT, ACCENT_LIGHT, ACCENT_MID, NAVY } from '../../../utils/designTokens'
import { getRoleColor, getRoleLabel } from '../../../utils/permissions'

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

function Btn({ onClick, children, variant = 'primary', size = 'md', disabled, style: extra }) {
  const sizes = { sm: { padding: '5px 10px', fontSize: 11 }, md: { padding: '8px 14px', fontSize: 12 } }
  const variants = {
    primary: { background: ACCENT, color: '#fff', border: 'none' },
    ghost: { background: 'transparent', color: '#6e6a63', border: '0.5px solid #dcd8d0' },
    danger: { background: '#fee2e2', color: '#dc2626', border: '0.5px solid #fca5a5' },
    success: { background: '#dcfce7', color: '#16a34a', border: '0.5px solid #86efac' },
    dark: { background: NAVY, color: '#fff', border: 'none' },
  }
  return (
    <button onClick={!disabled ? onClick : undefined}
      style={{ ...sizes[size], ...variants[variant], borderRadius: 8, cursor: disabled ? 'default' : 'pointer', fontWeight: 500, opacity: disabled ? 0.6 : 1, display: 'inline-flex', alignItems: 'center', gap: 5, ...extra }}>
      {children}
    </button>
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
  const [saving, setSaving] = useState(false)
  const categories = [...new Set(PERMISSIONS_LIST.map(p => p.category))]

  function toggle(key) {
    setPerms(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])
  }

  function resetToRole() {
    if (!confirm(`Reset to ${getRoleLabel(agent.role)} defaults? All custom permissions will be lost.`)) return
    setPerms(ROLE_DEFAULTS[agent.role] || [])
  }

  async function save() {
    setSaving(true)
    try {
      await fetch(`${API}/agents/${agent.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ ...agent, permissions: perms })
      })
      onSave()
      onClose()
    } catch {} finally { setSaving(false) }
  }

  const isCustomised = JSON.stringify([...perms].sort()) !== JSON.stringify([...(ROLE_DEFAULTS[agent.role] || [])].sort())

  return (
    <Modal title={`Permissions — ${agent.name}`} subtitle={`Base role: ${getRoleLabel(agent.role)}${isCustomised ? ' · ⚠ Customised' : ' · Using role defaults'}`} onClose={onClose} width={580}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, padding: '10px 12px', background: isCustomised ? '#fffbeb' : '#faf9f7', borderRadius: 8, border: `0.5px solid ${isCustomised ? '#fde68a' : '#dcd8d0'}` }}>
        <div style={{ fontSize: 12, color: isCustomised ? '#92400e' : '#6e6a63' }}>
          {perms.length} of {PERMISSIONS_LIST.length} permissions enabled
          {isCustomised && ' · Custom permissions active'}
        </div>
        <Btn variant="ghost" size="sm" onClick={resetToRole}>↺ Reset to role defaults</Btn>
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

      <div style={{ display: 'flex', gap: 10, paddingTop: 12, borderTop: '0.5px solid #f5f3ef', position: 'sticky', bottom: 0, background: '#fff' }}>
        <Btn variant="ghost" onClick={onClose} style={{ flex: 1 }}>Cancel</Btn>
        <Btn onClick={save} disabled={saving} style={{ flex: 2 }}>{saving ? 'Saving…' : 'Save Permissions'}</Btn>
      </div>
    </Modal>
  )
}

// ─── AGENT FORM MODAL ──────────────────────────────────────────────────────────
function AgentModal({ agent, teams, onClose, onSave }) {
  const { token } = useAuth()
  const [form, setForm] = useState({
    name: agent?.name || '',
    email: agent?.email || '',
    role: agent?.role || 'consultant',
    team_id: agent?.team_id || '',
    capacity: agent?.capacity || 20,
    password: 'Welcome@123',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const isEdit = !!agent

  async function save() {
    setError('')
    if (!form.name.trim()) { setError('Name is required'); return }
    if (!form.email.trim() || !/\S+@\S+\.\S+/.test(form.email)) { setError('Valid email is required'); return }
    if (!isEdit && !form.password.trim()) { setError('Temporary password is required'); return }
    setSaving(true)
    try {
      const url = isEdit ? `${API}/agents/${agent.id}` : `${API}/agents`
      const method = isEdit ? 'PATCH' : 'POST'
      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify(form)
      })
      if (!r.ok) {
        const d = await r.json()
        setError(d.error || 'Failed to save')
        return
      }
      onSave()
      onClose()
    } catch {
      setError('Failed to save. Please try again.')
    } finally { setSaving(false) }
  }

  return (
    <Modal title={isEdit ? `Edit Agent — ${agent.name}` : 'Add New Agent'} subtitle={isEdit ? 'Update agent details and role' : 'Agent will receive login credentials'} onClose={onClose}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Full Name">
          <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Sarah Lim" />
        </Field>
        <Field label="Email Address">
          <Input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="sarah@company.com" disabled={isEdit} />
        </Field>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Role">
          <Select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))} options={ROLE_OPTIONS} />
        </Field>
        <Field label="Team">
          <Select value={form.team_id} onChange={e => setForm(p => ({ ...p, team_id: e.target.value }))} options={[{ value: '', label: 'No team assigned' }, ...teams.map(t => ({ value: t.id, label: t.name }))]} />
        </Field>
      </div>
      <Field label="Max Conversation Capacity" hint="Maximum open conversations this agent handles at once">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <input type="range" min={1} max={100} value={form.capacity} onChange={e => setForm(p => ({ ...p, capacity: parseInt(e.target.value) }))}
            style={{ flex: 1, accentColor: ACCENT }} />
          <div style={{ fontSize: 15, fontWeight: 700, color: '#14130f', minWidth: 32, textAlign: 'center' }}>{form.capacity}</div>
        </div>
      </Field>
      {!isEdit && (
        <Field label="Temporary Password" hint="Agent will be prompted to change this on first login">
          <div style={{ position: 'relative' }}>
            <Input type={showPassword ? 'text' : 'password'} value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} placeholder="Temporary password" />
            <button onClick={() => setShowPassword(!showPassword)} type="button"
              style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', color: '#9a958c', fontSize: 14 }}>
              {showPassword ? '🙈' : '👁'}
            </button>
          </div>
        </Field>
      )}
      {error && (
        <div style={{ padding: '10px 12px', background: '#fef2f2', border: '0.5px solid #fecaca', borderRadius: 8, fontSize: 12, color: '#dc2626', marginBottom: 12 }}>
          ⚠ {error}
        </div>
      )}
      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <Btn variant="ghost" onClick={onClose} style={{ flex: 1 }}>Cancel</Btn>
        <Btn onClick={save} disabled={saving} style={{ flex: 2 }}>{saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Agent'}</Btn>
      </div>
    </Modal>
  )
}

// ─── RESET PASSWORD MODAL ──────────────────────────────────────────────────────
function ResetPasswordModal({ agent, onClose }) {
  const { token } = useAuth()
  const [password, setPassword] = useState('Welcome@123')
  const [showPassword, setShowPassword] = useState(false)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  async function save() {
    if (!password.trim()) return
    setSaving(true)
    try {
      await fetch(`${API}/agents/${agent.id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ password })
      })
      setDone(true)
      setTimeout(() => onClose(), 2000)
    } catch {} finally { setSaving(false) }
  }

  return (
    <Modal title={`Reset Password — ${agent.name}`} subtitle="Agent will be required to change on next login" onClose={onClose} width={420}>
      {done ? (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>✅</div>
          <div style={{ fontSize: 14, fontWeight: 500, color: '#16a34a' }}>Password reset successfully</div>
          <div style={{ fontSize: 12, color: '#9a958c', marginTop: 6 }}>Agent will be prompted to change on next login</div>
        </div>
      ) : (
        <>
          <Field label="New Temporary Password">
            <div style={{ position: 'relative' }}>
              <Input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter temporary password" />
              <button onClick={() => setShowPassword(!showPassword)} type="button"
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', color: '#9a958c', fontSize: 14 }}>
                {showPassword ? '🙈' : '👁'}
              </button>
            </div>
          </Field>
          <div style={{ padding: '10px 12px', background: '#fef3c7', border: '0.5px solid #fde68a', borderRadius: 8, fontSize: 11, color: '#92400e', marginBottom: 16, lineHeight: 1.5 }}>
            ⚠️ Send the temporary password to <strong>{agent.name}</strong> via a secure channel. They must change it on first login.
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <Btn variant="ghost" onClick={onClose} style={{ flex: 1 }}>Cancel</Btn>
            <Btn onClick={save} disabled={saving} style={{ flex: 2 }}>{saving ? 'Resetting…' : 'Reset Password'}</Btn>
          </div>
        </>
      )}
    </Modal>
  )
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

  useEffect(() => { load() }, [])

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
    await fetch(`${API}/agents/${agent.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ ...agent, active: !agent.active })
    })
    load()
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
        {hasPermission('manage_staff') && <Btn onClick={() => setShowAdd(true)}>+ Add Agent</Btn>}
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
          <div style={{ fontSize: 28, marginBottom: 10 }}>⏳</div>
          <div>Loading agents…</div>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #dcd8d0', padding: '60px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>👥</div>
          <div style={{ fontSize: 13, fontWeight: 500, color: '#6e6a63', marginBottom: 4 }}>No agents found</div>
          <div style={{ fontSize: 12, color: '#9a958c' }}>Try adjusting your search or filters</div>
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #dcd8d0', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
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
                      {hasPermission('manage_staff') && <Btn variant="ghost" size="sm" onClick={() => setShowEdit(a)}>Edit</Btn>}
                      {hasPermission('manage_staff') && <Btn variant="ghost" size="sm" onClick={() => setShowReset(a)}>Reset PW</Btn>}
                      {hasPermission('manage_staff') && a.id !== user?.id && !a.is_super_admin && (
                        <Btn variant={a.active ? 'danger' : 'success'} size="sm" onClick={() => {
                          if (!confirm(`${a.active ? 'Deactivate' : 'Reactivate'} ${a.name}?`)) return
                          toggleActive(a)
                        }}>
                          {a.active ? 'Deactivate' : 'Reactivate'}
                        </Btn>
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
      {showAdd && <AgentModal teams={teams} onClose={() => setShowAdd(false)} onSave={load} />}
      {showEdit && <AgentModal agent={showEdit} teams={teams} onClose={() => setShowEdit(null)} onSave={load} />}
      {showReset && <ResetPasswordModal agent={showReset} onClose={() => setShowReset(null)} />}
      {showPermissions && <PermissionsModal agent={showPermissions} onClose={() => setShowPermissions(null)} onSave={load} />}
    </div>
  )
}