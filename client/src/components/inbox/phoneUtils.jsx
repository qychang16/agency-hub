// Shared phone-input helpers + low-level form primitives used by
// NewContactModal and QuickStartModal. Kept as .jsx because Field is JSX.
import { AsYouType, parsePhoneNumberFromString, getExampleNumber } from 'libphonenumber-js'
import examples from 'libphonenumber-js/examples.mobile.json'
import { ink, accent, semantic, fonts, textSize, textWeight, space, radius } from '../../utils/designTokens'

// Country list — order matters (SG first as default, then by relevance to SG employment agency)
export const COUNTRIES = [
  { iso: 'SG', code: '+65',  name: 'Singapore' },
  { iso: 'MY', code: '+60',  name: 'Malaysia' },
  { iso: 'ID', code: '+62',  name: 'Indonesia' },
  { iso: 'CN', code: '+86',  name: 'China' },
  { iso: 'IN', code: '+91',  name: 'India' },
  { iso: 'PH', code: '+63',  name: 'Philippines' },
  { iso: 'VN', code: '+84',  name: 'Vietnam' },
  { iso: 'TH', code: '+66',  name: 'Thailand' },
  { iso: 'HK', code: '+852', name: 'Hong Kong' },
  { iso: 'TW', code: '+886', name: 'Taiwan' },
  { iso: 'JP', code: '+81',  name: 'Japan' },
  { iso: 'KR', code: '+82',  name: 'South Korea' },
  { iso: 'US', code: '+1',   name: 'United States' },
  { iso: 'GB', code: '+44',  name: 'United Kingdom' },
  { iso: 'AU', code: '+61',  name: 'Australia' },
  { iso: 'CA', code: '+1',   name: 'Canada' },
  { iso: 'NZ', code: '+64',  name: 'New Zealand' },
  { iso: 'AE', code: '+971', name: 'UAE' },
  { iso: 'SA', code: '+966', name: 'Saudi Arabia' },
]

export function toTitleCase(str) {
  if (!str) return ''
  return str.trim().toLowerCase().replace(/(^|\s|-|'|\()\S/g, c => c.toUpperCase())
}

export function formatPhoneAsYouType(raw, iso) {
  if (!raw) return ''
  const formatter = new AsYouType(iso)
  return formatter.input(raw)
}

export function normalizePhone(raw, iso) {
  if (!raw) return null
  const parsed = parsePhoneNumberFromString(raw, iso)
  return parsed && parsed.isValid() ? parsed.number : null
}

export function displayPhone(raw, iso) {
  if (!raw) return ''
  const parsed = parsePhoneNumberFromString(raw, iso)
  return parsed && parsed.isValid() ? parsed.formatInternational() : raw
}

export function getExampleForCountry(iso) {
  const example = getExampleNumber(iso, examples)
  return example ? example.formatInternational() : ''
}

export function Field({ label, required, error, children }) {
  return (
    <div style={{ marginBottom: space[3] }}>
      <label style={{
        display: 'block',
        fontSize: 10,
        fontWeight: textWeight.semibold,
        color: ink[700],
        marginBottom: space[1] + 1,
        letterSpacing: '0.4px',
        textTransform: 'uppercase',
        fontFamily: fonts.body,
      }}>
        {label}{required && <span style={{ color: semantic.danger, marginLeft: 3 }}>*</span>}
      </label>
      {children}
      {error && (
        <div style={{
          fontSize: 10,
          color: semantic.danger,
          marginTop: 3,
          fontFamily: fonts.body,
          fontWeight: textWeight.medium,
        }}>{error}</div>
      )}
    </div>
  )
}

export const inputBase = {
  width: '100%',
  padding: '8px 10px',
  fontSize: textSize.sm,
  fontFamily: 'inherit',
  background: ink[100],
  color: ink[800],
  border: `0.5px solid ${ink[300]}`,
  borderRadius: radius.md,
  outline: 'none',
  boxSizing: 'border-box',
}
export const inputFocus = { borderColor: accent.DEFAULT, background: '#fff' }