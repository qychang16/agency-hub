import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../../context/AuthContext'
import { API } from '../../utils/constants'
import { ACCENT, ACCENT_LIGHT, NAVY } from '../../utils/designTokens'
import Button from '../ui/Button'

// Stages match the canonical pipeline used in Contacts.jsx and the contacts table.
// Column accent colors signal funnel position: blue/grey for early stages,
// indigo for active engagement, green for success, red for end-of-line.
const STAGES = [
  { key: 'new',          label: 'New',          accent: '#9a958c', desc: 'Just added, not yet contacted' },
  { key: 'contacted',    label: 'Contacted',    accent: '#2d2a7a', desc: 'Reached out, awaiting reply' },
  { key: 'screened',     label: 'Screened',     accent: '#5b21b6', desc: 'Initial screen done' },
  { key: 'shortlisted',  label: 'Shortlisted',  accent: '#7c3aed', desc: 'Looks promising' },
  { key: 'interviewing', label: 'Interviewing', accent: ACCENT,    desc: 'Active interview process' },
  { key: 'offered',      label: 'Offered',      accent: '#0891b2', desc: 'Offer extended' },
  { key: 'hired',        label: 'Hired',        accent: '#16a34a', desc: 'Placement closed' },
  { key: 'rejected',     label: 'Rejected',     accent: '#dc2626', desc: 'Not moving forward' },
]

const TYPE_FILTERS = [
  { key: 'all',       label: 'All' },
  { key: 'candidate', label: 'Candidates' },
  { key: 'client',    label: 'Clients' },
]

function fmtTs(ts) {
  if (!ts) return '\u2014'
  return new Date(ts).toLocaleDateString('en-SG', { month: 'short', day: '2-digit' })
}

