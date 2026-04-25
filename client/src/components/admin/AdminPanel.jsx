import { useState, useEffect } from 'react'
import { API } from '../../utils/constants'
import { NAVY } from '../../utils/designTokens'
import { useAuth } from '../../context/AuthContext'
import RolesPermissions from '../settings/tabs/RolesPermissions'

// ─── MAIN PANEL ────────────────────────────────────────────────────────────────
export default function AdminPanel() {
  const { user, logout, authHeader } = useAuth()
  const [workspaces, setWorkspaces] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showCreate, setShowCreate] = useState(false)
  const [editWs, setEditWs] = useState(null)
  const [newCreds, setNewCreds] = useState(null) // { workspace, director, initial_password }
  const [rolesWs, setRolesWs] = useState(null)

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
    <div style={{ minHeight: '100vh', background: '#f1f4f9', padding: '24px 32px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600 }}>Platform Admin</div>
            <div style={{ padding: '2px 8px', background: NAVY, color: '#fff', borderRadius: 4, fontSize: 10, fontWeight: 600, letterSpacing: 0.5 }}>SUPER ADMIN</div>
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#111827', letterSpacing: '-0.3px' }}>Workspaces</div>
          <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>Signed in as {user?.email}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setShowCreate(true)}
            style={{ padding: '10px 18px', background: 'linear-gradient(135deg, #2563eb, #1e40af)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', letterSpacing: 0.3 }}>
            + Create workspace
          </button>
          <button
            onClick={() => { if (window.confirm('Sign out of Tel-Cloud?')) logout() }}
            style={{ padding: '10px 16px', background: '#fff', color: '#6b7280', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
            Sign out
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, slug, or UEN..."
          style={{ flex: 1, minWidth: 240, padding: '10px 14px', border: '1.5px solid #e5e7eb', borderRadius: 8, fontSize: 13, outline: 'none', background: '#fff' }}
          onFocus={e => e.target.style.borderColor = '#2563eb'}
          onBlur={e => e.target.style.borderColor = '#e5e7eb'}
        />
        <div style={{ display: 'flex', gap: 4, background: '#fff', padding: 4, borderRadius: 8, border: '1px solid #e5e7eb' }}>
          {['all', 'active', 'suspended'].map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              style={{ padding: '6px 14px', background: statusFilter === s ? NAVY : 'transparent', color: statusFilter === s ? '#fff' : '#6b7280', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer', textTransform: 'capitalize' }}>
              {s}
            </button>
          ))}
        </div>
        <div style={{ fontSize: 12, color: '#9ca3af' }}>
          {filtered.length} {filtered.length === 1 ? 'workspace' : 'workspaces'}
        </div>
      </div>

      {/* Error / Loading / Table */}
      {error && (
        <div style={{ padding: 12, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 13, color: '#dc2626', marginBottom: 16 }}>
          {error} <button onClick={fetchWorkspaces} style={{ marginLeft: 12, padding: '4px 10px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 4, fontSize: 11, cursor: 'pointer' }}>Retry</button>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af', fontSize: 13 }}>Loading workspaces…</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, background: '#fff', borderRadius: 12, border: '1px dashed #e5e7eb' }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#9a958c" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 8 }}><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/></svg>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 4 }}>No workspaces yet</div>
          <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 16 }}>Create your first workspace to get started</div>
          <button onClick={() => setShowCreate(true)} style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>+ Create workspace</button>
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
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
                <tr key={w.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={tdStyle}>
                    <div style={{ fontWeight: 600, color: '#111827' }}>{w.name}</div>
                    {w.registration_number && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>UEN: {w.registration_number}</div>}
                  </td>
                  <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 12, color: '#6b7280' }}>{w.slug}</td>
                  <td style={tdStyle}>
                    <span style={{ padding: '3px 8px', background: '#eff6ff', color: '#1e40af', borderRadius: 4, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3 }}>{w.plan}</span>
                    {w.billing_exempt && <span style={{ marginLeft: 6, padding: '3px 8px', background: '#f0fdf4', color: '#059669', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>Free</span>}
                  </td>
                  <td style={tdStyle}>{w.user_count}</td>
                  <td style={tdStyle}>
                    <span style={{
                      padding: '3px 10px',
                      background: w.status === 'active' ? '#f0fdf4' : w.status === 'suspended' ? '#fef2f2' : '#f3f4f6',
                      color: w.status === 'active' ? '#059669' : w.status === 'suspended' ? '#dc2626' : '#6b7280',
                      borderRadius: 10, fontSize: 11, fontWeight: 600, textTransform: 'capitalize'
                    }}>
                      {w.status}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, fontSize: 12, color: '#6b7280' }}>{new Date(w.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: 6 }}>
                      <button
                        onClick={() => setRolesWs(w)}
                        style={{ padding: '6px 12px', background: '#fff', color: '#374151', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
                        Roles
                      </button>
                      <button
                        onClick={() => setEditWs(w)}
                        style={{ padding: '6px 12px', background: '#fff', color: '#374151', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
                        Edit
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      {showCreate && <CreateWorkspaceModal onClose={() => setShowCreate(false)} onCreated={(data) => { setShowCreate(false); setNewCreds(data); fetchWorkspaces() }} />}
      {editWs && <EditWorkspaceModal workspace={editWs} onClose={() => setEditWs(null)} onSaved={() => { setEditWs(null); fetchWorkspaces() }} />}
      {rolesWs && <RolesModal workspace={rolesWs} onClose={() => setRolesWs(null)} />}
      {newCreds && <PasswordRevealModal data={newCreds} onClose={() => setNewCreds(null)} />}
    </div>
  )
}

const thStyle = { textAlign: 'left', padding: '12px 16px', fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.4 }
const tdStyle = { padding: '14px 16px', fontSize: 13, color: '#374151', verticalAlign: 'top' }

// ─── CREATE WORKSPACE MODAL ────────────────────────────────────────────────────
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
      {error && <div style={{ marginBottom: 16, padding: 10, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, fontSize: 12, color: '#dc2626' }}>{error}</div>}

      <SectionLabel>Workspace</SectionLabel>
      <FormInput label="Name" required value={form.name} onChange={v => updateField('name', v)} placeholder="Acme Recruitment Pte Ltd" />
      <FormInput label="Slug" value={form.slug} onChange={v => { setSlugEdited(true); updateField('slug', v) }} placeholder="acme-recruitment" hint="URL-safe identifier, auto-generated from name" mono />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <FormInput label="UEN / Registration" value={form.registration_number} onChange={v => updateField('registration_number', v)} placeholder="202231751D" />
        <FormInput label="Contact email" type="email" value={form.email} onChange={v => updateField('email', v)} placeholder="admin@acme.com" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
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
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: 13, color: '#374151', cursor: 'pointer' }}>
        <input type="checkbox" checked={form.billing_exempt} onChange={e => updateField('billing_exempt', e.target.checked)} />
        Billing exempt (free tier — no charges)
      </label>

      <div style={{ height: 1, background: '#e5e7eb', margin: '20px 0' }} />

      <SectionLabel>First director</SectionLabel>
      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 10 }}>A one-time password will be generated and shown once. Share it securely with the director.</div>
      <FormInput label="Director name" required value={form.director_name} onChange={v => updateField('director_name', v)} placeholder="Jane Tan" />
      <FormInput label="Director email" required type="email" value={form.director_email} onChange={v => updateField('director_email', v)} placeholder="jane@acme.com" />

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
        <button onClick={onClose} disabled={submitting} style={btnGhost}>Cancel</button>
        <button onClick={submit} disabled={submitting} style={{ ...btnPrimary, opacity: submitting ? 0.6 : 1 }}>
          {submitting ? 'Creating…' : 'Create workspace'}
        </button>
      </div>
    </ModalShell>
  )
}

