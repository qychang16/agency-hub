import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../context/AuthContext'
import { API, ACCENT, ACCENT_LIGHT, NAVY, EMOJIS, DEFAULT_TEMPLATES } from '../../utils/constants'
import { fmtSGT } from '../../utils/dates'
import { io } from 'socket.io-client'

// Module-level scroll position cache — survives remounts within the session.
// Map of conversationId -> last scrollTop. We store here instead of component
// state so the value persists even when the messages container briefly unmounts.
const scrollMemory = new Map()

// Returns a label for a message's date group: "Today", "Yesterday",
// "Monday 21 Apr" (if within the past 7 days), or "22 Apr 2026" (older).
function dateGroupLabel(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()

  // Compare using SGT calendar days — strip time to midnight in Asia/Singapore
  const toSGTDateString = x => x.toLocaleDateString('en-CA', { timeZone: 'Asia/Singapore' })
  const msgDay = toSGTDateString(d)
  const today = toSGTDateString(now)
  const y = new Date(now); y.setDate(y.getDate() - 1)
  const yesterday = toSGTDateString(y)

  if (msgDay === today) return 'Today'
  if (msgDay === yesterday) return 'Yesterday'

  const diffDays = Math.floor((new Date(today) - new Date(msgDay)) / 86400000)
  if (diffDays > 0 && diffDays < 7) {
    return d.toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'short', timeZone: 'Asia/Singapore' })
  }
  // Older than a week — include year
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Singapore' })
}

