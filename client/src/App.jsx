import { useState, useEffect, useRef } from 'react'
import { io } from 'socket.io-client'

const API = 'https://agency-hub-production-e5af.up.railway.app'

const phoneRules = {
  '+65': { digits: 8, hint: '8 digits e.g. 8888 8888' },
  '+60': { digits: 9, hint: '9-10 digits e.g. 12 345 6789' },
  '+62': { digits: 10, hint: '10-12 digits e.g. 812 3456 7890' },
  '+63': { digits: 10, hint: '10 digits e.g. 917 123 4567' },
  '+66': { digits: 9, hint: '9 digits e.g. 81 234 5678' },
  '+84': { digits: 9, hint: '9 digits e.g. 912 345 678' },
  '+86': { digits: 11, hint: '11 digits e.g. 138 1234 5678' },
  '+91': { digits: 10, hint: '10 digits e.g. 98765 43210' },
  '+852': { digits: 8, hint: '8 digits e.g. 9123 4567' },
  '+853': { digits: 8, hint: '8 digits e.g. 6612 3456' },
  '+886': { digits: 9, hint: '9 digits e.g. 912 345 678' },
  '+81': { digits: 10, hint: '10 digits e.g. 90 1234 5678' },
  '+82': { digits: 10, hint: '10 digits e.g. 10 1234 5678' },
  '+44': { digits: 10, hint: '10 digits e.g. 7911 123456' },
  '+1': { digits: 10, hint: '10 digits e.g. 202 555 0123' },
  '+61': { digits: 9, hint: '9 digits e.g. 412 345 678' },
  '+64': { digits: 9, hint: '9 digits e.g. 21 123 4567' },
  '+971': { digits: 9, hint: '9 digits e.g. 50 123 4567' },
  '+966': { digits: 9, hint: '9 digits e.g. 50 123 4567' },
}

function phonePlaceholder(code) {
  return phoneRules[code] ? phoneRules[code].hint : 'Enter number'
}

function validatePhone(code, phone) {
  const digits = phone.replace(/[\s\-]/g, '')
  const rule = phoneRules[code]
  if (!rule) return ''
  if (digits.length === 0) return 'Phone number is required'
  if (digits.length < rule.digits) return `Too short — ${code} numbers need ${rule.digits} digits (you entered ${digits.length})`
  if (digits.length > rule.digits + 1) return `Too long — ${code} numbers need ${rule.digits} digits (you entered ${digits.length})`
  return ''
}

function fmtSGT(isoString) {
  if (!isoString) return ''
  const d = new Date(isoString)
  return d.toLocaleString('en-GB', {
    timeZone: 'Asia/Singapore',
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false
  }) + ' SGT'
}

function dateSGTiso(isoString) {
  if (!isoString) return ''
  return new Date(isoString).toLocaleDateString('en-CA', { timeZone: 'Asia/Singapore' })
}

const NAVY = '#1a2332'
const ACCENT = '#2563eb'
const ACCENT_LIGHT = '#eff6ff'
const ACCENT_MID = '#dbeafe'

const EMOJIS = ['😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇','🙂','😉','😌','😍','🥰','😘','😋','😛','😜','🤪','🤑','🤗','🤔','🤐','😐','😑','😏','😒','🙄','😬','😔','😪','😴','😷','🤒','🤢','🤮','🤧','😵','🤯','🤠','🥳','😎','🤓','😕','😟','🙁','😮','😲','😳','🥺','😧','😰','😢','😭','😱','😤','😡','😠','🤬','😈','💀','💩','🤖','👋','✋','👌','✌','🤞','🤙','👍','👎','✊','👊','👏','🙌','🤝','🙏','💪','❤','🧡','💛','💚','💙','💜','🖤','💔','💕','💞','✅','❌','⭕','🎉','🎊','🎈','🏆','🎯','🎤','🎵','📱','💻','📞','☎','📄','📝','📊','📈','💼','👔','🏢','🌍','✈','🚗','💰','💸','💳','⭐','🌟','🔥','👀','🎁']

const ALL_AGENTS = ['Aisha', 'Ben', 'Marcus', 'Priya', 'Rachel', 'Zara']

const TEAMS = {
  recruitment: { label: 'Recruitment Team', agents: ['Aisha', 'Marcus', 'Priya'] },
  client: { label: 'Client Relations Team', agents: ['Ben', 'Rachel'] },
  admin: { label: 'Admin Team', agents: ['Aisha', 'Ben', 'Zara'] },
}

const DEFAULT_TEMPLATES = [
  { id: 1, name: 'interview_confirmation', category: 'utility', status: 'approved', body: 'Hi {{name}}, your interview is confirmed for {{date}} at {{time}}.\n\nVenue: {{venue}}\n\nPlease bring your IC and original certificates.', buttons: [], createdAt: '2026-04-01' },
  { id: 2, name: 'offer_notification', category: 'utility', status: 'approved', body: 'Congratulations {{name}}! Your offer letter for {{role}} at {{company}} is ready. Please confirm acceptance by {{deadline}}.', buttons: [{ type: 'quick_reply', label: 'Accept Offer' }, { type: 'quick_reply', label: 'Request Changes' }], createdAt: '2026-04-01' },
  { id: 3, name: 'candidate_followup', category: 'marketing', status: 'approved', body: 'Hi {{name}}, are you still interested in the {{role}} opportunity at {{company}}? We would love to assist you further.', buttons: [{ type: 'quick_reply', label: 'Yes, interested' }, { type: 'quick_reply', label: 'Not anymore' }], createdAt: '2026-04-01' },
  { id: 4, name: 'job_vacancy_alert', category: 'marketing', status: 'approved', body: 'Hi {{name}}, exciting new {{role}} opening at {{company}} — salary {{salary}}. This matches your profile!\n\nReply YES to find out more.', buttons: [{ type: 'quick_reply', label: 'Yes, tell me more' }, { type: 'call_to_action', label: 'View Job Details', url: 'https://example.com/jobs' }], createdAt: '2026-04-01' },
  { id: 5, name: 'interview_reminder', category: 'utility', status: 'approved', body: 'Hi {{name}}, friendly reminder — your interview is tomorrow {{date}} at {{time}} at {{venue}}.\n\nSee you then! 👋', buttons: [], createdAt: '2026-04-01' },
  { id: 6, name: 'placement_congratulations', category: 'utility', status: 'approved', body: 'Congratulations {{name}}! 🎉\n\nYou have been successfully placed as {{role}} at {{company}}.\n\nStart date: {{start_date}}\n\nWelcome aboard!', buttons: [], createdAt: '2026-04-01' },
]

const COMMON_VARS = ['name', 'date', 'time', 'venue', 'role', 'company', 'salary', 'deadline', 'start_date', 'hr_name', 'candidate', 'phone', 'email']

const STATUS_COLORS = {
  draft: { bg: '#f1f4f9', color: '#6b7280', label: 'Draft' },
  pending: { bg: '#fef3c7', color: '#92400e', label: 'Pending Approval' },
  approved: { bg: '#dcfce7', color: '#16a34a', label: 'Approved' },
  rejected: { bg: '#fee2e2', color: '#dc2626', label: 'Rejected' },
}

const CATEGORY_LABELS = { marketing: 'Marketing', utility: 'Utility', authentication: 'Authentication' }

function DualRingsLogo() {
  return (
    <svg width="34" height="34" viewBox="0 0 34 34" fill="none">
      <rect width="34" height="34" rx="9" fill="#1e3a5f"/>
      <circle cx="13" cy="17" r="6.5" stroke="#60a5fa" strokeWidth="1.8"/>
      <circle cx="21" cy="17" r="6.5" stroke="#fff" strokeWidth="1.8"/>
      <path d="M17 11.2c1.8 1.5 1.8 7.1 0 11.6" stroke="#1e3a5f" strokeWidth="3.5"/>
      <path d="M17 11.2c-1.8 1.5-1.8 7.1 0 11.6" stroke="#1e3a5f" strokeWidth="3.5"/>
      <path d="M17 11.2c1.8 1.5 1.8 7.1 0 11.6" stroke="#93c5fd" strokeWidth="1.2"/>
      <path d="M17 11.2c-1.8 1.5-1.8 7.1 0 11.6" stroke="#93c5fd" strokeWidth="1.2"/>
    </svg>
  )
}

