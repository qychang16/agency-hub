import { useState, useEffect, useRef } from 'react'
import { io } from 'socket.io-client'

export default function App() {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [convos, setConvos] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [active, setActive] = useState(null)
  const [input, setInput] = useState('')
  const messagesEndRef = useRef(null)
  const socketRef = useRef(null)

  async function login() {
    setLoginError('')
    const res = await fetch('http://localhost:4000/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    })
    const data = await res.json()
    if (!res.ok) return setLoginError(data.error)
    setUser(data.user)
    setToken(data.token)
    localStorage.setItem('token', data.token)
    localStorage.setItem('user', JSON.stringify(data.user))
  }

  function logout() {
    setUser(null)
    setToken(null)
    localStorage.removeItem('token')
    localStorage.removeItem('user')
  }

  useEffect(function() {
    const savedToken = localStorage.getItem('token')
    const savedUser = localStorage.getItem('user')
    if (savedToken && savedUser) {
      setToken(savedToken)
      setUser(JSON.parse(savedUser))
    }
  }, [])

  useEffect(function() {
    if (!token) return
    fetch('http://localhost:4000/conversations', {
      headers: { Authorization: 'Bearer ' + token }
    })
      .then(res => res.json())
      .then(data => setConvos(data))

    const socket = io('http://localhost:4000')
    socketRef.current = socket
    socket.on('new_message', function(message) {
      setActive(prev => {
        if (!prev) return prev
        return { ...prev, messages: [...prev.messages, message] }
      })
      setConvos(prev => prev.map(c =>
        c.id === message.conversation_id
          ? { ...c, preview: message.text }
          : c
      ))
    })
    return function() { socket.disconnect() }
  }, [token])

  useEffect(function() {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [active])

  function openConvo(id) {
    setActiveId(id)
    if (socketRef.current) socketRef.current.emit('join_conversation', id)
    fetch('http://localhost:4000/conversations/' + id, {
      headers: { Authorization: 'Bearer ' + token }
    })
      .then(res => res.json())
      .then(data => setActive(data))
  }

  async function sendMessage() {
    if (!input.trim() || !activeId) return
    await fetch('http://localhost:4000/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token
      },
      body: JSON.stringify({
        conversation_id: activeId,
        direction: 'out',
        text: input
      })
    })
    setInput('')
  }

  if (!user) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#f5f5f5', fontFamily: 'sans-serif' }}>
        <div style={{ background: 'white', padding: '40px', borderRadius: '12px', border: '1px solid #e0e0e0', width: '360px' }}>
          <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#25D366', marginBottom: '8px' }}>Agency Hub</div>
          <div style={{ fontSize: '13px', color: '#888', marginBottom: '24px' }}>Sign in to your account</div>

          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontSize: '12px', color: '#555', marginBottom: '4px' }}>Email</div>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && login()}
              placeholder="you@agencyhub.com"
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #e0e0e0', borderRadius: '8px', fontSize: '13px' }}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '12px', color: '#555', marginBottom: '4px' }}>Password</div>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && login()}
              placeholder="Enter your password"
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #e0e0e0', borderRadius: '8px', fontSize: '13px' }}
            />
          </div>

          {loginError && <div style={{ fontSize: '12px', color: '#ef4444', marginBottom: '12px' }}>{loginError}</div>}

          <button
            onClick={login}
            style={{ width: '100%', padding: '11px', background: '#25D366', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' }}
          >
            Sign in
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: 'sans-serif' }}>

      <div style={{ background: '#25D366', color: 'white', padding: '14px 20px', fontSize: '16px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>Agency Hub</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '13px', fontWeight: 'normal' }}>{user.name} · {user.role}</span>
          <button onClick={logout} style={{ padding: '5px 12px', background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '6px', color: 'white', fontSize: '12px', cursor: 'pointer' }}>Sign out</button>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        <div style={{ width: '300px', background: 'white', borderRight: '1px solid #e0e0e0', overflowY: 'auto' }}>
          {convos.map(c => (
            <div
              key={c.id}
              onClick={() => openConvo(c.id)}
              style={{
                padding: '16px',
                borderBottom: '1px solid #e0e0e0',
                cursor: 'pointer',
                background: c.id === activeId ? '#e8f5e9' : 'white'
              }}
            >
              <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#333', marginBottom: '4px' }}>{c.name}</div>
              <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>{c.preview}</div>
              <div style={{ fontSize: '11px', color: '#25D366', fontWeight: '500' }}>{c.assigned_to}</div>
            </div>
          ))}
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>

          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e0e0e0', fontSize: '14px', fontWeight: 'bold', color: '#333' }}>
            {active ? active.name : 'Select a conversation'}
            {active && <span style={{ fontSize: '12px', color: '#888', fontWeight: 'normal', marginLeft: '10px' }}>{active.phone}</span>}
          </div>

          <div style={{ flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {active && active.messages.map((m, i) => (
              <div
                key={i}
                style={{
                  maxWidth: '70%',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  fontSize: '13px',
                  lineHeight: '1.5',
                  background: m.direction === 'out' ? '#25D366' : '#f0f0f0',
                  color: m.direction === 'out' ? 'white' : '#333',
                  alignSelf: m.direction === 'out' ? 'flex-end' : 'flex-start'
                }}
              >
                {m.text}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <div style={{ padding: '14px 20px', borderTop: '1px solid #e0e0e0', display: 'flex', gap: '10px' }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage()}
              placeholder="Type a message..."
              style={{ flex: 1, padding: '10px 14px', border: '1px solid #e0e0e0', borderRadius: '8px', fontSize: '13px' }}
            />
            <button
              onClick={sendMessage}
              style={{ padding: '10px 20px', background: '#25D366', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}
            >
              Send
            </button>
          </div>

        </div>

      </div>

    </div>
  )
}