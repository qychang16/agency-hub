import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../../../context/AuthContext'
import { useApiSave } from '../../../hooks/useApiSave'
import { API } from '../../../utils/constants'
import { ACCENT, ACCENT_LIGHT } from '../../../utils/designTokens'
import Button from '../../ui/Button'

// =====================================================================
// Industry vertical wizard. Lives in Settings > Workspace > Industry.
// Reads/writes the workspace's industry_presets row via /industry/* API.
// Locked workspaces become read-only; lock confirmation requires explicit
// acknowledgement. The 4 non-recruitment industries are intentionally
// shown as "Coming soon" and not selectable in chunk 28a.
//
// Visual conventions match Billing.jsx (chunk 26).
// =====================================================================

// ----- Shared building blocks ----------------------------------------

function Card({ children, style }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #dcd8d0', padding: 20, marginBottom: 16, ...style }}>
      {children}
    </div>
  )
}

function CardHeader({ title, subtitle, action }) {
  return (
    <div style={{ marginBottom: 14, paddingBottom: 10, borderBottom: '0.5px solid #f5f3ef', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#4a4742' }}>{title}</div>
        {subtitle && <div style={{ fontSize: 11, color: '#9a958c', marginTop: 2 }}>{subtitle}</div>}
      </div>
      {action}
    </div>
  )
}

function FieldLabel({ children }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 600, color: '#4a4742', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 8 }}>
      {children}
    </div>
  )
}

function StatusBadge({ status }) {
  const map = {
    locked:   { bg: '#fef3c7', fg: '#92400e', label: 'Locked' },
    unlocked: { bg: '#dbeafe', fg: '#1d4ed8', label: 'Editing' },
    saved:    { bg: '#dcfce7', fg: '#16a34a', label: 'Saved' },
  }
  const s = map[status] || { bg: '#f5f3ef', fg: '#9a958c', label: status }
  return <span style={{ fontSize: 10, padding: '3px 9px', borderRadius: 11, background: s.bg, color: s.fg, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{s.label}</span>
}

function ErrorBanner({ message, onDismiss }) {
  return (
    <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 10, background: '#fee2e2', color: '#991b1b', fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
      <span>{message}</span>
      {onDismiss && <button onClick={onDismiss} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: 18, lineHeight: 1 }}>×</button>}
    </div>
  )
}

// ----- Step indicator ------------------------------------------------

function StepIndicator({ step, isLocked }) {
  const steps = [
    { n: 1, label: 'Choose industry' },
    { n: 2, label: 'Customize presets' },
    { n: 3, label: isLocked ? 'Review' : 'Review and lock' },
  ]
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
      {steps.map((s, idx) => {
        const isCurrent = step === s.n
        const isDone = step > s.n
        return (
          <div key={s.n} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 24, height: 24, borderRadius: '50%',
              background: isCurrent ? '#14130f' : isDone ? '#c2bdb3' : '#f5f3ef',
              color: (isCurrent || isDone) ? '#fff' : '#9a958c',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 600,
            }}>
              {isDone ? '✓' : s.n}
            </div>
            <div style={{ fontSize: 12, fontWeight: isCurrent ? 600 : 500, color: isCurrent ? '#14130f' : '#9a958c' }}>
              {s.label}
            </div>
            {idx < steps.length - 1 && <div style={{ width: 24, height: 1, background: '#dcd8d0', marginLeft: 4, marginRight: 4 }} />}
          </div>
        )
      })}
    </div>
  )
}

// =====================================================================
// Top-level wizard
// =====================================================================

