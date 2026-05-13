import { useState, useEffect } from 'react'
import { API } from '../../utils/constants'
import { ink, accent, semantic, fonts, textWeight, space, radius, border, shadow } from '../../utils/designTokens'
import { useAuth } from '../../context/AuthContext'
import RolesPermissions from '../settings/tabs/RolesPermissions'

// --- TEL-CLOUD LOGO ---
function TelCloudLogo({ size = 36 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 34 34" fill="none" style={{ filter: 'drop-shadow(0 2px 5px rgba(10, 9, 7, 0.18))', flexShrink: 0 }}>
      <defs>
        <radialGradient id="adm-tc-indigo-ring" cx="11" cy="14" r="11" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#8a87ff"/>
          <stop offset="0.5" stopColor="#3d3a9e"/>
          <stop offset="1" stopColor="#14134a"/>
        </radialGradient>
        <radialGradient id="adm-tc-indigo-hl" cx="10" cy="13" r="4" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.9"/>
          <stop offset="1" stopColor="#ffffff" stopOpacity="0"/>
        </radialGradient>
        <radialGradient id="adm-tc-white-ring" cx="19" cy="14" r="11" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffffff"/>
          <stop offset="0.5" stopColor="#b8b6cf"/>
          <stop offset="1" stopColor="#4a4760"/>
        </radialGradient>
        <radialGradient id="adm-tc-white-hl" cx="18" cy="13" r="4" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffffff" stopOpacity="1"/>
          <stop offset="1" stopColor="#ffffff" stopOpacity="0"/>
        </radialGradient>
      </defs>
      <circle cx="13" cy="17" r="6.5" stroke="url(#adm-tc-indigo-ring)" strokeWidth="2.8" fill="none"/>
      <circle cx="13" cy="17" r="6.5" stroke="url(#adm-tc-indigo-hl)" strokeWidth="2.8" fill="none"/>
      <circle cx="21" cy="17" r="6.5" stroke="url(#adm-tc-white-ring)" strokeWidth="2.8" fill="none"/>
      <circle cx="21" cy="17" r="6.5" stroke="url(#adm-tc-white-hl)" strokeWidth="2.8" fill="none"/>
    </svg>
  )
}

