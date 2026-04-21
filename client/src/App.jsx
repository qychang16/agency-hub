import { useState, useEffect } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { WorkspaceProvider, useWorkspace } from './context/WorkspaceContext'
import Topbar from './components/layout/Topbar'
import InboxList from './components/inbox/InboxList'
import ChatWindow from './components/inbox/ChatWindow'
import ContactDrawer from './components/inbox/ContactDrawer'
import Broadcasts from './components/broadcasts/Broadcasts'
import Templates from './components/templates/Templates'
import Analytics from './components/analytics/Analytics'
import Scheduled from './components/scheduled/Scheduled'
import Settings from './components/settings/Settings'
import Pipeline from './components/pipeline/Pipeline'
import JobOrders from './components/jobs/JobOrders'
import Contacts from './components/contacts/Contacts'
import PDPA from './components/pdpa/PDPA'
import { ACCENT, NAVY } from './utils/constants'
import { hasPermission } from './utils/permissions'

function LoginScreen() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin() {
    setError(''); setLoading(true)
    try {
      await login(email, password)
    } catch(e) {
      setError(e.message || 'Cannot connect to server.')
    }
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f1f4f9', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 16, border: '0.5px solid #e5e7eb', padding: '40px 32px', width: '100%', maxWidth: 380 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <svg width="34" height="34" viewBox="0 0 34 34" fill="none">
            <rect width="34" height="34" rx="9" fill="#1e3a5f"/>
            <circle cx="13" cy="17" r="6.5" stroke="#60a5fa" strokeWidth="1.8"/>
            <circle cx="21" cy="17" r="6.5" stroke="#fff" strokeWidth="1.8"/>
            <path d="M17 11.2c1.8 1.5 1.8 7.1 0 11.6" stroke="#1e3a5f" strokeWidth="3.5"/>
            <path d="M17 11.2c-1.8 1.5-1.8 7.1 0 11.6" stroke="#1e3a5f" strokeWidth="3.5"/>
            <path d="M17 11.2c1.8 1.5 1.8 7.1 0 11.6" stroke="#93c5fd" strokeWidth="1.2"/>
            <path d="M17 11.2c-1.8 1.5-1.8 7.1 0 11.6" stroke="#93c5fd" strokeWidth="1.2"/>
          </svg>
          <div>
            <div style={{ fontSize: 16, fontWeight: 500, color: '#111827' }}>Agency Hub</div>
            <div style={{ fontSize: 10, color: '#9ca3af', letterSpacing: '0.4px', textTransform: 'uppercase' }}>recruitment platform</div>
          </div>
        </div>
        <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 24, marginTop: 8 }}>Sign in to your account</div>
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 4 }}>Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()} placeholder="you@agencyhub.com"
            style={{ width: '100%', padding: '9px 12px', border: '0.5px solid #d1d5db', borderRadius: 8, fontSize: 13, outline: 'none', background: '#f9fafb', color: '#111827', boxSizing: 'border-box' }} />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 4 }}>Password</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()} placeholder="Enter your password"
            style={{ width: '100%', padding: '9px 12px', border: '0.5px solid #d1d5db', borderRadius: 8, fontSize: 13, outline: 'none', background: '#f9fafb', color: '#111827', boxSizing: 'border-box' }} />
        </div>
        {error && <div style={{ fontSize: 11, color: '#ef4444', marginBottom: 12 }}>{error}</div>}
        <button onClick={handleLogin} disabled={loading}
          style={{ width: '100%', padding: '10px', background: loading ? '#9ca3af' : ACCENT, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: loading ? 'default' : 'pointer' }}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <button style={{ fontSize: 11, color: ACCENT, background: 'transparent', border: 'none', cursor: 'pointer' }}>
            Forgot password?
          </button>
        </div>
      </div>
    </div>
  )
}

function MainApp() {
  const { user, isDirector } = useAuth()
  const { maintenance, setMaintenance, setShowMaintenanceEditor } = useWorkspace()
  const [activeNav, setActiveNav] = useState('inbox')
  const [activeConvoId, setActiveConvoId] = useState(null)
  const [showDrawer, setShowDrawer] = useState(false)
  const [showNewContact, setShowNewContact] = useState(false)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const [mobileView, setMobileView] = useState('inbox')
  const [showMaintenanceEditor, setShowMaintenanceEditorLocal] = useState(false)

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  function ComingSoon({ name }) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f4f9' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🚧</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#374151', marginBottom: 6, textTransform: 'capitalize' }}>{name}</div>
          <div style={{ fontSize: 13, color: '#9ca3af' }}>Coming soon</div>
        </div>
      </div>
    )
  }

  function renderScreen() {
    switch(activeNav) {
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
              showDrawer={showDrawer}
              setShowDrawer={setShowDrawer}
              isMobile={isMobile}
              mobileView={mobileView}
              setMobileView={setMobileView}
            />
            {showDrawer && (
              <ContactDrawer
                activeConvoId={activeConvoId}
                isMobile={isMobile}
                onClose={() => setShowDrawer(false)}
              />
            )}
          </div>
        )
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
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: 'system-ui,-apple-system,sans-serif', background: '#f1f4f9', overflow: 'hidden' }}>
      <Topbar
        activeNav={activeNav}
        setActiveNav={setActiveNav}
        onNewContact={() => setShowNewContact(true)}
        isMobile={isMobile}
      />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {renderScreen()}
      </div>

      {/* Maintenance Editor Modal */}
      {showMaintenanceEditor && (
        <MaintenanceModal onClose={() => setShowMaintenanceEditorLocal(false)} />
      )}
    </div>
  )
}

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

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 14, padding: 24, width: '100%', maxWidth: 400 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 4 }}>⚠️ Schedule Maintenance</div>
        <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 16 }}>This banner will be visible to all users.</div>
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
          <input type="text" value={maintMessage} onChange={e => setMaintMessage(e.target.value)} placeholder="e.g. System upgrade. Service may be intermittent."
            style={{ width: '100%', padding: '7px 10px', border: '0.5px solid #d1d5db', borderRadius: 7, fontSize: 12, outline: 'none', background: '#f9fafb', color: '#111827', boxSizing: 'border-box' }} />
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '8px', border: '0.5px solid #d1d5db', borderRadius: 8, fontSize: 12, color: '#6b7280', background: 'transparent', cursor: 'pointer' }}>Cancel</button>
          <button onClick={save} style={{ flex: 1, padding: '8px', background: '#92400e', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>Publish Banner</button>
        </div>
      </div>
    </div>
  )
}

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
      <div style={{ minHeight: '100vh', background: '#f1f4f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⚙️</div>
          <div style={{ fontSize: 13, color: '#9ca3af' }}>Loading…</div>
        </div>
      </div>
    )
  }

  if (!user) return <LoginScreen />

  return (
    <WorkspaceProvider>
      <MainApp />
    </WorkspaceProvider>
  )
}