// ─── EMAIL SENDER (Chunk 30+31, Resend revision) ─────────────────────────
// Sends transactional emails via Resend's HTTPS API.
//
// We switched from Nodemailer SMTP to Resend because:
//   - Railway blocks outbound SMTP ports (25, 465, 587) on Hobby plans
//   - Resend uses HTTPS (port 443) which is never blocked
//   - Better deliverability than ad-hoc Gmail SMTP for transactional email
//
// Falls back to Nodemailer Gmail SMTP if RESEND_API_KEY is unset (legacy mode).
// Lazy-loaded singleton — the client is created on first send call.
//
// Signature matches what routes/invitations.js and routes/profile.js call:
//   sendMail({ to, subject, html, text, replyTo })

// Email source identity (used in From: header)
const FROM_NAME = 'Tel-Cloud'
const FROM_EMAIL = process.env.GMAIL_SMTP_USER || 'noreply@tel-cloud.sg'

let _resendClient = null
let _nodemailerTransporter = null

// ─── Lazy initialization ─────────────────────────────────────────────────

function getResendClient() {
  if (_resendClient) return _resendClient
  if (!process.env.RESEND_API_KEY) return null
  const { Resend } = require('resend')
  _resendClient = new Resend(process.env.RESEND_API_KEY)
  return _resendClient
}

function getNodemailerTransporter() {
  if (_nodemailerTransporter) return _nodemailerTransporter
  const user = process.env.GMAIL_SMTP_USER
  const pass = process.env.GMAIL_SMTP_APP_PASSWORD
  if (!user || !pass) return null
  const nodemailer = require('nodemailer')
  _nodemailerTransporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    family: 4,
    port: 587,
    secure: false,
    requireTLS: true,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000,
    auth: { user, pass },
    pool: true,
    maxConnections: 3,
    maxMessages: 100,
  })
  return _nodemailerTransporter
}

// ─── Main send function ──────────────────────────────────────────────────
// Called by routes/invitations.js and routes/profile.js.

async function sendMail({ to, subject, html, text, replyTo }) {
  if (!to || !subject) {
    throw new Error('sendMail requires to and subject')
  }
  if (!html && !text) {
    throw new Error('sendMail requires at least one of html or text')
  }

  // Prefer Resend if configured (production path)
  const resend = getResendClient()
  if (resend) {
    return sendViaResend({ to, subject, html, text, replyTo })
  }

  // Fallback to Nodemailer Gmail SMTP (legacy local-dev path)
  const transporter = getNodemailerTransporter()
  if (transporter) {
    return sendViaNodemailer({ transporter, to, subject, html, text, replyTo })
  }

  // Last-resort dev mode: log to console instead of sending
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('[email] DRY RUN — no RESEND_API_KEY or GMAIL_SMTP_* set')
  console.log(`  To: ${to}`)
  console.log(`  Subject: ${subject}`)
  if (text) {
    console.log(`  Body (text preview, first 200 chars):`)
    console.log(`  ${text.slice(0, 200)}...`)
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  return { messageId: 'dry-run', dryRun: true }
}

// ─── Provider: Resend ────────────────────────────────────────────────────

async function sendViaResend({ to, subject, html, text, replyTo }) {
  const resend = getResendClient()
  const fromAddress = `${FROM_NAME} <${FROM_EMAIL}>`

  const payload = {
    from: fromAddress,
    to: Array.isArray(to) ? to : [to],
    subject,
    // Disable both kinds of tracking — invitation emails are transactional,
    // not marketing. Tracked-link rewrites trigger spam filters and look
    // suspicious in inbox previews.
    tracking: { click: false, open: false },
  }
  if (html) payload.html = html
  if (text) payload.text = text
  if (replyTo) payload.reply_to = replyTo

  const result = await resend.emails.send(payload)
  if (result.error) {
    throw new Error(`Resend API error: ${result.error.message || JSON.stringify(result.error)}`)
  }
  const messageId = result.data?.id || 'unknown'
  console.log(`[email] Sent "${subject}" to ${Array.isArray(to) ? to.join(', ') : to} via Resend (id: ${messageId})`)
  return { messageId, provider: 'resend' }
}

// ─── Provider: Nodemailer (legacy fallback) ──────────────────────────────

async function sendViaNodemailer({ transporter, to, subject, html, text, replyTo }) {
  const fromAddress = `"${FROM_NAME}" <${FROM_EMAIL}>`
  const info = await transporter.sendMail({
    from: fromAddress,
    to,
    subject,
    html: html || undefined,
    text: text || undefined,
    replyTo: replyTo || undefined,
  })
  console.log(`[email] Sent "${subject}" to ${to} via Nodemailer (messageId: ${info.messageId})`)
  return { messageId: info.messageId, provider: 'nodemailer' }
}

module.exports = { sendMail }