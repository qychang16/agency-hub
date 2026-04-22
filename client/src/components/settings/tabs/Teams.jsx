import { useState } from 'react'
import { useWorkspace } from '../../../context/WorkspaceContext'
import { ACCENT, ACCENT_LIGHT, ACCENT_MID, NAVY } from '../../../utils/constants'

const TEAM_COLORS = ['#2563eb','#7c3aed','#059669','#d97706','#dc2626','#0891b2','#db2777','#65a30d']

export default function Teams() {
  const { teams, agents, addTeam, updateTeam, deleteTeam } = useWorkspace()
  const [showModal, setShowModal] = useState(false)
  const [editingTeam, setEditingTeam] = useState(null)
  const [form, setForm] = useState({ label: '', key: '', type: 'recruitment', lead_user_id: '', color: '#2563eb', description: '', agents: [] })

  function openAdd() {
    setEditingTeam(null)
    setForm({ label: '', key: '', type: 'recruitment', lead_user_id: '', color: '#2563eb', description: '', agents: [] })
    setShowModal(true)
  }

  function openEdit(team) {
    setEditingTeam(team)
    setForm({ label: team.label, key: team.key, type: team.type, lead_user_id: team.lead_user_id || '', color: team.color, description: team.description || '', agents: team.agents || [] })
    setShowModal(true)
  }

  function handleSave() {
    if (!form.label.trim()) return alert('Team name is required.')
    const key = form.key || form.label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
    if (editingTeam) {
      updateTeam(editingTeam.id, { ...form, key })
    } else {
      addTeam({ ...form, key })
    }
    setShowModal(false)
  }

  function toggleAgent(agentName) {
    setForm(p => ({
      ...p,
      agents: p.agents.includes(agentName)
        ? p.agents.filter(a => a !== agentName)
        : [...p.agents, agentName]
    }))
  }

  return (
    <div style={{ padding: 28 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#111827', marginBottom: 4 }}>Teams</div>
          <div style={{ fontSize: 12, color: '#9ca3af' }}>Organise agents into teams for routing and reporting.</div>
        </div>
        <button onClick={openAdd}
          style={{ padding: '9px 18px', background: ACCENT, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
          + New Team
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
        {teams.map(team => {
          const teamAgents = agents.filter(a => team.agents?.includes(a.name) && a.active)
          const lead = agents.find(a => a.id === team.lead_user_id || a.name === team.lead_name)
          return (
            <div key={team.id} style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e5e7eb', overflow: 'hidden' }}
              onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)'}
              onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}>
              <div style={{ height: 4, background: team.color }} />
              <div style={{ padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', marginBottom: 3 }}>{team.label}</div>
                    <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 4, background: '#f1f4f9', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.3px' }}>{team.type}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 5 }}>
                    <button onClick={() => openEdit(team)}
                      style={{ padding: '4px 10px', border: '0.5px solid #d1d5db', borderRadius: 6, fontSize: 10, background: 'transparent', color: '#374151', cursor: 'pointer' }}>Edit</button>
                    <button onClick={() => { if (confirm('Delete this team?')) deleteTeam(team.id) }}
                      style={{ padding: '4px 10px', border: '0.5px solid #fca5a5', borderRadius: 6, fontSize: 10, background: 'transparent', color: '#dc2626', cursor: 'pointer' }}>Delete</button>
                  </div>
                </div>
                {team.description && <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 10 }}>{team.description}</div>}
                {lead && (
                  <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 10 }}>
                    <span style={{ color: '#9ca3af' }}>Lead: </span><strong>{lead.name}</strong>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {teamAgents.slice(0, 6).map(a => (
                    <div key={a.name} style={{ width: 28, height: 28, borderRadius: 7, background: team.color + '20', border: `1px solid ${team.color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: team.color, title: a.name }}>
                      {a.name[0]}
                    </div>
                  ))}
                  {teamAgents.length > 6 && (
                    <div style={{ width: 28, height: 28, borderRadius: 7, background: '#f1f4f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#9ca3af' }}>
                      +{teamAgents.length - 6}
                    </div>
                  )}
                  {teamAgents.length === 0 && <span style={{ fontSize: 11, color: '#9ca3af' }}>No agents assigned</span>}
                </div>
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: '0.5px solid #f1f4f9', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 11, color: '#9ca3af' }}>{teamAgents.length} agent{teamAgents.length !== 1 ? 's' : ''}</span>
                  <span style={{ fontSize: 10, color: '#9ca3af', fontFamily: 'monospace' }}>{team.key}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 80, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 24, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#111827', marginBottom: 20 }}>{editingTeam ? 'Edit Team' : 'Create New Team'}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 500, color: '#6b7280', display: 'block', marginBottom: 4 }}>Team Name *</label>
                <input value={form.label} onChange={e => setForm(p => ({ ...p, label: e.target.value }))} placeholder="e.g. Recruitment Team"
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: 7, fontSize: 12, outline: 'none', background: '#f9fafb', color: '#111827', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 500, color: '#6b7280', display: 'block', marginBottom: 4 }}>Type</label>
                <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: 7, fontSize: 12, background: '#f9fafb', color: '#111827', outline: 'none' }}>
                  <option value="recruitment">Recruitment</option>
                  <option value="client">Client Relations</option>
                  <option value="admin">Admin</option>
                  <option value="executive">Executive Search</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 500, color: '#6b7280', display: 'block', marginBottom: 4 }}>Team Lead</label>
                <select value={form.lead_user_id} onChange={e => setForm(p => ({ ...p, lead_user_id: e.target.value }))}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: 7, fontSize: 12, background: '#f9fafb', color: '#111827', outline: 'none' }}>
                  <option value="">No lead</option>
                  {agents.filter(a => a.active).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 500, color: '#6b7280', display: 'block', marginBottom: 4 }}>Team Colour</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {TEAM_COLORS.map(c => (
                    <button key={c} onClick={() => setForm(p => ({ ...p, color: c }))}
                      style={{ width: 24, height: 24, borderRadius: 6, background: c, border: form.color === c ? `2px solid #111827` : '2px solid transparent', cursor: 'pointer', padding: 0 }} />
                  ))}
                </div>
              </div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 500, color: '#6b7280', display: 'block', marginBottom: 4 }}>Description</label>
              <input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Brief description of this team's function"
                style={{ width: '100%', padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: 7, fontSize: 12, outline: 'none', background: '#f9fafb', color: '#111827', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 11, fontWeight: 500, color: '#6b7280', display: 'block', marginBottom: 8 }}>Assign Agents</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {agents.filter(a => a.active).map(a => (
                  <label key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 7, border: `1px solid ${form.agents.includes(a.name) ? ACCENT : '#e5e7eb'}`, background: form.agents.includes(a.name) ? ACCENT_LIGHT : '#f9fafb', cursor: 'pointer' }}>
                    <input type="checkbox" checked={form.agents.includes(a.name)} onChange={() => toggleAgent(a.name)} style={{ accentColor: ACCENT }} />
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 500, color: '#374151' }}>{a.name}</div>
                      <div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'capitalize' }}>{a.role?.replace('_', ' ')}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowModal(false)}
                style={{ flex: 1, padding: '9px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12, color: '#6b7280', background: '#fff', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleSave}
                style={{ flex: 2, padding: '9px', background: ACCENT, color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{editingTeam ? 'Save Changes' : 'Create Team'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}