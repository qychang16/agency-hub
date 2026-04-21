import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { API, NAVY, ACCENT, ACCENT_MID } from '../../utils/constants'
import { dateSGTiso } from '../../utils/dates'

export default function InboxList({ activeConvoId, setActiveConvoId, isMobile, mobileView, setMobileView }) {
  const { token, user } = useAuth()
  const [convos, setConvos] = useState([])
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [sortOrder, setSortOrder] = useState('newest')
  const [dateFilter, setDateFilter] = useState('')

  useEffect(() => {
    if (!token) return
    fetch(`${API}/conversations`, { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.json()).then(setConvos).catch(() => {})
  }, [token])

  const filtered = convos
    .filter(c => {
      const q = search.toLowerCase()
      const ms = !q || c.name?.toLowerCase().includes(q) || (c.preview||'').toLowerCase().includes(q) || (c.phone||'').includes(q)
      const ss = filterStatus === 'all' || c.status === filterStatus
      const ds = !dateFilter || (() => { const ts = c.last_message_at || c.created_at; return ts && dateSGTiso(ts) === dateFilter })()
      return ms && ss && ds
    })
    .sort((a, b) => {
      const at = new Date(a.last_message_at || a.created_at || 0).getTime()
      const bt = new Date(b.last_message_at || b.created_at || 0).getTime()
      return sortOrder === 'newest' ? bt - at : at - bt
    })

  function openConvo(id) {
    setActiveConvoId(id)
    if (isMobile) setMobileView('chat')
  }

  if (isMobile && mobileView !== 'inbox') return null

  return (
    <div style={{ width: isMobile ? '100%' : 272, flexShrink: 0, borderRight: '0.5px solid #e5e7eb', display: 'flex', flexDirection: 'column', background: '#f1f4f9', overflow: 'hidden' }}>
      <div style={{ padding: '12px 13px 0', flexShrink: 0 }}>
        <div style={{ position: 'relative', marginBottom: 7 }}>
          <svg style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', width: 12, height: 12, color: '#9ca3af', pointerEvents: 'none' }} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="7" cy="7" r="4"/><path d="M10.5 10.5l3 3" strokeLinecap="round"/></svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, number, message…"
            style={{ width: '100%', padding: '6px 9px 6px 27px', border: '0.5px solid #d1d5db', borderRadius: 8, fontSize: 11, background: '#fff', color: '#111827', outline: 'none', boxSizing: 'border-box' }} />
        </div>
        <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
          {[['newest','↓ Newest'],['oldest','↑ Oldest']].map(([o,l]) => (
            <button key={o} onClick={() => setSortOrder(o)}
              style={{ flex: 1, padding: '4px 0', borderRadius: 7, fontSize: 10, border: '0.5px solid #d1d5db', background: sortOrder === o ? NAVY : 'transparent', color: sortOrder === o ? '#fff' : '#6b7280', cursor: 'pointer' }}>
              {l}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 4, marginBottom: 8, alignItems: 'center' }}>
          <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)}
            style={{ flex: 1, padding: '4px 7px', border: '0.5px solid #d1d5db', borderRadius: 7, fontSize: 10, background: '#fff', color: dateFilter ? '#111827' : '#9ca3af', outline: 'none', minWidth: 0 }} />
          {dateFilter && <button onClick={() => setDateFilter('')} style={{ padding: '3px 7px', border: '0.5px solid #d1d5db', borderRadius: 7, fontSize: 10, background: 'transparent', color: '#9ca3af', cursor: 'pointer' }}>✕</button>}
        </div>
      </div>
      <div style={{ padding: '0 13px 8px', flexShrink: 0 }}>
        <div style={{ fontSize: 9, fontWeight: 500, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 5 }}>Status</div>
        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
          {[['all','All'],['open','Open'],['pending','Pending'],['resolved','Resolved']].map(([k,l]) => (
            <button key={k} onClick={() => setFilterStatus(k)}
              style={{ padding: '2px 8px', borderRadius: 6, border: '0.5px solid #d1d5db', fontSize: 10, background: filterStatus === k ? NAVY : 'transparent', color: filterStatus === k ? '#fff' : '#6b7280', cursor: 'pointer' }}>
              {l}
            </button>
          ))}
        </div>
      </div>
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {filtered.length === 0 && (
          <div style={{ padding: 20, textAlign: 'center', fontSize: 11, color: '#9ca3af' }}>No conversations match</div>
        )}
        {filtered.map(c => (
          <div key={c.id} onClick={() => openConvo(c.id)}
            style={{ padding: '10px 13px', borderBottom: '0.5px solid #e5e7eb', cursor: 'pointer', background: c.id === activeConvoId ? '#fff' : 'transparent', borderLeft: c.id === activeConvoId ? `2px solid ${ACCENT}` : '2px solid transparent', transition: 'background .1s' }}
            onMouseEnter={e => { if (c.id !== activeConvoId) e.currentTarget.style.background = '#fff' }}
            onMouseLeave={e => { if (c.id !== activeConvoId) e.currentTarget.style.background = 'transparent' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 140 }}>{c.name}</span>
              <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, fontWeight: 500, background: c.type === 'client' ? ACCENT_MID : '#ede9fe', color: c.type === 'client' ? '#1e40af' : '#5b21b6' }}>{c.type || 'candidate'}</span>
                <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, fontWeight: 500, background: '#f1f4f9', color: '#6b7280', border: '0.5px solid #e5e7eb' }}>{c.assigned_to}</span>
              </div>
            </div>
            <div style={{ fontSize: 11, color: '#6b7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 3 }}>{c.preview || 'No messages yet'}</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 9, fontWeight: 500, color: c.status === 'open' ? '#16a34a' : c.status === 'pending' ? '#d97706' : '#9ca3af' }}>{c.status}</span>
              {c.last_message_at && <span style={{ fontSize: 9, color: '#9ca3af' }}>{new Date(c.last_message_at).toLocaleDateString('en-GB',{timeZone:'Asia/Singapore',day:'2-digit',month:'short'})}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}