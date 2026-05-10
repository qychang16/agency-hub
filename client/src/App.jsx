import { useState, useEffect, lazy, Suspense } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { GoogleLogin } from '@react-oauth/google'
import { WorkspaceProvider, useWorkspace } from './context/WorkspaceContext'
import Topbar from './components/layout/Topbar'
import { API } from './utils/constants'
import { ink, accent, fonts, textWeight, space, radius, border, shadow } from './utils/designTokens'

// Lazy loaded components — loads only when navigated to
const InboxList = lazy(() => import('./components/inbox/InboxList'))
const ChatWindow = lazy(() => import('./components/inbox/ChatWindow'))
const ContactDrawer = lazy(() => import('./components/inbox/ContactDrawer'))
const GlobalSearch = lazy(() => import('./components/search/GlobalSearch'))
const NewContactModal = lazy(() => import('./components/inbox/NewContactModal'))
const Broadcasts = lazy(() => import('./components/broadcasts/Broadcasts'))
const BroadcastDetail = lazy(() => import('./components/broadcasts/BroadcastDetail'))
const Templates = lazy(() => import('./components/templates/Templates'))
const Analytics = lazy(() => import('./components/analytics/Analytics'))
const Projects = lazy(() => import('./components/projects/Projects'))
const Scheduled = lazy(() => import('./components/scheduled/Scheduled'))
const Calendar = lazy(() => import('./components/calendar/Calendar'))
const Settings = lazy(() => import('./components/settings/Settings'))
const Pipeline = lazy(() => import('./components/pipeline/Pipeline'))
const JobOrders = lazy(() => import('./components/jobs/JobOrders'))
const Contacts = lazy(() => import('./components/contacts/Contacts'))
const AdminPanel = lazy(() => import('./components/admin/AdminPanel'))
import ImpersonationBanner from './components/layout/ImpersonationBanner'

