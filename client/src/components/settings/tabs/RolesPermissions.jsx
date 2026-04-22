import { useState } from 'react'
import { ACCENT, ACCENT_LIGHT, NAVY } from '../../../utils/constants'
import { getRoleColor, getRoleLabel } from '../../../utils/permissions'

const ROLE_OPTIONS = [
  { value: 'director', label: 'Director', desc: 'Full access to everything. Cannot be restricted.', icon: '👑' },
  { value: 'manager', label: 'Manager', desc: 'Manages agents and teams, views all conversations, can override any assignment.', icon: '🎯' },
  { value: 'senior_consultant', label: 'Senior Consultant', desc: 'Handles own and team conversations, can reassign within team, mentors junior agents.', icon: '⭐' },
  { value: 'consultant', label: 'Consultant', desc: 'Handles assigned conversations only, uses approved templates, basic contact management.', icon: '👤' },
  { value: 'admin', label: 'Admin', desc: 'Back-office access only. Manages contacts and data. No conversation access.', icon: '⚙️' },
  { value: 'viewer', label: 'Viewer', desc: 'Read-only access for compliance monitoring or silent oversight.', icon: '👁' },
]

const PERMISSIONS_LIST = [
  // Conversations
  { key: 'view_all_conversations', label: 'View all conversations', category: 'Conversations', desc: 'See every conversation across all agents' },
  { key: 'view_team_conversations', label: 'View team conversations', category: 'Conversations', desc: 'See conversations assigned to their team only' },
  { key: 'view_own_conversations', label: 'View own conversations', category: 'Conversations', desc: 'See only their own assigned conversations' },
  { key: 'send_messages', label: 'Send messages', category: 'Conversations', desc: 'Reply to candidates and clients via WhatsApp' },
  // Templates
  { key: 'send_any_template', label: 'Use any template', category: 'Templates', desc: 'Send any template regardless of approval status' },
  { key: 'send_approved_templates', label: 'Use approved templates only', category: 'Templates', desc: 'Can only send templates with Approved status' },
  { key: 'create_templates', label: 'Create templates', category: 'Templates', desc: 'Draft and submit new WhatsApp templates' },
  { key: 'approve_templates', label: 'Approve templates', category: 'Templates', desc: 'Approve or reject templates submitted by other agents' },
  // Broadcasts
  { key: 'send_broadcasts', label: 'Send broadcasts to all', category: 'Broadcasts', desc: 'Send bulk WhatsApp messages to all contacts' },
  { key: 'send_own_broadcasts', label: 'Send broadcasts to own contacts', category: 'Broadcasts', desc: 'Send bulk messages to their own contact list only' },
  // Scheduled
  { key: 'schedule_messages', label: 'Schedule single messages', category: 'Scheduled', desc: 'Schedule WhatsApp or email messages to individual contacts' },
  { key: 'bulk_schedule', label: 'Bulk schedule via CSV', category: 'Scheduled', desc: 'Upload CSV to schedule messages to multiple contacts at once' },
  // Assignment
  { key: 'assign_anyone', label: 'Assign to anyone', category: 'Assignment', desc: 'Assign or reassign conversations to any agent in the workspace' },
  { key: 'assign_within_team', label: 'Assign within team', category: 'Assignment', desc: 'Can only reassign to agents in their own team' },
  { key: 'self_assign', label: 'Self-assign conversations', category: 'Assignment', desc: 'Claim unassigned conversations from the queue' },
  // Contacts
  { key: 'add_contacts', label: 'Add contacts', category: 'Contacts', desc: 'Create new candidate or client contact records' },
  { key: 'delete_contacts', label: 'Delete contacts', category: 'Contacts', desc: 'Permanently delete contact records — use with caution' },
  { key: 'import_contacts', label: 'Import contacts via CSV', category: 'Contacts', desc: 'Bulk import contacts from CSV or Excel files' },
  { key: 'export_contacts', label: 'Export contacts', category: 'Contacts', desc: 'Download contact lists as CSV for backup or reporting' },
  { key: 'flag_dnc', label: 'Flag Do Not Contact', category: 'Contacts', desc: 'Mark contacts as DNC — blocks all future outbound messages' },
  // Analytics
  { key: 'view_all_analytics', label: 'View all analytics', category: 'Analytics', desc: 'See performance metrics for all agents and teams' },
  { key: 'view_team_analytics', label: 'View team analytics', category: 'Analytics', desc: 'See metrics for their team members only' },
  { key: 'view_own_analytics', label: 'View own analytics', category: 'Analytics', desc: 'See only their own personal performance metrics' },
  { key: 'export_reports', label: 'Export reports', category: 'Analytics', desc: 'Download analytics as PDF or Excel for presentations' },
  // Settings
  { key: 'manage_agents', label: 'Manage agents', category: 'Settings', desc: 'Add, edit, deactivate agents and reset passwords' },
  { key: 'manage_teams', label: 'Manage teams', category: 'Settings', desc: 'Create, edit and delete teams, assign members' },
  { key: 'manage_routing', label: 'Manage routing rules', category: 'Settings', desc: 'Configure conversation routing and escalation rules' },
  { key: 'manage_settings', label: 'Full settings access', category: 'Settings', desc: 'Access to all settings tabs including security and billing' },
  { key: 'reset_passwords', label: 'Reset agent passwords', category: 'Settings', desc: 'Force reset another agent\'s password' },
  // Compliance
  { key: 'manage_pdpa', label: 'Manage PDPA consent', category: 'Compliance', desc: 'Record, update and withdraw PDPA consent for contacts' },
  { key: 'view_audit_log', label: 'View audit log', category: 'Compliance', desc: 'Access the full audit trail of platform actions' },
  // Billing
  { key: 'manage_billing', label: 'Manage billing', category: 'Billing', desc: 'View invoices, manage subscription plan and payment methods' },
  // CRM
  { key: 'manage_job_orders', label: 'Manage job orders', category: 'CRM', desc: 'Create and manage job orders linked to client contacts' },
  { key: 'view_pipeline', label: 'View candidate pipeline', category: 'CRM', desc: 'See candidate pipeline stages and placement progress' },
  { key: 'manage_pipeline', label: 'Manage candidate pipeline', category: 'CRM', desc: 'Update pipeline stages, log placements and outcomes' },
]

