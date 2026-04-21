export function fmtSGT(isoString) {
  if (!isoString) return ''
  const d = new Date(isoString)
  return d.toLocaleString('en-GB', {
    timeZone: 'Asia/Singapore',
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false
  }) + ' SGT'
}

export function fmtSGTdate(isoString) {
  if (!isoString) return ''
  return new Date(isoString).toLocaleDateString('en-GB', {
    timeZone: 'Asia/Singapore',
    day: '2-digit', month: 'short', year: 'numeric'
  })
}

export function fmtSGTtime(isoString) {
  if (!isoString) return ''
  return new Date(isoString).toLocaleTimeString('en-GB', {
    timeZone: 'Asia/Singapore',
    hour: '2-digit', minute: '2-digit', hour12: false
  }) + ' SGT'
}

export function dateSGTiso(isoString) {
  if (!isoString) return ''
  return new Date(isoString).toLocaleDateString('en-CA', {
    timeZone: 'Asia/Singapore'
  })
}

export function nowSGTiso() {
  return new Date().toLocaleDateString('en-CA', {
    timeZone: 'Asia/Singapore'
  })
}

export function isFuture(isoString) {
  if (!isoString) return false
  return new Date(isoString) > new Date()
}

export function isPast(isoString) {
  if (!isoString) return false
  return new Date(isoString) < new Date()
}

export function minutesUntil(isoString) {
  if (!isoString) return 0
  return Math.round((new Date(isoString) - new Date()) / 60000)
}

export function hoursAgo(isoString) {
  if (!isoString) return 0
  return Math.round((new Date() - new Date(isoString)) / 3600000)
}

export function fmtDuration(minutes) {
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

export function sgtDatetimeLocal(isoString) {
  if (!isoString) return ''
  const d = new Date(isoString)
  const sgt = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Singapore' }))
  const pad = n => String(n).padStart(2, '0')
  return `${sgt.getFullYear()}-${pad(sgt.getMonth()+1)}-${pad(sgt.getDate())}T${pad(sgt.getHours())}:${pad(sgt.getMinutes())}`
}

export function localToSGT(datetimeLocalValue) {
  if (!datetimeLocalValue) return ''
  return new Date(datetimeLocalValue).toISOString()
}

export function getWeekday(isoString) {
  if (!isoString) return ''
  return new Date(isoString).toLocaleDateString('en-GB', {
    timeZone: 'Asia/Singapore', weekday: 'long'
  })
}

export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export function isWithinBusinessHours(businessHours) {
  if (!businessHours) return true
  const now = new Date()
  const day = now.toLocaleDateString('en-GB', { timeZone: 'Asia/Singapore', weekday: 'long' })
  const time = now.toLocaleTimeString('en-GB', { timeZone: 'Asia/Singapore', hour: '2-digit', minute: '2-digit', hour12: false })
  const todayHours = businessHours[day]
  if (!todayHours || !todayHours.open) return false
  return time >= todayHours.start && time <= todayHours.end
}