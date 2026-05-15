import { useState, useEffect, useRef } from 'react'
import { TEMPLATE_LANGUAGES, TEMPLATE_LANGUAGE_LABELS } from '../../utils/templateLanguages'

// Searchable single-select dropdown for WhatsApp template languages.
// Matches Tel-Cloud's existing inline-style aesthetic (input/select-shaped trigger,
// dropdown list below with keyboard nav).
//
// Props:
//   value       Currently-selected code (e.g. 'en', 'zh_CN')
//   onChange    Callback(newCode) when user picks a language
//   disabled    Boolean, default false
//
// Behaviour:
//   - Click trigger to open. Search input auto-focuses.
//   - Type to filter (matches code OR label, case-insensitive).
//   - Arrow up/down highlights, Enter selects, Esc closes.
//   - Click outside closes.
//   - On open: scrolls the current value into view if present.

export default function LanguageSelect({ value, onChange, disabled = false }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(0)
  const rootRef = useRef(null)
  const inputRef = useRef(null)
  const listRef = useRef(null)

  const currentLabel = TEMPLATE_LANGUAGE_LABELS[value] || value || ''

  const filtered = TEMPLATE_LANGUAGES.filter(l => {
    if (!query.trim()) return true
    const q = query.toLowerCase()
    return l.code.toLowerCase().includes(q) || l.label.toLowerCase().includes(q)
  })

  // Close on outside click.
  useEffect(() => {
    if (!open) return
    function handle(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false); setQuery(''); setHighlight(0)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  // Focus search input + scroll selected into view on open.
  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus()
      // Highlight the current value if it's in the unfiltered list.
      const idx = TEMPLATE_LANGUAGES.findIndex(l => l.code === value)
      setHighlight(idx >= 0 ? idx : 0)
    }
  }, [open, value])

  // Keep highlight in bounds when query changes.
  useEffect(() => {
    if (highlight >= filtered.length) setHighlight(Math.max(0, filtered.length - 1))
  }, [filtered.length, highlight])

  function pick(code) {
    onChange(code)
    setOpen(false); setQuery(''); setHighlight(0)
  }

  function handleKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight(h => Math.min(filtered.length - 1, h + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight(h => Math.max(0, h - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filtered[highlight]) pick(filtered[highlight].code)
    } else if (e.key === 'Escape') {
      setOpen(false); setQuery(''); setHighlight(0)
    }
  }

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => !disabled && setOpen(o => !o)}
        disabled={disabled}
        style={{
          width: '100%', padding: '9px 12px', border: '0.5px solid #dcd8d0',
          borderRadius: 8, fontSize: 13, outline: 'none',
          background: disabled ? '#f5f3ef' : '#fff',
          color: disabled ? '#9a958c' : '#14130f',
          cursor: disabled ? 'not-allowed' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          fontFamily: 'inherit', textAlign: 'left'
        }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {currentLabel || 'Select language...'}
        </span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginLeft: 6, opacity: 0.6 }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
          background: '#fff', border: '0.5px solid #dcd8d0', borderRadius: 8,
          boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
          zIndex: 50,
          maxHeight: 280, display: 'flex', flexDirection: 'column'
        }}>
          <div style={{ padding: 6, borderBottom: '0.5px solid #f5f3ef' }}>
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type to search languages..."
              style={{
                width: '100%', padding: '7px 10px', border: '0.5px solid #dcd8d0',
                borderRadius: 6, fontSize: 12, outline: 'none',
                background: '#faf9f7', color: '#14130f', boxSizing: 'border-box'
              }} />
          </div>
          <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
            {filtered.length === 0 ? (
              <div style={{ padding: '12px 14px', fontSize: 12, color: '#9a958c', textAlign: 'center', fontStyle: 'italic' }}>
                No matches
              </div>
            ) : (
              filtered.map((l, i) => {
                const isSelected = l.code === value
                const isHighlighted = i === highlight
                return (
                  <div
                    key={l.code}
                    onClick={() => pick(l.code)}
                    onMouseEnter={() => setHighlight(i)}
                    style={{
                      padding: '7px 12px', fontSize: 12, cursor: 'pointer',
                      background: isHighlighted ? '#f5f3ef' : 'transparent',
                      color: '#14130f',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                    }}>
                    <span style={{ fontWeight: isSelected ? 600 : 400 }}>{l.label}</span>
                    <span style={{ fontSize: 10, color: '#9a958c', fontFamily: 'monospace' }}>{l.code}</span>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
