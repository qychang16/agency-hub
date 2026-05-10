// ─── PASSWORD POLICY (Chunk 30) ────────────────────────────────────────────
// Single source of truth for Tel-Cloud password rules.
// Mirror at client/src/utils/passwordPolicy.js — keep in sync.

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

const MIN_LENGTH = 8
const MAX_LENGTH = 128

function validatePassword(password, userEmail) {
  const errors = []
  const checks = {
    minLength: false, hasUpper: false, hasLower: false,
    hasNumber: false, hasSpecial: false, notEmail: true, notCommon: true,
  }

  if (typeof password !== 'string' || password.length === 0) {
    errors.push('Password is required.')
    return { valid: false, errors, checks }
  }

  checks.minLength = password.length >= MIN_LENGTH
  if (!checks.minLength) errors.push(`Password must be at least ${MIN_LENGTH} characters.`)
  if (password.length > MAX_LENGTH) errors.push(`Password must be ${MAX_LENGTH} characters or fewer.`)

  checks.hasUpper = RE_UPPER.test(password)
  if (!checks.hasUpper) errors.push('Password must contain at least one uppercase letter (A-Z).')

  checks.hasLower = RE_LOWER.test(password)
  if (!checks.hasLower) errors.push('Password must contain at least one lowercase letter (a-z).')

  checks.hasNumber = RE_NUMBER.test(password)
  if (!checks.hasNumber) errors.push('Password must contain at least one number (0-9).')

  checks.hasSpecial = RE_SPECIAL.test(password)
  if (!checks.hasSpecial) errors.push('Password must contain at least one special character (!@#$ etc.).')

  if (userEmail && password.toLowerCase() === String(userEmail).toLowerCase()) {
    checks.notEmail = false
    errors.push('Password cannot be the same as your email address.')
  }

  if (COMMON_PASSWORDS.has(password)) {
    checks.notCommon = false
    errors.push('This password is too common. Choose something more unique.')
  }

  return { valid: errors.length === 0, errors, checks }
}

function generateRandomPassword(length = 12) {
  const len = Math.max(MIN_LENGTH, length)
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const lower = 'abcdefghijkmnpqrstuvwxyz'
  const number = '23456789'
  const special = '!@#$%^&*-_=+'

  const crypto = require('crypto')
  function pick(charset) { return charset[crypto.randomInt(0, charset.length)] }

  const required = [pick(upper), pick(lower), pick(number), pick(special)]
  const all = upper + lower + number + special
  const rest = []
  for (let i = required.length; i < len; i++) rest.push(pick(all))

  const out = [...required, ...rest]
  for (let i = out.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1)
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out.join('')
}

module.exports = { validatePassword, generateRandomPassword, MIN_LENGTH, MAX_LENGTH }