import { useState, useEffect, useRef } from 'react'
import { io } from 'socket.io-client'

export default function App() {
  const [search, setSearch] = useState('')
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

  async function reassign(id, newAgent) {
    await fetch('http://localhost:4000/conversations/' + id + '/assign', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token
      },
      body: JSON.stringify({ assigned_to: newAgent })
    })
    setActive(prev => ({ ...prev, assigned_to: newAgent }))
    setConvos(prev => prev.map(c => c.id === id ? { ...c, assigned_to: newAgent } : c))
  }

  async function resolveConvo(id, newStatus) {
    await fetch('http://localhost:4000/conversations/' + id + '/status', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token
      },
      body: JSON.stringify({ status: newStatus })
    })
    setActive(prev => ({ ...prev, status: newStatus }))
    setConvos(prev => prev.map(c => c.id === id ? { ...c, status: newStatus } : c))
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl border border-gray-200 p-10 w-96">
          <div className="text-2xl font-bold text-green-500 mb-1">Agency Hub</div>
          <div className="text-sm text-gray-400 mb-8">Sign in to your account</div>

          <div className="mb-4">
            <label className="text-xs text-gray-500 mb-1 block">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && login()}
              placeholder="you@agencyhub.com"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-green-400"
            />
          </div>

          <div className="mb-6">
            <label className="text-xs text-gray-500 mb-1 block">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && login()}
              placeholder="Enter your password"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-green-400"
            />
          </div>

          {loginError && <div className="text-xs text-red-500 mb-4">{loginError}</div>}

          <button
            onClick={login}
            className="w-full py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-semibold transition-colors"
          >
            Sign in
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50 font-sans">

      <div className="bg-green-500 text-white px-6 py-3.5 flex items-center justify-between shrink-0">
        <span className="font-bold text-base">Agency Hub</span>
        <div className="flex items-center gap-4">
          <span className="text-sm opacity-90">{user.name} · {user.role}</span>
          <button onClick={logout} className="text-xs px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg transition-colors">
            Sign out
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">

        <div className="w-72 bg-white border-r border-gray-100 flex flex-col overflow-hidden shrink-0">
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Conversations</div>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search conversations..."
              className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-green-400"
            />
          </div>
          <div className="overflow-y-auto flex-1">
            {convos
              .filter(c => {
                if (!search.trim()) return true
                const q = search.toLowerCase().replace(/\s+/g, ' ').trim()
                return (
                  c.name.toLowerCase().includes(q) ||
                  (c.preview && c.preview.toLowerCase().includes(q)) ||
                  (c.phone && c.phone.includes(q))
                )
              })
              .map(c => (
                <div
                  key={c.id}
                  onClick={() => openConvo(c.id)}
                  className={`px-4 py-3.5 border-b border-gray-50 cursor-pointer transition-colors ${c.id === activeId ? 'bg-green-50 border-l-2 border-l-green-500' : 'hover:bg-gray-50'}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold text-gray-800">{c.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.assigned_to === 'Aisha' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                      {c.assigned_to}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400 truncate">{c.preview}</div>
                  <div className={`text-xs mt-1 font-medium ${c.status === 'open' ? 'text-green-500' : 'text-gray-400'}`}>
                    {c.status}
                  </div>
                </div>
              ))}
          </div>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">

          <div className="px-6 py-4 border-b border-gray-100 bg-white shrink-0 flex items-center justify-between">
            <div>
              <div className="text-sm font-bold text-gray-800">
                {active ? active.name : 'Select a conversation'}
              </div>
              {active && <div className="text-xs text-gray-400 mt-0.5">{active.phone}</div>}
            </div>
            {active && (
              <div className="flex items-center gap-2">
                <span className={`text-xs px-3 py-1 rounded-full font-medium ${active.status === 'open' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {active.status}
                </span>
                <span className={`text-xs px-3 py-1 rounded-full font-medium ${active.assigned_to === 'Aisha' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                  {active.assigned_to}
                </span>
                <button
                  onClick={() => reassign(active.id, active.assigned_to === 'Aisha' ? 'Ben' : 'Aisha')}
                  className="text-xs px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-full transition-colors"
                >
                  Reassign
                </button>
                <button
                  onClick={() => resolveConvo(active.id, active.status === 'open' ? 'resolved' : 'open')}
                  className={`text-xs px-3 py-1 rounded-full transition-colors ${active.status === 'open' ? 'bg-red-50 hover:bg-red-100 text-red-600' : 'bg-green-50 hover:bg-green-100 text-green-600'}`}
                >
                  {active.status === 'open' ? 'Resolve' : 'Reopen'}
                </button>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-2">
            {active && active.messages.map((m, i) => (
              <div key={i} className={`flex flex-col ${m.direction === 'out' ? 'items-end' : 'items-start'}`}>
                <div className={`max-w-xs lg:max-w-md px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${m.direction === 'out' ? 'bg-green-500 text-white rounded-br-sm' : 'bg-white border border-gray-100 text-gray-800 rounded-bl-sm'}`}>
                  {m.text}
                </div>
                <div className="text-xs text-gray-300 mt-1 px-1">
                  {new Date(m.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                  {m.direction === 'out' && ' · ✓✓'}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <div className="px-6 py-4 border-t border-gray-100 bg-white shrink-0">
            <div className="flex gap-3 items-end">
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                placeholder="Type a message... (Enter to send, Shift+Enter for new line)"
                rows={2}
                className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-green-400 resize-none"
              />
              <button
                onClick={sendMessage}
                className="px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl text-sm font-semibold transition-colors shrink-0"
              >
                Send
              </button>
            </div>
          </div>

        </div>

      </div>

    </div>
  )
}