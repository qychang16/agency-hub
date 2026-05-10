import { useMemo } from 'react'
import { validatePassword, passwordStrengthScore } from '../../utils/passwordPolicy'

// ─── PASSWORD STRENGTH METER (Chunk 30) ─────────────────────────────────────
// Live feedback component. Shows:
//   - 5-segment strength bar (red/amber/green based on score)
//   - Tick/cross checklist for each rule
//
// Pass userEmail when available so the "not equal to email" rule can validate.
// Pass showChecklist={false} for compact contexts.

export default function PasswordStrengthMeter({ password, userEmail, showChecklist = true }) {
  const { valid, checks } = useMemo(
    () => validatePassword(password || '', userEmail),
    [password, userEmail]
  )
  const score = useMemo(() => passwordStrengthScore(password || ''), [password])

  // Color the strength bar based on score
  const strengthColor =
    score === 0 ? '#dcd8d0' :
    score <= 2 ? '#ef4444' :  // red — weak
    score <= 3 ? '#f59e0b' :  // amber — okay
    score <= 4 ? '#84cc16' :  // light green — good
    '#16a34a'                  // green — strong

  const strengthLabel =
    score === 0 ? '' :
    score <= 2 ? 'Weak' :
    score <= 3 ? 'Okay' :
    score <= 4 ? 'Good' :
    'Strong'

  return (
    <div style={{ marginTop: 8 }}>
      {/* Strength bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} style={{
            flex: 1, height: 4, borderRadius: 2,
            background: i <= score ? strengthColor : '#f0ede5',
            transition: 'background 0.2s',
          }} />
        ))}
      </div>

      {/* Strength label + count */}
      {password && (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#6e6a63', marginBottom: showChecklist ? 8 : 0 }}>
          <span>Password strength: <span style={{ color: strengthColor, fontWeight: 600 }}>{strengthLabel}</span></span>
          {valid && <span style={{ color: '#16a34a', fontWeight: 600 }}>✓ Meets all requirements</span>}
        </div>
      )}

      {/* Checklist */}
      {showChecklist && password && !valid && (
        <div style={{
          background: '#faf9f7', border: '0.5px solid #e8e5dc', borderRadius: 8,
          padding: '10px 12px', marginTop: 6,
        }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: '#9a958c', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 6 }}>
            Password requirements
          </div>
          <Rule pass={checks.minLength}>At least 8 characters</Rule>
          <Rule pass={checks.hasUpper}>One uppercase letter (A-Z)</Rule>
          <Rule pass={checks.hasLower}>One lowercase letter (a-z)</Rule>
          <Rule pass={checks.hasNumber}>One number (0-9)</Rule>
          <Rule pass={checks.hasSpecial}>One special character (!@#$ etc.)</Rule>
          {!checks.notEmail && <Rule pass={false}>Cannot equal your email</Rule>}
          {!checks.notCommon && <Rule pass={false}>This password is too common</Rule>}
        </div>
      )}
    </div>
  )
}

function Rule({ pass, children }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      fontSize: 11, color: pass ? '#16a34a' : '#6e6a63',
      lineHeight: 1.7,
    }}>
      <span style={{
        width: 14, height: 14, borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: pass ? '#dcfce7' : '#f5f3ef',
        color: pass ? '#16a34a' : '#9a958c',
        fontSize: 9, fontWeight: 700,
        flexShrink: 0,
      }}>
        {pass ? '✓' : '○'}
      </span>
      <span>{children}</span>
    </div>
  )
}