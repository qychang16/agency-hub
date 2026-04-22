import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { API } from '../../utils/constants'
import { ink, accent, semantic, fonts, textSize, textWeight, space, radius, border, microLabel } from '../../utils/designTokens'

// Pipeline stage visual system — each stage instantly recognisable
const PIPELINE_STYLES = {
  new:         { bg: '#d14a2b',           color: '#fff',         border: 'transparent',  label: 'New' },
  screened:    { bg: '#e4eaf2',           color: '#3a5478',      border: 'transparent',  label: 'Screened' },
  interviewed: { bg: '#e8e4f0',           color: '#4a3d6e',      border: 'transparent',  label: 'Interviewed' },
  offered:     { bg: '#d8ebe3',           color: '#1f5f44',      border: 'transparent',  label: 'Offered' },
  placed:      { bg: accent.DEFAULT,      color: '#fff',         border: 'transparent',  label: 'Placed' },
  rejected:    { bg: 'transparent',       color: semantic.danger, border: semantic.danger, label: 'Rejected' },
}

function ConvoCard({ convo, isActive, onClick, projects }) {
  const project = projects?.find(p => p.id === convo.project_id)
  const initials = (convo.name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  const isClient = convo.type === 'client'
  const stage = convo.pipeline_stage
  const stageStyle = PIPELINE_STYLES[stage] || PIPELINE_STYLES.new
  const hasUnread = convo.unread_count > 0

  const timeStr = convo.last_message_at ? (() => {
    const d = new Date(convo.last_message_at)
    const today = new Date()
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1)
    const toSGT = x => x.toLocaleDateString('en-CA', { timeZone: 'Asia/Singapore' })
    if (toSGT(d) === toSGT(today)) return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Singapore' })
    if (toSGT(d) === toSGT(yesterday)) return 'Yesterday'
    const diff = (new Date(toSGT(today)) - new Date(toSGT(d))) / 86400000
    if (diff < 7) return d.toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'Asia/Singapore' })
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'Asia/Singapore' })
  })() : ''

  return (
    <div onClick={onClick}
      style={{
        padding: `${space[3]}px ${space[4]}px`,
        borderBottom: `0.5px solid ${ink[200]}`,
        cursor: 'pointer',
        background: isActive ? ink[100] : hasUnread ? '#fdfcfa' : 'transparent',
        position: 'relative',
        transition: 'background 0.08s',
      }}
      onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = ink[100] }}
      onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = hasUnread ? '#fdfcfa' : 'transparent' }}>

      {/* Active rail (indigo) — only when this is the open conversation */}
      {isActive && (
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 2, background: accent.DEFAULT }} />
      )}
      {/* Unread rail (subtle indigo) — only when unread AND not active */}
      {hasUnread && !isActive && (
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 2, background: accent.DEFAULT, opacity: 0.5 }} />
      )}

      <div style={{ display: 'flex', gap: space[3], alignItems: 'flex-start' }}>
        {/* Avatar — no unread badge here anymore, keeps it clean */}
        <div style={{
          width: 34, height: 34, borderRadius: radius.pill,
          background: isClient ? accent.DEFAULT : ink[200],
          color: isClient ? '#fff' : ink[700],
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: textSize.xs, fontWeight: textWeight.semibold,
          flexShrink: 0,
          fontFamily: fonts.body,
        }}>
          {initials}
        </div>

        {/* Body */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Row 1: name + time */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: space[2], marginBottom: 2 }}>
            <div style={{
              fontSize: textSize.sm,
              fontWeight: hasUnread ? textWeight.bold : textWeight.medium,
              color: ink[900],
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              flex: 1, minWidth: 0,
              fontFamily: fonts.body,
            }}>
              {convo.name}
            </div>
            <div style={{
              fontSize: 10,
              color: hasUnread ? accent.DEFAULT : ink[600],
              fontWeight: hasUnread ? textWeight.semibold : textWeight.regular,
              flexShrink: 0,
              fontVariantNumeric: 'tabular-nums',
              fontFamily: fonts.body,
            }}>{timeStr}</div>
          </div>

          {/* Row 2: preview + unread badge on right (WhatsApp style) */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: space[2], marginBottom: space[1] + 2 }}>
            <div style={{
              fontSize: textSize.xs,
              color: hasUnread ? ink[800] : ink[600],
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              fontWeight: hasUnread ? textWeight.medium : textWeight.regular,
              fontFamily: fonts.body,
              flex: 1, minWidth: 0,
            }}>
              {convo.preview || convo.phone || '—'}
            </div>
            {hasUnread && (
              <div style={{
                minWidth: 18, height: 18, padding: '0 5px', borderRadius: radius.pill,
                background: accent.DEFAULT, color: '#fff',
                fontSize: 10, fontWeight: textWeight.bold,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: fonts.body,
                flexShrink: 0,
                lineHeight: 1,
              }}>
                {convo.unread_count > 99 ? '99+' : convo.unread_count}
              </div>
            )}
          </div>

          {/* Row 3: tags — CLIENT is solid indigo, CANDIDATE is outlined neutral */}
          <div style={{ display: 'flex', gap: space[1], flexWrap: 'wrap', alignItems: 'center' }}>
            {isClient ? (
              <span style={{
                fontSize: 9,
                padding: '2px 7px',
                borderRadius: radius.sm,
                background: accent.DEFAULT,
                color: '#fff',
                fontWeight: textWeight.bold,
                textTransform: 'uppercase', letterSpacing: '0.5px',
                fontFamily: fonts.body,
              }}>Client</span>
            ) : (
              <span style={{
                fontSize: 9,
                padding: '2px 7px',
                borderRadius: radius.sm,
                background: '#f5e9d6',
                color: '#7a5a1f',
                fontWeight: textWeight.bold,
                textTransform: 'uppercase', letterSpacing: '0.5px',
                fontFamily: fonts.body,
              }}>Candidate</span>
            )}

            {stage && !isClient && (
              <span style={{
                fontSize: 9,
                padding: '2px 7px',
                borderRadius: radius.sm,
                background: stageStyle.bg,
                color: stageStyle.color,
                border: stageStyle.border !== 'transparent' ? `0.5px solid ${stageStyle.border}` : 'none',
                fontWeight: textWeight.semibold,
                letterSpacing: '0.3px',
                fontFamily: fonts.body,
              }}>{stageStyle.label}</span>
            )}

            {project && (
              <span style={{
                fontSize: 9,
                padding: '2px 7px',
                borderRadius: radius.sm,
                background: ink[800], color: ink[50],
                fontWeight: textWeight.medium,
                maxWidth: 100,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                fontFamily: fonts.body,
              }}>{project.client_name}</span>
            )}

            {convo.assigned_to && (
              <span style={{
                fontSize: 9,
                padding: '2px 7px',
                borderRadius: radius.sm,
                background: 'transparent', color: ink[600],
                fontWeight: textWeight.medium,
                border: `0.5px solid ${ink[300]}`,
                fontFamily: fonts.body,
              }}>{convo.assigned_to.split(' ')[0]}</span>
            )}

            {convo.dnc && (
              <span style={{
                fontSize: 9,
                padding: '2px 7px',
                borderRadius: radius.sm,
                background: semantic.danger, color: '#fff',
                fontWeight: textWeight.bold,
                textTransform: 'uppercase', letterSpacing: '0.5px',
                fontFamily: fonts.body,
              }}>DNC</span>
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
    <div style={{
      width: isMobile ? '100%' : 300,
      flexShrink: 0,
      display: 'flex', flexDirection: 'column',
      borderRight: border.subtle,
      background: '#fff',
      overflow: 'hidden',
      fontFamily: fonts.body,
    }}>
      {/* Header */}
      <div style={{ padding: `${space[4]}px ${space[4]}px ${space[3]}px`, flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: space[3] }}>
          <div style={{
            fontFamily: fonts.display,
            fontSize: textSize.xl,
            fontWeight: textWeight.semibold,
            color: ink[900],
            letterSpacing: '-0.2px',
          }}>
            Inbox
            {unreadCount > 0 && (
              <span style={{
                marginLeft: space[2],
                fontSize: textSize.xs,
                fontWeight: textWeight.semibold,
                color: accent.DEFAULT,
                fontFamily: fonts.body,
              }}>{unreadCount} unread</span>
            )}
          </div>
          <button onClick={load}
            title="Refresh"
            style={{
              width: 24, height: 24, borderRadius: radius.md,
              border: `0.5px solid ${ink[300]}`,
              background: 'transparent', cursor: 'pointer',
              color: ink[600], display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M13.5 3.5A6 6 0 1 0 14 8" strokeLinecap="round"/>
              <path d="M10 3.5h3.5V0" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        {/* Search */}
        <div style={{ position: 'relative', marginBottom: space[2] }}>
          <svg style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: ink[500], pointerEvents: 'none' }}
               width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="7" cy="7" r="4.5"/>
            <path d="M10.5 10.5l3 3" strokeLinecap="round"/>
          </svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search conversations"
            style={{
              width: '100%',
              padding: `${space[1] + 2}px ${space[2]}px ${space[1] + 2}px 28px`,
              border: `0.5px solid ${ink[300]}`,
              borderRadius: radius.md,
              fontSize: textSize.xs,
              outline: 'none',
              background: ink[100],
              color: ink[800],
              boxSizing: 'border-box',
              fontFamily: fonts.body,
            }} />
        </div>

        {/* Status filter */}
        <div style={{ display: 'flex', gap: space[1], marginBottom: space[2] }}>
          {[['open', 'Open'], ['pending', 'Pending'], ['resolved', 'Resolved']].map(([k, l]) => (
            <button key={k} onClick={() => setStatusFilter(k)}
              style={{
                flex: 1, padding: `${space[1]}px ${space[2]}px`,
                borderRadius: radius.md,
                border: `0.5px solid ${statusFilter === k ? ink[900] : ink[300]}`,
                background: statusFilter === k ? ink[900] : 'transparent',
                color: statusFilter === k ? ink[50] : ink[700],
                fontSize: 10,
                cursor: 'pointer',
                fontWeight: textWeight.semibold,
                letterSpacing: '0.3px',
                fontFamily: fonts.body,
              }}>{l}</button>
          ))}
        </div>

        {/* Type filter — Candidate vs Client visually distinct */}
        <div style={{ display: 'flex', gap: space[1], marginBottom: space[2] }}>
          <button onClick={() => setTypeFilter('all')}
            style={{
              flex: 1, padding: `${space[1]}px ${space[2]}px`,
              borderRadius: radius.md,
              border: `0.5px solid ${typeFilter === 'all' ? ink[700] : ink[300]}`,
              background: typeFilter === 'all' ? ink[700] : 'transparent',
              color: typeFilter === 'all' ? ink[50] : ink[600],
              fontSize: 10,
              cursor: 'pointer',
              fontWeight: textWeight.semibold,
              letterSpacing: '0.3px',
              fontFamily: fonts.body,
            }}>All</button>
          <button onClick={() => setTypeFilter('candidate')}
            style={{
              flex: 1, padding: `${space[1]}px ${space[2]}px`,
              borderRadius: radius.md,
              border: `0.5px solid ${typeFilter === 'candidate' ? ink[700] : ink[300]}`,
              background: typeFilter === 'candidate' ? ink[700] : 'transparent',
              color: typeFilter === 'candidate' ? ink[50] : ink[600],
              fontSize: 10,
              cursor: 'pointer',
              fontWeight: textWeight.semibold,
              letterSpacing: '0.3px',
              fontFamily: fonts.body,
            }}>Candidates</button>
          <button onClick={() => setTypeFilter('client')}
            style={{
              flex: 1, padding: `${space[1]}px ${space[2]}px`,
              borderRadius: radius.md,
              border: `0.5px solid ${typeFilter === 'client' ? accent.DEFAULT : ink[300]}`,
              background: typeFilter === 'client' ? accent.DEFAULT : 'transparent',
              color: typeFilter === 'client' ? '#fff' : ink[600],
              fontSize: 10,
              cursor: 'pointer',
              fontWeight: textWeight.semibold,
              letterSpacing: '0.3px',
              fontFamily: fonts.body,
            }}>Clients</button>
        </div>

        {/* Project filter */}
        <select value={projectFilter} onChange={e => setProjectFilter(e.target.value)}
          style={{
            width: '100%',
            padding: `${space[1] + 1}px ${space[2]}px`,
            border: `0.5px solid ${ink[300]}`,
            borderRadius: radius.md,
            fontSize: textSize.xs,
            outline: 'none',
            background: ink[100],
            color: ink[700],
            marginBottom: phoneNumbers.length > 1 ? space[2] : 0,
            fontFamily: fonts.body,
            cursor: 'pointer',
          }}>
          <option value="all">All projects</option>
          <option value="none">No project</option>
          {projects.filter(p => p.status === 'active').map(p => (
            <option key={p.id} value={p.id}>{p.client_name} · {p.start_month} {p.start_year}</option>
          ))}
        </select>

        {/* Phone line filter */}
        {phoneNumbers.length > 1 && (
          <select value={phoneFilter} onChange={e => setPhoneFilter(e.target.value)}
            style={{
              width: '100%',
              padding: `${space[1] + 1}px ${space[2]}px`,
              border: `0.5px solid ${ink[300]}`,
              borderRadius: radius.md,
              fontSize: textSize.xs,
              outline: 'none',
              background: ink[100],
              color: ink[700],
              fontFamily: fonts.body,
              cursor: 'pointer',
            }}>
            <option value="all">All lines</option>
            {phoneNumbers.map(p => (
              <option key={p.id} value={p.id}>{p.display_name || p.number}{p.is_primary ? ' · Primary' : ''}</option>
            ))}
          </select>
        )}
      </div>

      {/* Count bar */}
      <div style={{
        padding: `${space[1] + 2}px ${space[4]}px`,
        borderTop: border.subtle,
        borderBottom: border.subtle,
        background: ink[100],
        flexShrink: 0,
      }}>
        <span style={{ ...microLabel, color: ink[600] }}>
          {filtered.length} conversation{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: space[10], color: ink[500], fontSize: textSize.sm }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: space[10] }}>
            <div style={{ fontSize: textSize.sm, color: ink[500] }}>No conversations</div>
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