// --- MAIN PANEL ---
export default function AdminPanel() {
  const { user, logout, authHeader, applyImpersonation } = useAuth()
  // Viewport tracking for responsive layout
  const [viewportWidth, setViewportWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024)
  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  const isMobile = viewportWidth < 768
  const [workspaces, setWorkspaces] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showCreate, setShowCreate] = useState(false)
  const [editWs, setEditWs] = useState(null)
  const [newCreds, setNewCreds] = useState(null)
  const [rolesWs, setRolesWs] = useState(null)
  const [impersonateWs, setImpersonateWs] = useState(null)

  async function openInternalWorkspace(workspace) {
    try {
      const response = await fetch(`${API}/admin/workspaces/${workspace.id}/open`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader
        }
      })
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Failed to open workspace' }))
        alert(err.error || 'Failed to open workspace')
        return
      }
      const data = await response.json()
      applyImpersonation(data.token, data.user)
      window.location.href = '/'
    } catch (err) {
      console.error('openInternalWorkspace error:', err)
      alert('Failed to open workspace')
    }
  }
  
  async function fetchWorkspaces() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API}/admin/workspaces`, { headers: authHeader })
      if (!res.ok) throw new Error(`Failed to load workspaces (${res.status})`)
      const data = await res.json()
      setWorkspaces(data)
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }

  useEffect(() => { fetchWorkspaces() }, [])

  const filtered = workspaces.filter(w => {
    if (statusFilter !== 'all' && w.status !== statusFilter) return false
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      return w.name.toLowerCase().includes(q) || (w.slug || '').toLowerCase().includes(q) || (w.registration_number || '').toLowerCase().includes(q)
    }
    return true
  })

  return (
    <div style={{
      minHeight: '100vh',
      background: ink[50],
      padding: `${space[6]}px ${space[8]}px`,
      fontFamily: fonts.body,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: space[6], gap: space[4], flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: space[3] }}>
          <TelCloudLogo size={44} />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: space[2], marginBottom: space[1] }}>
              <div style={{
                fontSize: '10px', color: ink[600], textTransform: 'uppercase',
                letterSpacing: '1.2px', fontWeight: textWeight.semibold,
              }}>Platform Admin</div>
              <div style={{
                padding: '2px 8px', background: accent.DEFAULT, color: '#fff',
                borderRadius: radius.sm, fontSize: '9px', fontWeight: textWeight.semibold,
                letterSpacing: '0.6px',
              }}>SUPER ADMIN</div>
            </div>
            <div style={{
              fontFamily: fonts.display,
              fontSize: '24px', fontWeight: textWeight.bold, color: ink[900],
              letterSpacing: '-0.4px', lineHeight: 1.1,
            }}>Workspaces</div>
            <div style={{ fontSize: '12px', color: ink[600], marginTop: space[1] }}>
              Signed in as <strong style={{ color: ink[700], fontWeight: textWeight.semibold }}>{user?.email}</strong>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: space[2] }}>
          <button
            onClick={() => setShowCreate(true)}
            style={{
              padding: '10px 16px', background: accent.DEFAULT, color: '#fff',
              border: 'none', borderRadius: radius.md, fontSize: '13px',
              fontWeight: textWeight.semibold, fontFamily: fonts.body,
              cursor: 'pointer', letterSpacing: '0.2px', transition: 'background .15s',
            }}
            onMouseEnter={e => e.target.style.background = accent.hover}
            onMouseLeave={e => e.target.style.background = accent.DEFAULT}>
            + Create workspace
          </button>
          <button
            onClick={() => { if (window.confirm('Sign out of Tel-Cloud?')) logout() }}
            style={{
              padding: '10px 14px', background: '#fff', color: ink[700],
              border: `0.5px solid ${ink[300]}`, borderRadius: radius.md,
              fontSize: '13px', fontWeight: textWeight.medium, fontFamily: fonts.body,
              cursor: 'pointer', transition: 'background .15s',
            }}
            onMouseEnter={e => e.target.style.background = ink[100]}
            onMouseLeave={e => e.target.style.background = '#fff'}>
            Sign out
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: space[3], marginBottom: space[4], alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, slug, or UEN..."
          style={{
            flex: 1, minWidth: 240, padding: '10px 14px',
            border: `0.5px solid ${ink[300]}`, borderRadius: radius.md,
            fontSize: '13px', fontFamily: fonts.body, outline: 'none',
            background: '#fff', color: ink[800], transition: 'border-color .15s, box-shadow .15s',
          }}
          onFocus={e => { e.target.style.borderColor = accent.DEFAULT; e.target.style.boxShadow = '0 0 0 3px rgba(45,42,122,0.08)' }}
          onBlur={e => { e.target.style.borderColor = ink[300]; e.target.style.boxShadow = 'none' }}
        />
        <div style={{
          display: 'flex', gap: 2, background: '#fff', padding: 3,
          borderRadius: radius.md, border: `0.5px solid ${ink[300]}`,
        }}>
          {['all', 'active', 'suspended'].map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              style={{
                padding: '6px 14px',
                background: statusFilter === s ? ink[900] : 'transparent',
                color: statusFilter === s ? '#fff' : ink[600],
                border: 'none', borderRadius: radius.sm,
                fontSize: '12px', fontWeight: textWeight.medium,
                fontFamily: fonts.body, cursor: 'pointer', textTransform: 'capitalize',
                transition: 'background .15s, color .15s',
              }}>
              {s}
            </button>
          ))}
        </div>
        <div style={{ fontSize: '12px', color: ink[600] }}>
          {filtered.length} {filtered.length === 1 ? 'workspace' : 'workspaces'}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          padding: '10px 12px', background: semantic.dangerSoft,
          border: `0.5px solid ${semantic.danger}`, borderRadius: radius.md,
          fontSize: '12px', color: semantic.danger, marginBottom: space[4],
          display: 'flex', alignItems: 'center', gap: space[3],
        }}>
          <span style={{ flex: 1 }}>{error}</span>
          <button onClick={fetchWorkspaces} style={{
            padding: '4px 10px', background: semantic.danger, color: '#fff',
            border: 'none', borderRadius: radius.sm, fontSize: '11px',
            fontWeight: textWeight.medium, cursor: 'pointer',
          }}>Retry</button>
        </div>
      )}

      {/* Loading / Empty / Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: ink[500], fontSize: '13px' }}>Loading workspaces...</div>
      ) : filtered.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: 60, background: '#fff',
          borderRadius: radius.lg, border: `0.5px dashed ${ink[300]}`,
        }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={ink[500]} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: space[2] }}>
            <rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4"/>
            <path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/>
            <path d="M12 10h.01"/><path d="M12 14h.01"/>
            <path d="M16 10h.01"/><path d="M16 14h.01"/>
            <path d="M8 10h.01"/><path d="M8 14h.01"/>
          </svg>
          <div style={{
            fontFamily: fonts.display, fontSize: '15px', fontWeight: textWeight.semibold,
            color: ink[800], marginBottom: space[1],
          }}>No workspaces yet</div>
          <div style={{ fontSize: '12px', color: ink[600], marginBottom: space[4] }}>Create your first workspace to get started</div>
          <button onClick={() => setShowCreate(true)} style={{
            padding: '8px 16px', background: accent.DEFAULT, color: '#fff',
            border: 'none', borderRadius: radius.md, fontSize: '12px',
            fontWeight: textWeight.semibold, fontFamily: fonts.body, cursor: 'pointer',
          }}>+ Create workspace</button>
        </div>
      ) : (
        isMobile ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: space[3] }}>
            {filtered.map(w => (
              <div key={w.id} style={{
                background: '#fff', borderRadius: radius.lg,
                border: `0.5px solid ${ink[300]}`, boxShadow: shadow.subtle,
                padding: space[4], display: 'flex', flexDirection: 'column', gap: space[3],
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: space[2], marginBottom: space[1] }}>
                    <div style={{ fontWeight: textWeight.semibold, color: ink[900], fontSize: '14px' }}>{w.name}</div>
                    <span style={{
                      padding: '2px 7px', background: accent.soft, color: accent.DEFAULT,
                      borderRadius: radius.sm, fontSize: '10px', fontWeight: textWeight.semibold,
                      textTransform: 'uppercase', letterSpacing: '0.4px',
                    }}>{w.plan}</span>
                    {w.billing_exempt && <span style={{
                      padding: '2px 7px', background: semantic.successSoft, color: semantic.success,
                      borderRadius: radius.sm, fontSize: '10px', fontWeight: textWeight.semibold,
                    }}>Free</span>}
                    <span style={{
                      padding: '2px 9px',
                      background: w.status === 'active' ? semantic.successSoft : w.status === 'suspended' ? semantic.dangerSoft : ink[200],
                      color: w.status === 'active' ? semantic.success : w.status === 'suspended' ? semantic.danger : ink[600],
                      borderRadius: radius.pill, fontSize: '10px',
                      fontWeight: textWeight.semibold, textTransform: 'capitalize',
                    }}>{w.status}</span>
                  </div>
                  <div style={{ fontFamily: fonts.mono, fontSize: '12px', color: ink[600] }}>{w.slug}</div>
                  {w.registration_number && <div style={{ fontSize: '11px', color: ink[600], marginTop: 2 }}>UEN: {w.registration_number}</div>}
                </div>
                <div style={{ display: 'flex', gap: space[3], fontSize: '12px', color: ink[600] }}>
                  <div><strong style={{ color: ink[800] }}>{w.user_count}</strong> {w.user_count === 1 ? 'user' : 'users'}</div>
                  <div>{new Date(w.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                </div>
                <div style={{ display: 'flex', gap: space[2], flexWrap: 'wrap' }}>
                  {w.workspace_type === 'internal' ? (
                    <button onClick={() => openInternalWorkspace(w)} style={{ ...btnSmGhost, flex: 1, minWidth: 80 }} title="Open this internal workspace directly">Open</button>
                  ) : (
                    <button onClick={() => setImpersonateWs(w)} style={{ ...btnSmGhost, flex: 1, minWidth: 100 }} title="Sign in as a user in this workspace">Sign in as...</button>
                  )}
                  <button onClick={() => setRolesWs(w)} style={{ ...btnSmGhost, flex: 1, minWidth: 60 }}>Roles</button>
                  <button onClick={() => setEditWs(w)} style={{ ...btnSmGhost, flex: 1, minWidth: 60 }}>Edit</button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{
            background: '#fff', borderRadius: radius.lg,
            border: `0.5px solid ${ink[300]}`, overflow: 'hidden',
            boxShadow: shadow.subtle,
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: ink[100], borderBottom: `0.5px solid ${ink[300]}` }}>
                  <th style={thStyle}>Workspace</th>
                  <th style={thStyle}>Slug</th>
                  <th style={thStyle}>Plan</th>
                  <th style={thStyle}>Users</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Created</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(w => (
                  <tr key={w.id} style={{ borderBottom: `0.5px solid ${ink[200]}` }}>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: textWeight.semibold, color: ink[900], fontSize: '13px' }}>{w.name}</div>
                      {w.registration_number && <div style={{ fontSize: '11px', color: ink[600], marginTop: 2 }}>UEN: {w.registration_number}</div>}
                    </td>
                    <td style={{ ...tdStyle, fontFamily: fonts.mono, fontSize: '12px', color: ink[600] }}>{w.slug}</td>
                    <td style={tdStyle}>
                      <span style={{
                        padding: '3px 8px', background: accent.soft, color: accent.DEFAULT,
                        borderRadius: radius.sm, fontSize: '10px', fontWeight: textWeight.semibold,
                        textTransform: 'uppercase', letterSpacing: '0.4px',
                      }}>{w.plan}</span>
                      {w.billing_exempt && <span style={{
                        marginLeft: space[1], padding: '3px 8px',
                        background: semantic.successSoft, color: semantic.success,
                        borderRadius: radius.sm, fontSize: '10px', fontWeight: textWeight.semibold,
                      }}>Free</span>}
                    </td>
                    <td style={{ ...tdStyle, color: ink[800] }}>{w.user_count}</td>
                    <td style={tdStyle}>
                      <span style={{
                        padding: '3px 10px',
                        background: w.status === 'active' ? semantic.successSoft : w.status === 'suspended' ? semantic.dangerSoft : ink[200],
                        color: w.status === 'active' ? semantic.success : w.status === 'suspended' ? semantic.danger : ink[600],
                        borderRadius: radius.pill, fontSize: '11px',
                        fontWeight: textWeight.semibold, textTransform: 'capitalize',
                      }}>{w.status}</span>
                    </td>
                    <td style={{ ...tdStyle, fontSize: '12px', color: ink[600] }}>
                      {new Date(w.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: space[1] }}>
                        {w.workspace_type === 'internal' ? (
                          <button onClick={() => openInternalWorkspace(w)} style={btnSmGhost} title="Open this internal workspace directly">Open</button>
                        ) : (
                          <button onClick={() => setImpersonateWs(w)} style={btnSmGhost} title="Sign in as a user in this workspace">Sign in as...</button>
                        )}
                        <button onClick={() => setRolesWs(w)} style={btnSmGhost}>Roles</button>
                        <button onClick={() => setEditWs(w)} style={btnSmGhost}>Edit</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Modals */}
      {showCreate && <CreateWorkspaceModal onClose={() => setShowCreate(false)} onCreated={(data) => { setShowCreate(false); setNewCreds(data); fetchWorkspaces() }} />}
      {editWs && <EditWorkspaceModal workspace={editWs} onClose={() => setEditWs(null)} onSaved={() => { setEditWs(null); fetchWorkspaces() }} />}
      {rolesWs && <RolesModal workspace={rolesWs} onClose={() => setRolesWs(null)} />}
      {newCreds && <PasswordRevealModal data={newCreds} onClose={() => setNewCreds(null)} />}
      {impersonateWs && (
        <ImpersonateModal
          workspace={impersonateWs}
          onClose={() => setImpersonateWs(null)}
          onConfirmed={(payload) => {
            applyImpersonation(payload.token, payload.user)
            // Hard reload so the whole app re-routes through AppWithAuth
            // and lands in MainApp as the impersonated user.
            window.location.href = '/'
          }}
        />
      )}
    </div>
  )
}

const thStyle = {
  textAlign: 'left', padding: '10px 16px', fontSize: '10px',
  fontWeight: textWeight.semibold, color: ink[600],
  textTransform: 'uppercase', letterSpacing: '1.2px',
  fontFamily: fonts.body,
}
const tdStyle = {
  padding: '14px 16px', fontSize: '13px', color: ink[700],
  verticalAlign: 'top', fontFamily: fonts.body,
}
const btnSmGhost = {
  padding: '6px 12px', background: '#fff', color: ink[700],
  border: `0.5px solid ${ink[300]}`, borderRadius: radius.sm,
  fontSize: '12px', fontWeight: textWeight.medium, fontFamily: fonts.body,
  cursor: 'pointer', transition: 'background .15s',
}

// --- CREATE WORKSPACE MODAL ---
function CreateWorkspaceModal({ onClose, onCreated }) {
  const { authHeader } = useAuth()
  const [form, setForm] = useState({
    name: '', slug: '', registration_number: '', email: '', phone: '', address: '',
    plan: 'starter', billing_exempt: false, workspace_type: 'client',
    director_name: '', director_email: ''
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [slugEdited, setSlugEdited] = useState(false)

  function updateField(key, value) {
    setForm(f => {
      const next = { ...f, [key]: value }
      if (key === 'name' && !slugEdited) {
        next.slug = value.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-')
      }
      return next
    })
  }

  async function submit() {
    setError('')
    if (!form.name.trim()) return setError('Workspace name is required')
    if (!form.director_name.trim()) return setError('Director name is required')
    if (!form.director_email.trim() || !/\S+@\S+\.\S+/.test(form.director_email)) return setError('Valid director email is required')

    setSubmitting(true)
    try {
      const res = await fetch(`${API}/admin/workspaces`, {
        method: 'POST',
        headers: { ...authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create workspace')
      onCreated(data)
    } catch (e) {
      setError(e.message)
      setSubmitting(false)
    }
  }

  return (
    <ModalShell title="Create workspace" subtitle="Set up a new tenant and its first director" onClose={onClose} width={560}>
      {error && <ErrorBanner message={error} />}

      <SectionLabel>Workspace</SectionLabel>
      <FormInput label="Name" required value={form.name} onChange={v => updateField('name', v)} placeholder="Acme Recruitment Pte Ltd" />
      <FormInput label="Slug" value={form.slug} onChange={v => { setSlugEdited(true); updateField('slug', v) }} placeholder="acme-recruitment" hint="URL-safe identifier, auto-generated from name" mono />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: space[3] }}>
        <FormInput label="UEN / Registration" value={form.registration_number} onChange={v => updateField('registration_number', v)} placeholder="202231751D" />
        <FormInput label="Contact email" type="email" value={form.email} onChange={v => updateField('email', v)} placeholder="admin@acme.com" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: space[3] }}>
        <FormSelect label="Plan" value={form.plan} onChange={v => updateField('plan', v)} options={[
          { value: 'starter', label: 'Starter' },
          { value: 'pro', label: 'Pro' },
          { value: 'enterprise', label: 'Enterprise' },
          { value: 'trial', label: 'Trial' },
        ]} />
        <FormSelect label="Type" value={form.workspace_type} onChange={v => updateField('workspace_type', v)} options={[
          { value: 'client', label: 'Client (paying)' },
          { value: 'internal', label: 'Internal' },
        ]} />
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: space[2], marginTop: space[2], fontSize: '13px', color: ink[700], cursor: 'pointer' }}>
        <input type="checkbox" checked={form.billing_exempt} onChange={e => updateField('billing_exempt', e.target.checked)} />
        Billing exempt (free tier - no charges)
      </label>

      <div style={{ height: 1, background: ink[200], margin: `${space[5]}px 0` }} />

      <SectionLabel>First director</SectionLabel>
      <div style={{ fontSize: '12px', color: ink[600], marginBottom: space[2] }}>A one-time password will be generated and shown once. Share it securely with the director.</div>
      <FormInput label="Director name" required value={form.director_name} onChange={v => updateField('director_name', v)} placeholder="Jane Tan" />
      <FormInput label="Director email" required type="email" value={form.director_email} onChange={v => updateField('director_email', v)} placeholder="jane@acme.com" />

      <div style={{ display: 'flex', gap: space[2], justifyContent: 'flex-end', marginTop: space[6] }}>
        <button onClick={onClose} disabled={submitting} style={btnGhost}>Cancel</button>
        <button onClick={submit} disabled={submitting} style={{ ...btnPrimary, opacity: submitting ? 0.6 : 1 }}>
          {submitting ? 'Creating...' : 'Create workspace'}
        </button>
      </div>
    </ModalShell>
  )
}

// --- EDIT WORKSPACE MODAL ---
function EditWorkspaceModal({ workspace, onClose, onSaved }) {
  const { authHeader } = useAuth()
  const [form, setForm] = useState({
    name: workspace.name || '',
    registration_number: workspace.registration_number || '',
    email: workspace.email || '',
    phone: workspace.phone || '',
    address: workspace.address || '',
    plan: workspace.plan || 'starter',
    billing_exempt: !!workspace.billing_exempt,
    status: workspace.status || 'active',
    workspace_type: workspace.workspace_type || 'client',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    setError('')
    setSaving(true)
    try {
      const res = await fetch(`${API}/admin/workspaces/${workspace.id}`, {
        method: 'PATCH',
        headers: { ...authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update')
      onSaved(data)
    } catch (e) {
      setError(e.message)
      setSaving(false)
    }
  }

  return (
    <ModalShell title={`Edit: ${workspace.name}`} subtitle={`Slug: ${workspace.slug} - ID: ${workspace.id}`} onClose={onClose} width={520}>
      {error && <ErrorBanner message={error} />}

      <FormInput label="Name" value={form.name} onChange={v => setForm({ ...form, name: v })} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: space[3] }}>
        <FormInput label="UEN / Registration" value={form.registration_number} onChange={v => setForm({ ...form, registration_number: v })} />
        <FormInput label="Contact email" type="email" value={form.email} onChange={v => setForm({ ...form, email: v })} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: space[3] }}>
        <FormInput label="Phone" value={form.phone} onChange={v => setForm({ ...form, phone: v })} />
        <FormSelect label="Status" value={form.status} onChange={v => setForm({ ...form, status: v })} options={[
          { value: 'active', label: 'Active' },
          { value: 'suspended', label: 'Suspended' },
          { value: 'cancelled', label: 'Cancelled' },
        ]} />
      </div>
      <FormInput label="Address" value={form.address} onChange={v => setForm({ ...form, address: v })} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: space[3] }}>
        <FormSelect label="Plan" value={form.plan} onChange={v => setForm({ ...form, plan: v })} options={[
          { value: 'starter', label: 'Starter' },
          { value: 'pro', label: 'Pro' },
          { value: 'enterprise', label: 'Enterprise' },
          { value: 'trial', label: 'Trial' },
        ]} />
        <FormSelect label="Type" value={form.workspace_type} onChange={v => setForm({ ...form, workspace_type: v })} options={[
          { value: 'client', label: 'Client (paying)' },
          { value: 'internal', label: 'Internal' },
        ]} />
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: space[2], marginTop: space[2], fontSize: '13px', color: ink[700], cursor: 'pointer' }}>
        <input type="checkbox" checked={form.billing_exempt} onChange={e => setForm({ ...form, billing_exempt: e.target.checked })} />
        Billing exempt
      </label>

      <div style={{ display: 'flex', gap: space[2], justifyContent: 'flex-end', marginTop: space[6] }}>
        <button onClick={onClose} disabled={saving} style={btnGhost}>Cancel</button>
        <button onClick={save} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.6 : 1 }}>
          {saving ? 'Saving...' : 'Save changes'}
        </button>
      </div>
    </ModalShell>
  )
}

// --- PASSWORD REVEAL MODAL ---
function PasswordRevealModal({ data, onClose }) {
  const [copied, setCopied] = useState(false)
  const [confirming, setConfirming] = useState(false)

  async function copyPassword() {
    try {
      await navigator.clipboard.writeText(data.initial_password)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      alert('Copy failed. Please select the password manually.')
    }
  }

  function handleClose() {
    if (!confirming) { setConfirming(true); setTimeout(() => setConfirming(false), 3000); return }
    onClose()
  }

  return (
    <ModalShell title="Workspace created" subtitle={`${data.workspace.name} is ready.`} onClose={null} width={480}>
      <div style={{
        padding: '12px 14px', background: semantic.warningSoft,
        border: `0.5px solid ${semantic.warning}`, borderRadius: radius.md,
        fontSize: '12px', color: semantic.warning, marginBottom: space[5],
        display: 'flex', gap: space[2], alignItems: 'flex-start',
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={semantic.warning} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        <div>
          <div style={{ fontWeight: textWeight.semibold, marginBottom: 3 }}>Save this password now</div>
          <div>It will not be shown again. Send it to the director securely (WhatsApp, SMS, or encrypted email).</div>
        </div>
      </div>

      <div style={{ marginBottom: space[4] }}>
        <SectionLabel>Director</SectionLabel>
        <div style={{ fontSize: '14px', color: ink[900], fontWeight: textWeight.medium }}>{data.director.name}</div>
        <div style={{ fontSize: '12px', color: ink[600] }}>{data.director.email}</div>
      </div>

      <div style={{ marginBottom: space[5] }}>
        <SectionLabel>Initial password</SectionLabel>
        <div style={{ display: 'flex', gap: space[2] }}>
          <input
            readOnly
            value={data.initial_password}
            onFocus={e => e.target.select()}
            style={{
              flex: 1, padding: '12px 14px', border: `0.5px solid ${ink[300]}`,
              borderRadius: radius.md, fontSize: '15px', fontFamily: fonts.mono,
              background: ink[50], color: ink[900], letterSpacing: '0.5px',
              fontWeight: textWeight.semibold, outline: 'none',
            }}
          />
          <button
            onClick={copyPassword}
            style={{
              padding: '0 18px',
              background: copied ? semantic.success : accent.DEFAULT,
              color: '#fff', border: 'none', borderRadius: radius.md,
              fontSize: '13px', fontWeight: textWeight.semibold,
              fontFamily: fonts.body, cursor: 'pointer', minWidth: 100,
              transition: 'background .15s',
            }}>
            {copied ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 8 7 12 13 4"/>
                </svg>
                Copied
              </span>
            ) : 'Copy'}
          </button>
        </div>
      </div>

      <div style={{ fontSize: '12px', color: ink[600], marginBottom: space[5] }}>
        The director must change this password on first login.
      </div>

      <div style={{ display: 'flex', gap: space[2], justifyContent: 'flex-end' }}>
        <button
          onClick={handleClose}
          style={{
            padding: '10px 18px',
            background: confirming ? semantic.danger : '#fff',
            color: confirming ? '#fff' : ink[700],
            border: confirming ? `0.5px solid ${semantic.danger}` : `0.5px solid ${ink[300]}`,
            borderRadius: radius.md, fontSize: '13px',
            fontWeight: textWeight.semibold, fontFamily: fonts.body, cursor: 'pointer',
          }}>
          {confirming ? 'Click again to confirm close' : 'I have saved the password'}
        </button>
      </div>
    </ModalShell>
  )
}

// --- SHARED PRIMITIVES ---
function ModalShell({ title, subtitle, onClose, children, width = 480 }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(10, 9, 7, 0.55)',
      backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center',
      justifyContent: 'center', zIndex: 1000, padding: space[4],
    }}>
      <div style={{
        background: '#fff', borderRadius: radius.lg, width: '100%',
        maxWidth: width, maxHeight: '90vh', overflow: 'auto',
        boxShadow: shadow.overlay, border: `0.5px solid ${ink[300]}`,
      }}>
        <div style={{
          padding: '18px 24px', borderBottom: `0.5px solid ${ink[200]}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        }}>
          <div>
            <div style={{
              fontFamily: fonts.display, fontSize: '16px',
              fontWeight: textWeight.semibold, color: ink[900], marginBottom: 2,
              letterSpacing: '-0.2px',
            }}>{title}</div>
            {subtitle && <div style={{ fontSize: '12px', color: ink[600] }}>{subtitle}</div>}
          </div>
          {onClose && (
            <button onClick={onClose} style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              padding: 4, color: ink[500], fontSize: 20, lineHeight: 1,
            }}>
              <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <line x1="4" y1="4" x2="12" y2="12"/>
                <line x1="12" y1="4" x2="4" y2="12"/>
              </svg>
            </button>
          )}
        </div>
        <div style={{ padding: '20px 24px' }}>{children}</div>
      </div>
    </div>
  )
}

