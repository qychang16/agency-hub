export const API = 'https://agency-hub-production-e5af.up.railway.app'

export const NAVY = '#1a2332'
export const ACCENT = '#2563eb'
export const ACCENT_LIGHT = '#eff6ff'
export const ACCENT_MID = '#dbeafe'

export const ALL_AGENTS = ['Aisha', 'Ben', 'Marcus', 'Priya', 'Rachel', 'Zara']

export const TEAMS = {
  recruitment: { label: 'Recruitment Team', agents: ['Aisha', 'Marcus', 'Priya'] },
  client: { label: 'Client Relations Team', agents: ['Ben', 'Rachel'] },
  admin: { label: 'Admin Team', agents: ['Aisha', 'Ben', 'Zara'] },
}

export const ROLES = {
  director: {
    label: 'Director',
    color: '#1a2332',
    bg: '#f1f4f9',
    description: 'Full access to everything',
  },
  manager: {
    label: 'Manager',
    color: '#2563eb',
    bg: '#eff6ff',
    description: 'Manage agents and teams, view all conversations',
  },
  senior_consultant: {
    label: 'Senior Consultant',
    color: '#7c3aed',
    bg: '#ede9fe',
    description: 'Handle own and team conversations, reassign within team',
  },
  consultant: {
    label: 'Consultant',
    color: '#0891b2',
    bg: '#ecfeff',
    description: 'Handle assigned conversations only',
  },
  admin: {
    label: 'Admin',
    color: '#059669',
    bg: '#dcfce7',
    description: 'Contact and data management, no conversations',
  },
  viewer: {
    label: 'Viewer',
    color: '#9ca3af',
    bg: '#f9fafb',
    description: 'Read-only access',
  },
}

export const PERMISSIONS = {
  view_all_conversations: { label: 'View all conversations', category: 'Conversations' },
  view_team_conversations: { label: 'View team conversations', category: 'Conversations' },
  view_own_conversations: { label: 'View own conversations', category: 'Conversations' },
  send_messages: { label: 'Send messages', category: 'Conversations' },
  send_any_template: { label: 'Use any template', category: 'Templates' },
  send_approved_templates: { label: 'Use approved templates only', category: 'Templates' },
  create_templates: { label: 'Create templates', category: 'Templates' },
  approve_templates: { label: 'Approve templates', category: 'Templates' },
  send_broadcasts: { label: 'Send broadcasts to all', category: 'Broadcasts' },
  send_own_broadcasts: { label: 'Send broadcasts to own contacts', category: 'Broadcasts' },
  schedule_messages: { label: 'Schedule messages', category: 'Scheduled' },
  bulk_schedule: { label: 'Bulk schedule via CSV', category: 'Scheduled' },
  assign_anyone: { label: 'Assign to anyone', category: 'Assignment' },
  assign_within_team: { label: 'Assign within team', category: 'Assignment' },
  self_assign: { label: 'Self-assign conversations', category: 'Assignment' },
  add_contacts: { label: 'Add contacts', category: 'Contacts' },
  delete_contacts: { label: 'Delete contacts', category: 'Contacts' },
  import_contacts: { label: 'Import contacts via CSV', category: 'Contacts' },
  export_contacts: { label: 'Export contacts', category: 'Contacts' },
  flag_dnc: { label: 'Flag Do Not Contact', category: 'Contacts' },
  view_all_analytics: { label: 'View all analytics', category: 'Analytics' },
  view_team_analytics: { label: 'View team analytics', category: 'Analytics' },
  view_own_analytics: { label: 'View own analytics', category: 'Analytics' },
  export_reports: { label: 'Export reports', category: 'Analytics' },
  manage_agents: { label: 'Manage agents', category: 'Settings' },
  manage_teams: { label: 'Manage teams', category: 'Settings' },
  manage_routing: { label: 'Manage routing rules', category: 'Settings' },
  manage_settings: { label: 'Full settings access', category: 'Settings' },
  reset_passwords: { label: 'Reset agent passwords', category: 'Settings' },
  manage_pdpa: { label: 'Manage PDPA consent', category: 'Compliance' },
  view_audit_log: { label: 'View audit log', category: 'Compliance' },
  manage_billing: { label: 'Manage billing', category: 'Billing' },
  manage_job_orders: { label: 'Manage job orders', category: 'CRM' },
  view_pipeline: { label: 'View candidate pipeline', category: 'CRM' },
  manage_pipeline: { label: 'Manage candidate pipeline', category: 'CRM' },
}

