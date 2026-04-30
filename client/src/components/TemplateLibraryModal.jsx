import { useState, useEffect, useMemo } from 'react'
import { ink, accent, semantic, textSize, textWeight, microLabel, radius, border, shadow } from '../utils/designTokens'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'

function Btn({ onClick, children, variant = 'primary', size = 'md', disabled, style: extra }) {
  const sizes = { sm: { padding: '5px 10px', fontSize: 11 }, md: { padding: '8px 14px', fontSize: 12 } }
  const variants = {
    primary: { background: accent.DEFAULT, color: '#fff', border: 'none' },
    ghost:   { background: 'transparent', color: ink[600], border: border.subtle },
  }
  return (
    <button onClick={!disabled ? onClick : undefined}
      style={{ ...sizes[size], ...variants[variant], borderRadius: 8, cursor: disabled ? 'default' : 'pointer',
               fontWeight: textWeight.medium, opacity: disabled ? 0.6 : 1,
               display: 'inline-flex', alignItems: 'center', gap: 6, ...extra }}>
      {children}
    </button>
  )
}

export default function TemplateLibraryModal({ isOpen, onClose, onSelect }) {
  const [templates, setTemplates] = useState([])
  const [categories, setCategories] = useState([])
  const [industries, setIndustries] = useState([])
  const [activeCategory, setActiveCategory] = useState('all')
  const [activeIndustry, setActiveIndustry] = useState('all')
  const [search, setSearch] = useState('')
  const [selectedKey, setSelectedKey] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!isOpen) return
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const token = localStorage.getItem('token')
        const headers = { 'Authorization': `Bearer ${token}` }
        const [listRes, metaRes] = await Promise.all([
          fetch(`${API_BASE}/template-library`, { headers }),
          fetch(`${API_BASE}/template-library/meta/categories`, { headers })
        ])
        if (!listRes.ok || !metaRes.ok) throw new Error('Fetch failed')
        const listData = await listRes.json()
        const metaData = await metaRes.json()
        if (cancelled) return
        setTemplates(listData.templates || [])
        setCategories(metaData.categories || [])
        setIndustries(metaData.industries || [])
        if (listData.templates && listData.templates.length > 0) {
          setSelectedKey(listData.templates[0].template_key)
        }
      } catch (err) {
        if (!cancelled) setError('Could not load templates. Please try again.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [isOpen])

  const filtered = useMemo(() => {
    return templates.filter(t => {
      if (activeCategory !== 'all' && t.category !== activeCategory) return false
      if (activeIndustry !== 'all' && t.industry !== activeIndustry) return false
      if (search.trim()) {
        const q = search.toLowerCase()
        const hay = `${t.display_name} ${t.description} ${t.body}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [templates, activeCategory, activeIndustry, search])

  const selected = filtered.find(t => t.template_key === selectedKey)
    || templates.find(t => t.template_key === selectedKey)
    || null

  const renderPreview = (tpl) => {
    if (!tpl) return ''
    let out = tpl.body || ''
    const vars = tpl.variables || {}
    Object.entries(vars).forEach(([pos, name]) => {
      const placeholder = new RegExp(`\\{\\{${pos}\\}\\}`, 'g')
      out = out.replace(placeholder, `[${name}]`)
    })
    return out
  }

  if (!isOpen) return null

  const inputStyle = {
    padding: '7px 10px', border: border.subtle, borderRadius: 8,
    fontSize: textSize.sm, outline: 'none', background: ink[50], color: ink[800], boxSizing: 'border-box'
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: '#fff', borderRadius: 16, width: '100%', maxWidth: 980,
        height: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
        boxShadow: shadow.overlay
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 24px', borderBottom: `0.5px solid ${ink[100]}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0
        }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: textWeight.semibold, color: ink[800] }}>Template Library</div>
            <div style={{ fontSize: 11, color: ink[500], marginTop: 2 }}>
              Choose a starting point. Selected templates open in the editor for customisation.
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 28, height: 28, borderRadius: 7, border: border.subtle,
              background: ink[50], cursor: 'pointer', color: ink[600],
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
            aria-label="Close"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Filter bar */}
        <div style={{
          padding: '12px 24px', borderBottom: `0.5px solid ${ink[100]}`,
          display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', flexShrink: 0
        }}>
          <div style={{ flex: '1 1 220px', position: 'relative' }}>
            <svg style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)',
                          width: 12, height: 12, color: ink[500], pointerEvents: 'none' }}
                 viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="7" cy="7" r="4"/>
              <path d="M10.5 10.5l3 3" strokeLinecap="round"/>
            </svg>
            <input
              type="text"
              placeholder="Search templates..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ ...inputStyle, width: '100%', paddingLeft: 26 }}
            />
          </div>
          <select value={activeCategory} onChange={(e) => setActiveCategory(e.target.value)} style={inputStyle}>
            <option value="all">All categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={activeIndustry} onChange={(e) => setActiveIndustry(e.target.value)} style={inputStyle}>
            <option value="all">All industries</option>
            {industries.map(i => <option key={i} value={i}>{i}</option>)}
          </select>
        </div>

        {/* Body: list + preview */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
          {/* List */}
          <div style={{ width: 320, borderRight: `0.5px solid ${ink[100]}`, overflowY: 'auto', background: ink[50] }}>
            {loading && <div style={{ padding: 20, color: ink[500], fontSize: textSize.sm }}>Loading...</div>}
            {error && <div style={{ padding: 20, color: semantic.danger, fontSize: textSize.sm }}>{error}</div>}
            {!loading && !error && filtered.length === 0 && (
              <div style={{ padding: 20, color: ink[500], fontSize: textSize.sm }}>No templates match.</div>
            )}
            {filtered.map(t => {
              const isSelected = selectedKey === t.template_key
              return (
                <div
                  key={t.template_key}
                  onClick={() => setSelectedKey(t.template_key)}
                  style={{
                    padding: '12px 16px', cursor: 'pointer',
                    borderBottom: `0.5px solid ${ink[100]}`,
                    background: isSelected ? '#fff' : 'transparent',
                    borderLeft: isSelected ? `2px solid ${accent.DEFAULT}` : '2px solid transparent'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ fontWeight: textWeight.medium, fontSize: textSize.md, color: ink[800] }}>
                      {t.display_name}
                    </span>
                    {t.is_featured && (
                      <span style={{
                        ...microLabel, fontSize: 9, letterSpacing: '0.8px',
                        padding: '2px 6px', borderRadius: radius.sm,
                        background: accent.soft, color: accent.DEFAULT
                      }}>FEATURED</span>
                    )}
                  </div>
                  <div style={{ fontSize: textSize.xs, color: ink[600], marginTop: 3 }}>
                    {t.category} <span style={{ color: ink[400] }}>{'\u00b7'}</span> {t.industry}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Preview */}
          <div style={{ flex: 1, padding: 24, overflowY: 'auto', background: '#fff' }}>
            {selected ? (
              <>
                <div style={{ ...microLabel, marginBottom: 6 }}>
                  {selected.category} <span style={{ color: ink[400] }}>{'\u00b7'}</span> {selected.industry}
                </div>
                <div style={{ fontSize: textSize.lg, fontWeight: textWeight.semibold, color: ink[800], marginBottom: 4 }}>
                  {selected.display_name}
                </div>
                <div style={{ fontSize: textSize.sm, color: ink[600], marginBottom: 18, lineHeight: 1.5 }}>
                  {selected.description}
                </div>

                <div style={{
                  border: border.subtle, borderRadius: 8, padding: 16,
                  background: ink[50], marginBottom: 16
                }}>
                  {selected.header && (
                    <div style={{ fontWeight: textWeight.semibold, fontSize: textSize.md,
                                  color: ink[800], marginBottom: 8 }}>
                      {selected.header}
                    </div>
                  )}
                  <div style={{ whiteSpace: 'pre-wrap', fontSize: textSize.md, lineHeight: 1.6, color: ink[800] }}>
                    {renderPreview(selected)}
                  </div>
                  {selected.footer && (
                    <div style={{ marginTop: 12, fontSize: textSize.xs, color: ink[500],
                                  paddingTop: 10, borderTop: `0.5px solid ${ink[200]}` }}>
                      {selected.footer}
                    </div>
                  )}
                  {Array.isArray(selected.buttons) && selected.buttons.length > 0 && (
                    <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
                      {selected.buttons.map((b, idx) => (
                        <span key={idx} style={{
                          fontSize: textSize.xs, padding: '4px 10px',
                          border: border.subtle, borderRadius: radius.sm, background: '#fff',
                          color: accent.DEFAULT, fontWeight: textWeight.medium
                        }}>
                          {b.text || b.label}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ ...microLabel, marginBottom: 6 }}>Variables</div>
                <div style={{ fontSize: textSize.xs, color: ink[600], marginBottom: 24, lineHeight: 1.7 }}>
                  {Object.entries(selected.variables || {}).map(([pos, name]) => (
                    <span key={pos} style={{
                      display: 'inline-block', marginRight: 6, marginBottom: 4,
                      padding: '2px 6px', background: ink[100], borderRadius: radius.sm,
                      fontFamily: 'monospace', fontSize: 11
                    }}>
                      {`{{${pos}}}`} = {name}
                    </span>
                  )) || <span>None</span>}
                </div>

                <Btn onClick={() => onSelect && onSelect(selected)}>
                  Use this template
                </Btn>
              </>
            ) : (
              <div style={{ color: ink[500], fontSize: textSize.sm }}>Select a template to preview.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}