// ─────────────────────────────────────────────────────────────
// Card for one contact in a pipeline column.
// Stage change happens via the dropdown — no drag.
// ─────────────────────────────────────────────────────────────
function PipelineCard({ contact, canManage, onStageChange, isUpdating }) {
  const [pendingStage, setPendingStage] = useState(null)

  function handleStageChange(newStage) {
    if (newStage === contact.pipeline_stage) return
    setPendingStage(newStage)
    onStageChange(contact, newStage, () => setPendingStage(null))
  }

  const showingStage = pendingStage || contact.pipeline_stage

  return (
    <div style={{
      background: '#fff', borderRadius: 8, border: '0.5px solid #dcd8d0',
      padding: '10px 12px', marginBottom: 8,
      opacity: isUpdating ? 0.6 : 1,
      transition: 'opacity .15s'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <div style={{
          width: 26, height: 26, borderRadius: 6, background: '#faf9f7',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 600, color: '#6e6a63', flexShrink: 0
        }}>
          {(contact.name || '?').slice(0, 1).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#14130f', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {contact.name || '(no name)'}
          </div>
          {contact.candidate_role && (
            <div style={{ fontSize: 10, color: '#9a958c', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {contact.candidate_role}
            </div>
          )}
        </div>
      </div>
      {(contact.current_company || contact.phone) && (
        <div style={{ fontSize: 10, color: '#9a958c', marginBottom: 6, paddingLeft: 34, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {contact.current_company || contact.phone}
        </div>
      )}
      {(contact.dnc || contact.opted_out) && (
        <div style={{ display: 'flex', gap: 4, marginBottom: 6, paddingLeft: 34 }}>
          {contact.dnc && <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 5, background: '#fee2e2', color: '#dc2626', fontWeight: 600 }}>DNC</span>}
          {contact.opted_out && <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 5, background: '#fff7ed', color: '#9a6a00', fontWeight: 600 }}>OPTED OUT</span>}
        </div>
      )}
      {canManage ? (
        <select
          value={showingStage}
          onChange={e => handleStageChange(e.target.value)}
          disabled={isUpdating}
          style={{
            width: '100%', padding: '4px 8px', fontSize: 11,
            border: '0.5px solid #dcd8d0', borderRadius: 6,
            background: '#faf9f7', color: '#14130f',
            cursor: isUpdating ? 'default' : 'pointer'
          }}>
          {STAGES.map(s => (
            <option key={s.key} value={s.key}>Move to: {s.label}</option>
          ))}
        </select>
      ) : (
        <div style={{ fontSize: 10, color: '#9a958c', paddingLeft: 34 }}>
          Updated {fmtTs(contact.updated_at)}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// One column of the kanban board.
// ─────────────────────────────────────────────────────────────
function PipelineColumn({ stage, contacts, canManage, onStageChange, updatingId }) {
  return (
    <div style={{
      flex: '0 0 280px', display: 'flex', flexDirection: 'column',
      background: '#faf9f7', borderRadius: 10,
      border: '0.5px solid #dcd8d0', padding: 12,
      maxHeight: '100%', overflow: 'hidden'
    }}>
      {/* Column header */}
      <div style={{ flexShrink: 0, marginBottom: 10, paddingBottom: 8, borderBottom: '0.5px solid #f5f3ef' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: stage.accent }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: '#14130f' }}>{stage.label}</span>
          </div>
          <span style={{ fontSize: 11, padding: '1px 8px', borderRadius: 10, background: '#fff', color: '#6e6a63', fontWeight: 600, border: '0.5px solid #dcd8d0' }}>
            {contacts.length}
          </span>
        </div>
        <div style={{ fontSize: 10, color: '#9a958c' }}>{stage.desc}</div>
      </div>

      {/* Card list */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {contacts.length === 0 ? (
          <div style={{ fontSize: 11, color: '#9a958c', textAlign: 'center', padding: '24px 8px', fontStyle: 'italic' }}>
            No contacts in this stage
          </div>
        ) : (
          contacts.map(c => (
            <PipelineCard
              key={c.id}
              contact={c}
              canManage={canManage}
              onStageChange={onStageChange}
              isUpdating={updatingId === c.id}
            />
          ))
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────
export default function Pipeline() {
  const { token, user, hasPermission } = useAuth()
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [updatingId, setUpdatingId] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => { if (!token) return; load() }, [token])

  async function load() {
    try {
      const r = await fetch(`${API}/contacts`, { headers: { Authorization: 'Bearer ' + token } })
      const data = await r.json()
      setContacts(Array.isArray(data) ? data : [])
    } catch {} finally { setLoading(false) }
  }

  // Update a single contact's pipeline_stage. Optimistic update — local state
  // changes immediately, then we PATCH; on failure we revert and show error.
  async function changeStage(contact, newStage, onComplete) {
    setError('')
    setUpdatingId(contact.id)
    const previousStage = contact.pipeline_stage

    // Optimistic local update — feels instant
    setContacts(prev => prev.map(c => c.id === contact.id ? { ...c, pipeline_stage: newStage } : c))

    try {
      // Build the full PATCH payload from current contact + new stage.
      // PATCH endpoint expects all fields, not partial — that's a backend
      // convention worth noting (could be improved server-side later).
      const payload = {
        name: contact.name,
        phone: contact.phone,
        email: contact.email,
        type: contact.type,
        pipeline_stage: newStage,
        pdpa_consented: contact.pdpa_consented,
        dnc: contact.dnc,
        dnc_reason: contact.dnc_reason,
        opted_out: contact.opted_out,
        tags: contact.tags || [],
        notes: contact.notes,
        expected_salary: contact.expected_salary,
        notice_period: contact.notice_period,
        linkedin_url: contact.linkedin_url,
        current_role: contact.candidate_role,
        current_company: contact.current_company,
      }
      const r = await fetch(`${API}/contacts/${contact.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify(payload),
      })
      if (!r.ok) {
        const d = await r.json()
        // Revert optimistic update
        setContacts(prev => prev.map(c => c.id === contact.id ? { ...c, pipeline_stage: previousStage } : c))
        setError(d.error || 'Failed to update stage')
      }
    } catch (err) {
      setContacts(prev => prev.map(c => c.id === contact.id ? { ...c, pipeline_stage: previousStage } : c))
      setError('Failed to update: ' + err.message)
    } finally {
      setUpdatingId(null)
      if (onComplete) onComplete()
    }
  }

  const canManage = hasPermission('manage_contacts')

  // Apply filters once, then group by stage
  const filtered = useMemo(() => {
    return contacts.filter(c => {
      if (typeFilter !== 'all' && c.type !== typeFilter) return false
      if (search) {
        const s = search.toLowerCase()
        if (!c.name?.toLowerCase().includes(s) &&
            !c.phone?.toLowerCase().includes(s) &&
            !c.email?.toLowerCase().includes(s) &&
            !c.candidate_role?.toLowerCase().includes(s) &&
            !c.current_company?.toLowerCase().includes(s)) return false
      }
      return true
    })
  }, [contacts, typeFilter, search])

  const byStage = useMemo(() => {
    const groups = {}
    STAGES.forEach(s => { groups[s.key] = [] })
    filtered.forEach(c => {
      const key = c.pipeline_stage && groups[c.pipeline_stage] ? c.pipeline_stage : 'new'
      groups[key].push(c)
    })
    // Sort within each column by most recently updated
    Object.values(groups).forEach(arr => {
      arr.sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0))
    })
    return groups
  }, [filtered])

  // Funnel stats: how many active, how many converted
  const totalActive = filtered.filter(c => !['hired', 'rejected'].includes(c.pipeline_stage)).length
  const totalHired = filtered.filter(c => c.pipeline_stage === 'hired').length
  const totalRejected = filtered.filter(c => c.pipeline_stage === 'rejected').length
  const totalInterviewing = (byStage.interviewing?.length || 0) + (byStage.offered?.length || 0)

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#faf9f7' }}>
      {/* Header */}
      <div className="px-4 pt-5 pb-4 md:px-7 md:pt-6" style={{ flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 14, marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#14130f', marginBottom: 4, letterSpacing: '-0.3px' }}>Pipeline</div>
            <div style={{ fontSize: 12, color: '#6e6a63' }}>
              {totalActive} active {'\u00b7'} {totalInterviewing} interviewing or offered {'\u00b7'} {totalHired} hired
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          {[
            { label: 'Total Active', value: totalActive,         color: totalActive === 0 ? '#9a958c' : '#14130f' },
            { label: 'New',          value: byStage.new?.length || 0, color: '#9a958c' },
            { label: 'Interviewing', value: totalInterviewing,   color: totalInterviewing === 0 ? '#9a958c' : '#2d2a7a' },
            { label: 'Hired',        value: totalHired,          color: totalHired === 0 ? '#9a958c' : '#2d6a4f' },
          ].map(s => (
            <div key={s.label} style={{ background: '#fff', borderRadius: 8, padding: '12px 14px', border: '0.5px solid #dcd8d0' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: s.color, letterSpacing: '-0.3px' }}>{s.value}</div>
              <div style={{ fontSize: 10, color: '#6e6a63', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 500 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Filter row */}
      <div className="px-4 md:px-7 py-3 gap-3 md:gap-4" style={{ background: '#fff', borderBottom: '0.5px solid #dcd8d0', display: 'flex', alignItems: 'center', flexWrap: 'wrap', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {TYPE_FILTERS.map(f => (
            <button key={f.key} onClick={() => setTypeFilter(f.key)}
              style={{ padding: '5px 12px', borderRadius: 7, border: 'none',
                background: typeFilter === f.key ? ACCENT : 'transparent',
                color: typeFilter === f.key ? '#fff' : '#6e6a63',
                fontSize: 12, cursor: 'pointer',
                fontWeight: typeFilter === f.key ? 600 : 400 }}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="w-full md:w-auto md:ml-auto" style={{ position: 'relative' }}>
          <svg style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', width: 12, height: 12, color: '#9a958c', pointerEvents: 'none' }} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="7" cy="7" r="4"/>
            <path d="M10.5 10.5l3 3" strokeLinecap="round"/>
          </svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={`Search name, role, company${'\u2026'}`}
            className="w-full md:w-[260px]"
            style={{ padding: '6px 10px 6px 26px', border: '0.5px solid #dcd8d0', borderRadius: 8, fontSize: 12, outline: 'none', background: '#faf9f7', color: '#14130f', boxSizing: 'border-box' }} />
        </div>
        <Button variant="secondary" size="sm" onClick={load}>Refresh</Button>
      </div>

      {/* Error banner */}
      {error && (
        <div style={{ padding: '10px 14px', background: '#fef2f2', borderBottom: '0.5px solid #fecaca', fontSize: 12, color: '#dc2626', flexShrink: 0 }}>
          {error}
        </div>
      )}

      {/* Kanban board */}
      <div className="px-4 md:px-7" style={{ flex: 1, overflow: 'auto', paddingTop: 16, paddingBottom: 16 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#9a958c', fontSize: 13 }}>
            Loading pipeline{'\u2026'}
          </div>
        ) : contacts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#4a4742', marginBottom: 6 }}>No contacts in pipeline yet</div>
            <div style={{ fontSize: 13, color: '#9a958c', maxWidth: 380, margin: '0 auto' }}>
              Add candidates and clients in the Contacts page. They'll appear here in the recruitment funnel.
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 12, height: '100%', minHeight: 400 }}>
            {STAGES.map(stage => (
              <PipelineColumn
                key={stage.key}
                stage={stage}
                contacts={byStage[stage.key] || []}
                canManage={canManage}
                onStageChange={changeStage}
                updatingId={updatingId}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}