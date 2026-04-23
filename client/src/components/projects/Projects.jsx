import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../context/AuthContext'
import { API } from '../../utils/constants'
import { ACCENT, ACCENT_LIGHT, NAVY } from '../../utils/designTokens'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const COLOURS = [
  '#2563eb','#7c3aed','#db2777','#dc2626','#ea580c',
  '#d97706','#16a34a','#0891b2','#0f766e','#4f46e5',
  '#9333ea','#c026d3'
]

function Btn({ onClick, children, variant = 'primary', size = 'md', disabled, style: extra }) {
  const sizes = { sm: { padding: '5px 10px', fontSize: 11 }, md: { padding: '8px 14px', fontSize: 12 } }
  const variants = {
    primary: { background: ACCENT, color: '#fff', border: 'none' },
    ghost: { background: 'transparent', color: '#6b7280', border: '0.5px solid #e5e7eb' },
    danger: { background: '#fee2e2', color: '#dc2626', border: '0.5px solid #fca5a5' },
    dark: { background: NAVY, color: '#fff', border: 'none' },
  }
  return (
    <button onClick={!disabled ? onClick : undefined}
      style={{ ...sizes[size], ...variants[variant], borderRadius: 8, cursor: disabled ? 'default' : 'pointer', fontWeight: 500, opacity: disabled ? 0.6 : 1, display: 'inline-flex', alignItems: 'center', gap: 6, ...extra }}>
      {children}
    </button>
  )
}

function ColourPicker({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {COLOURS.map(c => (
        <div key={c} onClick={() => onChange(c)}
          style={{ width: 28, height: 28, borderRadius: '50%', background: c, cursor: 'pointer', border: value === c ? '3px solid #111827' : '3px solid transparent', boxSizing: 'border-box', transition: 'border .15s' }} />
      ))}
    </div>
  )
}

