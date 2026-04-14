import { useState } from 'react'

const conversations = [
  {
    id: 1,
    name: 'Sarah Lim',
    preview: 'Can I reschedule my interview?',
    messages: [
      { dir: 'out', text: 'Hi Sarah, your interview is confirmed for Wednesday 10am.' },
      { dir: 'in',  text: 'Thank you! Can I reschedule to Thursday instead?' },
      { dir: 'out', text: 'Of course, let me check with the client.' },
    ]
  },
  {
    id: 2,
    name: 'Tech Corp HR',
    preview: 'We need 2 candidates by Friday',
    messages: [
      { dir: 'in',  text: 'Good morning, we have an urgent requirement.' },
      { dir: 'out', text: 'Good morning! Please share the job scope.' },
      { dir: 'in',  text: 'We need 2 admin executives by Friday.' },
    ]
  },
  {
    id: 3,
    name: 'David Wong',
    preview: 'I will review the offer letter',
    messages: [
      { dir: 'out', text: 'Hi David, your offer letter is attached. Please confirm by Friday.' },
      { dir: 'in',  text: 'Thank you, I will review and get back to you.' },
    ]
  }
]

export default function App() {
  const [activeId, setActiveId] = useState(null)
  const [input, setInput] = useState('')
  const [convos, setConvos] = useState(conversations)

  const active = convos.find(c => c.id === activeId)

  function openConvo(id) {
    setActiveId(id)
  }

  function sendMessage() {
    if (!input.trim() || !activeId) return
    setConvos(convos.map(c => {
      if (c.id !== activeId) return c
      return {
        ...c,
        preview: input,
        messages: [...c.messages, { dir: 'out', text: input }]
      }
    }))
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
              <div style={{ fontSize: '12px', color: '#888' }}>{c.preview}</div>
            </div>
          ))}
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>

          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e0e0e0', fontSize: '14px', fontWeight: 'bold', color: '#333' }}>
            {active ? active.name : 'Select a conversation'}
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
                  background: m.dir === 'out' ? '#25D366' : '#f0f0f0',
                  color: m.dir === 'out' ? 'white' : '#333',
                  alignSelf: m.dir === 'out' ? 'flex-end' : 'flex-start'
                }}
              >
                {m.text}
              </div>
            ))}
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