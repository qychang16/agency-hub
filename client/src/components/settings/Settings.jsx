import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { ACCENT, ACCENT_LIGHT, NAVY } from '../../utils/constants'

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
  const { user, isDirector } = useAuth()
  const [activeTab, setActiveTab] = useState('profile')
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const visibleTabs = TABS.filter(tab => {
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
          <div style={{ textAlign: 'center', color: '#9ca3af' }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>🚧</div>
            <div style={{ fontSize: 14, fontWeight: 500, color: '#6b7280' }}>Coming soon</div>
          </div>
        </div>
      )
    }
  }

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden', background: '#f1f4f9' }}>
      {/* Sidebar */}
      {!isMobile && (
        <div style={{ width: 220, flexShrink: 0, background: '#fff', borderRight: '0.5px solid #e5e7eb', overflowY: 'auto', padding: '16px 10px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.6px', padding: '4px 10px', marginBottom: 10 }}>
            Settings
          </div>
          {visibleTabs.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: '9px 10px', borderRadius: 8, border: 'none', background: activeTab === tab.key ? ACCENT_LIGHT : 'transparent', color: activeTab === tab.key ? ACCENT : '#374151', cursor: 'pointer', fontSize: 12, fontWeight: activeTab === tab.key ? 600 : 400, textAlign: 'left', marginBottom: 2, transition: 'all .1s' }}
              onMouseEnter={e => { if (activeTab !== tab.key) e.currentTarget.style.background = '#f9fafb' }}
              onMouseLeave={e => { if (activeTab !== tab.key) e.currentTarget.style.background = 'transparent' }}>
              <span style={{ fontSize: 15 }}>{tab.icon}</span>
              {tab.label}
            </button>
          ))}

          {/* Version info */}
          <div style={{ marginTop: 'auto', padding: '16px 10px 4px', borderTop: '0.5px solid #f1f4f9', marginLeft: -10, marginRight: -10, paddingLeft: 10 }}>
            <div style={{ fontSize: 10, color: '#9ca3af' }}>Tel-Cloud v2.0.0</div>
            <div style={{ fontSize: 10, color: '#d1d5db', marginTop: 2 }}>© 2026 Y.E.C Consultancy</div>
          </div>
        </div>
      )}

      {/* Mobile tab selector */}
      {isMobile && (
        <div style={{ position: 'fixed', bottom: 60, left: 0, right: 0, background: '#fff', borderTop: '0.5px solid #e5e7eb', padding: '8px 12px', zIndex: 20, overflowX: 'auto', display: 'flex', gap: 6 }}>
          {visibleTabs.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              style={{ padding: '5px 10px', borderRadius: 7, border: 'none', background: activeTab === tab.key ? ACCENT : '#f1f4f9', color: activeTab === tab.key ? '#fff' : '#6b7280', cursor: 'pointer', fontSize: 11, fontWeight: activeTab === tab.key ? 600 : 400, whiteSpace: 'nowrap', flexShrink: 0 }}>
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '16px' : '24px 28px' }}>
        {renderTab()}
      </div>
    </div>
  )
}