export default function ChatWindow({ activeConvoId, active, setActive, projects, showDrawer, setShowDrawer, isMobile, mobileView, setMobileView }) {
  const { token, user } = useAuth()
  const [input, setInput] = useState('')
  const [compMode, setCompMode] = useState('text')
  const [showEmoji, setShowEmoji] = useState(false)
  const [showReassign, setShowReassign] = useState(false)
  const [showProjectMenu, setShowProjectMenu] = useState(false)
  const [newMessagesCount, setNewMessagesCount] = useState(0)
  const [isAtBottom, setIsAtBottom] = useState(true)
  const messagesEndRef = useRef(null)
  const messagesRef = useRef(null)
  const textareaRef = useRef(null)
  const socketRef = useRef(null)
  const projectMenuRef = useRef(null)
  // Track the previous convo id so we can save its scroll position before switching
  const prevConvoIdRef = useRef(null)

  // Socket for live messages
  useEffect(() => {
    const socket = io(API)
    socketRef.current = socket
    socket.on('new_message', msg => {
      if (msg.conversation_id === activeConvoId) {
        setActive(prev => prev ? { ...prev, messages: [...(prev.messages || []), msg] } : prev)
        // If user is scrolled up, increment the unread counter for the pill
        if (!isAtBottomRef.current) {
          setNewMessagesCount(n => n + 1)
        }
      }
    })
    return () => socket.disconnect()
  }, [activeConvoId, setActive])

  // Keep a ref of isAtBottom so the socket callback reads current value
  const isAtBottomRef = useRef(true)
  useEffect(() => { isAtBottomRef.current = isAtBottom }, [isAtBottom])

  // Save scroll position when the convo id changes (before new messages load)
  useEffect(() => {
    // If we had a previous conversation open, save its scroll position
    if (prevConvoIdRef.current && prevConvoIdRef.current !== activeConvoId && messagesRef.current) {
      scrollMemory.set(prevConvoIdRef.current, messagesRef.current.scrollTop)
    }
    prevConvoIdRef.current = activeConvoId
    // Reset new messages counter when switching
    setNewMessagesCount(0)
  }, [activeConvoId])

  // Restore scroll position (or go to bottom if first visit) whenever messages load
  useEffect(() => {
    const el = messagesRef.current
    if (!el || !active?.messages) return
    const saved = scrollMemory.get(activeConvoId)
    if (saved !== undefined) {
      el.scrollTop = saved
    } else {
      // First time opening — scroll to bottom instantly, no animation
      el.scrollTop = el.scrollHeight
    }
  }, [activeConvoId, active?.messages?.length === undefined ? 0 : (active?.messages?.length > 0 ? 1 : 0)])
  // ^ triggers on first load of messages for this convo

  // When a new message arrives and user is near bottom, auto-scroll
  useEffect(() => {
    const el = messagesRef.current
    if (!el || !active?.messages?.length) return
    if (isAtBottomRef.current) {
      el.scrollTop = el.scrollHeight
      setNewMessagesCount(0)
    }
  }, [active?.messages?.length])

  // Track whether user is near the bottom of the scroll area
  function handleScroll() {
    const el = messagesRef.current
    if (!el) return
    // "At bottom" = within 60px of the bottom (allows a little slack)
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60
    setIsAtBottom(atBottom)
    if (atBottom && newMessagesCount > 0) setNewMessagesCount(0)
    // Update saved position live so refreshing doesn't lose it
    if (activeConvoId) scrollMemory.set(activeConvoId, el.scrollTop)
  }

  function scrollToBottom(smooth = true) {
    const el = messagesRef.current
    if (!el) return
    if (smooth) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    } else {
      el.scrollTop = el.scrollHeight
    }
    setNewMessagesCount(0)
  }

  // Close project menu on outside click
  useEffect(() => {
    function onClickOutside(e) {
      if (projectMenuRef.current && !projectMenuRef.current.contains(e.target)) {
        setShowProjectMenu(false)
      }
    }
    if (showProjectMenu) document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [showProjectMenu])

  async function sendMessage() {
    if (!input.trim() || !activeConvoId) return
    await fetch(`${API}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ conversation_id: activeConvoId, direction: 'out', text: input })
    })
    setInput(''); setShowEmoji(false)
    // Send action implies user is present — jump to bottom
    setTimeout(() => scrollToBottom(true), 50)
  }

  async function resolveConvo(newStatus) {
    await fetch(`${API}/conversations/${activeConvoId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ status: newStatus })
    })
    setActive(prev => ({ ...prev, status: newStatus }))
  }

  async function assignToProject(projectId) {
    try {
      await fetch(`${API}/conversations/${activeConvoId}/project`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ project_id: projectId })
      })
      setActive(prev => prev ? { ...prev, project_id: projectId } : prev)
      setShowProjectMenu(false)
    } catch (err) {
      alert('Could not assign to project. Please try again.')
    }
  }

  function insertEmoji(emoji) {
    const ta = textareaRef.current; if (!ta) return
    const s = ta.selectionStart
    const nv = input.slice(0, s) + emoji + input.slice(s)
    setInput(nv)
    setTimeout(() => { ta.selectionStart = s + emoji.length; ta.selectionEnd = s + emoji.length; ta.focus() }, 0)
  }

  if (isMobile && mobileView !== 'chat') return null

  const currentProject = projects?.find(p => p.id === active?.project_id)
  const activeProjects = (projects || []).filter(p => p.status === 'active')

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative', background: '#fff' }}>
      {/* Header */}
      <div style={{ padding: '10px 14px', borderBottom: '0.5px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0, background: '#fff' }}>
        {isMobile && (
          <button onClick={() => setMobileView('inbox')}
            style={{ width: 30, height: 30, borderRadius: 7, border: '0.5px solid #d1d5db', background: 'transparent', cursor: 'pointer', fontSize: 18, color: '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>‹</button>
        )}
        {active ? (
          <>
            <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#dbeafe', color: '#1e40af', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 500, flexShrink: 0 }}>
              {active.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>{active.name}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2, flexWrap: 'wrap' }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: active.status === 'open' ? '#22c55e' : '#9ca3af' }} />
                <span style={{ fontSize: 10, color: '#6b7280' }}>{active.status === 'open' ? 'Active' : 'Last seen recently'}</span>
                {!isMobile && <span style={{ fontSize: 10, color: '#9ca3af', fontFamily: 'monospace' }}>{active.phone}</span>}
                <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, fontWeight: 500, background: active.type === 'client' ? '#dbeafe' : '#ede9fe', color: active.type === 'client' ? '#1e40af' : '#5b21b6' }}>{active.type}</span>
                {currentProject && (
                  <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: (currentProject.colour || '#2563eb') + '20', color: currentProject.colour || '#2563eb', fontWeight: 600 }}>
                    {currentProject.client_name}
                  </span>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 4, flexShrink: 0, position: 'relative' }}>
              <div ref={projectMenuRef} style={{ position: 'relative' }}>
                <button onClick={() => setShowProjectMenu(!showProjectMenu)}
                  title="Assign to project"
                  style={{ padding: '4px 9px', borderRadius: 7, border: '0.5px solid #d1d5db', background: showProjectMenu ? '#f1f4f9' : 'transparent', fontSize: 10, color: currentProject ? (currentProject.colour || '#2563eb') : '#6b7280', cursor: 'pointer', fontWeight: currentProject ? 600 : 400 }}>
                  {currentProject ? currentProject.client_name : '+ Project'}
                </button>
                {showProjectMenu && (
                  <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, background: '#fff', border: '0.5px solid #e5e7eb', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: 200, maxHeight: 280, overflowY: 'auto', zIndex: 20 }}>
                    <div style={{ padding: '6px 10px', fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '0.5px solid #f1f4f9' }}>Assign to project</div>
                    <button onClick={() => assignToProject(null)}
                      style={{ width: '100%', textAlign: 'left', padding: '7px 10px', background: !currentProject ? ACCENT_LIGHT : 'transparent', border: 'none', fontSize: 11, color: '#6b7280', cursor: 'pointer', fontStyle: 'italic' }}>
                      — No project —
                    </button>
                    {activeProjects.length === 0 ? (
                      <div style={{ padding: '10px', fontSize: 11, color: '#9ca3af', textAlign: 'center' }}>
                        No active projects.<br/>Create one in Projects.
                      </div>
                    ) : activeProjects.map(p => (
                      <button key={p.id} onClick={() => assignToProject(p.id)}
                        style={{ width: '100%', textAlign: 'left', padding: '7px 10px', background: currentProject?.id === p.id ? ACCENT_LIGHT : 'transparent', border: 'none', fontSize: 11, color: '#111827', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.colour || '#2563eb', flexShrink: 0 }} />
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.client_name}</span>
                        <span style={{ fontSize: 9, color: '#9ca3af' }}>{p.start_month} {p.start_year}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button onClick={() => resolveConvo(active.status === 'open' ? 'resolved' : 'open')}
                style={{ padding: '4px 9px', borderRadius: 7, border: active.status === 'open' ? '0.5px solid #86efac' : '0.5px solid #fca5a5', background: 'transparent', fontSize: 10, color: active.status === 'open' ? '#16a34a' : '#dc2626', cursor: 'pointer' }}>
                {active.status === 'open' ? 'Resolve' : 'Reopen'}
              </button>
              <button onClick={() => setShowReassign(!showReassign)}
                style={{ padding: '4px 9px', borderRadius: 7, border: '0.5px solid #d1d5db', background: 'transparent', fontSize: 10, color: '#6b7280', cursor: 'pointer' }}>
                Reassign
              </button>
              <button onClick={() => setShowDrawer(!showDrawer)}
                style={{ padding: '4px 9px', borderRadius: 7, border: '0.5px solid #d1d5db', background: showDrawer ? '#f1f4f9' : 'transparent', fontSize: 10, color: '#6b7280', cursor: 'pointer' }}>
                Contact
              </button>
            </div>
          </>
        ) : (
          <div style={{ fontSize: 13, color: '#9ca3af' }}>Select a conversation</div>
        )}
      </div>

      {/* Messages */}
      <div ref={messagesRef} onScroll={handleScroll}
        style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 2, position: 'relative' }}>
        {active?.messages?.map((m, i) => {
          const prev = active.messages[i - 1]
          const showSender = !prev || prev.direction !== m.direction
          // Show a date divider if this is the first message OR the day changed from previous
          const prevDay = prev?.created_at ? new Date(prev.created_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Singapore' }) : null
          const thisDay = m.created_at ? new Date(m.created_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Singapore' }) : null
          const showDateDivider = thisDay && prevDay !== thisDay
          return (
            <div key={m.id || i} style={{ display: 'contents' }}>
              {showDateDivider && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '14px 0 10px', padding: '0 4px' }}>
                  <div style={{ flex: 1, height: 1, background: '#e5e7eb' }} />
                  <div style={{ fontSize: 10, color: '#6b7280', fontWeight: 500, padding: '2px 10px', background: '#f9fafb', border: '0.5px solid #e5e7eb', borderRadius: 11, letterSpacing: '0.2px' }}>
                    {dateGroupLabel(m.created_at)}
                  </div>
                  <div style={{ flex: 1, height: 1, background: '#e5e7eb' }} />
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: m.direction === 'out' ? 'flex-end' : 'flex-start', marginBottom: 2 }}>
                {showSender && <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 2, padding: '0 3px', textAlign: m.direction === 'out' ? 'right' : 'left' }}>{m.direction === 'out' ? (active.assigned_to || 'Agent') : active.name}</div>}
                <div style={{ maxWidth: isMobile ? '85%' : '74%', padding: '8px 12px', borderRadius: 12, fontSize: 12, lineHeight: 1.6, wordBreak: 'break-word', whiteSpace: 'pre-wrap', background: m.direction === 'out' ? ACCENT : '#f1f4f9', color: m.direction === 'out' ? '#fff' : '#111827', borderBottomRightRadius: m.direction === 'out' ? 3 : 12, borderBottomLeftRadius: m.direction === 'in' ? 3 : 12 }}>
                  {m.text}
                </div>
                <div style={{ fontSize: 9, color: '#9ca3af', marginTop: 2, padding: '0 3px', display: 'flex', alignItems: 'center', gap: 3, justifyContent: m.direction === 'out' ? 'flex-end' : 'flex-start' }}>
                  {fmtSGT(m.created_at)}
                  {m.direction === 'out' && <svg width="13" height="8" viewBox="0 0 18 10"><path d="M1 5l3 3 7-7" stroke="#60a5fa" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/><path d="M6 5l3 3 7-7" stroke="#60a5fa" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* "New messages" pill — shows only when scrolled up AND new messages arrived */}
      {!isAtBottom && newMessagesCount > 0 && (
        <button onClick={() => scrollToBottom(true)}
          style={{ position: 'absolute', bottom: 128, right: 18, padding: '6px 12px 6px 10px', background: ACCENT, color: '#fff', border: 'none', borderRadius: 16, fontSize: 11, fontWeight: 500, cursor: 'pointer', boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)', display: 'flex', alignItems: 'center', gap: 5, zIndex: 10 }}>
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          {newMessagesCount} new {newMessagesCount === 1 ? 'message' : 'messages'}
        </button>
      )}

      {/* Composer */}
      <div style={{ borderTop: '0.5px solid #e5e7eb', padding: '9px 14px', flexShrink: 0, background: '#fff' }}>
        <div style={{ display: 'flex', gap: 3, marginBottom: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {[['text', 'Text'], ['template', 'Template']].map(([k, l]) => (
            <button key={k} onClick={() => { setCompMode(k); setShowEmoji(false) }}
              style={{ padding: '3px 9px', borderRadius: 7, border: '0.5px solid #d1d5db', background: compMode === k ? NAVY : 'transparent', fontSize: 10, color: compMode === k ? '#fff' : '#6b7280', cursor: 'pointer' }}>
              {l}
            </button>
          ))}
          <button onClick={() => setShowEmoji(!showEmoji)}
            style={{ padding: '3px 9px', borderRadius: 7, border: '0.5px solid #d1d5db', background: showEmoji ? NAVY : 'transparent', fontSize: 10, color: showEmoji ? '#fff' : '#6b7280', cursor: 'pointer' }}>
            Emoji
          </button>
          <button onClick={() => alert('File attachment available once Meta API connected.')}
            style={{ marginLeft: 'auto', padding: '3px 9px', borderRadius: 7, border: '0.5px solid #d1d5db', background: 'transparent', fontSize: 10, color: '#6b7280', cursor: 'pointer' }}>
            📎 Attach
          </button>
        </div>
        {compMode === 'template' && (
          <select onChange={e => { const t = DEFAULT_TEMPLATES.find(t => t.id === parseInt(e.target.value)); if (t) setInput(t.body) }}
            style={{ width: '100%', padding: '5px 8px', border: '0.5px solid #d1d5db', borderRadius: 7, fontSize: 11, background: '#f9fafb', color: '#111827', marginBottom: 5, outline: 'none' }}>
            <option value="">Select a template…</option>
            {DEFAULT_TEMPLATES.filter(t => t.status === 'approved').map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        )}
        {showEmoji && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 1, marginBottom: 5, padding: 7, background: '#f9fafb', borderRadius: 8, border: '0.5px solid #e5e7eb', maxHeight: 108, overflowY: 'auto' }}>
            {EMOJIS.map(e => <span key={e} onClick={() => insertEmoji(e)} style={{ fontSize: 16, cursor: 'pointer', padding: 2, borderRadius: 3, lineHeight: 1.2, userSelect: 'none' }}>{e}</span>)}
          </div>
        )}
        <div style={{ display: 'flex', gap: 7, alignItems: 'flex-end' }}>
          <textarea ref={textareaRef} value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
            placeholder={compMode === 'template' ? 'Edit template before sending…' : 'Type a message…'}
            rows={2}
            style={{ flex: 1, padding: '7px 10px', border: '0.5px solid #d1d5db', borderRadius: 8, fontSize: 12, background: '#f9fafb', color: '#111827', resize: 'none', fontFamily: 'inherit', lineHeight: 1.5, minHeight: 46, maxHeight: 100, overflowY: 'auto', outline: 'none' }} />
          <button onClick={sendMessage}
            style={{ padding: '8px 18px', background: ACCENT, color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: 'pointer', flexShrink: 0 }}>
            Send
          </button>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
          <span style={{ fontSize: 10, color: '#9ca3af' }}>Enter to send · Shift+Enter for new line</span>
          <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 6, fontWeight: 500, background: active?.status === 'open' ? ACCENT_LIGHT : '#fef3c7', color: active?.status === 'open' ? '#1e40af' : '#92400e' }}>
            {active?.status === 'open' ? '24hr window open' : 'Template required'}
          </span>
        </div>
      </div>
    </div>
  )
}