export default function Industry() {
  const { user, token } = useAuth()
  const workspaceId = user?.workspace_id
  const { save, saving, error: saveError, setError: setSaveError } = useApiSave(token)

  const [step, setStep] = useState(1)
  const [catalog, setCatalog] = useState([])
  const [workspace, setWorkspace] = useState(null)
  const [draft, setDraft] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!workspaceId || !token) return
      setLoading(true)
      setLoadError('')
      try {
        const headers = { Authorization: 'Bearer ' + token }
        const [catRes, presetRes] = await Promise.all([
          fetch(`${API}/industry/catalog`, { headers }),
          fetch(`${API}/industry/preset/${workspaceId}`, { headers })
        ])
        if (!catRes.ok) throw new Error(`Catalog load failed (${catRes.status})`)
        if (!presetRes.ok) throw new Error(`Preset load failed (${presetRes.status})`)
        const catJson = await catRes.json()
        const presetJson = await presetRes.json()
        if (cancelled) return
        setCatalog(catJson.industries || [])
        setWorkspace(presetJson.workspace || null)
        if (presetJson.preset) {
          setDraft({
            vertical: presetJson.preset.vertical,
            pipeline_stages: presetJson.preset.pipeline_stages,
            custom_fields: presetJson.preset.custom_fields,
            ui_labels: presetJson.preset.ui_labels,
            template_library_seed: presetJson.preset.template_library_seed
          })
          if (presetJson.workspace?.is_locked) setStep(3)
        }
      } catch (e) {
        if (!cancelled) setLoadError(e.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [workspaceId, token])

  const isLocked = !!workspace?.is_locked
  const selectedIndustry = useMemo(
    () => catalog.find(i => i.slug === draft?.vertical) || null,
    [catalog, draft]
  )

  function pickIndustry(slug) {
    const entry = catalog.find(i => i.slug === slug)
    if (!entry || entry.status !== 'available') return
    if (!draft || draft.vertical !== slug) {
      setDraft({
        vertical: slug,
        pipeline_stages: [...entry.default_preset.pipeline_stages],
        custom_fields: entry.default_preset.custom_fields.map(f => ({ ...f })),
        ui_labels: { ...entry.default_preset.ui_labels },
        template_library_seed: entry.default_preset.template_library_seed
      })
    }
    setStep(2)
  }

  async function savePreset() {
    if (!draft) return
    const result = await save(`${API}/industry/preset/${workspaceId}`, { method: 'PATCH', body: draft })
    if (result.ok) setStep(3)
  }

  async function lockIndustry() {
    const result = await save(`${API}/industry/lock/${workspaceId}`, { method: 'POST', body: { confirm: true } })
    if (result.ok) {
      setWorkspace(w => ({ ...w, is_locked: true, industry_locked_at: new Date().toISOString() }))
    }
  }

  if (loading) {
    return <div style={{ padding: 24, color: '#9a958c', fontSize: 13 }}>Loading industry configuration…</div>
  }
  if (loadError) {
    return <div style={{ padding: 24 }}><ErrorBanner message={loadError} /></div>
  }

  // Locked banner content (used inside the header card)
  const lockedAt = workspace?.industry_locked_at
    ? new Date(workspace.industry_locked_at).toLocaleString('en-SG', { timeZone: 'Asia/Singapore' })
    : null

  return (
    <div style={{ padding: 24, maxWidth: 920 }}>

      {/* ----- Header card ----- */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 4 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#14130f', marginBottom: 2 }}>
              Industry vertical
            </div>
            <div style={{ fontSize: 12, color: '#6e6a63', maxWidth: 560 }}>
              Choose your industry. This shapes pipeline stages, contact fields, and terminology
              across the workspace. Locked once confirmed — contact Tel-Cloud support to change.
            </div>
          </div>
          {isLocked && <StatusBadge status="locked" />}
        </div>
        {isLocked && lockedAt && (
          <div style={{ marginTop: 12, padding: '10px 12px', background: '#fffbeb', borderRadius: 8, border: '0.5px solid #fde68a', fontSize: 12, color: '#78350f' }}>
            Locked to <strong style={{ textTransform: 'capitalize' }}>{selectedIndustry?.display_name || workspace?.industry_vertical?.replace(/_/g, ' ')}</strong> on {lockedAt} SGT.
          </div>
        )}
      </Card>

      {/* ----- Step indicator ----- */}
      <StepIndicator step={step} isLocked={isLocked} />

      {/* ----- Errors ----- */}
      {saveError && <ErrorBanner message={saveError} onDismiss={() => setSaveError('')} />}

      {/* ----- Steps ----- */}
      {step === 1 && (
        <Step1Pick catalog={catalog} currentVertical={draft?.vertical} disabled={isLocked} onPick={pickIndustry} />
      )}
      {step === 2 && draft && (
        <Step2Customize draft={draft} onChange={setDraft} disabled={isLocked} onBack={() => setStep(1)} onSave={savePreset} saving={saving} />
      )}
      {step === 3 && draft && (
        <Step3Review draft={draft} workspace={workspace} isLocked={isLocked} onBack={() => !isLocked && setStep(2)} onLock={lockIndustry} saving={saving} />
      )}
    </div>
  )
}

// =====================================================================
// Step 1 — Industry picker
// =====================================================================

function Step1Pick({ catalog, currentVertical, disabled, onPick }) {
  return (
    <Card>
      <CardHeader title="Choose industry" subtitle="Tap a card to start configuring." />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
        {catalog.map(industry => {
          const isAvailable = industry.status === 'available'
          const isCurrent = currentVertical === industry.slug
          const clickable = isAvailable && !disabled
          return (
            <button
              key={industry.slug}
              type="button"
              disabled={!clickable}
              onClick={() => onPick(industry.slug)}
              style={{
                textAlign: 'left',
                padding: 16,
                borderRadius: 10,
                border: isCurrent ? `1.5px solid ${ACCENT}` : '0.5px solid #dcd8d0',
                background: clickable ? '#fff' : '#fafaf8',
                cursor: clickable ? 'pointer' : 'not-allowed',
                fontFamily: 'inherit',
                transition: 'border-color 120ms, background 120ms'
              }}
              onMouseEnter={e => { if (clickable && !isCurrent) e.currentTarget.style.borderColor = '#9a958c' }}
              onMouseLeave={e => { if (clickable && !isCurrent) e.currentTarget.style.borderColor = '#dcd8d0' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: clickable ? '#14130f' : '#9a958c' }}>
                  {industry.display_name}
                </div>
                {isAvailable
                  ? (isCurrent && <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 9, background: ACCENT_LIGHT, color: ACCENT, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Current</span>)
                  : <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 9, background: '#f5f3ef', color: '#9a958c', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Coming soon</span>
                }
              </div>
              <div style={{ fontSize: 12, color: clickable ? '#6e6a63' : '#9a958c', lineHeight: 1.5 }}>
                {industry.description}
              </div>
              {!isAvailable && (
                <div style={{ marginTop: 10, fontSize: 11, color: '#9a958c' }}>
                  Contact Tel-Cloud support to register interest.
                </div>
              )}
            </button>
          )
        })}
      </div>
    </Card>
  )
}

// =====================================================================
// Step 2 — Customize presets
// =====================================================================

function Step2Customize({ draft, onChange, disabled, onBack, onSave, saving }) {
  function updateStage(idx, value) {
    const next = [...draft.pipeline_stages]; next[idx] = value
    onChange({ ...draft, pipeline_stages: next })
  }
  function removeStage(idx) {
    onChange({ ...draft, pipeline_stages: draft.pipeline_stages.filter((_, i) => i !== idx) })
  }
  function addStage() {
    onChange({ ...draft, pipeline_stages: [...draft.pipeline_stages, 'new_stage'] })
  }
  function updateField(idx, patch) {
    onChange({ ...draft, custom_fields: draft.custom_fields.map((f, i) => i === idx ? { ...f, ...patch } : f) })
  }
  function removeField(idx) {
    onChange({ ...draft, custom_fields: draft.custom_fields.filter((_, i) => i !== idx) })
  }
  function addField() {
    onChange({
      ...draft,
      custom_fields: [...draft.custom_fields, { key: 'new_field', label: 'New field', type: 'text', required: false }]
    })
  }
  function updateLabel(key, value) {
    onChange({ ...draft, ui_labels: { ...draft.ui_labels, [key]: value } })
  }

  const inputStyle = {
    padding: '6px 10px',
    border: '0.5px solid #dcd8d0',
    borderRadius: 6,
    fontSize: 12,
    fontFamily: 'inherit',
    outline: 'none',
    background: disabled ? '#fafaf8' : '#fff',
    color: '#14130f',
  }
  const monoStyle = { ...inputStyle, fontFamily: 'ui-monospace, SF Mono, Menlo, monospace' }

  return (
    <>
      <Card>
        <CardHeader title="Pipeline stages" subtitle="The stages a contact moves through, left to right." />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {draft.pipeline_stages.map((stage, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 22, textAlign: 'right', color: '#9a958c', fontSize: 11, fontWeight: 600 }}>{idx + 1}</span>
              <input
                type="text" value={stage} onChange={e => updateStage(idx, e.target.value)}
                disabled={disabled} style={{ ...inputStyle, flex: 1 }}
              />
              <Button variant="ghost" size="sm" onClick={() => removeStage(idx)} disabled={disabled}>Remove</Button>
            </div>
          ))}
          <div style={{ marginTop: 4 }}>
            <Button variant="secondary" size="sm" onClick={addStage} disabled={disabled}>+ Add stage</Button>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Contact custom fields" subtitle="Fields shown on each contact's profile." />
        {/* Table-style header row */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1.2fr 1.6fr 0.9fr 0.9fr 36px',
          gap: 10, padding: '0 4px 8px 4px', borderBottom: '0.5px solid #f5f3ef',
          fontSize: 10, fontWeight: 600, color: '#9a958c', textTransform: 'uppercase', letterSpacing: '0.4px'
        }}>
          <div>Key</div>
          <div>Label</div>
          <div>Type</div>
          <div>Required</div>
          <div></div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 8 }}>
          {draft.custom_fields.map((field, idx) => (
            <div key={idx} style={{
              display: 'grid', gridTemplateColumns: '1.2fr 1.6fr 0.9fr 0.9fr 36px',
              gap: 10, alignItems: 'center', padding: '4px 4px'
            }}>
              <input type="text" value={field.key} placeholder="key"
                onChange={e => updateField(idx, { key: e.target.value })}
                disabled={disabled} style={monoStyle} />
              <input type="text" value={field.label} placeholder="Display label"
                onChange={e => updateField(idx, { label: e.target.value })}
                disabled={disabled} style={inputStyle} />
              <select value={field.type}
                onChange={e => updateField(idx, { type: e.target.value })}
                disabled={disabled} style={inputStyle}>
                <option value="text">text</option>
                <option value="number">number</option>
                <option value="url">url</option>
                <option value="date">date</option>
              </select>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#6e6a63', cursor: disabled ? 'not-allowed' : 'pointer' }}>
                <input type="checkbox" checked={!!field.required}
                  onChange={e => updateField(idx, { required: e.target.checked })} disabled={disabled} />
                <span>{field.required ? 'Yes' : 'No'}</span>
              </label>
              <Button variant="ghost" size="sm" iconOnly onClick={() => removeField(idx)} disabled={disabled}>×</Button>
            </div>
          ))}
          <div style={{ marginTop: 4 }}>
            <Button variant="secondary" size="sm" onClick={addField} disabled={disabled}>+ Add field</Button>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Terminology" subtitle="What you call things in your industry." />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
          {Object.keys(draft.ui_labels || {}).sort().map(key => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ width: 170, flexShrink: 0, fontSize: 11, color: '#6e6a63', fontFamily: 'ui-monospace, SF Mono, Menlo, monospace' }}>{key}</label>
              <input type="text" value={draft.ui_labels[key]}
                onChange={e => updateLabel(key, e.target.value)}
                disabled={disabled} style={{ ...inputStyle, flex: 1 }} />
            </div>
          ))}
        </div>
      </Card>

      <FooterButtons>
        <Button variant="secondary" onClick={onBack} disabled={saving}>Back</Button>
        <Button variant="primary" onClick={onSave} disabled={saving || disabled} loading={saving}>
          Save and review
        </Button>
      </FooterButtons>
    </>
  )
}

