import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { API } from '../utils/constants'
import Modal from './ui/Modal'
import Button from './ui/Button'
import IPhonePreview from './IPhonePreview'

function prettify(value) {
  if (!value) return ''
  return value.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

export default function MetaLibraryModal({ open, onClose, onInstalled }) {
  const { token } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [templates, setTemplates] = useState([])
  const [filters, setFilters] = useState({ industries: [], topics: [], usecases: [], languages: [] })
  const [selectedName, setSelectedName] = useState(null)
  const [search, setSearch] = useState('')
  const [activeIndustry, setActiveIndustry] = useState('all')
  const [activeTopic, setActiveTopic] = useState('all')
  const [activeUsecase, setActiveUsecase] = useState('all')

  const [customName, setCustomName] = useState('')
  const [installing, setInstalling] = useState(false)
  const [installError, setInstallError] = useState('')

  useEffect(() => {
    if (!open) return
    setLoading(true)
    setError('')
    fetch(`${API}/api/meta-library`, { headers: { Authorization: 'Bearer ' + token } })
      .then(r => {
        if (!r.ok) throw new Error('Failed to load Meta library')
        return r.json()
      })
      .then(data => {
        setTemplates(data.templates || [])
        setFilters(data.filters || { industries: [], topics: [], usecases: [], languages: [] })
        if ((data.templates || []).length > 0) setSelectedName(data.templates[0].name)
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [open, token])

  const filtered = useMemo(() => {
    return templates.filter(t => {
      if (activeIndustry !== 'all') {
        if (!Array.isArray(t.industry) || !t.industry.includes(activeIndustry)) return false
      }
      if (activeTopic !== 'all' && t.topic !== activeTopic) return false
      if (activeUsecase !== 'all' && t.usecase !== activeUsecase) return false
      if (search.trim()) {
        const q = search.toLowerCase()
        const hay = `${t.name} ${t.header || ''} ${t.body} ${t.usecase} ${t.topic}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [templates, activeIndustry, activeTopic, activeUsecase, search])

  const selected = filtered.find(t => t.name === selectedName)
    || templates.find(t => t.name === selectedName)
    || null

  const renderPreview = (tpl) => {
    if (!tpl) return ''
    let out = tpl.body || ''
    if (Array.isArray(tpl.body_params)) {
      tpl.body_params.forEach((sample, idx) => {
        const placeholder = new RegExp(`\\{\\{${idx + 1}\\}\\}`, 'g')
        out = out.replace(placeholder, sample)
      })
    }
    return out
  }

  useEffect(() => {
    setInstallError('')
    if (selected) setCustomName(selected.name)
  }, [selectedName])

  const handleInstall = async () => {
    if (!selected) return
    if (!customName.trim()) {
      setInstallError('Please provide a name for this template')
      return
    }
    const nameClean = customName.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_')
    if (nameClean !== customName.trim()) {
      setInstallError('Name must be lowercase, alphanumeric and underscores only')
      return
    }

    setInstalling(true)
    setInstallError('')
    try {
      const res = await fetch(`${API}/api/meta-library/install`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token
        },
        body: JSON.stringify({
          library_template_name: selected.name,
          custom_name: customName.trim(),
          language: selected.language || 'en_US'
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Install failed')
      if (typeof onInstalled === 'function') onInstalled(data)
      onClose()
    } catch (err) {
      setInstallError(err.message)
    } finally {
      setInstalling(false)
    }
  }

  if (!open) return null

  return (
    <Modal
      title="Meta Template Library"
      subtitle="Pre-approved by Meta. Install instantly, no review wait. Body content is locked."
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
        <select value={activeIndustry} onChange={e => setActiveIndustry(e.target.value)} style={selectStyle}>
          <option value="all">All industries</option>
          {filters.industries.map(i => <option key={i} value={i}>{prettify(i)}</option>)}
        </select>
        <select value={activeTopic} onChange={e => setActiveTopic(e.target.value)} style={selectStyle}>
          <option value="all">All topics</option>
          {filters.topics.map(t => <option key={t} value={t}>{prettify(t)}</option>)}
        </select>
        <select value={activeUsecase} onChange={e => setActiveUsecase(e.target.value)} style={selectStyle}>
          <option value="all">All use cases</option>
          {filters.usecases.map(u => <option key={u} value={u}>{prettify(u)}</option>)}
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
          Loading Meta library...
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
                const isSelected = t.name === selectedName
                return (
                  <div
                    key={t.name}
                    onClick={() => setSelectedName(t.name)}
                    style={{
                      padding: '12px 14px', cursor: 'pointer',
                      background: isSelected ? '#fff' : 'transparent',
                      borderLeft: `3px solid ${isSelected ? '#1877f2' : 'transparent'}`,
                      borderBottom: '0.5px solid #f5f3ef'
                    }}
                  >
                    <div style={{
                      fontSize: 12, fontWeight: 600, color: '#14130f',
                      marginBottom: 3
                    }}>
                      {prettify(t.name)}
                    </div>
                    <div style={{ fontSize: 10, color: '#6e6a63' }}>
                      {prettify(t.usecase)}
                      {Array.isArray(t.industry) && t.industry.length > 0 && (
                        <>
                          {' '}<span style={{ color: '#9a958c' }}>{'\u00b7'}</span>{' '}
                          {prettify(t.industry[0])}
                        </>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Right preview + install */}
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
                    {selected.topic && (
                      <>
                        {' '}<span style={{ color: '#9a958c' }}>{'\u00b7'}</span>{' '}
                        {prettify(selected.topic)}
                      </>
                    )}
                  </div>
                  <div style={{
                    fontSize: 16, fontWeight: 700, color: '#14130f',
                    marginTop: 4, marginBottom: 12
                  }}>
                    {prettify(selected.name)}
                  </div>

                  <div style={{
                    fontSize: 11, color: '#6e6a63',
                    background: '#faf9f7', border: '0.5px solid #dcd8d0',
                    borderRadius: 8, padding: '8px 12px', marginBottom: 14,
                    display: 'flex', alignItems: 'center', gap: 8
                  }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
                      strokeLinejoin="round">
                      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                    Body content is locked by Meta. Only buttons and parameters are customisable on send.
                  </div>

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
                  </div>

                  {Array.isArray(selected.buttons) && selected.buttons.length > 0 && (
                    <div style={{ marginBottom: 14 }}>
                      <div style={microLabel}>Buttons</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 6 }}>
                        {selected.buttons.map((b, i) => (
                          <div key={i} style={{
                            fontSize: 11, color: '#4a4742',
                            background: '#fff', border: '0.5px solid #dcd8d0',
                            borderRadius: 6, padding: '6px 10px',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                          }}>
                            <span style={{ fontWeight: 500 }}>{b.text}</span>
                            <span style={{
                              fontSize: 9, color: '#9a958c',
                              textTransform: 'uppercase', letterSpacing: '0.4px'
                            }}>
                              {b.type}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {Array.isArray(selected.body_params) && selected.body_params.length > 0 && (
                    <div style={{ marginBottom: 14 }}>
                      <div style={microLabel}>Sample Variables</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>
                        {selected.body_params.map((sample, idx) => (
                          <span key={idx} style={{
                            fontSize: 10, color: '#4a4742',
                            background: '#f5f3ef', borderRadius: 5,
                            padding: '3px 7px', fontFamily: 'monospace'
                          }}>
                            {`{{${idx + 1}}}`} = {sample}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Install panel */}
                  <div style={{
                    background: '#faf9f7', border: '0.5px solid #dcd8d0',
                    borderRadius: 10, padding: 14, marginBottom: 14
                  }}>
                    <div style={{ ...microLabel, marginBottom: 8 }}>Install to your workspace</div>
                    <label style={{
                      display: 'block', fontSize: 11, color: '#6e6a63', marginBottom: 4
                    }}>
                      Template name (lowercase, underscores, no spaces)
                    </label>
                    <input
                      type="text"
                      value={customName}
                      onChange={e => setCustomName(e.target.value)}
                      placeholder="e.g. order_confirmation"
                      style={{
                        width: '100%', padding: '9px 12px',
                        border: '0.5px solid #dcd8d0', borderRadius: 8,
                        fontSize: 12, outline: 'none', background: '#fff',
                        color: '#14130f', boxSizing: 'border-box',
                        fontFamily: 'monospace', marginBottom: 8
                      }}
                    />
                    {installError && (
                      <div style={{ fontSize: 11, color: '#dc2626', marginBottom: 8 }}>
                        ⚠ {installError}
                      </div>
                    )}
                  </div>

                  <div style={{
                    paddingTop: 14, borderTop: '0.5px solid #f5f3ef',
                    display: 'flex', gap: 8, justifyContent: 'flex-end'
                  }}>
                    <Button variant="secondary" onClick={onClose}>Cancel</Button>
                    <Button variant="primary" onClick={handleInstall} loading={installing}>
                      {installing ? 'Installing...' : 'Install template'}
                    </Button>
                  </div>
                </div>

                <div style={{ position: 'sticky', top: 0 }}>
                  <div style={microLabel}>Preview</div>
                  <div style={{ marginTop: 8 }}>
                    <IPhonePreview
                      body={renderPreview(selected)}
                      header={selected.header}
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