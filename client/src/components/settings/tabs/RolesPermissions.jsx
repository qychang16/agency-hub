import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../../../context/AuthContext'
import { API } from '../../../utils/constants'
import { ACCENT, NAVY } from '../../../utils/designTokens'

// Permission catalog - must match backend DEFAULT_ROLE_PERMISSIONS keys
const PERMISSIONS = [
  { key: 'send_messages',             label: 'Send messages',                category: 'Messaging',      desc: 'Reply to candidates and clients via WhatsApp' },
  { key: 'write_notes',               label: 'Write internal notes',         category: 'Messaging',      desc: 'Add private notes to conversations (not sent to contact)' },
  { key: 'manage_conversations',      label: 'Manage conversations',         category: 'Messaging',      desc: 'Assign, resolve, reopen, pin messages, move to projects' },
  { key: 'manage_contacts',           label: 'Manage contacts',              category: 'Contacts',       desc: 'Create, edit, delete candidate and client records' },
  { key: 'manage_projects',           label: 'Manage projects',              category: 'Projects',       desc: 'Create, edit, delete projects; bulk assign conversations' },
  { key: 'manage_project_members',    label: 'Manage project members',       category: 'Projects',       desc: 'Add or remove team members from a project; change lead/member' },
  { key: 'manage_templates',          label: 'Manage templates',             category: 'Communication',  desc: 'Create, edit, delete WhatsApp message templates' },
  { key: 'manage_scheduled_messages', label: 'Schedule and broadcasts',      category: 'Communication',  desc: 'Schedule messages, send broadcasts, create calendar invites' },
  { key: 'manage_quick_replies',      label: 'Quick replies',                category: 'Communication',  desc: 'Create and edit saved reply shortcuts' },
  { key: 'manage_phone_numbers',      label: 'Phone numbers',                category: 'Configuration',  desc: 'Add, edit, delete WhatsApp phone lines' },
  { key: 'manage_teams',              label: 'Teams',                        category: 'Configuration',  desc: 'Create, edit, delete teams and their members' },
  { key: 'manage_workspace_settings', label: 'Workspace settings',           category: 'Configuration',  desc: 'Workspace info, business hours, routing rules, security' },
  { key: 'manage_staff',              label: 'Staff accounts',               category: 'Configuration',  desc: 'Add, edit, deactivate staff and reset passwords' },
  { key: 'manage_role_permissions',   label: 'Role permissions (this page)', category: 'Admin',          desc: 'Access to this Roles and Permissions page' },
]

const CATEGORIES = ['Messaging', 'Contacts', 'Projects', 'Communication', 'Configuration', 'Admin']

const ROLE_META = {
  director:          { label: 'Director',          desc: 'Workspace owner. Always has full access.',                 color: '#8b5cf6' },
  manager:           { label: 'Manager',           desc: 'Workspace-wide operational manager.',                      color: '#2563eb' },
  supervisor:        { label: 'Supervisor',        desc: 'Oversees a set of projects and consultants.',              color: '#0891b2' },
  senior_consultant: { label: 'Senior Consultant', desc: 'Experienced consultant with mentoring responsibilities.',  color: '#059669' },
  consultant:        { label: 'Consultant',        desc: 'Day-to-day candidate and client engagement.',              color: '#65a30d' },
  admin:             { label: 'Admin',             desc: 'Back-office oversight role. Read-only by default.',        color: '#d97706' },
}

function Btn({ onClick, children, variant = 'primary', size = 'md', disabled }) {
  const sizes = { sm: { padding: '5px 12px', fontSize: 11 }, md: { padding: '8px 16px', fontSize: 12 }, lg: { padding: '10px 20px', fontSize: 13 } }
  const variants = {
    primary: { background: ACCENT, color: '#fff', border: 'none' },
    ghost: { background: 'transparent', color: '#6e6a63', border: '0.5px solid #dcd8d0' },
    danger: { background: '#fee2e2', color: '#dc2626', border: '0.5px solid #fca5a5' },
    dark: { background: NAVY, color: '#fff', border: 'none' },
  }
  return (
    <button onClick={!disabled ? onClick : undefined} disabled={disabled}
      style={{ ...sizes[size], ...variants[variant], borderRadius: 8, cursor: disabled ? 'default' : 'pointer', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 6, opacity: disabled ? 0.6 : 1, transition: 'opacity .15s' }}>
      {children}
    </button>
  )
}