// =====================================================================
// Step 3 — Review and lock
// =====================================================================

function Step3Review({ draft, workspace, isLocked, onBack, onLock, saving }) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [acknowledge, setAcknowledge] = useState(false)

  return (
    <>
      <Card>
        <CardHeader title="Industry" />
        <div style={{ fontSize: 14, fontWeight: 600, color: '#14130f', textTransform: 'capitalize' }}>
          {draft.vertical.replace(/_/g, ' ')}
        </div>
      </Card>

      <Card>
        <CardHeader title="Pipeline stages" subtitle={`${draft.pipeline_stages.length} stages`} />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {draft.pipeline_stages.map((s, i) => (
            <span key={i} style={{
              padding: '5px 10px', borderRadius: 8,
              background: '#f5f3ef', color: '#4a4742',
              fontSize: 12, fontWeight: 500,
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
              <span style={{ color: '#9a958c', fontSize: 10, fontWeight: 600 }}>{i + 1}</span>
              {s}
            </span>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader title="Contact custom fields" subtitle={`${draft.custom_fields.length} fields`} />
        <div style={{
          display: 'grid', gridTemplateColumns: '1.2fr 1.6fr 0.8fr 0.8fr',
          gap: 10, padding: '0 4px 8px 4px', borderBottom: '0.5px solid #f5f3ef',
          fontSize: 10, fontWeight: 600, color: '#9a958c', textTransform: 'uppercase', letterSpacing: '0.4px'
        }}>
          <div>Key</div>
          <div>Label</div>
          <div>Type</div>
          <div>Required</div>
        </div>
        <div>
          {draft.custom_fields.map((f, i) => (
            <div key={i} style={{
              display: 'grid', gridTemplateColumns: '1.2fr 1.6fr 0.8fr 0.8fr',
              gap: 10, padding: '8px 4px',
              borderBottom: i < draft.custom_fields.length - 1 ? '0.5px solid #f5f3ef' : 'none',
              fontSize: 12, alignItems: 'center'
            }}>
              <span style={{ fontFamily: 'ui-monospace, SF Mono, Menlo, monospace', color: '#4a4742' }}>{f.key}</span>
              <span style={{ color: '#14130f' }}>{f.label}</span>
              <span style={{ color: '#6e6a63' }}>{f.type}</span>
              <span style={{ color: f.required ? '#16a34a' : '#9a958c', fontWeight: f.required ? 600 : 400 }}>
                {f.required ? 'Yes' : 'No'}
              </span>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader title="Terminology" subtitle="How things are named in your workspace" />
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1.5fr',
          gap: 10, padding: '0 4px 8px 4px', borderBottom: '0.5px solid #f5f3ef',
          fontSize: 10, fontWeight: 600, color: '#9a958c', textTransform: 'uppercase', letterSpacing: '0.4px'
        }}>
          <div>Key</div>
          <div>Display</div>
        </div>
        <div>
          {Object.entries(draft.ui_labels).sort(([a], [b]) => a.localeCompare(b)).map(([k, v], i, arr) => (
            <div key={k} style={{
              display: 'grid', gridTemplateColumns: '1fr 1.5fr',
              gap: 10, padding: '8px 4px',
              borderBottom: i < arr.length - 1 ? '0.5px solid #f5f3ef' : 'none',
              fontSize: 12, alignItems: 'center'
            }}>
              <span style={{ fontFamily: 'ui-monospace, SF Mono, Menlo, monospace', color: '#4a4742' }}>{k}</span>
              <span style={{ color: '#14130f' }}>{v}</span>
            </div>
          ))}
        </div>
      </Card>

      {!isLocked && (
        <FooterButtons>
          <Button variant="secondary" onClick={onBack} disabled={saving}>Back</Button>
          <Button variant="primary" onClick={() => setConfirmOpen(true)} disabled={saving}>
            Lock industry
          </Button>
        </FooterButtons>
      )}

      {confirmOpen && (
        <ConfirmLockModal
          workspaceName={workspace?.name}
          vertical={draft.vertical}
          acknowledge={acknowledge}
          onAcknowledgeChange={setAcknowledge}
          onCancel={() => { setConfirmOpen(false); setAcknowledge(false) }}
          onConfirm={async () => { await onLock(); setConfirmOpen(false) }}
          saving={saving}
        />
      )}
    </>
  )
}

// =====================================================================
// Confirm lock modal
// =====================================================================

function ConfirmLockModal({ workspaceName, vertical, acknowledge, onAcknowledgeChange, onCancel, onConfirm, saving }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.4)'
    }}>
      <div style={{ width: '100%', maxWidth: 460, background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 12px 32px rgba(0,0,0,0.18)' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#14130f' }}>
          Lock industry permanently?
        </div>
        <div style={{ marginTop: 10, fontSize: 13, color: '#4a4742', lineHeight: 1.55 }}>
          You're about to lock <strong style={{ color: '#14130f' }}>{workspaceName}</strong> to
          the <strong style={{ color: '#14130f', textTransform: 'capitalize' }}>{vertical?.replace(/_/g, ' ')}</strong> industry.
        </div>
        <div style={{ marginTop: 10, fontSize: 13, color: '#4a4742', lineHeight: 1.55 }}>
          This change cannot be undone from inside the app. Tel-Cloud support can unlock it on
          request, but pipeline stages, custom fields, and terminology will be frozen until then.
        </div>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: 16, fontSize: 13, color: '#4a4742', cursor: 'pointer' }}>
          <input type="checkbox" checked={acknowledge} onChange={e => onAcknowledgeChange(e.target.checked)} style={{ marginTop: 3 }} />
          <span>I understand this is permanent and will require support to reverse.</span>
        </label>
        <FooterButtons>
          <Button variant="secondary" onClick={onCancel} disabled={saving}>Cancel</Button>
          <Button variant="primary" onClick={onConfirm} disabled={!acknowledge || saving} loading={saving}>
            Lock industry
          </Button>
        </FooterButtons>
      </div>
    </div>
  )
}

// =====================================================================
// Footer button row
// =====================================================================

function FooterButtons({ children }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 16, marginTop: 8 }}>
      {children}
    </div>
  )
}