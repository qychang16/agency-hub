import { useState } from 'react'
import { useWorkspace } from '../../../context/WorkspaceContext'
import { useAuth } from '../../../context/AuthContext'
import { ACCENT, ACCENT_LIGHT, ACCENT_MID, NAVY } from '../../../utils/constants'
import { getRoleColor, getRoleLabel } from '../../../utils/permissions'

const ROLES = ['director','manager','senior_consultant','consultant','admin','viewer']

export default function Agents() {
  const { agents, addAgent, updateAgent, deactivateAgent, reactivateAgent, teams } = useWorkspace()
  const { user } = useAuth()
  const [showModal, setShowModal] = useState(false)
  const [editingAgent, setEditingAgent] = useState(null)
  const [showResetPassword, setShowResetPassword] = useState(null)
  const [newPassword, setNewPassword] = useState('')
  const [search, setSearch] = useState('')
  const [filterRole, setFilterRole] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [form, setForm] = useState({ name: '', email: '', role: 'consultant', team_id: '', capacity: 20, send_behaviour: 'enter' })
  const [saved, setSaved] = useState(false)

  const filtered = agents.filter(a => {
    const ms = !search || a.name.toLowerCase().includes(search.toLowerCase()) || a.email?.toLowerCase().includes(search.toLowerCase())
    const rs = filterRole === 'all' || a.role === filterRole
    const ss = filterStatus === 'all' || (filterStatus === 'active' ? a.active : !a.active)
    return ms && rs && ss
  })

  function openAdd() {
    setEditingAgent(null)
    setForm({ name: '', email: '', role: 'consultant', team_id: '', capacity: 20, send_behaviour: 'enter' })
    setShowModal(true)
  }

  function openEdit(agent) {
    setEditingAgent(agent)
    setForm({ name: agent.name, email: agent.email, role: agent.role, team_id: agent.team_id || '', capacity: agent.capacity || 20, send_behaviour: agent.send_behaviour || 'enter' })
    setShowModal(true)
  }

  function handleSave() {
    if (!form.name.trim() || !form.email.trim()) return alert('Name and email are required.')
    if (editingAgent) {
      updateAgent(editingAgent.id, form)
    } else {
      addAgent(form)
    }
    setShowModal(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const statusColors = { online: '#16a34a', away: '#d97706', busy: '#dc2626', offline: '#9ca3af' }

  return (
    <div style={{ padding: 28 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#111827', marginBottom: 4 }}>Agents</div>
          <div style={{ fontSize: 12, color: '#9ca3af' }}>Manage your team members, roles and access levels.</div>
        </div>
        <button onClick={openAdd}
          style={{ padding: '9px 18px', background: ACCENT, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
          + Add Agent
        </button>
      </div>

      {/* Filters */}
      <div style={{ background: '#fff', borderRadius: 10, border: '0.5px solid #e5e7eb', padding: '12px 16px', marginBottom: 16, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
          <svg style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', width: 12, height: 12, color: '#9ca3af', pointerEvents: 'none' }} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="7" cy="7" r="4"/><path d="M10.5 10.5l3 3" strokeLinecap="round"/></svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search agents…"
            style={{ width: '100%', padding: '7px 9px 7px 28px', border: '0.5px solid #d1d5db', borderRadius: 7, fontSize: 12, background: '#f9fafb', color: '#111827', outline: 'none', boxSizing: 'border-box' }} />
        </div>
        <select value={filterRole} onChange={e => setFilterRole(e.target.value)}
          style={{ padding: '7px 10px', border: '0.5px solid #d1d5db', borderRadius: 7, fontSize: 12, background: '#f9fafb', color: '#111827', outline: 'none' }}>
          <option value="all">All Roles</option>
          {ROLES.map(r => <option key={r} value={r}>{getRoleLabel(r)}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          style={{ padding: '7px 10px', border: '0.5px solid #d1d5db', borderRadius: 7, fontSize: 12, background: '#f9fafb', color: '#111827', outline: 'none' }}>
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Deactivated</option>
        </select>
        <span style={{ fontSize: 11, color: '#9ca3af' }}>{filtered.length} agent{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Agent list */}
      <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e5e7eb', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f9fafb' }}>
              {['Agent', 'Role', 'Team', 'Status', 'Capacity', 'Send Behaviour', 'Actions'].map(h => (
                <th key={h} style={{ padding: '10px 16px', fontSize: 10, fontWeight: 600, color: '#9ca3af', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '0.5px solid #f1f4f9' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(a => {
              const rc = getRoleColor(a.role)
              const teamName = teams.find(t => t.id === a.team_id)?.label || '—'
              return (
                <tr key={a.id} style={{ borderBottom: '0.5px solid #f9fafb', opacity: a.active ? 1 : 0.5 }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: ACCENT_MID, color: '#1e40af', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0, position: 'relative' }}>
                        {a.name[0]}
                        <div style={{ position: 'absolute', bottom: -2, right: -2, width: 8, height: 8, borderRadius: '50%', background: statusColors[a.status] || '#9ca3af', border: '1.5px solid #fff' }} />
                      </div>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#111827' }}>{a.name}</div>
                        <div style={{ fontSize: 10, color: '#9ca3af' }}>{a.email}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 5, background: rc.bg, color: rc.color, fontWeight: 600 }}>{getRoleLabel(a.role)}</span>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: '#6b7280' }}>{teamName}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: statusColors[a.status] || '#9ca3af' }} />
                      <span style={{ fontSize: 11, color: '#374151', textTransform: 'capitalize' }}>{a.status || 'offline'}</span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: '#374151' }}>{a.capacity} convos</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4, background: '#f1f4f9', color: '#6b7280' }}>
                      {a.send_behaviour === 'enter' ? '↵ Enter' : a.send_behaviour === 'ctrl_enter' ? 'Ctrl+↵' : 'Button only'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: 5 }}>
                      <button onClick={() => openEdit(a)}
                        style={{ padding: '4px 10px', border: '0.5px solid #d1d5db', borderRadius: 6, fontSize: 10, background: 'transparent', color: '#374151', cursor: 'pointer' }}>
                        Edit
                      </button>
                      <button onClick={() => setShowResetPassword(a)}
                        style={{ padding: '4px 10px', border: '0.5px solid #d1d5db', borderRadius: 6, fontSize: 10, background: 'transparent', color: '#374151', cursor: 'pointer' }}>
                        Reset PW
                      </button>
                      {a.id !== user.id && (
                        <button onClick={() => a.active ? deactivateAgent(a.id) : reactivateAgent(a.id)}
                          style={{ padding: '4px 10px', border: `0.5px solid ${a.active ? '#fca5a5' : '#86efac'}`, borderRadius: 6, fontSize: 10, background: 'transparent', color: a.active ? '#dc2626' : '#16a34a', cursor: 'pointer' }}>
                          {a.active ? 'Deactivate' : 'Reactivate'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '30px 0', color: '#9ca3af', fontSize: 12 }}>No agents found</div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 80, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 24, width: '100%', maxWidth: 480 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#111827', marginBottom: 4 }}>{editingAgent ? 'Edit Agent' : 'Add New Agent'}</div>
            <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 20 }}>
              {editingAgent ? 'Update agent details and permissions.' : 'New agent will receive a Welcome email with login instructions.'}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 500, color: '#6b7280', display: 'block', marginBottom: 4 }}>Full Name *</label>
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Aisha Binte Abdullah"
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: 7, fontSize: 12, outline: 'none', background: '#f9fafb', color: '#111827', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 500, color: '#6b7280', display: 'block', marginBottom: 4 }}>Email Address *</label>
                <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="aisha@yourcompany.com"
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: 7, fontSize: 12, outline: 'none', background: '#f9fafb', color: '#111827', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 500, color: '#6b7280', display: 'block', marginBottom: 4 }}>Role *</label>
                <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: 7, fontSize: 12, background: '#f9fafb', color: '#111827', outline: 'none' }}>
                  {ROLES.map(r => <option key={r} value={r}>{getRoleLabel(r)}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 500, color: '#6b7280', display: 'block', marginBottom: 4 }}>Team</label>
                <select value={form.team_id} onChange={e => setForm(p => ({ ...p, team_id: e.target.value }))}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: 7, fontSize: 12, background: '#f9fafb', color: '#111827', outline: 'none' }}>
                  <option value="">No team</option>
                  {teams.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 500, color: '#6b7280', display: 'block', marginBottom: 4 }}>Max Conversations</label>
                <input type="number" value={form.capacity} onChange={e => setForm(p => ({ ...p, capacity: parseInt(e.target.value) }))} min={1} max={100}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: 7, fontSize: 12, outline: 'none', background: '#f9fafb', color: '#111827', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 500, color: '#6b7280', display: 'block', marginBottom: 4 }}>Send Behaviour</label>
                <select value={form.send_behaviour} onChange={e => setForm(p => ({ ...p, send_behaviour: e.target.value }))}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: 7, fontSize: 12, background: '#f9fafb', color: '#111827', outline: 'none' }}>
                  <option value="enter">Enter to send</option>
                  <option value="ctrl_enter">Ctrl+Enter to send</option>
                  <option value="button">Button only</option>
                </select>
              </div>
            </div>
            {!editingAgent && (
              <div style={{ padding: '10px 12px', background: '#fffbeb', border: '0.5px solid #fde68a', borderRadius: 7, fontSize: 11, color: '#92400e', marginBottom: 16 }}>
                ℹ️ Default password: <strong>Welcome@123</strong> — agent must change on first login.
              </div>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowModal(false)}
                style={{ flex: 1, padding: '9px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12, color: '#6b7280', background: '#fff', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={handleSave}
                style={{ flex: 2, padding: '9px', background: ACCENT, color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                {editingAgent ? 'Save Changes' : 'Add Agent'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {showResetPassword && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 80, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 24, width: '100%', maxWidth: 380 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 4 }}>Reset Password</div>
            <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 16 }}>Resetting password for <strong>{showResetPassword.name}</strong>. They will be required to change it on next login.</div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, fontWeight: 500, color: '#6b7280', display: 'block', marginBottom: 5 }}>New Password</label>
              <input type="text" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Enter new password"
                style={{ width: '100%', padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: 7, fontSize: 12, outline: 'none', background: '#f9fafb', color: '#111827', boxSizing: 'border-box' }} />
              <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 4 }}>Leave blank to use default: Welcome@123</div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { setShowResetPassword(null); setNewPassword('') }}
                style={{ flex: 1, padding: '8px', border: '1px solid #e5e7eb', borderRadius: 7, fontSize: 12, color: '#6b7280', background: '#fff', cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => { alert(`Password reset for ${showResetPassword.name}`); setShowResetPassword(null); setNewPassword('') }}
                style={{ flex: 1, padding: '8px', background: NAVY, color: '#fff', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>Reset Password</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}