// ─── EDIT WORKSPACE MODAL ──────────────────────────────────────────────────────
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
    <ModalShell title={`Edit: ${workspace.name}`} subtitle={`Slug: ${workspace.slug} · ID: ${workspace.id}`} onClose={onClose} width={520}>
      {error && <div style={{ marginBottom: 16, padding: 10, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, fontSize: 12, color: '#dc2626' }}>{error}</div>}

      <FormInput label="Name" value={form.name} onChange={v => setForm({ ...form, name: v })} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <FormInput label="UEN / Registration" value={form.registration_number} onChange={v => setForm({ ...form, registration_number: v })} />
        <FormInput label="Contact email" type="email" value={form.email} onChange={v => setForm({ ...form, email: v })} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <FormInput label="Phone" value={form.phone} onChange={v => setForm({ ...form, phone: v })} />
        <FormSelect label="Status" value={form.status} onChange={v => setForm({ ...form, status: v })} options={[
          { value: 'active', label: 'Active' },
          { value: 'suspended', label: 'Suspended' },
          { value: 'cancelled', label: 'Cancelled' },
        ]} />
      </div>
      <FormInput label="Address" value={form.address} onChange={v => setForm({ ...form, address: v })} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
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
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: 13, color: '#374151', cursor: 'pointer' }}>
        <input type="checkbox" checked={form.billing_exempt} onChange={e => setForm({ ...form, billing_exempt: e.target.checked })} />
        Billing exempt
      </label>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
        <button onClick={onClose} disabled={saving} style={btnGhost}>Cancel</button>
        <button onClick={save} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.6 : 1 }}>
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </ModalShell>
  )
}

