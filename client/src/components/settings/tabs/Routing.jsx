import { useState } from 'react'
import { useWorkspace } from '../../../context/WorkspaceContext'
import { ACCENT, ACCENT_LIGHT, NAVY } from '../../../utils/constants'

export default function Routing() {
  const { routing, updateRouting, teams } = useWorkspace()
  const [saved, setSaved] = useState(false)

  function save() { setSaved(true); setTimeout(() => setSaved(false), 3000) }

  return (
    <div style={{ padding: 28, maxWidth: 720 }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: '#111827', marginBottom: 4 }}>Routing Rules</div>
        <div style={{ fontSize: 12, color: '#9ca3af' }}>Configure how incoming conversations are automatically assigned to agents and teams.</div>
      </div>

      {/* Assignment Mode */}
      <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e5e7eb', padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Assignment Mode</div>
        {[
          { key: 'smart', label: 'Smart Routing', desc: 'Automatically assigns based on contact type, team availability and capacity' },
          { key: 'round_robin', label: 'Round Robin', desc: 'Distributes evenly across all available agents' },
          { key: 'manual', label: 'Manual Only', desc: 'All conversations go to unassigned queue — agents self-assign' },
        ].map(mode => (
          <label key={mode.key} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', borderRadius: 8, border: `1px solid ${routing.mode === mode.key ? ACCENT : '#e5e7eb'}`, background: routing.mode === mode.key ? ACCENT_LIGHT : '#f9fafb', cursor: 'pointer', marginBottom: 8 }}>
            <input type="radio" name="mode" checked={routing.mode === mode.key} onChange={() => updateRouting({ mode: mode.key })} style={{ accentColor: ACCENT, marginTop: 2 }} />
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>{mode.label}</div>
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{mode.desc}</div>
            </div>
          </label>
        ))}
      </div>

      {/* Contact Type Routing */}
      <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e5e7eb', padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Contact Type Routing</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 500, color: '#6b7280', display: 'block', marginBottom: 5 }}>Candidates assigned to</label>
            <select value={routing.candidate_team || ''} onChange={e => updateRouting({ candidate_team: e.target.value })}
              style={{ width: '100%', padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: 7, fontSize: 12, background: '#f9fafb', color: '#111827', outline: 'none' }}>
              <option value="">Any available agent</option>
              {teams.map(t => <option key={t.id} value={t.key}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 500, color: '#6b7280', display: 'block', marginBottom: 5 }}>Clients assigned to</label>
            <select value={routing.client_team || ''} onChange={e => updateRouting({ client_team: e.target.value })}
              style={{ width: '100%', padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: 7, fontSize: 12, background: '#f9fafb', color: '#111827', outline: 'none' }}>
              <option value="">Any available agent</option>
              {teams.map(t => <option key={t.id} value={t.key}>{t.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Toggles */}
      <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e5e7eb', padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Assignment Options</div>
        {[
          { key: 'sticky_assignment', label: 'Sticky Assignment', desc: 'Return contacts always go back to their previous agent if available' },
          { key: 'round_robin', label: 'Round Robin within team', desc: 'Distribute evenly across team members' },
          { key: 'unassigned_queue', label: 'Unassigned Queue', desc: 'Show unassigned conversations in a separate queue visible to managers' },
          { key: 'escalation_enabled', label: 'Escalation Rules', desc: 'Automatically escalate unanswered conversations after a set time' },
        ].map(toggle => (
          <div key={toggle.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '0.5px solid #f9fafb' }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: '#374151' }}>{toggle.label}</div>
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{toggle.desc}</div>
            </div>
            <button onClick={() => updateRouting({ [toggle.key]: !routing[toggle.key] })}
              style={{ width: 40, height: 22, borderRadius: 11, border: 'none', background: routing[toggle.key] ? ACCENT : '#d1d5db', cursor: 'pointer', position: 'relative', flexShrink: 0, transition: 'background .2s' }}>
              <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: routing[toggle.key] ? 21 : 3, transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
            </button>
          </div>
        ))}
      </div>

      {/* Blackout hours */}
      <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e5e7eb', padding: 20, marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Scheduled Message Blackout</div>
        <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 14 }}>Scheduled messages will not send during these hours. Protects candidates from receiving messages at inappropriate times.</div>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 11, fontWeight: 500, color: '#6b7280', display: 'block', marginBottom: 5 }}>No messages after</label>
            <input type="time" value={routing.blackout_start || '22:00'} onChange={e => updateRouting({ blackout_start: e.target.value })}
              style={{ width: '100%', padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: 7, fontSize: 12, outline: 'none', background: '#f9fafb', color: '#111827', boxSizing: 'border-box' }} />
          </div>
          <div style={{ fontSize: 12, color: '#9ca3af', paddingTop: 20 }}>until</div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 11, fontWeight: 500, color: '#6b7280', display: 'block', marginBottom: 5 }}>Resume sending from</label>
            <input type="time" value={routing.blackout_end || '08:00'} onChange={e => updateRouting({ blackout_end: e.target.value })}
              style={{ width: '100%', padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: 7, fontSize: 12, outline: 'none', background: '#f9fafb', color: '#111827', boxSizing: 'border-box' }} />
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={save} style={{ padding: '10px 24px', background: ACCENT, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Save Changes</button>
        {saved && <div style={{ fontSize: 12, color: '#16a34a', display: 'flex', alignItems: 'center', gap: 4 }}><span>✓</span> Saved</div>}
      </div>
    </div>
  )
}