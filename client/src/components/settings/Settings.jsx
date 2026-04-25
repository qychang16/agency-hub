import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { ACCENT, ACCENT_LIGHT, NAVY } from '../../utils/designTokens'

// Tab imports
import AgencyProfile from './tabs/AgencyProfile'
import PhoneNumbers from './tabs/PhoneNumbers'
import Agents from './tabs/Agents'
import Teams from './tabs/Teams'
import Routing from './tabs/Routing'
import RolesPermissions from './tabs/RolesPermissions'
import BusinessHours from './tabs/BusinessHours'
import EmailIntegration from './tabs/EmailIntegration'
import WhatsAppAPI from './tabs/WhatsAppAPI'
import NotificationSettings from './tabs/NotificationSettings'
import SecuritySettings from './tabs/SecuritySettings'
import AuditLog from './tabs/AuditLog'

const ICON_PROPS = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' }

const Icons = {
  profile: <svg {...ICON_PROPS}><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/></svg>,
  phone_numbers: <svg {...ICON_PROPS}><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/></svg>,
  agents: <svg {...ICON_PROPS}><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>,
  teams: <svg {...ICON_PROPS}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>,
  routing: <svg {...ICON_PROPS}><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg>,
  roles: <svg {...ICON_PROPS}><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>,
  business_hours: <svg {...ICON_PROPS}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  email: <svg {...ICON_PROPS}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>,
  whatsapp: <svg {...ICON_PROPS}><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>,
  notifications: <svg {...ICON_PROPS}><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>,
  security: <svg {...ICON_PROPS}><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>,
  audit: <svg {...ICON_PROPS}><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8"/><path d="M8 11h8"/><path d="M8 15h5"/></svg>,
}

const TABS = [
  { key: 'profile', label: 'Agency Profile' },
  { key: 'phone_numbers', label: 'Phone Numbers' },
  { key: 'agents', label: 'Agents' },
  { key: 'teams', label: 'Teams' },
  { key: 'routing', label: 'Routing Rules' },
  { key: 'roles', label: 'Roles & Permissions' },
  { key: 'business_hours', label: 'Business Hours' },
  { key: 'email', label: 'Email Integration' },
  { key: 'whatsapp', label: 'WhatsApp API' },
  { key: 'notifications', label: 'Notifications' },
  { key: 'security', label: 'Security' },
  { key: 'audit', label: 'Audit Log' },
]

export default function Settings() {
  const { user, isDirector, hasPermission } = useAuth()
  const [activeTab, setActiveTab] = useState('profile')
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const visibleTabs = TABS.filter(tab => {
    // Roles & Permissions tab — gated by explicit permission (Chunk 5)
    if (tab.key === 'roles') return hasPermission('manage_role_permissions')

    // Legacy role-based gates for other tabs
    if (user?.role === 'director' || user?.role === 'manager') return true
    if (tab.key === 'notifications' || tab.key === 'security') return true
    if (tab.key === 'agents' || tab.key === 'teams') return user?.role === 'senior_consultant'
    return false
  })

  function renderTab() {
    switch (activeTab) {
      case 'profile': return <AgencyProfile />
      case 'phone_numbers': return <PhoneNumbers />
      case 'agents': return <Agents />
      case 'teams': return <Teams />
      case 'routing': return <Routing />
      case 'roles': return <RolesPermissions />
      case 'business_hours': return <BusinessHours />
      case 'email': return <EmailIntegration />
      case 'whatsapp': return <WhatsAppAPI />
      case 'notifications': return <NotificationSettings />
      case 'security': return <SecuritySettings />
      case 'audit': return <AuditLog />
      default: return (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center', color: '#9a958c' }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#9a958c" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 10 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <div style={{ fontSize: 14, fontWeight: 500, color: '#6e6a63' }}>Coming soon</div>
          </div>
        </div>
      )
    }
  }

  return (
    <div className="flex-col md:flex-row" style={{ display: 'flex', flex: 1, overflow: 'hidden', background: '#faf9f7' }}>
      {/* Sidebar */}
      {!isMobile && (
        <div style={{ width: 220, flexShrink: 0, background: '#fff', borderRight: '0.5px solid #dcd8d0', overflowY: 'auto', padding: '16px 10px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#9a958c', textTransform: 'uppercase', letterSpacing: '0.6px', padding: '4px 10px', marginBottom: 10 }}>
            Settings
          </div>
          {visibleTabs.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: '9px 10px', borderRadius: 8, border: 'none', background: activeTab === tab.key ? ACCENT_LIGHT : 'transparent', color: activeTab === tab.key ? ACCENT : '#4a4742', cursor: 'pointer', fontSize: 12, fontWeight: activeTab === tab.key ? 600 : 400, textAlign: 'left', marginBottom: 2, transition: 'all .1s' }}
              onMouseEnter={e => { if (activeTab !== tab.key) e.currentTarget.style.background = '#faf9f7' }}
              onMouseLeave={e => { if (activeTab !== tab.key) e.currentTarget.style.background = 'transparent' }}>
              <span style={{ display: 'flex', alignItems: 'center', color: 'currentColor' }}>{Icons[tab.key]}</span>
              {tab.label}
            </button>
          ))}

          {/* Version info */}
          <div style={{ marginTop: 'auto', padding: '16px 10px 4px', borderTop: '0.5px solid #f5f3ef', marginLeft: -10, marginRight: -10, paddingLeft: 10 }}>
            <div style={{ fontSize: 10, color: '#9a958c' }}>Tel-Cloud v2.0.0</div>
            <div style={{ fontSize: 10, color: '#c2bdb3', marginTop: 2 }}>© 2026 Y.E.C Consultancy</div>
          </div>
        </div>
      )}

      {/* Mobile tab selector - sticky top, not floating */}
      {isMobile && (
        <div style={{ position: 'sticky', top: 0, left: 0, right: 0, background: '#fff', borderBottom: '0.5px solid #dcd8d0', padding: '10px 12px', zIndex: 20, overflowX: 'auto', display: 'flex', gap: 6, flexShrink: 0 }}>
          {visibleTabs.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              style={{ padding: '7px 12px', borderRadius: 7, border: 'none', background: activeTab === tab.key ? ACCENT : '#f5f3ef', color: activeTab === tab.key ? '#fff' : '#6e6a63', cursor: 'pointer', fontSize: 12, fontWeight: activeTab === tab.key ? 600 : 500, whiteSpace: 'nowrap', flexShrink: 0, minHeight: 36 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>{Icons[tab.key]} {tab.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="px-4 py-4 md:px-7 md:py-6" style={{ flex: 1, overflowY: 'auto' }}>
        {renderTab()}
      </div>
    </div>
  )
}