function Toggle({ value, onChange, disabled }) {
  return (
    <button onClick={() => !disabled && onChange(!value)} disabled={disabled}
      style={{ width: 36, height: 20, borderRadius: 10, border: 'none', background: value ? ACCENT : '#c2bdb3', cursor: disabled ? 'default' : 'pointer', position: 'relative', transition: 'background .2s', flexShrink: 0, opacity: disabled ? 0.5 : 1 }}>
      <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: value ? 19 : 3, transition: 'left .2s', boxShadow: '0 1px 2px rgba(0,0,0,0.2)' }} />
    </button>
  )
}

function RoleCard({ role, config, onChange, expanded, onToggleExpand, locked, dirty }) {
  const meta = ROLE_META[role] || { label: role, desc: '', color: '#6e6a63' }
  const permCount = Object.values(config.permissions).filter(Boolean).length
  const totalPerms = PERMISSIONS.length

  return (
    <div style={{ border: dirty ? '1px solid ' + ACCENT : '0.5px solid #dcd8d0', borderRadius: 12, marginBottom: 10, background: '#fff', overflow: 'hidden', transition: 'border-color .15s' }}>
      <div onClick={!locked ? onToggleExpand : undefined}
        style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: locked ? 'default' : 'pointer', background: expanded ? '#faf9f7' : '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: meta.color }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#14130f', display: 'flex', alignItems: 'center', gap: 8 }}>
              {meta.label}
              {locked && <span style={{ fontSize: 10, fontWeight: 500, color: '#9a958c', padding: '2px 6px', background: '#f3f4f6', borderRadius: 4 }}>LOCKED</span>}
              {dirty && <span style={{ fontSize: 10, fontWeight: 500, color: ACCENT, padding: '2px 6px', background: '#eeedf5', borderRadius: 4 }}>UNSAVED</span>}
            </div>
            <div style={{ fontSize: 11, color: '#6e6a63', marginTop: 2 }}>{meta.desc}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 11, color: '#6e6a63' }}>
          <div>Scope: <strong style={{ color: '#4a4742' }}>{config.scope === 'workspace_wide' ? 'Workspace-wide' : 'Project only'}</strong></div>
          <div>{permCount} / {totalPerms} permissions</div>
          {!locked && <div style={{ fontSize: 14, color: '#9a958c' }}>{expanded ? 'v' : '>'}</div>}
        </div>
      </div>

      {expanded && !locked && (
        <div style={{ padding: '0 16px 16px 16px', borderTop: '0.5px solid #f5f3ef' }}>
          <div style={{ marginTop: 16, padding: 12, background: '#faf9f7', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#4a4742' }}>Visibility scope:</div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#4a4742', cursor: 'pointer' }}>
              <input type="radio" checked={config.scope === 'project_only'} onChange={() => onChange({ ...config, scope: 'project_only' })} />
              Project only
              <span style={{ fontSize: 10, color: '#9a958c', marginLeft: 4 }}>(sees only assigned projects)</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#4a4742', cursor: 'pointer' }}>
              <input type="radio" checked={config.scope === 'workspace_wide'} onChange={() => onChange({ ...config, scope: 'workspace_wide' })} />
              Workspace-wide
              <span style={{ fontSize: 10, color: '#9a958c', marginLeft: 4 }}>(sees everything)</span>
            </label>
          </div>

          {CATEGORIES.map(cat => {
            const permsInCat = PERMISSIONS.filter(p => p.category === cat)
            if (!permsInCat.length) return null
            return (
              <div key={cat} style={{ marginTop: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#6e6a63', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>{cat}</div>
                {permsInCat.map(p => (
                  <div key={p.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '0.5px solid #faf9f7' }}>
                    <div style={{ flex: 1, paddingRight: 12 }}>
                      <div style={{ fontSize: 12, color: '#14130f', fontWeight: 500 }}>{p.label}</div>
                      <div style={{ fontSize: 10, color: '#9a958c', marginTop: 2 }}>{p.desc}</div>
                    </div>
                    <Toggle
                      value={config.permissions[p.key] === true}
                      onChange={v => onChange({ ...config, permissions: { ...config.permissions, [p.key]: v } })}
                    />
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      )}

      {locked && (
        <div style={{ padding: '0 16px 14px 16px', fontSize: 11, color: '#6e6a63' }}>
          Director always has workspace-wide access and all permissions. This cannot be changed.
        </div>
      )}
    </div>
  )
}

export default function RolesPermissions({ workspaceId, workspaceName }) {
  const { token } = useAuth()
  const isSuperAdminMode = typeof workspaceId === 'number'

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [roles, setRoles] = useState([])
  const [localRoles, setLocalRoles] = useState([])
  const [expanded, setExpanded] = useState({})
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState(null)
  const [resetOpen, setResetOpen] = useState(false)

  const baseUrl = isSuperAdminMode
    ? API + '/admin/workspaces/' + workspaceId + '/role-permissions'
    : API + '/role-permissions'

  async function loadRoles() {
    setLoading(true); setError(null)
    try {
      const res = await fetch(baseUrl, { headers: { Authorization: 'Bearer ' + token } })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        if (res.status === 403) {
          setError("You don't have permission to view this page.")
        } else {
          setError(body.error || 'Failed to load (HTTP ' + res.status + ')')
        }
        setRoles([]); setLocalRoles([])
        return
      }
      const data = await res.json()
      setRoles(data.roles)
      setLocalRoles(JSON.parse(JSON.stringify(data.roles)))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadRoles() /* eslint-disable-next-line */ }, [workspaceId])

  const dirtyRoles = useMemo(() => {
    const dirty = new Set()
    for (const r of localRoles) {
      if (r.locked) continue
      const original = roles.find(o => o.role === r.role)
      if (!original) continue
      if (r.scope !== original.scope) { dirty.add(r.role); continue }
      for (const key of Object.keys(r.permissions)) {
        if (r.permissions[key] !== original.permissions[key]) { dirty.add(r.role); break }
      }
    }
    return dirty
  }, [roles, localRoles])

  const hasUnsavedChanges = dirtyRoles.size > 0

  function updateRole(roleName, newConfig) {
    setLocalRoles(prev => prev.map(r => r.role === roleName ? { ...r, ...newConfig } : r))
  }

  async function saveChanges() {
    if (!hasUnsavedChanges) return
    setSaving(true); setSaveMessage(null); setError(null)

    const errors = []
    for (const roleName of dirtyRoles) {
      const r = localRoles.find(x => x.role === roleName)
      if (!r) continue
      const url = isSuperAdminMode
        ? API + '/admin/workspaces/' + workspaceId + '/role-permissions/' + roleName
        : API + '/role-permissions/' + roleName
      try {
        const res = await fetch(url, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
          body: JSON.stringify({ scope: r.scope, permissions: r.permissions }),
        })
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          errors.push(roleName + ': ' + (body.error || res.status))
        }
      } catch (err) {
        errors.push(roleName + ': ' + err.message)
      }
    }

    setSaving(false)
    if (errors.length) {
      setError('Some roles failed to save:\n' + errors.join('\n'))
      await loadRoles()
    } else {
      setSaveMessage('Saved successfully.')
      await loadRoles()
      setTimeout(() => setSaveMessage(null), 3000)
    }
  }

  function discardChanges() {
    setLocalRoles(JSON.parse(JSON.stringify(roles)))
    setSaveMessage(null); setError(null)
  }

  async function resetToDefaults() {
    setSaving(true); setSaveMessage(null); setError(null)
    const url = isSuperAdminMode
      ? API + '/admin/workspaces/' + workspaceId + '/role-permissions/reset'
      : API + '/role-permissions/reset'
    try {
      const res = await fetch(url, { method: 'POST', headers: { Authorization: 'Bearer ' + token } })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.error || 'Reset failed (HTTP ' + res.status + ')')
      } else {
        setSaveMessage('Reset to defaults.')
        await loadRoles()
        setTimeout(() => setSaveMessage(null), 3000)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false); setResetOpen(false)
    }
  }

  if (loading) {
    return <div style={{ padding: 20, color: '#6e6a63', fontSize: 13 }}>Loading roles and permissions...</div>
  }
  if (error && !roles.length) {
    return (
      <div style={{ padding: 20 }}>
        <div style={{ padding: 16, background: '#fef2f2', border: '0.5px solid #fecaca', borderRadius: 8, color: '#991b1b', fontSize: 13, whiteSpace: 'pre-wrap' }}>{error}</div>
      </div>
    )
  }

  return (
    <div style={{ padding: 20, maxWidth: 900 }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: '#14130f' }}>
          Roles and Permissions
          {isSuperAdminMode && workspaceName && (
            <span style={{ fontSize: 12, fontWeight: 500, color: '#6e6a63', marginLeft: 8 }}>
              - Editing <strong>{workspaceName}</strong>
            </span>
          )}
        </div>
        <div style={{ fontSize: 12, color: '#6e6a63', marginTop: 4 }}>
          Configure what each role can do in your workspace. Director always has full access.
        </div>
      </div>

      {error && roles.length > 0 && (
        <div style={{ padding: 12, background: '#fef2f2', border: '0.5px solid #fecaca', borderRadius: 8, color: '#991b1b', fontSize: 12, marginBottom: 16, whiteSpace: 'pre-wrap' }}>{error}</div>
      )}

      {saveMessage && (
        <div style={{ padding: 12, background: '#f0fdf4', border: '0.5px solid #bbf7d0', borderRadius: 8, color: '#14532d', fontSize: 12, marginBottom: 16 }}>{saveMessage}</div>
      )}

      {localRoles.map(r => (
        <RoleCard
          key={r.role}
          role={r.role}
          config={r}
          onChange={updated => updateRole(r.role, updated)}
          expanded={expanded[r.role] === true}
          onToggleExpand={() => setExpanded(prev => ({ ...prev, [r.role]: !prev[r.role] }))}
          locked={r.locked}
          dirty={dirtyRoles.has(r.role)}
        />
      ))}

      <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderTop: '0.5px solid #dcd8d0' }}>
        <div>
          <Btn variant="ghost" size="sm" onClick={() => setResetOpen(true)} disabled={saving}>
            Reset to defaults
          </Btn>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {hasUnsavedChanges && (
            <div style={{ fontSize: 11, color: ACCENT, fontWeight: 500 }}>
              {dirtyRoles.size} {dirtyRoles.size === 1 ? 'role has' : 'roles have'} unsaved changes
            </div>
          )}
          <Btn variant="ghost" size="md" onClick={discardChanges} disabled={!hasUnsavedChanges || saving}>
            Discard
          </Btn>
          <Btn variant="primary" size="md" onClick={saveChanges} disabled={!hasUnsavedChanges || saving}>
            {saving ? 'Saving...' : 'Save changes'}
          </Btn>
        </div>
      </div>

      {resetOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) setResetOpen(false) }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 20, width: '100%', maxWidth: 420 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#14130f' }}>Reset to defaults?</div>
            <div style={{ fontSize: 12, color: '#6e6a63', marginTop: 8, lineHeight: 1.5 }}>
              This will restore all role permissions to their default values. Any customizations you have made will be lost.
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
              <Btn variant="ghost" onClick={() => setResetOpen(false)} disabled={saving}>Cancel</Btn>
              <Btn variant="danger" onClick={resetToDefaults} disabled={saving}>{saving ? 'Resetting...' : 'Reset'}</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}