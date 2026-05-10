// ─── INVITATIONS (Chunk 30) ─────────────────────────────────────────────────
const crypto = require('crypto')
const bcrypt = require('bcrypt')
const fs = require('fs')
const path = require('path')

const { validatePassword } = require('../utils/passwordPolicy')
const { sendMail } = require('../utils/emailSender')

function generateToken() {
  return crypto.randomBytes(16).toString('hex')
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

function workspaceInitials(name) {
  if (!name) return '?'
  const skipWords = new Set(['pte', 'ltd', 'inc', 'llc', 'co', 'and', '&', 'the'])
  const words = name.split(/\s+/).filter(w => w.length > 0 && !skipWords.has(w.toLowerCase()))
  if (words.length === 0) return name.slice(0, 2).toUpperCase()
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

function firstName(fullName) {
  if (!fullName) return ''
  return fullName.trim().split(/\s+/)[0]
}

function prettifyRole(role) {
  if (!role) return 'Member'
  return role.split('_').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')
}

function interpolate(template, vars) {
  return template.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (match, key) => {
    const v = vars[key]
    return v === undefined || v === null ? match : String(v)
  })
}

async function runChunk30InvitationsMigration(pool) {
  const MIGRATION_ID = 'chunk_30_invitations_v1'
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
      CREATE TABLE IF NOT EXISTS invitations (
        id SERIAL PRIMARY KEY,
        workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        email VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL,
        team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL,
        token_hash VARCHAR(64) NOT NULL,
        invited_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        accepted_at TIMESTAMPTZ,
        cancelled_at TIMESTAMPTZ,
        cancelled_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        last_sent_at TIMESTAMPTZ DEFAULT NOW(),
        send_count INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_invitations_workspace_pending
      ON invitations(workspace_id, accepted_at, cancelled_at)
      WHERE accepted_at IS NULL AND cancelled_at IS NULL
    `)
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_invitations_token_hash
      ON invitations(token_hash)
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

function createInvitationHandlers(pool, logAudit, getWorkspaceId) {
  let _htmlTemplate = null
  let _textTemplate = null
  function loadTemplates() {
    if (!_htmlTemplate) {
      _htmlTemplate = fs.readFileSync(path.join(__dirname, '../emails/invitation.html'), 'utf8')
      _textTemplate = fs.readFileSync(path.join(__dirname, '../emails/invitation.txt'), 'utf8')
    }
    return { html: _htmlTemplate, text: _textTemplate }
  }

  async function buildEmailVars(invitation) {
    const wsRes = await pool.query(`SELECT name, address FROM workspaces WHERE id = $1`, [invitation.workspace_id])
    const ws = wsRes.rows[0] || { name: 'your team', address: null }

    let teamName = 'No team assigned'
    let teamColor = '#9a958c'
    if (invitation.team_id) {
      const teamRes = await pool.query(`SELECT name, color FROM teams WHERE id = $1`, [invitation.team_id])
      if (teamRes.rows.length) {
        teamName = teamRes.rows[0].name
        teamColor = teamRes.rows[0].color || '#9a958c'
      }
    }

    let inviterName = 'A teammate'
    let inviterRole = 'Director'
    if (invitation.invited_by_user_id) {
      const inviterRes = await pool.query(`SELECT name, role FROM users WHERE id = $1`, [invitation.invited_by_user_id])
      if (inviterRes.rows.length) {
        inviterName = inviterRes.rows[0].name || 'A teammate'
        inviterRole = prettifyRole(inviterRes.rows[0].role)
      }
    }

    let wsSubtitle = ''
    if (ws.address) wsSubtitle = String(ws.address).split('\n')[0].slice(0, 60)

    const baseUrl = process.env.INVITATION_BASE_URL || 'https://app.tel-cloud.sg'
    const acceptUrl = `${baseUrl}/invite/${invitation._raw_token}`
    const logoUrl = process.env.INVITATION_LOGO_URL || 'https://tel-cloud.sg/email-assets/tel-cloud-logo-40.png'

    return {
      workspace_name: ws.name,
      workspace_subtitle: wsSubtitle,
      workspace_initials: workspaceInitials(ws.name),
      invitee_first_name: firstName(invitation.name),
      invitee_full_name: invitation.name,
      inviter_name: inviterName,
      inviter_first_name: firstName(inviterName),
      inviter_role: inviterRole,
      role_label: prettifyRole(invitation.role),
      team_name: teamName,
      team_color: teamColor,
      accept_url: acceptUrl,
      logo_url: logoUrl,
    }
  }

  async function sendInvitationEmail(invitation) {
    const vars = await buildEmailVars(invitation)
    const { html, text } = loadTemplates()
    const renderedHtml = interpolate(html, vars)
    const renderedText = interpolate(text, vars)
    const subject = `${vars.inviter_first_name} invited you to join ${vars.workspace_name} on Tel-Cloud`
    return sendMail({ to: invitation.email, subject, html: renderedHtml, text: renderedText })
  }

  async function inviteAgent(req, res) {
    try {
      const wsId = await getWorkspaceId(req.user.id)
      const { name, email, role, team_id } = req.body

      if (!name || !name.trim()) return res.status(400).json({ error: 'Full name is required' })
      if (!email || !email.trim() || !/\S+@\S+\.\S+/.test(email)) {
        return res.status(400).json({ error: 'A valid email address is required' })
      }
      if (!role) return res.status(400).json({ error: 'Role is required' })

      const cleanEmail = email.trim().toLowerCase()
      const cleanName = name.trim()

      const existingUser = await pool.query(`SELECT id FROM users WHERE LOWER(email) = $1 LIMIT 1`, [cleanEmail])
      if (existingUser.rows.length > 0) {
        return res.status(409).json({
          error: `An account with ${cleanEmail} already exists. Use a different email, or contact Tel-Cloud support if this person is moving from another workspace.`
        })
      }

      const existingInvite = await pool.query(`
        SELECT id FROM invitations
        WHERE LOWER(email) = $1 AND workspace_id = $2
          AND accepted_at IS NULL AND cancelled_at IS NULL AND expires_at > NOW()
        LIMIT 1
      `, [cleanEmail, wsId])
      if (existingInvite.rows.length > 0) {
        return res.status(409).json({
          error: `An invitation to ${cleanEmail} is already pending. Resend it from the Pending Invitations panel, or cancel it before creating a new one.`
        })
      }

      let teamIdValue = null
      if (team_id !== undefined && team_id !== null && team_id !== '') {
        const teamCheck = await pool.query(`SELECT id FROM teams WHERE id = $1 AND workspace_id = $2`, [team_id, wsId])
        if (!teamCheck.rows.length) return res.status(404).json({ error: 'Team not found in this workspace' })
        teamIdValue = parseInt(team_id, 10)
      }

      const rawToken = generateToken()
      const tokenHash = hashToken(rawToken)
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)

      const insertRes = await pool.query(`
        INSERT INTO invitations
          (workspace_id, email, name, role, team_id, token_hash, invited_by_user_id, expires_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `, [wsId, cleanEmail, cleanName, role, teamIdValue, tokenHash, req.user.id, expiresAt])
      const invitation = insertRes.rows[0]
      invitation._raw_token = rawToken

      try {
        await sendInvitationEmail(invitation)
      } catch (mailErr) {
        console.error('Invitation email failed:', mailErr.message)
        await logAudit(wsId, req.user.id, 'invitation_send_failed', 'invitation', invitation.id, null, {
          email: cleanEmail, error: mailErr.message?.slice(0, 200)
        })
        return res.status(500).json({
          error: `Invitation created but email failed to send: ${mailErr.message}. You can resend it from the Pending Invitations panel.`,
          invitation_id: invitation.id
        })
      }

      await logAudit(wsId, req.user.id, 'invitation_sent', 'invitation', invitation.id, null, {
        email: cleanEmail, role, team_id: teamIdValue
      })

      delete invitation._raw_token
      delete invitation.token_hash
      res.json(invitation)
    } catch (err) {
      console.error('POST /agents/invite error:', err)
      res.status(500).json({ error: err.message })
    }
  }

  async function listInvitations(req, res) {
    try {
      const wsId = await getWorkspaceId(req.user.id)
      const r = await pool.query(`
        SELECT
          i.id, i.email, i.name, i.role, i.team_id,
          i.expires_at, i.last_sent_at, i.send_count, i.created_at,
          t.name AS team_name, t.color AS team_color,
          u.name AS invited_by_name,
          CASE WHEN i.expires_at < NOW() THEN 'expired' ELSE 'pending' END AS status
        FROM invitations i
        LEFT JOIN teams t ON t.id = i.team_id
        LEFT JOIN users u ON u.id = i.invited_by_user_id
        WHERE i.workspace_id = $1
          AND i.accepted_at IS NULL AND i.cancelled_at IS NULL
        ORDER BY i.created_at DESC
      `, [wsId])
      res.json(r.rows)
    } catch (err) {
      console.error('GET /invitations error:', err)
      res.status(500).json({ error: err.message })
    }
  }

  async function resendInvitation(req, res) {
    try {
      const wsId = await getWorkspaceId(req.user.id)
      const inviteRes = await pool.query(
        `SELECT * FROM invitations WHERE id = $1 AND workspace_id = $2 AND accepted_at IS NULL AND cancelled_at IS NULL`,
        [req.params.id, wsId]
      )
      if (!inviteRes.rows.length) {
        return res.status(404).json({ error: 'Invitation not found, already accepted, or cancelled' })
      }
      const invitation = inviteRes.rows[0]

      const rawToken = generateToken()
      const tokenHash = hashToken(rawToken)
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)

      const updateRes = await pool.query(`
        UPDATE invitations
        SET token_hash = $1, expires_at = $2, last_sent_at = NOW(), send_count = send_count + 1
        WHERE id = $3 RETURNING *
      `, [tokenHash, expiresAt, invitation.id])
      const updated = updateRes.rows[0]
      updated._raw_token = rawToken

      try {
        await sendInvitationEmail(updated)
      } catch (mailErr) {
        return res.status(500).json({ error: `Invitation token refreshed but email failed: ${mailErr.message}` })
      }

      await logAudit(wsId, req.user.id, 'invitation_resent', 'invitation', invitation.id, null, {
        email: invitation.email, send_count: updated.send_count
      })

      delete updated._raw_token
      delete updated.token_hash
      res.json(updated)
    } catch (err) {
      console.error('POST /invitations/:id/resend error:', err)
      res.status(500).json({ error: err.message })
    }
  }

  async function cancelInvitation(req, res) {
    try {
      const wsId = await getWorkspaceId(req.user.id)
      const r = await pool.query(`
        UPDATE invitations
        SET cancelled_at = NOW(), cancelled_by_user_id = $1
        WHERE id = $2 AND workspace_id = $3 AND accepted_at IS NULL AND cancelled_at IS NULL
        RETURNING id, email
      `, [req.user.id, req.params.id, wsId])
      if (!r.rows.length) {
        return res.status(404).json({ error: 'Invitation not found, already accepted, or already cancelled' })
      }
      await logAudit(wsId, req.user.id, 'invitation_cancelled', 'invitation', r.rows[0].id, null, {
        email: r.rows[0].email
      })
      res.json({ cancelled: true })
    } catch (err) {
      console.error('DELETE /invitations/:id error:', err)
      res.status(500).json({ error: err.message })
    }
  }

  async function lookupInvitation(req, res) {
    try {
      const tokenHash = hashToken(req.params.token)
      const r = await pool.query(`
        SELECT
          i.id, i.email, i.name, i.role, i.expires_at,
          i.accepted_at, i.cancelled_at,
          w.name AS workspace_name,
          t.name AS team_name,
          u.name AS invited_by_name
        FROM invitations i
        JOIN workspaces w ON w.id = i.workspace_id
        LEFT JOIN teams t ON t.id = i.team_id
        LEFT JOIN users u ON u.id = i.invited_by_user_id
        WHERE i.token_hash = $1 LIMIT 1
      `, [tokenHash])
      if (!r.rows.length) {
        return res.status(404).json({ error: 'invalid', message: 'This invitation link is not valid.' })
      }
      const inv = r.rows[0]
      if (inv.cancelled_at) {
        return res.status(410).json({ error: 'cancelled', message: 'This invitation has been cancelled. Ask your director for a new one.' })
      }
      if (inv.accepted_at) {
        return res.status(410).json({ error: 'already_accepted', message: 'This invitation has already been used. If you forgot your password, ask your director for a reset.' })
      }
      if (new Date(inv.expires_at) < new Date()) {
        return res.status(410).json({ error: 'expired', message: 'This invitation has expired. Ask your director to send a new one.' })
      }
      res.json({
        email: inv.email,
        name: inv.name,
        role: prettifyRole(inv.role),
        workspace_name: inv.workspace_name,
        team_name: inv.team_name,
        invited_by_name: inv.invited_by_name,
        expires_at: inv.expires_at,
      })
    } catch (err) {
      console.error('GET /invitations/lookup/:token error:', err)
      res.status(500).json({ error: 'server_error', message: 'Something went wrong. Please try again.' })
    }
  }

  async function acceptInvitation(req, res) {
    const client = await pool.connect()
    try {
      const tokenHash = hashToken(req.params.token)
      const { password } = req.body

      const inviteRes = await client.query(`SELECT * FROM invitations WHERE token_hash = $1 LIMIT 1`, [tokenHash])
      if (!inviteRes.rows.length) {
        return res.status(404).json({ error: 'invalid', message: 'This invitation link is not valid.' })
      }
      const inv = inviteRes.rows[0]
      if (inv.cancelled_at) return res.status(410).json({ error: 'cancelled', message: 'This invitation has been cancelled.' })
      if (inv.accepted_at) return res.status(410).json({ error: 'already_accepted', message: 'This invitation has already been used.' })
      if (new Date(inv.expires_at) < new Date()) {
        return res.status(410).json({ error: 'expired', message: 'This invitation has expired.' })
      }

      const { valid, errors } = validatePassword(password, inv.email)
      if (!valid) {
        return res.status(400).json({ error: 'weak_password', message: errors.join(' '), errors })
      }

      const dupCheck = await client.query(`SELECT id FROM users WHERE LOWER(email) = $1 LIMIT 1`, [inv.email.toLowerCase()])
      if (dupCheck.rows.length > 0) {
        return res.status(409).json({ error: 'email_taken', message: 'An account with this email already exists. Please contact your director.' })
      }

      await client.query('BEGIN')

      const hash = await bcrypt.hash(password, 10)
      const userRes = await client.query(`
        INSERT INTO users
          (workspace_id, name, email, password_hash, role, team_id, active, status, force_password_change)
        VALUES ($1, $2, $3, $4, $5, $6, true, 'offline', false)
        RETURNING id, name, email, role
      `, [inv.workspace_id, inv.name, inv.email, hash, inv.role, inv.team_id])
      const newUser = userRes.rows[0]

      if (inv.team_id) {
        await client.query(
          `INSERT INTO team_members (team_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [inv.team_id, newUser.id]
        )
      }

      await client.query(`UPDATE invitations SET accepted_at = NOW() WHERE id = $1`, [inv.id])
      await client.query('COMMIT')

      await logAudit(inv.workspace_id, newUser.id, 'invitation_accepted', 'user', newUser.id, null, {
        invitation_id: inv.id, email: inv.email, role: inv.role
      })

      res.json({ success: true, message: 'Account activated. You can now log in.', email: newUser.email })
    } catch (err) {
      try { await client.query('ROLLBACK') } catch {}
      console.error('POST /invitations/lookup/:token/accept error:', err)
      res.status(500).json({ error: 'server_error', message: 'Something went wrong. Please try again.' })
    } finally {
      client.release()
    }
  }

  return {
    inviteAgent, listInvitations, resendInvitation,
    cancelInvitation, lookupInvitation, acceptInvitation,
  }
}

module.exports = { createInvitationHandlers, runChunk30InvitationsMigration }