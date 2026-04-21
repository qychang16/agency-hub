import { ACCENT, ACCENT_LIGHT, ACCENT_MID } from '../../utils/constants'
import { fmtSGT } from '../../utils/dates'
import { useAuth } from '../../context/AuthContext'
import { useState } from 'react'

export default function ContactDrawer({ activeConvoId, isMobile, onClose, active }) {
  const { user } = useAuth()
  const [drawerTab, setDrawerTab] = useState('info')
  const [notes, setNotes] = useState([])
  const [noteInput, setNoteInput] = useState('')

  function saveNote() {
    if (!noteInput.trim()) return
    setNotes(prev => [{ text: noteInput.trim(), by: user.name, ts: fmtSGT(new Date().toISOString()) }, ...prev])
    setNoteInput('')
  }

  const content = (
    <>
      <div style={{ display: 'flex', borderBottom: '0.5px solid #e5e7eb', flexShrink: 0 }}>
        {['info','notes'].map(t => (
          <button key={t} onClick={() => setDrawerTab(t)}
            style={{ flex: 1, padding: '8px 2px', fontSize: 10, color: drawerTab === t ? '#111827' : '#6b7280', background: 'transparent', border: 'none', borderBottom: drawerTab === t ? `2px solid ${ACCENT}` : '2px solid transparent', cursor: 'pointer', fontWeight: drawerTab === t ? 500 : 400 }}>
            {t === 'info' ? 'Contact' : 'Notes'}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 10 }}>
        {drawerTab === 'info' ? (
          <div>
            {active && [['Phone', active.phone],['Type', active.type],['Assigned to', active.assigned_to],['Status', active.status],['PDPA', '✓ Consented']].map(([l,v]) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '0.5px solid #f1f4f9', fontSize: 11, gap: 6 }}>
                <span style={{ color: '#9ca3af', flexShrink: 0 }}>{l}</span>
                <span style={{ color: '#111827', fontWeight: 500, textAlign: 'right', fontSize: 10, wordBreak: 'break-all' }}>{v}</span>
              </div>
            ))}
          </div>
        ) : (
          <div>
            <textarea value={noteInput} onChange={e => setNoteInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) saveNote() }}
              style={{ width: '100%', padding: '6px 8px', border: '0.5px solid #d1d5db', borderRadius: 7, fontSize: 11, background: '#f9fafb', color: '#111827', resize: 'none', minHeight: 64, marginBottom: 5, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
              placeholder="Type a note… (Ctrl+Enter to save)" rows={3} />
            <button onClick={saveNote}
              style={{ width: '100%', padding: '6px', background: ACCENT_LIGHT, border: `0.5px solid ${ACCENT_MID}`, borderRadius: 7, fontSize: 11, cursor: 'pointer', color: '#1e40af', fontWeight: 500, marginBottom: 10 }}>
              Save note
            </button>
            {notes.length === 0 ? (
              <div style={{ fontSize: 11, color: '#9ca3af', textAlign: 'center', padding: '10px 0' }}>No notes yet</div>
            ) : notes.map((n,i) => (
              <div key={i} style={{ padding: '8px 9px', background: '#fefce8', borderRadius: 7, fontSize: 11, color: '#854d0e', marginBottom: 6, border: '0.5px solid #fef08a', lineHeight: 1.5 }}>
                <div style={{ marginBottom: 4 }}>{n.text}</div>
                <div style={{ fontSize: 9, color: '#a16207', borderTop: '0.5px solid #fef08a', paddingTop: 4, display: 'flex', gap: 4 }}>
                  <span style={{ fontWeight: 500 }}>{n.by}</span><span>·</span><span>{n.ts}</span>
                </div>
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
          <span style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>{active?.name}</span>
        </div>
        {content}
      </div>
    )
  }

  return (
    <div style={{ width: 240, borderLeft: '0.5px solid #e5e7eb', background: '#fff', display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden' }}>
      {content}
    </div>
  )
}