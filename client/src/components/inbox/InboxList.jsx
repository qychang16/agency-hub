import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../context/AuthContext'
import { API, ACCENT, ACCENT_LIGHT, NAVY } from '../../utils/constants'

const PIPELINE_COLORS = {
  new: { bg: '#f1f4f9', color: '#6b7280' },
  screened: { bg: '#dbeafe', color: '#1e40af' },
  interviewed: { bg: '#ede9fe', color: '#5b21b6' },
  offered: { bg: '#fef3c7', color: '#92400e' },
  placed: { bg: '#dcfce7', color: '#16a34a' },
  rejected: { bg: '#fee2e2', color: '#dc2626' },
}

function ConvoCard({ convo, isActive, onClick, projects }) {
  const project = projects?.find(p => p.id === convo.project_id)
  const initials = convo.name?.[0]?.toUpperCase() || '?'
  const isClient = convo.type === 'client'
  const stage = convo.pipeline_stage
  const stageStyle = PIPELINE_COLORS[stage] || PIPELINE_COLORS.new
  const timeStr = convo.last_message_at
    ? new Date(convo.last_message_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Singapore' })
    : ''
  const dateStr = convo.last_message_at
    ? (() => {
        const d = new Date(convo.last_message_at)
        const today = new Date()
        const yesterday = new Date(today)
        yesterday.setDate(yesterday.getDate() - 1)
        if (d.toDateString() === today.toDateString()) return timeStr
        if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'Asia/Singapore' })
      })()
    : ''

  return (
    <div onClick={onClick}
      style={{ padding: '12px 14px', borderBottom: '0.5px solid #f1f4f9', cursor: 'pointer', background: isActive ? ACCENT_LIGHT : '#fff', borderLeft: isActive ? `3px solid ${ACCENT}` : '3px solid transparent', transition: 'all .1s' }}
      onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#f9fafb' }}
      onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = '#fff' }}>

      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        {/* Avatar */}
        <div style={{ width: 38, height: 38, borderRadius: 10, background: isClient ? '#dbeafe' : '#ede9fe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: isClient ? '#1e40af' : '#5b21b6', flexShrink: 0, position: 'relative' }}>
          {initials}
          {convo.unread_count > 0 && (
            <div style={{ position: 'absolute', top: -4, right: -4, width: 16, height: 16, borderRadius: '50%', background: '#dc2626', color: '#fff', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid #fff' }}>
              {convo.unread_count > 9 ? '9+' : convo.unread_count}
            </div>
          )}
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Row 1: name + time */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
            <div style={{ fontSize: 13, fontWeight: convo.unread_count > 0 ? 700 : 500, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>
              {convo.name}
            </div>
            <div style={{ fontSize: 10, color: '#9ca3af', flexShrink: 0 }}>{dateStr}</div>
          </div>

          {/* Row 2: preview */}
          <div style={{ fontSize: 11, color: convo.unread_count > 0 ? '#374151' : '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 6, fontWeight: convo.unread_count > 0 ? 500 : 400 }}>
            {convo.preview || convo.phone || '—'}
          </div>

          {/* Row 3: badges */}
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Type badge */}
            <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: isClient ? '#dbeafe' : '#ede9fe', color: isClient ? '#1e40af' : '#5b21b6', fontWeight: 600 }}>
              {isClient ? 'CLIENT' : 'CAND'}
            </span>

            {/* Pipeline stage */}
            {stage && !isClient && (
              <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: stageStyle.bg, color: stageStyle.color, fontWeight: 500, textTransform: 'capitalize' }}>
                {stage}
              </span>
            )}

            {/* Project tag */}
            {project && (
              <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: project.colour + '20', color: project.colour, fontWeight: 600, maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {project.client_name}
              </span>
            )}

            {/* Assigned agent */}
            {convo.assigned_to && (
              <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: '#f1f4f9', color: '#6b7280', fontWeight: 500 }}>
                {convo.assigned_to.split(' ')[0]}
              </span>
            )}

            {/* Phone line */}
            {convo.phone_line && (
              <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: '#f0fdf4', color: '#16a34a', fontWeight: 500 }}>
                {convo.phone_line}
              </span>
            )}

            {/* DNC warning */}
            {convo.dnc && (
              <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: '#fee2e2', color: '#dc2626', fontWeight: 700 }}>DNC</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function InboxList({ activeConvoId, setActiveConvoId, isMobile, mobileView, setMobileView }) {
  const { token } = useAuth()
  const [conversations, setConversations] = useState([])
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('open')
  const [projectFilter, setProjectFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [phoneNumbers, setPhoneNumbers] = useState([])
  const [phoneFilter, setPhoneFilter] = useState('all')

  useEffect(() => { load() }, [statusFilter, phoneFilter])
  useEffect(() => { loadProjects(); loadPhoneNumbers() }, [])

  async function load() {
    try {
      let url = `${API}/conversations?status=${statusFilter}`
      if (phoneFilter !== 'all') url += `&phone_number_id=${phoneFilter}`
      const r = await fetch(url, { headers: { Authorization: 'Bearer ' + token } })
      const data = await r.json()
      setConversations(Array.isArray(data) ? data : [])
    } catch {} finally { setLoading(false) }
  }

  async function loadProjects() {
    try {
      const r = await fetch(`${API}/projects`, { headers: { Authorization: 'Bearer ' + token } })
      const data = await r.json()
      setProjects(Array.isArray(data) ? data : [])
    } catch {}
  }

  async function loadPhoneNumbers() {
    try {
      const r = await fetch(`${API}/phone-numbers`, { headers: { Authorization: 'Bearer ' + token } })
      const data = await r.json()
      setPhoneNumbers(Array.isArray(data) ? data : [])
    } catch {}
  }

  const filtered = conversations.filter(c => {
    const matchSearch = !search || c.name?.toLowerCase().includes(search.toLowerCase()) || c.phone?.includes(search)
    const matchProject = projectFilter === 'all' || (projectFilter === 'none' ? !c.project_id : c.project_id === parseInt(projectFilter))
    const matchType = typeFilter === 'all' || c.type === typeFilter
    return matchSearch && matchProject && matchType
  })

  const unreadCount = conversations.filter(c => c.unread_count > 0).length

  if (isMobile && mobileView === 'chat') return null

  return (
    <div style={{ width: isMobile ? '100%' : 300, flexShrink: 0, display: 'flex', flexDirection: 'column', borderRight: '0.5px solid #e5e7eb', background: '#fff', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '14px 14px 10px', borderBottom: '0.5px solid #f1f4f9', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>Inbox</div>
            {unreadCount > 0 && <div style={{ fontSize: 10, color: '#dc2626', fontWeight: 600 }}>{unreadCount} unread</div>}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={load} style={{ width: 28, height: 28, borderRadius: 7, border: '0.5px solid #e5e7eb', background: '#f9fafb', cursor: 'pointer', fontSize: 12, color: '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>↻</button>
          </div>
        </div>

        {/* Search */}
        <div style={{ position: 'relative', marginBottom: 8 }}>
          <svg style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', width: 11, height: 11, color: '#9ca3af', pointerEvents: 'none' }} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="7" cy="7" r="4"/><path d="M10.5 10.5l3 3" strokeLinecap="round"/></svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search contacts…"
            style={{ width: '100%', padding: '6px 8px 6px 24px', border: '0.5px solid #e5e7eb', borderRadius: 7, fontSize: 11, outline: 'none', background: '#f9fafb', color: '#111827', boxSizing: 'border-box' }} />
        </div>

        {/* Status filter */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
          {[['open', 'Open'], ['pending', 'Pending'], ['resolved', 'Resolved']].map(([k, l]) => (
            <button key={k} onClick={() => setStatusFilter(k)}
              style={{ flex: 1, padding: '4px 6px', borderRadius: 6, border: 'none', background: statusFilter === k ? ACCENT : '#f1f4f9', color: statusFilter === k ? '#fff' : '#6b7280', fontSize: 10, cursor: 'pointer', fontWeight: statusFilter === k ? 600 : 400 }}>
              {l}
            </button>
          ))}
        </div>

        {/* Type filter */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
          {[['all', 'All'], ['candidate', 'Candidates'], ['client', 'Clients']].map(([k, l]) => (
            <button key={k} onClick={() => setTypeFilter(k)}
              style={{ flex: 1, padding: '4px 6px', borderRadius: 6, border: 'none', background: typeFilter === k ? '#374151' : '#f1f4f9', color: typeFilter === k ? '#fff' : '#6b7280', fontSize: 10, cursor: 'pointer', fontWeight: typeFilter === k ? 600 : 400 }}>
              {l}
            </button>
          ))}
        </div>

        {/* Project filter */}
        <select value={projectFilter} onChange={e => setProjectFilter(e.target.value)}
          style={{ width: '100%', padding: '5px 8px', border: '0.5px solid #e5e7eb', borderRadius: 7, fontSize: 11, outline: 'none', background: '#f9fafb', color: '#374151', marginBottom: 8 }}>
          <option value="all">All Projects</option>
          <option value="none">No Project</option>
          {projects.filter(p => p.status === 'active').map(p => (
            <option key={p.id} value={p.id}>{p.client_name} · {p.start_month} {p.start_year}</option>
          ))}
        </select>

        {/* Phone line filter */}
        {phoneNumbers.length > 1 && (
          <select value={phoneFilter} onChange={e => setPhoneFilter(e.target.value)}
            style={{ width: '100%', padding: '5px 8px', border: '0.5px solid #e5e7eb', borderRadius: 7, fontSize: 11, outline: 'none', background: '#f9fafb', color: '#374151' }}>
            <option value="all">All Lines</option>
            {phoneNumbers.map(p => (
              <option key={p.id} value={p.id}>{p.display_name || p.number}{p.is_primary ? ' (Primary)' : ''}</option>
            ))}
          </select>
        )}
      </div>

      {/* Count */}
      <div style={{ padding: '6px 14px', background: '#f9fafb', borderBottom: '0.5px solid #f1f4f9', flexShrink: 0 }}>
        <span style={{ fontSize: 10, color: '#9ca3af' }}>{filtered.length} conversation{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af', fontSize: 12 }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>💬</div>
            <div style={{ fontSize: 12, color: '#9ca3af' }}>No conversations found</div>
          </div>
        ) : (
          filtered.map(c => (
            <ConvoCard key={c.id} convo={c} isActive={activeConvoId === c.id}
              projects={projects}
              onClick={() => {
                setActiveConvoId(c.id)
                if (isMobile) setMobileView('chat')
              }} />
          ))
        )}
      </div>
    </div>
  )
}