function ProjectModal({ project, onClose, onSaved }) {
  const { token } = useAuth()
  const now = new Date()
  const [clientName, setClientName] = useState(project?.client_name || '')
  const [month, setMonth] = useState(project?.start_month || MONTHS[now.getMonth()])
  const [year, setYear] = useState(project?.start_year || now.getFullYear())
  const [colour, setColour] = useState(project?.colour || '#2563eb')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const isEdit = !!project

  const years = []
  for (let y = 2020; y <= now.getFullYear() + 2; y++) years.push(y)

  async function save() {
    setError('')
    if (!clientName.trim()) { setError('Client name is required'); return }
    setSaving(true)
    try {
      const url = isEdit ? `${API}/projects/${project.id}` : `${API}/projects`
      const method = isEdit ? 'PATCH' : 'POST'
      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ client_name: clientName.trim(), start_month: month, start_year: year, colour })
      })
      if (!r.ok) { const d = await r.json(); setError(d.error || 'Failed to save'); return }
      onSaved()
      onClose()
    } catch { setError('Failed to save. Please try again.') }
    finally { setSaving(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 480, overflow: 'hidden' }}>
        <div style={{ padding: '18px 24px', borderBottom: '0.5px solid #f1f4f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{isEdit ? 'Edit Project' : 'New Project'}</div>
            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>Projects organise your inbox by client engagement</div>
          </div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 7, border: '0.5px solid #e5e7eb', background: '#f9fafb', cursor: 'pointer', fontSize: 14, color: '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>X</button>
        </div>
        <div style={{ padding: 24 }}>
          {/* Preview */}
          <div style={{ marginBottom: 20, padding: '12px 16px', borderRadius: 10, background: '#f9fafb', border: '0.5px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: colour, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{clientName || 'Client Name'}</div>
              <div style={{ fontSize: 12, color: '#9ca3af' }}>{month} {year}</div>
            </div>
          </div>

          {/* Client name */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
              Client Name <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="e.g. ABC Pte Ltd"
              autoFocus
              style={{ width: '100%', padding: '9px 12px', border: '0.5px solid #e5e7eb', borderRadius: 8, fontSize: 13, outline: 'none', background: '#fff', color: '#111827', boxSizing: 'border-box' }} />
          </div>

          {/* Month + Year */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Start Month</label>
              <select value={month} onChange={e => setMonth(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', border: '0.5px solid #e5e7eb', borderRadius: 8, fontSize: 13, outline: 'none', background: '#fff', color: '#111827' }}>
                {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Start Year</label>
              <select value={year} onChange={e => setYear(parseInt(e.target.value))}
                style={{ width: '100%', padding: '9px 12px', border: '0.5px solid #e5e7eb', borderRadius: 8, fontSize: 13, outline: 'none', background: '#fff', color: '#111827' }}>
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>

          {/* Colour */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Colour</label>
            <ColourPicker value={colour} onChange={setColour} />
          </div>

          {error && <div style={{ padding: '10px 12px', background: '#fef2f2', border: '0.5px solid #fecaca', borderRadius: 8, fontSize: 12, color: '#dc2626', marginBottom: 16 }}>! {error}</div>}

          <div style={{ display: 'flex', gap: 10 }}>
            <Btn variant="ghost" onClick={onClose} style={{ flex: 1 }}>Cancel</Btn>
            <Btn onClick={save} disabled={saving} style={{ flex: 2 }}>
              {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Project'}
            </Btn>
          </div>
        </div>
      </div>
    </div>
  )
}

// Inline rename component
function InlineRename({ project, onSaved, onCancel }) {
  const { token } = useAuth()
  const [value, setValue] = useState(project.client_name)
  const inputRef = useRef(null)

  useEffect(() => { inputRef.current?.focus(); inputRef.current?.select() }, [])

  async function save() {
    if (!value.trim() || value.trim() === project.client_name) { onCancel(); return }
    try {
      await fetch(`${API}/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ client_name: value.trim() })
      })
      onSaved()
    } catch { onCancel() }
  }

  return (
    <input ref={inputRef} value={value}
      onChange={e => setValue(e.target.value)}
      onBlur={save}
      onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') onCancel() }}
      style={{ fontSize: 14, fontWeight: 600, color: '#111827', border: 'none', borderBottom: `2px solid ${ACCENT}`, outline: 'none', background: 'transparent', width: '100%', padding: '2px 0' }} />
  )
}

function ProjectCard({ project, onEdit, onArchive, onRestore, onDelete, onSelect, onRenamed, canManageProjects }) {
  const [renaming, setRenaming] = useState(false)
  const [hovering, setHovering] = useState(false)
  const isArchived = project.status === 'archived'

  const activeConvos = parseInt(project.active_conversations) || 0
  const totalConvos = parseInt(project.total_conversations) || 0
  const unread = parseInt(project.unread_conversations) || 0

  return (
    <div
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      style={{ background: '#fff', borderRadius: 12, border: `0.5px solid ${hovering && !isArchived ? project.colour + '60' : '#e5e7eb'}`, overflow: 'hidden', opacity: isArchived ? 0.7 : 1, transition: 'all .15s', cursor: isArchived ? 'default' : 'pointer' }}>

      {/* Colour bar */}
      <div style={{ height: 4, background: project.colour }} />

      <div style={{ padding: '16px 18px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
          <div style={{ width: 42, height: 42, borderRadius: 10, background: project.colour + '20', border: `1.5px solid ${project.colour}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ fontSize: 18 }}>[P]</span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            {renaming && canManageProjects ? (
              <InlineRename project={project} onSaved={() => { setRenaming(false); onRenamed() }} onCancel={() => setRenaming(false)} />
            ) : (
              <div style={{ fontSize: 14, fontWeight: 600, color: isArchived ? '#9ca3af' : '#111827', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                onDoubleClick={() => !isArchived && canManageProjects && setRenaming(true)}
                title={canManageProjects ? 'Double-click to rename' : undefined}>
                {project.client_name}
              </div>
            )}
            <div style={{ fontSize: 12, color: '#9ca3af' }}>{project.start_month} {project.start_year}</div>
          </div>
          {isArchived && (
            <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 6, background: '#f1f4f9', color: '#9ca3af', fontWeight: 600, flexShrink: 0 }}>ARCHIVED</span>
          )}
          {unread > 0 && !isArchived && (
            <div style={{ minWidth: 20, height: 20, borderRadius: 10, background: '#dc2626', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px', flexShrink: 0 }}>{unread}</div>
          )}
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
          {[
            { label: 'Active', value: activeConvos, color: project.colour },
            { label: 'Total', value: totalConvos, color: '#6b7280' },
            { label: 'Unread', value: unread, color: unread > 0 ? '#dc2626' : '#6b7280' },
          ].map(s => (
            <div key={s.label} style={{ textAlign: 'center', padding: '8px 4px', background: '#f9fafb', borderRadius: 8 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 1 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Last activity */}
        {project.last_activity && (
          <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 14 }}>
            Last activity: {new Date(project.last_activity).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {!isArchived && (
            <>
              <Btn size="sm" onClick={() => onSelect(project)} style={{ flex: 1, justifyContent: 'center' }}>
                Open
              </Btn>
              {canManageProjects && (
                <>
                  <Btn variant="ghost" size="sm" onClick={() => setRenaming(true)} title="Rename">Rename</Btn>
                  <Btn variant="ghost" size="sm" onClick={() => onEdit(project)} title="Edit">Edit</Btn>
                  <Btn variant="ghost" size="sm" onClick={() => onArchive(project)} title="Archive">Archive</Btn>
                </>
              )}
            </>
          )}
          {isArchived && canManageProjects && (
            <>
              <Btn variant="ghost" size="sm" onClick={() => onRestore(project)} style={{ flex: 1, justifyContent: 'center' }}>Restore</Btn>
              <Btn variant="danger" size="sm" onClick={() => onDelete(project)}>Delete</Btn>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// Members panel (inside a project)
function MembersPanel({ project, agents, canManageMembers }) {
  const { token } = useAuth()
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState('')
  const [selectedRole, setSelectedRole] = useState('member')
  const [error, setError] = useState('')

  useEffect(() => { load() }, [project.id])

  async function load() {
    setLoading(true)
    try {
      const r = await fetch(`${API}/projects/${project.id}/members`, { headers: { Authorization: 'Bearer ' + token } })
      const data = await r.json()
      setMembers(Array.isArray(data) ? data : [])
    } catch {} finally { setLoading(false) }
  }

  async function addMember() {
    setError('')
    if (!selectedUserId) { setError('Please select a staff member to add'); return }
    try {
      const r = await fetch(`${API}/projects/${project.id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ user_id: parseInt(selectedUserId), role_in_project: selectedRole })
      })
      if (!r.ok) { const d = await r.json(); setError(d.error || 'Failed to add member'); return }
      setSelectedUserId(''); setSelectedRole('member'); setAdding(false)
      load()
    } catch { setError('Failed to add member. Please try again.') }
  }

  async function changeRole(userId, newRole) {
    await fetch(`${API}/projects/${project.id}/members/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ role_in_project: newRole })
    })
    load()
  }

  async function removeMember(userId, memberName) {
    if (!confirm(`Remove ${memberName} from this project? They will lose access to its conversations.`)) return
    await fetch(`${API}/projects/${project.id}/members/${userId}`, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer ' + token }
    })
    load()
  }

  const memberIds = new Set(members.map(m => m.user_id))
  const eligibleToAdd = agents.filter(a => a.active && !memberIds.has(a.id))
  const leads = members.filter(m => m.role_in_project === 'lead')
  const regulars = members.filter(m => m.role_in_project !== 'lead')

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      {/* Add member card */}
      <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e5e7eb', overflow: 'hidden', marginBottom: 16 }}>
        <div style={{ padding: '14px 18px', borderBottom: '0.5px solid #f1f4f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>Project team</div>
            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
              {members.length} {members.length === 1 ? 'member' : 'members'} - {leads.length} lead{leads.length !== 1 ? 's' : ''}
            </div>
          </div>
          {canManageMembers && !adding && eligibleToAdd.length > 0 && (
            <Btn onClick={() => setAdding(true)}>+ Add member</Btn>
          )}
        </div>

        {canManageMembers && adding && (
          <div style={{ padding: '14px 18px', background: '#f9fafb', borderBottom: '0.5px solid #f1f4f9' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto auto', gap: 10, alignItems: 'center' }}>
              <select value={selectedUserId} onChange={e => setSelectedUserId(e.target.value)}
                style={{ padding: '9px 12px', border: '0.5px solid #e5e7eb', borderRadius: 8, fontSize: 13, outline: 'none', background: '#fff', color: '#111827', cursor: 'pointer' }}>
                <option value="">-- Select a staff member --</option>
                {eligibleToAdd.map(a => (
                  <option key={a.id} value={a.id}>{a.name} - {a.role}</option>
                ))}
              </select>
              <select value={selectedRole} onChange={e => setSelectedRole(e.target.value)}
                style={{ padding: '9px 12px', border: '0.5px solid #e5e7eb', borderRadius: 8, fontSize: 13, outline: 'none', background: '#fff', color: '#111827', cursor: 'pointer' }}>
                <option value="member">Member</option>
                <option value="lead">Lead</option>
              </select>
              <Btn onClick={addMember}>Add</Btn>
              <Btn variant="ghost" onClick={() => { setAdding(false); setError(''); setSelectedUserId('') }}>Cancel</Btn>
            </div>
            {error && <div style={{ marginTop: 8, fontSize: 11, color: '#dc2626' }}>! {error}</div>}
          </div>
        )}

        {loading ? (
          <div style={{ padding: 30, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>Loading members...</div>
        ) : members.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>[T]</div>
            <div style={{ fontSize: 13, fontWeight: 500, color: '#6b7280', marginBottom: 4 }}>No team members yet</div>
            <div style={{ fontSize: 12, color: '#9ca3af' }}>
              {canManageMembers && eligibleToAdd.length > 0
                ? 'Add staff to give them access to this project.'
                : canManageMembers
                  ? 'All active staff are already members, or you have no staff yet. Add staff in Settings > Agents first.'
                  : 'No members assigned to this project.'}
            </div>
          </div>
        ) : (
          <div>
            {[...leads, ...regulars].map(m => (
              <div key={m.user_id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', borderBottom: '0.5px solid #f9fafb' }}>
                {/* Avatar */}
                <div style={{ width: 36, height: 36, borderRadius: 10, background: project.colour + '20', border: `1px solid ${project.colour}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: project.colour, flexShrink: 0 }}>
                  {m.name?.[0]?.toUpperCase()}
                </div>
                {/* Name + email */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{m.name}</div>
                    <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 6, background: '#f1f4f9', color: '#6b7280', textTransform: 'capitalize', fontWeight: 600 }}>{m.user_role}</span>
                    {m.role_in_project === 'lead' && (
                      <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 6, background: '#fef3c7', color: '#92400e', fontWeight: 700 }}>LEAD</span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{m.email}</div>
                </div>
                {/* Role toggle */}
                {canManageMembers ? (
                  <select value={m.role_in_project} onChange={e => changeRole(m.user_id, e.target.value)}
                    style={{ padding: '6px 10px', border: '0.5px solid #e5e7eb', borderRadius: 6, fontSize: 11, outline: 'none', background: '#fff', color: '#111827', cursor: 'pointer' }}>
                    <option value="member">Member</option>
                    <option value="lead">Lead</option>
                  </select>
                ) : (
                  <span style={{ fontSize: 11, color: '#6b7280', textTransform: 'capitalize', padding: '4px 10px' }}>{m.role_in_project}</span>
                )}
                {/* Remove */}
                {canManageMembers && (
                  <Btn variant="danger" size="sm" onClick={() => removeMember(m.user_id, m.name)}>Remove</Btn>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Helper note */}
      <div style={{ background: '#eff6ff', border: '0.5px solid #bfdbfe', borderRadius: 10, padding: '12px 16px', fontSize: 12, color: '#1e40af', display: 'flex', gap: 10 }}>
        <span style={{ fontSize: 16, flexShrink: 0 }}>i</span>
        <div style={{ lineHeight: 1.6 }}>
          <strong>Leads</strong> are point-of-contact for the client and typically manage the project end-to-end.
          <strong>Members</strong> handle day-to-day conversations alongside leads. Both can reply on any phone line assigned to this project.
        </div>
      </div>
    </div>
  )
}

function ProjectView({ project, onBack, onRenamed, canManageProjects, canManageMembers }) {
  const { token } = useAuth()
  const [view, setView] = useState('conversations')
  const [conversations, setConversations] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [search, setSearch] = useState('')
  const [agentFilter, setAgentFilter] = useState('all')
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [agents, setAgents] = useState([])
  const [renaming, setRenaming] = useState(false)

  const clients = conversations.filter(c => c.type === 'client')
  const candidates = conversations.filter(c => c.type === 'candidate')

  useEffect(() => { load(1, true) }, [agentFilter, unreadOnly])
  useEffect(() => { loadAgents() }, [])

  async function loadAgents() {
    try {
      const r = await fetch(`${API}/agents`, { headers: { Authorization: 'Bearer ' + token } })
      const data = await r.json()
      setAgents(Array.isArray(data) ? data : [])
    } catch {}
  }

  async function load(p = 1, reset = false) {
    if (p === 1) setLoading(true); else setLoadingMore(true)
    try {
      let url = `${API}/projects/${project.id}/conversations?page=${p}&limit=50`
      if (agentFilter !== 'all') url += `&agent_id=${agentFilter}`
      if (unreadOnly) url += `&unread=true`
      const r = await fetch(url, { headers: { Authorization: 'Bearer ' + token } })
      const data = await r.json()
      const convos = Array.isArray(data.conversations) ? data.conversations : []
      setConversations(reset || p === 1 ? convos : prev => [...prev, ...convos])
      setTotal(data.total || 0)
      setPage(p)
    } catch {} finally { setLoading(false); setLoadingMore(false) }
  }

  const filtered = conversations.filter(c =>
    !search || c.name?.toLowerCase().includes(search.toLowerCase()) || c.phone?.includes(search)
  )
  const filteredClients = filtered.filter(c => c.type === 'client')
  const filteredCandidates = filtered.filter(c => c.type === 'candidate')
  const hasMore = conversations.length < total

  function ConvoRow({ c }) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '0.5px solid #f9fafb', cursor: 'pointer', transition: 'background .1s' }}
        onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
        {/* Avatar */}
        <div style={{ width: 38, height: 38, borderRadius: 10, background: c.type === 'client' ? ACCENT : '#f5e9d6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: c.type === 'client' ? '#fff' : '#7a5a1f', flexShrink: 0 }}>
          {c.name?.[0]?.toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{c.name}</span>
            <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 3, background: c.type === 'client' ? ACCENT : '#f5e9d6', color: c.type === 'client' ? '#fff' : '#7a5a1f', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {c.type === 'client' ? 'CLIENT' : 'CANDIDATE'}
            </span>
            {c.pipeline_stage && (
              <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: '#f1f4f9', color: '#6b7280', textTransform: 'capitalize' }}>{c.pipeline_stage}</span>
            )}
          </div>
          <div style={{ fontSize: 11, color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {c.preview || c.phone}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5, flexShrink: 0 }}>
          {c.last_message_at && (
            <span style={{ fontSize: 10, color: '#9ca3af' }}>
              {new Date(c.last_message_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
            </span>
          )}
          {c.assigned_name && (
            <span style={{ fontSize: 10, color: '#6b7280', background: '#f1f4f9', padding: '1px 6px', borderRadius: 4 }}>{c.assigned_name}</span>
          )}
          {c.unread_count > 0 && (
            <div style={{ minWidth: 18, height: 18, borderRadius: 9, background: '#dc2626', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>{c.unread_count}</div>
          )}
          {c.phone_line && (
            <span style={{ fontSize: 9, color: '#9ca3af' }}>{c.phone_line}</span>
          )}
        </div>
      </div>
    )
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#faf9f7', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}>
      {/* Header - cream, editorial, matches Inbox */}
      <div style={{ padding: '20px 28px 16px', flexShrink: 0, borderBottom: '0.5px solid #dcd8d0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
          <button onClick={onBack}
            style={{ background: '#fff', border: '0.5px solid #dcd8d0', color: '#4a4742', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 5 }}>
            &larr; Back
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: project.colour, flexShrink: 0 }} />
              {renaming && canManageProjects ? (
                <InlineRename project={project} onSaved={() => { setRenaming(false); onRenamed() }} onCancel={() => setRenaming(false)} />
              ) : (
                <div style={{ fontSize: 22, fontWeight: 700, color: '#14130f', letterSpacing: '-0.3px', cursor: canManageProjects ? 'pointer' : 'default' }}
                  onDoubleClick={() => canManageProjects && setRenaming(true)}
                  title={canManageProjects ? 'Double-click to rename' : undefined}>
                  {project.client_name} &middot; {project.start_month} {project.start_year}
                </div>
              )}
              {canManageProjects && (
                <button onClick={() => setRenaming(true)}
                  style={{ background: 'transparent', border: '0.5px solid #dcd8d0', color: '#6e6a63', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', fontSize: 11, fontWeight: 500 }}>Rename</button>
              )}
            </div>
            <div style={{ fontSize: 12, color: '#6e6a63', marginTop: 4 }}>
              {total} conversations &middot; {clients.length} clients &middot; {candidates.length} candidates loaded
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: view === 'conversations' ? 12 : 0 }}>
          {[
            { key: 'conversations', label: 'Conversations' },
            { key: 'members', label: 'Team' },
          ].map(t => (
            <button key={t.key} onClick={() => setView(t.key)}
              style={{
                padding: '6px 14px', border: `0.5px solid ${view === t.key ? '#14130f' : '#dcd8d0'}`, borderRadius: 6,
                background: view === t.key ? '#14130f' : '#fff',
                color: view === t.key ? '#faf9f7' : '#4a4742',
                fontSize: 12, fontWeight: view === t.key ? 600 : 500, cursor: 'pointer',
              }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Conversation filters (only in conversations view) */}
        {view === 'conversations' && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1, maxWidth: 280 }}>
              <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 12, height: 12, color: '#9a958c', pointerEvents: 'none' }} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="7" cy="7" r="4"/><path d="M10.5 10.5l3 3" strokeLinecap="round"/></svg>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search contacts..."
                style={{ width: '100%', padding: '7px 10px 7px 28px', border: '0.5px solid #dcd8d0', borderRadius: 6, fontSize: 12, outline: 'none', background: '#fff', color: '#14130f', boxSizing: 'border-box' }} />
            </div>
            <select value={agentFilter} onChange={e => { setAgentFilter(e.target.value); load(1, true) }}
              style={{ padding: '7px 12px', border: '0.5px solid #dcd8d0', borderRadius: 6, fontSize: 12, outline: 'none', background: '#fff', color: '#14130f' }}>
              <option value="all">All Agents</option>
              {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <button onClick={() => { setUnreadOnly(!unreadOnly); load(1, true) }}
              style={{ padding: '7px 12px', border: `0.5px solid ${unreadOnly ? '#14130f' : '#dcd8d0'}`, borderRadius: 6, fontSize: 12, background: unreadOnly ? '#14130f' : '#fff', color: unreadOnly ? '#faf9f7' : '#4a4742', cursor: 'pointer', fontWeight: unreadOnly ? 600 : 500 }}>
              Unread only
            </button>
            <button onClick={() => load(1, true)}
              style={{ padding: '7px 12px', border: '0.5px solid #dcd8d0', borderRadius: 6, fontSize: 12, background: '#fff', color: '#6e6a63', cursor: 'pointer', fontWeight: 500 }}>
              Refresh
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 28px' }}>
        {view === 'members' ? (
          <MembersPanel project={project} agents={agents} canManageMembers={canManageMembers} />
        ) : loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>[P]</div>
            <div>Loading project conversations...</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16 }}>

            {/* CLIENT CONTACTS - fixed left panel */}
            <div>
              <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e5e7eb', overflow: 'hidden', position: 'sticky', top: 0 }}>
                <div style={{ padding: '12px 16px', background: ACCENT, borderBottom: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Client Contacts
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: ACCENT, background: '#fff', padding: '2px 8px', borderRadius: 10 }}>{filteredClients.length}</span>
                </div>
                {filteredClients.length === 0 ? (
                  <div style={{ padding: '24px 16px', textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>
                    No client contacts in this project yet
                  </div>
                ) : (
                  filteredClients.map(c => <ConvoRow key={c.id} c={c} />)
                )}
              </div>
            </div>

            {/* CANDIDATES - right scrollable panel */}
            <div>
              <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e5e7eb', overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', background: '#f5e9d6', borderBottom: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#7a5a1f', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Candidates
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, color: '#7a5a1f' }}>{filteredCandidates.length} of {total} loaded</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#7a5a1f', background: '#fff', padding: '2px 8px', borderRadius: 10 }}>{total}</span>
                  </div>
                </div>
                {filteredCandidates.length === 0 ? (
                  <div style={{ padding: '24px 16px', textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>
                    No candidates in this project yet
                  </div>
                ) : (
                  <>
                    {filteredCandidates.map(c => <ConvoRow key={c.id} c={c} />)}
                    {hasMore && (
                      <div style={{ padding: '14px 16px', textAlign: 'center', borderTop: '0.5px solid #f1f4f9' }}>
                        <button onClick={() => load(page + 1)} disabled={loadingMore}
                          style={{ padding: '8px 20px', border: '0.5px solid #e5e7eb', borderRadius: 8, background: '#f9fafb', color: '#374151', fontSize: 12, cursor: loadingMore ? 'default' : 'pointer', fontWeight: 500 }}>
                          {loadingMore ? 'Loading...' : `Load more (${total - conversations.length} remaining)`}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function Projects() {
  const { token, hasPermission } = useAuth()
  const canManageProjects = hasPermission('manage_projects')
  const canManageMembers = hasPermission('manage_project_members')
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingProject, setEditingProject] = useState(null)
  const [selectedProject, setSelectedProject] = useState(null)
  const [showArchived, setShowArchived] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const r = await fetch(`${API}/projects`, { headers: { Authorization: 'Bearer ' + token } })
      const data = await r.json()
      setProjects(Array.isArray(data) ? data : [])
    } catch {} finally { setLoading(false) }
  }

  async function archive(project) {
    if (!confirm(`Archive "${project.client_name} - ${project.start_month} ${project.start_year}"? You can restore it anytime.`)) return
    await fetch(`${API}/projects/${project.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ status: 'archived' })
    })
    load()
  }

  async function restore(project) {
    await fetch(`${API}/projects/${project.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ status: 'active' })
    })
    load()
  }

  async function deleteProject(project) {
    if (!confirm(`Permanently delete "${project.client_name}"? This cannot be undone. Conversations will be unassigned.`)) return
    await fetch(`${API}/projects/${project.id}`, { method: 'DELETE', headers: { Authorization: 'Bearer ' + token } })
    load()
  }

  if (selectedProject) {
    return (
      <ProjectView
        project={selectedProject}
        onBack={() => { setSelectedProject(null); load() }}
        onRenamed={() => { load(); setSelectedProject(prev => ({ ...prev })) }}
        canManageProjects={canManageProjects}
        canManageMembers={canManageMembers}
      />
    )
  }

  const active = projects.filter(p => p.status === 'active' && (!search || p.client_name.toLowerCase().includes(search.toLowerCase())))
  const archived = projects.filter(p => p.status === 'archived' && (!search || p.client_name.toLowerCase().includes(search.toLowerCase())))

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#faf9f7', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}>
      {/* Header - cream, editorial, matches Inbox */}
      <div style={{ padding: '24px 28px 16px', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 14, marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#14130f', marginBottom: 4, letterSpacing: '-0.3px' }}>Projects</div>
            <div style={{ fontSize: 12, color: '#6e6a63' }}>
              {active.length} active &middot; {archived.length} archived{canManageProjects ? ' \u00b7 Double-click any project name to rename' : ''}
            </div>
          </div>
          {canManageProjects && (
            <Btn onClick={() => { setEditingProject(null); setShowModal(true) }}>
              + New Project
            </Btn>
          )}
        </div>

        {/* Stats - light cards on cream */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
          {[
            { label: 'Active Projects', value: projects.filter(p => p.status === 'active').length, color: '#2d6a4f' },
            { label: 'Total Conversations', value: projects.reduce((a, p) => a + (parseInt(p.total_conversations) || 0), 0), color: '#2d2a7a' },
            { label: 'Unread', value: projects.reduce((a, p) => a + (parseInt(p.unread_conversations) || 0), 0), color: '#8e2a2a' },
          ].map(s => (
            <div key={s.label} style={{ background: '#fff', borderRadius: 8, padding: '14px 16px', border: '0.5px solid #dcd8d0' }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: s.color, letterSpacing: '-0.3px' }}>{s.value}</div>
              <div style={{ fontSize: 10, color: '#6e6a63', marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 500 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Toolbar inline */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: 300 }}>
            <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 12, height: 12, color: '#9a958c', pointerEvents: 'none' }} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="7" cy="7" r="4"/><path d="M10.5 10.5l3 3" strokeLinecap="round"/></svg>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search projects..."
              style={{ width: '100%', padding: '7px 10px 7px 28px', border: '0.5px solid #dcd8d0', borderRadius: 6, fontSize: 12, outline: 'none', background: '#fff', color: '#14130f', boxSizing: 'border-box' }} />
          </div>
          <button onClick={() => setShowArchived(!showArchived)}
            style={{ padding: '7px 12px', border: `0.5px solid ${showArchived ? ACCENT : '#dcd8d0'}`, borderRadius: 6, background: showArchived ? ACCENT_LIGHT : '#fff', color: showArchived ? ACCENT : '#4a4742', fontSize: 12, cursor: 'pointer', fontWeight: showArchived ? 600 : 500 }}>
            {showArchived ? 'Hide' : 'Show'} Archived ({archived.length})
          </button>
          <Btn variant="ghost" size="sm" onClick={load}>Refresh</Btn>
        </div>
      </div>

      {/* Project grid */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>[P]</div>
            <div>Loading projects...</div>
          </div>
        ) : active.length === 0 && !showArchived ? (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>[P]</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#374151', marginBottom: 8 }}>No projects yet</div>
            <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 24, maxWidth: 400, margin: '0 auto 24px' }}>
              {canManageProjects
                ? 'Create a project to organise your inbox by client engagement. Each project groups all conversations for that client in one place.'
                : 'Projects organise your inbox by client engagement. Ask a director to create one.'}
            </div>
            {canManageProjects && (
              <Btn onClick={() => { setEditingProject(null); setShowModal(true) }}>+ Create First Project</Btn>
            )}
          </div>
        ) : (
          <>
            {/* Active projects */}
            {active.length > 0 && (
              <>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 14 }}>
                  Active - {active.length}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14, marginBottom: 28 }}>
                  {active.map(p => (
                    <ProjectCard key={p.id} project={p}
                      onEdit={proj => { setEditingProject(proj); setShowModal(true) }}
                      onArchive={archive}
                      onRestore={restore}
                      onDelete={deleteProject}
                      onSelect={setSelectedProject}
                      onRenamed={load}
                      canManageProjects={canManageProjects} />
                  ))}
                </div>
              </>
            )}

            {/* Archived projects */}
            {showArchived && archived.length > 0 && (
              <>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 14 }}>
                  Archived - {archived.length}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
                  {archived.map(p => (
                    <ProjectCard key={p.id} project={p}
                      onEdit={proj => { setEditingProject(proj); setShowModal(true) }}
                      onArchive={archive}
                      onRestore={restore}
                      onDelete={deleteProject}
                      onSelect={setSelectedProject}
                      onRenamed={load}
                      canManageProjects={canManageProjects} />
                  ))}
                </div>
              </>
            )}

            {showArchived && archived.length === 0 && (
              <div style={{ textAlign: 'center', padding: '20px 0', color: '#9ca3af', fontSize: 12 }}>No archived projects</div>
            )}
          </>
        )}
      </div>

      {/* Modal */}
      {showModal && canManageProjects && (
        <ProjectModal
          project={editingProject}
          onClose={() => { setShowModal(false); setEditingProject(null) }}
          onSaved={load} />
      )}
    </div>
  )
}