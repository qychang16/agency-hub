import { ACCENT, NAVY } from '../../utils/designTokens'

export default function Btn({ onClick, children, variant = 'primary', size = 'md', disabled, style: extra }) {
  const sizes = {
    sm: { padding: '5px 10px', fontSize: 11 },
    md: { padding: '8px 14px', fontSize: 12 }
  }
  const variants = {
    primary: { background: ACCENT, color: '#fff', border: 'none' },
    ghost: { background: 'transparent', color: '#6e6a63', border: '0.5px solid #dcd8d0' },
    danger: { background: '#fee2e2', color: '#dc2626', border: '0.5px solid #fca5a5' },
    dark: { background: NAVY, color: '#fff', border: 'none' },
    success: { background: '#dcfce7', color: '#16a34a', border: '0.5px solid #86efac' },
    suggested: { background: '#ede9fe', color: '#5b21b6', border: '0.5px solid #c4b5fd' },
    meta: { background: '#e7f0fd', color: '#1877f2', border: '0.5px solid #93c5fd' },
  }
  return (
    <button
      onClick={!disabled ? onClick : undefined}
      style={{
        ...sizes[size],
        ...variants[variant],
        borderRadius: 8,
        cursor: disabled ? 'default' : 'pointer',
        fontWeight: 500,
        opacity: disabled ? 0.6 : 1,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        ...extra
      }}
    >
      {children}
    </button>
  )
}