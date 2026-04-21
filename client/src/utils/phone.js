import { PHONE_RULES } from './constants'

export function phonePlaceholder(code) {
  return PHONE_RULES[code] ? PHONE_RULES[code].hint : 'Enter number'
}

export function validatePhone(code, phone) {
  const digits = phone.replace(/[\s\-]/g, '')
  const rule = PHONE_RULES[code]
  if (!rule) return ''
  if (digits.length === 0) return 'Phone number is required'
  if (digits.length < rule.digits) return `Too short — ${code} numbers need ${rule.digits} digits (you entered ${digits.length})`
  if (digits.length > rule.digits + 1) return `Too long — ${code} numbers need ${rule.digits} digits (you entered ${digits.length})`
  return ''
}

export function formatFullPhone(code, phone) {
  return code + phone.replace(/[\s\-]/g, '')
}

export function splitPhone(fullPhone) {
  if (!fullPhone) return { code: '+65', number: '' }
  const codes = ['+966','+971','+886','+853','+852','+65','+60','+62','+63','+66','+84','+86','+91','+81','+82','+44','+64','+61','+1']
  for (const code of codes) {
    if (fullPhone.startsWith(code)) {
      return { code, number: fullPhone.slice(code.length) }
    }
  }
  return { code: '+65', number: fullPhone }
}

export function maskPhone(fullPhone) {
  if (!fullPhone) return ''
  const { code, number } = splitPhone(fullPhone)
  if (number.length <= 4) return code + ' ' + number
  return code + ' ' + '*'.repeat(number.length - 4) + number.slice(-4)
}

export function isValidWhatsAppNumber(fullPhone) {
  if (!fullPhone) return false
  const { code, number } = splitPhone(fullPhone)
  const rule = PHONE_RULES[code]
  if (!rule) return false
  const digits = number.replace(/[\s\-]/g, '')
  return digits.length >= rule.digits && digits.length <= rule.digits + 1
}