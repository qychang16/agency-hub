import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useWorkspace } from '../../context/WorkspaceContext'
import { NAVY, ACCENT } from '../../utils/constants'
import { hasPermission } from '../../utils/permissions'

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

const NAV_ITEMS = [
  { key: 'inbox', label: 'Inbox', icon: '💬' },
  { key: 'scheduled', label: 'Scheduled', icon: '🕐' },
  { key: 'broadcasts', label: 'Broadcasts', icon: '📢' },
  { key: 'templates', label: 'Templates', icon: '📋' },
  { key: 'analytics', label: 'Analytics', icon: '📊' },
  { key: 'pipeline', label: 'Pipeline', icon: '🎯' },
  { key: 'jobs', label: 'Jobs', icon: '💼' },
  { key: 'contacts', label: 'Contacts', icon: '👥' },
  { key: 'pdpa', label: 'PDPA', icon: '🔒' },
  { key: 'settings', label: 'Settings', icon: '⚙️' },
]

export default function Topbar({ activeNav, setActiveNav, onNewContact, isMobile }) {
  const { user, logout, isDirector } = useAuth()
  const { workspace, maintenance, setMaintenance, setShowMaintenanceEditor } = useWorkspace()
  const [showUserMenu, setShowUserMenu] = useState(false)

  const visibleNav = NAV_ITEMS.filter(item => {
    switch (item.key) {
      case 'inbox': return hasPermission(user, 'view_own_conversations') || hasPermission(user, 'view_all_conversations')
      case 'scheduled': return hasPermission(user, 'schedule_messages') || hasPermission(user, 'bulk_schedule')
      case 'broadcasts': return hasPermission(user, 'send_broadcasts') || hasPermission(user, 'send_own_broadcasts')
      case 'templates': return hasPermission(user, 'send_approved_templates') || hasPermission(user, 'create_templates')
      case 'analytics': return hasPermission(user, 'view_own_analytics') || hasPermission(user, 'view_all_analytics')
      case 'pipeline': return hasPermission(user, 'view_pipeline')
      case 'jobs': return hasPermission(user, 'manage_job_orders')
      case 'contacts': return hasPermission(user, 'add_contacts') || hasPermission(user, 'import_contacts')
      case 'pdpa': return hasPermission(user, 'manage_pdpa')
      case 'settings': return hasPermission(user, 'manage_settings') || hasPermission(user, 'manage_agents')
      default: return false
    }
  })

  const roleColors = {
    director: '#fbbf24',
    manager: '#60a5fa',
    senior_consultant: '#a78bfa',
    consultant: '#34d399',
    admin: '#fb923c',
    viewer: '#9ca3af',
  }

  return (
    <>
      {/* Maintenance Banner */}
      {maintenance && (
        <div style={{ background: '#92400e', color: '#fff', padding: '8px 16px', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>⚠️</span>
            <span><strong>Scheduled Maintenance:</strong> {maintenance.datetime} · {maintenance.message}</span>
          </div>
          {isDirector && (
            <button onClick={() => setMaintenance(null)}
              style={{ background: 'transparent', border: '0.5px solid rgba(255,255,255,0.4)', color: '#fff', borderRadius: 5, padding: '2px 8px', fontSize: 10, cursor: 'pointer' }}>
              Dismiss
            </button>
          )}
        </div>
      )}

      {/* Main Topbar */}
      <div style={{ height: 52, background: NAVY, display: 'flex', alignItems: 'center', padding: '0 16px', flexShrink: 0, borderBottom: '0.5px solid rgba(255,255,255,0.08)', position: 'relative', zIndex: 30 }}>

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginRight: 14, flexShrink: 0 }}>
          <DualRingsLogo />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 14, fontWeight: 500, color: '#fff' }}>{workspace?.name || 'Tel-Cloud'}</span>
            {!isMobile && <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.4px', textTransform: 'uppercase', marginTop: 1 }}>by tel-cloud</span>}
          </div>
        </div>

        {/* Divider */}
        {!isMobile && <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.15)', margin: '0 10px' }} />}

        {/* Nav Items */}
        {!isMobile && (
          <div style={{ display: 'flex', gap: 2, overflowX: 'auto', flex: 1 }}>
            {visibleNav.map(n => (
              <button key={n.key} onClick={() => setActiveNav(n.key)}
                style={{ padding: '6px 11px', borderRadius: 7, fontSize: 12, color: activeNav === n.key ? '#fff' : '#cbd5e1', background: activeNav === n.key ? 'rgba(255,255,255,0.15)' : 'transparent', border: 'none', cursor: 'pointer', fontWeight: activeNav === n.key ? 500 : 400, whiteSpace: 'nowrap', flexShrink: 0 }}>
                {n.label}
              </button>
            ))}
          </div>
        )}

        {/* Right side actions */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>

          {/* Maintenance button — Director only */}
          {isDirector && (
            <button onClick={() => setShowMaintenanceEditor(true)}
              style={{ padding: '5px 9px', borderRadius: 7, border: '0.5px solid rgba(255,165,0,0.5)', background: 'transparent', fontSize: 10, color: '#fbbf24', cursor: 'pointer' }}>
              ⚠️ Maintenance
            </button>
          )}

          {/* New contact button */}
          {hasPermission(user, 'add_contacts') && (
            <button onClick={onNewContact}
              style={{ padding: '5px 10px', borderRadius: 7, border: '0.5px solid rgba(255,255,255,0.25)', background: 'transparent', fontSize: 11, color: '#e2e8f0', cursor: 'pointer' }}>
              + New
            </button>
          )}

          {/* User menu */}
          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowUserMenu(!showUserMenu)}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '4px 8px', borderRadius: 8, border: '0.5px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', cursor: 'pointer' }}>
              <div style={{ width: 24, height: 24, borderRadius: 7, background: roleColors[user?.role] || '#9ca3af', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff' }}>
                {user?.name?.[0]?.toUpperCase()}
              </div>
              {!isMobile && (
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 11, color: '#fff', fontWeight: 500, lineHeight: 1.2 }}>{user?.name}</div>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', textTransform: 'capitalize' }}>{user?.role?.replace('_', ' ')}</div>
                </div>
              )}
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ opacity: 0.5 }}>
                <path d="M2 4l3 3 3-3" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>

            {showUserMenu && (
              <div style={{ position: 'absolute', right: 0, top: 38, background: '#fff', borderRadius: 10, border: '0.5px solid #e5e7eb', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: 180, zIndex: 100, overflow: 'hidden' }}
                onMouseLeave={() => setShowUserMenu(false)}>
                <div style={{ padding: '12px 14px', borderBottom: '0.5px solid #f1f4f9' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#111827' }}>{user?.name}</div>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>{user?.email}</div>
                  <div style={{ marginTop: 5 }}>
                    <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 4, background: roleColors[user?.role] + '20', color: roleColors[user?.role], fontWeight: 600, textTransform: 'capitalize' }}>
                      {user?.role?.replace('_', ' ')}
                    </span>
                  </div>
                </div>
                {hasPermission(user, 'manage_settings') && (
                  <button onClick={() => { setActiveNav('settings'); setShowUserMenu(false) }}
                    style={{ width: '100%', padding: '10px 14px', border: 'none', background: 'transparent', textAlign: 'left', fontSize: 12, color: '#374151', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <span>⚙️</span> Settings
                  </button>
                )}
                <button onClick={() => { setActiveNav('settings'); setShowUserMenu(false) }}
                  style={{ width: '100%', padding: '10px 14px', border: 'none', background: 'transparent', textAlign: 'left', fontSize: 12, color: '#374151', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <span>👤</span> My Profile
                </button>
                <div style={{ height: '0.5px', background: '#f1f4f9' }} />
                <button onClick={() => { logout(); setShowUserMenu(false) }}
                  style={{ width: '100%', padding: '10px 14px', border: 'none', background: 'transparent', textAlign: 'left', fontSize: 12, color: '#dc2626', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
                  onMouseEnter={e => e.currentTarget.style.background = '#fef2f2'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <span>🚪</span> Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Bottom Nav */}
      {isMobile && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, display: 'flex', borderTop: '0.5px solid #e5e7eb', background: '#fff', zIndex: 30 }}>
          {visibleNav.slice(0, 5).map(n => (
            <button key={n.key} onClick={() => setActiveNav(n.key)}
              style={{ flex: 1, padding: '8px 4px 10px', border: 'none', background: 'transparent', fontSize: 9, color: activeNav === n.key ? ACCENT : '#6b7280', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, fontWeight: activeNav === n.key ? 600 : 400 }}>
              <span style={{ fontSize: 18 }}>{n.icon}</span>
              {n.label}
            </button>
          ))}
        </div>
      )}
    </>
  )
}