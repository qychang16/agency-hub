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

const TABS = [
  { key: 'profile', label: 'Agency Profile', icon: '🏢' },
  { key: 'phone_numbers', label: 'Phone Numbers', icon: '📱' },
  { key: 'agents', label: 'Agents', icon: '👥' },
  { key: 'teams', label: 'Teams', icon: '🤝' },
  { key: 'routing', label: 'Routing Rules', icon: '🔀' },
  { key: 'roles', label: 'Roles & Permissions', icon: '🔑' },
  { key: 'business_hours', label: 'Business Hours', icon: '🕐' },
  { key: 'email', label: 'Email Integration', icon: '📧' },
  { key: 'whatsapp', label: 'WhatsApp API', icon: '💬' },
  { key: 'notifications', label: 'Notifications', icon: '🔔' },
  { key: 'security', label: 'Security', icon: '🔒' },
  { key: 'audit', label: 'Audit Log', icon: '📋' },
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
              <span style={{ fontSize: 15 }}>{tab.icon}</span>
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
              {tab.icon} {tab.label}
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