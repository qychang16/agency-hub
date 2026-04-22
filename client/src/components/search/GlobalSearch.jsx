import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../context/AuthContext'
import { API, ACCENT, ACCENT_LIGHT } from '../../utils/constants'
import { fmtSGT } from '../../utils/dates'

// Global search overlay — opens on Ctrl+K. Searches messages across all conversations.
// Click a result → jumps to that conversation via the onSelect callback.
export default function GlobalSearch({ onClose, onSelect }) {
  const { token } = useAuth()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [highlightedIdx, setHighlightedIdx] = useState(0)
  const inputRef = useRef(null)
  const debounceRef = useRef(null)

  // Autofocus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Debounced search — wait 200ms after last keystroke before firing
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query.trim() || query.trim().length < 2) {
      setResults([])
      setLoading(false)
      return
    }
    setLoading(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const r = await fetch(`${API}/search?q=${encodeURIComponent(query.trim())}`, {
          headers: { Authorization: 'Bearer ' + token }
        })
        const data = await r.json()
        setResults(Array.isArray(data.results) ? data.results : [])
        setHighlightedIdx(0)
      } catch (err) {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 200)
    return () => debounceRef.current && clearTimeout(debounceRef.current)
  }, [query, token])

  // Keyboard navigation
  function handleKeyDown(e) {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightedIdx(i => Math.min(i + 1, results.length - 1))
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIdx(i => Math.max(i - 1, 0))
      return
    }
    if (e.key === 'Enter' && results[highlightedIdx]) {
      e.preventDefault()
      pickResult(results[highlightedIdx])
    }
  }

  function pickResult(r) {
    onSelect({ conversationId: r.conversation_id, messageId: r.message_id })
    onClose()
  }

  // Highlight the matched query inside a text snippet
  function highlightMatch(text, q) {
    if (!text || !q) return text
    const idx = text.toLowerCase().indexOf(q.toLowerCase())
    if (idx === -1) return text
    // Show a window around the match
    const start = Math.max(0, idx - 30)
    const end = Math.min(text.length, idx + q.length + 60)
    const before = (start > 0 ? '…' : '') + text.slice(start, idx)
    const match = text.slice(idx, idx + q.length)
    const after = text.slice(idx + q.length, end) + (end < text.length ? '…' : '')
    return (
      <>
        {before}<mark style={{ background: '#fef08a', color: '#713f12', padding: '0 2px', borderRadius: 2 }}>{match}</mark>{after}
      </>
    )
  }

  return (
    <div onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.55)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 80, zIndex: 100 }}>
      <div onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 620, background: '#fff', borderRadius: 12, boxShadow: '0 24px 60px rgba(0, 0, 0, 0.24)', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 160px)' }}>

        {/* Search input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: '0.5px solid #e5e7eb' }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#9ca3af" strokeWidth="1.75">
            <circle cx="7" cy="7" r="5"/>
            <path d="M11 11l3 3" strokeLinecap="round"/>
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search all conversations…"
            style={{ flex: 1, border: 'none', outline: 'none', fontSize: 14, color: '#111827', background: 'transparent', fontFamily: 'inherit' }}
          />
          <span style={{ fontSize: 10, color: '#9ca3af', padding: '2px 6px', background: '#f1f4f9', borderRadius: 4, fontFamily: 'monospace' }}>ESC</span>
        </div>

        {/* Results */}
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 80 }}>
          {loading && (
            <div style={{ padding: '30px 16px', textAlign: 'center', fontSize: 12, color: '#9ca3af' }}>
              Searching…
            </div>
          )}
          {!loading && query.trim().length >= 2 && results.length === 0 && (
            <div style={{ padding: '30px 16px', textAlign: 'center', fontSize: 12, color: '#9ca3af' }}>
              No results for "{query}"
            </div>
          )}
          {!loading && query.trim().length < 2 && (
            <div style={{ padding: '30px 16px', textAlign: 'center', fontSize: 12, color: '#9ca3af' }}>
              Type at least 2 characters to search across all conversations
            </div>
          )}
          {!loading && results.map((r, i) => {
            const isHighlighted = i === highlightedIdx
            return (
              <div key={r.message_id}
                onClick={() => pickResult(r)}
                onMouseEnter={() => setHighlightedIdx(i)}
                style={{ padding: '10px 16px', cursor: 'pointer', borderBottom: '0.5px solid #f1f4f9', background: isHighlighted ? ACCENT_LIGHT : 'transparent', transition: 'background 0.08s' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3, gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.contact_name || r.contact_phone}
                    </span>
                    <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, fontWeight: 500, background: r.contact_type === 'client' ? '#dbeafe' : '#ede9fe', color: r.contact_type === 'client' ? '#1e40af' : '#5b21b6' }}>
                      {r.contact_type}
                    </span>
                    {r.conversation_status !== 'open' && (
                      <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: '#f1f4f9', color: '#6b7280' }}>
                        {r.conversation_status}
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: 10, color: '#9ca3af', flexShrink: 0 }}>
                    {fmtSGT(r.created_at)}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: '#374151', lineHeight: 1.5 }}>
                  <span style={{ color: '#9ca3af', fontSize: 10, marginRight: 4 }}>
                    {r.direction === 'out' ? '→' : '←'}
                  </span>
                  {highlightMatch(r.text || '', query.trim())}
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer hints */}
        {results.length > 0 && (
          <div style={{ padding: '7px 16px', borderTop: '0.5px solid #e5e7eb', background: '#f9fafb', fontSize: 10, color: '#9ca3af', display: 'flex', gap: 14 }}>
            <span><strong style={{ color: '#6b7280' }}>↑↓</strong> navigate</span>
            <span><strong style={{ color: '#6b7280' }}>↵</strong> open</span>
            <span><strong style={{ color: '#6b7280' }}>ESC</strong> close</span>
            <span style={{ marginLeft: 'auto' }}>{results.length} result{results.length !== 1 ? 's' : ''}</span>
          </div>
        )}
      </div>
    </div>
  )
}