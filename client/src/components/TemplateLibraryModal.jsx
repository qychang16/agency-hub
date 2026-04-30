import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { API } from '../utils/constants'
import Modal from './ui/Modal'
import Btn from './ui/Btn'
import IPhonePreview from './IPhonePreview'

function prettify(value) {
  if (!value) return ''
  return value.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

export default function TemplateLibraryModal({ isOpen, onClose, onSelect }) {
  const { token } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [templates, setTemplates] = useState([])
  const [categories, setCategories] = useState([])
  const [audiences, setAudiences] = useState([])
  const [selectedKey, setSelectedKey] = useState(null)
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('all')
  const [activeAudience, setActiveAudience] = useState('all')

  useEffect(() => {
    if (!isOpen) return
    setLoading(true)
    setError('')
    Promise.all([
      fetch(`${API}/template-library`, { headers: { Authorization: 'Bearer ' + token } }).then(r => r.json()),
      fetch(`${API}/template-library/meta/categories`, { headers: { Authorization: 'Bearer ' + token } }).then(r => r.json())
    ])
      .then(([tpls, meta]) => {
        const list = Array.isArray(tpls) ? tpls : (tpls?.templates || [])
        setTemplates(list)
        setCategories(meta.categories || [])
        setAudiences(meta.audiences || [])
        if (list.length > 0) setSelectedKey(list[0].template_key)
      })
      .catch(err => setError(err.message || 'Failed to load library'))
      .finally(() => setLoading(false))
  }, [isOpen, token])

  const filtered = useMemo(() => {
    return templates.filter(t => {
      if (activeCategory !== 'all' && t.category !== activeCategory) return false
      if (activeAudience !== 'all' && t.audience !== activeAudience) return false
      if (search.trim()) {
        const q = search.toLowerCase()
        const hay = `${t.display_name || ''} ${t.description || ''} ${t.body || ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [templates, activeCategory, activeAudience, search])

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

  return (
    <Modal
      title="Tel-Cloud Suggested Templates"
      subtitle="Recruitment-vertical templates curated for you. Pick one to customise and submit for Meta approval."
      onClose={onClose}
      width={1100}
    >
      {/* Filters */}
      <div style={{
        display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap',
        marginBottom: 16
      }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
          <svg style={{
            position: 'absolute', left: 10, top: '50%',
            transform: 'translateY(-50%)', width: 13, height: 13,
            color: '#9a958c', pointerEvents: 'none'
          }} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="7" cy="7" r="4" />
            <path d="M10.5 10.5l3 3" strokeLinecap="round" />
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search templates..."
            style={{
              width: '100%', padding: '8px 10px 8px 30px',
              border: '0.5px solid #dcd8d0', borderRadius: 8, fontSize: 12,
              outline: 'none', background: '#faf9f7', color: '#14130f',
              boxSizing: 'border-box'
            }}
          />
        </div>
        <select
          value={activeCategory}
          onChange={e => setActiveCategory(e.target.value)}
          style={selectStyle}
        >
          <option value="all">All categories</option>
          {categories.map(c => <option key={c} value={c}>{prettify(c)}</option>)}
        </select>
        <select
          value={activeAudience}
          onChange={e => setActiveAudience(e.target.value)}
          style={selectStyle}
        >
          <option value="all">All audiences</option>
          {audiences.map(a => <option key={a} value={a}>{prettify(a)}</option>)}
        </select>
      </div>

      {error && (
        <div style={{
          padding: '10px 12px', background: '#fef2f2',
          border: '0.5px solid #fecaca', borderRadius: 8,
          fontSize: 12, color: '#dc2626', marginBottom: 12
        }}>
          ⚠ {error}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#9a958c', fontSize: 12 }}>
          Loading suggested templates...
        </div>
      ) : (
        <div style={{
          display: 'grid', gridTemplateColumns: '280px 1fr',
          gap: 16, alignItems: 'start'
        }}>
          {/* Left list */}
          <div style={{
            border: '0.5px solid #dcd8d0', borderRadius: 10,
            background: '#faf9f7', maxHeight: '60vh', overflowY: 'auto'
          }}>
            {filtered.length === 0 ? (
              <div style={{ padding: 24, color: '#9a958c', fontSize: 12, textAlign: 'center' }}>
                No templates match your filters.
              </div>
            ) : (
              filtered.map(t => {
                const isSelected = t.template_key === selectedKey
                return (
                  <div
                    key={t.template_key}
                    onClick={() => setSelectedKey(t.template_key)}
                    style={{
                      padding: '12px 14px', cursor: 'pointer',
                      background: isSelected ? '#fff' : 'transparent',
                      borderLeft: `3px solid ${isSelected ? '#5b21b6' : 'transparent'}`,
                      borderBottom: '0.5px solid #f5f3ef',
                      display: 'flex', justifyContent: 'space-between',
                      alignItems: 'flex-start', gap: 10
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 12, fontWeight: 600, color: '#14130f',
                        marginBottom: 3
                      }}>
                        {t.display_name || prettify(t.template_key)}
                      </div>
                      <div style={{ fontSize: 10, color: '#6e6a63' }}>
                        {prettify(t.category)}
                        {t.audience && (
                          <>
                            {' '}<span style={{ color: '#9a958c' }}>{'\u00b7'}</span>{' '}
                            {prettify(t.audience)}
                          </>
                        )}
                      </div>
                    </div>
                    {t.is_featured && (
                      <span style={{
                        fontSize: 9, fontWeight: 700, color: '#5b21b6',
                        background: '#ede9fe', padding: '2px 6px',
                        borderRadius: 5, letterSpacing: '0.4px',
                        textTransform: 'uppercase', flexShrink: 0
                      }}>
                        Featured
                      </span>
                    )}
                  </div>
                )
              })
            )}
          </div>

          {/* Right preview + action */}
          <div>
            {selected ? (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) 280px',
                gap: 20, alignItems: 'start'
              }}>
                <div style={{ minWidth: 0 }}>
                  <div style={microLabel}>
                    {prettify(selected.category)}
                    {selected.audience && (
                      <>
                        {' '}<span style={{ color: '#9a958c' }}>{'\u00b7'}</span>{' '}
                        {prettify(selected.audience)}
                      </>
                    )}
                  </div>
                  <div style={{
                    fontSize: 16, fontWeight: 700, color: '#14130f',
                    marginTop: 4, marginBottom: 6
                  }}>
                    {selected.display_name || prettify(selected.template_key)}
                  </div>
                  {selected.description && (
                    <div style={{ fontSize: 12, color: '#6e6a63', marginBottom: 14 }}>
                      {selected.description}
                    </div>
                  )}

                  <div style={{
                    background: '#faf9f7', border: '0.5px solid #dcd8d0',
                    borderRadius: 10, padding: 14, marginBottom: 14
                  }}>
                    {selected.header && (
                      <div style={{
                        fontSize: 13, fontWeight: 700, color: '#14130f',
                        marginBottom: 8
                      }}>
                        {selected.header}
                      </div>
                    )}
                    <div style={{
                      fontSize: 12, color: '#4a4742',
                      whiteSpace: 'pre-wrap', lineHeight: 1.6
                    }}>
                      {selected.body}
                    </div>
                    {selected.footer && (
                      <div style={{
                        fontSize: 11, color: '#9a958c', marginTop: 10,
                        paddingTop: 8, borderTop: '0.5px solid #f5f3ef'
                      }}>
                        {selected.footer}
                      </div>
                    )}
                  </div>

                  {selected.variables && Object.keys(selected.variables).length > 0 && (
                    <div style={{ marginBottom: 14 }}>
                      <div style={microLabel}>Variables</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>
                        {Object.entries(selected.variables).map(([pos, name]) => (
                          <span key={pos} style={{
                            fontSize: 10, color: '#4a4742',
                            background: '#f5f3ef', borderRadius: 5,
                            padding: '3px 7px', fontFamily: 'monospace'
                          }}>
                            {`{{${pos}}}`} = {name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div style={{
                    paddingTop: 14, borderTop: '0.5px solid #f5f3ef',
                    display: 'flex', gap: 8, justifyContent: 'flex-end'
                  }}>
                    <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
                    <Btn
                      variant="suggested"
                      onClick={() => onSelect && onSelect(selected)}
                    >
                      Use this template
                    </Btn>
                  </div>
                </div>

                <div style={{ position: 'sticky', top: 0 }}>
                  <div style={microLabel}>Preview</div>
                  <div style={{ marginTop: 8 }}>
                    <IPhonePreview
                      body={renderPreview(selected)}
                      buttons={selected.buttons || []}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div style={{
                padding: 40, color: '#9a958c', fontSize: 12,
                textAlign: 'center'
              }}>
                Select a template to preview.
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  )
}

const selectStyle = {
  padding: '8px 10px', border: '0.5px solid #dcd8d0', borderRadius: 8,
  fontSize: 12, outline: 'none', background: '#fff', color: '#14130f',
  cursor: 'pointer'
}

const microLabel = {
  fontSize: 10, fontWeight: 600, color: '#6e6a63',
  textTransform: 'uppercase', letterSpacing: '0.6px'
}