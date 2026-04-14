const express = require('express')
const app = express()
const cors = require('cors')
app.use(cors())

app.use(express.json())

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

app.get('/', function(req, res) {
  res.send('Agency Hub server is running')
})

app.get('/conversations', function(req, res) {
  res.json(conversations)
})

app.get('/conversations/:id', function(req, res) {
  const convo = conversations.find(c => c.id === parseInt(req.params.id))
  if (!convo) return res.status(404).json({ error: 'Not found' })
  res.json(convo)
})

app.listen(4000, function() {
  console.log('Server started on port 4000')
})