// ─── PASSWORD POLICY — FRONTEND MIRROR (Chunk 30) ─────────────────────────
// This is the client-side mirror of server/utils/passwordPolicy.js.
// The SERVER is the source of truth — this file exists purely to give the
// user live feedback as they type. All real validation happens server-side.
//
// If you change rules on the server, update this file too.

const COMMON_PASSWORDS = new Set([
  'Password1!', 'Password123!', 'Password@123', 'P@ssword1', 'P@ssw0rd!',
  'Welcome@123', 'Welcome123!', 'Welcome1!', 'Welcome2024!', 'Welcome2025!',
  'Welcome2026!', 'Admin@123', 'Admin123!', 'Admin1234!', 'Qwerty@123',
  'Qwerty123!', 'Qwerty1!', 'Qwertyuiop1!', 'Letmein@1', 'Letmein123!',
  'Iloveyou1!', 'Iloveyou@1', 'Abc12345!', 'Abc@1234', 'Abcd1234!',
  'Asdf1234!', 'Asdf@123', 'Zxcv1234!', '1qaz@WSX', '1qaz!QAZ',
  'Q1w2e3r4!', 'Qaz@wsx1', 'Master@123', 'Master1!', 'Monkey123!',
  'Dragon123!', 'Football1!', 'Sunshine1!', 'Princess1!', 'Trustno1!',
  'Password!1', 'Pass@word1', 'Passw0rd!', 'Test@1234', 'Test1234!',
  'User@1234', 'User1234!', 'Login@123', 'Login123!', 'Account@1',
  'Hello@123', 'Hello123!', 'Singapore1!', 'Singapore@1', 'Singapore@123',
  'Telcloud@1', 'Telcloud1!', 'Telcloud@123', 'Recruitment1!', 'Agency@123',
  'Company1!', 'Company@123', 'Welcome@1234', 'Welcome@12345', 'Changeme1!',
  'Changeme@1', 'Default1!', 'Default@123', 'Initial@1', 'Initial123!',
  'Newpass1!', 'Newpass@1', 'Mypass@1', 'Mypass123!', 'Secret@1',
  'Secret123!', 'Manager1!', 'Manager@1', 'Manager@123', 'Director@1',
  'Director1!', 'Director@123', 'Consultant1!', 'Consultant@1', 'Staff@123',
  'Staff1234!', 'Office@123', 'Office1!', 'Work@1234', 'Work123!',
  'Login1234!', 'Hello1234!', 'Test@4321', 'Pass1234!', 'Abcd@1234',
  'P@ssw0rd1', 'P@ssword!', 'Password!', 'Password@', 'Password#1',
])

const RE_UPPER = /[A-Z]/
const RE_LOWER = /[a-z]/
const RE_NUMBER = /[0-9]/
const RE_SPECIAL = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~`]/

export const MIN_LENGTH = 8
export const MAX_LENGTH = 128

export function validatePassword(password, userEmail) {
  const errors = []
  const checks = {
    minLength: false, hasUpper: false, hasLower: false,
    hasNumber: false, hasSpecial: false, notEmail: true, notCommon: true,
  }

  if (typeof password !== 'string' || password.length === 0) {
    return { valid: false, errors: ['Password is required.'], checks }
  }

  checks.minLength = password.length >= MIN_LENGTH
  if (!checks.minLength) errors.push(`At least ${MIN_LENGTH} characters`)
  if (password.length > MAX_LENGTH) errors.push(`No more than ${MAX_LENGTH} characters`)

  checks.hasUpper = RE_UPPER.test(password)
  if (!checks.hasUpper) errors.push('At least one uppercase letter')

  checks.hasLower = RE_LOWER.test(password)
  if (!checks.hasLower) errors.push('At least one lowercase letter')

  checks.hasNumber = RE_NUMBER.test(password)
  if (!checks.hasNumber) errors.push('At least one number')

  checks.hasSpecial = RE_SPECIAL.test(password)
  if (!checks.hasSpecial) errors.push('At least one special character')

  if (userEmail && password.toLowerCase() === String(userEmail).toLowerCase()) {
    checks.notEmail = false
    errors.push('Password cannot equal your email')
  }

  if (COMMON_PASSWORDS.has(password)) {
    checks.notCommon = false
    errors.push('This password is too common')
  }

  return { valid: errors.length === 0, errors, checks }
}

export function passwordStrengthScore(password) {
  if (!password) return 0
  let score = 0
  if (password.length >= MIN_LENGTH) score++
  if (RE_UPPER.test(password)) score++
  if (RE_LOWER.test(password)) score++
  if (RE_NUMBER.test(password)) score++
  if (RE_SPECIAL.test(password)) score++
  if (password.length >= 14 && score === 5) score = 5
  return score
}