// ─── PASSWORD REVEAL MODAL ─────────────────────────────────────────────────────
function PasswordRevealModal({ data, onClose }) {
  const [copied, setCopied] = useState(false)
  const [confirming, setConfirming] = useState(false)

  async function copyPassword() {
    try {
      await navigator.clipboard.writeText(data.initial_password)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      // fallback: select the text
      alert('Copy failed. Please select the password manually.')
    }
  }

  function handleClose() {
    if (!confirming) { setConfirming(true); setTimeout(() => setConfirming(false), 3000); return }
    onClose()
  }

  return (
    <ModalShell title="Workspace created" subtitle={`${data.workspace.name} is ready.`} onClose={null} width={480}>
      <div style={{ padding: 14, background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 8, fontSize: 13, color: '#92400e', marginBottom: 20, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        <div>
          <div style={{ fontWeight: 600, marginBottom: 3 }}>Save this password now</div>
          <div>It will not be shown again. Send it to the director securely (WhatsApp, SMS, or encrypted email).</div>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>Director</div>
        <div style={{ fontSize: 14, color: '#111827', fontWeight: 500 }}>{data.director.name}</div>
        <div style={{ fontSize: 12, color: '#6b7280' }}>{data.director.email}</div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>Initial password</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            readOnly
            value={data.initial_password}
            onFocus={e => e.target.select()}
            style={{ flex: 1, padding: '12px 14px', border: '1.5px solid #e5e7eb', borderRadius: 8, fontSize: 16, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', background: '#f9fafb', color: '#111827', letterSpacing: 1, fontWeight: 600 }}
          />
          <button
            onClick={copyPassword}
            style={{
              padding: '0 20px',
              background: copied ? '#059669' : 'linear-gradient(135deg, #2563eb, #1e40af)',
              color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', minWidth: 100,
              transition: 'background .15s'
            }}>
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        </div>
      </div>

      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 20 }}>
        The director must change this password on first login.
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button
          onClick={handleClose}
          style={{
            padding: '10px 20px',
            background: confirming ? '#dc2626' : '#fff',
            color: confirming ? '#fff' : '#374151',
            border: confirming ? '1px solid #dc2626' : '1px solid #e5e7eb',
            borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>
          {confirming ? 'Click again to confirm close' : 'I have saved the password'}
        </button>
      </div>
    </ModalShell>
  )
}

// ─── SHARED PRIMITIVES ─────────────────────────────────────────────────────────
function ModalShell({ title, subtitle, onClose, children, width = 480 }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(17, 24, 39, 0.6)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: width, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#111827', marginBottom: 2 }}>{title}</div>
            {subtitle && <div style={{ fontSize: 12, color: '#6b7280' }}>{subtitle}</div>}
          </div>
          {onClose && (
            <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 4, color: '#9ca3af', fontSize: 20, lineHeight: 1 }}>×</button>
          )}
        </div>
        <div style={{ padding: '20px 24px' }}>{children}</div>
      </div>
    </div>
  )
}

function SectionLabel({ children }) {
  return <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>{children}</div>
}

function FormInput({ label, value, onChange, placeholder, type = 'text', required, hint, mono }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.4 }}>
        {label} {required && <span style={{ color: '#dc2626' }}>*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #e5e7eb', borderRadius: 8, fontSize: 13, outline: 'none', background: '#f9fafb', color: '#111827', boxSizing: 'border-box', fontFamily: mono ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : 'inherit' }}
        onFocus={e => e.target.style.borderColor = '#2563eb'}
        onBlur={e => e.target.style.borderColor = '#e5e7eb'}
      />
      {hint && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>{hint}</div>}
    </div>
  )
}

function FormSelect({ label, value, onChange, options }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #e5e7eb', borderRadius: 8, fontSize: 13, outline: 'none', background: '#f9fafb', color: '#111827', boxSizing: 'border-box', cursor: 'pointer' }}
        onFocus={e => e.target.style.borderColor = '#2563eb'}
        onBlur={e => e.target.style.borderColor = '#e5e7eb'}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

const btnPrimary = { padding: '10px 18px', background: 'linear-gradient(135deg, #2563eb, #1e40af)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', letterSpacing: 0.3 }
const btnGhost = { padding: '10px 18px', background: '#fff', color: '#374151', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }

function RolesModal({ workspace, onClose }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 960, maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '18px 24px', borderBottom: '0.5px solid #f1f4f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>Roles and Permissions</div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>Editing workspace: <strong>{workspace.name}</strong></div>
          </div>
          <button onClick={onClose}
            style={{ background: 'transparent', border: 'none', fontSize: 20, color: '#9ca3af', cursor: 'pointer', padding: 4, lineHeight: 1 }}>
            &times;
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <RolesPermissions workspaceId={workspace.id} workspaceName={workspace.name} />
        </div>
      </div>
    </div>
  )
}