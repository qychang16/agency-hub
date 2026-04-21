import { createContext, useContext, useState, useEffect } from 'react'
import { API } from '../utils/constants'
import { useAuth } from './AuthContext'

const WorkspaceContext = createContext(null)

const DEFAULT_WORKSPACE = {
  id: 'ws_default',
  name: 'My Agency',
  logo: null,
  email: '',
  phone: '',
  address: '',
  registration: '',
  timezone: 'Asia/Singapore',
  whatsapp_phone_id: '',
  whatsapp_token: '',
  whatsapp_connected: false,
  business_hours: {
    Monday:    { open: true,  start: '09:00', end: '18:00' },
    Tuesday:   { open: true,  start: '09:00', end: '18:00' },
    Wednesday: { open: true,  start: '09:00', end: '18:00' },
    Thursday:  { open: true,  start: '09:00', end: '18:00' },
    Friday:    { open: true,  start: '09:00', end: '18:00' },
    Saturday:  { open: false, start: '09:00', end: '13:00' },
    Sunday:    { open: false, start: '09:00', end: '13:00' },
  },
  after_hours_template: '',
  plan: 'starter',
  created_at: new Date().toISOString(),
}

const DEFAULT_AGENTS = [
  { id: 1, name: 'Director', email: 'director@agencyhub.com', role: 'director', team: null, status: 'online', capacity: 50, active: true, created_at: '2026-01-01' },
  { id: 2, name: 'Aisha', email: 'aisha@agencyhub.com', role: 'senior_consultant', team: 'recruitment', status: 'online', capacity: 20, active: true, created_at: '2026-01-01' },
  { id: 3, name: 'Ben', email: 'ben@agencyhub.com', role: 'consultant', team: 'client', status: 'online', capacity: 20, active: true, created_at: '2026-01-01' },
  { id: 4, name: 'Marcus', email: 'marcus@agencyhub.com', role: 'consultant', team: 'recruitment', status: 'away', capacity: 20, active: true, created_at: '2026-01-15' },
  { id: 5, name: 'Priya', email: 'priya@agencyhub.com', role: 'consultant', team: 'recruitment', status: 'offline', capacity: 20, active: true, created_at: '2026-01-15' },
  { id: 6, name: 'Rachel', email: 'rachel@agencyhub.com', role: 'consultant', team: 'client', status: 'online', capacity: 20, active: true, created_at: '2026-02-01' },
  { id: 7, name: 'Zara', email: 'zara@agencyhub.com', role: 'admin', team: 'admin', status: 'online', capacity: 0, active: true, created_at: '2026-02-01' },
]

const DEFAULT_TEAMS = [
  { id: 1, key: 'recruitment', label: 'Recruitment Team', lead: 'Aisha', type: 'recruitment', agents: ['Aisha', 'Marcus', 'Priya'], color: '#2563eb' },
  { id: 2, key: 'client', label: 'Client Relations Team', lead: 'Ben', type: 'client', agents: ['Ben', 'Rachel'], color: '#7c3aed' },
  { id: 3, key: 'admin', label: 'Admin Team', lead: 'Zara', type: 'admin', agents: ['Zara'], color: '#059669' },
]

const DEFAULT_ROUTING = {
  mode: 'smart',
  sticky_assignment: true,
  round_robin: true,
  candidate_team: 'recruitment',
  client_team: 'client',
  max_capacity: 20,
  escalation_enabled: true,
  escalation_steps: [
    { type: 'agent', target: '', wait_minutes: 30 },
    { type: 'team', target: 'recruitment', wait_minutes: 60 },
    { type: 'role', target: 'manager', wait_minutes: 120 },
  ],
  after_hours_action: 'auto_reply',
  unassigned_queue: true,
  blackout_start: '22:00',
  blackout_end: '08:00',
}

const DEFAULT_NOTIFICATIONS = {
  new_conversation: { in_app: true, email: false },
  conversation_assigned: { in_app: true, email: true },
  conversation_reassigned: { in_app: true, email: false },
  message_received: { in_app: true, email: false },
  sla_breach: { in_app: true, email: true },
  broadcast_sent: { in_app: true, email: false },
  new_agent_added: { in_app: true, email: true },
  placement_logged: { in_app: true, email: false },
}

const DEFAULT_SECURITY = {
  session_timeout_minutes: 480,
  max_failed_logins: 5,
  force_password_change: false,
  two_factor_enabled: false,
  password_min_length: 8,
  password_require_special: false,
}