function SectionLabel({ children }) {
  return <div style={{
    fontSize: '10px', fontWeight: textWeight.semibold, color: ink[600],
    textTransform: 'uppercase', letterSpacing: '1.2px', marginBottom: space[2],
    fontFamily: fonts.body,
  }}>{children}</div>
}

function ErrorBanner({ message }) {
  return (
    <div style={{
      marginBottom: space[4], padding: '10px 12px',
      background: semantic.dangerSoft, border: `0.5px solid ${semantic.danger}`,
      borderRadius: radius.md, fontSize: '12px', color: semantic.danger,
    }}>{message}</div>
  )
}

function FormInput({ label, value, onChange, placeholder, type = 'text', required, hint, mono }) {
  return (
    <div style={{ marginBottom: space[3] }}>
      <label style={{
        display: 'block', fontSize: '10px', fontWeight: textWeight.semibold,
        color: ink[700], marginBottom: 5, textTransform: 'uppercase', letterSpacing: '1.2px',
      }}>
        {label} {required && <span style={{ color: semantic.danger }}>*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%', padding: '10px 12px', border: `0.5px solid ${ink[300]}`,
          borderRadius: radius.md, fontSize: '13px', outline: 'none',
          background: ink[50], color: ink[800], boxSizing: 'border-box',
          fontFamily: mono ? fonts.mono : fonts.body,
          transition: 'border-color .15s, box-shadow .15s',
        }}
        onFocus={e => { e.target.style.borderColor = accent.DEFAULT; e.target.style.boxShadow = '0 0 0 3px rgba(45,42,122,0.08)' }}
        onBlur={e => { e.target.style.borderColor = ink[300]; e.target.style.boxShadow = 'none' }}
      />
      {hint && <div style={{ fontSize: '11px', color: ink[500], marginTop: 4 }}>{hint}</div>}
    </div>
  )
}

