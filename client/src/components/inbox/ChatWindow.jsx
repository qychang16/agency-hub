import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../context/AuthContext'
import { API, EMOJIS, DEFAULT_TEMPLATES } from '../../utils/constants'
import { ink, accent, semantic, fonts, textSize, textWeight, space, radius, border, shadow, microLabel } from '../../utils/designTokens'
import { fmtSGT } from '../../utils/dates'
import { io } from 'socket.io-client'

const scrollMemory = new Map()

function dateGroupLabel(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const toSGT = x => x.toLocaleDateString('en-CA', { timeZone: 'Asia/Singapore' })
  const msgDay = toSGT(d)
  const today = toSGT(now)
  const y = new Date(now); y.setDate(y.getDate() - 1)
  if (msgDay === today) return 'Today'
  if (msgDay === toSGT(y)) return 'Yesterday'
  const diffDays = Math.floor((new Date(today) - new Date(msgDay)) / 86400000)
  if (diffDays > 0 && diffDays < 7) {
    return d.toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'short', timeZone: 'Asia/Singapore' })
  }
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Singapore' })
}

// Reusable ghost button - quiet, neutral, consistent
function GhostButton({ children, onClick, active, primary, title, danger }) {
  const color = danger ? semantic.danger : primary ? accent.DEFAULT : ink[700]
  const borderCol = danger ? semantic.danger : primary ? accent.DEFAULT : ink[300]
  return (
    <button onClick={onClick} title={title}
      style={{
        padding: `${space[1] + 1}px ${space[2] + 2}px`,
        borderRadius: radius.md,
        border: `0.5px solid ${borderCol}`,
        background: active ? ink[100] : 'transparent',
        fontSize: textSize.xs,
        color,
        cursor: 'pointer',
        fontFamily: fonts.body,
        fontWeight: textWeight.medium,
        whiteSpace: 'nowrap',
      }}>{children}</button>
  )
}

