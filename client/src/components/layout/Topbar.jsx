import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useWorkspace } from '../../context/WorkspaceContext'
import { ink, accent, semantic, fonts, textSize, textWeight, space, radius, border, shadow } from '../../utils/designTokens'

const NAV_ITEMS = [
  { key: 'inbox',       label: 'Inbox' },
  { key: 'projects',    label: 'Projects' },
  { key: 'scheduled',   label: 'Scheduled' },
  { key: 'broadcasts',  label: 'Broadcasts' },
  { key: 'templates',   label: 'Templates' },
  { key: 'analytics',   label: 'Analytics' },
  { key: 'pipeline',    label: 'Pipeline' },
  { key: 'contacts',    label: 'Contacts' },
  { key: 'pdpa',        label: 'PDPA' },
  { key: 'settings',    label: 'Settings' },
]

function Logo() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: space[2], flexShrink: 0 }}>
      {/* Floating 3D chrome rings — no container */}
      <svg width="46" height="46" viewBox="0 0 34 34" fill="none" style={{ filter: 'drop-shadow(0 2px 5px rgba(10, 9, 7, 0.2))' }}>
        <defs>
          <radialGradient id="tc-indigo-ring" cx="11" cy="14" r="11" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#8a87ff"/>
            <stop offset="0.5" stopColor="#3d3a9e"/>
            <stop offset="1" stopColor="#14134a"/>
          </radialGradient>
          <radialGradient id="tc-indigo-hl" cx="10" cy="13" r="4" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.9"/>
            <stop offset="1" stopColor="#ffffff" stopOpacity="0"/>
          </radialGradient>
          <radialGradient id="tc-white-ring" cx="19" cy="14" r="11" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#ffffff"/>
            <stop offset="0.5" stopColor="#b8b6cf"/>
            <stop offset="1" stopColor="#4a4760"/>
          </radialGradient>
          <radialGradient id="tc-white-hl" cx="18" cy="13" r="4" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#ffffff" stopOpacity="1"/>
            <stop offset="1" stopColor="#ffffff" stopOpacity="0"/>
          </radialGradient>
        </defs>
        <circle cx="13" cy="17" r="6.5" stroke="url(#tc-indigo-ring)" strokeWidth="2.8" fill="none"/>
        <circle cx="13" cy="17" r="6.5" stroke="url(#tc-indigo-hl)" strokeWidth="2.8" fill="none"/>
        <circle cx="21" cy="17" r="6.5" stroke="url(#tc-white-ring)" strokeWidth="2.8" fill="none"/>
        <circle cx="21" cy="17" r="6.5" stroke="url(#tc-white-hl)" strokeWidth="2.8" fill="none"/>
      </svg>
      <span style={{
        fontFamily: fonts.display,
        fontSize: '18px',
        fontWeight: textWeight.bold,
        color: ink[900],
        letterSpacing: '-0.5px',
        lineHeight: 1,
      }}>Tel-Cloud</span>
    </div>
  )
}

function NavTab({ label, active, onClick }) {
  const [hover, setHover] = useState(false)
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative',
        padding: `${space[2] + 2}px ${space[3]}px`,
        background: active ? ink[100] : hover ? ink[100] : 'transparent',
        border: 'none',
        borderRadius: radius.md,
        fontSize: textSize.sm,
        fontWeight: active ? textWeight.semibold : textWeight.medium,
        color: active ? ink[900] : hover ? ink[900] : ink[600],
        cursor: 'pointer',
        fontFamily: fonts.body,
        letterSpacing: '0.1px',
        transition: 'background 0.08s, color 0.08s',
      }}>
      {label}
      {active && (
        <span style={{
          position: 'absolute',
          left: space[3],
          right: space[3],
          bottom: -1,
          height: 2,
          background: accent.DEFAULT,
          borderRadius: 2,
        }} />
      )}
    </button>
  )
}

function MaintenanceIndicator({ onClick, maintenance }) {
  return (
    <button onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: space[1] + 2,
        padding: `${space[1] + 2}px ${space[2] + 2}px`,
        background: maintenance ? '#fde8e1' : 'transparent',
        border: `0.5px solid ${maintenance ? '#d14a2b' : ink[300]}`,
        borderRadius: radius.md,
        cursor: 'pointer',
        fontSize: textSize.xs,
        fontWeight: textWeight.semibold,
        color: maintenance ? '#8e2a12' : ink[600],
        fontFamily: fonts.body,
        letterSpacing: '0.2px',
      }}>
      <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M8 2l6.5 11.5h-13L8 2z" strokeLinejoin="round"/>
        <path d="M8 6v3" strokeLinecap="round"/>
        <circle cx="8" cy="11.5" r="0.5" fill="currentColor"/>
      </svg>
      {maintenance ? 'Maintenance active' : 'Maintenance'}
    </button>
  )
}

