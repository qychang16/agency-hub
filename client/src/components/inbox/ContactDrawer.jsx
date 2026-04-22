import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { API } from '../../utils/constants'
import { ink, accent, semantic, fonts, textSize, textWeight, space, radius, border, shadow, microLabel } from '../../utils/designTokens'
import { fmtSGT } from '../../utils/dates'

const PIPELINE_STAGES = ['new', 'screened', 'interviewed', 'offered', 'placed', 'rejected']

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: space[5] }}>
      <div style={{ ...microLabel, marginBottom: space[2] }}>{title}</div>
      {children}
    </div>
  )
}

function Row({ k, v, accent: isAccent }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
      padding: `${space[1] + 2}px 0`,
      borderBottom: `0.5px solid ${ink[200]}`,
      gap: space[3],
    }}>
      <span style={{ fontSize: textSize.xs, color: ink[600], fontWeight: textWeight.medium, flexShrink: 0 }}>{k}</span>
      <span style={{
        fontSize: textSize.xs,
        color: isAccent ? accent.DEFAULT : ink[800],
        fontWeight: textWeight.medium,
        textAlign: 'right',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{v || '—'}</span>
    </div>
  )
}

export default function ContactDrawer({ activeConvoId, active, setActive, projects, isMobile, onClose }) {
  const { token } = useAuth()
  const [notes, setNotes] = useState([])
  const [newNote, setNewNote] = useState('')
  const [editingNoteId, setEditingNoteId] = useState(null)
  const [editText, setEditText] = useState('')
  const [showProjectMenu, setShowProjectMenu] = useState(false)
  const [showStageMenu, setShowStageMenu] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (active?.notes) {
      try {
        const parsed = typeof active.notes === 'string' ? JSON.parse(active.notes) : active.notes
        setNotes(Array.isArray(parsed) ? parsed : [])
      } catch { setNotes([]) }
    } else setNotes([])
  }, [active?.id, active?.notes])

  async function saveNotes(newList) {
    setBusy(true)
    try {
      await fetch(`${API}/contacts/${active.contact_id}/notes`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ notes: JSON.stringify(newList) })
      })
      setNotes(newList)
      setActive(prev => prev ? { ...prev, notes: JSON.stringify(newList) } : prev)
    } catch { alert('Could not save note.') }
    setBusy(false)
  }

  async function addNote() {
    if (!newNote.trim()) return
    const entry = {
      id: Date.now(),
      text: newNote.trim(),
      created_at: new Date().toISOString(),
      author: 'You',
    }
    await saveNotes([entry, ...notes])
    setNewNote('')
  }

  async function deleteNote(id) {
    if (!confirm('Delete this note?')) return
    await saveNotes(notes.filter(n => n.id !== id))
  }

  async function updateNote(id) {
    if (!editText.trim()) return
    await saveNotes(notes.map(n => n.id === id ? { ...n, text: editText.trim(), edited_at: new Date().toISOString() } : n))
    setEditingNoteId(null); setEditText('')
  }

  async function assignProject(projectId) {
    try {
      await fetch(`${API}/conversations/${activeConvoId}/project`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ project_id: projectId })
      })
      setActive(prev => prev ? { ...prev, project_id: projectId } : prev)
      setShowProjectMenu(false)
    } catch { alert('Could not assign project.') }
  }

  async function setStage(stage) {
    try {
      await fetch(`${API}/contacts/${active.contact_id}/stage`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ pipeline_stage: stage })
      })
      setActive(prev => prev ? { ...prev, pipeline_stage: stage } : prev)
      setShowStageMenu(false)
    } catch { alert('Could not update stage.') }
  }

  if (!active) return null

  const currentProject = projects?.find(p => p.id === active.project_id)
  const activeProjects = (projects || []).filter(p => p.status === 'active')
  const isClient = active.type === 'client'

  const panel = (
    <div style={{
      width: isMobile ? '100%' : 280,
      flexShrink: 0,
      background: '#fff',
      borderLeft: isMobile ? 'none' : border.subtle,
      overflowY: 'auto',
      padding: space[4],
      fontFamily: fonts.body,
      height: isMobile ? '100%' : 'auto',
    }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: space[4] }}>
        <div style={{ ...microLabel }}>Contact</div>
        <button onClick={onClose}
          title="Close"
          style={{
            width: 22, height: 22, borderRadius: radius.md,
            border: `0.5px solid ${ink[300]}`,
            background: 'transparent', cursor: 'pointer',
            color: ink[600], display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
          <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 3l10 10" strokeLinecap="round"/>
            <path d="M13 3l-10 10" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      {/* Name + phone */}
      <div style={{ marginBottom: space[5] }}>
        <div style={{
          fontFamily: fonts.display,
          fontSize: textSize.xl,
          fontWeight: textWeight.semibold,
          color: ink[900],
          letterSpacing: '-0.2px',
          marginBottom: 2,
        }}>{active.name}</div>
        <div style={{ fontFamily: fonts.mono, fontSize: textSize.xs, color: ink[600] }}>{active.phone}</div>
      </div>

      {/* Details */}
      <Section title="Details">
        <Row k="Type" v={isClient ? 'Client' : 'Candidate'} />
        {!isClient && <Row k="Stage" v={active.pipeline_stage ? active.pipeline_stage.charAt(0).toUpperCase() + active.pipeline_stage.slice(1) : 'New'} />}
        <Row k="Project" v={currentProject ? currentProject.client_name : '— none —'} accent={!currentProject} />
        <Row k="Assigned" v={active.assigned_to || 'Unassigned'} />
        <Row k="PDPA" v={active.pdpa_consent ? 'Consented' : 'Not recorded'} />
        <Row k="Status" v={active.status === 'open' ? 'Open' : 'Resolved'} />
        {active.dnc && <Row k="DNC" v="Yes — do not contact" />}
      </Section>

      {/* Quick actions */}
      <Section title="Quick actions">
        <div style={{ display: 'flex', flexDirection: 'column', gap: space[1] }}>
          {/* Project */}
          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowProjectMenu(!showProjectMenu)}
              style={{
                width: '100%',
                padding: `${space[2]}px ${space[3]}px`,
                border: `0.5px solid ${ink[300]}`,
                borderRadius: radius.md,
                background: showProjectMenu ? ink[100] : 'transparent',
                fontSize: textSize.xs,
                color: ink[700],
                cursor: 'pointer',
                textAlign: 'left',
                fontFamily: fonts.body,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                fontWeight: textWeight.medium,
              }}>
              <span>{currentProject ? currentProject.client_name : 'Assign to project'}</span>
              <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            {showProjectMenu && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
                background: '#fff',
                border: border.subtle,
                borderRadius: radius.md,
                boxShadow: shadow.floating,
                maxHeight: 240, overflowY: 'auto',
                zIndex: 20,
              }}>
                <button onClick={() => assignProject(null)}
                  style={{
                    width: '100%', textAlign: 'left',
                    padding: `${space[2]}px ${space[3]}px`,
                    background: !currentProject ? ink[100] : 'transparent',
                    border: 'none',
                    fontSize: textSize.xs, color: ink[600],
                    cursor: 'pointer', fontStyle: 'italic',
                    fontFamily: fonts.body,
                  }}>— No project —</button>
                {activeProjects.length === 0 ? (
                  <div style={{ padding: space[3], fontSize: textSize.xs, color: ink[500], textAlign: 'center' }}>No active projects</div>
                ) : activeProjects.map(p => (
                  <button key={p.id} onClick={() => assignProject(p.id)}
                    style={{
                      width: '100%', textAlign: 'left',
                      padding: `${space[2]}px ${space[3]}px`,
                      background: currentProject?.id === p.id ? ink[100] : 'transparent',
                      border: 'none',
                      fontSize: textSize.xs, color: ink[800],
                      cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: space[2],
                      fontFamily: fonts.body,
                    }}>
                    <span style={{ width: 6, height: 6, borderRadius: radius.pill, background: p.colour || accent.DEFAULT, flexShrink: 0 }} />
                    {p.client_name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Pipeline stage (candidates only) */}
          {!isClient && (
            <div style={{ position: 'relative' }}>
              <button onClick={() => setShowStageMenu(!showStageMenu)}
                style={{
                  width: '100%',
                  padding: `${space[2]}px ${space[3]}px`,
                  border: `0.5px solid ${ink[300]}`,
                  borderRadius: radius.md,
                  background: showStageMenu ? ink[100] : 'transparent',
                  fontSize: textSize.xs,
                  color: ink[700],
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: fonts.body,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  fontWeight: textWeight.medium,
                }}>
                <span>Stage: <strong style={{ color: ink[800] }}>{active.pipeline_stage ? active.pipeline_stage.charAt(0).toUpperCase() + active.pipeline_stage.slice(1) : 'New'}</strong></span>
                <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              {showStageMenu && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
                  background: '#fff',
                  border: border.subtle,
                  borderRadius: radius.md,
                  boxShadow: shadow.floating,
                  zIndex: 20,
                }}>
                  {PIPELINE_STAGES.map(s => (
                    <button key={s} onClick={() => setStage(s)}
                      style={{
                        width: '100%', textAlign: 'left',
                        padding: `${space[2]}px ${space[3]}px`,
                        background: active.pipeline_stage === s ? ink[100] : 'transparent',
                        border: 'none',
                        fontSize: textSize.xs, color: ink[800],
                        cursor: 'pointer',
                        textTransform: 'capitalize',
                        fontFamily: fonts.body,
                        fontWeight: textWeight.medium,
                      }}>{s}</button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </Section>

      {/* Notes */}
      <Section title={`Notes · ${notes.length}`}>
        <div style={{ display: 'flex', gap: space[1], marginBottom: space[2] }}>
          <input value={newNote} onChange={e => setNewNote(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addNote()}
            placeholder="Add a private note…"
            style={{
              flex: 1,
              padding: `${space[1] + 2}px ${space[2]}px`,
              border: `0.5px solid ${ink[300]}`,
              borderRadius: radius.md,
              fontSize: textSize.xs,
              outline: 'none',
              background: ink[100],
              color: ink[800],
              fontFamily: fonts.body,
            }} />
          <button onClick={addNote} disabled={busy || !newNote.trim()}
            style={{
              padding: `${space[1] + 2}px ${space[3]}px`,
              background: newNote.trim() ? ink[900] : ink[200],
              color: newNote.trim() ? ink[50] : ink[500],
              border: 'none', borderRadius: radius.md,
              fontSize: textSize.xs, fontWeight: textWeight.medium,
              cursor: newNote.trim() ? 'pointer' : 'default',
              fontFamily: fonts.body,
            }}>Add</button>
        </div>

        {notes.length === 0 ? (
          <div style={{ fontSize: textSize.xs, color: ink[500], fontStyle: 'italic', padding: `${space[2]}px 0` }}>
            No notes yet.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: space[2] }}>
            {notes.map(n => (
              <div key={n.id} style={{
                padding: space[2] + 2,
                background: ink[100],
                borderRadius: radius.md,
                border: border.subtle,
                fontSize: textSize.xs,
              }}>
                {editingNoteId === n.id ? (
                  <>
                    <textarea value={editText} onChange={e => setEditText(e.target.value)} rows={2}
                      style={{
                        width: '100%',
                        padding: space[2],
                        border: `0.5px solid ${ink[300]}`,
                        borderRadius: radius.sm,
                        fontSize: textSize.xs,
                        outline: 'none',
                        background: '#fff',
                        color: ink[800],
                        resize: 'none',
                        fontFamily: fonts.body,
                        marginBottom: space[1],
                        boxSizing: 'border-box',
                      }} />
                    <div style={{ display: 'flex', gap: space[1], justifyContent: 'flex-end' }}>
                      <button onClick={() => { setEditingNoteId(null); setEditText('') }}
                        style={{ padding: `2px ${space[2]}px`, fontSize: 10, background: 'transparent', border: `0.5px solid ${ink[300]}`, borderRadius: radius.sm, color: ink[600], cursor: 'pointer', fontFamily: fonts.body }}>
                        Cancel
                      </button>
                      <button onClick={() => updateNote(n.id)}
                        style={{ padding: `2px ${space[2]}px`, fontSize: 10, background: ink[900], border: 'none', borderRadius: radius.sm, color: ink[50], cursor: 'pointer', fontWeight: textWeight.medium, fontFamily: fonts.body }}>
                        Save
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ color: ink[800], lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginBottom: space[1] }}>
                      {n.text}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: space[2] }}>
                      <span style={{ fontSize: 10, color: ink[500], fontFamily: fonts.mono }}>
                        {fmtSGT(n.created_at)}{n.edited_at ? ' · edited' : ''} · {n.author || 'Unknown'}
                      </span>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={() => { setEditingNoteId(n.id); setEditText(n.text) }}
                          style={{ padding: `1px 6px`, fontSize: 10, background: 'transparent', border: `0.5px solid ${ink[300]}`, borderRadius: radius.sm, color: ink[600], cursor: 'pointer', fontFamily: fonts.body }}>
                          Edit
                        </button>
                        <button onClick={() => deleteNote(n.id)}
                          style={{ padding: `1px 6px`, fontSize: 10, background: 'transparent', border: `0.5px solid ${semantic.danger}`, borderRadius: radius.sm, color: semantic.danger, cursor: 'pointer', fontFamily: fonts.body }}>
                          Delete
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Open profile */}
      <button style={{
        width: '100%',
        padding: `${space[2] + 1}px`,
        background: 'transparent',
        border: `0.5px solid ${ink[300]}`,
        color: ink[700],
        borderRadius: radius.md,
        fontSize: textSize.xs, fontWeight: textWeight.medium,
        cursor: 'pointer',
        fontFamily: fonts.body,
        letterSpacing: '0.2px',
      }}>
        Open full profile
      </button>
    </div>
  )

  // Mobile: full-screen overlay. Desktop: inline panel.
  if (isMobile) {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: 'rgba(10, 9, 7, 0.4)',
        display: 'flex', justifyContent: 'flex-end',
      }} onClick={onClose}>
        <div onClick={e => e.stopPropagation()} style={{ width: '85%', maxWidth: 340, height: '100%', background: '#fff' }}>
          {panel}
        </div>
      </div>
    )
  }

  return panel
}