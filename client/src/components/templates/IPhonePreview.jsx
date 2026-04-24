export default function IPhonePreview({ body, buttons = [] }) {
  const now = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
  const highlighted = (body || '').replace(/\{\{(\w+)\}\}/g, (_, v) =>
    `<span style="background:#eeedf5;color:#2d2a7a;padding:1px 4px;border-radius:3px;font-weight:600;font-size:11px;">{{${v}}}</span>`
  )
  return (
    <div style={{ width: 260, flexShrink: 0 }}>
      <div style={{ width: 260, background: '#111', borderRadius: 40, padding: '10px 5px 14px', boxShadow: '0 25px 50px rgba(0,0,0,0.5)' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
          <div style={{ width: 90, height: 24, background: '#000', borderRadius: 20 }} />
        </div>
        <div style={{ background: '#ece5dd', borderRadius: 28, overflow: 'hidden', height: 500, display: 'flex', flexDirection: 'column' }}>
          <div style={{ background: '#075e54', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#128c7e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 11, color: '#fff', fontWeight: 700 }}>AH</span>
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#fff', fontWeight: 600 }}>Agency Hub</div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.75)' }}>online</div>
            </div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '10px 8px 8px' }}>
            <div style={{ textAlign: 'center', marginBottom: 8 }}>
              <span style={{ background: 'rgba(0,0,0,0.18)', color: '#fff', fontSize: 10, padding: '3px 10px', borderRadius: 10 }}>Today</span>
            </div>
            <div style={{ maxWidth: '88%' }}>
              <div style={{ background: '#fff', borderRadius: 8, borderTopLeftRadius: 2, padding: '8px 10px', boxShadow: '0 1px 2px rgba(0,0,0,0.12)' }}>
                {body ? <div style={{ fontSize: 12, color: '#111', lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }} dangerouslySetInnerHTML={{ __html: highlighted }} />
                  : <div style={{ fontSize: 12, color: '#aaa', fontStyle: 'italic' }}>Your message will appear here…</div>}
                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 3, marginTop: 5 }}>
                  <span style={{ fontSize: 10, color: '#999' }}>{now}</span>
                  <svg width="14" height="10" viewBox="0 0 18 10"><path d="M1 5l3 3 7-7" stroke="#53bdeb" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/><path d="M6 5l3 3 7-7" stroke="#53bdeb" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
              </div>
              {buttons.length > 0 && (
                <div style={{ marginTop: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {buttons.map((b, i) => (
                    <div key={i} style={{ background: '#fff', borderRadius: 8, padding: '9px 10px', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                      <span style={{ fontSize: 12, color: '#128c7e', fontWeight: 600 }}>{b.label || 'Button'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div style={{ background: '#f0f0f0', padding: '6px 8px', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <div style={{ flex: 1, background: '#fff', borderRadius: 18, padding: '5px 10px', fontSize: 10, color: '#aaa' }}>Message</div>
            <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#075e54', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="white"><path d="M2 21l21-9L2 3v7l15 2-15 2v7z"/></svg>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}>
          <div style={{ width: 90, height: 4, background: 'rgba(255,255,255,0.25)', borderRadius: 2 }} />
        </div>
      </div>
    </div>
  )
}