function NewButton({ onClick }) {
  const [hover, setHover] = useState(false)
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: space[1] + 2,
        padding: `${space[1] + 2}px ${space[3]}px ${space[1] + 2}px ${space[2] + 2}px`,
        background: hover ? accent.hover : accent.DEFAULT,
        border: 'none',
        borderRadius: radius.md,
        cursor: 'pointer',
        fontSize: textSize.xs,
        fontWeight: textWeight.semibold,
        color: '#fff',
        fontFamily: fonts.body,
        letterSpacing: '0.3px',
        transition: 'background 0.12s',
      }}>
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <line x1="6" y1="1.5" x2="6" y2="10.5"/>
        <line x1="1.5" y1="6" x2="10.5" y2="6"/>
      </svg>
      New
    </button>
  )
}

function UserMenu() {
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  const initials = (user?.name || 'User').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  const role = user?.role || 'Member'

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(!open)}
        style={{
          display: 'flex', alignItems: 'center', gap: space[2],
          padding: `${space[1]}px ${space[1] + 2}px ${space[1]}px ${space[1]}px`,
          background: open ? ink[100] : 'transparent',
          border: `0.5px solid ${ink[300]}`,
          borderRadius: radius.md,
          cursor: 'pointer',
          fontFamily: fonts.body,
        }}>
        <div style={{
          width: 26, height: 26, borderRadius: radius.pill,
          background: accent.DEFAULT,
          color: '#fff',
          fontSize: 10, fontWeight: textWeight.bold,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>{initials}</div>
        <div style={{ textAlign: 'left', marginRight: space[1] }}>
          <div style={{ fontSize: textSize.xs, fontWeight: textWeight.semibold, color: ink[900], lineHeight: 1.1 }}>
            {user?.name || 'User'}
          </div>
          <div style={{ fontSize: 9, color: ink[600], lineHeight: 1.1, textTransform: 'capitalize', marginTop: 1 }}>
            {role}
          </div>
        </div>
        <svg width="9" height="9" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: ink[600] }}>
          <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', right: 0,
          minWidth: 200,
          background: '#fff',
          border: border.subtle,
          borderRadius: radius.md,
          boxShadow: shadow.floating,
          overflow: 'hidden',
          zIndex: 50,
        }}>
          <div style={{ padding: `${space[3]}px ${space[3]}px ${space[2]}px`, borderBottom: border.subtle }}>
            <div style={{ fontSize: textSize.xs, fontWeight: textWeight.semibold, color: ink[900] }}>{user?.name}</div>
            <div style={{ fontSize: 10, color: ink[600], marginTop: 1 }}>{user?.email}</div>
          </div>
          <button onClick={() => { setOpen(false); alert('Profile screen coming soon.') }}
            style={{
              width: '100%', textAlign: 'left',
              padding: `${space[2]}px ${space[3]}px`,
              background: 'transparent', border: 'none',
              fontSize: textSize.xs, color: ink[800],
              cursor: 'pointer',
              fontFamily: fonts.body, fontWeight: textWeight.medium,
            }}
            onMouseEnter={e => e.currentTarget.style.background = ink[100]}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            Profile &amp; preferences
          </button>
          <button onClick={() => { setOpen(false); alert('Help coming soon.') }}
            style={{
              width: '100%', textAlign: 'left',
              padding: `${space[2]}px ${space[3]}px`,
              background: 'transparent', border: 'none',
              fontSize: textSize.xs, color: ink[800],
              cursor: 'pointer',
              fontFamily: fonts.body, fontWeight: textWeight.medium,
            }}
            onMouseEnter={e => e.currentTarget.style.background = ink[100]}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            Help &amp; shortcuts
          </button>
          <div style={{ borderTop: border.subtle }} />
          <button onClick={() => { setOpen(false); logout() }}
            style={{
              width: '100%', textAlign: 'left',
              padding: `${space[2]}px ${space[3]}px`,
              background: 'transparent', border: 'none',
              fontSize: textSize.xs, color: semantic.danger,
              cursor: 'pointer',
              fontFamily: fonts.body, fontWeight: textWeight.medium,
            }}
            onMouseEnter={e => e.currentTarget.style.background = semantic.dangerSoft}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}