export function WorkspaceProvider({ children }) {
  const { token } = useAuth()

  const [workspace, setWorkspace] = useState(() => {
    const saved = localStorage.getItem('workspace')
    return saved ? JSON.parse(saved) : DEFAULT_WORKSPACE
  })

  const [agents, setAgents] = useState(() => {
    const saved = localStorage.getItem('agents')
    return saved ? JSON.parse(saved) : DEFAULT_AGENTS
  })

  const [teams, setTeams] = useState(() => {
    const saved = localStorage.getItem('teams')
    return saved ? JSON.parse(saved) : DEFAULT_TEAMS
  })

  const [routing, setRouting] = useState(() => {
    const saved = localStorage.getItem('routing')
    return saved ? JSON.parse(saved) : DEFAULT_ROUTING
  })

  const [notifications, setNotifications] = useState(() => {
    const saved = localStorage.getItem('notifications')
    return saved ? JSON.parse(saved) : DEFAULT_NOTIFICATIONS
  })

  const [security, setSecurity] = useState(() => {
    const saved = localStorage.getItem('security')
    return saved ? JSON.parse(saved) : DEFAULT_SECURITY
  })

  const [maintenance, setMaintenance] = useState(null)

  // Persist to localStorage whenever state changes
  useEffect(() => { localStorage.setItem('workspace', JSON.stringify(workspace)) }, [workspace])
  useEffect(() => { localStorage.setItem('agents', JSON.stringify(agents)) }, [agents])
  useEffect(() => { localStorage.setItem('teams', JSON.stringify(teams)) }, [teams])
  useEffect(() => { localStorage.setItem('routing', JSON.stringify(routing)) }, [routing])
  useEffect(() => { localStorage.setItem('notifications', JSON.stringify(notifications)) }, [notifications])
  useEffect(() => { localStorage.setItem('security', JSON.stringify(security)) }, [security])

  function updateWorkspace(updates) {
    setWorkspace(prev => ({ ...prev, ...updates }))
  }

  function addAgent(agent) {
    const newAgent = { ...agent, id: Date.now(), active: true, status: 'offline', created_at: new Date().toISOString().split('T')[0] }
    setAgents(prev => [...prev, newAgent])
    return newAgent
  }

  function updateAgent(id, updates) {
    setAgents(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a))
  }

  function deactivateAgent(id) {
    setAgents(prev => prev.map(a => a.id === id ? { ...a, active: false, status: 'offline' } : a))
  }

  function reactivateAgent(id) {
    setAgents(prev => prev.map(a => a.id === id ? { ...a, active: true } : a))
  }

  function addTeam(team) {
    const newTeam = { ...team, id: Date.now() }
    setTeams(prev => [...prev, newTeam])
    return newTeam
  }

  function updateTeam(id, updates) {
    setTeams(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t))
  }

  function deleteTeam(id) {
    setTeams(prev => prev.filter(t => t.id !== id))
  }

  function updateRouting(updates) {
    setRouting(prev => ({ ...prev, ...updates }))
  }

  function updateNotifications(updates) {
    setNotifications(prev => ({ ...prev, ...updates }))
  }

  function updateSecurity(updates) {
    setSecurity(prev => ({ ...prev, ...updates }))
  }

  function getAgentByName(name) {
    return agents.find(a => a.name === name)
  }

  function getTeamByKey(key) {
    return teams.find(t => t.key === key)
  }

  function getActiveAgents() {
    return agents.filter(a => a.active)
  }

  function getOnlineAgents() {
    return agents.filter(a => a.active && a.status === 'online')
  }

  function getTeamAgents(teamKey) {
    const team = getTeamByKey(teamKey)
    if (!team) return []
    return agents.filter(a => team.agents.includes(a.name) && a.active)
  }

  return (
    <WorkspaceContext.Provider value={{
      workspace, updateWorkspace,
      agents, addAgent, updateAgent, deactivateAgent, reactivateAgent,
      getAgentByName, getActiveAgents, getOnlineAgents,
      teams, addTeam, updateTeam, deleteTeam, getTeamByKey, getTeamAgents,
      routing, updateRouting,
      notifications, updateNotifications,
      security, updateSecurity,
      maintenance, setMaintenance,
    }}>
      {children}
    </WorkspaceContext.Provider>
  )
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext)
  if (!ctx) throw new Error('useWorkspace must be used within WorkspaceProvider')
  return ctx
}