export const ROLE_DEFAULTS = {
  director: Object.keys(PERMISSIONS),
  manager: [
    'view_all_conversations','view_team_conversations','view_own_conversations',
    'send_messages','send_any_template','create_templates','approve_templates',
    'send_broadcasts','send_own_broadcasts','schedule_messages','bulk_schedule',
    'assign_anyone','assign_within_team','self_assign',
    'add_contacts','delete_contacts','import_contacts','export_contacts','flag_dnc',
    'view_all_analytics','view_team_analytics','view_own_analytics','export_reports',
    'manage_agents','manage_teams','manage_routing',
    'reset_passwords','manage_pdpa','view_audit_log',
    'manage_job_orders','view_pipeline','manage_pipeline',
  ],
  senior_consultant: [
    'view_team_conversations','view_own_conversations',
    'send_messages','send_any_template','create_templates',
    'send_own_broadcasts','schedule_messages',
    'assign_within_team','self_assign',
    'add_contacts','import_contacts','export_contacts','flag_dnc',
    'view_team_analytics','view_own_analytics',
    'manage_pdpa','view_pipeline','manage_pipeline','manage_job_orders',
  ],
  consultant: [
    'view_own_conversations',
    'send_messages','send_approved_templates',
    'self_assign',
    'add_contacts','flag_dnc',
    'view_own_analytics',
    'view_pipeline',
  ],
  admin: [
    'add_contacts','delete_contacts','import_contacts','export_contacts','flag_dnc',
    'manage_pdpa','view_pipeline',
  ],
  viewer: [
    'view_all_conversations','view_all_analytics','view_pipeline',
  ],
}

export const PIPELINE_STAGES = [
  { key: 'new', label: 'New', color: '#6b7280', bg: '#f1f4f9' },
  { key: 'screened', label: 'Screened', color: '#2563eb', bg: '#eff6ff' },
  { key: 'interviewed', label: 'Interviewed', color: '#7c3aed', bg: '#ede9fe' },
  { key: 'shortlisted', label: 'Shortlisted', color: '#0891b2', bg: '#ecfeff' },
  { key: 'offered', label: 'Offered', color: '#d97706', bg: '#fef3c7' },
  { key: 'placed', label: 'Placed', color: '#16a34a', bg: '#dcfce7' },
  { key: 'rejected', label: 'Rejected', color: '#dc2626', bg: '#fee2e2' },
  { key: 'withdrawn', label: 'Withdrawn', color: '#9ca3af', bg: '#f9fafb' },
]

export const LABEL_COLORS = [
  { key: 'interview_scheduled', label: 'Interview Scheduled', color: '#2563eb', bg: '#eff6ff' },
  { key: 'offer_pending', label: 'Offer Pending', color: '#d97706', bg: '#fef3c7' },
  { key: 'documents_requested', label: 'Documents Requested', color: '#7c3aed', bg: '#ede9fe' },
  { key: 'on_hold', label: 'On Hold', color: '#9ca3af', bg: '#f1f4f9' },
  { key: 'urgent', label: 'Urgent', color: '#dc2626', bg: '#fee2e2' },
  { key: 'vip_client', label: 'VIP Client', color: '#d97706', bg: '#fef3c7' },
  { key: 'follow_up', label: 'Follow Up', color: '#0891b2', bg: '#ecfeff' },
  { key: 'placed', label: 'Placed', color: '#16a34a', bg: '#dcfce7' },
]

