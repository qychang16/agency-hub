import { ROLE_DEFAULTS } from './constants'

export function hasPermission(user, permission) {
  if (!user) return false
  if (user.role === 'director') return true
  const userPermissions = user.permissions || ROLE_DEFAULTS[user.role] || []
  return userPermissions.includes(permission)
}

export function canViewConversation(user, conversation) {
  if (!user || !conversation) return false
  if (hasPermission(user, 'view_all_conversations')) return true
  if (hasPermission(user, 'view_team_conversations')) {
    const { TEAMS } = require('./constants')
    const userTeam = Object.values(TEAMS).find(t => t.agents.includes(user.name))
    if (userTeam && userTeam.agents.includes(conversation.assigned_to)) return true
  }
  if (hasPermission(user, 'view_own_conversations')) {
    return conversation.assigned_to === user.name
  }
  return false
}

export function canAssign(user, targetAgent) {
  if (!user) return false
  if (hasPermission(user, 'assign_anyone')) return true
  if (hasPermission(user, 'assign_within_team')) {
    const { TEAMS } = require('./constants')
    const userTeam = Object.values(TEAMS).find(t => t.agents.includes(user.name))
    return userTeam && userTeam.agents.includes(targetAgent)
  }
  return false
}

export function canSendTemplate(user, template) {
  if (!user || !template) return false
  if (hasPermission(user, 'send_any_template')) return true
  if (hasPermission(user, 'send_approved_templates')) {
    return template.status === 'approved'
  }
  return false
}

export function getVisibleConversations(user, conversations) {
  if (!user || !conversations) return []
  if (hasPermission(user, 'view_all_conversations')) return conversations
  if (hasPermission(user, 'view_team_conversations')) {
    const { TEAMS } = require('./constants')
    const userTeam = Object.values(TEAMS).find(t => t.agents.includes(user.name))
    if (userTeam) {
      return conversations.filter(c =>
        userTeam.agents.includes(c.assigned_to) || c.assigned_to === user.name
      )
    }
  }
  return conversations.filter(c => c.assigned_to === user.name)
}

export function getAccessibleNavItems(user) {
  if (!user) return []
  const items = []
  if (hasPermission(user, 'view_own_conversations') ||
      hasPermission(user, 'view_team_conversations') ||
      hasPermission(user, 'view_all_conversations')) {
    items.push('inbox')
  }
  if (hasPermission(user, 'send_broadcasts') ||
      hasPermission(user, 'send_own_broadcasts')) {
    items.push('broadcasts')
  }
  if (hasPermission(user, 'send_approved_templates') ||
      hasPermission(user, 'create_templates')) {
    items.push('templates')
  }
  if (hasPermission(user, 'schedule_messages') ||
      hasPermission(user, 'bulk_schedule')) {
    items.push('scheduled')
  }
  if (hasPermission(user, 'view_own_analytics') ||
      hasPermission(user, 'view_team_analytics') ||
      hasPermission(user, 'view_all_analytics')) {
    items.push('analytics')
  }
  if (hasPermission(user, 'view_pipeline') ||
      hasPermission(user, 'manage_pipeline')) {
    items.push('pipeline')
  }
  if (hasPermission(user, 'manage_job_orders')) {
    items.push('jobs')
  }
  if (hasPermission(user, 'add_contacts') ||
      hasPermission(user, 'import_contacts')) {
    items.push('contacts')
  }
  if (hasPermission(user, 'manage_pdpa')) {
    items.push('pdpa')
  }
  if (hasPermission(user, 'manage_settings') ||
      hasPermission(user, 'manage_agents') ||
      hasPermission(user, 'manage_teams')) {
    items.push('settings')
  }
  return items
}

export function getRoleColor(role) {
  const colors = {
    director: { color: '#fff', bg: '#1a2332' },
    manager: { color: '#1e40af', bg: '#dbeafe' },
    senior_consultant: { color: '#5b21b6', bg: '#ede9fe' },
    consultant: { color: '#0e7490', bg: '#cffafe' },
    admin: { color: '#065f46', bg: '#d1fae5' },
    viewer: { color: '#6b7280', bg: '#f1f4f9' },
  }
  return colors[role] || colors.viewer
}

export function getRoleLabel(role) {
  const labels = {
    director: 'Director',
    manager: 'Manager',
    senior_consultant: 'Senior Consultant',
    consultant: 'Consultant',
    admin: 'Admin',
    viewer: 'Viewer',
  }
  return labels[role] || role
}