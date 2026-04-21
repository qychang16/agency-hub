import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../context/AuthContext'
import { API, ACCENT, ACCENT_LIGHT, NAVY, EMOJIS, DEFAULT_TEMPLATES } from '../../utils/constants'
import { fmtSGT } from '../../utils/dates'
import { io } from 'socket.io-client'

export default function ChatWindow({ activeConvoId, showDrawer, setShowDrawer, isMobile, mobileView, setMobileView }) {
  const { token, user } = useAuth()
  const [active, setActive] = useState(null)
  const [input, setInput] = useState('')
  const [compMode, setCompMode] = useState('text')
  const [showEmoji, setShowEmoji] = useState(false)
  const [showReassign, setShowReassign] = useState(false)
  const [reassignAgent, setReassignAgent] = useState('')
  const messagesEndRef = useRef(null)
  const messagesRef = useRef(null)
  const textareaRef = useRef(null)
  const socketRef = useRef(null)

  useEffect(() => {
    const socket = io(API)
    socketRef.current = socket
    socket.on('new_message', msg => {
      if (msg.conversation_id === activeConvoId) {
        setActive(prev => prev ? { ...prev, messages: [...prev.messages, msg] } : prev)
      }
    })
    return () => socket.disconnect()
  }, [activeConvoId])

  useEffect(() => {
    if (!activeConvoId || !token) return
    fetch(`${API}/conversations/${activeConvoId}`, { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.json()).then(setActive).catch(() => {})
  }, [activeConvoId, token])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [active?.messages?.length])

  async function sendMessage() {
    if (!input.trim() || !activeConvoId) return
    await fetch(`${API}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ conversation_id: activeConvoId, direction: 'out', text: input })
    })
    setInput(''); setShowEmoji(false)
  }

  async function resolveConvo(newStatus) {
    await fetch(`${API}/conversations/${activeConvoId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ status: newStatus })
    })
    setActive(prev => ({ ...prev, status: newStatus }))
  }

  function insertEmoji(emoji) {
    const ta = textareaRef.current; if (!ta) return
    const s = ta.selectionStart
    const nv = input.slice(0, s) + emoji + input.slice(s)
    setInput(nv)
    setTimeout(() => { ta.selectionStart = s + emoji.length; ta.selectionEnd = s + emoji.length; ta.focus() }, 0)
  }

  if (isMobile && mobileView !== 'chat') return null

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
              {active.name?.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>{active.name}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: active.status === 'open' ? '#22c55e' : '#9ca3af' }} />
                <span style={{ fontSize: 10, color: '#6b7280' }}>{active.status === 'open' ? 'Active' : 'Last seen recently'}</span>
                {!isMobile && <span style={{ fontSize: 10, color: '#9ca3af', fontFamily: 'monospace' }}>{active.phone}</span>}
                <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, fontWeight: 500, background: active.type === 'client' ? '#dbeafe' : '#ede9fe', color: active.type === 'client' ? '#1e40af' : '#5b21b6' }}>{active.type}</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
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
      <div ref={messagesRef} style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {active?.messages?.map((m, i) => {
          const prev = active.messages[i-1]
          const showSender = !prev || prev.direction !== m.direction
          return (
            <div key={m.id||i} style={{ display: 'flex', flexDirection: 'column', alignItems: m.direction === 'out' ? 'flex-end' : 'flex-start', marginBottom: 2 }}>
              {showSender && <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 2, padding: '0 3px', textAlign: m.direction === 'out' ? 'right' : 'left' }}>{m.direction === 'out' ? (active.assigned_to || 'Agent') : active.name}</div>}
              <div style={{ maxWidth: isMobile ? '85%' : '74%', padding: '8px 12px', borderRadius: 12, fontSize: 12, lineHeight: 1.6, wordBreak: 'break-word', whiteSpace: 'pre-wrap', background: m.direction === 'out' ? ACCENT : '#f1f4f9', color: m.direction === 'out' ? '#fff' : '#111827', borderBottomRightRadius: m.direction === 'out' ? 3 : 12, borderBottomLeftRadius: m.direction === 'in' ? 3 : 12 }}>
                {m.text}
              </div>
              <div style={{ fontSize: 9, color: '#9ca3af', marginTop: 2, padding: '0 3px', display: 'flex', alignItems: 'center', gap: 3, justifyContent: m.direction === 'out' ? 'flex-end' : 'flex-start' }}>
                {fmtSGT(m.created_at)}
                {m.direction === 'out' && <svg width="13" height="8" viewBox="0 0 18 10"><path d="M1 5l3 3 7-7" stroke="#60a5fa" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/><path d="M6 5l3 3 7-7" stroke="#60a5fa" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </div>
            </div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Composer */}
      <div style={{ borderTop: '0.5px solid #e5e7eb', padding: '9px 14px', flexShrink: 0, background: '#fff' }}>
        <div style={{ display: 'flex', gap: 3, marginBottom: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {[['text','Text'],['template','Template'],['note','Note']].map(([k,l]) => (
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
        {compMode === 'note' && <div style={{ fontSize: 10, color: '#854d0e', background: '#fefce8', border: '0.5px solid #fcd34d', padding: '3px 8px', borderRadius: 6, marginBottom: 5 }}>Internal note — candidate will not see this</div>}
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
            placeholder={compMode === 'note' ? 'Type internal note…' : compMode === 'template' ? 'Edit template before sending…' : 'Type a message…'}
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