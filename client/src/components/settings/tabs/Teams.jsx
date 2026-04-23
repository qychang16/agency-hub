import { useState, useEffect } from 'react'
import { useAuth } from '../../../context/AuthContext'
import { API } from '../../../utils/constants'
import { ACCENT, ACCENT_LIGHT, NAVY } from '../../../utils/designTokens'
import { getRoleColor, getRoleLabel } from '../../../utils/permissions'

const TEAM_COLORS = [
  '#2563eb', '#7c3aed', '#059669', '#d97706',
  '#dc2626', '#0891b2', '#be185d', '#1a2332',
  '#65a30d', '#ea580c', '#0f766e', '#7e22ce',
]

const TEAM_TYPES = [
  { value: 'recruitment', label: 'Recruitment', icon: '🎯', desc: 'Handles candidate sourcing, screening and placement' },
  { value: 'client', label: 'Client Relations', icon: '🏢', desc: 'Manages client relationships and job briefs' },
  { value: 'executive', label: 'Executive Search', icon: '⭐', desc: 'Handles senior and C-suite level placements' },
  { value: 'admin', label: 'Admin', icon: '⚙️', desc: 'Back-office operations, data and compliance' },
  { value: 'support', label: 'Support', icon: '🤝', desc: 'General support and coordination' },
]

function Field({ label, hint, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: '#4a4742', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{label}</label>
      {hint && <div style={{ fontSize: 11, color: '#9a958c', marginBottom: 6 }}>{hint}</div>}
      {children}
    </div>
  )
}

function Input({ value, onChange, placeholder, disabled }) {
  return (
    <input value={value || ''} onChange={onChange} placeholder={placeholder} disabled={disabled}
      style={{ width: '100%', padding: '9px 12px', border: '0.5px solid #dcd8d0', borderRadius: 8, fontSize: 13, outline: 'none', background: disabled ? '#faf9f7' : '#fff', color: '#14130f', boxSizing: 'border-box' }} />
  )
}

function Select({ value, onChange, options }) {
  return (
    <select value={value || ''} onChange={onChange}
      style={{ width: '100%', padding: '9px 12px', border: '0.5px solid #dcd8d0', borderRadius: 8, fontSize: 13, outline: 'none', background: '#fff', color: '#14130f' }}>
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
  }
  return (
    <button onClick={!disabled ? onClick : undefined}
      style={{ ...sizes[size], ...variants[variant], borderRadius: 8, cursor: disabled ? 'default' : 'pointer', fontWeight: 500, opacity: disabled ? 0.6 : 1, display: 'inline-flex', alignItems: 'center', gap: 5, ...extra }}>
      {children}
    </button>
  )
}

function StatusDot({ status }) {
  const colors = { online: '#22c55e', away: '#f59e0b', offline: '#9a958c', busy: '#ef4444' }
  return <div style={{ width: 7, height: 7, borderRadius: '50%', background: colors[status] || '#9a958c', flexShrink: 0 }} />
}