const ROLE_DEFAULTS = {
  director: PERMISSIONS_LIST.map(p => p.key),
  manager: ['view_all_conversations','view_team_conversations','view_own_conversations','send_messages','send_any_template','create_templates','approve_templates','send_broadcasts','send_own_broadcasts','schedule_messages','bulk_schedule','assign_anyone','assign_within_team','self_assign','add_contacts','delete_contacts','import_contacts','export_contacts','flag_dnc','view_all_analytics','view_team_analytics','view_own_analytics','export_reports','manage_agents','manage_teams','manage_routing','reset_passwords','manage_pdpa','view_audit_log','manage_job_orders','view_pipeline','manage_pipeline'],
  senior_consultant: ['view_team_conversations','view_own_conversations','send_messages','send_any_template','create_templates','send_own_broadcasts','schedule_messages','assign_within_team','self_assign','add_contacts','import_contacts','export_contacts','flag_dnc','view_team_analytics','view_own_analytics','manage_pdpa','view_pipeline','manage_pipeline','manage_job_orders'],
  consultant: ['view_own_conversations','send_messages','send_approved_templates','self_assign','add_contacts','flag_dnc','view_own_analytics','view_pipeline'],
  admin: ['add_contacts','delete_contacts','import_contacts','export_contacts','flag_dnc','manage_pdpa','view_pipeline'],
  viewer: ['view_all_conversations','view_all_analytics','view_pipeline'],
}

const CATEGORY_ICONS = {
  Conversations: '💬',
  Templates: '📋',
  Broadcasts: '📢',
  Scheduled: '🕐',
  Assignment: '🔀',
  Contacts: '👥',
  Analytics: '📊',
  Settings: '⚙️',
  Compliance: '🔒',
  Billing: '💳',
  CRM: '🎯',
}

