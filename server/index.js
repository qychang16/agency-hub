const express = require('express')
const http = require('http')
const { Server } = require('socket.io')
const cors = require('cors')
const { Pool } = require('pg')

const app = express()
const server = http.createServer(app)
const io = new Server(server, {
  cors: { origin: 'http://localhost:5173' }
})

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'agency_hub',
  password: 'postgres123',
  port: 5432,
})

app.use(cors())
app.use(express.json())

app.get('/', function(req, res) {
  res.send('Agency Hub server is running')
})

app.get('/test-db', async function(req, res) {
  const result = await pool.query('SELECT NOW()')
  res.json({ time: result.rows[0].now })
})

app.get('/conversations', async function(req, res) {
  const result = await pool.query(`
    SELECT c.id, co.name, co.phone, c.status, c.assigned_to,
    (SELECT text FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as preview,
    (SELECT created_at FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_at
    FROM conversations c
    JOIN contacts co ON c.contact_id = co.id
    ORDER BY last_message_at DESC NULLS LAST
  `)
  res.json(result.rows)
})

app.get('/conversations/:id', async function(req, res) {
  const { id } = req.params
  const convo = await pool.query(`
    SELECT c.id, co.name, co.phone, c.status, c.assigned_to
    FROM conversations c
    JOIN contacts co ON c.contact_id = co.id
    WHERE c.id = $1
  `, [id])
  if (!convo.rows.length) return res.status(404).json({ error: 'Not found' })
  const messages = await pool.query(`
    SELECT id, direction, text, status, created_at
    FROM messages
    WHERE conversation_id = $1
    ORDER BY created_at ASC
  `, [id])
  res.json({ ...convo.rows[0], messages: messages.rows })
})

app.post('/contacts', async function(req, res) {
  const { name, phone, type } = req.body
  const result = await pool.query(
    'INSERT INTO contacts (name, phone, type) VALUES ($1, $2, $3) RETURNING *',
    [name, phone, type || 'candidate']
  )
  res.json(result.rows[0])
})

app.post('/conversations', async function(req, res) {
  const { contact_id, assigned_to } = req.body
  const result = await pool.query(
    'INSERT INTO conversations (contact_id, assigned_to) VALUES ($1, $2) RETURNING *',
    [contact_id, assigned_to]
  )
  res.json(result.rows[0])
})

app.post('/messages', async function(req, res) {
  const { conversation_id, direction, text } = req.body
  const result = await pool.query(
    'INSERT INTO messages (conversation_id, direction, text) VALUES ($1, $2, $3) RETURNING *',
    [conversation_id, direction, text]
  )
  const newMessage = result.rows[0]
  io.to('convo_' + conversation_id).emit('new_message', newMessage)
  res.json(newMessage)
})

io.on('connection', function(socket) {
  console.log('Client connected:', socket.id)

  socket.on('join_conversation', function(conversationId) {
    socket.join('convo_' + conversationId)
    console.log('Joined conversation:', conversationId)
  })

  socket.on('disconnect', function() {
    console.log('Client disconnected:', socket.id)
  })
})

server.listen(4000, function() {
  console.log('Server started on port 4000')
})