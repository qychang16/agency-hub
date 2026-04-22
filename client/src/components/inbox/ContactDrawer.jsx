import { useState, useEffect } from 'react'
import { API, ACCENT, ACCENT_LIGHT, ACCENT_MID } from '../../utils/constants'
import { fmtSGT } from '../../utils/dates'
import { useAuth } from '../../context/AuthContext'

function parseNotes(raw) {
  if (!raw) return []
  try {
    const v = typeof raw === 'string' ? JSON.parse(raw) : raw
    return Array.isArray(v) ? v : []
  } catch {
    return raw ? [{ id: 'legacy', text: raw, by: '—', ts: '' }] : []
  }
}

export default function ContactDrawer({ activeConvoId, active, setActive, projects, isMobile, onClose }) {
  const { token, user } = useAuth()
  const [drawerTab, setDrawerTab] = useState('info')
  const [notes, setNotes] = useState([])
  const [noteInput, setNoteInput] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editingText, setEditingText] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setNotes(parseNotes(active?.contact_notes))
    setEditingId(null); setEditingText(''); setNoteInput('')
  }, [active?.contact_id, active?.contact_notes])

  async function persistNotes(nextNotes) {
    if (!active?.contact_id) return
    setSaving(true)
    try {
      const res = await fetch(`${API}/contacts/${active.contact_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({
          name: active.name,
          phone: active.phone,
          email: active.email,
          type: active.type,
          pipeline_stage: active.pipeline_stage,
          pdpa_consented: active.pdpa_consented,
          dnc: active.dnc,
          notes: JSON.stringify(nextNotes)
        })
      })
      if (!res.ok) throw new Error('Save failed')
      setNotes(nextNotes)
      setActive(prev => prev ? { ...prev, contact_notes: JSON.stringify(nextNotes) } : prev)
    } catch (err) {
      alert('Could not save note. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function addNote() {
    const text = noteInput.trim()
    if (!text) return
    const newNote = {
      id: Date.now().toString(),
      text,
      by: user?.name || 'Agent',
      ts: new Date().toISOString()
    }
    const next = [newNote, ...notes]
    setNoteInput('')
    await persistNotes(next)
  }

  function startEdit(note) {
    setEditingId(note.id)
    setEditingText(note.text)
  }

  async function saveEdit() {
    const text = editingText.trim()
    if (!text) return
    const next = notes.map(n => n.id === editingId ? { ...n, text, edited_at: new Date().toISOString() } : n)
    setEditingId(null); setEditingText('')
    await persistNotes(next)
  }

  async function deleteNote(id) {
    if (!confirm('Delete this note?')) return
    const next = notes.filter(n => n.id !== id)
    await persistNotes(next)
  }

  async function assignProject(projectId) {
    if (!activeConvoId) return
    try {
      await fetch(`${API}/conversations/${activeConvoId}/project`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ project_id: projectId || null })
      })
      setActive(prev => prev ? { ...prev, project_id: projectId || null } : prev)
    } catch {
      alert('Could not update project. Please try again.')
    }
  }

  const currentProject = projects?.find(p => p.id === active?.project_id)
  const activeProjects = (projects || []).filter(p => p.status === 'active')

  function formatNoteTime(iso) {
    if (!iso) return ''
    try { return fmtSGT(iso) } catch { return iso }
  }

  const content = (
    <>
      <div style={{ display: 'flex', borderBottom: '0.5px solid #e5e7eb', flexShrink: 0 }}>
        {['info', 'notes'].map(t => (
          <button key={t} onClick={() => setDrawerTab(t)}
            style={{ flex: 1, padding: '8px 2px', fontSize: 10, color: drawerTab === t ? '#111827' : '#6b7280', background: 'transparent', border: 'none', borderBottom: drawerTab === t ? `2px solid ${ACCENT}` : '2px solid transparent', cursor: 'pointer', fontWeight: drawerTab === t ? 500 : 400, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
            {t === 'info' ? 'Contact' : `Notes${notes.length ? ` (${notes.length})` : ''}`}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 10 }}>
        {!active ? (
          <div style={{ fontSize: 11, color: '#9ca3af', textAlign: 'center', padding: '20px 0' }}>
            Select a conversation to view contact details
          </div>
        ) : drawerTab === 'info' ? (
          <div>
            <div style={{ padding: '8px 0 12px', borderBottom: '0.5px solid #f1f4f9', marginBottom: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', marginBottom: 2 }}>{active.name || '—'}</div>
              <div style={{ fontSize: 10, color: '#6b7280', fontFamily: 'monospace' }}>{active.phone || '—'}</div>
            </div>

            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 9, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Project</div>
              <select
                value={active.project_id || ''}
                onChange={e => assignProject(e.target.value ? parseInt(e.target.value) : null)}
                style={{ width: '100%', padding: '6px 8px', border: '0.5px solid #d1d5db', borderRadius: 7, fontSize: 11, background: '#f9fafb', color: currentProject ? (currentProject.colour || '#111827') : '#6b7280', outline: 'none', fontWeight: currentProject ? 600 : 400 }}>
                <option value="">— No project —</option>
                {activeProjects.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.client_name} · {p.start_month} {p.start_year}
                  </option>
                ))}
              </select>
              {activeProjects.length === 0 && (
                <div style={{ fontSize: 9, color: '#9ca3af', marginTop: 3, fontStyle: 'italic' }}>
                  No active projects. Create one in the Projects tab.
                </div>
              )}
            </div>

            {[
              ['Email', active.email],
              ['Type', active.type],
              ['Stage', active.pipeline_stage],
              ['Assigned to', active.assigned_to],
              ['Status', active.status],
              ['Phone line', active.phone_line],
              ['PDPA', active.pdpa_consented ? '✓ Consented' : 'Not consented'],
              ['DNC', active.dnc ? '⚠ Yes' : 'No'],
            ].map(([l, v]) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '0.5px solid #f1f4f9', fontSize: 11, gap: 6 }}>
                <span style={{ color: '#9ca3af', flexShrink: 0 }}>{l}</span>
                <span style={{ color: '#111827', fontWeight: 500, textAlign: 'right', fontSize: 10, wordBreak: 'break-all', textTransform: l === 'Type' || l === 'Stage' || l === 'Status' ? 'capitalize' : 'none' }}>
                  {v || '—'}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div>
            <textarea value={noteInput} onChange={e => setNoteInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) addNote() }}
              style={{ width: '100%', padding: '6px 8px', border: '0.5px solid #d1d5db', borderRadius: 7, fontSize: 11, background: '#f9fafb', color: '#111827', resize: 'none', minHeight: 64, marginBottom: 5, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
              placeholder="Type a note… (Ctrl+Enter to save)" rows={3} />
            <button onClick={addNote} disabled={saving || !noteInput.trim()}
              style={{ width: '100%', padding: '6px', background: saving || !noteInput.trim() ? '#e5e7eb' : ACCENT_LIGHT, border: `0.5px solid ${ACCENT_MID}`, borderRadius: 7, fontSize: 11, cursor: saving || !noteInput.trim() ? 'default' : 'pointer', color: saving || !noteInput.trim() ? '#9ca3af' : '#1e40af', fontWeight: 500, marginBottom: 10 }}>
              {saving ? 'Saving…' : 'Save note'}
            </button>

            {notes.length === 0 ? (
              <div style={{ fontSize: 11, color: '#9ca3af', textAlign: 'center', padding: '10px 0' }}>No notes yet</div>
            ) : notes.map(n => (
              <div key={n.id} style={{ padding: '8px 9px', background: '#fefce8', borderRadius: 7, fontSize: 11, color: '#854d0e', marginBottom: 6, border: '0.5px solid #fef08a', lineHeight: 1.5 }}>
                {editingId === n.id ? (
                  <>
                    <textarea value={editingText} onChange={e => setEditingText(e.target.value)}
                      autoFocus
                      style={{ width: '100%', padding: '5px 7px', border: '0.5px solid #fcd34d', borderRadius: 5, fontSize: 11, background: '#fff', color: '#111827', resize: 'vertical', minHeight: 50, marginBottom: 5, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', lineHeight: 1.5 }} />
                    <div style={{ display: 'flex', gap: 5, justifyContent: 'flex-end' }}>
                      <button onClick={() => { setEditingId(null); setEditingText('') }}
                        style={{ padding: '3px 8px', background: 'transparent', border: '0.5px solid #d1d5db', borderRadius: 5, fontSize: 10, color: '#6b7280', cursor: 'pointer' }}>Cancel</button>
                      <button onClick={saveEdit} disabled={!editingText.trim() || saving}
                        style={{ padding: '3px 8px', background: !editingText.trim() || saving ? '#e5e7eb' : ACCENT, border: 'none', borderRadius: 5, fontSize: 10, color: !editingText.trim() || saving ? '#9ca3af' : '#fff', cursor: !editingText.trim() || saving ? 'default' : 'pointer', fontWeight: 500 }}>
                        {saving ? 'Saving…' : 'Save'}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ marginBottom: 4, whiteSpace: 'pre-wrap' }}>{n.text}</div>
                    <div style={{ fontSize: 9, color: '#a16207', borderTop: '0.5px solid #fef08a', paddingTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontWeight: 500 }}>{n.by || '—'}</span>
                      {n.ts && <><span>·</span><span>{formatNoteTime(n.ts)}</span></>}
                      {n.edited_at && <span style={{ fontStyle: 'italic' }}>(edited)</span>}
                      <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                        <button onClick={() => startEdit(n)}
                          style={{ background: 'transparent', border: 'none', color: '#a16207', fontSize: 10, cursor: 'pointer', padding: 0, fontWeight: 500 }}>Edit</button>
                        <button onClick={() => deleteNote(n.id)}
                          style={{ background: 'transparent', border: 'none', color: '#dc2626', fontSize: 10, cursor: 'pointer', padding: 0, fontWeight: 500 }}>Delete</button>
                      </span>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )

  if (isMobile) {
    return (
      <div style={{ position: 'absolute', inset: 0, background: '#fff', zIndex: 15, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '10px 14px', borderBottom: '0.5px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 9 }}>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 7, border: '0.5px solid #d1d5db', background: 'transparent', cursor: 'pointer', fontSize: 18, color: '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>‹</button>
          <span style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>{active?.name || 'Contact'}</span>
        </div>
        {content}
      </div>
    )
  }

  return (
    <div style={{ width: 260, borderLeft: '0.5px solid #e5e7eb', background: '#fff', display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden' }}>
      {content}
    </div>
  )
}