export default function RolesPermissions() {
  const [selectedRole, setSelectedRole] = useState('consultant')
  const [compareMode, setCompareMode] = useState(false)
  const [compareRole, setCompareRole] = useState('manager')

  const categories = [...new Set(PERMISSIONS_LIST.map(p => p.category))]
  const perms = ROLE_DEFAULTS[selectedRole] || []
  const comparePerms = ROLE_DEFAULTS[compareRole] || []
  const rc = getRoleColor(selectedRole)

  const selectedRoleInfo = ROLE_OPTIONS.find(r => r.value === selectedRole)

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>Roles & Permissions</div>
          <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 3 }}>
            View default permissions per role. To customise a specific agent, go to <strong>Agents → Permissions</strong>.
          </div>
        </div>
        <button onClick={() => setCompareMode(!compareMode)}
          style={{ padding: '8px 14px', fontSize: 12, borderRadius: 8, border: '0.5px solid #e5e7eb', background: compareMode ? ACCENT : '#fff', color: compareMode ? '#fff' : '#6b7280', cursor: 'pointer', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
          ⇄ {compareMode ? 'Exit Compare' : 'Compare Roles'}
        </button>
      </div>

      {/* Role cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
        {ROLE_OPTIONS.map(r => {
          const rrc = getRoleColor(r.value)
          const isSelected = selectedRole === r.value
          const isCompare = compareMode && compareRole === r.value
          return (
            <div key={r.value}
              onClick={() => {
                if (compareMode) {
                  if (r.value !== selectedRole) setCompareRole(r.value)
                } else {
                  setSelectedRole(r.value)
                }
              }}
              style={{ padding: '14px 16px', borderRadius: 10, border: `1.5px solid ${isSelected ? ACCENT : isCompare ? '#7c3aed' : '#e5e7eb'}`, background: isSelected ? ACCENT_LIGHT : isCompare ? '#ede9fe' : '#fff', cursor: 'pointer', transition: 'all .15s' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: 20 }}>{r.icon}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: isSelected ? ACCENT : isCompare ? '#5b21b6' : '#111827' }}>{r.label}</div>
                  <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 1 }}>{ROLE_DEFAULTS[r.value]?.length} permissions</div>
                </div>
                {isSelected && !compareMode && (
                  <span style={{ marginLeft: 'auto', fontSize: 9, padding: '2px 7px', borderRadius: 10, background: ACCENT, color: '#fff', fontWeight: 700 }}>VIEWING</span>
                )}
                {isCompare && (
                  <span style={{ marginLeft: 'auto', fontSize: 9, padding: '2px 7px', borderRadius: 10, background: '#7c3aed', color: '#fff', fontWeight: 700 }}>COMPARING</span>
                )}
              </div>
              <div style={{ fontSize: 11, color: '#9ca3af', lineHeight: 1.4 }}>{r.desc}</div>
            </div>
          )
        })}
      </div>

      {/* Permission table */}
      <div style={{ display: 'grid', gridTemplateColumns: compareMode ? '1fr 420px' : '240px 1fr', gap: 16 }}>
        {/* Role info sidebar — only in non-compare mode */}
        {!compareMode && (
          <div>
            <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e5e7eb', padding: 18, marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, paddingBottom: 14, borderBottom: '0.5px solid #f1f4f9' }}>
                <span style={{ fontSize: 28 }}>{selectedRoleInfo?.icon}</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{selectedRoleInfo?.label}</div>
                  <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: rc.bg, color: rc.color, fontWeight: 600 }}>
                    {perms.length} of {PERMISSIONS_LIST.length} permissions
                  </span>
                </div>
              </div>
              <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.6 }}>{selectedRoleInfo?.desc}</div>
            </div>

            {/* Permission coverage */}
            <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e5e7eb', padding: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Permission Coverage</div>
              {categories.map(cat => {
                const catPerms = PERMISSIONS_LIST.filter(p => p.category === cat)
                const enabled = catPerms.filter(p => perms.includes(p.key)).length
                const pct = Math.round((enabled / catPerms.length) * 100)
                return (
                  <div key={cat} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 12 }}>{CATEGORY_ICONS[cat]}</span>
                        <span style={{ fontSize: 11, color: '#374151', fontWeight: 500 }}>{cat}</span>
                      </div>
                      <span style={{ fontSize: 10, color: '#9ca3af' }}>{enabled}/{catPerms.length}</span>
                    </div>
                    <div style={{ height: 5, background: '#f1f4f9', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? '#16a34a' : pct >= 50 ? ACCENT : pct > 0 ? '#f59e0b' : '#e5e7eb', borderRadius: 3, transition: 'width .3s ease' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Permission list */}
        <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e5e7eb', overflow: 'hidden' }}>
          {/* Table header */}
          <div style={{ padding: '12px 18px', background: '#f9fafb', borderBottom: '0.5px solid #f1f4f9', display: 'grid', gridTemplateColumns: compareMode ? '1fr 120px 120px' : '1fr 80px' }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Permission</div>
            {compareMode ? (
              <>
                <div style={{ fontSize: 10, fontWeight: 600, color: ACCENT, textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'center' }}>{getRoleLabel(selectedRole)}</div>
                <div style={{ fontSize: 10, fontWeight: 600, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'center' }}>{getRoleLabel(compareRole)}</div>
              </>
            ) : (
              <div style={{ fontSize: 10, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'center' }}>Enabled</div>
            )}
          </div>

          {categories.map(cat => (
            <div key={cat}>
              {/* Category header */}
              <div style={{ padding: '10px 18px 6px', background: '#fafafa', borderBottom: '0.5px solid #f1f4f9', borderTop: '0.5px solid #f1f4f9', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 14 }}>{CATEGORY_ICONS[cat]}</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.6px' }}>{cat}</span>
                {compareMode && (
                  <span style={{ marginLeft: 'auto', fontSize: 10, color: '#9ca3af' }}>
                    {PERMISSIONS_LIST.filter(p => p.category === cat && perms.includes(p.key)).length} vs {PERMISSIONS_LIST.filter(p => p.category === cat && comparePerms.includes(p.key)).length} of {PERMISSIONS_LIST.filter(p => p.category === cat).length}
                  </span>
                )}
              </div>

              {/* Permissions */}
              {PERMISSIONS_LIST.filter(p => p.category === cat).map(p => {
                const hasIt = perms.includes(p.key)
                const compareHasIt = comparePerms.includes(p.key)
                const isDiff = compareMode && hasIt !== compareHasIt

                return (
                  <div key={p.key}
                    style={{ display: 'grid', gridTemplateColumns: compareMode ? '1fr 120px 120px' : '1fr 80px', padding: '10px 18px', borderBottom: '0.5px solid #f9fafb', background: isDiff ? '#fffbeb' : 'transparent', transition: 'background .1s' }}
                    onMouseEnter={e => { if (!isDiff) e.currentTarget.style.background = '#f9fafb' }}
                    onMouseLeave={e => { e.currentTarget.style.background = isDiff ? '#fffbeb' : 'transparent' }}>
                    <div style={{ paddingRight: 16 }}>
                      <div style={{ fontSize: 12, color: '#374151', fontWeight: 500, marginBottom: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                        {p.label}
                        {isDiff && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: '#fef3c7', color: '#92400e', fontWeight: 700 }}>DIFFERS</span>}
                      </div>
                      <div style={{ fontSize: 11, color: '#9ca3af' }}>{p.desc}</div>
                    </div>

                    {compareMode ? (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {hasIt ? (
                            <div style={{ width: 22, height: 22, borderRadius: 6, background: '#dcfce7', border: '1px solid #86efac', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <svg width="11" height="11" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke="#16a34a" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
                            </div>
                          ) : (
                            <div style={{ width: 22, height: 22, borderRadius: 6, background: '#f9fafb', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <svg width="11" height="11" viewBox="0 0 12 12"><path d="M3 3l6 6M9 3l-6 6" stroke="#d1d5db" strokeWidth="1.8" strokeLinecap="round"/></svg>
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {compareHasIt ? (
                            <div style={{ width: 22, height: 22, borderRadius: 6, background: '#ede9fe', border: '1px solid #c4b5fd', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <svg width="11" height="11" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke="#7c3aed" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
                            </div>
                          ) : (
                            <div style={{ width: 22, height: 22, borderRadius: 6, background: '#f9fafb', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <svg width="11" height="11" viewBox="0 0 12 12"><path d="M3 3l6 6M9 3l-6 6" stroke="#d1d5db" strokeWidth="1.8" strokeLinecap="round"/></svg>
                            </div>
                          )}
                        </div>
                      </>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {hasIt ? (
                          <div style={{ width: 22, height: 22, borderRadius: 6, background: '#dcfce7', border: '1px solid #86efac', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <svg width="11" height="11" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke="#16a34a" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          </div>
                        ) : (
                          <div style={{ width: 22, height: 22, borderRadius: 6, background: '#f9fafb', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <svg width="11" height="11" viewBox="0 0 12 12"><path d="M3 3l6 6M9 3l-6 6" stroke="#d1d5db" strokeWidth="1.8" strokeLinecap="round"/></svg>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ))}

          {/* Footer */}
          <div style={{ padding: '12px 18px', background: '#f9fafb', borderTop: '0.5px solid #f1f4f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 11, color: '#9ca3af' }}>
              {compareMode
                ? `${getRoleLabel(selectedRole)}: ${perms.length} permissions · ${getRoleLabel(compareRole)}: ${comparePerms.length} permissions`
                : `${perms.length} of ${PERMISSIONS_LIST.length} permissions enabled for ${getRoleLabel(selectedRole)}`
              }
            </div>
            {compareMode && (
              <div style={{ fontSize: 11, color: '#92400e', background: '#fef3c7', padding: '3px 10px', borderRadius: 6 }}>
                {PERMISSIONS_LIST.filter(p => perms.includes(p.key) !== comparePerms.includes(p.key)).length} differences found
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Note */}
      <div style={{ marginTop: 16, padding: '12px 16px', background: ACCENT_LIGHT, border: '0.5px solid #bfdbfe', borderRadius: 10, fontSize: 12, color: '#1e40af', lineHeight: 1.6 }}>
        <strong>To customise permissions for a specific agent:</strong> Go to <strong>Settings → Agents</strong>, find the agent, and click <strong>Permissions</strong>.
        You can add or remove individual permissions beyond their role defaults. Changes are tracked in the Audit Log.
      </div>
    </div>
  )
}