export default function ChatWindow({ activeConvoId, active, setActive, projects, showDrawer, setShowDrawer, isMobile, mobileView, setMobileView, jumpToMessageId, clearJumpToMessage }) {
  const { token, user, hasPermission } = useAuth()
  const canSend = hasPermission('send_messages')
  const canManageConvos = hasPermission('manage_conversations')
  const [input, setInput] = useState('')
  const [compMode, setCompMode] = useState('text')
  const [showEmoji, setShowEmoji] = useState(false)
  const [showReassign, setShowReassign] = useState(false)
  const [showProjectMenu, setShowProjectMenu] = useState(false)
  const [newMessagesCount, setNewMessagesCount] = useState(0)
  const [isAtBottom, setIsAtBottom] = useState(true)
  const [hoveredMsgId, setHoveredMsgId] = useState(null)
  const [pinError, setPinError] = useState('')
  const [flashedMsgId, setFlashedMsgId] = useState(null)
  const [expandedPinId, setExpandedPinId] = useState(null)
  const messagesRef = useRef(null)
  const textareaRef = useRef(null)
  const socketRef = useRef(null)
  const projectMenuRef = useRef(null)
  const prevConvoIdRef = useRef(null)
  const isAtBottomRef = useRef(true)
  const messageRefs = useRef(new Map())

  useEffect(() => {
    const socket = io(API)
    socketRef.current = socket
    socket.on('new_message', msg => {
      if (msg.conversation_id === activeConvoId) {
        setActive(prev => prev ? { ...prev, messages: [...(prev.messages || []), msg] } : prev)
        if (!isAtBottomRef.current) setNewMessagesCount(n => n + 1)
      }
    })
    return () => socket.disconnect()
  }, [activeConvoId, setActive])

  useEffect(() => { isAtBottomRef.current = isAtBottom }, [isAtBottom])

  useEffect(() => {
    if (prevConvoIdRef.current && prevConvoIdRef.current !== activeConvoId && messagesRef.current) {
      scrollMemory.set(prevConvoIdRef.current, messagesRef.current.scrollTop)
    }
    prevConvoIdRef.current = activeConvoId
    setNewMessagesCount(0)
    setExpandedPinId(null)
  }, [activeConvoId])

  useEffect(() => {
    const el = messagesRef.current
    if (!el || !active?.messages) return
    if (jumpToMessageId) {
      setTimeout(() => { scrollToMessage(jumpToMessageId); clearJumpToMessage?.() }, 100)
      return
    }
    const saved = scrollMemory.get(activeConvoId)
    if (saved !== undefined) el.scrollTop = saved
    else el.scrollTop = el.scrollHeight
  }, [activeConvoId, active?.messages?.length === undefined ? 0 : (active?.messages?.length > 0 ? 1 : 0)])

  useEffect(() => {
    const el = messagesRef.current
    if (!el || !active?.messages?.length) return
    if (isAtBottomRef.current) {
      el.scrollTop = el.scrollHeight
      setNewMessagesCount(0)
    }
  }, [active?.messages?.length])

  function handleScroll() {
    const el = messagesRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60
    setIsAtBottom(atBottom)
    if (atBottom && newMessagesCount > 0) setNewMessagesCount(0)
    if (activeConvoId) scrollMemory.set(activeConvoId, el.scrollTop)
  }

  function scrollToBottom(smooth = true) {
    const el = messagesRef.current
    if (!el) return
    if (smooth) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    else el.scrollTop = el.scrollHeight
    setNewMessagesCount(0)
  }

  function scrollToMessage(msgId) {
    const el = messageRefs.current.get(msgId)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setFlashedMsgId(msgId)
    setTimeout(() => setFlashedMsgId(null), 1800)
  }

  useEffect(() => {
    function onClickOutside(e) {
      if (projectMenuRef.current && !projectMenuRef.current.contains(e.target)) setShowProjectMenu(false)
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
    } catch (err) { alert('Could not assign to project. Please try again.') }
  }

  async function togglePin(msgId) {
    setPinError('')
    try {
      const r = await fetch(`${API}/messages/${msgId}/pin`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }
      })
      const data = await r.json()
      if (!r.ok) {
        setPinError(data.error || 'Could not pin message')
        setTimeout(() => setPinError(''), 4000)
        return
      }
      setActive(prev => {
        if (!prev) return prev
        const messages = prev.messages.map(m => {
          if (m.id === msgId) {
            return data.pinned
              ? { ...m, pinned_at: new Date().toISOString(), pinned_by_name: user?.name || 'You' }
              : { ...m, pinned_at: null, pinned_by_name: null }
          }
          return m
        })
        const pinned_messages = messages.filter(m => m.pinned_at).sort((a, b) => new Date(b.pinned_at) - new Date(a.pinned_at))
        return { ...prev, messages, pinned_messages }
      })
    } catch (err) {
      setPinError('Network error. Try again.')
      setTimeout(() => setPinError(''), 4000)
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
  const pinnedMessages = active?.pinned_messages || []

  const initials = active?.name ? active.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : ''
  const isClient = active?.type === 'client'

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      overflow: 'hidden', position: 'relative',
      background: ink[50],
      fontFamily: fonts.body,
    }}>
      {/* Header */}
      <div style={{
        padding: `${space[3]}px ${space[4]}px`,
        borderBottom: border.subtle,
        display: 'flex', alignItems: 'center', gap: space[3],
        flexShrink: 0, background: '#fff',
      }}>
        {isMobile && (
          <button onClick={() => setMobileView('inbox')}
            style={{
              width: 28, height: 28, borderRadius: radius.md,
              border: `0.5px solid ${ink[300]}`,
              background: 'transparent', cursor: 'pointer',
              color: ink[700], display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M10 4L6 8l4 4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        )}
        {active ? (
          <>
            <div style={{
              width: 36, height: 36, borderRadius: radius.pill,
              background: isClient ? accent.DEFAULT : '#f5e9d6',
              color: isClient ? '#fff' : '#7a5a1f',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: textSize.sm, fontWeight: textWeight.semibold,
              flexShrink: 0,
            }}>{initials}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontFamily: fonts.display,
                fontSize: textSize.md,
                fontWeight: textWeight.semibold,
                color: ink[900],
                letterSpacing: '-0.1px',
              }}>{active.name}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: space[2], marginTop: 1, flexWrap: 'wrap' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: space[1], fontSize: textSize.xs, color: ink[600] }}>
                  <span style={{
                    width: 6, height: 6, borderRadius: radius.pill,
                    background: active.status === 'open' ? semantic.success : ink[500],
                  }} />
                  {active.status === 'open' ? 'Active' : 'Last seen recently'}
                </span>
                {!isMobile && (
                  <span style={{ fontSize: textSize.xs, color: ink[600], fontFamily: fonts.mono }}>
                    {active.phone}
                  </span>
                )}
                <span style={{
                  fontSize: 9, padding: '2px 7px', borderRadius: radius.sm,
                  background: isClient ? accent.DEFAULT : '#f5e9d6',
                  color: isClient ? '#fff' : '#7a5a1f',
                  fontWeight: textWeight.bold, textTransform: 'uppercase', letterSpacing: '0.5px',
                }}>{isClient ? 'Client' : 'Candidate'}</span>
                {currentProject && (
                  <span style={{
                    fontSize: 9, padding: '1px 6px', borderRadius: radius.sm,
                    background: ink[900], color: ink[50],
                    fontWeight: textWeight.medium,
                  }}>{currentProject.client_name}</span>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: space[1], flexShrink: 0, position: 'relative' }}>
              {canManageConvos && (
              <div ref={projectMenuRef} style={{ position: 'relative' }}>
                <GhostButton onClick={() => setShowProjectMenu(!showProjectMenu)} active={showProjectMenu} primary={!!currentProject} title="Assign to project">
                  {currentProject ? currentProject.client_name : '+ Project'}
                </GhostButton>
                {showProjectMenu && (
                  <div style={{
                    position: 'absolute', top: 'calc(100% + 4px)', right: 0,
                    background: '#fff',
                    border: border.subtle,
                    borderRadius: radius.md,
                    boxShadow: shadow.floating,
                    minWidth: 220, maxHeight: 300, overflowY: 'auto',
                    zIndex: 20,
                  }}>
                    <div style={{
                      padding: `${space[2]}px ${space[3]}px`,
                      borderBottom: border.subtle,
                      ...microLabel, color: ink[600],
                    }}>Assign to project</div>
                    <button onClick={() => assignToProject(null)}
                      style={{
                        width: '100%', textAlign: 'left',
                        padding: `${space[2]}px ${space[3]}px`,
                        background: !currentProject ? ink[100] : 'transparent',
                        border: 'none',
                        fontSize: textSize.xs, color: ink[600],
                        cursor: 'pointer', fontStyle: 'italic',
                        fontFamily: fonts.body,
                      }}>-- No project --</button>
                    {activeProjects.length === 0 ? (
                      <div style={{ padding: space[3], fontSize: textSize.xs, color: ink[500], textAlign: 'center' }}>
                        No active projects.<br/>Create one in Projects.
                      </div>
                    ) : activeProjects.map(p => (
                      <button key={p.id} onClick={() => assignToProject(p.id)}
                        style={{
                          width: '100%', textAlign: 'left',
                          padding: `${space[2]}px ${space[3]}px`,
                          background: currentProject?.id === p.id ? ink[100] : 'transparent',
                          border: 'none',
                          fontSize: textSize.xs, color: ink[800],
                          cursor: 'pointer',
                          display: 'flex', alignItems: 'center', gap: space[2],
                          fontFamily: fonts.body,
                        }}>
                        <span style={{ width: 6, height: 6, borderRadius: radius.pill, background: p.colour || accent.DEFAULT, flexShrink: 0 }} />
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.client_name}</span>
                        <span style={{ fontSize: 9, color: ink[500] }}>{p.start_month} {p.start_year}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              )}
              {canManageConvos && (
                <GhostButton onClick={() => resolveConvo(active.status === 'open' ? 'resolved' : 'open')}
                  danger={active.status !== 'open'}
                  primary={active.status === 'open'}>
                  {active.status === 'open' ? 'Resolve' : 'Reopen'}
                </GhostButton>
              )}
              {canManageConvos && (
                <GhostButton onClick={() => setShowReassign(!showReassign)}>Reassign</GhostButton>
              )}
              <GhostButton onClick={() => setShowDrawer(!showDrawer)} active={showDrawer}>Contact</GhostButton>
            </div>
          </>
        ) : (
          <div style={{ fontSize: textSize.md, color: ink[500] }}>Select a conversation</div>
        )}
      </div>

      {/* Pinned messages bar */}
      {pinnedMessages.length > 0 && (
        <div style={{
          borderBottom: border.subtle,
          background: ink[100],
          padding: `${space[2]}px ${space[4]}px`,
          display: 'flex', flexDirection: 'column', gap: space[1],
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: space[1], ...microLabel, color: ink[600] }}>
            <svg width="9" height="9" viewBox="0 0 16 16" fill="currentColor">
              <path d="M9.5 1.5a1 1 0 0 1 .707.293l4 4a1 1 0 0 1-.707 1.707h-1.586l-1 4h.586a.5.5 0 0 1 0 1H9l-.5 3a.5.5 0 0 1-1 0L7 11.5H3.5a.5.5 0 0 1 0-1h.586l-1-4H1.5a1 1 0 0 1-.707-1.707l4-4A1 1 0 0 1 5.5 1.5h4z"/>
            </svg>
            {pinnedMessages.length} pinned
          </div>
          {pinnedMessages.map(pm => {
            const preview = (pm.text || '').slice(0, 60)
            const truncated = (pm.text || '').length > 60
            const isExpanded = expandedPinId === pm.id
            return (
              <div key={pm.id}
                onClick={() => scrollToMessage(pm.id)}
                onMouseEnter={() => truncated && setExpandedPinId(pm.id)}
                onMouseLeave={() => setExpandedPinId(null)}
                style={{
                  fontSize: textSize.xs, color: ink[800],
                  padding: `${space[1] + 1}px ${space[2]}px`,
                  borderRadius: radius.sm,
                  background: '#fff',
                  border: border.subtle,
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: space[2],
                  fontFamily: fonts.body,
                }}>
                <span style={{ fontSize: 10, color: ink[500], fontWeight: textWeight.medium, flexShrink: 0, fontFamily: fonts.mono }}>
                  {pm.direction === 'out' ? '>' : '<'}
                </span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: isExpanded ? 'normal' : 'nowrap', lineHeight: 1.4 }}>
                  {isExpanded ? pm.text : preview}{!isExpanded && truncated ? '...' : ''}
                </span>
                {canManageConvos && (
                <button onClick={e => { e.stopPropagation(); togglePin(pm.id) }}
                  title="Unpin"
                  style={{ padding: 2, background: 'transparent', border: 'none', cursor: 'pointer', color: ink[500], display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                  <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M3 3l10 10" strokeLinecap="round"/>
                    <path d="M13 3l-10 10" strokeLinecap="round"/>
                  </svg>
                </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Pin error toast */}
      {pinError && (
        <div style={{
          position: 'absolute', top: space[3], left: '50%', transform: 'translateX(-50%)',
          background: semantic.dangerSoft, color: semantic.danger,
          padding: `${space[1] + 2}px ${space[3]}px`,
          borderRadius: radius.md,
          fontSize: textSize.xs, fontWeight: textWeight.medium,
          boxShadow: shadow.floating,
          zIndex: 50,
          border: `0.5px solid ${semantic.danger}`,
        }}>{pinError}</div>
      )}

      {/* Messages */}
      <div ref={messagesRef} onScroll={handleScroll}
        style={{
          flex: 1, overflowY: 'auto',
          padding: `${space[3]}px ${space[4]}px`,
          display: 'flex', flexDirection: 'column',
          gap: 2, position: 'relative',
        }}>
        {active?.messages?.map((m, i) => {
          const prev = active.messages[i - 1]
          const showSender = !prev || prev.direction !== m.direction
          const prevDay = prev?.created_at ? new Date(prev.created_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Singapore' }) : null
          const thisDay = m.created_at ? new Date(m.created_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Singapore' }) : null
          const showDateDivider = thisDay && prevDay !== thisDay
          const isPinned = !!m.pinned_at
          const isFlashing = flashedMsgId === m.id
          const isHovered = hoveredMsgId === m.id
          return (
            <div key={m.id || i} style={{ display: 'contents' }}>
              {showDateDivider && (
                <div style={{ display: 'flex', alignItems: 'center', gap: space[2], margin: `${space[4]}px 0 ${space[2]}px`, padding: '0 4px' }}>
                  <div style={{ flex: 1, height: 0.5, background: ink[300] }} />
                  <div style={{
                    fontSize: 10, color: ink[600], fontWeight: textWeight.medium,
                    padding: `2px ${space[2]}px`,
                    letterSpacing: '0.4px',
                  }}>{dateGroupLabel(m.created_at)}</div>
                  <div style={{ flex: 1, height: 0.5, background: ink[300] }} />
                </div>
              )}
              <div
                ref={el => { if (el && m.id) messageRefs.current.set(m.id, el); else if (m.id) messageRefs.current.delete(m.id) }}
                onMouseEnter={() => setHoveredMsgId(m.id)}
                onMouseLeave={() => setHoveredMsgId(null)}
                style={{
                  display: 'flex', flexDirection: 'column',
                  alignItems: m.direction === 'out' ? 'flex-end' : 'flex-start',
                  marginBottom: 2, padding: '2px 4px',
                  borderRadius: radius.md,
                  background: isFlashing ? '#fcedb4' : 'transparent',
                  transition: 'background 0.6s',
                  position: 'relative',
                }}>
                {showSender && (
                  <div style={{
                    fontSize: 10, color: ink[500],
                    marginBottom: 3, padding: '0 3px',
                    textAlign: m.direction === 'out' ? 'right' : 'left',
                    fontWeight: textWeight.medium,
                  }}>{m.direction === 'out' ? (active.assigned_to || 'Agent') : active.name}</div>
                )}
                <div style={{ position: 'relative', maxWidth: isMobile ? '85%' : '74%' }}>
                  <div style={{
                    padding: `${space[2] + 1}px ${space[3]}px`,
                    borderRadius: radius.md,
                    fontSize: textSize.sm,
                    lineHeight: 1.55,
                    wordBreak: 'break-word', whiteSpace: 'pre-wrap',
                    background: m.direction === 'out' ? accent.DEFAULT : '#fff',
                    color: m.direction === 'out' ? '#fff' : ink[800],
                    border: m.direction === 'out' ? 'none' : border.subtle,
                    borderTopRightRadius: m.direction === 'out' ? 2 : radius.md,
                    borderTopLeftRadius: m.direction === 'in' ? 2 : radius.md,
                    position: 'relative',
                  }}>
                    {isPinned && (
                      <span title={`Pinned${m.pinned_by_name ? ` by ${m.pinned_by_name}` : ''}`}
                        style={{
                          position: 'absolute', top: -5, [m.direction === 'out' ? 'left' : 'right']: -5,
                          width: 14, height: 14, borderRadius: radius.pill,
                          background: ink[800], color: ink[50],
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          border: `1.5px solid ${ink[50]}`,
                        }}>
                        <svg width="7" height="7" viewBox="0 0 16 16" fill="currentColor">
                          <path d="M9.5 1.5a1 1 0 0 1 .707.293l4 4a1 1 0 0 1-.707 1.707h-1.586l-1 4h.586a.5.5 0 0 1 0 1H9l-.5 3a.5.5 0 0 1-1 0L7 11.5H3.5a.5.5 0 0 1 0-1h.586l-1-4H1.5a1 1 0 0 1-.707-1.707l4-4A1 1 0 0 1 5.5 1.5h4z"/>
                        </svg>
                      </span>
                    )}
                    {m.text}
                  </div>
                  {m.id && (isHovered || isPinned) && canManageConvos && (
                    <button onClick={() => togglePin(m.id)}
                      title={isPinned ? 'Unpin' : 'Pin message'}
                      style={{
                        position: 'absolute', top: '50%', transform: 'translateY(-50%)',
                        [m.direction === 'out' ? 'right' : 'left']: 'calc(100% + 6px)',
                        width: 22, height: 22, borderRadius: radius.md,
                        border: `0.5px solid ${ink[300]}`,
                        background: isPinned ? ink[800] : '#fff',
                        cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: isPinned ? ink[50] : ink[600],
                        boxShadow: shadow.subtle,
                      }}>
                      <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M9.5 1.5a1 1 0 0 1 .707.293l4 4a1 1 0 0 1-.707 1.707h-1.586l-1 4h.586a.5.5 0 0 1 0 1H9l-.5 3a.5.5 0 0 1-1 0L7 11.5H3.5a.5.5 0 0 1 0-1h.586l-1-4H1.5a1 1 0 0 1-.707-1.707l4-4A1 1 0 0 1 5.5 1.5h4z"/>
                      </svg>
                    </button>
                  )}
                </div>
                <div style={{
                  fontSize: 9, color: ink[500],
                  marginTop: 3, padding: '0 3px',
                  display: 'flex', alignItems: 'center', gap: 3,
                  justifyContent: m.direction === 'out' ? 'flex-end' : 'flex-start',
                  fontFamily: fonts.mono, letterSpacing: '0.2px',
                }}>
                  {fmtSGT(m.created_at)}
                  {m.direction === 'out' && (
                    <svg width="12" height="7" viewBox="0 0 18 10">
                      <path d="M1 5l3 3 7-7" stroke={ink[500]} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M6 5l3 3 7-7" stroke={ink[500]} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* New messages pill */}
      {!isAtBottom && newMessagesCount > 0 && (
        <button onClick={() => scrollToBottom(true)}
          style={{
            position: 'absolute', bottom: 128, right: 18,
            padding: `${space[1] + 2}px ${space[3]}px ${space[1] + 2}px ${space[2]}px`,
            background: ink[900], color: ink[50],
            border: 'none', borderRadius: radius.pill,
            fontSize: textSize.xs, fontWeight: textWeight.medium,
            cursor: 'pointer',
            boxShadow: shadow.floating,
            display: 'flex', alignItems: 'center', gap: space[1],
            zIndex: 10, fontFamily: fonts.body,
          }}>
          <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          {newMessagesCount} new {newMessagesCount === 1 ? 'message' : 'messages'}
        </button>
      )}

      {/* Composer */}
      {canSend && (
      <div style={{
        borderTop: border.subtle,
        padding: `${space[2] + 2}px ${space[4]}px`,
        flexShrink: 0, background: '#fff',
      }}>
        <div style={{ display: 'flex', gap: space[1], marginBottom: space[2], alignItems: 'center' }}>
          {[['text', 'Text'], ['template', 'Template']].map(([k, l]) => (
            <button key={k} onClick={() => { setCompMode(k); setShowEmoji(false) }}
              style={{
                padding: `${space[1]}px ${space[2] + 2}px`,
                borderRadius: radius.md,
                border: `0.5px solid ${compMode === k ? ink[900] : ink[300]}`,
                background: compMode === k ? ink[900] : 'transparent',
                fontSize: 10, fontWeight: textWeight.medium,
                color: compMode === k ? ink[50] : ink[700],
                cursor: 'pointer',
                letterSpacing: '0.2px',
                fontFamily: fonts.body,
              }}>{l}</button>
          ))}
          <button onClick={() => setShowEmoji(!showEmoji)}
            style={{
              padding: `${space[1]}px ${space[2] + 2}px`,
              borderRadius: radius.md,
              border: `0.5px solid ${showEmoji ? ink[900] : ink[300]}`,
              background: showEmoji ? ink[900] : 'transparent',
              fontSize: 10, fontWeight: textWeight.medium,
              color: showEmoji ? ink[50] : ink[700],
              cursor: 'pointer',
              letterSpacing: '0.2px',
              fontFamily: fonts.body,
            }}>Emoji</button>
          <button onClick={() => alert('File attachment available once Meta API connected.')}
            style={{
              marginLeft: 'auto',
              padding: `${space[1]}px ${space[2] + 2}px`,
              borderRadius: radius.md,
              border: `0.5px solid ${ink[300]}`,
              background: 'transparent',
              fontSize: 10, fontWeight: textWeight.medium,
              color: ink[700], cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 5,
              letterSpacing: '0.2px',
              fontFamily: fonts.body,
            }}>
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M9.5 3L5 7.5a2.5 2.5 0 0 0 3.5 3.5L13 6.5a4 4 0 0 0-5.5-5.5L3 5.5a5.5 5.5 0 0 0 7.5 7.5L15 8.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Attach
          </button>
        </div>
        {compMode === 'template' && (
          <select onChange={e => { const t = DEFAULT_TEMPLATES.find(t => t.id === parseInt(e.target.value)); if (t) setInput(t.body) }}
            style={{
              width: '100%', padding: `${space[1] + 1}px ${space[2]}px`,
              border: `0.5px solid ${ink[300]}`,
              borderRadius: radius.md,
              fontSize: textSize.xs,
              background: ink[100],
              color: ink[800],
              marginBottom: space[2],
              outline: 'none',
              fontFamily: fonts.body,
            }}>
            <option value="">Select a template...</option>
            {DEFAULT_TEMPLATES.filter(t => t.status === 'approved').map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        )}
        {showEmoji && (
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 1,
            marginBottom: space[2], padding: space[2],
            background: ink[100], borderRadius: radius.md,
            border: border.subtle,
            maxHeight: 108, overflowY: 'auto',
          }}>
            {EMOJIS.map(e => <span key={e} onClick={() => insertEmoji(e)} style={{ fontSize: 16, cursor: 'pointer', padding: 2, borderRadius: 3, lineHeight: 1.2, userSelect: 'none' }}>{e}</span>)}
          </div>
        )}
        <div style={{ display: 'flex', gap: space[2], alignItems: 'flex-end' }}>
          <textarea ref={textareaRef} value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
            placeholder={compMode === 'template' ? 'Edit template before sending...' : 'Type a message'}
            rows={2}
            style={{
              flex: 1, padding: `${space[2]}px ${space[3]}px`,
              border: `0.5px solid ${ink[300]}`,
              borderRadius: radius.md,
              fontSize: textSize.sm,
              background: ink[100],
              color: ink[800],
              resize: 'none', fontFamily: fonts.body,
              lineHeight: 1.5, minHeight: 46, maxHeight: 100,
              overflowY: 'auto', outline: 'none',
            }} />
          <button onClick={sendMessage}
            style={{
              padding: `${space[2] + 1}px ${space[5]}px`,
              background: accent.DEFAULT, color: '#fff',
              border: 'none', borderRadius: radius.md,
              fontSize: textSize.sm, fontWeight: textWeight.semibold,
              cursor: 'pointer', flexShrink: 0,
              fontFamily: fonts.body, letterSpacing: '0.2px',
            }}>Send</button>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: space[1] + 1 }}>
          <span style={{ fontSize: 10, color: ink[600] }}>
            Enter to send - Shift+Enter for new line - <strong style={{ color: ink[800], fontWeight: textWeight.semibold }}>Ctrl+K</strong> to search
          </span>
          {active && (
            <span style={{
              fontSize: 10,
              padding: `2px ${space[2]}px`,
              borderRadius: radius.sm,
              fontWeight: textWeight.medium,
              background: active.status === 'open' ? semantic.successSoft : semantic.warningSoft,
              color: active.status === 'open' ? semantic.success : semantic.warning,
            }}>
              {active.status === 'open' ? '24hr window open' : 'Template required'}
            </span>
          )}
        </div>
      </div>
      )}
    </div>
  )
}