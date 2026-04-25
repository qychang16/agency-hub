import { useState, useEffect, lazy, Suspense } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { WorkspaceProvider, useWorkspace } from './context/WorkspaceContext'
import Topbar from './components/layout/Topbar'
import { API } from './utils/constants'
import { ACCENT, NAVY } from './utils/designTokens'

// Lazy loaded components — loads only when navigated to
const InboxList = lazy(() => import('./components/inbox/InboxList'))
const ChatWindow = lazy(() => import('./components/inbox/ChatWindow'))
const ContactDrawer = lazy(() => import('./components/inbox/ContactDrawer'))
const GlobalSearch = lazy(() => import('./components/search/GlobalSearch'))
const NewContactModal = lazy(() => import('./components/inbox/NewContactModal'))
const Broadcasts = lazy(() => import('./components/broadcasts/Broadcasts'))
const Templates = lazy(() => import('./components/templates/Templates'))
const Analytics = lazy(() => import('./components/analytics/Analytics'))
const Projects = lazy(() => import('./components/projects/Projects'))
const Scheduled = lazy(() => import('./components/scheduled/Scheduled'))
const Settings = lazy(() => import('./components/settings/Settings'))
const Pipeline = lazy(() => import('./components/pipeline/Pipeline'))
const JobOrders = lazy(() => import('./components/jobs/JobOrders'))
const Contacts = lazy(() => import('./components/contacts/Contacts'))
const PDPA = lazy(() => import('./components/pdpa/PDPA'))
const AdminPanel = lazy(() => import('./components/admin/AdminPanel'))

// ─── LOGIN SCREEN ──────────────────────────────────────────────────────────────
function LoginScreen() {
  const { login } = useAuth()
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

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #1a2332 0%, #1e3a5f 60%, #1e40af 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <svg width="44" height="44" viewBox="0 0 34 34" fill="none">
              <rect width="34" height="34" rx="9" fill="rgba(255,255,255,0.1)"/>
              <circle cx="13" cy="17" r="6.5" stroke="#60a5fa" strokeWidth="1.8"/>
              <circle cx="21" cy="17" r="6.5" stroke="#fff" strokeWidth="1.8"/>
              <path d="M17 11.2c1.8 1.5 1.8 7.1 0 11.6" stroke="rgba(255,255,255,0.1)" strokeWidth="3.5"/>
              <path d="M17 11.2c-1.8 1.5-1.8 7.1 0 11.6" stroke="rgba(255,255,255,0.1)" strokeWidth="3.5"/>
              <path d="M17 11.2c1.8 1.5 1.8 7.1 0 11.6" stroke="#93c5fd" strokeWidth="1.2"/>
              <path d="M17 11.2c-1.8 1.5-1.8 7.1 0 11.6" stroke="#93c5fd" strokeWidth="1.2"/>
            </svg>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#fff', letterSpacing: '-0.5px' }}>Tel-Cloud</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '1.5px' }}>Recruitment Platform</div>
            </div>
          </div>
        </div>

        <div style={{ background: '#fff', borderRadius: 16, padding: '32px 28px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: '#111827', marginBottom: 4 }}>Welcome back</div>
          <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 24 }}>Sign in to your Tel-Cloud account</div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Email address</label>
            <div style={{ position: 'relative' }}>
              <input
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setEmailError('') }}
                onKeyDown={e => e.key === 'Enter' && validateAndLogin()}
                placeholder="you@company.com"
                style={{ width: '100%', padding: '10px 12px 10px 36px', border: `1.5px solid ${emailError ? '#ef4444' : '#e5e7eb'}`, borderRadius: 8, fontSize: 13, outline: 'none', background: '#f9fafb', color: '#111827', boxSizing: 'border-box', transition: 'border-color .2s' }}
                onFocus={e => e.target.style.borderColor = emailError ? '#ef4444' : '#2563eb'}
                onBlur={e => e.target.style.borderColor = emailError ? '#ef4444' : '#e5e7eb'}
              />
              <svg style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: '#9ca3af', pointerEvents: 'none' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
            </div>
            {emailError && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}><span>⚠</span> {emailError}</div>}
          </div>

          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Password</label>
              <button style={{ fontSize: 11, color: '#2563eb', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}>Forgot password?</button>
            </div>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => { setPassword(e.target.value); setPasswordError('') }}
                onKeyDown={e => e.key === 'Enter' && validateAndLogin()}
                placeholder="Enter your password"
                style={{ width: '100%', padding: '10px 40px 10px 36px', border: `1.5px solid ${passwordError ? '#ef4444' : '#e5e7eb'}`, borderRadius: 8, fontSize: 13, outline: 'none', background: '#f9fafb', color: '#111827', boxSizing: 'border-box', transition: 'border-color .2s' }}
                onFocus={e => e.target.style.borderColor = passwordError ? '#ef4444' : '#2563eb'}
                onBlur={e => e.target.style.borderColor = passwordError ? '#ef4444' : '#e5e7eb'}
              />
              <svg style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: '#9ca3af', pointerEvents: 'none' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 4, color: '#9ca3af', display: 'flex', alignItems: 'center' }}>
                {showPassword ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                )}
              </button>
            </div>
            {passwordError && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}><span>⚠</span> {passwordError}</div>}
          </div>

          {error && (
            <div style={{ marginBottom: 16, padding: '10px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 12, color: '#dc2626', display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> {error}
            </div>
          )}

          <button
            onClick={validateAndLogin}
            disabled={loading}
            style={{ width: '100%', padding: '11px', background: loading ? '#9ca3af' : 'linear-gradient(135deg, #2563eb, #1e40af)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: loading ? 'default' : 'pointer', letterSpacing: '0.3px', transition: 'opacity .2s' }}>
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
                Signing in…
              </span>
            ) : 'Sign in →'}
          </button>

          <div style={{ marginTop: 20, textAlign: 'center', fontSize: 11, color: '#9ca3af' }}>
            Powered by <strong style={{ color: '#374151' }}>Tel-Cloud</strong> · Recruitment Platform
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: 16, fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
          v2.0.0 · © 2026 Tel-Cloud
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        input::placeholder { color: #d1d5db }
      `}</style>
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
  const [activeConvoId, setActiveConvoId] = useState(null)
  const [showDrawer, setShowDrawer] = useState(false)
  const [showNewContact, setShowNewContact] = useState(false)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const [mobileView, setMobileView] = useState('inbox')
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
        case 'broadcasts': return <Broadcasts />
        case 'templates': return <Templates />
        case 'analytics': return <Analytics />
        case 'scheduled': return <Scheduled />
        case 'settings': return <Settings />
        case 'pipeline': return <Pipeline />
        case 'jobs': return <JobOrders />
        case 'contacts': return <Contacts />
        case 'pdpa': return <PDPA />
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
      <Suspense fallback={<PageLoader />}>
        <AdminPanel />
      </Suspense>
    )
  }
  return (
    <WorkspaceProvider>
      <MainApp />
    </WorkspaceProvider>
  )
}