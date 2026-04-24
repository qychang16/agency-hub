import { useState, useEffect } from 'react'
import { useAuth } from '../../../context/AuthContext'
import { API } from '../../../utils/constants'
import { ACCENT, ACCENT_LIGHT, NAVY } from '../../../utils/designTokens'

const ROLE_OPTIONS = [
  { value: 'director', label: 'Director' },
  { value: 'manager', label: 'Manager' },
  { value: 'senior_consultant', label: 'Senior Consultant' },
  { value: 'consultant', label: 'Consultant' },
]

function Field({ label, hint, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: '#4a4742', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{label}</label>
      {hint && <div style={{ fontSize: 11, color: '#9a958c', marginBottom: 6 }}>{hint}</div>}
      {children}
    </div>
  )
}

function Input({ value, onChange, placeholder, type = 'text', disabled }) {
  return (
    <input type={type} value={value || ''} onChange={onChange} placeholder={placeholder} disabled={disabled}
      style={{ width: '100%', padding: '9px 12px', border: '0.5px solid #dcd8d0', borderRadius: 8, fontSize: 13, outline: 'none', background: disabled ? '#faf9f7' : '#fff', color: '#14130f', boxSizing: 'border-box' }} />
  )
}

function Select({ value, onChange, options, disabled }) {
  return (
    <select value={value || ''} onChange={onChange} disabled={disabled}
      style={{ width: '100%', padding: '9px 12px', border: '0.5px solid #dcd8d0', borderRadius: 8, fontSize: 13, outline: 'none', background: disabled ? '#faf9f7' : '#fff', color: '#14130f' }}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

function Toggle({ value, onChange, label, hint, disabled }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 0', borderBottom: '0.5px solid #faf9f7' }}>
      <div style={{ flex: 1, marginRight: 16 }}>
        <div style={{ fontSize: 13, color: '#14130f', fontWeight: 500 }}>{label}</div>
        {hint && <div style={{ fontSize: 11, color: '#9a958c', marginTop: 2 }}>{hint}</div>}
      </div>
      <button onClick={() => !disabled && onChange(!value)} disabled={disabled}
        style={{ width: 44, height: 24, borderRadius: 12, border: 'none', background: value ? ACCENT : '#c2bdb3', cursor: disabled ? 'not-allowed' : 'pointer', position: 'relative', transition: 'background .2s', flexShrink: 0, opacity: disabled ? 0.6 : 1 }}>
        <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: value ? 23 : 3, transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
      </button>
    </div>
  )
}

function Card({ children, style }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #dcd8d0', padding: 20, marginBottom: 16, ...style }}>
      {children}
    </div>
  )
}

