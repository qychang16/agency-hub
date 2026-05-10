// ─── EMAIL SENDER (Chunks 30 + 31) ──────────────────────────────────────────
// Wraps Nodemailer with Google Workspace SMTP.

const nodemailer = require('nodemailer')

let _transporter = null

function getTransporter() {
  if (_transporter) return _transporter

  const user = process.env.GMAIL_SMTP_USER
  const pass = process.env.GMAIL_SMTP_APP_PASSWORD

  if (!user || !pass) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('GMAIL_SMTP_USER and GMAIL_SMTP_APP_PASSWORD must be set in production')
    }
    console.warn('[email] No SMTP credentials configured. Emails will be logged to console only.')
    _transporter = {
      sendMail: async (opts) => {
        console.log('═══════════════ DEV EMAIL ═══════════════')
        console.log('To:      ', opts.to)
        console.log('From:    ', opts.from)
        console.log('Subject: ', opts.subject)
        console.log('─── HTML preview (first 500 chars) ───')
        console.log((opts.html || '').slice(0, 500))
        console.log('─── Plain text ───')
        console.log(opts.text)
        console.log('═════════════════════════════════════════')
        return { messageId: 'dev-noop-' + Date.now() }
      }
    }
    return _transporter
  }

  _transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user, pass },
    pool: true,
    maxConnections: 3,
    maxMessages: 100,
  })

  return _transporter
}

async function sendMail({ to, subject, html, text, replyTo }) {
  if (!to || !subject || (!html && !text)) {
    throw new Error('sendMail requires to, subject, and html or text')
  }
  const fromUser = process.env.GMAIL_SMTP_USER || 'noreply@tel-cloud.sg'
  const transporter = getTransporter()
  const info = await transporter.sendMail({
    from: `"Tel-Cloud" <${fromUser}>`,
    to, subject, html, text,
    replyTo: replyTo || 'support@tel-cloud.sg',
  })
  console.log(`[email] Sent "${subject}" to ${to} (messageId: ${info.messageId})`)
  return info
}

module.exports = { sendMail }