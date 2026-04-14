
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

      let activeId = null

      function renderSidebar() {
        const sidebar = document.getElementById('sidebar')
        sidebar.innerHTML = conversations.map(c => `
          <div class="card ${c.id === activeId ? 'active' : ''}" onclick="openConvo(${c.id})">
            <h2>${c.name}</h2>
            <p>${c.preview}</p>
          </div>
        `).join('')
      }

      function openConvo(id) {
        activeId = id
        const c = conversations.find(x => x.id === id)
        document.getElementById('chat-header').textContent = c.name
        const messages = document.getElementById('messages')
        messages.innerHTML = c.messages.map(m => `
          <div class="bubble ${m.dir}">${m.text}</div>
        `).join('')
        messages.scrollTop = messages.scrollHeight
        renderSidebar()
      }

      function sendMessage() {
        const input = document.getElementById('input')
        const text = input.value.trim()
        if (!text || !activeId) return
        const c = conversations.find(x => x.id === activeId)
        c.messages.push({ dir: 'out', text: text })
        c.preview = text
        input.value = ''
        openConvo(activeId)
        renderSidebar()
      }

      document.getElementById('input').addEventListener('keydown', function(e) {
        if (e.key === 'Enter') sendMessage()
      })

      renderSidebar()
      