export const PHONE_RULES = {
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

export const COUNTRY_CODES = [
  { code: '+65', label: '+65 Singapore' },
  { code: '+60', label: '+60 Malaysia' },
  { code: '+62', label: '+62 Indonesia' },
  { code: '+63', label: '+63 Philippines' },
  { code: '+66', label: '+66 Thailand' },
  { code: '+84', label: '+84 Vietnam' },
  { code: '+86', label: '+86 China' },
  { code: '+91', label: '+91 India' },
  { code: '+852', label: '+852 Hong Kong' },
  { code: '+853', label: '+853 Macau' },
  { code: '+886', label: '+886 Taiwan' },
  { code: '+81', label: '+81 Japan' },
  { code: '+82', label: '+82 South Korea' },
  { code: '+44', label: '+44 United Kingdom' },
  { code: '+1', label: '+1 United States' },
  { code: '+61', label: '+61 Australia' },
  { code: '+64', label: '+64 New Zealand' },
  { code: '+971', label: '+971 UAE' },
  { code: '+966', label: '+966 Saudi Arabia' },
]

export const EMOJIS = ['😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇','🙂','😉','😌','😍','🥰','😘','😋','😛','😜','🤪','🤑','🤗','🤔','🤐','😐','😑','😏','😒','🙄','😬','😔','😪','😴','😷','🤒','🤢','🤮','🤧','😵','🤯','🤠','🥳','😎','🤓','😕','😟','🙁','😮','😲','😳','🥺','😧','😰','😢','😭','😱','😤','😡','😠','🤬','😈','💀','💩','🤖','👋','✋','👌','✌','🤞','🤙','👍','👎','✊','👊','👏','🙌','🤝','🙏','💪','❤','🧡','💛','💚','💙','💜','🖤','💔','💕','💞','✅','❌','⭕','🎉','🎊','🎈','🏆','🎯','🎤','🎵','📱','💻','📞','☎','📄','📝','📊','📈','💼','👔','🏢','🌍','✈','🚗','💰','💸','💳','⭐','🌟','🔥','👀','🎁']

export const DEFAULT_TEMPLATES = [
  { id: 1, name: 'interview_confirmation', category: 'utility', status: 'approved', body: 'Dear {{name}},\n\nWe are pleased to confirm your interview for the position of {{role}} at {{company}}.\n\nDate: {{date}}\nTime: {{time}}\nVenue: {{venue}}\n\nKindly bring along your NRIC/Passport and original copies of all relevant certificates.\n\nShould you require any clarification, please do not hesitate to contact us.\n\nWe look forward to meeting you.', buttons: [], createdAt: '2026-04-01' },
  { id: 2, name: 'offer_letter_notification', category: 'utility', status: 'approved', body: 'Dear {{name}},\n\nWe are delighted to inform you that your offer letter for the position of {{role}} at {{company}} has been prepared.\n\nPlease review the terms and conditions carefully and confirm your acceptance by {{deadline}}.\n\nShould you have any questions regarding the offer, please feel free to reach out to us.\n\nWe look forward to welcoming you to the team.', buttons: [{ type: 'quick_reply', label: 'Accept Offer' }, { type: 'quick_reply', label: 'Request Clarification' }], createdAt: '2026-04-01' },
  { id: 3, name: 'candidate_status_followup', category: 'utility', status: 'approved', body: 'Dear {{name}},\n\nWe refer to your earlier application for the position of {{role}} at {{company}}.\n\nWe would like to check in on your availability and interest in proceeding with the application. Kindly advise us of your current status at your earliest convenience.\n\nThank you for your time.', buttons: [{ type: 'quick_reply', label: 'Still Interested' }, { type: 'quick_reply', label: 'No Longer Available' }], createdAt: '2026-04-01' },
  { id: 4, name: 'job_opportunity_alert', category: 'marketing', status: 'approved', body: 'Dear {{name}},\n\nWe would like to bring to your attention a new career opportunity that closely matches your profile.\n\nPosition: {{role}}\nCompany: {{company}}\nRemuneration: {{salary}} per month\n\nShould you be interested in exploring this opportunity further, please reply to this message and our consultant will be in touch shortly.', buttons: [{ type: 'quick_reply', label: 'I Am Interested' }, { type: 'call_to_action', label: 'View Job Details', url: 'https://example.com/jobs' }], createdAt: '2026-04-01' },
  { id: 5, name: 'interview_reminder', category: 'utility', status: 'approved', body: 'Dear {{name}},\n\nThis is a courtesy reminder of your scheduled interview tomorrow.\n\nDate: {{date}}\nTime: {{time}}\nVenue: {{venue}}\n\nPlease ensure you arrive at least 10 minutes prior to your appointment. Should you need to reschedule, kindly notify us as soon as possible.\n\nWe look forward to seeing you.', buttons: [], createdAt: '2026-04-01' },
  { id: 6, name: 'successful_placement', category: 'utility', status: 'approved', body: 'Dear {{name}},\n\nWe are pleased to inform you that your placement has been successfully confirmed.\n\nPosition: {{role}}\nCompany: {{company}}\nCommencement Date: {{start_date}}\n\nPlease ensure you report to the HR department on your first day with the required documentation.\n\nWe wish you every success in your new role.', buttons: [], createdAt: '2026-04-01' },
  { id: 7, name: 'cv_submission_to_client', category: 'utility', status: 'approved', body: "Dear {{hr_name}},\n\nThank you for the opportunity to assist with your recruitment needs.\n\nPlease find attached the professional profile of {{candidate}} for your consideration for the position of {{role}}.\n\nWe believe the candidate's background and experience are well-aligned with your requirements. Should you wish to arrange an interview or require any further information, please do not hesitate to contact us.\n\nWe look forward to your valued feedback.", buttons: [], createdAt: '2026-04-01' },
]