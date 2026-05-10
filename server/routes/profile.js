// ─── PROFILE SELF-SERVICE (Chunk 31) ────────────────────────────────────────
const crypto = require('crypto')
const bcrypt = require('bcrypt')
const { validatePassword } = require('../utils/passwordPolicy')
const { sendMail } = require('../utils/emailSender')

function generateToken() { return crypto.randomBytes(16).toString('hex') }
function hashToken(token) { return crypto.createHash('sha256').update(token).digest('hex') }

async function runChunk31ProfileMigration(pool) {
  const MIGRATION_ID = 'chunk_31_profile_self_service_v1'
  const applied = await pool.query('SELECT id FROM _migrations WHERE id=$1', [MIGRATION_ID])
  if (applied.rows.length > 0) {
    console.log(`Migration ${MIGRATION_ID} already applied, skipping`)
    return
  }
  console.log(`Running migration ${MIGRATION_ID}...`)
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    await client.query(`
      CREATE TABLE IF NOT EXISTS email_change_requests (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        old_email VARCHAR(255) NOT NULL,
        new_email VARCHAR(255) NOT NULL,
        token_hash VARCHAR(64) NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        confirmed_at TIMESTAMPTZ,
        cancelled_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `)
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_email_change_requests_token
      ON email_change_requests(token_hash)
    `)

    await client.query(`INSERT INTO _migrations (id) VALUES ($1)`, [MIGRATION_ID])
    await client.query('COMMIT')
    console.log(`Migration ${MIGRATION_ID} complete`)
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

function createProfileHandlers(pool, logAudit) {
  async function getMyProfile(req, res) {
    try {
      const r = await pool.query(`
        SELECT
          u.id, u.name, u.email, u.role, u.team_id, u.capacity, u.status,
          u.email_signature, u.send_behaviour, u.is_super_admin,
          u.last_login_at, u.created_at,
          t.name AS team_name, t.color AS team_color,
          w.name AS workspace_name
        FROM users u
        LEFT JOIN teams t ON t.id = u.team_id
        LEFT JOIN workspaces w ON w.id = u.workspace_id
        WHERE u.id = $1 LIMIT 1
      `, [req.user.id])
      if (!r.rows.length) return res.status(404).json({ error: 'User not found' })

      const pendingRes = await pool.query(`
        SELECT new_email, expires_at FROM email_change_requests
        WHERE user_id = $1 AND confirmed_at IS NULL AND cancelled_at IS NULL AND expires_at > NOW()
        ORDER BY created_at DESC LIMIT 1
      `, [req.user.id])

      res.json({ ...r.rows[0], pending_email_change: pendingRes.rows[0] || null })
    } catch (err) {
      console.error('GET /me/profile error:', err)
      res.status(500).json({ error: err.message })
    }
  }

  async function updateMyProfile(req, res) {
    try {
      const ALLOWED = ['name', 'email_signature', 'send_behaviour']
      const updates = []
      const values = []
      let idx = 1
      for (const field of ALLOWED) {
        if (!Object.prototype.hasOwnProperty.call(req.body, field)) continue
        let val = req.body[field]
        if (field === 'name') {
          if (!val || !String(val).trim()) return res.status(400).json({ error: 'Name cannot be empty' })
          val = String(val).trim()
        }
        if (field === 'send_behaviour' && !['enter', 'shift_enter'].includes(val)) {
          return res.status(400).json({ error: 'send_behaviour must be "enter" or "shift_enter"' })
        }
        updates.push(`${field} = $${idx++}`)
        values.push(val)
      }
      if (updates.length === 0) return res.status(400).json({ error: 'No valid fields provided to update' })
      updates.push('updated_at = NOW()')
      values.push(req.user.id)
      const r = await pool.query(
        `UPDATE users SET ${updates.join(', ')} WHERE id = $${idx} RETURNING id, name, email, email_signature, send_behaviour`,
        values
      )
      res.json(r.rows[0])
    } catch (err) {
      console.error('PATCH /me/profile error:', err)
      res.status(500).json({ error: err.message })
    }
  }

  async function changeMyPassword(req, res) {
    try {
      const { current_password, new_password } = req.body
      if (!current_password) return res.status(400).json({ error: 'Current password is required' })
      if (!new_password) return res.status(400).json({ error: 'New password is required' })

      const r = await pool.query(`SELECT id, email, password_hash FROM users WHERE id = $1`, [req.user.id])
      if (!r.rows.length) return res.status(404).json({ error: 'User not found' })
      const user = r.rows[0]

      const match = await bcrypt.compare(current_password, user.password_hash)
      if (!match) {
        await logAudit(null, req.user.id, 'change_password_failed', 'user', req.user.id, null, { reason: 'wrong_current_password' })
        return res.status(401).json({ error: 'Current password is incorrect' })
      }

      const { valid, errors } = validatePassword(new_password, user.email)
      if (!valid) {
        return res.status(400).json({
          error: 'New password does not meet requirements: ' + errors.join(' '),
          password_errors: errors,
        })
      }

      if (current_password === new_password) {
        return res.status(400).json({ error: 'New password must be different from your current password' })
      }

      const hash = await bcrypt.hash(new_password, 10)
      await pool.query(
        `UPDATE users SET password_hash = $1, force_password_change = false, updated_at = NOW() WHERE id = $2`,
        [hash, user.id]
      )
      await logAudit(null, user.id, 'change_password_success', 'user', user.id, null, {})
      res.json({ success: true })
    } catch (err) {
      console.error('POST /me/change-password error:', err)
      res.status(500).json({ error: err.message })
    }
  }

  async function requestEmailChange(req, res) {
    try {
      const { new_email, current_password } = req.body
      if (!new_email || !/\S+@\S+\.\S+/.test(new_email)) {
        return res.status(400).json({ error: 'A valid new email address is required' })
      }
      if (!current_password) return res.status(400).json({ error: 'Current password is required to change email' })

      const cleanNewEmail = new_email.trim().toLowerCase()

      const userRes = await pool.query(`SELECT id, email, password_hash FROM users WHERE id = $1`, [req.user.id])
      if (!userRes.rows.length) return res.status(404).json({ error: 'User not found' })
      const user = userRes.rows[0]

      if (cleanNewEmail === user.email.toLowerCase()) {
        return res.status(400).json({ error: 'New email is the same as your current email' })
      }

      const match = await bcrypt.compare(current_password, user.password_hash)
      if (!match) return res.status(401).json({ error: 'Current password is incorrect' })

      const dup = await pool.query(`SELECT id FROM users WHERE LOWER(email) = $1 AND id != $2 LIMIT 1`, [cleanNewEmail, user.id])
      if (dup.rows.length > 0) {
        return res.status(409).json({ error: 'That email is already in use by another account' })
      }

      await pool.query(
        `UPDATE email_change_requests SET cancelled_at = NOW()
         WHERE user_id = $1 AND confirmed_at IS NULL AND cancelled_at IS NULL`,
        [user.id]
      )

      const rawToken = generateToken()
      const tokenHash = hashToken(rawToken)
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000)

      await pool.query(`
        INSERT INTO email_change_requests (user_id, old_email, new_email, token_hash, expires_at)
        VALUES ($1, $2, $3, $4, $5)
      `, [user.id, user.email, cleanNewEmail, tokenHash, expiresAt])

      const baseUrl = process.env.INVITATION_BASE_URL || 'https://app.tel-cloud.sg'
      const confirmUrl = `${baseUrl}/verify-email/${rawToken}`

      try {
        await sendMail({
          to: cleanNewEmail,
          subject: 'Confirm your new Tel-Cloud email',
          html: `<p>Hi,</p><p>You're updating your Tel-Cloud account email to this address. Click the link below to confirm. Expires in 1 hour.</p><p><a href="${confirmUrl}">Confirm email change</a></p><p>If you didn't request this, you can ignore this email.</p>`,
          text: `Confirm your Tel-Cloud email change\n\nVisit: ${confirmUrl}\n\nExpires in 1 hour. If you didn't request this, ignore this email.`,
        })
      } catch (err) { console.error('change-email confirm send failed:', err.message) }

      try {
        await sendMail({
          to: user.email,
          subject: 'Your Tel-Cloud email is being changed',
          html: `<p>Hi,</p><p>A request to change your Tel-Cloud account email to <strong>${cleanNewEmail}</strong> was just submitted.</p><p>If this was you, no action needed — once you confirm from the new address, the change will take effect.</p><p>If this was NOT you, sign in immediately and change your password. Then contact your director.</p>`,
          text: `Your Tel-Cloud email change\n\nA request to change your email to ${cleanNewEmail} was submitted. If this was NOT you, sign in immediately and change your password.`,
        })
      } catch (err) { console.error('change-email warn send failed:', err.message) }

      await logAudit(null, user.id, 'email_change_requested', 'user', user.id, null, {
        old_email: user.email, new_email: cleanNewEmail
      })

      res.json({ success: true, new_email: cleanNewEmail, expires_at: expiresAt })
    } catch (err) {
      console.error('POST /me/change-email error:', err)
      res.status(500).json({ error: err.message })
    }
  }

  async function verifyEmailChange(req, res) {
    try {
      const tokenHash = hashToken(req.params.token)
      const r = await pool.query(`SELECT * FROM email_change_requests WHERE token_hash = $1 LIMIT 1`, [tokenHash])
      if (!r.rows.length) return res.status(404).json({ error: 'invalid', message: 'This confirmation link is not valid.' })
      const req_ = r.rows[0]
      if (req_.cancelled_at) return res.status(410).json({ error: 'cancelled', message: 'This change request was cancelled.' })
      if (req_.confirmed_at) return res.status(410).json({ error: 'already_used', message: 'This link has already been used.' })
      if (new Date(req_.expires_at) < new Date()) {
        return res.status(410).json({ error: 'expired', message: 'This link has expired. Please request a new email change.' })
      }

      const dup = await pool.query(`SELECT id FROM users WHERE LOWER(email) = $1 AND id != $2 LIMIT 1`, [req_.new_email.toLowerCase(), req_.user_id])
      if (dup.rows.length > 0) {
        return res.status(409).json({ error: 'email_taken', message: 'That email was just taken by another account. Please use a different one.' })
      }

      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        await client.query(`UPDATE users SET email = $1, updated_at = NOW() WHERE id = $2`, [req_.new_email, req_.user_id])
        await client.query(`UPDATE email_change_requests SET confirmed_at = NOW() WHERE id = $1`, [req_.id])
        await client.query('COMMIT')
      } catch (err) {
        await client.query('ROLLBACK')
        throw err
      } finally {
        client.release()
      }

      await logAudit(null, req_.user_id, 'email_change_confirmed', 'user', req_.user_id, null, {
        old_email: req_.old_email, new_email: req_.new_email
      })

      res.json({ success: true, new_email: req_.new_email })
    } catch (err) {
      console.error('POST /me/verify-email/:token error:', err)
      res.status(500).json({ error: 'server_error', message: 'Something went wrong. Please try again.' })
    }
  }

  return { getMyProfile, updateMyProfile, changeMyPassword, requestEmailChange, verifyEmailChange }
}

module.exports = { createProfileHandlers, runChunk31ProfileMigration }