function FormSelect({ label, value, onChange, options }) {
  return (
    <div style={{ marginBottom: space[3] }}>
      <label style={{
        display: 'block', fontSize: '10px', fontWeight: textWeight.semibold,
        color: ink[700], marginBottom: 5, textTransform: 'uppercase', letterSpacing: '1.2px',
      }}>{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          width: '100%', padding: '10px 12px', border: `0.5px solid ${ink[300]}`,
          borderRadius: radius.md, fontSize: '13px', outline: 'none',
          background: ink[50], color: ink[800], boxSizing: 'border-box',
          fontFamily: fonts.body, cursor: 'pointer',
          transition: 'border-color .15s, box-shadow .15s',
        }}
        onFocus={e => { e.target.style.borderColor = accent.DEFAULT; e.target.style.boxShadow = '0 0 0 3px rgba(45,42,122,0.08)' }}
        onBlur={e => { e.target.style.borderColor = ink[300]; e.target.style.boxShadow = 'none' }}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

const btnPrimary = {
  padding: '10px 18px', background: accent.DEFAULT, color: '#fff',
  border: 'none', borderRadius: radius.md, fontSize: '13px',
  fontWeight: textWeight.semibold, fontFamily: fonts.body,
  cursor: 'pointer', letterSpacing: '0.2px', transition: 'background .15s',
}
const btnGhost = {
  padding: '10px 18px', background: '#fff', color: ink[700],
  border: `0.5px solid ${ink[300]}`, borderRadius: radius.md,
  fontSize: '13px', fontWeight: textWeight.medium, fontFamily: fonts.body,
  cursor: 'pointer', transition: 'background .15s',
}

// --- IMPERSONATE MODAL ---
// Two-step impersonation flow:
//   1. Mount: load the workspace's users from the backend
//   2. User picks who to impersonate (defaults to director, the first
//      result from the backend's role-sorted list)
//   3. Click "Sign in as..." -> first call returns preview (requires_confirmation)
//   4. Confirmation panel shows what's about to happen
//   5. Click "Confirm" -> second call returns token + user, parent applies
//      impersonation and redirects to /
function ImpersonateModal({ workspace, onClose, onConfirmed }) {
  const { authHeader } = useAuth()
  const [users, setUsers] = useState([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [selectedUserId, setSelectedUserId] = useState('')
  const [preview, setPreview] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoadingUsers(true)
      setLoadError('')
      try {
        const res = await fetch(`${API}/admin/workspaces/${workspace.id}/users`, { headers: authHeader })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to load users')
        if (cancelled) return
        setUsers(data.users || [])
        // Default selection: director (first in the list, as backend sorts).
        if (data.users && data.users.length > 0) {
          setSelectedUserId(String(data.users[0].id))
        }
      } catch (e) {
        if (!cancelled) setLoadError(e.message)
      } finally {
        if (!cancelled) setLoadingUsers(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [workspace.id])

  // Step 1: request preview from backend
  async function requestPreview() {
    setError('')
    if (!selectedUserId) return setError('Pick a user to impersonate')
    setSubmitting(true)
    try {
      const res = await fetch(`${API}/admin/impersonate/start`, {
        method: 'POST',
        headers: { ...authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: workspace.id,
          user_id: parseInt(selectedUserId, 10)
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to start impersonation')
      if (!data.requires_confirmation) {
        // Backend returned a final token without going through preview.
        // Treat it as already-confirmed.
        return onConfirmed(data)
      }
      setPreview(data)
    } catch (e) {
      setError(e.message)
    }
    setSubmitting(false)
  }

  // Step 2: send confirmed=true -- returns the actual token
  async function confirm() {
    setError('')
    setSubmitting(true)
    try {
      const res = await fetch(`${API}/admin/impersonate/start`, {
        method: 'POST',
        headers: { ...authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: workspace.id,
          user_id: parseInt(selectedUserId, 10),
          confirmed: true
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to start impersonation')
      onConfirmed(data)
    } catch (e) {
      setError(e.message)
      setSubmitting(false)
    }
  }

  // Helper: format last_login_at as "last seen" or "never"
  function lastSeenLabel(iso) {
    if (!iso) return 'never logged in'
    const ageSec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
    if (ageSec < 60) return 'last seen just now'
    if (ageSec < 3600) return `last seen ${Math.floor(ageSec / 60)}m ago`
    if (ageSec < 86400) return `last seen ${Math.floor(ageSec / 3600)}h ago`
    if (ageSec < 86400 * 30) return `last seen ${Math.floor(ageSec / 86400)}d ago`
    return `last seen ${new Date(iso).toLocaleDateString()}`
  }

  // Format role for display: "senior_consultant" -> "Senior consultant"
  function formatRole(role) {
    if (!role) return ''
    return role.charAt(0).toUpperCase() + role.slice(1).replace(/_/g, ' ')
  }

  return (
    <ModalShell
      title={preview ? 'Confirm impersonation' : `Sign in as a user`}
      subtitle={preview ? null : `Workspace: ${workspace.name}`}
      onClose={onClose}
      width={520}>
      {error && <ErrorBanner message={error} />}

      {!preview ? (
        <>
          {loadingUsers ? (
            <div style={{ padding: '20px 0', textAlign: 'center', fontSize: 13, color: ink[500] }}>
              Loading users in this workspace...
            </div>
          ) : loadError ? (
            <ErrorBanner message={loadError} />
          ) : users.length === 0 ? (
            <div style={{ padding: '20px 0', textAlign: 'center', fontSize: 13, color: ink[600] }}>
              No active users in this workspace.
            </div>
          ) : (
            <>
              <SectionLabel>Select user</SectionLabel>
              <div style={{ fontSize: 12, color: ink[600], marginBottom: space[3] }}>
                Director is selected by default. Pick another user to see the workspace from their perspective.
              </div>
              <div style={{
                border: `0.5px solid ${ink[300]}`,
                borderRadius: radius.md,
                background: ink[50],
                maxHeight: 280,
                overflowY: 'auto'
              }}>
                {users.map(u => {
                  const isSelected = String(u.id) === selectedUserId
                  return (
                    <label
                      key={u.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: space[3],
                        padding: '10px 14px',
                        borderBottom: `0.5px solid ${ink[200]}`,
                        cursor: 'pointer',
                        background: isSelected ? accent.soft : 'transparent',
                        transition: 'background .15s'
                      }}>
                      <input
                        type="radio"
                        name="impersonate-user"
                        value={String(u.id)}
                        checked={isSelected}
                        onChange={e => setSelectedUserId(e.target.value)}
                        style={{ flexShrink: 0 }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: textWeight.semibold, color: ink[900] }}>
                          {u.name}
                          {u.role === 'director' && (
                            <span style={{
                              marginLeft: space[2],
                              fontSize: 9,
                              padding: '2px 6px',
                              borderRadius: radius.sm,
                              background: accent.DEFAULT,
                              color: '#fff',
                              fontWeight: textWeight.semibold,
                              letterSpacing: '0.4px',
                              textTransform: 'uppercase'
                            }}>
                              Director
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: ink[600], marginTop: 2 }}>
                          {u.email}  &middot;  {formatRole(u.role)}  &middot;  {lastSeenLabel(u.last_login_at)}
                        </div>
                      </div>
                    </label>
                  )
                })}
              </div>
              <div style={{
                marginTop: space[4],
                padding: '10px 12px',
                background: '#fffbeb',
                border: '0.5px solid #fde68a',
                borderRadius: radius.md,
                fontSize: 11,
                color: '#92400e',
                lineHeight: 1.5
              }}>
                <strong>Heads up:</strong> Impersonation is logged and visible in the audit trail. Your actions while impersonating will be attributed to you, the original super admin.
              </div>
              <div style={{ display: 'flex', gap: space[2], justifyContent: 'flex-end', marginTop: space[5] }}>
                <button onClick={onClose} disabled={submitting} style={btnGhost}>Cancel</button>
                <button onClick={requestPreview} disabled={submitting || !selectedUserId} style={{ ...btnPrimary, opacity: (submitting || !selectedUserId) ? 0.6 : 1 }}>
                  {submitting ? 'Loading...' : 'Continue'}
                </button>
              </div>
            </>
          )}
        </>
      ) : (
        <>
          <div style={{
            padding: '14px 16px',
            background: accent.soft,
            border: `0.5px solid ${accent.DEFAULT}`,
            borderRadius: radius.md,
            marginBottom: space[4]
          }}>
            <div style={{
              fontSize: 10,
              fontWeight: textWeight.semibold,
              color: accent.DEFAULT,
              textTransform: 'uppercase',
              letterSpacing: '0.6px',
              marginBottom: space[1]
            }}>
              You will be signed in as
            </div>
            <div style={{ fontSize: 16, fontWeight: textWeight.semibold, color: ink[900], marginBottom: 4 }}>
              {preview.target_user.name}
            </div>
            <div style={{ fontSize: 12, color: ink[700], marginBottom: 8 }}>
              {preview.target_user.email}  &middot;  {formatRole(preview.target_user.role)}
            </div>
            <div style={{ fontSize: 11, color: ink[600] }}>
              Workspace: <strong>{preview.target_user.workspace_name}</strong>
            </div>
          </div>

          <div style={{ fontSize: 12, color: ink[700], lineHeight: 1.6, marginBottom: space[4] }}>
            <ul style={{ paddingLeft: 18, margin: 0 }}>
              <li>Your session will expire automatically in {preview.duration_minutes} minutes.</li>
              <li>You can stop impersonating at any time using the banner at the top of the page.</li>
              <li>You will not have super admin privileges while impersonating.</li>
              <li>All actions you take are logged with your real identity (super admin).</li>
            </ul>
          </div>

          <div style={{ display: 'flex', gap: space[2], justifyContent: 'flex-end', marginTop: space[5] }}>
            <button onClick={() => setPreview(null)} disabled={submitting} style={btnGhost}>Back</button>
            <button onClick={confirm} disabled={submitting} style={{ ...btnPrimary, opacity: submitting ? 0.6 : 1 }}>
              {submitting ? 'Signing in...' : `Sign in as ${preview.target_user.name}`}
            </button>
          </div>
        </>
      )}
    </ModalShell>
  )
}

// --- ROLES MODAL ---
function RolesModal({ workspace, onClose }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(10, 9, 7, 0.55)',
      backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center',
      justifyContent: 'center', zIndex: 100, padding: space[4],
    }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{
        background: '#fff', borderRadius: radius.lg, width: '100%',
        maxWidth: 960, maxHeight: '90vh', overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        boxShadow: shadow.overlay, border: `0.5px solid ${ink[300]}`,
      }}>
        <div style={{
          padding: '18px 24px', borderBottom: `0.5px solid ${ink[200]}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0,
        }}>
          <div>
            <div style={{
              fontFamily: fonts.display, fontSize: '15px',
              fontWeight: textWeight.semibold, color: ink[900], letterSpacing: '-0.2px',
            }}>Roles and Permissions</div>
            <div style={{ fontSize: '12px', color: ink[600], marginTop: 2 }}>
              Editing workspace: <strong style={{ color: ink[800], fontWeight: textWeight.semibold }}>{workspace.name}</strong>
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'transparent', border: 'none', fontSize: 20,
            color: ink[500], cursor: 'pointer', padding: 4, lineHeight: 1,
          }}>脳</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <RolesPermissions workspaceId={workspace.id} workspaceName={workspace.name} />
        </div>
      </div>
    </div>
  )
}