function PhonePreview({ body, buttons }) {
  const highlighted = body.replace(/\{\{(\w+)\}\}/g, (_, v) =>
    `<span style="background:#dbeafe;color:#1e40af;padding:1px 4px;border-radius:3px;font-size:11px;">{{${v}}}</span>`
  )
  return (
    <div style={{ background: '#e5ddd5', borderRadius: 16, padding: 16, minHeight: 200, fontFamily: 'system-ui', position: 'relative' }}>
      <div style={{ position: 'absolute', top: 10, left: 0, right: 0, textAlign: 'center', fontSize: 10, color: '#667781' }}>Preview</div>
      <div style={{ marginTop: 20 }}>
        <div style={{ background: '#fff', borderRadius: 8, padding: '10px 12px', maxWidth: '85%', boxShadow: '0 1px 2px rgba(0,0,0,0.1)', borderBottomLeftRadius: 2 }}>
          <div style={{ fontSize: 12, color: '#111827', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }} dangerouslySetInnerHTML={{ __html: highlighted || '<span style="color:#9ca3af">Your message will appear here…</span>' }} />
          <div style={{ fontSize: 9, color: '#667781', textAlign: 'right', marginTop: 4 }}>10:30 ✓✓</div>
        </div>
        {buttons.length > 0 && (
          <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 3 }}>
            {buttons.map((b, i) => (
              <div key={i} style={{ background: '#fff', borderRadius: 8, padding: '8px 12px', textAlign: 'center', fontSize: 12, color: b.type === 'call_to_action' ? '#2563eb' : '#2563eb', boxShadow: '0 1px 2px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                {b.type === 'call_to_action' ? '🔗' : '↩️'} {b.label || (b.type === 'call_to_action' ? 'Button text' : 'Quick reply')}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

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
  const [compMode, setCompMode] = useState('text')
  const [showEmoji, setShowEmoji] = useState(false)
  const [showDrawer, setShowDrawer] = useState(false)
  const [drawerTab, setDrawerTab] = useState('info')
  const [notes, setNotes] = useState({})
  const [noteInput, setNoteInput] = useState('')
  const [showNewContact, setShowNewContact] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newCountryCode, setNewCountryCode] = useState('+65')
  const [newType, setNewType] = useState('candidate')
  const [newAssigned, setNewAssigned] = useState('Aisha')
  const [phoneError, setPhoneError] = useState('')
  const [showScrollBtn, setShowScrollBtn] = useState(false)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [sortOrder, setSortOrder] = useState('newest')
  const [dateFilter, setDateFilter] = useState('')
  const [showReassignModal, setShowReassignModal] = useState(false)
  const [reassignTeam, setReassignTeam] = useState('')
  const [reassignAgent, setReassignAgent] = useState('')
  const [activeNav, setActiveNav] = useState('inbox')
  const [showCalModal, setShowCalModal] = useState(false)
  const [calTab, setCalTab] = useState('view')
  const [calEvents, setCalEvents] = useState({})
  const [calTitle, setCalTitle] = useState('')
  const [calDate, setCalDate] = useState('')
  const [calTime, setCalTime] = useState('')
  const [calLocation, setCalLocation] = useState('')
  const [mobileView, setMobileView] = useState('inbox')
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

  // Broadcast states
  const [bcMessage, setBcMessage] = useState('')
  const [bcType, setBcType] = useState('all')
  const [bcAgent, setBcAgent] = useState('all')
  const [bcSent, setBcSent] = useState([])
  const [bcSending, setBcSending] = useState(false)

  // Maintenance states
  const [maintenance, setMaintenance] = useState(null)
  const [showMaintenanceEditor, setShowMaintenanceEditor] = useState(false)
  const [maintDate, setMaintDate] = useState('')
  const [maintStartTime, setMaintStartTime] = useState('')
  const [maintEndTime, setMaintEndTime] = useState('')
  const [maintMessage, setMaintMessage] = useState('')

  // Template states
  const [templates, setTemplates] = useState(DEFAULT_TEMPLATES)
  const [showTemplateEditor, setShowTemplateEditor] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState(null)
  const [tmplName, setTmplName] = useState('')
  const [tmplCategory, setTmplCategory] = useState('utility')
  const [tmplBody, setTmplBody] = useState('')
  const [tmplButtons, setTmplButtons] = useState([])
  const [tmplSearch, setTmplSearch] = useState('')
  const [tmplFilterCat, setTmplFilterCat] = useState('all')
  const [tmplFilterStatus, setTmplFilterStatus] = useState('all')
  const [tmplFilterType, setTmplFilterType] = useState('all')
  const [customVar, setCustomVar] = useState('')
  const tmplBodyRef = useRef(null)

  const messagesEndRef = useRef(null)
  const messagesRef = useRef(null)
  const socketRef = useRef(null)
  const textareaRef = useRef(null)

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  async function login() {
    setLoginError('')
    try {
      const res = await fetch(`${API}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })
      const data = await res.json()
      if (!res.ok) return setLoginError(data.error)
      setUser(data.user); setToken(data.token)
      localStorage.setItem('token', data.token)
      localStorage.setItem('user', JSON.stringify(data.user))
    } catch(e) {
      setLoginError('Cannot connect to server. Check your connection.')
    }
  }

  function logout() {
    setUser(null); setToken(null)
    localStorage.removeItem('token'); localStorage.removeItem('user')
  }

  useEffect(() => {
    const savedToken = localStorage.getItem('token')
    const savedUser = localStorage.getItem('user')
    if (savedToken && savedUser) { setToken(savedToken); setUser(JSON.parse(savedUser)) }
  }, [])

  useEffect(() => {
    if (!token) return
    fetch(`${API}/conversations`, { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.json()).then(data => setConvos(data))
    const socket = io(API)
    socketRef.current = socket
    socket.on('new_message', msg => {
      setActive(prev => prev ? { ...prev, messages: [...prev.messages, msg] } : prev)
      setConvos(prev => prev.map(c => c.id === msg.conversation_id ? { ...c, preview: msg.text, last_message_at: msg.created_at } : c))
    })
    return () => socket.disconnect()
  }, [token])

  useEffect(() => {
    if (messagesEndRef.current) messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
  }, [active?.messages?.length])

  function onMsgScroll() {
    const el = messagesRef.current
    if (!el) return
    setShowScrollBtn(el.scrollTop + el.clientHeight < el.scrollHeight - 60)
  }

  function openConvo(id) {
    setActiveId(id); setMobileView('chat'); setShowDrawer(false); setNoteInput('')
    if (socketRef.current) socketRef.current.emit('join_conversation', id)
    fetch(`${API}/conversations/` + id, { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.json()).then(data => setActive(data))
  }

  async function sendMessage() {
    if (!input.trim() || !activeId) return
    await fetch(`${API}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ conversation_id: activeId, direction: 'out', text: input })
    })
    setInput(''); setShowEmoji(false)
  }

  async function doReassign() {
    if (!reassignAgent) return alert('Please select an agent.')
    await fetch(`${API}/conversations/` + activeId + '/assign', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ assigned_to: reassignAgent })
    })
    setActive(prev => ({ ...prev, assigned_to: reassignAgent }))
    setConvos(prev => prev.map(c => c.id === activeId ? { ...c, assigned_to: reassignAgent } : c))
    setShowReassignModal(false); setReassignTeam(''); setReassignAgent('')
  }

  async function resolveConvo(id, newStatus) {
    await fetch(`${API}/conversations/` + id + '/status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ status: newStatus })
    })
    setActive(prev => ({ ...prev, status: newStatus }))
    setConvos(prev => prev.map(c => c.id === id ? { ...c, status: newStatus } : c))
  }

  async function createContact() {
    if (!newName.trim()) return
    const error = validatePhone(newCountryCode, newPhone)
    if (error) { setPhoneError(error); return }
    const fullPhone = newCountryCode + newPhone.replace(/[\s\-]/g, '')
    const contactRes = await fetch(`${API}/contacts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ name: newName, phone: fullPhone, type: newType })
    })
    const contact = await contactRes.json()
    const convoRes = await fetch(`${API}/conversations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ contact_id: contact.id, assigned_to: newAssigned })
    })
    const convo = await convoRes.json()
    const now = new Date().toISOString()
    setConvos(prev => [{ ...convo, name: newName, phone: fullPhone, type: newType, preview: '', assigned_to: newAssigned, last_message_at: now }, ...prev])
    setShowNewContact(false); setNewName(''); setNewPhone(''); setNewCountryCode('+65')
    setNewType('candidate'); setNewAssigned('Aisha'); setPhoneError('')
    openConvo(convo.id)
  }

  function insertEmoji(emoji) {
    const ta = textareaRef.current
    if (!ta) return
    const start = ta.selectionStart
    const newVal = input.slice(0, start) + emoji + input.slice(start)
    setInput(newVal)
    setTimeout(() => { ta.selectionStart = start + emoji.length; ta.selectionEnd = start + emoji.length; ta.focus() }, 0)
  }

  function saveNote() {
    if (!noteInput.trim() || !activeId) return
    const newNote = { text: noteInput.trim(), by: user.name, ts: fmtSGT(new Date().toISOString()) }
    setNotes(prev => ({ ...prev, [activeId]: [newNote, ...(prev[activeId] || [])] }))
    setNoteInput('')
  }

  function createCalEvent() {
    if (!calTitle.trim() || !calDate || !calTime) { alert('Please fill in title, date and time.'); return }
    const newEvent = {
      title: calTitle,
      date: new Date(calDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      time: calTime + ' SGT', location: calLocation || '—'
    }
    setCalEvents(prev => ({ ...prev, [activeId]: [newEvent, ...(prev[activeId] || [])] }))
    setCalTitle(''); setCalDate(''); setCalTime(''); setCalLocation(''); setCalTab('view')
  }

  function sendBroadcast() {
    if (!bcMessage.trim()) return alert('Please enter a message.')
    const targets = convos.filter(c => (bcType === 'all' || c.type === bcType) && (bcAgent === 'all' || c.assigned_to === bcAgent))
    if (targets.length === 0) return alert('No contacts match your filters.')
    setBcSending(true)
    const result = { id: Date.now(), message: bcMessage, type: bcType, agent: bcAgent, count: targets.length, sentAt: fmtSGT(new Date().toISOString()), status: 'sent' }
    setTimeout(() => {
      setBcSent(prev => [result, ...prev]); setBcMessage(''); setBcSending(false)
      alert(`Broadcast sent to ${targets.length} contact${targets.length > 1 ? 's' : ''}.`)
    }, 1000)
  }

  function saveMaintenance() {
    if (!maintDate || !maintStartTime || !maintEndTime) return alert('Please set date, start time and end time.')
    const dtStart = new Date(maintDate + 'T' + maintStartTime)
    const dtEnd = new Date(maintDate + 'T' + maintEndTime)
    const dateStr = dtStart.toLocaleDateString('en-GB', { timeZone: 'Asia/Singapore', day: '2-digit', month: 'short', year: 'numeric' })
    const startStr = dtStart.toLocaleTimeString('en-GB', { timeZone: 'Asia/Singapore', hour: '2-digit', minute: '2-digit', hour12: false })
    const endStr = dtEnd.toLocaleTimeString('en-GB', { timeZone: 'Asia/Singapore', hour: '2-digit', minute: '2-digit', hour12: false })
    setMaintenance({ datetime: `${dateStr}, ${startStr} – ${endStr} SGT`, message: maintMessage || 'Scheduled maintenance window.' })
    setShowMaintenanceEditor(false)
    setMaintDate(''); setMaintStartTime(''); setMaintEndTime(''); setMaintMessage('')
  }

  function openNewTemplate() {
    setEditingTemplate(null)
    setTmplName(''); setTmplCategory('utility'); setTmplBody(''); setTmplButtons([])
    setShowTemplateEditor(true)
  }

  function openEditTemplate(t) {
    setEditingTemplate(t)
    setTmplName(t.name); setTmplCategory(t.category); setTmplBody(t.body); setTmplButtons([...t.buttons])
    setShowTemplateEditor(true)
  }

  function insertVar(v) {
    const ta = tmplBodyRef.current
    if (!ta) return
    const start = ta.selectionStart
    const tag = `{{${v}}}`
    const newVal = tmplBody.slice(0, start) + tag + tmplBody.slice(start)
    setTmplBody(newVal)
    setTimeout(() => { ta.selectionStart = start + tag.length; ta.selectionEnd = start + tag.length; ta.focus() }, 0)
  }

  function addButton(type) {
    if (tmplButtons.length >= 3) return alert('Maximum 3 buttons per template.')
    setTmplButtons(prev => [...prev, { type, label: '', url: '' }])
  }

  function updateButton(i, field, val) {
    setTmplButtons(prev => prev.map((b, idx) => idx === i ? { ...b, [field]: val } : b))
  }

  function removeButton(i) {
    setTmplButtons(prev => prev.filter((_, idx) => idx !== i))
  }

  function saveTemplate() {
    if (!tmplName.trim()) return alert('Please enter a template name.')
    if (!tmplBody.trim()) return alert('Please enter a message body.')
    if (tmplBody.length > 1024) return alert('Message body exceeds 1024 character limit.')
    const nameClean = tmplName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
    if (editingTemplate) {
      setTemplates(prev => prev.map(t => t.id === editingTemplate.id ? { ...t, name: nameClean, category: tmplCategory, body: tmplBody, buttons: tmplButtons } : t))
    } else {
      const newT = { id: Date.now(), name: nameClean, category: tmplCategory, status: 'draft', body: tmplBody, buttons: tmplButtons, createdAt: new Date().toISOString().split('T')[0] }
      setTemplates(prev => [newT, ...prev])
    }
    setShowTemplateEditor(false)
  }

  function deleteTemplate(id) {
    if (!confirm('Delete this template?')) return
    setTemplates(prev => prev.filter(t => t.id !== id))
  }

  function submitForApproval(id) {
    setTemplates(prev => prev.map(t => t.id === id ? { ...t, status: 'pending' } : t))
    alert('Template submitted for Meta approval. This requires Meta WhatsApp API to be connected.')
  }

  const filteredTemplates = templates.filter(t => {
    const matchSearch = !tmplSearch.trim() || t.name.includes(tmplSearch.toLowerCase()) || t.body.toLowerCase().includes(tmplSearch.toLowerCase())
    const matchCat = tmplFilterCat === 'all' || t.category === tmplFilterCat
    const matchStatus = tmplFilterStatus === 'all' || t.status === tmplFilterStatus
    const matchType = tmplFilterType === 'all' || (tmplFilterType === 'with_buttons' ? t.buttons.length > 0 : t.buttons.length === 0)
    return matchSearch && matchCat && matchStatus && matchType
  })

  const filteredConvos = convos
    .filter(c => {
      const matchSearch = !search.trim() || (() => {
        const q = search.toLowerCase().trim()
        return c.name.toLowerCase().includes(q) || (c.preview && c.preview.toLowerCase().includes(q)) || (c.phone && c.phone.includes(q))
      })()
      const matchStatus = filterStatus === 'all' || c.status === filterStatus
      const matchDate = !dateFilter || (() => {
        const ts = c.last_message_at || c.created_at
        if (!ts) return false
        return dateSGTiso(ts) === dateFilter
      })()
      return matchSearch && matchStatus && matchDate
    })
    .sort((a, b) => {
      const at = new Date(a.last_message_at || a.created_at || 0).getTime()
      const bt = new Date(b.last_message_at || b.created_at || 0).getTime()
      return sortOrder === 'newest' ? bt - at : at - bt
    })

  const agentOptions = reassignTeam ? TEAMS[reassignTeam]?.agents || [] : ALL_AGENTS
  const isDirector = user?.role === 'director'

  if (!user) {
    return (
      <div style={{ minHeight: '100vh', background: '#f1f4f9', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div style={{ background: '#fff', borderRadius: 16, border: '0.5px solid #e5e7eb', padding: '40px 32px', width: '100%', maxWidth: 380 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <DualRingsLogo />
            <div>
              <div style={{ fontSize: 16, fontWeight: 500, color: '#111827' }}>Agency Hub</div>
              <div style={{ fontSize: 10, color: '#9ca3af', letterSpacing: '0.4px', textTransform: 'uppercase' }}>recruitment platform</div>
            </div>
          </div>
          <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 24, marginTop: 8 }}>Sign in to your account</div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 4 }}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && login()} placeholder="you@agencyhub.com"
              style={{ width: '100%', padding: '9px 12px', border: '0.5px solid #d1d5db', borderRadius: 8, fontSize: 13, outline: 'none', background: '#f9fafb', color: '#111827', boxSizing: 'border-box' }} />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 4 }}>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && login()} placeholder="Enter your password"
              style={{ width: '100%', padding: '9px 12px', border: '0.5px solid #d1d5db', borderRadius: 8, fontSize: 13, outline: 'none', background: '#f9fafb', color: '#111827', boxSizing: 'border-box' }} />
          </div>
          {loginError && <div style={{ fontSize: 11, color: '#ef4444', marginBottom: 12 }}>{loginError}</div>}
          <button onClick={login} style={{ width: '100%', padding: '10px', background: ACCENT, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>Sign in</button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: 'system-ui,-apple-system,sans-serif', background: '#f1f4f9', position: 'relative', overflow: 'hidden' }}>

      {/* MAINTENANCE BANNER */}
      {maintenance && (
        <div style={{ background: '#92400e', color: '#fff', padding: '8px 16px', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>⚠️</span>
            <span><strong>Scheduled Maintenance:</strong> {maintenance.datetime} · {maintenance.message}</span>
          </div>
          {isDirector && <button onClick={() => setMaintenance(null)} style={{ background: 'transparent', border: '0.5px solid rgba(255,255,255,0.4)', color: '#fff', borderRadius: 5, padding: '2px 8px', fontSize: 10, cursor: 'pointer' }}>Dismiss</button>}
        </div>
      )}

      {/* TOPBAR */}
      <div style={{ height: 52, background: NAVY, display: 'flex', alignItems: 'center', padding: '0 16px', flexShrink: 0, borderBottom: '0.5px solid rgba(255,255,255,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginRight: 14, flexShrink: 0 }}>
          <DualRingsLogo />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 14, fontWeight: 500, color: '#fff' }}>Agency Hub</span>
            {!isMobile && <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.4px', textTransform: 'uppercase', marginTop: 1 }}>recruitment platform</span>}
          </div>
        </div>
        {!isMobile && <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.15)', margin: '0 10px' }} />}
        {!isMobile && (
          <div style={{ display: 'flex', gap: 2 }}>
            {[{key:'inbox',label:'Inbox'},{key:'broadcasts',label:'Broadcasts'},{key:'templates',label:'Templates'},{key:'analytics',label:'Analytics'},{key:'settings',label:'Settings'}].map(n => (
              <button key={n.key} onClick={() => setActiveNav(n.key)}
                style={{ padding: '6px 12px', borderRadius: 7, fontSize: 12, color: activeNav === n.key ? '#fff' : '#cbd5e1', background: activeNav === n.key ? 'rgba(255,255,255,0.15)' : 'transparent', border: 'none', cursor: 'pointer', fontWeight: activeNav === n.key ? 500 : 400 }}>
                {n.label}
              </button>
            ))}
          </div>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {isDirector && (
            <button onClick={() => setShowMaintenanceEditor(true)}
              style={{ padding: '5px 9px', borderRadius: 7, border: '0.5px solid rgba(255,165,0,0.5)', background: 'transparent', fontSize: 10, color: '#fbbf24', cursor: 'pointer' }}>
              ⚠️ Maintenance
            </button>
          )}
          <button onClick={() => setShowNewContact(true)} style={{ padding: '5px 10px', borderRadius: 7, border: '0.5px solid rgba(255,255,255,0.25)', background: 'transparent', fontSize: 11, color: '#e2e8f0', cursor: 'pointer' }}>+ New</button>
          {!isMobile && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>{user.name} · {user.role}</span>}
          <button onClick={logout} style={{ padding: '5px 9px', borderRadius: 7, border: '0.5px solid rgba(255,255,255,0.2)', background: 'transparent', fontSize: 11, color: '#cbd5e1', cursor: 'pointer' }}>Sign out</button>
        </div>
      </div>

      {/* MAIN */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* TEMPLATES SCREEN */}
        {activeNav === 'templates' && !isMobile && (
          <div style={{ flex: 1, overflowY: 'auto', padding: 24, background: '#f1f4f9' }}>
            <div style={{ maxWidth: 960, margin: '0 auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 500, color: '#111827', marginBottom: 4 }}>Templates</div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>Create and manage WhatsApp message templates. Templates require Meta approval before live use.</div>
                </div>
                <button onClick={openNewTemplate}
                  style={{ padding: '8px 16px', background: ACCENT, color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: 'pointer', flexShrink: 0 }}>
                  + New Template
                </button>
              </div>

              {/* FILTERS */}
              <div style={{ background: '#fff', borderRadius: 10, border: '0.5px solid #e5e7eb', padding: '12px 16px', marginBottom: 16, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
                  <svg style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', width: 12, height: 12, color: '#9ca3af', pointerEvents: 'none' }} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <circle cx="7" cy="7" r="4"/><path d="M10.5 10.5l3 3" strokeLinecap="round"/>
                  </svg>
                  <input value={tmplSearch} onChange={e => setTmplSearch(e.target.value)} placeholder="Search templates…"
                    style={{ width: '100%', padding: '6px 9px 6px 27px', border: '0.5px solid #d1d5db', borderRadius: 7, fontSize: 11, background: '#f9fafb', color: '#111827', outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <select value={tmplFilterCat} onChange={e => setTmplFilterCat(e.target.value)}
                  style={{ padding: '6px 10px', border: '0.5px solid #d1d5db', borderRadius: 7, fontSize: 11, background: '#f9fafb', color: '#111827', outline: 'none' }}>
                  <option value="all">All categories</option>
                  <option value="marketing">Marketing</option>
                  <option value="utility">Utility</option>
                  <option value="authentication">Authentication</option>
                </select>
                <select value={tmplFilterStatus} onChange={e => setTmplFilterStatus(e.target.value)}
                  style={{ padding: '6px 10px', border: '0.5px solid #d1d5db', borderRadius: 7, fontSize: 11, background: '#f9fafb', color: '#111827', outline: 'none' }}>
                  <option value="all">All statuses</option>
                  <option value="draft">Draft</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
                <select value={tmplFilterType} onChange={e => setTmplFilterType(e.target.value)}
                  style={{ padding: '6px 10px', border: '0.5px solid #d1d5db', borderRadius: 7, fontSize: 11, background: '#f9fafb', color: '#111827', outline: 'none' }}>
                  <option value="all">All types</option>
                  <option value="with_buttons">With buttons</option>
                  <option value="no_buttons">No buttons</option>
                </select>
                <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 'auto' }}>{filteredTemplates.length} template{filteredTemplates.length !== 1 ? 's' : ''}</span>
              </div>

              {/* TEMPLATE CARDS */}
              {filteredTemplates.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af', fontSize: 13 }}>No templates found</div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
                  {filteredTemplates.map(t => {
                    const sc = STATUS_COLORS[t.status]
                    return (
                      <div key={t.id} style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e5e7eb', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 500, color: '#111827', fontFamily: 'monospace', marginBottom: 4 }}>{t.name}</div>
                            <div style={{ display: 'flex', gap: 5 }}>
                              <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: '#f1f4f9', color: '#6b7280', border: '0.5px solid #e5e7eb', fontWeight: 500 }}>{CATEGORY_LABELS[t.category]}</span>
                              <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: sc.bg, color: sc.color, fontWeight: 500 }}>{sc.label}</span>
                              {t.buttons.length > 0 && <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: '#ede9fe', color: '#5b21b6', fontWeight: 500 }}>{t.buttons.length} button{t.buttons.length > 1 ? 's' : ''}</span>}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button onClick={() => openEditTemplate(t)}
                              style={{ padding: '4px 8px', border: '0.5px solid #d1d5db', borderRadius: 6, fontSize: 10, background: 'transparent', color: '#6b7280', cursor: 'pointer' }}>Edit</button>
                            <button onClick={() => deleteTemplate(t.id)}
                              style={{ padding: '4px 8px', border: '0.5px solid #fca5a5', borderRadius: 6, fontSize: 10, background: 'transparent', color: '#dc2626', cursor: 'pointer' }}>Delete</button>
                          </div>
                        </div>
                        <div style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.6, background: '#f9fafb', borderRadius: 7, padding: '8px 10px', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 100, overflow: 'hidden', position: 'relative' }}>
                          {t.body}
                          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 24, background: 'linear-gradient(transparent, #f9fafb)' }} />
                        </div>
                        {t.buttons.length > 0 && (
                          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                            {t.buttons.map((b, i) => (
                              <span key={i} style={{ fontSize: 10, padding: '3px 8px', borderRadius: 6, border: '0.5px solid #d1d5db', color: '#2563eb', background: '#eff6ff' }}>
                                {b.type === 'call_to_action' ? '🔗' : '↩️'} {b.label || 'Untitled'}
                              </span>
                            ))}
                          </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
                          <span style={{ fontSize: 10, color: '#9ca3af' }}>{t.body.length}/1024 chars · {t.createdAt}</span>
                          {t.status === 'draft' && (
                            <button onClick={() => submitForApproval(t.id)}
                              style={{ padding: '4px 10px', background: NAVY, color: '#fff', border: 'none', borderRadius: 6, fontSize: 10, cursor: 'pointer', fontWeight: 500 }}>
                              Submit for approval
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* BROADCASTS SCREEN */}
        {activeNav === 'broadcasts' && !isMobile && (
          <div style={{ flex: 1, overflowY: 'auto', padding: 24, background: '#f1f4f9' }}>
            <div style={{ maxWidth: 700, margin: '0 auto' }}>
              <div style={{ fontSize: 16, fontWeight: 500, color: '#111827', marginBottom: 4 }}>Broadcasts</div>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 20 }}>Send a message to multiple contacts at once. Requires Meta WhatsApp API for live sending.</div>
              <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e5e7eb', padding: 20, marginBottom: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#111827', marginBottom: 14 }}>New Broadcast</div>
                <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 4 }}>Contact type</label>
                    <select value={bcType} onChange={e => setBcType(e.target.value)}
                      style={{ width: '100%', padding: '7px 10px', border: '0.5px solid #d1d5db', borderRadius: 8, fontSize: 12, background: '#f9fafb', color: '#111827', outline: 'none' }}>
                      <option value="all">All contacts</option>
                      <option value="candidate">Candidates only</option>
                      <option value="client">Clients only</option>
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 4 }}>Assigned to</label>
                    <select value={bcAgent} onChange={e => setBcAgent(e.target.value)}
                      style={{ width: '100%', padding: '7px 10px', border: '0.5px solid #d1d5db', borderRadius: 8, fontSize: 12, background: '#f9fafb', color: '#111827', outline: 'none' }}>
                      <option value="all">All agents</option>
                      {ALL_AGENTS.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 10 }}>
                  Recipients: <strong style={{ color: '#111827' }}>{convos.filter(c => (bcType === 'all' || c.type === bcType) && (bcAgent === 'all' || c.assigned_to === bcAgent)).length} contacts</strong>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 4 }}>Message</label>
                  <textarea value={bcMessage} onChange={e => setBcMessage(e.target.value)} placeholder="Type your broadcast message here…" rows={5}
                    style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #d1d5db', borderRadius: 8, fontSize: 12, background: '#f9fafb', color: '#111827', resize: 'vertical', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
                  <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 3 }}>{bcMessage.length} characters</div>
                </div>
                <div style={{ background: '#fef3c7', border: '0.5px solid #fcd34d', borderRadius: 7, padding: '7px 10px', fontSize: 11, color: '#92400e', marginBottom: 12 }}>
                  ⚠️ Live sending requires Meta WhatsApp API. Currently in simulation mode.
                </div>
                <button onClick={sendBroadcast} disabled={bcSending}
                  style={{ padding: '8px 20px', background: bcSending ? '#9ca3af' : ACCENT, color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: bcSending ? 'default' : 'pointer' }}>
                  {bcSending ? 'Sending…' : 'Send Broadcast'}
                </button>
              </div>
              {bcSent.length > 0 && (
                <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e5e7eb', padding: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#111827', marginBottom: 14 }}>Broadcast History</div>
                  {bcSent.map(b => (
                    <div key={b.id} style={{ padding: '12px 14px', background: '#f9fafb', borderRadius: 8, border: '0.5px solid #e5e7eb', marginBottom: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                        <span style={{ fontSize: 11, fontWeight: 500, color: '#111827' }}>Sent to {b.count} contacts</span>
                        <span style={{ fontSize: 10, color: '#9ca3af' }}>{b.sentAt}</span>
                      </div>
                      <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 5, lineHeight: 1.5 }}>{b.message}</div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: ACCENT_MID, color: '#1e40af', fontWeight: 500 }}>{b.type === 'all' ? 'All' : b.type}</span>
                        <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: '#f1f4f9', color: '#6b7280', border: '0.5px solid #e5e7eb' }}>{b.agent === 'all' ? 'All agents' : b.agent}</span>
                        <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: '#dcfce7', color: '#16a34a', fontWeight: 500 }}>✓ {b.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* SIDEBAR */}
        {(activeNav === 'inbox' || isMobile) && (
          <div style={{ width: isMobile ? '100%' : 272, flexShrink: 0, borderRight: isMobile ? 'none' : '0.5px solid #e5e7eb', display: isMobile ? (mobileView === 'inbox' ? 'flex' : 'none') : 'flex', flexDirection: 'column', background: '#f1f4f9', overflow: 'hidden' }}>
            <div style={{ padding: '12px 13px 0', flexShrink: 0 }}>
              <div style={{ position: 'relative', marginBottom: 7 }}>
                <svg style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', width: 12, height: 12, color: '#9ca3af', pointerEvents: 'none' }} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="7" cy="7" r="4"/><path d="M10.5 10.5l3 3" strokeLinecap="round"/>
                </svg>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, number, message…"
                  style={{ width: '100%', padding: '6px 9px 6px 27px', border: '0.5px solid #d1d5db', borderRadius: 8, fontSize: 11, background: '#fff', color: '#111827', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
                {[['newest','↓ Newest'],['oldest','↑ Oldest']].map(([o,l]) => (
                  <button key={o} onClick={() => setSortOrder(o)}
                    style={{ flex: 1, padding: '4px 0', borderRadius: 7, fontSize: 10, border: '0.5px solid #d1d5db', background: sortOrder === o ? NAVY : 'transparent', color: sortOrder === o ? '#fff' : '#6b7280', cursor: 'pointer' }}>
                    {l}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 4, marginBottom: 8, alignItems: 'center' }}>
                <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)}
                  style={{ flex: 1, padding: '4px 7px', border: '0.5px solid #d1d5db', borderRadius: 7, fontSize: 10, background: '#fff', color: dateFilter ? '#111827' : '#9ca3af', outline: 'none', minWidth: 0 }} />
                {dateFilter && <button onClick={() => setDateFilter('')} style={{ padding: '3px 7px', border: '0.5px solid #d1d5db', borderRadius: 7, fontSize: 10, background: 'transparent', color: '#9ca3af', cursor: 'pointer' }}>✕</button>}
              </div>
            </div>
            <div style={{ padding: '0 13px 8px', flexShrink: 0 }}>
              <div style={{ fontSize: 9, fontWeight: 500, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 5 }}>Status</div>
              <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                {[['all','All'],['open','Open'],['pending','Pending'],['resolved','Resolved']].map(([k,l]) => (
                  <button key={k} onClick={() => setFilterStatus(k)}
                    style={{ padding: '2px 8px', borderRadius: 6, border: '0.5px solid #d1d5db', fontSize: 10, background: filterStatus === k ? NAVY : 'transparent', color: filterStatus === k ? '#fff' : '#6b7280', cursor: 'pointer' }}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {filteredConvos.length === 0 && (
                <div style={{ padding: 20, textAlign: 'center', fontSize: 11, color: '#9ca3af' }}>
                  {dateFilter ? `No conversations on ${new Date(dateFilter+'T12:00:00').toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}` : 'No conversations match your filters'}
                </div>
              )}
              {filteredConvos.map(c => (
                <div key={c.id} onClick={() => openConvo(c.id)}
                  style={{ padding: '10px 13px', borderBottom: '0.5px solid #e5e7eb', cursor: 'pointer', background: c.id === activeId ? '#fff' : 'transparent', borderLeft: c.id === activeId ? `2px solid ${ACCENT}` : '2px solid transparent', transition: 'background .1s' }}
                  onMouseEnter={e => { if (c.id !== activeId) e.currentTarget.style.background = '#fff' }}
                  onMouseLeave={e => { if (c.id !== activeId) e.currentTarget.style.background = 'transparent' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                    <span style={{ fontSize: 12, fontWeight: 500, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 140 }}>{c.name}</span>
                    <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                      <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, fontWeight: 500, background: c.type === 'client' ? ACCENT_MID : '#ede9fe', color: c.type === 'client' ? '#1e40af' : '#5b21b6' }}>{c.type || 'candidate'}</span>
                      <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, fontWeight: 500, background: '#f1f4f9', color: '#6b7280', border: '0.5px solid #e5e7eb' }}>{c.assigned_to}</span>
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: '#6b7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 3 }}>{c.preview || 'No messages yet'}</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 9, fontWeight: 500, color: c.status === 'open' ? '#16a34a' : c.status === 'pending' ? '#d97706' : '#9ca3af' }}>{c.status}</span>
                    {c.last_message_at && <span style={{ fontSize: 9, color: '#9ca3af' }}>{new Date(c.last_message_at).toLocaleDateString('en-GB',{timeZone:'Asia/Singapore',day:'2-digit',month:'short'})}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CHAT */}
        {(activeNav === 'inbox' || isMobile) && (
          <div style={{ flex: 1, display: isMobile ? (mobileView === 'chat' ? 'flex' : 'none') : 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative', background: '#fff' }}>
            <div style={{ padding: '10px 14px', borderBottom: '0.5px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0, background: '#fff' }}>
              {isMobile && <button onClick={() => setMobileView('inbox')} style={{ width: 30, height: 30, borderRadius: 7, border: '0.5px solid #d1d5db', background: 'transparent', cursor: 'pointer', fontSize: 18, color: '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, lineHeight: 1 }}>‹</button>}
              {active ? (
                <>
                  <div style={{ width: 34, height: 34, borderRadius: '50%', background: ACCENT_MID, color: '#1e40af', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 500, flexShrink: 0 }}>
                    {active.name?.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>{active.name}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2, flexWrap: 'wrap' }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: active.status === 'open' ? '#22c55e' : '#9ca3af', flexShrink: 0 }} />
                      <span style={{ fontSize: 10, color: '#6b7280' }}>{active.status === 'open' ? 'Active' : 'Last seen recently'}</span>
                      {!isMobile && <span style={{ fontSize: 10, color: '#9ca3af', fontFamily: 'monospace' }}>{active.phone}</span>}
                      <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, fontWeight: 500, background: active.type === 'client' ? ACCENT_MID : '#ede9fe', color: active.type === 'client' ? '#1e40af' : '#5b21b6' }}>{active.type}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', flexShrink: 0 }}>
                    <button onClick={() => resolveConvo(active.id, active.status === 'open' ? 'resolved' : 'open')}
                      style={{ padding: '4px 9px', borderRadius: 7, border: active.status === 'open' ? '0.5px solid #86efac' : '0.5px solid #fca5a5', background: 'transparent', fontSize: 10, color: active.status === 'open' ? '#16a34a' : '#dc2626', cursor: 'pointer' }}>
                      {active.status === 'open' ? 'Resolve' : 'Reopen'}
                    </button>
                    <button onClick={() => setShowReassignModal(true)} style={{ padding: '4px 9px', borderRadius: 7, border: '0.5px solid #d1d5db', background: 'transparent', fontSize: 10, color: '#6b7280', cursor: 'pointer' }}>Reassign</button>
                    <button onClick={() => { setShowDrawer(!showDrawer); setDrawerTab('info') }} style={{ padding: '4px 9px', borderRadius: 7, border: '0.5px solid #d1d5db', background: showDrawer ? '#f1f4f9' : 'transparent', fontSize: 10, color: '#6b7280', cursor: 'pointer' }}>Contact</button>
                  </div>
                </>
              ) : <div style={{ fontSize: 13, color: '#9ca3af' }}>Select a conversation</div>}
            </div>

            {showReassignModal && (
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(10,15,30,0.3)', display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', padding: '52px 14px 0', zIndex: 20 }}
                onClick={e => { if (e.target === e.currentTarget) setShowReassignModal(false) }}>
                <div style={{ background: '#fff', border: '0.5px solid #d1d5db', borderRadius: 12, padding: 14, width: 212 }}>
                  <div style={{ fontSize: 11, fontWeight: 500, color: '#111827', marginBottom: 10 }}>Reassign conversation</div>
                  <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 3 }}>Team (optional)</div>
                  <select value={reassignTeam} onChange={e => { setReassignTeam(e.target.value); setReassignAgent('') }}
                    style={{ width: '100%', padding: '5px 8px', border: '0.5px solid #d1d5db', borderRadius: 7, fontSize: 11, background: '#f9fafb', color: '#111827', marginBottom: 8, outline: 'none' }}>
                    <option value="">No team — assign individually</option>
                    <option value="recruitment">Recruitment Team</option>
                    <option value="client">Client Relations Team</option>
                    <option value="admin">Admin Team</option>
                  </select>
                  <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 3 }}>Agent</div>
                  <select value={reassignAgent} onChange={e => setReassignAgent(e.target.value)}
                    style={{ width: '100%', padding: '5px 8px', border: '0.5px solid #d1d5db', borderRadius: 7, fontSize: 11, background: '#f9fafb', color: '#111827', outline: 'none' }}>
                    <option value="">Select agent…</option>
                    {agentOptions.map(a => <option key={a}>{a}</option>)}
                  </select>
                  <div style={{ display: 'flex', gap: 5, marginTop: 10 }}>
                    <button onClick={() => setShowReassignModal(false)} style={{ flex: 1, padding: 5, border: '0.5px solid #d1d5db', borderRadius: 7, fontSize: 11, cursor: 'pointer', background: 'transparent', color: '#6b7280' }}>Cancel</button>
                    <button onClick={doReassign} style={{ flex: 1, padding: 5, border: 'none', borderRadius: 7, fontSize: 11, cursor: 'pointer', background: ACCENT, color: '#fff', fontWeight: 500 }}>Confirm</button>
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
              <div ref={messagesRef} onScroll={onMsgScroll}
                style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                {active && active.messages.map((m, i) => {
                  const prev = active.messages[i-1]
                  const showSender = !prev || prev.direction !== m.direction
                  return (
                    <div key={m.id||i} style={{ display: 'flex', flexDirection: 'column', alignItems: m.direction === 'out' ? 'flex-end' : 'flex-start', marginBottom: 2 }}>
                      {showSender && <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 2, padding: '0 3px', textAlign: m.direction === 'out' ? 'right' : 'left' }}>{m.direction === 'out' ? (active.assigned_to || 'Agent') : active.name}</div>}
                      <div style={{ maxWidth: isMobile ? '85%' : '74%', padding: '8px 12px', borderRadius: 12, fontSize: 12, lineHeight: 1.6, wordBreak: 'break-word', whiteSpace: 'pre-wrap', background: m.direction === 'out' ? ACCENT : '#f1f4f9', color: m.direction === 'out' ? '#fff' : '#111827', borderBottomRightRadius: m.direction === 'out' ? 3 : 12, borderBottomLeftRadius: m.direction === 'in' ? 3 : 12 }}>{m.text}</div>
                      <div style={{ fontSize: 9, color: '#9ca3af', marginTop: 2, padding: '0 3px', display: 'flex', alignItems: 'center', gap: 3, justifyContent: m.direction === 'out' ? 'flex-end' : 'flex-start' }}>
                        {fmtSGT(m.created_at)}
                        {m.direction === 'out' && <svg width="13" height="8" viewBox="0 0 18 10"><path d="M1 5l3 3 7-7" stroke="#60a5fa" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/><path d="M6 5l3 3 7-7" stroke="#60a5fa" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                      </div>
                    </div>
                  )
                })}
                <div ref={messagesEndRef} />
              </div>

              {showDrawer && active && !isMobile && (
                <div style={{ width: 240, borderLeft: '0.5px solid #e5e7eb', background: '#fff', display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', borderBottom: '0.5px solid #e5e7eb', flexShrink: 0 }}>
                    {['info','notes'].map(t => <button key={t} onClick={() => setDrawerTab(t)} style={{ flex: 1, padding: '8px 2px', fontSize: 10, color: drawerTab === t ? '#111827' : '#6b7280', background: 'transparent', border: 'none', borderBottom: drawerTab === t ? `2px solid ${ACCENT}` : '2px solid transparent', cursor: 'pointer', fontWeight: drawerTab === t ? 500 : 400 }}>{t === 'info' ? 'Contact' : 'Notes'}</button>)}
                  </div>
                  <div style={{ flex: 1, overflowY: 'auto', padding: 10 }}>
                    {drawerTab === 'info' ? (
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, paddingBottom: 9, borderBottom: '0.5px solid #e5e7eb' }}>
                          <div style={{ width: 36, height: 36, borderRadius: '50%', background: ACCENT_MID, color: '#1e40af', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 500, flexShrink: 0 }}>{active.name?.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()}</div>
                          <div><div style={{ fontSize: 12, fontWeight: 500, color: '#111827' }}>{active.name}</div><div style={{ fontSize: 10, color: '#9ca3af' }}>{active.type}</div></div>
                        </div>
                        {[['Phone',active.phone],['Type',active.type],['Assigned to',active.assigned_to],['Status',active.status],['PDPA','✓ Consented'],['Calendar events',`${(calEvents[activeId]||[]).length}`]].map(([l,v]) => (
                          <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '0.5px solid #f1f4f9', fontSize: 11, gap: 6 }}>
                            <span style={{ color: '#9ca3af', flexShrink: 0 }}>{l}</span>
                            <span style={{ color: '#111827', fontWeight: 500, textAlign: 'right', fontSize: 10, wordBreak: 'break-all' }}>{v}</span>
                          </div>
                        ))}
                        <button onClick={() => { setShowCalModal(true); setCalTab('view') }} style={{ width: '100%', marginTop: 10, padding: '6px', border: '0.5px solid #d1d5db', borderRadius: 7, fontSize: 11, background: 'transparent', color: '#111827', cursor: 'pointer' }}>📅 View / Create calendar events</button>
                      </div>
                    ) : (
                      <div>
                        <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 7, padding: '5px 7px', background: '#f9fafb', borderRadius: 6, lineHeight: 1.5 }}>Notes are visible to agents only.</div>
                        <textarea value={noteInput} onChange={e => setNoteInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) saveNote() }}
                          style={{ width: '100%', padding: '6px 8px', border: '0.5px solid #d1d5db', borderRadius: 7, fontSize: 11, background: '#f9fafb', color: '#111827', resize: 'none', minHeight: 64, marginBottom: 5, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
                          placeholder="Type a note… (Ctrl+Enter to save)" rows={3} />
                        <button onClick={saveNote} style={{ width: '100%', padding: '6px', background: ACCENT_LIGHT, border: `0.5px solid ${ACCENT_MID}`, borderRadius: 7, fontSize: 11, cursor: 'pointer', color: '#1e40af', fontWeight: 500, marginBottom: 10 }}>Save note</button>
                        {(notes[activeId]||[]).length === 0 ? <div style={{ fontSize: 11, color: '#9ca3af', textAlign: 'center', padding: '10px 0' }}>No notes yet</div> :
                          (notes[activeId]||[]).map((n,i) => (
                            <div key={i} style={{ padding: '8px 9px', background: '#fefce8', borderRadius: 7, fontSize: 11, color: '#854d0e', marginBottom: 6, border: '0.5px solid #fef08a', lineHeight: 1.5 }}>
                              <div style={{ marginBottom: 4 }}>{n.text}</div>
                              <div style={{ fontSize: 9, color: '#a16207', borderTop: '0.5px solid #fef08a', paddingTop: 4, display: 'flex', gap: 4, alignItems: 'center' }}><span style={{ fontWeight: 500 }}>{n.by}</span><span>·</span><span>{n.ts}</span></div>
                            </div>
                          ))
                        }
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {showDrawer && active && isMobile && (
              <div style={{ position: 'absolute', inset: 0, background: '#fff', zIndex: 15, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ padding: '10px 14px', borderBottom: '0.5px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 9 }}>
                  <button onClick={() => setShowDrawer(false)} style={{ width: 30, height: 30, borderRadius: 7, border: '0.5px solid #d1d5db', background: 'transparent', cursor: 'pointer', fontSize: 18, color: '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>‹</button>
                  <span style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>{active.name}</span>
                </div>
                <div style={{ display: 'flex', borderBottom: '0.5px solid #e5e7eb', flexShrink: 0 }}>
                  {['info','notes'].map(t => <button key={t} onClick={() => setDrawerTab(t)} style={{ flex: 1, padding: '8px 2px', fontSize: 11, color: drawerTab === t ? '#111827' : '#6b7280', background: 'transparent', border: 'none', borderBottom: drawerTab === t ? `2px solid ${ACCENT}` : '2px solid transparent', cursor: 'pointer', fontWeight: drawerTab === t ? 500 : 400 }}>{t === 'info' ? 'Contact' : 'Notes'}</button>)}
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
                  {drawerTab === 'info' ? (
                    <div>
                      {[['Phone',active.phone],['Type',active.type],['Assigned to',active.assigned_to],['Status',active.status],['PDPA','✓ Consented'],['Calendar events',`${(calEvents[activeId]||[]).length}`]].map(([l,v]) => (
                        <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '0.5px solid #f1f4f9', fontSize: 12, gap: 6 }}>
                          <span style={{ color: '#9ca3af' }}>{l}</span><span style={{ color: '#111827', fontWeight: 500, textAlign: 'right', wordBreak: 'break-all' }}>{v}</span>
                        </div>
                      ))}
                      <button onClick={() => { setShowCalModal(true); setCalTab('view') }} style={{ width: '100%', marginTop: 12, padding: '8px', border: '0.5px solid #d1d5db', borderRadius: 7, fontSize: 12, background: 'transparent', color: '#111827', cursor: 'pointer' }}>📅 View / Create calendar events</button>
                    </div>
                  ) : (
                    <div>
                      <textarea value={noteInput} onChange={e => setNoteInput(e.target.value)}
                        style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #d1d5db', borderRadius: 8, fontSize: 13, background: '#f9fafb', color: '#111827', resize: 'none', minHeight: 80, marginBottom: 8, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
                        placeholder="Type a note…" rows={3} />
                      <button onClick={saveNote} style={{ width: '100%', padding: '8px', background: ACCENT_LIGHT, border: `0.5px solid ${ACCENT_MID}`, borderRadius: 8, fontSize: 12, cursor: 'pointer', color: '#1e40af', fontWeight: 500, marginBottom: 12 }}>Save note</button>
                      {(notes[activeId]||[]).length === 0 ? <div style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center', padding: '10px 0' }}>No notes yet</div> :
                        (notes[activeId]||[]).map((n,i) => (
                          <div key={i} style={{ padding: '9px 10px', background: '#fefce8', borderRadius: 8, fontSize: 12, color: '#854d0e', marginBottom: 8, border: '0.5px solid #fef08a', lineHeight: 1.5 }}>
                            <div style={{ marginBottom: 5 }}>{n.text}</div>
                            <div style={{ fontSize: 10, color: '#a16207', borderTop: '0.5px solid #fef08a', paddingTop: 4, display: 'flex', gap: 4 }}><span style={{ fontWeight: 500 }}>{n.by}</span><span>·</span><span>{n.ts}</span></div>
                          </div>
                        ))
                      }
                    </div>
                  )}
                </div>
              </div>
            )}

            {showScrollBtn && <button onClick={() => messagesEndRef.current?.scrollIntoView({behavior:'smooth'})} style={{ position: 'absolute', bottom: 130, right: 16, width: 28, height: 28, borderRadius: '50%', background: ACCENT, color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 4 }}>↓</button>}

            <div style={{ borderTop: '0.5px solid #e5e7eb', padding: '9px 14px', flexShrink: 0, background: '#fff' }}>
              <div style={{ display: 'flex', gap: 3, marginBottom: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                {[['text','Text'],['template','Template'],['note','Note']].map(([k,l]) => (
                  <button key={k} onClick={() => { setCompMode(k); setShowEmoji(false) }}
                    style={{ padding: '3px 9px', borderRadius: 7, border: '0.5px solid #d1d5db', background: compMode === k ? NAVY : 'transparent', fontSize: 10, color: compMode === k ? '#fff' : '#6b7280', cursor: 'pointer' }}>
                    {l}
                  </button>
                ))}
                <button onClick={() => setShowEmoji(!showEmoji)} style={{ padding: '3px 9px', borderRadius: 7, border: '0.5px solid #d1d5db', background: showEmoji ? NAVY : 'transparent', fontSize: 10, color: showEmoji ? '#fff' : '#6b7280', cursor: 'pointer' }}>Emoji</button>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 3 }}>
                  <button onClick={() => { if (activeId) { setShowCalModal(true); setCalTab('view') } }}
                    style={{ padding: '3px 9px', borderRadius: 7, border: '0.5px solid #d1d5db', background: 'transparent', fontSize: 10, color: activeId ? '#6b7280' : '#d1d5db', cursor: activeId ? 'pointer' : 'default' }}>
                    📅 Calendar
                  </button>
                  <button onClick={() => alert('File attachment will be available once Meta WhatsApp API is connected.')}
                    style={{ padding: '3px 9px', borderRadius: 7, border: '0.5px solid #d1d5db', background: 'transparent', fontSize: 10, color: '#6b7280', cursor: 'pointer' }}>
                    📎 Attach
                  </button>
                </div>
              </div>
              {compMode === 'note' && <div style={{ fontSize: 10, color: '#854d0e', background: '#fefce8', border: '0.5px solid #fcd34d', padding: '3px 8px', borderRadius: 6, marginBottom: 5 }}>Internal note — candidate will not see this</div>}
              {compMode === 'template' && (
                <select onChange={e => { const t = templates.find(t => t.id === parseInt(e.target.value)); if (t) setInput(t.body) }}
                  style={{ width: '100%', padding: '5px 8px', border: '0.5px solid #d1d5db', borderRadius: 7, fontSize: 11, background: '#f9fafb', color: '#111827', marginBottom: 5, outline: 'none' }}>
                  <option value="">Select a template…</option>
                  {templates.filter(t => t.status === 'approved').map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
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
                <button onClick={sendMessage} style={{ padding: '8px 18px', background: ACCENT, color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: 'pointer', flexShrink: 0 }}>Send</button>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                <span style={{ fontSize: 10, color: '#9ca3af' }}>Enter to send · Shift+Enter for new line</span>
                <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 6, fontWeight: 500, background: active?.status === 'open' ? ACCENT_LIGHT : '#fef3c7', color: active?.status === 'open' ? '#1e40af' : '#92400e' }}>
                  {active?.status === 'open' ? '24hr window open' : 'Template required'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* PLACEHOLDER SCREENS */}
        {activeNav !== 'inbox' && activeNav !== 'broadcasts' && activeNav !== 'templates' && !isMobile && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f4f9' }}>
            <div style={{ textAlign: 'center', color: '#9ca3af' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🚧</div>
              <div style={{ fontSize: 14, fontWeight: 500, color: '#6b7280', marginBottom: 4, textTransform: 'capitalize' }}>{activeNav}</div>
              <div style={{ fontSize: 12 }}>Coming soon</div>
            </div>
          </div>
        )}
      </div>

      {/* MOBILE BOTTOM NAV */}
      {isMobile && (
        <div style={{ display: 'flex', borderTop: '0.5px solid #e5e7eb', background: '#fff', flexShrink: 0 }}>
          {[['inbox','💬','Inbox'],['chat','📨','Chat']].map(([v,icon,label]) => (
            <button key={v} onClick={() => setMobileView(v)}
              style={{ flex: 1, padding: '8px 4px 10px', border: 'none', background: 'transparent', fontSize: 10, color: mobileView === v ? ACCENT : '#6b7280', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, fontWeight: mobileView === v ? 500 : 400 }}>
              <span style={{ fontSize: 20 }}>{icon}</span>{label}
            </button>
          ))}
        </div>
      )}

      {/* TEMPLATE EDITOR MODAL */}
      {showTemplateEditor && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 70, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 860, maxHeight: '92vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '20px 24px', borderBottom: '0.5px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 500, color: '#111827' }}>{editingTemplate ? 'Edit Template' : 'New Template'}</div>
                <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>Templates must be approved by Meta before use outside the 24hr window.</div>
              </div>
              <button onClick={() => setShowTemplateEditor(false)} style={{ width: 30, height: 30, borderRadius: 7, border: '0.5px solid #d1d5db', background: 'transparent', cursor: 'pointer', fontSize: 16, color: '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>

            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
              {/* LEFT — EDITOR */}
              <div style={{ flex: 1, padding: 24, overflowY: 'auto', borderRight: '0.5px solid #e5e7eb' }}>
                <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 4 }}>Template name <span style={{ color: '#9ca3af' }}>(lowercase, underscores only)</span></label>
                    <input value={tmplName} onChange={e => setTmplName(e.target.value)} placeholder="e.g. interview_confirmation"
                      style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #d1d5db', borderRadius: 8, fontSize: 12, outline: 'none', background: '#f9fafb', color: '#111827', boxSizing: 'border-box' }} />
                  </div>
                  <div style={{ width: 160 }}>
                    <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 4 }}>Category</label>
                    <select value={tmplCategory} onChange={e => setTmplCategory(e.target.value)}
                      style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #d1d5db', borderRadius: 8, fontSize: 12, background: '#f9fafb', color: '#111827', outline: 'none' }}>
                      <option value="utility">Utility</option>
                      <option value="marketing">Marketing</option>
                      <option value="authentication">Authentication</option>
                    </select>
                  </div>
                </div>

                {/* VARIABLES */}
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 6 }}>Insert variable</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
                    {COMMON_VARS.map(v => (
                      <button key={v} onClick={() => insertVar(v)}
                        style={{ padding: '3px 9px', borderRadius: 6, border: '0.5px solid #d1d5db', fontSize: 10, background: '#f9fafb', color: '#2563eb', cursor: 'pointer', fontFamily: 'monospace' }}>
                        {`{{${v}}}`}
                      </button>
                    ))}
                    <div style={{ display: 'flex', gap: 5 }}>
                      <input value={customVar} onChange={e => setCustomVar(e.target.value.replace(/\s/g,'_'))} placeholder="custom_var"
                        style={{ padding: '3px 8px', border: '0.5px solid #d1d5db', borderRadius: 6, fontSize: 10, width: 100, outline: 'none', background: '#f9fafb', color: '#111827', fontFamily: 'monospace' }} />
                      <button onClick={() => { if (customVar.trim()) { insertVar(customVar.trim()); setCustomVar('') } }}
                        style={{ padding: '3px 9px', borderRadius: 6, border: '0.5px solid #d1d5db', fontSize: 10, background: ACCENT, color: '#fff', cursor: 'pointer' }}>
                        + Add
                      </button>
                    </div>
                  </div>
                </div>

                {/* BODY */}
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 4 }}>Message body</label>
                  <textarea ref={tmplBodyRef} value={tmplBody} onChange={e => setTmplBody(e.target.value)} rows={8}
                    placeholder="Type your message here. Use the variable buttons above to insert variables like {{name}}, {{date}} etc."
                    style={{ width: '100%', padding: '10px 12px', border: `0.5px solid ${tmplBody.length > 1024 ? '#ef4444' : '#d1d5db'}`, borderRadius: 8, fontSize: 12, background: '#f9fafb', color: '#111827', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6, outline: 'none', boxSizing: 'border-box' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                    <span style={{ fontSize: 10, color: '#9ca3af' }}>Supports line breaks. Variables will be replaced when sending.</span>
                    <span style={{ fontSize: 10, color: tmplBody.length > 1024 ? '#ef4444' : tmplBody.length > 900 ? '#d97706' : '#9ca3af', fontWeight: tmplBody.length > 900 ? 500 : 400 }}>{tmplBody.length}/1024</span>
                  </div>
                </div>

                {/* BUTTONS */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <label style={{ fontSize: 11, color: '#6b7280' }}>Buttons <span style={{ color: '#9ca3af' }}>(max 3)</span></label>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => addButton('quick_reply')} disabled={tmplButtons.length >= 3}
                        style={{ padding: '4px 10px', border: '0.5px solid #d1d5db', borderRadius: 6, fontSize: 10, background: 'transparent', color: tmplButtons.length >= 3 ? '#d1d5db' : '#6b7280', cursor: tmplButtons.length >= 3 ? 'default' : 'pointer' }}>
                        + Quick Reply
                      </button>
                      <button onClick={() => addButton('call_to_action')} disabled={tmplButtons.length >= 3}
                        style={{ padding: '4px 10px', border: '0.5px solid #d1d5db', borderRadius: 6, fontSize: 10, background: 'transparent', color: tmplButtons.length >= 3 ? '#d1d5db' : '#6b7280', cursor: tmplButtons.length >= 3 ? 'default' : 'pointer' }}>
                        + Call to Action
                      </button>
                    </div>
                  </div>
                  {tmplButtons.length === 0 && <div style={{ fontSize: 11, color: '#9ca3af', padding: '10px', background: '#f9fafb', borderRadius: 7, textAlign: 'center' }}>No buttons added yet</div>}
                  {tmplButtons.map((b, i) => (
                    <div key={i} style={{ padding: '10px 12px', background: '#f9fafb', borderRadius: 8, border: '0.5px solid #e5e7eb', marginBottom: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span style={{ fontSize: 10, fontWeight: 500, color: b.type === 'call_to_action' ? '#2563eb' : '#5b21b6', background: b.type === 'call_to_action' ? ACCENT_MID : '#ede9fe', padding: '2px 7px', borderRadius: 4 }}>
                          {b.type === 'call_to_action' ? '🔗 Call to Action' : '↩️ Quick Reply'}
                        </span>
                        <button onClick={() => removeButton(i)} style={{ fontSize: 10, color: '#dc2626', background: 'transparent', border: 'none', cursor: 'pointer' }}>Remove</button>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: 10, color: '#6b7280', display: 'block', marginBottom: 3 }}>Button label</label>
                          <input value={b.label} onChange={e => updateButton(i, 'label', e.target.value)} placeholder="e.g. Learn More"
                            style={{ width: '100%', padding: '6px 8px', border: '0.5px solid #d1d5db', borderRadius: 6, fontSize: 11, outline: 'none', background: '#fff', color: '#111827', boxSizing: 'border-box' }} />
                        </div>
                        {b.type === 'call_to_action' && (
                          <div style={{ flex: 1 }}>
                            <label style={{ fontSize: 10, color: '#6b7280', display: 'block', marginBottom: 3 }}>URL</label>
                            <input value={b.url} onChange={e => updateButton(i, 'url', e.target.value)} placeholder="https://…"
                              style={{ width: '100%', padding: '6px 8px', border: '0.5px solid #d1d5db', borderRadius: 6, fontSize: 11, outline: 'none', background: '#fff', color: '#111827', boxSizing: 'border-box' }} />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => setShowTemplateEditor(false)}
                    style={{ flex: 1, padding: '9px', border: '0.5px solid #d1d5db', borderRadius: 8, fontSize: 12, color: '#6b7280', background: 'transparent', cursor: 'pointer' }}>Cancel</button>
                  <button onClick={saveTemplate}
                    style={{ flex: 2, padding: '9px', background: ACCENT, color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
                    {editingTemplate ? 'Save changes' : 'Create template'}
                  </button>
                </div>
              </div>

              {/* RIGHT — PREVIEW */}
              <div style={{ width: 280, padding: 24, flexShrink: 0, background: '#f9fafb' }}>
                <div style={{ fontSize: 11, fontWeight: 500, color: '#6b7280', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Live Preview</div>
                <PhonePreview body={tmplBody} buttons={tmplButtons} />
                <div style={{ marginTop: 12, padding: '10px 12px', background: '#fff', borderRadius: 8, border: '0.5px solid #e5e7eb' }}>
                  <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 6 }}>Variables detected:</div>
                  {(tmplBody.match(/\{\{(\w+)\}\}/g) || []).length === 0 ? (
                    <div style={{ fontSize: 11, color: '#9ca3af' }}>None</div>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {[...new Set(tmplBody.match(/\{\{(\w+)\}\}/g) || [])].map(v => (
                        <span key={v} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: ACCENT_MID, color: '#1e40af', fontFamily: 'monospace' }}>{v}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MAINTENANCE EDITOR MODAL */}
      {showMaintenanceEditor && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 24, width: '100%', maxWidth: 400 }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: '#111827', marginBottom: 4 }}>⚠️ Schedule Maintenance</div>
            <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 16 }}>This banner will be visible to all users.</div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 4 }}>Date (SGT)</label>
              <input type="date" value={maintDate} onChange={e => setMaintDate(e.target.value)}
                style={{ width: '100%', padding: '7px 10px', border: '0.5px solid #d1d5db', borderRadius: 7, fontSize: 12, outline: 'none', background: '#f9fafb', color: '#111827', boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 4 }}>Start time (SGT)</label>
                <input type="time" value={maintStartTime} onChange={e => setMaintStartTime(e.target.value)}
                  style={{ width: '100%', padding: '7px 10px', border: '0.5px solid #d1d5db', borderRadius: 7, fontSize: 12, outline: 'none', background: '#f9fafb', color: '#111827', boxSizing: 'border-box' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 4 }}>End time (SGT)</label>
                <input type="time" value={maintEndTime} onChange={e => setMaintEndTime(e.target.value)}
                  style={{ width: '100%', padding: '7px 10px', border: '0.5px solid #d1d5db', borderRadius: 7, fontSize: 12, outline: 'none', background: '#f9fafb', color: '#111827', boxSizing: 'border-box' }} />
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 4 }}>Message (optional)</label>
              <input type="text" value={maintMessage} onChange={e => setMaintMessage(e.target.value)} placeholder="e.g. System upgrade. Service may be intermittent."
                style={{ width: '100%', padding: '7px 10px', border: '0.5px solid #d1d5db', borderRadius: 7, fontSize: 12, outline: 'none', background: '#f9fafb', color: '#111827', boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowMaintenanceEditor(false)}
                style={{ flex: 1, padding: '8px', border: '0.5px solid #d1d5db', borderRadius: 8, fontSize: 12, color: '#6b7280', background: 'transparent', cursor: 'pointer' }}>Cancel</button>
              <button onClick={saveMaintenance}
                style={{ flex: 1, padding: '8px', background: '#92400e', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>Publish Banner</button>
            </div>
          </div>
        </div>
      )}

      {/* CALENDAR MODAL */}
      {showCalModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 20, width: '100%', maxWidth: 340, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: '#111827', marginBottom: 12 }}>📅 Calendar events</div>
            <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
              {[['view','Upcoming'],['create','Create event']].map(([k,l]) => <button key={k} onClick={() => setCalTab(k)} style={{ flex: 1, padding: '5px', borderRadius: 7, fontSize: 11, border: '0.5px solid #d1d5db', background: calTab === k ? NAVY : 'transparent', color: calTab === k ? '#fff' : '#6b7280', cursor: 'pointer' }}>{l}</button>)}
            </div>
            {calTab === 'view' ? (
              <div>
                {(calEvents[activeId]||[]).length === 0 ? <div style={{ fontSize: 11, color: '#9ca3af', textAlign: 'center', padding: '16px 0' }}>No events yet</div> :
                  (calEvents[activeId]||[]).map((ev,i) => (
                    <div key={i} style={{ padding: '9px 11px', background: '#f9fafb', border: '0.5px solid #e5e7eb', borderRadius: 8, marginBottom: 7 }}>
                      <div style={{ fontSize: 12, fontWeight: 500, color: '#111827', marginBottom: 3 }}>{ev.title}</div>
                      <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 1 }}>{ev.date} · {ev.time}</div>
                      <div style={{ fontSize: 11, color: '#9ca3af' }}>{ev.location}</div>
                    </div>
                  ))
                }
                <button onClick={() => setCalTab('create')} style={{ width: '100%', marginTop: 6, padding: '7px', background: ACCENT, color: '#fff', border: 'none', borderRadius: 7, fontSize: 11, fontWeight: 500, cursor: 'pointer' }}>+ Create new event</button>
              </div>
            ) : (
              <div>
                {[{label:'Event title',value:calTitle,set:setCalTitle,placeholder:'e.g. Interview — Sarah Lim',type:'text'},{label:'Date',value:calDate,set:setCalDate,placeholder:'',type:'date'},{label:'Time',value:calTime,set:setCalTime,placeholder:'',type:'time'},{label:'Location / Meet link',value:calLocation,set:setCalLocation,placeholder:'e.g. Level 12, Menara UOA',type:'text'}].map(f => (
                  <div key={f.label} style={{ marginBottom: 10 }}>
                    <label style={{ fontSize: 10, color: '#6b7280', display: 'block', marginBottom: 3 }}>{f.label}</label>
                    <input type={f.type} value={f.value} onChange={e => f.set(e.target.value)} placeholder={f.placeholder}
                      style={{ width: '100%', padding: '7px 10px', border: '0.5px solid #d1d5db', borderRadius: 7, fontSize: 12, outline: 'none', background: '#f9fafb', color: '#111827', boxSizing: 'border-box' }} />
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 7 }}>
                  <button onClick={() => setCalTab('view')} style={{ flex: 1, padding: '7px', border: '0.5px solid #d1d5db', borderRadius: 7, fontSize: 11, background: 'transparent', color: '#6b7280', cursor: 'pointer' }}>Back</button>
                  <button onClick={createCalEvent} style={{ flex: 1, padding: '7px', background: ACCENT, color: '#fff', border: 'none', borderRadius: 7, fontSize: 11, fontWeight: 500, cursor: 'pointer' }}>Create & link</button>
                </div>
              </div>
            )}
            <button onClick={() => setShowCalModal(false)} style={{ width: '100%', marginTop: 10, padding: '7px', border: '0.5px solid #d1d5db', borderRadius: 7, fontSize: 11, background: 'transparent', color: '#9ca3af', cursor: 'pointer' }}>Close</button>
          </div>
        </div>
      )}

      {/* NEW CONTACT MODAL */}
      {showNewContact && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '28px 24px', width: '100%', maxWidth: 380, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: '#111827', marginBottom: 18 }}>Add new contact</div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 4 }}>Full name</label>
              <input type="text" value={newName} onChange={e => setNewName(e.target.value.replace(/\b\w/g,c=>c.toUpperCase()))} placeholder="e.g. Sarah Lim"
                style={{ width: '100%', padding: '8px 12px', border: '0.5px solid #d1d5db', borderRadius: 8, fontSize: 13, outline: 'none', background: '#f9fafb', color: '#111827', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 4 }}>Phone number</label>
              <div style={{ display: 'flex', gap: 7 }}>
                <select value={newCountryCode} onChange={e => { setNewCountryCode(e.target.value); setNewPhone(''); setPhoneError('') }}
                  style={{ padding: '8px 10px', border: '0.5px solid #d1d5db', borderRadius: 8, fontSize: 12, background: '#fff', color: '#111827', minWidth: 140, outline: 'none' }}>
                  <option value="+65">+65 Singapore</option><option value="+60">+60 Malaysia</option><option value="+62">+62 Indonesia</option><option value="+63">+63 Philippines</option><option value="+66">+66 Thailand</option><option value="+84">+84 Vietnam</option><option value="+86">+86 China</option><option value="+91">+91 India</option><option value="+852">+852 Hong Kong</option><option value="+853">+853 Macau</option><option value="+886">+886 Taiwan</option><option value="+81">+81 Japan</option><option value="+82">+82 South Korea</option><option value="+44">+44 United Kingdom</option><option value="+1">+1 United States</option><option value="+61">+61 Australia</option><option value="+64">+64 New Zealand</option><option value="+971">+971 UAE</option><option value="+966">+966 Saudi Arabia</option>
                </select>
                <input type="text" value={newPhone} onChange={e => { setNewPhone(e.target.value.replace(/[^\d\s\-]/g,'')); setPhoneError('') }} placeholder={phonePlaceholder(newCountryCode)}
                  style={{ flex: 1, padding: '8px 12px', border: `0.5px solid ${phoneError ? '#ef4444' : '#d1d5db'}`, borderRadius: 8, fontSize: 13, outline: 'none', background: '#f9fafb', color: '#111827' }} />
              </div>
              {phoneError && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>{phoneError}</div>}
              {!phoneError && newPhone && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>Will be saved as: {newCountryCode}{newPhone.replace(/[\s\-]/g,'')}</div>}
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 4 }}>Contact type</label>
              <select value={newType} onChange={e => setNewType(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', border: '0.5px solid #d1d5db', borderRadius: 8, fontSize: 13, background: '#fff', color: '#111827', outline: 'none' }}>
                <option value="candidate">Candidate</option><option value="client">Client</option>
              </select>
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 4 }}>Assign to</label>
              <select value={newAssigned} onChange={e => setNewAssigned(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', border: '0.5px solid #d1d5db', borderRadius: 8, fontSize: 13, background: '#fff', color: '#111827', outline: 'none' }}>
                {ALL_AGENTS.map(a => <option key={a}>{a}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { setShowNewContact(false); setPhoneError(''); setNewName(''); setNewPhone('') }}
                style={{ flex: 1, padding: '9px', border: '0.5px solid #d1d5db', borderRadius: 8, fontSize: 12, color: '#6b7280', background: 'transparent', cursor: 'pointer' }}>Cancel</button>
              <button onClick={createContact}
                style={{ flex: 1, padding: '9px', background: ACCENT, color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>Add contact</button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}