// ─── LOGIN SCREEN ──────────────────────────────────────────────────────────────
function LoginScreen() {
  const { login, loginWithGoogle } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [emailError, setEmailError] = useState('')
  const [passwordError, setPasswordError] = useState('')

  function validateAndLogin() {
    let valid = true
    setEmailError(''); setPasswordError(''); setError('')
    if (!email.trim()) { setEmailError('Email is required'); valid = false }
    else if (!/\S+@\S+\.\S+/.test(email)) { setEmailError('Please enter a valid email'); valid = false }
    if (!password.trim()) { setPasswordError('Password is required'); valid = false }
    if (!valid) return
    handleLogin()
  }

  async function handleLogin() {
    setLoading(true)
    try {
      await login(email, password)
    } catch (e) {
      setError(e.message || 'Cannot connect to server.')
    }
    setLoading(false)
  }

  const inputStyle = (hasError) => ({
    width: '100%',
    padding: '10px 12px',
    border: `0.5px solid ${hasError ? '#8e2a2a' : ink[300]}`,
    borderRadius: radius.md,
    fontSize: '13px',
    fontFamily: fonts.body,
    outline: 'none',
    background: ink[50],
    color: ink[800],
    boxSizing: 'border-box',
    transition: 'border-color .15s, box-shadow .15s',
  })

  return (
    <div style={{
      minHeight: '100vh',
      background: ink[50],
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: space[4],
      fontFamily: fonts.body,
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: '-200px', left: '-200px', width: '500px', height: '500px', background: 'radial-gradient(circle, rgba(45,42,122,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '-200px', right: '-200px', width: '500px', height: '500px', background: 'radial-gradient(circle, rgba(45,42,122,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: 400, position: 'relative', zIndex: 1 }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: space[2], marginBottom: space[8] }}>
          <svg width="56" height="56" viewBox="0 0 34 34" fill="none" style={{ filter: 'drop-shadow(0 2px 6px rgba(10, 9, 7, 0.18))' }}>
            <defs>
              <radialGradient id="login-tc-indigo-ring" cx="11" cy="14" r="11" gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor="#8a87ff"/>
                <stop offset="0.5" stopColor="#3d3a9e"/>
                <stop offset="1" stopColor="#14134a"/>
              </radialGradient>
              <radialGradient id="login-tc-indigo-hl" cx="10" cy="13" r="4" gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor="#ffffff" stopOpacity="0.9"/>
                <stop offset="1" stopColor="#ffffff" stopOpacity="0"/>
              </radialGradient>
              <radialGradient id="login-tc-white-ring" cx="19" cy="14" r="11" gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor="#ffffff"/>
                <stop offset="0.5" stopColor="#b8b6cf"/>
                <stop offset="1" stopColor="#4a4760"/>
              </radialGradient>
              <radialGradient id="login-tc-white-hl" cx="18" cy="13" r="4" gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor="#ffffff" stopOpacity="1"/>
                <stop offset="1" stopColor="#ffffff" stopOpacity="0"/>
              </radialGradient>
            </defs>
            <circle cx="13" cy="17" r="6.5" stroke="url(#login-tc-indigo-ring)" strokeWidth="2.8" fill="none"/>
            <circle cx="13" cy="17" r="6.5" stroke="url(#login-tc-indigo-hl)" strokeWidth="2.8" fill="none"/>
            <circle cx="21" cy="17" r="6.5" stroke="url(#login-tc-white-ring)" strokeWidth="2.8" fill="none"/>
            <circle cx="21" cy="17" r="6.5" stroke="url(#login-tc-white-hl)" strokeWidth="2.8" fill="none"/>
          </svg>
          <span style={{
            fontFamily: fonts.display,
            fontSize: '24px',
            fontWeight: textWeight.bold,
            color: ink[900],
            letterSpacing: '-0.6px',
            lineHeight: 1,
          }}>Tel-Cloud</span>
        </div>

        <div style={{
          background: '#fff',
          borderRadius: radius.lg,
          padding: 'clamp(20px, 5vw, 32px) clamp(16px, 4vw, 28px)',
          border: `0.5px solid ${ink[300]}`,
          boxShadow: shadow.floating,
        }}>
          <div style={{
            fontFamily: fonts.display,
            fontSize: '20px',
            fontWeight: textWeight.semibold,
            color: ink[900],
            letterSpacing: '-0.3px',
            marginBottom: space[1],
          }}>Welcome back</div>
          <div style={{ fontSize: '13px', color: ink[600], marginBottom: space[6] }}>Sign in to your Tel-Cloud account</div>

          <div style={{ marginBottom: space[4] }}>
            <label style={{
              fontSize: '10px', fontWeight: textWeight.semibold, color: ink[700],
              display: 'block', marginBottom: space[1],
              textTransform: 'uppercase', letterSpacing: '1.2px',
            }}>Email address</label>
            <input
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setEmailError('') }}
              onKeyDown={e => e.key === 'Enter' && validateAndLogin()}
              placeholder="you@company.com"
              style={inputStyle(emailError)}
              onFocus={e => { e.target.style.borderColor = accent.DEFAULT; e.target.style.boxShadow = '0 0 0 3px rgba(45,42,122,0.08)' }}
              onBlur={e => { e.target.style.borderColor = emailError ? '#8e2a2a' : ink[300]; e.target.style.boxShadow = 'none' }}
            />
            {emailError && <div style={{ fontSize: '11px', color: '#8e2a2a', marginTop: space[1] }}>{emailError}</div>}
          </div>

          <div style={{ marginBottom: space[5] }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: space[1] }}>
              <label style={{
                fontSize: '10px', fontWeight: textWeight.semibold, color: ink[700],
                textTransform: 'uppercase', letterSpacing: '1.2px',
              }}>Password</label>
              <button style={{ fontSize: '11px', color: accent.DEFAULT, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, fontWeight: textWeight.medium }}>Forgot password?</button>
            </div>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => { setPassword(e.target.value); setPasswordError('') }}
                onKeyDown={e => e.key === 'Enter' && validateAndLogin()}
                placeholder="Enter your password"
                style={{ ...inputStyle(passwordError), paddingRight: '36px' }}
                onFocus={e => { e.target.style.borderColor = accent.DEFAULT; e.target.style.boxShadow = '0 0 0 3px rgba(45,42,122,0.08)' }}
                onBlur={e => { e.target.style.borderColor = passwordError ? '#8e2a2a' : ink[300]; e.target.style.boxShadow = 'none' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 4, color: ink[500], display: 'flex', alignItems: 'center' }}>
                {showPassword ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                )}
              </button>
            </div>
            {passwordError && <div style={{ fontSize: '11px', color: '#8e2a2a', marginTop: space[1] }}>{passwordError}</div>}
          </div>

          {error && (
            <div style={{
              marginBottom: space[4], padding: '10px 12px',
              background: '#f0dfdf', border: '0.5px solid #8e2a2a',
              borderRadius: radius.md, fontSize: '12px', color: '#8e2a2a',
            }}>{error}</div>
          )}

          <button
            onClick={validateAndLogin}
            disabled={loading}
            style={{
              width: '100%', padding: '11px',
              background: loading ? ink[400] : accent.DEFAULT,
              color: '#fff', border: 'none', borderRadius: radius.md,
              fontSize: '13px', fontWeight: textWeight.semibold,
              fontFamily: fonts.body,
              cursor: loading ? 'default' : 'pointer',
              letterSpacing: '0.2px',
              transition: 'background .15s',
            }}
            onMouseEnter={e => { if (!loading) e.target.style.background = accent.hover }}
            onMouseLeave={e => { if (!loading) e.target.style.background = accent.DEFAULT }}>
            {loading ? 'Signing in...' : 'Sign in'}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: space[2], margin: `${space[5]}px 0 ${space[3]}px` }}>
            <div style={{ flex: 1, height: 1, background: ink[200] }} />
            <span style={{ fontSize: '10px', color: ink[500], textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: textWeight.medium }}>or</span>
            <div style={{ flex: 1, height: 1, background: ink[200] }} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', overflow: 'hidden' }}>
            <GoogleLogin
              onSuccess={async (cred) => {
                setError(''); setEmailError(''); setPasswordError('')
                setLoading(true)
                try {
                  await loginWithGoogle(cred.credential)
                } catch (e) {
                  setError(e.message || 'Google sign-in failed')
                }
                setLoading(false)
              }}
              onError={() => setError('Google sign-in was cancelled or failed')}
              theme="outline"
              size="large"
              text="signin_with"
              shape="rectangular"
            />
          </div>
        </div>

        <div style={{
          textAlign: 'center', marginTop: space[5],
          fontSize: '11px', color: ink[500], letterSpacing: '0.2px',
        }}>
          v2.0.0 &middot; &copy; 2026 <strong style={{ color: ink[700], fontWeight: textWeight.semibold }}>Tel-Cloud</strong>
        </div>
      </div>
    </div>
  )
}