function CardHeader({ title, subtitle, action }) {
  return (
    <div style={{ marginBottom: 14, paddingBottom: 10, borderBottom: '0.5px solid #f5f3ef', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#4a4742' }}>{title}</div>
        {subtitle && <div style={{ fontSize: 11, color: '#9a958c', marginTop: 2 }}>{subtitle}</div>}
      </div>
      {action}
    </div>
  )
}

function Btn({ onClick, children, variant = 'primary', size = 'md', disabled, style: extra }) {
  const sizes = { sm: { padding: '5px 10px', fontSize: 11 }, md: { padding: '8px 14px', fontSize: 12 } }
  const variants = {
    primary: { background: ACCENT, color: '#fff', border: 'none' },
    ghost: { background: 'transparent', color: '#6e6a63', border: '0.5px solid #dcd8d0' },
    dark: { background: NAVY, color: '#fff', border: 'none' },
  }
  return (
    <button onClick={!disabled ? onClick : undefined}
      style={{ ...sizes[size], ...variants[variant], borderRadius: 8, cursor: disabled ? 'default' : 'pointer', fontWeight: 500, opacity: disabled ? 0.6 : 1, display: 'inline-flex', alignItems: 'center', gap: 5, ...extra }}>
      {children}
    </button>
  )
}

export default function Routing() {
  const { token } = useAuth()
  const [teams, setTeams] = useState([])
  const [agents, setAgents] = useState([])
  const [routing, setRouting] = useState({
    mode: 'smart',
    sticky_assignment: true,
    round_robin: true,
    candidate_team_id: '',
    client_team_id: '',
    max_capacity: 20,
    escalation_enabled: true,
    escalation_steps: [],
    after_hours_action: 'auto_reply',
    unassigned_queue: true,
    blackout_start: '22:00',
    blackout_end: '08:00',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const [r, t, a] = await Promise.all([
        fetch(`${API}/routing`, { headers: { Authorization: 'Bearer ' + token } }).then(r => r.json()),
        fetch(`${API}/teams`, { headers: { Authorization: 'Bearer ' + token } }).then(r => r.json()),
        fetch(`${API}/agents`, { headers: { Authorization: 'Bearer ' + token } }).then(r => r.json()),
      ])
      if (r && Object.keys(r).length > 0) {
        setRouting(prev => ({ ...prev, ...r, escalation_steps: r.escalation_steps || [] }))
      }
      setTeams(Array.isArray(t) ? t : [])
      setAgents(Array.isArray(a) ? a.filter(ag => ag.active) : [])
    } catch {} finally { setLoading(false) }
  }

  async function save() {
    setSaving(true)
    try {
      await fetch(`${API}/routing`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify(routing)
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {} finally { setSaving(false) }
  }

  function addStep() {
    setRouting(p => ({
      ...p,
      escalation_steps: [...(p.escalation_steps || []), { type: 'team', target: '', wait_minutes: 30 }]
    }))
  }

  function updateStep(i, field, val) {
    setRouting(p => ({
      ...p,
      escalation_steps: p.escalation_steps.map((s, idx) => idx === i ? { ...s, [field]: val } : s)
    }))
  }

  function removeStep(i) {
    setRouting(p => ({ ...p, escalation_steps: p.escalation_steps.filter((_, idx) => idx !== i) }))
  }

  function moveStep(i, dir) {
    const steps = [...routing.escalation_steps]
    const target = i + dir
    if (target < 0 || target >= steps.length) return
    ;[steps[i], steps[target]] = [steps[target], steps[i]]
    setRouting(p => ({ ...p, escalation_steps: steps })  )
  }

  const teamOptions = [{ value: '', label: 'No default team' }, ...teams.map(t => ({ value: t.id, label: t.name }))]
  const agentOptions = [{ value: '', label: 'Select agent…' }, ...agents.map(a => ({ value: a.name, label: a.name }))]

  if (loading) return (
    <div style={{ textAlign: 'center', padding: 60, color: '#9a958c' }}>
      <div style={{ fontSize: 28, marginBottom: 10 }}>⏳</div>
      <div>Loading routing rules…</div>
    </div>
  )

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#14130f' }}>Routing Rules</div>
          <div style={{ fontSize: 12, color: '#9a958c', marginTop: 3 }}>
            Configure how incoming conversations are automatically assigned to agents and teams
          </div>
        </div>
      </div>

      {/* How routing works */}
      <div style={{ background: '#faf9f7', borderRadius: 10, border: '0.5px solid #dcd8d0', padding: '14px 16px', marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#4a4742', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.4px' }}>How Tel-Cloud Routes Conversations</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, overflowX: 'auto', paddingBottom: 4 }}>
          {[
            { step: '1', label: 'Message arrives', sub: 'New WhatsApp message received' },
            { step: '2', label: 'Contact type check', sub: 'Candidate or client?' },
            { step: '3', label: 'Sticky check', sub: 'Previously assigned agent?' },
            { step: '4', label: 'Capacity check', sub: 'Is agent available?' },
            { step: '5', label: 'Round-robin', sub: 'Distribute across team' },
            { step: '6', label: 'Assigned ✓', sub: 'Agent notified instantly' },
          ].map((s, i, arr) => (
            <div key={s.step} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              <div style={{ textAlign: 'center', minWidth: 90 }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: i === arr.length - 1 ? '#16a34a' : NAVY, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, margin: '0 auto 5px' }}>{s.step}</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#14130f', lineHeight: 1.3 }}>{s.label}</div>
                <div style={{ fontSize: 10, color: '#9a958c', lineHeight: 1.3, marginTop: 2 }}>{s.sub}</div>
              </div>
              {i < arr.length - 1 && <div style={{ width: 24, height: 1.5, background: '#c2bdb3', flexShrink: 0 }} />}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: 16 }}>
        {/* Left column */}
        <div>
          {/* Assignment mode */}
          <Card>
            <CardHeader title="Assignment Mode" subtitle="How conversations are distributed to agents" />
            {[
              { value: 'smart', label: 'Smart Routing', desc: 'Routes based on contact type, sticky assignment, team and capacity. Recommended.', icon: '🧠' },
              { value: 'round_robin', label: 'Round Robin Only', desc: 'Distribute evenly across all available agents regardless of contact type.', icon: '🔄' },
              { value: 'manual', label: 'Manual Only', desc: 'All conversations go to unassigned queue. Agents self-assign or manager assigns.', icon: '✋' },
            ].map(m => (
              <div key={m.value} onClick={() => setRouting(p => ({ ...p, mode: m.value }))}
                style={{ display: 'flex', gap: 12, padding: '12px 14px', borderRadius: 9, border: `1.5px solid ${routing.mode === m.value ? ACCENT : '#dcd8d0'}`, marginBottom: 8, cursor: 'pointer', background: routing.mode === m.value ? ACCENT_LIGHT : '#fff', transition: 'all .15s' }}>
                <span style={{ fontSize: 20, flexShrink: 0 }}>{m.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <div style={{ width: 14, height: 14, borderRadius: '50%', border: `2px solid ${routing.mode === m.value ? ACCENT : '#c2bdb3'}`, background: routing.mode === m.value ? ACCENT : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {routing.mode === m.value && <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#fff' }} />}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: routing.mode === m.value ? ACCENT : '#14130f' }}>{m.label}</div>
                  </div>
                  <div style={{ fontSize: 11, color: '#9a958c', lineHeight: 1.5, paddingLeft: 22 }}>{m.desc}</div>
                </div>
              </div>
            ))}
          </Card>

          {/* Contact type routing */}
          <Card>
            <CardHeader title="Contact Type Routing" subtitle="Route candidates and clients to different teams automatically" />
            <Field label="Candidates route to" hint="All new candidate conversations assigned to this team">
              <Select value={routing.candidate_team_id} onChange={e => setRouting(p => ({ ...p, candidate_team_id: e.target.value }))} options={teamOptions} />
            </Field>
            <Field label="Clients route to" hint="All new client conversations assigned to this team">
              <Select value={routing.client_team_id} onChange={e => setRouting(p => ({ ...p, client_team_id: e.target.value }))} options={teamOptions} />
            </Field>
            <Field label="Max conversations per agent" hint="When an agent reaches this limit they are skipped in routing">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <input type="range" min={1} max={100} value={routing.max_capacity || 20}
                  onChange={e => setRouting(p => ({ ...p, max_capacity: parseInt(e.target.value) }))}
                  style={{ flex: 1, accentColor: ACCENT }} />
                <div style={{ fontSize: 16, fontWeight: 700, color: '#14130f', minWidth: 32, textAlign: 'center' }}>{routing.max_capacity}</div>
              </div>
            </Field>
          </Card>

          {/* Assignment behaviour */}
          <Card>
            <CardHeader title="Assignment Behaviour" />
            <Toggle
              value={routing.sticky_assignment}
              onChange={v => setRouting(p => ({ ...p, sticky_assignment: v }))}
              label="Sticky assignment"
              hint="Same candidate always returns to their previous agent if available" />
            <Toggle
              value={routing.round_robin}
              onChange={v => setRouting(p => ({ ...p, round_robin: v }))}
              label="Round-robin distribution"
              hint="Distribute conversations evenly across available agents in the team" />
            <Toggle
              value={routing.unassigned_queue}
              onChange={v => setRouting(p => ({ ...p, unassigned_queue: v }))}
              label="Unassigned queue"
              hint="Conversations that fail all routing rules go to a visible unassigned queue" />
          </Card>
        </div>

        {/* Right column */}
        <div>
          {/* Escalation chain */}
          <Card>
            <CardHeader
              title="Escalation Chain"
              subtitle="Auto-escalate if no response within the wait time"
              action={
                <Toggle
                  value={routing.escalation_enabled}
                  onChange={v => setRouting(p => ({ ...p, escalation_enabled: v }))}
                  label="" />
              } />

            {routing.escalation_enabled ? (
              <>
                <div style={{ fontSize: 11, color: '#9a958c', marginBottom: 14, padding: '8px 10px', background: '#faf9f7', borderRadius: 7, lineHeight: 1.5 }}>
                  If the assigned agent does not respond within the wait time, the conversation escalates to the next step automatically. The candidate is never notified.
                </div>

                {(routing.escalation_steps || []).length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '20px 0', color: '#9a958c' }}>
                    <div style={{ fontSize: 24, marginBottom: 8 }}>🔀</div>
                    <div style={{ fontSize: 12 }}>No escalation steps yet</div>
                    <div style={{ fontSize: 11, marginTop: 4 }}>Add steps to define the escalation chain</div>
                  </div>
                ) : (
                  <div style={{ marginBottom: 12 }}>
                    {(routing.escalation_steps || []).map((step, i) => (
                      <div key={i} style={{ background: '#faf9f7', borderRadius: 9, border: '0.5px solid #dcd8d0', padding: '12px 14px', marginBottom: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                          <div style={{ width: 24, height: 24, borderRadius: '50%', background: NAVY, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                            {i + 1}
                          </div>
                          <div style={{ flex: 1, fontSize: 12, fontWeight: 600, color: '#4a4742' }}>Escalation Step {i + 1}</div>
                          <div style={{ display: 'flex', gap: 4 }}>
                            {i > 0 && (
                              <button onClick={() => moveStep(i, -1)} style={{ width: 22, height: 22, borderRadius: 5, border: '0.5px solid #dcd8d0', background: '#fff', cursor: 'pointer', fontSize: 10, color: '#6e6a63', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>↑</button>
                            )}
                            {i < routing.escalation_steps.length - 1 && (
                              <button onClick={() => moveStep(i, 1)} style={{ width: 22, height: 22, borderRadius: 5, border: '0.5px solid #dcd8d0', background: '#fff', cursor: 'pointer', fontSize: 10, color: '#6e6a63', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>↓</button>
                            )}
                            <button onClick={() => removeStep(i)} style={{ width: 22, height: 22, borderRadius: 5, border: '0.5px solid #fca5a5', background: '#fee2e2', cursor: 'pointer', fontSize: 12, color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                          <div>
                            <div style={{ fontSize: 10, color: '#9a958c', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.3px' }}>Escalate to</div>
                            <Select value={step.type} onChange={e => updateStep(i, 'type', e.target.value)} options={[
                              { value: 'team', label: 'A Team' },
                              { value: 'role', label: 'A Role' },
                              { value: 'agent', label: 'Specific Agent' },
                            ]} />
                          </div>
                          <div>
                            <div style={{ fontSize: 10, color: '#9a958c', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.3px' }}>Target</div>
                            {step.type === 'team' && (
                              <Select value={step.target} onChange={e => updateStep(i, 'target', e.target.value)} options={[{ value: '', label: 'Select team…' }, ...teams.map(t => ({ value: t.key || t.id, label: t.name }))]} />
                            )}
                            {step.type === 'role' && (
                              <Select value={step.target} onChange={e => updateStep(i, 'target', e.target.value)} options={[{ value: '', label: 'Select role…' }, ...ROLE_OPTIONS]} />
                            )}
                            {step.type === 'agent' && (
                              <Select value={step.target} onChange={e => updateStep(i, 'target', e.target.value)} options={agentOptions} />
                            )}
                          </div>
                        </div>

                        <div>
                          <div style={{ fontSize: 10, color: '#9a958c', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.3px' }}>Wait time before escalating</div>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            {[15, 30, 60, 120, 240].map(mins => (
                              <button key={mins} onClick={() => updateStep(i, 'wait_minutes', mins)}
                                style={{ padding: '4px 10px', borderRadius: 6, border: `1px solid ${step.wait_minutes === mins ? ACCENT : '#dcd8d0'}`, background: step.wait_minutes === mins ? ACCENT_LIGHT : '#fff', color: step.wait_minutes === mins ? ACCENT : '#6e6a63', fontSize: 11, cursor: 'pointer', fontWeight: step.wait_minutes === mins ? 600 : 400 }}>
                                {mins < 60 ? `${mins}m` : `${mins / 60}h`}
                              </button>
                            ))}
                            <input type="number" value={step.wait_minutes} onChange={e => updateStep(i, 'wait_minutes', parseInt(e.target.value) || 30)} min={1}
                              style={{ width: 60, padding: '4px 8px', border: '0.5px solid #dcd8d0', borderRadius: 6, fontSize: 11, outline: 'none', background: '#fff', color: '#14130f', textAlign: 'center' }} />
                            <span style={{ fontSize: 11, color: '#9a958c' }}>min</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <button onClick={addStep}
                  style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1.5px dashed #c2bdb3', background: 'transparent', color: '#6e6a63', cursor: 'pointer', fontSize: 12, fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'all .15s' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = ACCENT; e.currentTarget.style.color = ACCENT; e.currentTarget.style.background = ACCENT_LIGHT }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#c2bdb3'; e.currentTarget.style.color = '#6e6a63'; e.currentTarget.style.background = 'transparent' }}>
                  + Add Escalation Step
                </button>

                {(routing.escalation_steps || []).length > 0 && (
                  <div style={{ marginTop: 12, padding: '10px 12px', background: '#eeedf5', border: '0.5px solid #dcd8d0', borderRadius: 8, fontSize: 11, color: '#2d2a7a', lineHeight: 1.5 }}>
                    After all {routing.escalation_steps.length} step{routing.escalation_steps.length !== 1 ? 's' : ''}, unresolved conversations move to the unassigned queue and Director is notified.
                  </div>
                )}
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '20px 0', color: '#9a958c' }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>🔀</div>
                <div style={{ fontSize: 12 }}>Escalation is disabled</div>
                <div style={{ fontSize: 11, marginTop: 4 }}>Enable to configure automatic escalation rules</div>
              </div>
            )}
          </Card>

          {/* After hours */}
          <Card>
            <CardHeader title="After-Hours & Blackout" subtitle="What happens to messages outside business hours" />
            <Field label="After-hours action">
              <Select value={routing.after_hours_action} onChange={e => setRouting(p => ({ ...p, after_hours_action: e.target.value }))} options={[
                { value: 'auto_reply', label: 'Send auto-reply template' },
                { value: 'queue', label: 'Add to queue for next business day' },
                { value: 'assign_oncall', label: 'Assign to on-call agent' },
                { value: 'nothing', label: 'Do nothing — assign normally' },
              ]} />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 12 }}>
              <Field label="Blackout start" hint="No scheduled messages sent before this time">
                <input type="time" value={routing.blackout_start || '22:00'} onChange={e => setRouting(p => ({ ...p, blackout_start: e.target.value }))}
                  style={{ width: '100%', padding: '9px 12px', border: '0.5px solid #dcd8d0', borderRadius: 8, fontSize: 13, outline: 'none', background: '#fff', color: '#14130f' }} />
              </Field>
              <Field label="Blackout end" hint="Scheduled messages resume after this time">
                <input type="time" value={routing.blackout_end || '08:00'} onChange={e => setRouting(p => ({ ...p, blackout_end: e.target.value }))}
                  style={{ width: '100%', padding: '9px 12px', border: '0.5px solid #dcd8d0', borderRadius: 8, fontSize: 13, outline: 'none', background: '#fff', color: '#14130f' }} />
              </Field>
            </div>
            <div style={{ padding: '10px 12px', background: '#fef3c7', border: '0.5px solid #fde68a', borderRadius: 8, fontSize: 11, color: '#92400e', lineHeight: 1.5 }}>
              ⏰ Current blackout: <strong>{routing.blackout_start || '22:00'} – {routing.blackout_end || '08:00'} SGT</strong>.
              Scheduled messages queued during blackout will send automatically at {routing.blackout_end || '08:00'} SGT.
            </div>
          </Card>
        </div>
      </div>

      {/* Save */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
        {saved && <div style={{ fontSize: 12, color: '#16a34a', display: 'flex', alignItems: 'center', gap: 5 }}>✓ Routing rules saved</div>}
        <Btn onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Routing Rules'}</Btn>
      </div>
    </div>
  )
}