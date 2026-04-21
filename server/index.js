const express = require('express')
const http = require('http')
const { Server } = require('socket.io')
const cors = require('cors')
const { Pool } = require('pg')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

const app = express()
const server = http.createServer(app)
const io = new Server(server, {
  cors: { origin: '*' }
})

const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
      }
    : {
        user: 'postgres',
        host: 'localhost',
        database: 'agency_hub',
        password: 'postgres123',
        port: 5432,
      }
)

const JWT_SECRET = process.env.JWT_SECRET || 'agencyhub_secret_key'
const PORT = process.env.PORT || 4000

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      role VARCHAR(50) DEFAULT 'agent',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS contacts (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      phone VARCHAR(50),
      type VARCHAR(50) DEFAULT 'candidate',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS conversations (
      id SERIAL PRIMARY KEY,
      contact_id INTEGER REFERENCES contacts(id),
      status VARCHAR(50) DEFAULT 'open',
      assigned_to VARCHAR(255),
      created_at TIMESTAMP DEFAULT NOW()
    )
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      conversation_id INTEGER REFERENCES conversations(id),
      direction VARCHAR(10),
      text TEXT,
      status VARCHAR(50) DEFAULT 'sent',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `)

  const existing = await pool.query('SELECT COUNT(*) FROM users')
  if (parseInt(existing.rows[0].count) === 0) {
    const users = [
      { name: 'Director', email: 'director@agencyhub.com', password: 'admin123', role: 'director' },
      { name: 'Aisha', email: 'aisha@agencyhub.com', password: 'aisha123', role: 'agent' },
      { name: 'Ben', email: 'ben@agencyhub.com', password: 'ben123', role: 'agent' },
    ]
    for (const u of users) {
      const hashed = await bcrypt.hash(u.password, 10)
      await pool.query(
        'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4)',
        [u.name, u.email, hashed, u.role]
      )
    }
    console.log('Default users seeded')
  }
  console.log('Database initialised')
}

app.use(cors({
  origin: [
    'https://agency-hub-teal.vercel.app',
    'http://localhost:3000',
    'http://localhost:5173',
    'http://192.168.0.7:3000'
  ],
  credentials: true
}))
app.use(express.json())

app.get('/', function(req, res) {
  res.send('Agency Hub server is running')
})

app.get('/test-db', async function(req, res) {
  const result = await pool.query('SELECT NOW()')
  res.json({ time: result.rows[0].now })
})

app.post('/register', async function(req, res) {
  const { name, email, password, role } = req.body
  const hashed = await bcrypt.hash(password, 10)
  const result = await pool.query(
    'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role',
    [name, email, hashed, role || 'agent']
  )
  res.json(result.rows[0])
})

app.post('/login', async function(req, res) {
  console.log('login attempt:', req.body)
  const { email, password } = req.body
  const result = await pool.query('SELECT * FROM users WHERE email = $1', [email])
  if (!result.rows.length) return res.status(401).json({ error: 'Invalid email or password' })
  const user = result.rows[0]
  const valid = await bcrypt.compare(password, user.password)
  console.log('password valid:', valid)
  if (!valid) return res.status(401).json({ error: 'Invalid email or password' })
  const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET)
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } })
})

app.get('/conversations', async function(req, res) {
  const result = await pool.query(`
    SELECT c.id, co.name, co.phone, co.type, c.status, c.assigned_to,
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
    SELECT c.id, co.name, co.phone, co.type, c.status, c.assigned_to
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

app.patch('/conversations/:id/assign', async function(req, res) {
  const { id } = req.params
  const { assigned_to } = req.body
  const result = await pool.query(
    'UPDATE conversations SET assigned_to = $1 WHERE id = $2 RETURNING *',
    [assigned_to, id]
  )
  res.json(result.rows[0])
})

app.patch('/conversations/:id/status', async function(req, res) {
  const { id } = req.params
  const { status } = req.body
  const result = await pool.query(
    'UPDATE conversations SET status = $1 WHERE id = $2 RETURNING *',
    [status, id]
  )
  res.json(result.rows[0])
})

app.post('/simulate-incoming', async function(req, res) {
  const { conversation_id, text } = req.body
  const result = await pool.query(
    'INSERT INTO messages (conversation_id, direction, text) VALUES ($1, $2, $3) RETURNING *',
    [conversation_id, 'in', text]
  )
  const newMessage = result.rows[0]
  io.to('convo_' + conversation_id).emit('new_message', newMessage)
  res.json(newMessage)
})

io.on('connection', function(socket) {
  console.log('Client connected:', socket.id)
  socket.on('join_conversation', function(conversationId) {
    socket.join('convo_' + conversationId)
  })
  socket.on('disconnect', function() {
    console.log('Client disconnected:', socket.id)
  })
})

initDB().then(() => {
  server.listen(PORT, function() {
    console.log('Server started on port ' + PORT)
  })
}).catch(err => {
  console.error('DB init failed:', err)
  process.exit(1)
})