function Modal({ title, subtitle, onClose, children, width = 540 }) {
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

function TeamModal({ team, agents, onClose, onSave }) {
  const { token } = useAuth()
  const [form, setForm] = useState({
    name: team?.name || '',
    type: team?.type || 'recruitment',
    lead_user_id: team?.lead_user_id || '',
    color: team?.color || '#2563eb',
    description: team?.description || '',
    members: (team?.members || []).map(m => m.id || m),
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [memberSearch, setMemberSearch] = useState('')
  const isEdit = !!team

  function toggleMember(id) {
    setForm(p => ({
      ...p,
      members: p.members.includes(id)
        ? p.members.filter(m => m !== id)
        : [...p.members, id]
    }))
  }

  async function save() {
    setError('')
    if (!form.name.trim()) { setError('Team name is required'); return }
    setSaving(true)
    try {
      const url = isEdit ? `${API}/teams/${team.id}` : `${API}/teams`
      const method = isEdit ? 'PATCH' : 'POST'
      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ ...form, key: form.name.toLowerCase().replace(/\s+/g, '_') })
      })
      if (!r.ok) { const d = await r.json(); setError(d.error || 'Failed to save'); return }
      onSave(); onClose()
    } catch { setError('Failed to save. Please try again.') }
    finally { setSaving(false) }
  }

  const filteredAgents = agents.filter(a =>
    !memberSearch || a.name?.toLowerCase().includes(memberSearch.toLowerCase())
  )

  const selectedType = TEAM_TYPES.find(t => t.value === form.type)

  return (
    <Modal title={isEdit ? `Edit Team — ${team.name}` : 'Create New Team'} subtitle={isEdit ? 'Update team settings and members' : 'Set up a new team and assign agents'} onClose={onClose}>
      <Field label="Team Name">
        <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Recruitment Team, KL Office, Executive Search" />
      </Field>

      <Field label="Team Type" hint="Determines routing behaviour and analytics categorisation">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {TEAM_TYPES.map(t => (
            <div key={t.value} onClick={() => setForm(p => ({ ...p, type: t.value }))}
              style={{ display: 'flex', gap: 10, padding: '10px 12px', borderRadius: 8, border: `1.5px solid ${form.type === t.value ? ACCENT : '#dcd8d0'}`, cursor: 'pointer', background: form.type === t.value ? ACCENT_LIGHT : '#fff', transition: 'all .1s' }}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>{t.icon}</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: form.type === t.value ? ACCENT : '#14130f' }}>{t.label}</div>
                <div style={{ fontSize: 10, color: '#9a958c', marginTop: 1, lineHeight: 1.4 }}>{t.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </Field>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Team Lead" hint="Lead is notified on SLA breaches and escalations">
          <Select value={form.lead_user_id} onChange={e => setForm(p => ({ ...p, lead_user_id: e.target.value }))} options={[
            { value: '', label: 'No lead assigned' },
            ...agents.map(a => ({ value: a.id, label: a.name }))
          ]} />
        </Field>
        <Field label="Team Colour">
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingTop: 4 }}>
            {TEAM_COLORS.map(c => (
              <button key={c} onClick={() => setForm(p => ({ ...p, color: c }))}
                style={{ width: 26, height: 26, borderRadius: 7, background: c, border: form.color === c ? '3px solid #14130f' : '2px solid transparent', cursor: 'pointer', transition: 'border .1s' }} />
            ))}
          </div>
        </Field>
      </div>

      <Field label="Description" hint="Brief summary of this team's responsibilities — visible to all agents">
        <Input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="e.g. Handles all candidate screening and placement for Singapore market" />
      </Field>

      <Field label={`Team Members — ${form.members.length} selected`} hint="Select agents to add to this team. No limit.">
        <div style={{ marginBottom: 8, position: 'relative' }}>
          <svg style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', width: 11, height: 11, color: '#9a958c', pointerEvents: 'none' }} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="7" cy="7" r="4"/><path d="M10.5 10.5l3 3" strokeLinecap="round"/></svg>
          <input value={memberSearch} onChange={e => setMemberSearch(e.target.value)} placeholder="Search agents…"
            style={{ width: '100%', padding: '7px 10px 7px 26px', border: '0.5px solid #dcd8d0', borderRadius: 7, fontSize: 12, outline: 'none', background: '#faf9f7', color: '#14130f', boxSizing: 'border-box' }} />
        </div>
        <div style={{ maxHeight: 200, overflowY: 'auto', border: '0.5px solid #dcd8d0', borderRadius: 9, padding: 6 }}>
          {filteredAgents.length === 0 ? (
            <div style={{ padding: '20px 0', textAlign: 'center', fontSize: 12, color: '#9a958c' }}>No agents found</div>
          ) : filteredAgents.map(a => {
            const selected = form.members.includes(a.id)
            const rc = getRoleColor(a.role)
            return (
              <div key={a.id} onClick={() => toggleMember(a.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 7, cursor: 'pointer', background: selected ? ACCENT_LIGHT : 'transparent', marginBottom: 2, transition: 'background .1s' }}
                onMouseEnter={e => { if (!selected) e.currentTarget.style.background = '#faf9f7' }}
                onMouseLeave={e => { if (!selected) e.currentTarget.style.background = 'transparent' }}>
                <div style={{ width: 16, height: 16, borderRadius: 4, border: `1.5px solid ${selected ? ACCENT : '#c2bdb3'}`, background: selected ? ACCENT : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all .15s' }}>
                  {selected && <svg width="9" height="9" viewBox="0 0 10 10"><path d="M1.5 5l2.5 2.5 5-5" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </div>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: rc.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: rc.color, flexShrink: 0 }}>
                  {a.name?.[0]?.toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: '#14130f' }}>{a.name}</div>
                  <div style={{ fontSize: 10, color: '#9a958c' }}>{getRoleLabel(a.role)}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <StatusDot status={a.status} />
                  <span style={{ fontSize: 10, color: '#9a958c', textTransform: 'capitalize' }}>{a.status || 'offline'}</span>
                </div>
                {parseInt(form.lead_user_id) === a.id && (
                  <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: '#fef3c7', color: '#92400e', fontWeight: 700 }}>Lead</span>
                )}
              </div>
            )
          })}
        </div>
        {form.members.length > 0 && (
          <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {form.members.map(id => {
              const a = agents.find(ag => ag.id === id)
              if (!a) return null
              return (
                <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 8px 3px 6px', background: ACCENT_LIGHT, borderRadius: 20, border: `0.5px solid ${ACCENT}30` }}>
                  <div style={{ width: 16, height: 16, borderRadius: '50%', background: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#fff' }}>{a.name?.[0]?.toUpperCase()}</div>
                  <span style={{ fontSize: 11, color: ACCENT, fontWeight: 500 }}>{a.name}</span>
                  <button onClick={e => { e.stopPropagation(); toggleMember(id) }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: ACCENT, fontSize: 12, padding: 0, lineHeight: 1 }}>×</button>
                </div>
              )
            })}
          </div>
        )}
      </Field>

      {error && (
        <div style={{ padding: '10px 12px', background: '#fef2f2', border: '0.5px solid #fecaca', borderRadius: 8, fontSize: 12, color: '#dc2626', marginBottom: 12 }}>
          ⚠ {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <Btn variant="ghost" onClick={onClose} style={{ flex: 1 }}>Cancel</Btn>
        <Btn onClick={save} disabled={saving} style={{ flex: 2 }}>{saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Team'}</Btn>
      </div>
    </Modal>
  )
}

export default function Teams() {
  const { token, hasPermission } = useAuth()
  const [teams, setTeams] = useState([])
  const [agents, setAgents] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [showEdit, setShowEdit] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const [t, a] = await Promise.all([
        fetch(`${API}/teams`, { headers: { Authorization: 'Bearer ' + token } }).then(r => r.json()),
        fetch(`${API}/agents`, { headers: { Authorization: 'Bearer ' + token } }).then(r => r.json()),
      ])
      setTeams(Array.isArray(t) ? t : [])
      setAgents(Array.isArray(a) ? a.filter(ag => ag.active) : [])
    } catch {} finally { setLoading(false) }
  }

  async function deleteTeam(team) {
    if (!confirm(`Delete "${team.name}"? Agents will be unassigned but not deleted. Conversation history is preserved.`)) return
    await fetch(`${API}/teams/${team.id}`, { method: 'DELETE', headers: { Authorization: 'Bearer ' + token } })
    load()
  }

  const totalAgentsInTeams = [...new Set(teams.flatMap(t => (t.members || []).map(m => m.id || m)))].length

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#14130f' }}>Teams</div>
          <div style={{ fontSize: 12, color: '#9a958c', marginTop: 3 }}>
            {teams.length} team{teams.length !== 1 ? 's' : ''} · {totalAgentsInTeams} agent{totalAgentsInTeams !== 1 ? 's' : ''} assigned
          </div>
        </div>
        {hasPermission('manage_teams') && <Btn onClick={() => setShowAdd(true)}>+ Create Team</Btn>}
      </div>

      {/* Info banner */}
      <div style={{ background: '#eeedf5', border: '0.5px solid #dcd8d0', borderRadius: 10, padding: '12px 16px', marginBottom: 20, display: 'flex', gap: 10 }}>
        <span style={{ fontSize: 16, flexShrink: 0 }}>💡</span>
        <div style={{ fontSize: 12, color: '#2d2a7a', lineHeight: 1.6 }}>
          <strong>Teams control routing.</strong> Candidates auto-route to your Recruitment team. Clients auto-route to your Client Relations team.
          Each team can have its own routing rules, SLA targets and business hours. An agent can belong to multiple teams.
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#9a958c' }}>
          <div style={{ fontSize: 28, marginBottom: 10 }}>⏳</div>
          <div>Loading teams…</div>
        </div>
      ) : teams.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #dcd8d0', padding: '60px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 14 }}>🤝</div>
          <div style={{ fontSize: 14, fontWeight: 500, color: '#6e6a63', marginBottom: 6 }}>No teams yet</div>
          <div style={{ fontSize: 12, color: '#9a958c', marginBottom: 20, maxWidth: 320, margin: '0 auto 20px' }}>
            Create teams to organise your agents and enable smart conversation routing
          </div>
          {hasPermission('manage_teams') && <Btn onClick={() => setShowAdd(true)}>+ Create First Team</Btn>}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
          {teams.map(t => {
            const typeInfo = TEAM_TYPES.find(tt => tt.value === t.type) || TEAM_TYPES[0]
            const members = t.members || []
            const onlineMembers = members.filter(m => m.status === 'online')
            const lead = members.find(m => (m.id || m) === t.lead_user_id)

            return (
              <div key={t.id} style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #dcd8d0', overflow: 'hidden' }}>
                {/* Team header */}
                <div style={{ padding: '16px 18px', borderBottom: '0.5px solid #f5f3ef', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <div style={{ width: 42, height: 42, borderRadius: 11, background: t.color + '18', border: `1.5px solid ${t.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                      {typeInfo.icon}
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#14130f', marginBottom: 3 }}>{t.name}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: t.color + '18', color: t.color, fontWeight: 600 }}>{typeInfo.label}</span>
                        <span style={{ fontSize: 10, color: '#9a958c' }}>{members.length} member{members.length !== 1 ? 's' : ''}</span>
                        {onlineMembers.length > 0 && (
                          <span style={{ fontSize: 10, color: '#16a34a' }}>· {onlineMembers.length} online</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 5 }}>
                    {hasPermission('manage_teams') && <Btn variant="ghost" size="sm" onClick={() => setShowEdit(t)}>Edit</Btn>}
                    {hasPermission('manage_teams') && <Btn variant="danger" size="sm" onClick={() => deleteTeam(t)}>Delete</Btn>}
                  </div>
                </div>

                {/* Description */}
                {t.description && (
                  <div style={{ padding: '10px 18px', fontSize: 12, color: '#6e6a63', borderBottom: '0.5px solid #faf9f7', lineHeight: 1.5 }}>
                    {t.description}
                  </div>
                )}

                {/* Team lead */}
                {lead && (
                  <div style={{ padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '0.5px solid #faf9f7' }}>
                    <span style={{ fontSize: 10, color: '#9a958c', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Lead</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 20, height: 20, borderRadius: 6, background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#92400e' }}>
                        {lead.name?.[0]?.toUpperCase()}
                      </div>
                      <span style={{ fontSize: 12, color: '#4a4742', fontWeight: 500 }}>{lead.name}</span>
                      <span style={{ fontSize: 10 }}>⭐</span>
                    </div>
                  </div>
                )}

                {/* Members */}
                <div style={{ padding: '12px 18px' }}>
                  {members.length === 0 ? (
                    <div style={{ fontSize: 12, color: '#9a958c', textAlign: 'center', padding: '10px 0' }}>No members yet — edit to add agents</div>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {members.map(m => (
                        <div key={m.id || m} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 9px', background: '#faf9f7', borderRadius: 8, border: '0.5px solid #dcd8d0' }}>
                          <StatusDot status={m.status} />
                          <span style={{ fontSize: 11, color: '#4a4742', fontWeight: 500 }}>{m.name}</span>
                          {(m.id || m) === t.lead_user_id && <span style={{ fontSize: 10 }}>⭐</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Footer stats */}
                <div style={{ padding: '10px 18px', background: '#faf9f7', borderTop: '0.5px solid #f5f3ef', display: 'flex', gap: 16 }}>
                  <div style={{ fontSize: 11, color: '#9a958c' }}>
                    <span style={{ fontWeight: 600, color: '#4a4742' }}>{onlineMembers.length}</span> online
                  </div>
                  <div style={{ fontSize: 11, color: '#9a958c' }}>
                    <span style={{ fontWeight: 600, color: '#4a4742' }}>{members.filter(m => m.status === 'away').length}</span> away
                  </div>
                  <div style={{ fontSize: 11, color: '#9a958c' }}>
                    <span style={{ fontWeight: 600, color: '#4a4742' }}>{members.filter(m => !m.status || m.status === 'offline').length}</span> offline
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showAdd && <TeamModal agents={agents} onClose={() => setShowAdd(false)} onSave={load} />}
      {showEdit && <TeamModal team={showEdit} agents={agents} onClose={() => setShowEdit(null)} onSave={load} />}
    </div>
  )
}