// ─── LOADING FALLBACK ──────────────────────────────────────────────────────────
function PageLoader() {
  // Only show the loader if the chunk takes >200ms to load. Most cached
  // chunks resolve in under 50ms — showing a loader for them just creates
  // a flash. Slow loads still get visible feedback.
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const id = setTimeout(() => setVisible(true), 200)
    return () => clearTimeout(id)
  }, [])
  if (!visible) return null
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#faf9f7' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#9a958c', fontSize: 13, fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'pageLoaderSpin 0.9s linear infinite' }}>
          <path d="M21 12a9 9 0 11-6.219-8.56" strokeLinecap="round"/>
        </svg>
        Loading
      </div>
      <style>{`@keyframes pageLoaderSpin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

// ─── MAINTENANCE MODAL ─────────────────────────────────────────────────────────
function MaintenanceModal({ onClose }) {
  const { maintenance, setMaintenance } = useWorkspace()
  const [maintDate, setMaintDate] = useState('')
  const [maintStartTime, setMaintStartTime] = useState('')
  const [maintEndTime, setMaintEndTime] = useState('')
  const [maintMessage, setMaintMessage] = useState('')

  function save() {
    if (!maintDate || !maintStartTime || !maintEndTime) return alert('Please set date, start time and end time.')
    const ds = new Date(maintDate + 'T' + maintStartTime)
    const de = new Date(maintDate + 'T' + maintEndTime)
    const dateStr = ds.toLocaleDateString('en-GB', { timeZone: 'Asia/Singapore', day: '2-digit', month: 'short', year: 'numeric' })
    const startStr = ds.toLocaleTimeString('en-GB', { timeZone: 'Asia/Singapore', hour: '2-digit', minute: '2-digit', hour12: false })
    const endStr = de.toLocaleTimeString('en-GB', { timeZone: 'Asia/Singapore', hour: '2-digit', minute: '2-digit', hour12: false })
    setMaintenance({ datetime: `${dateStr}, ${startStr} – ${endStr} SGT`, message: maintMessage || 'Scheduled maintenance window.' })
    onClose()
  }

  function clearMaintenance() {
    if (!confirm('Remove the maintenance banner? All users will stop seeing it.')) return
    setMaintenance(null)
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 14, padding: 24, width: '100%', maxWidth: 400 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 4 }}>Schedule Maintenance</div>
        <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 16 }}>
          {maintenance ? 'A maintenance window is currently scheduled. You can edit it below or clear it entirely.' : 'This banner will be visible to all users.'}
        </div>

        {maintenance && (
          <div style={{ marginBottom: 16, padding: '10px 12px', background: '#fde8e1', border: '0.5px solid #d14a2b', borderRadius: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#8e2a12', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Currently scheduled</div>
            <div style={{ fontSize: 12, color: '#8e2a12', lineHeight: 1.5 }}>{maintenance.datetime}</div>
            <div style={{ fontSize: 11, color: '#8e2a12', opacity: 0.85, lineHeight: 1.5 }}>{maintenance.message}</div>
          </div>
        )}

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
          <input type="text" value={maintMessage} onChange={e => setMaintMessage(e.target.value)}
            placeholder="e.g. System upgrade. Service may be intermittent."
            style={{ width: '100%', padding: '7px 10px', border: '0.5px solid #d1d5db', borderRadius: 7, fontSize: 12, outline: 'none', background: '#f9fafb', color: '#111827', boxSizing: 'border-box' }} />
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {maintenance && (
            <button onClick={clearMaintenance} style={{ flex: 1, padding: '8px', background: 'transparent', color: '#8e2a12', border: '0.5px solid #d14a2b', borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
              Clear maintenance
            </button>
          )}
          <button onClick={onClose} style={{ flex: 1, padding: '8px', border: '0.5px solid #d1d5db', borderRadius: 8, fontSize: 12, color: '#6b7280', background: 'transparent', cursor: 'pointer' }}>Cancel</button>
          <button onClick={save} style={{ flex: 1, padding: '8px', background: '#2d2a7a', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
            {maintenance ? 'Update' : 'Publish'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── MAIN APP ──────────────────────────────────────────────────────────────────
function MainApp() {
  const { user, token, isDirector } = useAuth()
  const { maintenance, setMaintenance } = useWorkspace()
  const [activeNav, setActiveNav] = useState(() => localStorage.getItem('activeNav') || 'inbox')
  useEffect(() => { localStorage.setItem('activeNav', activeNav) }, [activeNav])
  // Clear broadcast detail selection when navigating away from broadcasts page
  useEffect(() => {
    if (activeNav !== 'broadcasts') setSelectedBroadcastId(null)
  }, [activeNav])
  const [activeConvoId, setActiveConvoIdRaw] = useState(() => {
    const stored = localStorage.getItem('activeConvoId')
    return stored ? parseInt(stored) : null
  })
  // Wrap setter to persist to localStorage so a refresh keeps the open conversation
  const setActiveConvoId = (id) => {
    if (id === null || id === undefined) {
      localStorage.removeItem('activeConvoId')
    } else {
      localStorage.setItem('activeConvoId', String(id))
    }
    setActiveConvoIdRaw(id)
  }
  const [showDrawer, setShowDrawer] = useState(false)
  const [showNewContact, setShowNewContact] = useState(false)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const [mobileView, setMobileView] = useState('inbox')
  const [selectedBroadcastId, setSelectedBroadcastId] = useState(null)
  const [showMaintenanceEditor, setShowMaintenanceEditor] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  // When a search result is picked, we pass the message id down so ChatWindow
  // can scroll to it once the conversation loads
  const [jumpToMessageId, setJumpToMessageId] = useState(null)

  // Lifted state — shared between ChatWindow and ContactDrawer
  const [active, setActive] = useState(null)
  const [projects, setProjects] = useState([])

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Global Ctrl+K / ⌘K — open search overlay. Ignored while typing in inputs.
  useEffect(() => {
    function onKey(e) {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault()
        setShowSearch(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Preload heavy components during idle time after login.
  // By the time user clicks Settings/Projects/etc, the JS chunk is already cached.
  useEffect(() => {
    const preload = () => {
      import('./components/projects/Projects')
      import('./components/scheduled/Scheduled')
      import('./components/calendar/Calendar')
      import('./components/templates/Templates')
      import('./components/settings/Settings')
      import('./components/inbox/InboxList')
      import('./components/inbox/ChatWindow')
      import('./components/inbox/ContactDrawer')
    }
    if ('requestIdleCallback' in window) {
      const id = requestIdleCallback(preload)
      return () => cancelIdleCallback(id)
    } else {
      const id = setTimeout(preload, 1500)
      return () => clearTimeout(id)
    }
  }, [])

  // Load projects once — shared by ChatWindow (header dropdown) and ContactDrawer
  useEffect(() => {
    if (!token) return
    fetch(`${API}/projects`, { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.json())
      .then(data => setProjects(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [token])

  // Load the active conversation whenever it changes — single source of truth
  useEffect(() => {
    if (!activeConvoId || !token) { setActive(null); return }
    fetch(`${API}/conversations/${activeConvoId}`, { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.json())
      .then(setActive)
      .catch(() => {})
  }, [activeConvoId, token])

  // Handle a search-result pick: switch tabs to inbox, open the convo, tell
  // ChatWindow which message to scroll to
  function handleSearchSelect({ conversationId, messageId }) {
    setActiveNav('inbox')
    setActiveConvoId(conversationId)
    setJumpToMessageId(messageId)
    if (isMobile) setMobileView('chat')
  }

  function ComingSoon({ name }) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#faf9f7' }}>
        <div style={{ textAlign: 'center' }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#9a958c" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 12 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#374151', marginBottom: 6, textTransform: 'capitalize' }}>{name}</div>
          <div style={{ fontSize: 13, color: '#9ca3af' }}>Coming soon</div>
        </div>
      </div>
    )
  }

  function renderScreen() {
    const screen = (() => {
      switch (activeNav) {
        case 'inbox':
          return (
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
              <InboxList
                activeConvoId={activeConvoId}
                setActiveConvoId={setActiveConvoId}
                isMobile={isMobile}
                mobileView={mobileView}
                setMobileView={setMobileView}
              />
              <ChatWindow
                activeConvoId={activeConvoId}
                active={active}
                setActive={setActive}
                projects={projects}
                showDrawer={showDrawer}
                setShowDrawer={setShowDrawer}
                isMobile={isMobile}
                mobileView={mobileView}
                setMobileView={setMobileView}
                jumpToMessageId={jumpToMessageId}
                clearJumpToMessage={() => setJumpToMessageId(null)}
              />
              {showDrawer && (
                <ContactDrawer
                  activeConvoId={activeConvoId}
                  active={active}
                  setActive={setActive}
                  projects={projects}
                  isMobile={isMobile}
                  onClose={() => setShowDrawer(false)}
                />
              )}
            </div>
          )
        case 'projects': return <Projects />
        case 'broadcasts': return selectedBroadcastId
          ? <BroadcastDetail broadcastId={selectedBroadcastId} onBack={() => setSelectedBroadcastId(null)} />
          : <Broadcasts onOpen={(id) => setSelectedBroadcastId(id)} />
        case 'templates': return <Templates />
        case 'analytics': return <Analytics />
        case 'scheduled': return <Scheduled />
        case 'calendar': return <Calendar isMobile={isMobile} onOpenConversation={(convoId) => {
          setActiveNav('inbox')
          setActiveConvoId(convoId)
          if (isMobile) setMobileView('chat')
        }} />
        case 'settings': return <Settings />
        case 'pipeline': return <Pipeline />
        case 'jobs': return <JobOrders />
        case 'contacts': return <Contacts onNavigate={setActiveNav} />
        default: return <ComingSoon name={activeNav} />
      }
    })()

    return (
      <Suspense fallback={<PageLoader />}>
        {screen}
      </Suspense>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', minHeight: '100vh', fontFamily: 'system-ui,-apple-system,sans-serif', background: '#faf9f7', overflow: 'hidden' }}>
            <Topbar
        activeNav={activeNav}
        setActiveNav={setActiveNav}
        onNewContact={() => setShowNewContact(true)}
        isMobile={isMobile}
        showMaintenanceEditor={showMaintenanceEditor}
        setShowMaintenanceEditor={setShowMaintenanceEditor}
      />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {renderScreen()}
      </div>
      {showMaintenanceEditor && (
        <MaintenanceModal onClose={() => setShowMaintenanceEditor(false)} />
      )}
      {showSearch && (
        <Suspense fallback={null}>
          <GlobalSearch
            onClose={() => setShowSearch(false)}
            onSelect={handleSearchSelect}
          />
        </Suspense>
      )}
      {showNewContact && (
        <Suspense fallback={null}>
          <NewContactModal
            projects={projects}
            onClose={() => setShowNewContact(false)}
            onCreated={(convoId) => {
              setActiveNav('inbox')
              setActiveConvoId(convoId)
              if (isMobile) setMobileView('chat')
            }}
          />
        </Suspense>
      )}
    </div>
  )
}

// ─── ROOT ──────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <AuthProvider>
      <AppWithAuth />
    </AuthProvider>
  )
}

function AppWithAuth() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div style={{ minHeight: '100dvh', background: '#faf9f7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#9a958c" strokeWidth="2" strokeLinecap="round" style={{ marginBottom: 12, animation: 'spin 0.9s linear infinite' }}><path d="M21 12a9 9 0 11-6.219-8.56"/></svg>
          <div style={{ fontSize: 13, color: '#9ca3af' }}>Loading…</div>
        </div>
      </div>
    )
  }

  if (!user) return <LoginScreen />
  if (user.is_super_admin) {
    return (
      <>
        <ImpersonationBanner />
        <Suspense fallback={<PageLoader />}>
          <AdminPanel />
        </Suspense>
      </>
    )
  }
  return (
    <>
      <ImpersonationBanner />
      <WorkspaceProvider>
        <MainApp />
      </WorkspaceProvider>
    </>
  )
}