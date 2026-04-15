import { useState, useEffect, useRef } from 'react'
import { io } from 'socket.io-client'

const socket = io('http://localhost:4000')

export default function App() {
  const [convos, setConvos] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [active, setActive] = useState(null)
  const [input, setInput] = useState('')
  const messagesEndRef = useRef(null)

  useEffect(function() {
    fetch('http://localhost:4000/conversations')
      .then(res => res.json())
      .then(data => setConvos(data))
  }, [])

  useEffect(function() {
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
    return function() { socket.off('new_message') }
  }, [])

  useEffect(function() {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [active])

  function openConvo(id) {
    setActiveId(id)
    socket.emit('join_conversation', id)
    fetch('http://localhost:4000/conversations/' + id)
      .then(res => res.json())
      .then(data => setActive(data))
  }

  async function sendMessage() {
    if (!input.trim() || !activeId) return
    const res = await fetch('http://localhost:4000/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversation_id: activeId,
        direction: 'out',
        text: input
      })
    })
    setInput('')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: 'sans-serif' }}>

      <div style={{ background: '#25D366', color: 'white', padding: '14px 20px', fontSize: '16px', fontWeight: 'bold' }}>
        Agency Hub
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