function MobileNav({ activeNav, setActiveNav, open, onClose }) {
  if (!open) return null
  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(10, 9, 7, 0.4)', zIndex: 40,
      }} />
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 260, background: '#fff',
        boxShadow: shadow.overlay,
        zIndex: 41,
        padding: space[4],
        display: 'flex', flexDirection: 'column', gap: space[1],
      }}>
        <div style={{ marginBottom: space[3], paddingBottom: space[3], borderBottom: border.subtle }}>
          <Logo />
        </div>
        {NAV_ITEMS.map(item => (
          <button key={item.key}
            onClick={() => { setActiveNav(item.key); onClose() }}
            style={{
              padding: `${space[2] + 2}px ${space[3]}px`,
              background: activeNav === item.key ? ink[100] : 'transparent',
              border: 'none',
              borderRadius: radius.md,
              fontSize: textSize.sm,
              fontWeight: activeNav === item.key ? textWeight.semibold : textWeight.medium,
              color: activeNav === item.key ? accent.DEFAULT : ink[700],
              cursor: 'pointer',
              textAlign: 'left',
              fontFamily: fonts.body,
              borderLeft: activeNav === item.key ? `2px solid ${accent.DEFAULT}` : '2px solid transparent',
            }}>
            {item.label}
          </button>
        ))}
      </div>
    </>
  )
}

export default function Topbar({ activeNav, setActiveNav, onNewContact, isMobile, showMaintenanceEditor, setShowMaintenanceEditor }) {
  const { isDirector, hasPermission } = useAuth()
  const { maintenance } = useWorkspace()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <>
      <style>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>
      {/* Maintenance banner (when active) — sits above topbar */}
      {maintenance && (
        <div style={{
          padding: `${space[1] + 2}px ${space[4]}px`,
          background: semantic.warningSoft,
          borderBottom: `0.5px solid ${semantic.warning}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: space[2],
          fontSize: textSize.xs,
          fontFamily: fonts.body,
          color: semantic.warning,
          flexShrink: 0,
        }}>
          <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M8 2l6.5 11.5h-13L8 2z" strokeLinejoin="round"/>
            <path d="M8 6v3" strokeLinecap="round"/>
            <circle cx="8" cy="11.5" r="0.5" fill="currentColor"/>
          </svg>
          <span style={{ fontWeight: textWeight.semibold }}>Scheduled maintenance:</span>
          <span>{maintenance.datetime}</span>
          <span style={{ opacity: 0.8 }}>· {maintenance.message}</span>
        </div>
      )}

      <div style={{
        display: 'flex', alignItems: 'center',
        padding: `${space[2]}px ${space[4]}px`,
        background: '#fff',
        borderBottom: border.subtle,
        flexShrink: 0,
        height: 52,
        boxSizing: 'border-box',
        gap: space[4],
        fontFamily: fonts.body,
      }}>
        {/* Left: Logo */}
        <Logo />

        {/* Middle: Nav tabs (desktop) — scrollable if too many */}
        {!isMobile && (
          <div style={{
            display: 'flex', alignItems: 'center',
            gap: space[1],
            flex: 1,
            overflowX: 'auto',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
            className="hide-scrollbar">
            {NAV_ITEMS.map(item => (
              <NavTab key={item.key}
                label={item.label}
                active={activeNav === item.key}
                onClick={() => setActiveNav(item.key)} />
            ))}
          </div>
        )}

        {/* Spacer on mobile */}
        {isMobile && <div style={{ flex: 1 }} />}

        {/* Right: Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: space[2], flexShrink: 0 }}>
          {isDirector && !isMobile && (
            <MaintenanceIndicator
              maintenance={maintenance}
              onClick={() => setShowMaintenanceEditor(true)} />
          )}
          {!isMobile && hasPermission('manage_contacts') && <NewButton onClick={onNewContact} />}
          {!isMobile && <UserMenu />}

          {/* Mobile: hamburger */}
          {isMobile && (
            <button onClick={() => setMobileOpen(true)}
              style={{
                width: 32, height: 32,
                border: `0.5px solid ${ink[300]}`,
                borderRadius: radius.md,
                background: 'transparent',
                cursor: 'pointer',
                color: ink[700],
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M2 4h12M2 8h12M2 12h12" strokeLinecap="round"/>
              </svg>
            </button>
          )}
        </div>
      </div>

      <MobileNav
        activeNav={activeNav}
        setActiveNav={setActiveNav}
        open={mobileOpen}
        onClose={() => setMobileOpen(false)} />
    </>
  )
}