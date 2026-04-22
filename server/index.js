const express = require('express')
const cors = require('cors')
const { createServer } = require('http')
const { Server } = require('socket.io')
const { Pool } = require('pg')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

const app = express()
const httpServer = createServer(app)
const io = new Server(httpServer, { cors: { origin: '*', methods: ['GET','POST','PATCH','DELETE'] } })

app.use(cors())
app.use(express.json())

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres123@localhost:5432/agency_hub',
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
})

const JWT_SECRET = process.env.JWT_SECRET || 'telcloud_secret_key_2026'

function auth(req, res, next) {
  const header = req.headers.authorization
  if (!header) return res.status(401).json({ error: 'No token' })
  try { req.user = jwt.verify(header.replace('Bearer ', ''), JWT_SECRET); next() }
  catch { res.status(401).json({ error: 'Invalid token' }) }
}

async function logAudit(wsId, userId, action, entityType, entityId, oldVals, newVals) {
  try {
    await pool.query(`INSERT INTO audit_log (workspace_id, user_id, action, entity_type, entity_id, old_values, new_values) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [wsId, userId, action, entityType, entityId, JSON.stringify(oldVals), JSON.stringify(newVals)])
  } catch {}
}

async function getWorkspaceId(userId) {
  const r = await pool.query('SELECT workspace_id FROM users WHERE id=$1', [userId])
  return r.rows[0]?.workspace_id
}

async function setupDatabase() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(`CREATE TABLE IF NOT EXISTS workspaces (id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL, slug VARCHAR(100) UNIQUE, logo_url TEXT, email VARCHAR(255), phone VARCHAR(50), address TEXT, registration_number VARCHAR(100), timezone VARCHAR(50) DEFAULT 'Asia/Singapore', workspace_type VARCHAR(20) DEFAULT 'client', billing_exempt BOOLEAN DEFAULT false, plan VARCHAR(20) DEFAULT 'starter', whatsapp_account_id VARCHAR(255), whatsapp_token TEXT, whatsapp_connected BOOLEAN DEFAULT false, outlook_token TEXT, outlook_email VARCHAR(255), outlook_connected BOOLEAN DEFAULT false, status VARCHAR(20) DEFAULT 'active', created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW())`)
    await client.query(`CREATE TABLE IF NOT EXISTS phone_numbers (id SERIAL PRIMARY KEY, workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE, number VARCHAR(50), display_name VARCHAR(255), whatsapp_phone_id VARCHAR(255), connected BOOLEAN DEFAULT false, is_primary BOOLEAN DEFAULT false, team_id INTEGER, status VARCHAR(20) DEFAULT 'active', daily_limit INTEGER DEFAULT 1000, created_at TIMESTAMP DEFAULT NOW())`)
    await client.query(`CREATE TABLE IF NOT EXISTS teams (id SERIAL PRIMARY KEY, workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE, name VARCHAR(255), key VARCHAR(100), type VARCHAR(50) DEFAULT 'recruitment', lead_user_id INTEGER, color VARCHAR(20) DEFAULT '#2563eb', description TEXT, created_at TIMESTAMP DEFAULT NOW())`)
    await client.query(`CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE, name VARCHAR(255), email VARCHAR(255) UNIQUE, password_hash VARCHAR(255), role VARCHAR(50) DEFAULT 'consultant', team_id INTEGER, status VARCHAR(20) DEFAULT 'offline', capacity INTEGER DEFAULT 20, active BOOLEAN DEFAULT true, is_super_admin BOOLEAN DEFAULT false, email_signature TEXT, send_behaviour VARCHAR(20) DEFAULT 'enter', force_password_change BOOLEAN DEFAULT false, last_login_at TIMESTAMP, failed_login_attempts INTEGER DEFAULT 0, locked_until TIMESTAMP, permissions JSONB, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW())`)

    // ─── Legacy users table repair (backfills old agency-hub DB) ──────────────
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE`)
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255)`)
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS team_id INTEGER`)
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'offline'`)
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS capacity INTEGER DEFAULT 20`)
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true`)
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN DEFAULT false`)
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_signature TEXT`)
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS send_behaviour VARCHAR(20) DEFAULT 'enter'`)
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS force_password_change BOOLEAN DEFAULT false`)
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP`)
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0`)
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP`)
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions JSONB`)
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()`)
    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='password') THEN
          UPDATE users SET password_hash = password WHERE password_hash IS NULL AND password IS NOT NULL;
        END IF;
      END $$;
    `)

    // Relax NOT NULL on legacy `password` column so new users using password_hash-only work
    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='password' AND is_nullable='NO') THEN
          ALTER TABLE users ALTER COLUMN password DROP NOT NULL;
        END IF;
      END $$;
    `)

    // ─── Legacy contacts/conversations/messages wipe ─────────────────────────
    // These tables from the old agency-hub era are missing too many columns to patch.
    // Dev data only (6/6/18 rows). Safe to drop — CREATE TABLE IF NOT EXISTS recreates fresh below.
    await client.query(`DROP TABLE IF EXISTS messages CASCADE`)
    await client.query(`DROP TABLE IF EXISTS conversations CASCADE`)
    await client.query(`DROP TABLE IF EXISTS contacts CASCADE`)

    await client.query(`CREATE TABLE IF NOT EXISTS team_members (id SERIAL PRIMARY KEY, team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE, user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, UNIQUE(team_id, user_id))`)
    await client.query(`CREATE TABLE IF NOT EXISTS routing_rules (id SERIAL PRIMARY KEY, workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE, mode VARCHAR(20) DEFAULT 'smart', sticky_assignment BOOLEAN DEFAULT true, round_robin BOOLEAN DEFAULT true, candidate_team_id INTEGER, client_team_id INTEGER, max_capacity INTEGER DEFAULT 20, escalation_enabled BOOLEAN DEFAULT true, escalation_steps JSONB DEFAULT '[]', after_hours_action VARCHAR(20) DEFAULT 'auto_reply', unassigned_queue BOOLEAN DEFAULT true, blackout_start VARCHAR(5) DEFAULT '22:00', blackout_end VARCHAR(5) DEFAULT '08:00', created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW())`)
    await client.query(`CREATE TABLE IF NOT EXISTS business_hours (id SERIAL PRIMARY KEY, workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE, phone_number_id INTEGER, day_of_week VARCHAR(20), is_open BOOLEAN DEFAULT true, open_time VARCHAR(5) DEFAULT '09:00', close_time VARCHAR(5) DEFAULT '18:00', created_at TIMESTAMP DEFAULT NOW())`)
    await client.query(`CREATE TABLE IF NOT EXISTS contacts (id SERIAL PRIMARY KEY, workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE, name VARCHAR(255), phone VARCHAR(50), email VARCHAR(255), type VARCHAR(20) DEFAULT 'candidate', pipeline_stage VARCHAR(50) DEFAULT 'new', assigned_to INTEGER, team_id INTEGER, pdpa_consented BOOLEAN DEFAULT false, pdpa_consented_at TIMESTAMP, dnc BOOLEAN DEFAULT false, dnc_reason TEXT, opted_out BOOLEAN DEFAULT false, tags JSONB DEFAULT '[]', notes TEXT, source VARCHAR(100), candidate_role VARCHAR(255), current_company VARCHAR(255), expected_salary DECIMAL, notice_period VARCHAR(50), linkedin_url TEXT, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW())`)
    await client.query(`CREATE TABLE IF NOT EXISTS conversations (id SERIAL PRIMARY KEY, workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE, phone_number_id INTEGER, contact_id INTEGER REFERENCES contacts(id) ON DELETE CASCADE, assigned_to INTEGER, team_id INTEGER, status VARCHAR(20) DEFAULT 'open', labels JSONB DEFAULT '[]', last_message_at TIMESTAMP, last_message_preview TEXT, unread_count INTEGER DEFAULT 0, priority VARCHAR(20) DEFAULT 'normal', handover_note TEXT, handover_note_by INTEGER, handover_note_at TIMESTAMP, closed_at TIMESTAMP, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW())`)
    await client.query(`CREATE TABLE IF NOT EXISTS messages (id SERIAL PRIMARY KEY, conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE, workspace_id INTEGER, user_id INTEGER, direction VARCHAR(10), type VARCHAR(20) DEFAULT 'text', text TEXT, media_url TEXT, template_id INTEGER, status VARCHAR(20) DEFAULT 'sent', whatsapp_message_id VARCHAR(255), delivered_at TIMESTAMP, read_at TIMESTAMP, is_note BOOLEAN DEFAULT false, is_scheduled BOOLEAN DEFAULT false, scheduled_at TIMESTAMP, sent_at TIMESTAMP, created_at TIMESTAMP DEFAULT NOW())`)
    await client.query(`CREATE TABLE IF NOT EXISTS scheduled_messages (id SERIAL PRIMARY KEY, workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE, conversation_id INTEGER, contact_id INTEGER, phone_number_id INTEGER, created_by INTEGER, channel VARCHAR(20) DEFAULT 'whatsapp', template_id INTEGER, subject TEXT, body TEXT, variables JSONB DEFAULT '{}', buttons JSONB DEFAULT '[]', scheduled_at TIMESTAMP, send_mode VARCHAR(20) DEFAULT 'scheduled', status VARCHAR(20) DEFAULT 'pending', sent_at TIMESTAMP, failed_at TIMESTAMP, failed_reason TEXT, email_to VARCHAR(255), email_cc VARCHAR(255), email_opened_at TIMESTAMP, email_bounced BOOLEAN DEFAULT false, bulk_batch_id VARCHAR(100), created_at TIMESTAMP DEFAULT NOW())`)
    await client.query(`CREATE TABLE IF NOT EXISTS templates (id SERIAL PRIMARY KEY, workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE, name VARCHAR(255), category VARCHAR(50) DEFAULT 'utility', type VARCHAR(20) DEFAULT 'whatsapp', status VARCHAR(20) DEFAULT 'draft', body TEXT, subject TEXT, buttons JSONB DEFAULT '[]', variables JSONB DEFAULT '[]', language VARCHAR(10) DEFAULT 'en', meta_template_id VARCHAR(255), approved_at TIMESTAMP, rejected_reason TEXT, created_by INTEGER, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW())`)
    await client.query(`CREATE TABLE IF NOT EXISTS quick_replies (id SERIAL PRIMARY KEY, workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE, created_by INTEGER, title VARCHAR(255), body TEXT, shortcut VARCHAR(50), shared BOOLEAN DEFAULT true, created_at TIMESTAMP DEFAULT NOW())`)
    await client.query(`CREATE TABLE IF NOT EXISTS labels (id SERIAL PRIMARY KEY, workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE, name VARCHAR(100), color VARCHAR(20) DEFAULT '#2563eb', bg VARCHAR(20) DEFAULT '#eff6ff', created_at TIMESTAMP DEFAULT NOW())`)
    await client.query(`CREATE TABLE IF NOT EXISTS job_orders (id SERIAL PRIMARY KEY, workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE, title VARCHAR(255), client_contact_id INTEGER, company VARCHAR(255), description TEXT, requirements TEXT, salary_min DECIMAL, salary_max DECIMAL, currency VARCHAR(10) DEFAULT 'SGD', headcount INTEGER DEFAULT 1, location VARCHAR(255), employment_type VARCHAR(50), status VARCHAR(20) DEFAULT 'open', priority VARCHAR(20) DEFAULT 'normal', deadline DATE, assigned_to INTEGER, team_id INTEGER, placement_fee DECIMAL, fee_type VARCHAR(20) DEFAULT 'percentage', created_by INTEGER, closed_at TIMESTAMP, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW())`)
    await client.query(`CREATE TABLE IF NOT EXISTS job_applications (id SERIAL PRIMARY KEY, job_order_id INTEGER REFERENCES job_orders(id) ON DELETE CASCADE, contact_id INTEGER REFERENCES contacts(id) ON DELETE CASCADE, workspace_id INTEGER, stage VARCHAR(50) DEFAULT 'new', assigned_to INTEGER, notes TEXT, interview_date TIMESTAMP, offer_amount DECIMAL, placement_date DATE, rejection_reason TEXT, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW(), UNIQUE(job_order_id, contact_id))`)
    await client.query(`CREATE TABLE IF NOT EXISTS placements (id SERIAL PRIMARY KEY, workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE, job_application_id INTEGER, contact_id INTEGER, job_order_id INTEGER, placed_by INTEGER, start_date DATE, salary DECIMAL, placement_fee DECIMAL, fee_collected BOOLEAN DEFAULT false, notes TEXT, created_at TIMESTAMP DEFAULT NOW())`)
    await client.query(`CREATE TABLE IF NOT EXISTS pdpa_records (id SERIAL PRIMARY KEY, workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE, contact_id INTEGER REFERENCES contacts(id) ON DELETE CASCADE, status VARCHAR(20) DEFAULT 'pending', method VARCHAR(50), consented_at TIMESTAMP, expires_at TIMESTAMP, withdrawn_at TIMESTAMP, collected_by INTEGER, notes TEXT, created_at TIMESTAMP DEFAULT NOW())`)
    await client.query(`CREATE TABLE IF NOT EXISTS audit_log (id SERIAL PRIMARY KEY, workspace_id INTEGER, user_id INTEGER, action VARCHAR(100), entity_type VARCHAR(50), entity_id INTEGER, old_values JSONB, new_values JSONB, ip_address VARCHAR(50), created_at TIMESTAMP DEFAULT NOW())`)
    await client.query(`CREATE TABLE IF NOT EXISTS notifications (id SERIAL PRIMARY KEY, workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE, user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, type VARCHAR(100), title VARCHAR(255), body TEXT, entity_type VARCHAR(50), entity_id INTEGER, read BOOLEAN DEFAULT false, read_at TIMESTAMP, created_at TIMESTAMP DEFAULT NOW())`)
    await client.query(`CREATE TABLE IF NOT EXISTS projects (id SERIAL PRIMARY KEY, workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE, client_name VARCHAR(255) NOT NULL, start_month VARCHAR(10) NOT NULL, start_year INTEGER NOT NULL, colour VARCHAR(20) DEFAULT '#2563eb', status VARCHAR(20) DEFAULT 'active', archived_at TIMESTAMP, created_by INTEGER, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW())`)
    await client.query(`ALTER TABLE conversations ADD COLUMN IF NOT EXISTS project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL`)
    await client.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS whatsapp_message_id VARCHAR(255)`)
    await client.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP`)
    await client.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMP`)
    await client.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS pinned_by INTEGER`)
    await client.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS read_at TIMESTAMP`)
    await client.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_note BOOLEAN DEFAULT false`)
    await client.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_scheduled BOOLEAN DEFAULT false`)
    await client.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMP`)
    await client.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS sent_at TIMESTAMP`)
    await client.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS template_id INTEGER`)

    // ─── Multi-tenant access control migrations (Session D1) ─────────────────
    await client.query(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL`)
    await client.query(`ALTER TABLE phone_numbers ADD COLUMN IF NOT EXISTS project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL`)
    await client.query(`ALTER TABLE phone_numbers ADD COLUMN IF NOT EXISTS owner_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL`)
    await client.query(`CREATE TABLE IF NOT EXISTS project_members (project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE, user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, role_in_project VARCHAR(20) DEFAULT 'member', created_at TIMESTAMP DEFAULT NOW(), PRIMARY KEY (project_id, user_id))`)
    await client.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS sent_as_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL`)
    await client.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS sent_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL`)
    await client.query(`CREATE TABLE IF NOT EXISTS _migrations (id VARCHAR(100) PRIMARY KEY, ran_at TIMESTAMP DEFAULT NOW())`)

    await client.query(`CREATE TABLE IF NOT EXISTS broadcasts (id SERIAL PRIMARY KEY, workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE, phone_number_id INTEGER, created_by INTEGER, name VARCHAR(255), template_id INTEGER, message TEXT, recipient_count INTEGER DEFAULT 0, sent_count INTEGER DEFAULT 0, failed_count INTEGER DEFAULT 0, status VARCHAR(20) DEFAULT 'draft', scheduled_at TIMESTAMP, sent_at TIMESTAMP, created_at TIMESTAMP DEFAULT NOW())`)
    await client.query(`CREATE TABLE IF NOT EXISTS security_settings (id SERIAL PRIMARY KEY, workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE UNIQUE, session_timeout_minutes INTEGER DEFAULT 480, max_failed_logins INTEGER DEFAULT 5, force_password_change BOOLEAN DEFAULT false, two_factor_required BOOLEAN DEFAULT false, password_min_length INTEGER DEFAULT 8, password_require_special BOOLEAN DEFAULT false, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW())`)
    await client.query(`CREATE TABLE IF NOT EXISTS calendar_events (id SERIAL PRIMARY KEY, workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE, conversation_id INTEGER, contact_id INTEGER, job_order_id INTEGER, created_by INTEGER, title VARCHAR(255), event_date DATE, event_time TIME, location TEXT, notes TEXT, type VARCHAR(50) DEFAULT 'interview', status VARCHAR(20) DEFAULT 'scheduled', created_at TIMESTAMP DEFAULT NOW())`)
    await client.query('COMMIT')
    console.log('✅ Database schema ready')
    await seedDatabase()
    await runPlatformCleanupMigration()
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('❌ DB setup error:', err.message)
  } finally { client.release() }
}

async function seedDatabase() {
  try {
    const existing = await pool.query('SELECT id FROM workspaces WHERE slug=$1', ['telcloud-main'])
    if (existing.rows.length > 0) { console.log('✅ Seed data exists'); return }
    const ws = await pool.query(`INSERT INTO workspaces (name, slug, workspace_type, billing_exempt, plan, email, timezone) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`, ['Tel-Cloud Sandbox', 'telcloud-main', 'internal', true, 'enterprise', 'admin@tel-cloud.com', 'Asia/Singapore'])
    const wsId = ws.rows[0].id
    const rt = await pool.query(`INSERT INTO teams (workspace_id, name, key, type, color) VALUES ($1,$2,$3,$4,$5) RETURNING id`, [wsId, 'Recruitment Team', 'recruitment', 'recruitment', '#2563eb'])
    const ct = await pool.query(`INSERT INTO teams (workspace_id, name, key, type, color) VALUES ($1,$2,$3,$4,$5) RETURNING id`, [wsId, 'Client Relations Team', 'client', 'client', '#7c3aed'])
    const at = await pool.query(`INSERT INTO teams (workspace_id, name, key, type, color) VALUES ($1,$2,$3,$4,$5) RETURNING id`, [wsId, 'Admin Team', 'admin', 'admin', '#059669'])
    await pool.query(`INSERT INTO routing_rules (workspace_id, mode, sticky_assignment, round_robin, candidate_team_id, client_team_id, escalation_enabled, escalation_steps) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, [wsId, 'smart', true, true, rt.rows[0].id, ct.rows[0].id, true, JSON.stringify([{ type: 'team', target: 'recruitment', wait_minutes: 30 }, { type: 'role', target: 'manager', wait_minutes: 60 }])])
    await pool.query(`INSERT INTO security_settings (workspace_id) VALUES ($1)`, [wsId])
    const days = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
    for (const day of days) {
      await pool.query(`INSERT INTO business_hours (workspace_id, phone_number_id, day_of_week, is_open, open_time, close_time) VALUES ($1,$2,$3,$4,$5,$6)`, [wsId, null, day, !['Saturday','Sunday'].includes(day), '09:00', '18:00'])
    }
    const defaultTemplates = [
      { name: 'interview_confirmation', category: 'utility', body: 'Dear {{name}},\n\nWe are pleased to confirm your interview for the position of {{role}} at {{company}}.\n\nDate: {{date}}\nTime: {{time}}\nVenue: {{venue}}\n\nKindly bring your NRIC and certificates.\n\nWe look forward to meeting you.', buttons: [] },
      { name: 'offer_letter_notification', category: 'utility', body: 'Dear {{name}},\n\nWe are delighted to inform you that your offer letter for {{role}} at {{company}} is ready.\n\nPlease confirm acceptance by {{deadline}}.\n\nWe look forward to welcoming you.', buttons: [{ type: 'quick_reply', label: 'Accept Offer' }, { type: 'quick_reply', label: 'Request Clarification' }] },
      { name: 'candidate_status_followup', category: 'utility', body: 'Dear {{name}},\n\nWe refer to your application for {{role}} at {{company}}.\n\nKindly advise on your current availability and interest.\n\nThank you.', buttons: [{ type: 'quick_reply', label: 'Still Interested' }, { type: 'quick_reply', label: 'No Longer Available' }] },
      { name: 'interview_reminder', category: 'utility', body: 'Dear {{name}},\n\nThis is a reminder of your interview tomorrow.\n\nDate: {{date}}\nTime: {{time}}\nVenue: {{venue}}\n\nPlease arrive 10 minutes early.\n\nWe look forward to seeing you.', buttons: [] },
      { name: 'job_opportunity_alert', category: 'marketing', body: 'Dear {{name}},\n\nWe have a new opportunity matching your profile.\n\nPosition: {{role}}\nCompany: {{company}}\nSalary: {{salary}}/month\n\nReply if interested and our consultant will be in touch.', buttons: [{ type: 'quick_reply', label: 'I Am Interested' }] },
    ]
    for (const t of defaultTemplates) {
      await pool.query(`INSERT INTO templates (workspace_id, name, category, status, body, buttons) VALUES ($1,$2,$3,$4,$5,$6)`, [wsId, t.name, t.category, 'approved', t.body, JSON.stringify(t.buttons)])
    }
    console.log('✅ Seed data created (Tel-Cloud Sandbox, no users)')
  } catch (err) { console.error('❌ Seed error:', err.message) }
}

// ─── PLATFORM CLEANUP MIGRATION (one-time) ──────────────────────────────────────
// Deletes legacy agency-hub users and any demo tenant data, then creates the
// super admin account. Runs once via _migrations lock.
async function runPlatformCleanupMigration() {
  const MIGRATION_ID = 'platform_cleanup_v1'
  try {
    const applied = await pool.query('SELECT id FROM _migrations WHERE id=$1', [MIGRATION_ID])
    if (applied.rows.length > 0) {
      console.log(`✅ Migration ${MIGRATION_ID} already applied, skipping`)
      return
    }
    console.log(`🔧 Running migration ${MIGRATION_ID}...`)

    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      const ws = await client.query(`SELECT id FROM workspaces WHERE slug='telcloud-main' LIMIT 1`)
      if (!ws.rows.length) throw new Error('telcloud-main workspace missing — seedDatabase must run first')
      const wsId = ws.rows[0].id

      // Rename workspace to "Tel-Cloud Sandbox" if it was the old "Tel-Cloud Demo" name
      await client.query(
        `UPDATE workspaces SET name='Tel-Cloud Sandbox', updated_at=NOW()
         WHERE id=$1 AND name='Tel-Cloud Demo'`,
        [wsId]
      )

      // Backfill workspace_id on any users missing it (legacy DB defensive patch)
      const backfill = await client.query(
        `UPDATE users SET workspace_id=$1 WHERE workspace_id IS NULL`,
        [wsId]
      )
      if (backfill.rowCount > 0) console.log(`   backfilled workspace_id on ${backfill.rowCount} users`)

      // Delete legacy agency-hub users
      const legacyUsers = await client.query(
        `DELETE FROM users WHERE email IN (
          'aisha@agencyhub.com',
          'ben@agencyhub.com',
          'director@agencyhub.com',
          'director2@agencyhub.com'
        )`
      )
      console.log(`   deleted ${legacyUsers.rowCount} legacy agency-hub users`)

      // Delete any demo users that may have been seeded under old tel-cloud emails
      const demoUsers = await client.query(
        `DELETE FROM users WHERE email IN (
          'director@tel-cloud.com',
          'aisha@tel-cloud.com',
          'ben@tel-cloud.com',
          'marcus@tel-cloud.com',
          'priya@tel-cloud.com',
          'rachel@tel-cloud.com',
          'zara@tel-cloud.com'
        )`
      )
      if (demoUsers.rowCount > 0) console.log(`   deleted ${demoUsers.rowCount} legacy tel-cloud demo users`)

      // Delete demo contacts + conversations (cascades messages)
      const demoPhones = ['+6591234001','+6591234002','+6591234003','+6591234004','+6591234005']
      const demoContacts = await client.query(
        `DELETE FROM contacts WHERE phone=ANY($1) AND workspace_id=$2`,
        [demoPhones, wsId]
      )
      if (demoContacts.rowCount > 0) console.log(`   deleted ${demoContacts.rowCount} demo contacts`)

      // Delete the demo phone line
      const demoPhone = await client.query(
        `DELETE FROM phone_numbers WHERE number='+6591234567' AND workspace_id=$1`,
        [wsId]
      )
      if (demoPhone.rowCount > 0) console.log(`   deleted demo phone line`)

      // Create super admin (or update if already exists)
      const existingSA = await client.query(
        `SELECT id FROM users WHERE email='superadmin@tel-cloud.com' LIMIT 1`
      )
      if (existingSA.rows.length > 0) {
        console.log(`   superadmin@tel-cloud.com already exists (id=${existingSA.rows[0].id}), skipping create`)
      } else {
        const hash = await bcrypt.hash('admin123', 10)
        const r = await client.query(
          `INSERT INTO users
             (workspace_id, name, email, password_hash, role,
              is_super_admin, active, status, force_password_change)
           VALUES ($1, 'Super Admin', 'superadmin@tel-cloud.com', $2, 'super_admin',
                   true, true, 'offline', true)
           RETURNING id`,
          [wsId, hash]
        )
        console.log(`   created superadmin@tel-cloud.com (id=${r.rows[0].id}, password=admin123)`)
      }

      await client.query(`INSERT INTO _migrations (id) VALUES ($1)`, [MIGRATION_ID])
      await client.query('COMMIT')
      console.log(`✅ Migration ${MIGRATION_ID} complete`)
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  } catch (err) {
    console.error(`❌ Migration ${MIGRATION_ID} FAILED:`, err.message)
    throw err
  }
}

// ─── AUTH ──────────────────────────────────────────────────────────────────────
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body
    const r = await pool.query(`SELECT u.*, w.name as workspace_name, w.billing_exempt, w.plan, w.workspace_type FROM users u JOIN workspaces w ON w.id = u.workspace_id WHERE u.email=$1 AND u.active=true`, [email])
    if (!r.rows.length) return res.status(401).json({ error: 'Invalid email or password' })
    const user = r.rows[0]
    if (user.locked_until && new Date(user.locked_until) > new Date()) return res.status(401).json({ error: 'Account temporarily locked. Try again later.' })
    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) {
      await pool.query(`UPDATE users SET failed_login_attempts=failed_login_attempts+1, locked_until=CASE WHEN failed_login_attempts>=4 THEN NOW()+INTERVAL '15 minutes' ELSE locked_until END WHERE id=$1`, [user.id])
      return res.status(401).json({ error: 'Invalid email or password' })
    }
    await pool.query(`UPDATE users SET last_login_at=NOW(), failed_login_attempts=0, locked_until=NULL WHERE id=$1`, [user.id])
    const token = jwt.sign({ id: user.id, email: user.email, name: user.name, role: user.role, workspace_id: user.workspace_id, is_super_admin: user.is_super_admin }, JWT_SECRET, { expiresIn: '24h' })
    await logAudit(user.workspace_id, user.id, 'login', 'user', user.id, null, { email })
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, workspace_id: user.workspace_id, workspace_name: user.workspace_name, is_super_admin: user.is_super_admin, billing_exempt: user.billing_exempt, plan: user.plan, permissions: user.permissions, send_behaviour: user.send_behaviour || 'enter', force_password_change: user.force_password_change } })
  } catch (err) { console.error('Login error:', err); res.status(500).json({ error: 'Server error' }) }
})

// ─── SUPER ADMIN MIDDLEWARE ────────────────────────────────────────────────────
// Gates all /admin/* routes to users with is_super_admin=true
async function superAdmin(req, res, next) {
  try {
    const r = await pool.query('SELECT is_super_admin, active FROM users WHERE id=$1', [req.user.id])
    if (!r.rows.length || !r.rows[0].active) return res.status(401).json({ error: 'User not found or inactive' })
    if (!r.rows[0].is_super_admin) return res.status(403).json({ error: 'Super admin access required' })
    next()
  } catch (err) {
    console.error('superAdmin middleware error:', err)
    res.status(500).json({ error: 'Auth check failed' })
  }
}

// Helper: generate a slug from a name
function generateSlug(name) {
  return (name || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 100) || 'workspace'
}

// Helper: generate a readable random password (same rules as Eque migration used)
function generateRandomPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  let out = ''
  for (let i = 0; i < 12; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

// ─── ADMIN: WORKSPACES ─────────────────────────────────────────────────────────

// GET /admin/workspaces — list all workspaces with summary counts
app.get('/admin/workspaces', auth, superAdmin, async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT w.id, w.name, w.slug, w.registration_number, w.email, w.phone,
             w.workspace_type, w.billing_exempt, w.plan, w.status,
             w.created_at, w.updated_at,
             (SELECT COUNT(*) FROM users u WHERE u.workspace_id=w.id AND u.active=true) as user_count,
             (SELECT COUNT(*) FROM phone_numbers pn WHERE pn.workspace_id=w.id) as phone_count,
             (SELECT COUNT(*) FROM conversations c WHERE c.workspace_id=w.id) as conversation_count
      FROM workspaces w
      ORDER BY w.created_at DESC
    `)
    res.json(r.rows)
  } catch (err) {
    console.error('GET /admin/workspaces error:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET /admin/workspaces/:id — single workspace detail
app.get('/admin/workspaces/:id', auth, superAdmin, async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT w.*,
             (SELECT COUNT(*) FROM users u WHERE u.workspace_id=w.id AND u.active=true) as user_count,
             (SELECT COUNT(*) FROM phone_numbers pn WHERE pn.workspace_id=w.id) as phone_count,
             (SELECT COUNT(*) FROM conversations c WHERE c.workspace_id=w.id) as conversation_count
      FROM workspaces w WHERE w.id=$1
    `, [req.params.id])
    if (!r.rows.length) return res.status(404).json({ error: 'Workspace not found' })
    res.json(r.rows[0])
  } catch (err) {
    console.error('GET /admin/workspaces/:id error:', err)
    res.status(500).json({ error: err.message })
  }
})

// POST /admin/workspaces — create workspace + first director atomically
// Body: { name, slug, registration_number, email, phone, address, plan, billing_exempt,
//         director_name, director_email }
app.post('/admin/workspaces', auth, superAdmin, async (req, res) => {
  const {
    name, slug: slugInput, registration_number, email, phone, address,
    plan, billing_exempt, workspace_type,
    director_name, director_email
  } = req.body

  // Validate required fields
  if (!name || !name.trim()) return res.status(400).json({ error: 'Workspace name is required' })
  if (!director_name || !director_name.trim()) return res.status(400).json({ error: 'Director name is required' })
  if (!director_email || !director_email.trim()) return res.status(400).json({ error: 'Director email is required' })

  const slug = (slugInput && slugInput.trim()) ? generateSlug(slugInput) : generateSlug(name)

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // Check slug uniqueness
    const slugCheck = await client.query('SELECT id FROM workspaces WHERE slug=$1', [slug])
    if (slugCheck.rows.length > 0) {
      await client.query('ROLLBACK')
      return res.status(409).json({ error: `Slug "${slug}" is already taken. Try a different name or slug.` })
    }

    // Check director email uniqueness across the entire platform
    const emailCheck = await client.query('SELECT id FROM users WHERE LOWER(email)=LOWER($1)', [director_email.trim()])
    if (emailCheck.rows.length > 0) {
      await client.query('ROLLBACK')
      return res.status(409).json({ error: `A user with email "${director_email}" already exists.` })
    }

    // 1. Create workspace
    const wsResult = await client.query(
      `INSERT INTO workspaces
         (name, slug, registration_number, email, phone, address,
          workspace_type, billing_exempt, plan, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active')
       RETURNING *`,
      [
        name.trim(),
        slug,
        registration_number || null,
        email || null,
        phone || null,
        address || null,
        workspace_type || 'client',
        billing_exempt === true,
        plan || 'starter'
      ]
    )
    const workspace = wsResult.rows[0]

    // 2. Create director user
    const pw = generateRandomPassword()
    const hash = await bcrypt.hash(pw, 10)
    const userResult = await client.query(
      `INSERT INTO users
         (workspace_id, name, email, password_hash, role,
          is_super_admin, active, status, force_password_change)
       VALUES ($1, $2, $3, $4, 'director', false, true, 'offline', true)
       RETURNING id, name, email, role`,
      [workspace.id, director_name.trim(), director_email.trim(), hash]
    )
    const director = userResult.rows[0]

    // 3. Seed default sub-teams for this workspace (mirrors the seedDatabase pattern)
    await client.query(
      `INSERT INTO teams (workspace_id, name, key, type, color) VALUES
         ($1, 'Recruitment Team', 'recruitment', 'recruitment', '#2563eb'),
         ($1, 'Client Relations Team', 'client', 'client', '#7c3aed'),
         ($1, 'Admin Team', 'admin', 'admin', '#059669')`,
      [workspace.id]
    )

    // 4. Seed default security settings
    await client.query(`INSERT INTO security_settings (workspace_id) VALUES ($1)`, [workspace.id])

    // 5. Seed default business hours (Mon-Fri open, weekend closed)
    const days = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
    for (const day of days) {
      await client.query(
        `INSERT INTO business_hours (workspace_id, day_of_week, is_open, open_time, close_time)
         VALUES ($1, $2, $3, '09:00', '18:00')`,
        [workspace.id, day, !['Saturday','Sunday'].includes(day)]
      )
    }

    // 6. Audit log (attributed to super admin, targeting the new workspace)
    await client.query(
      `INSERT INTO audit_log (workspace_id, user_id, action, entity_type, entity_id, new_values)
       VALUES ($1, $2, 'create_workspace', 'workspace', $3, $4)`,
      [workspace.id, req.user.id, workspace.id, JSON.stringify({ name, slug, director_email, plan, billing_exempt })]
    )

    await client.query('COMMIT')

    // Return workspace + director + one-time password (shown once in the UI)
    res.json({
      workspace,
      director,
      initial_password: pw,
      message: 'Workspace and director created. Share the initial_password with the director securely. It will not be shown again.'
    })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('POST /admin/workspaces error:', err)
    res.status(500).json({ error: err.message })
  } finally {
    client.release()
  }
})

// PATCH /admin/workspaces/:id — update workspace metadata
// Body: any of { name, registration_number, email, phone, address, plan, billing_exempt, status, workspace_type }
app.patch('/admin/workspaces/:id', auth, superAdmin, async (req, res) => {
  try {
    const { name, registration_number, email, phone, address, plan, billing_exempt, status, workspace_type } = req.body
    const old = await pool.query('SELECT * FROM workspaces WHERE id=$1', [req.params.id])
    if (!old.rows.length) return res.status(404).json({ error: 'Workspace not found' })

    const r = await pool.query(`
      UPDATE workspaces SET
        name                = COALESCE($1, name),
        registration_number = COALESCE($2, registration_number),
        email               = COALESCE($3, email),
        phone               = COALESCE($4, phone),
        address             = COALESCE($5, address),
        plan                = COALESCE($6, plan),
        billing_exempt      = COALESCE($7, billing_exempt),
        status              = COALESCE($8, status),
        workspace_type      = COALESCE($9, workspace_type),
        updated_at          = NOW()
      WHERE id=$10 RETURNING *
    `, [name, registration_number, email, phone, address, plan, billing_exempt, status, workspace_type, req.params.id])

    await logAudit(req.params.id, req.user.id, 'update_workspace', 'workspace', req.params.id, old.rows[0], req.body)
    res.json(r.rows[0])
  } catch (err) {
    console.error('PATCH /admin/workspaces/:id error:', err)
    res.status(500).json({ error: err.message })
  }
})

// ─── WORKSPACE ─────────────────────────────────────────────────────────────────
app.get('/workspace', auth, async (req, res) => {
  try {
    const wsId = await getWorkspaceId(req.user.id)
    const r = await pool.query('SELECT * FROM workspaces WHERE id=$1', [wsId])
    res.json(r.rows[0])
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.patch('/workspace', auth, async (req, res) => {
  try {
    const wsId = await getWorkspaceId(req.user.id)
    const { name, email, phone, address, registration_number, timezone } = req.body
    const r = await pool.query(`UPDATE workspaces SET name=$1, email=$2, phone=$3, address=$4, registration_number=$5, timezone=$6, updated_at=NOW() WHERE id=$7 RETURNING *`, [name, email, phone, address, registration_number, timezone, wsId])
    res.json(r.rows[0])
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ─── PHONE NUMBERS ─────────────────────────────────────────────────────────────
app.get('/phone-numbers', auth, async (req, res) => {
  try {
    const wsId = await getWorkspaceId(req.user.id)
    const r = await pool.query('SELECT * FROM phone_numbers WHERE workspace_id=$1 ORDER BY is_primary DESC, created_at ASC', [wsId])
    res.json(r.rows)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.post('/phone-numbers', auth, async (req, res) => {
  try {
    const wsId = await getWorkspaceId(req.user.id)
    const { number, display_name, whatsapp_phone_id, is_primary } = req.body
    if (is_primary) await pool.query('UPDATE phone_numbers SET is_primary=false WHERE workspace_id=$1', [wsId])
    const r = await pool.query(`INSERT INTO phone_numbers (workspace_id, number, display_name, whatsapp_phone_id, is_primary) VALUES ($1,$2,$3,$4,$5) RETURNING *`, [wsId, number, display_name, whatsapp_phone_id, is_primary || false])
    res.json(r.rows[0])
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.patch('/phone-numbers/:id', auth, async (req, res) => {
  try {
    const wsId = await getWorkspaceId(req.user.id)
    const { display_name, is_primary, status, team_id } = req.body
    if (is_primary) await pool.query('UPDATE phone_numbers SET is_primary=false WHERE workspace_id=$1', [wsId])
    const r = await pool.query(`UPDATE phone_numbers SET display_name=$1, is_primary=$2, status=$3, team_id=$4 WHERE id=$5 AND workspace_id=$6 RETURNING *`, [display_name, is_primary, status, team_id, req.params.id, wsId])
    res.json(r.rows[0])
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.delete('/phone-numbers/:id', auth, async (req, res) => {
  try {
    const wsId = await getWorkspaceId(req.user.id)
    await pool.query('DELETE FROM phone_numbers WHERE id=$1 AND workspace_id=$2', [req.params.id, wsId])
    res.json({ success: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ─── AGENTS ────────────────────────────────────────────────────────────────────
app.get('/agents', auth, async (req, res) => {
  try {
    const wsId = await getWorkspaceId(req.user.id)
    const r = await pool.query(`SELECT u.*, t.name as team_name, t.color as team_color FROM users u LEFT JOIN teams t ON t.id=u.team_id WHERE u.workspace_id=$1 ORDER BY u.created_at ASC`, [wsId])
    res.json(r.rows.map(u => ({ ...u, password_hash: undefined })))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.post('/agents', auth, async (req, res) => {
  try {
    const wsId = await getWorkspaceId(req.user.id)
    const { name, email, role, team_id, capacity, password } = req.body
    const hash = await bcrypt.hash(password || 'Welcome@123', 10)
    const r = await pool.query(`INSERT INTO users (workspace_id, name, email, password_hash, role, team_id, capacity, force_password_change) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`, [wsId, name, email, hash, role, team_id, capacity || 20, true])
    if (team_id) await pool.query('INSERT INTO team_members (team_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [team_id, r.rows[0].id])
    await logAudit(wsId, req.user.id, 'create_agent', 'user', r.rows[0].id, null, { name, email, role })
    res.json({ ...r.rows[0], password_hash: undefined })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.patch('/agents/:id', auth, async (req, res) => {
  try {
    const wsId = await getWorkspaceId(req.user.id)
    const { name, email, role, team_id, capacity, status, active, permissions } = req.body
    const r = await pool.query(`UPDATE users SET name=$1, email=$2, role=$3, team_id=$4, capacity=$5, status=$6, active=$7, permissions=$8, updated_at=NOW() WHERE id=$9 AND workspace_id=$10 RETURNING *`, [name, email, role, team_id, capacity, status, active, JSON.stringify(permissions), req.params.id, wsId])
    if (team_id) {
      await pool.query('DELETE FROM team_members WHERE user_id=$1', [req.params.id])
      await pool.query('INSERT INTO team_members (team_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [team_id, req.params.id])
    }
    res.json({ ...r.rows[0], password_hash: undefined })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.post('/agents/:id/reset-password', auth, async (req, res) => {
  try {
    const wsId = await getWorkspaceId(req.user.id)
    const hash = await bcrypt.hash(req.body.password || 'Welcome@123', 10)
    await pool.query(`UPDATE users SET password_hash=$1, force_password_change=true WHERE id=$2 AND workspace_id=$3`, [hash, req.params.id, wsId])
    res.json({ success: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ─── TEAMS ─────────────────────────────────────────────────────────────────────
app.get('/teams', auth, async (req, res) => {
  try {
    const wsId = await getWorkspaceId(req.user.id)
    const r = await pool.query(`SELECT t.*, u.name as lead_name, COALESCE(json_agg(json_build_object('id',tm_u.id,'name',tm_u.name,'role',tm_u.role,'status',tm_u.status)) FILTER (WHERE tm_u.id IS NOT NULL),'[]') as members FROM teams t LEFT JOIN users u ON u.id=t.lead_user_id LEFT JOIN team_members tm ON tm.team_id=t.id LEFT JOIN users tm_u ON tm_u.id=tm.user_id WHERE t.workspace_id=$1 GROUP BY t.id,u.name ORDER BY t.created_at ASC`, [wsId])
    res.json(r.rows)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.post('/teams', auth, async (req, res) => {
  try {
    const wsId = await getWorkspaceId(req.user.id)
    const { name, key, type, lead_user_id, color, description } = req.body
    const r = await pool.query(`INSERT INTO teams (workspace_id, name, key, type, lead_user_id, color, description) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`, [wsId, name, key, type, lead_user_id, color, description])
    res.json(r.rows[0])
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.patch('/teams/:id', auth, async (req, res) => {
  try {
    const wsId = await getWorkspaceId(req.user.id)
    const { name, type, lead_user_id, color, description, members } = req.body
    const r = await pool.query(`UPDATE teams SET name=$1, type=$2, lead_user_id=$3, color=$4, description=$5 WHERE id=$6 AND workspace_id=$7 RETURNING *`, [name, type, lead_user_id, color, description, req.params.id, wsId])
    if (members) {
      await pool.query('DELETE FROM team_members WHERE team_id=$1', [req.params.id])
      for (const uid of members) await pool.query('INSERT INTO team_members (team_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [req.params.id, uid])
    }
    res.json(r.rows[0])
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.delete('/teams/:id', auth, async (req, res) => {
  try {
    const wsId = await getWorkspaceId(req.user.id)
    await pool.query('DELETE FROM teams WHERE id=$1 AND workspace_id=$2', [req.params.id, wsId])
    res.json({ success: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ─── CONVERSATIONS ─────────────────────────────────────────────────────────────
app.get('/conversations', auth, async (req, res) => {
  try {
    const wsId = await getWorkspaceId(req.user.id)
    const { phone_number_id, status, contact_id } = req.query
    let query = `SELECT c.*, ct.name, ct.phone, ct.email, ct.type, ct.pipeline_stage, ct.pdpa_consented, ct.dnc, u.name as assigned_name, pn.number as phone_number, pn.display_name as phone_line, c.last_message_preview as preview FROM conversations c JOIN contacts ct ON ct.id=c.contact_id LEFT JOIN users u ON u.id=c.assigned_to LEFT JOIN phone_numbers pn ON pn.id=c.phone_number_id WHERE c.workspace_id=$1`
    const params = [wsId]
    let idx = 2
    if (phone_number_id) { query += ` AND c.phone_number_id=$${idx++}`; params.push(phone_number_id) }
    if (status) { query += ` AND c.status=$${idx++}`; params.push(status) }
    if (contact_id) { query += ` AND c.contact_id=$${idx++}`; params.push(contact_id) }
    query += ' ORDER BY c.last_message_at DESC NULLS LAST'
    const r = await pool.query(query, params)
    res.json(r.rows.map(c => ({ ...c, assigned_to: c.assigned_name })))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.get('/conversations/:id', auth, async (req, res) => {
  try {
    const wsId = await getWorkspaceId(req.user.id)
    const convo = await pool.query(`SELECT c.*, ct.name, ct.phone, ct.email, ct.type, ct.pipeline_stage, ct.pdpa_consented, ct.dnc, ct.notes as contact_notes, u.name as assigned_name, pn.number as phone_number, pn.display_name as phone_line FROM conversations c JOIN contacts ct ON ct.id=c.contact_id LEFT JOIN users u ON u.id=c.assigned_to LEFT JOIN phone_numbers pn ON pn.id=c.phone_number_id WHERE c.id=$1 AND c.workspace_id=$2`, [req.params.id, wsId])
    if (!convo.rows.length) return res.status(404).json({ error: 'Not found' })
    const messages = await pool.query(`SELECT m.*, u.name as sender_name, pu.name as pinned_by_name FROM messages m LEFT JOIN users u ON u.id=m.user_id LEFT JOIN users pu ON pu.id=m.pinned_by WHERE m.conversation_id=$1 ORDER BY m.created_at ASC`, [req.params.id])
    const result = convo.rows[0]
    result.assigned_to = result.assigned_name
    result.messages = messages.rows
    result.pinned_messages = messages.rows.filter(m => m.pinned_at).sort((a, b) => new Date(b.pinned_at) - new Date(a.pinned_at))
    res.json(result)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.patch('/conversations/:id/status', auth, async (req, res) => {
  try {
    const wsId = await getWorkspaceId(req.user.id)
    const { status } = req.body
    const r = await pool.query(`UPDATE conversations SET status=$1, closed_at=$2, updated_at=NOW() WHERE id=$3 AND workspace_id=$4 RETURNING *`, [status, status === 'resolved' ? new Date() : null, req.params.id, wsId])
    res.json(r.rows[0])
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.patch('/conversations/:id/assign', auth, async (req, res) => {
  try {
    const wsId = await getWorkspaceId(req.user.id)
    const { assigned_to, team_id, handover_note } = req.body
    const agentId = assigned_to ? (await pool.query('SELECT id FROM users WHERE name=$1 AND workspace_id=$2', [assigned_to, wsId])).rows[0]?.id : null
    const r = await pool.query(`UPDATE conversations SET assigned_to=$1, team_id=$2, handover_note=$3, handover_note_by=$4, handover_note_at=$5, updated_at=NOW() WHERE id=$6 AND workspace_id=$7 RETURNING *`, [agentId, team_id, handover_note, handover_note ? req.user.id : null, handover_note ? new Date() : null, req.params.id, wsId])
    res.json(r.rows[0])
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.post('/conversations', auth, async (req, res) => {
  try {
    const wsId = await getWorkspaceId(req.user.id)
    const { contact_id, phone_number_id } = req.body
    if (!contact_id) return res.status(400).json({ error: 'contact_id is required' })
    const existing = await pool.query(
      `SELECT id FROM conversations WHERE contact_id=$1 AND workspace_id=$2 AND status='open' LIMIT 1`,
      [contact_id, wsId]
    )
    if (existing.rows.length > 0) {
      return res.json({ id: existing.rows[0].id, reused: true })
    }
    let phoneId = phone_number_id
    if (!phoneId) {
      const phoneRow = await pool.query(
        `SELECT id FROM phone_numbers WHERE workspace_id=$1 ORDER BY is_primary DESC, id ASC LIMIT 1`,
        [wsId]
      )
      phoneId = phoneRow.rows[0]?.id
    }
    if (!phoneId) return res.status(400).json({ error: 'No phone line configured' })
    const r = await pool.query(
      `INSERT INTO conversations (workspace_id, phone_number_id, contact_id, status, last_message_at)
       VALUES ($1, $2, $3, 'open', NOW()) RETURNING *`,
      [wsId, phoneId, contact_id]
    )
    res.json(r.rows[0])
  } catch (err) {
    console.error('POST /conversations error:', err)
    res.status(500).json({ error: err.message })
  }
})

// ─── WHATSAPP SEND HELPER ──────────────────────────────────────────────────────
async function sendWhatsAppMessage(toPhone, text) {
  const token = process.env.META_ACCESS_TOKEN
  const phoneNumberId = process.env.META_PHONE_NUMBER_ID
  const apiVersion = process.env.META_API_VERSION || 'v25.0'
  if (!token || !phoneNumberId) throw new Error('Meta credentials not configured')
  const cleanPhone = (toPhone || '').replace(/\D/g, '')
  if (!cleanPhone) throw new Error('Invalid recipient phone number')
  const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`
  const body = { messaging_product: 'whatsapp', to: cleanPhone, type: 'text', text: { body: text } }
  const res = await fetch(url, { method: 'POST', headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const data = await res.json()
  if (!res.ok) {
    const errMsg = data?.error?.message || 'WhatsApp send failed'
    const errCode = data?.error?.code || 'unknown'
    console.error('WhatsApp API error:', errCode, errMsg, data?.error)
    throw new Error(`${errMsg} (code ${errCode})`)
  }
  return data.messages?.[0]?.id || null
}

// ─── MESSAGES ──────────────────────────────────────────────────────────────────
app.post('/messages', auth, async (req, res) => {
  try {
    const wsId = await getWorkspaceId(req.user.id)
    const { conversation_id, direction, text, type, is_note, template_id } = req.body
    const r = await pool.query(
      `INSERT INTO messages (conversation_id, workspace_id, user_id, direction, text, type, is_note, template_id, status, sent_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending',NOW()) RETURNING *`,
      [conversation_id, wsId, req.user.id, direction, text, type || 'text', is_note || false, template_id]
    )
    const msg = r.rows[0]
    await pool.query(
      `UPDATE conversations SET last_message_at=NOW(), last_message_preview=$1, updated_at=NOW() WHERE id=$2`,
      [text?.slice(0, 100), conversation_id]
    )
    if (direction === 'out' && !is_note) {
      try {
        const phoneRow = await pool.query(
          `SELECT ct.phone FROM conversations c JOIN contacts ct ON ct.id = c.contact_id WHERE c.id = $1 AND c.workspace_id = $2`,
          [conversation_id, wsId]
        )
        const toPhone = phoneRow.rows[0]?.phone
        if (!toPhone) throw new Error('No recipient phone number on contact')
        const waMessageId = await sendWhatsAppMessage(toPhone, text)
        await pool.query(`UPDATE messages SET status='sent', whatsapp_message_id=$1 WHERE id=$2`, [waMessageId, msg.id])
        msg.status = 'sent'
        msg.whatsapp_message_id = waMessageId
      } catch (sendErr) {
        console.error('WhatsApp send failed for message', msg.id, ':', sendErr.message)
        await pool.query(`UPDATE messages SET status='failed' WHERE id=$1`, [msg.id])
        msg.status = 'failed'
        msg.error = sendErr.message
      }
    } else {
      await pool.query(`UPDATE messages SET status='sent' WHERE id=$1`, [msg.id])
      msg.status = 'sent'
    }
    io.emit('new_message', { ...msg, conversation_id })
    res.json(msg)
  } catch (err) {
    console.error('POST /messages error:', err)
    res.status(500).json({ error: err.message })
  }
})

// ─── CONTACTS ──────────────────────────────────────────────────────────────────
app.get('/contacts', auth, async (req, res) => {
  try {
    const wsId = await getWorkspaceId(req.user.id)
    const { type, stage, search } = req.query
    let query = 'SELECT * FROM contacts WHERE workspace_id=$1'
    const params = [wsId]; let idx = 2
    if (type) { query += ` AND type=$${idx++}`; params.push(type) }
    if (stage) { query += ` AND pipeline_stage=$${idx++}`; params.push(stage) }
    if (search) { query += ` AND (name ILIKE $${idx} OR phone ILIKE $${idx} OR email ILIKE $${idx})`; params.push(`%${search}%`); idx++ }
    query += ' ORDER BY created_at DESC'
    const r = await pool.query(query, params)
    res.json(r.rows)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.post('/contacts', auth, async (req, res) => {
  try {
    const wsId = await getWorkspaceId(req.user.id)
    const { name, phone, email, type, pipeline_stage } = req.body
    if (phone) {
      const dup = await pool.query('SELECT id, name FROM contacts WHERE phone=$1 AND workspace_id=$2', [phone, wsId])
      if (dup.rows.length > 0) return res.status(409).json({ error: `Duplicate: ${phone} already exists as ${dup.rows[0].name}`, existing_id: dup.rows[0].id })
    }
    const r = await pool.query(`INSERT INTO contacts (workspace_id, name, phone, email, type, pipeline_stage) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`, [wsId, name, phone, email, type || 'candidate', pipeline_stage || 'new'])
    await logAudit(wsId, req.user.id, 'create_contact', 'contact', r.rows[0].id, null, req.body)
    res.json(r.rows[0])
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.patch('/contacts/:id', auth, async (req, res) => {
  try {
    const wsId = await getWorkspaceId(req.user.id)
    const { name, phone, email, type, pipeline_stage, pdpa_consented, dnc, dnc_reason, opted_out, tags, notes, expected_salary, notice_period, linkedin_url, current_role, current_company } = req.body
    const r = await pool.query(`UPDATE contacts SET name=$1, phone=$2, email=$3, type=$4, pipeline_stage=$5, pdpa_consented=$6, dnc=$7, dnc_reason=$8, opted_out=$9, tags=$10, notes=$11, expected_salary=$12, notice_period=$13, linkedin_url=$14, candidate_role=$15, current_company=$16, updated_at=NOW() WHERE id=$17 AND workspace_id=$18 RETURNING *`, [name, phone, email, type, pipeline_stage, pdpa_consented, dnc, dnc_reason, opted_out, JSON.stringify(tags), notes, expected_salary, notice_period, linkedin_url, current_role, current_company, req.params.id, wsId])
    res.json(r.rows[0])
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.delete('/contacts/:id', auth, async (req, res) => {
  try {
    const wsId = await getWorkspaceId(req.user.id)
    await pool.query('DELETE FROM contacts WHERE id=$1 AND workspace_id=$2', [req.params.id, wsId])
    res.json({ success: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ─── TEMPLATES ─────────────────────────────────────────────────────────────────
app.get('/templates', auth, async (req, res) => {
  try {
    const wsId = await getWorkspaceId(req.user.id)
    const r = await pool.query('SELECT * FROM templates WHERE workspace_id=$1 ORDER BY created_at DESC', [wsId])
    res.json(r.rows)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.post('/templates', auth, async (req, res) => {
  try {
    const wsId = await getWorkspaceId(req.user.id)
    const { name, category, body, buttons, subject, type, status } = req.body
    const r = await pool.query(`INSERT INTO templates (workspace_id, name, category, body, buttons, subject, type, status, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`, [wsId, name, category, body, JSON.stringify(buttons || []), subject, type || 'whatsapp', status || 'draft', req.user.id])
    res.json(r.rows[0])
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.patch('/templates/:id', auth, async (req, res) => {
  try {
    const wsId = await getWorkspaceId(req.user.id)
    const { name, category, body, buttons, status, subject } = req.body
    const r = await pool.query(`UPDATE templates SET name=$1, category=$2, body=$3, buttons=$4, status=$5, subject=$6, updated_at=NOW() WHERE id=$7 AND workspace_id=$8 RETURNING *`, [name, category, body, JSON.stringify(buttons || []), status, subject, req.params.id, wsId])
    res.json(r.rows[0])
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.delete('/templates/:id', auth, async (req, res) => {
  try {
    const wsId = await getWorkspaceId(req.user.id)
    await pool.query('DELETE FROM templates WHERE id=$1 AND workspace_id=$2', [req.params.id, wsId])
    res.json({ success: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ─── SCHEDULED MESSAGES ────────────────────────────────────────────────────────
app.get('/scheduled', auth, async (req, res) => {
  try {
    const wsId = await getWorkspaceId(req.user.id)
    const r = await pool.query(`SELECT s.*, c.name as contact_name, c.phone as contact_phone, u.name as created_by_name, pn.display_name as phone_line FROM scheduled_messages s LEFT JOIN contacts c ON c.id=s.contact_id LEFT JOIN users u ON u.id=s.created_by LEFT JOIN phone_numbers pn ON pn.id=s.phone_number_id WHERE s.workspace_id=$1 ORDER BY s.scheduled_at ASC`, [wsId])
    res.json(r.rows)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.post('/scheduled', auth, async (req, res) => {
  try {
    const wsId = await getWorkspaceId(req.user.id)
    const { conversation_id, contact_id, phone_number_id, channel, template_id, subject, body, variables, buttons, scheduled_at, send_mode, email_to, email_cc, bulk_batch_id } = req.body
    const r = await pool.query(`INSERT INTO scheduled_messages (workspace_id, conversation_id, contact_id, phone_number_id, created_by, channel, template_id, subject, body, variables, buttons, scheduled_at, send_mode, email_to, email_cc, bulk_batch_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`, [wsId, conversation_id, contact_id, phone_number_id, req.user.id, channel || 'whatsapp', template_id, subject, body, JSON.stringify(variables || {}), JSON.stringify(buttons || []), scheduled_at, send_mode || 'scheduled', email_to, email_cc, bulk_batch_id])
    res.json(r.rows[0])
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.patch('/scheduled/:id/cancel', auth, async (req, res) => {
  try {
    const wsId = await getWorkspaceId(req.user.id)
    const r = await pool.query(`UPDATE scheduled_messages SET status='cancelled' WHERE id=$1 AND workspace_id=$2 AND status='pending' RETURNING *`, [req.params.id, wsId])
    res.json(r.rows[0])
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ─── QUICK REPLIES ─────────────────────────────────────────────────────────────
app.get('/quick-replies', auth, async (req, res) => {
  try {
    const wsId = await getWorkspaceId(req.user.id)
    const r = await pool.query(`SELECT * FROM quick_replies WHERE workspace_id=$1 AND (shared=true OR created_by=$2) ORDER BY title ASC`, [wsId, req.user.id])
    res.json(r.rows)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.post('/quick-replies', auth, async (req, res) => {
  try {
    const wsId = await getWorkspaceId(req.user.id)
    const { title, body, shortcut, shared } = req.body
    const r = await pool.query(`INSERT INTO quick_replies (workspace_id, created_by, title, body, shortcut, shared) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`, [wsId, req.user.id, title, body, shortcut, shared !== false])
    res.json(r.rows[0])
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ─── LABELS ────────────────────────────────────────────────────────────────────
app.get('/labels', auth, async (req, res) => {
  try {
    const wsId = await getWorkspaceId(req.user.id)
    const r = await pool.query('SELECT * FROM labels WHERE workspace_id=$1 ORDER BY name ASC', [wsId])
    res.json(r.rows)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ─── JOBS ──────────────────────────────────────────────────────────────────────
app.get('/jobs', auth, async (req, res) => {
  try {
    const wsId = await getWorkspaceId(req.user.id)
    const r = await pool.query(`SELECT j.*, u.name as assigned_name, c.name as client_name FROM job_orders j LEFT JOIN users u ON u.id=j.assigned_to LEFT JOIN contacts c ON c.id=j.client_contact_id WHERE j.workspace_id=$1 ORDER BY j.created_at DESC`, [wsId])
    res.json(r.rows)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.post('/jobs', auth, async (req, res) => {
  try {
    const wsId = await getWorkspaceId(req.user.id)
    const { title, client_contact_id, company, description, requirements, salary_min, salary_max, currency, headcount, location, employment_type, status, priority, deadline, assigned_to, team_id, placement_fee, fee_type } = req.body
    const r = await pool.query(`INSERT INTO job_orders (workspace_id, title, client_contact_id, company, description, requirements, salary_min, salary_max, currency, headcount, location, employment_type, status, priority, deadline, assigned_to, team_id, placement_fee, fee_type, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20) RETURNING *`, [wsId, title, client_contact_id, company, description, requirements, salary_min, salary_max, currency || 'SGD', headcount || 1, location, employment_type, status || 'open', priority || 'normal', deadline, assigned_to, team_id, placement_fee, fee_type || 'percentage', req.user.id])
    res.json(r.rows[0])
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ─── PDPA ──────────────────────────────────────────────────────────────────────
app.get('/pdpa', auth, async (req, res) => {
  try {
    const wsId = await getWorkspaceId(req.user.id)
    const r = await pool.query(`SELECT p.*, c.name as contact_name, c.phone, c.email, c.type as contact_type, u.name as collected_by_name FROM pdpa_records p JOIN contacts c ON c.id=p.contact_id LEFT JOIN users u ON u.id=p.collected_by WHERE p.workspace_id=$1 ORDER BY p.created_at DESC`, [wsId])
    res.json(r.rows)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.post('/pdpa', auth, async (req, res) => {
  try {
    const wsId = await getWorkspaceId(req.user.id)
    const { contact_id, status, method, notes } = req.body
    const r = await pool.query(`INSERT INTO pdpa_records (workspace_id, contact_id, status, method, consented_at, collected_by, notes) VALUES ($1,$2,$3,$4,NOW(),$5,$6) RETURNING *`, [wsId, contact_id, status, method, req.user.id, notes])
    if (status === 'consented') await pool.query('UPDATE contacts SET pdpa_consented=true, pdpa_consented_at=NOW() WHERE id=$1', [contact_id])
    res.json(r.rows[0])
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ─── AUDIT LOG ─────────────────────────────────────────────────────────────────
app.get('/audit-log', auth, async (req, res) => {
  try {
    const wsId = await getWorkspaceId(req.user.id)
    const r = await pool.query(`SELECT a.*, u.name as user_name FROM audit_log a LEFT JOIN users u ON u.id=a.user_id WHERE a.workspace_id=$1 ORDER BY a.created_at DESC LIMIT 500`, [wsId])
    res.json(r.rows)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ─── ANALYTICS ─────────────────────────────────────────────────────────────────
app.get('/analytics', auth, async (req, res) => {
  try {
    const wsId = await getWorkspaceId(req.user.id)
    const { from, to } = req.query
    const fromDate = from || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
    const toDate = to || new Date().toISOString().split('T')[0]
    const convStats = await pool.query(`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status='open') as open, COUNT(*) FILTER (WHERE status='pending') as pending, COUNT(*) FILTER (WHERE status='resolved') as resolved, COUNT(*) FILTER (WHERE c.type='candidate') as candidates, COUNT(*) FILTER (WHERE c.type='client') as clients FROM conversations cv JOIN contacts c ON c.id=cv.contact_id WHERE cv.workspace_id=$1 AND DATE(cv.last_message_at AT TIME ZONE 'Asia/Singapore') BETWEEN $2 AND $3`, [wsId, fromDate, toDate])
    const agentStats = await pool.query(`SELECT u.name, u.id, COUNT(cv.id) as total, COUNT(cv.id) FILTER (WHERE cv.status='open') as open, COUNT(cv.id) FILTER (WHERE cv.status='resolved') as resolved, COUNT(cv.id) FILTER (WHERE c.type='candidate') as candidates, COUNT(cv.id) FILTER (WHERE c.type='client') as clients FROM users u LEFT JOIN conversations cv ON cv.assigned_to=u.id AND DATE(cv.last_message_at AT TIME ZONE 'Asia/Singapore') BETWEEN $2 AND $3 AND cv.workspace_id=$1 LEFT JOIN contacts c ON c.id=cv.contact_id WHERE u.workspace_id=$1 AND u.active=true GROUP BY u.id, u.name ORDER BY total DESC`, [wsId, fromDate, toDate])
    const templateStats = await pool.query(`SELECT t.name, t.id, COUNT(m.id) as uses FROM templates t LEFT JOIN messages m ON m.template_id=t.id AND DATE(m.created_at AT TIME ZONE 'Asia/Singapore') BETWEEN $2 AND $3 WHERE t.workspace_id=$1 AND t.status='approved' GROUP BY t.id, t.name ORDER BY uses DESC LIMIT 5`, [wsId, fromDate, toDate])
    res.json({ conversations: convStats.rows[0], agents: agentStats.rows, templates: templateStats.rows })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ─── BUSINESS HOURS ────────────────────────────────────────────────────────────
app.get('/business-hours', auth, async (req, res) => {
  try {
    const wsId = await getWorkspaceId(req.user.id)
    const r = await pool.query('SELECT * FROM business_hours WHERE workspace_id=$1 ORDER BY id ASC', [wsId])
    res.json(r.rows)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.patch('/business-hours', auth, async (req, res) => {
  try {
    const wsId = await getWorkspaceId(req.user.id)
    const { hours } = req.body
    for (const h of hours) await pool.query(`UPDATE business_hours SET is_open=$1, open_time=$2, close_time=$3 WHERE workspace_id=$4 AND day_of_week=$5`, [h.is_open, h.open_time, h.close_time, wsId, h.day_of_week])
    res.json({ success: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ─── ROUTING ───────────────────────────────────────────────────────────────────
app.get('/routing', auth, async (req, res) => {
  try {
    const wsId = await getWorkspaceId(req.user.id)
    const r = await pool.query('SELECT * FROM routing_rules WHERE workspace_id=$1', [wsId])
    res.json(r.rows[0] || {})
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.patch('/routing', auth, async (req, res) => {
  try {
    const wsId = await getWorkspaceId(req.user.id)
    const { mode, sticky_assignment, round_robin, candidate_team_id, client_team_id, max_capacity, escalation_enabled, escalation_steps, after_hours_action, unassigned_queue, blackout_start, blackout_end } = req.body
    const existing = await pool.query('SELECT id FROM routing_rules WHERE workspace_id=$1', [wsId])
    if (existing.rows.length > 0) {
      const r = await pool.query(`UPDATE routing_rules SET mode=$1, sticky_assignment=$2, round_robin=$3, candidate_team_id=$4, client_team_id=$5, max_capacity=$6, escalation_enabled=$7, escalation_steps=$8, after_hours_action=$9, unassigned_queue=$10, blackout_start=$11, blackout_end=$12, updated_at=NOW() WHERE workspace_id=$13 RETURNING *`, [mode, sticky_assignment, round_robin, candidate_team_id, client_team_id, max_capacity, escalation_enabled, JSON.stringify(escalation_steps), after_hours_action, unassigned_queue, blackout_start, blackout_end, wsId])
      res.json(r.rows[0])
    } else {
      const r = await pool.query(`INSERT INTO routing_rules (workspace_id, mode, sticky_assignment, round_robin, candidate_team_id, client_team_id, max_capacity, escalation_enabled, escalation_steps, after_hours_action, unassigned_queue, blackout_start, blackout_end) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`, [wsId, mode, sticky_assignment, round_robin, candidate_team_id, client_team_id, max_capacity, escalation_enabled, JSON.stringify(escalation_steps), after_hours_action, unassigned_queue, blackout_start, blackout_end])
      res.json(r.rows[0])
    }
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ─── NOTIFICATIONS ─────────────────────────────────────────────────────────────
app.get('/notifications', auth, async (req, res) => {
  try {
    const r = await pool.query(`SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50`, [req.user.id])
    res.json(r.rows)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ─── SECURITY ──────────────────────────────────────────────────────────────────
app.get('/security', auth, async (req, res) => {
  try {
    const wsId = await getWorkspaceId(req.user.id)
    const r = await pool.query('SELECT * FROM security_settings WHERE workspace_id=$1', [wsId])
    res.json(r.rows[0] || {})
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.patch('/security', auth, async (req, res) => {
  try {
    const wsId = await getWorkspaceId(req.user.id)
    const { session_timeout_minutes, max_failed_logins, force_password_change, two_factor_required, password_min_length, password_require_special } = req.body
    const r = await pool.query(`UPDATE security_settings SET session_timeout_minutes=$1, max_failed_logins=$2, force_password_change=$3, two_factor_required=$4, password_min_length=$5, password_require_special=$6, updated_at=NOW() WHERE workspace_id=$7 RETURNING *`, [session_timeout_minutes, max_failed_logins, force_password_change, two_factor_required, password_min_length, password_require_special, wsId])
    res.json(r.rows[0])
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ─── CALENDAR ──────────────────────────────────────────────────────────────────
app.get('/calendar', auth, async (req, res) => {
  try {
    const wsId = await getWorkspaceId(req.user.id)
    const { from, to } = req.query
    let query = `SELECT ce.*, c.name as contact_name, u.name as created_by_name FROM calendar_events ce LEFT JOIN contacts c ON c.id=ce.contact_id LEFT JOIN users u ON u.id=ce.created_by WHERE ce.workspace_id=$1`
    const params = [wsId]
    if (from) { query += ' AND ce.event_date >= $2'; params.push(from) }
    if (to) { query += ` AND ce.event_date <= $${params.length + 1}`; params.push(to) }
    query += ' ORDER BY ce.event_date ASC, ce.event_time ASC'
    const r = await pool.query(query, params)
    res.json(r.rows)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.post('/calendar', auth, async (req, res) => {
  try {
    const wsId = await getWorkspaceId(req.user.id)
    const { conversation_id, contact_id, job_order_id, title, event_date, event_time, location, notes, type } = req.body
    const r = await pool.query(`INSERT INTO calendar_events (workspace_id, conversation_id, contact_id, job_order_id, created_by, title, event_date, event_time, location, notes, type) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`, [wsId, conversation_id, contact_id, job_order_id, req.user.id, title, event_date, event_time, location, notes, type || 'interview'])
    res.json(r.rows[0])
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ─── PROJECTS ──────────────────────────────────────────────────────────────────
app.get('/projects', auth, async (req, res) => {
  try {
    const wsId = await getWorkspaceId(req.user.id)
    const r = await pool.query(`
      SELECT p.*,
        u.name as created_by_name,
        COUNT(DISTINCT c.id) FILTER (WHERE c.status != 'resolved') as active_conversations,
        COUNT(DISTINCT c.id) as total_conversations,
        COUNT(DISTINCT c.id) FILTER (WHERE c.unread_count > 0) as unread_conversations,
        MAX(c.last_message_at) as last_activity
      FROM projects p
      LEFT JOIN users u ON u.id = p.created_by
      LEFT JOIN conversations c ON c.project_id = p.id
      WHERE p.workspace_id = $1
      GROUP BY p.id, u.name
      ORDER BY p.status ASC, p.created_at DESC
    `, [wsId])
    res.json(r.rows)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.post('/projects', auth, async (req, res) => {
  try {
    const wsId = await getWorkspaceId(req.user.id)
    const { client_name, start_month, start_year, colour } = req.body
    if (!client_name || !start_month || !start_year) return res.status(400).json({ error: 'Client name, month and year are required' })
    const r = await pool.query(`
      INSERT INTO projects (workspace_id, client_name, start_month, start_year, colour, created_by)
      VALUES ($1,$2,$3,$4,$5,$6) RETURNING *
    `, [wsId, client_name.trim(), start_month, start_year, colour || '#2563eb', req.user.id])
    await logAudit(wsId, req.user.id, 'create_project', 'project', r.rows[0].id, null, { client_name, start_month, start_year })
    res.json(r.rows[0])
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.patch('/projects/:id', auth, async (req, res) => {
  try {
    const wsId = await getWorkspaceId(req.user.id)
    const { client_name, start_month, start_year, colour, status } = req.body
    const old = await pool.query('SELECT * FROM projects WHERE id=$1 AND workspace_id=$2', [req.params.id, wsId])
    if (!old.rows.length) return res.status(404).json({ error: 'Project not found' })
    const r = await pool.query(`
      UPDATE projects SET
        client_name = COALESCE($1, client_name),
        start_month = COALESCE($2, start_month),
        start_year = COALESCE($3, start_year),
        colour = COALESCE($4, colour),
        status = COALESCE($5, status),
        archived_at = CASE WHEN $5 = 'archived' THEN NOW() ELSE archived_at END,
        updated_at = NOW()
      WHERE id=$6 AND workspace_id=$7 RETURNING *
    `, [client_name, start_month, start_year, colour, status, req.params.id, wsId])
    await logAudit(wsId, req.user.id, 'update_project', 'project', req.params.id, old.rows[0], req.body)
    res.json(r.rows[0])
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.delete('/projects/:id', auth, async (req, res) => {
  try {
    const wsId = await getWorkspaceId(req.user.id)
    await pool.query('UPDATE conversations SET project_id=NULL WHERE project_id=$1 AND workspace_id=$2', [req.params.id, wsId])
    await pool.query('DELETE FROM projects WHERE id=$1 AND workspace_id=$2', [req.params.id, wsId])
    res.json({ success: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.get('/projects/:id/conversations', auth, async (req, res) => {
  try {
    const wsId = await getWorkspaceId(req.user.id)
    const { type, agent_id, unread, page = 1, limit = 50 } = req.query
    const offset = (page - 1) * limit
    let query = `
      SELECT c.*, ct.name, ct.phone, ct.email, ct.type, ct.pipeline_stage,
        ct.pdpa_consented, ct.dnc,
        u.name as assigned_name, u.id as assigned_id,
        pn.number as phone_number, pn.display_name as phone_line,
        c.last_message_preview as preview
      FROM conversations c
      JOIN contacts ct ON ct.id = c.contact_id
      LEFT JOIN users u ON u.id = c.assigned_to
      LEFT JOIN phone_numbers pn ON pn.id = c.phone_number_id
      WHERE c.workspace_id=$1 AND c.project_id=$2
    `
    const params = [wsId, req.params.id]
    let idx = 3
    if (type) { query += ` AND ct.type=$${idx++}`; params.push(type) }
    if (agent_id) { query += ` AND c.assigned_to=$${idx++}`; params.push(agent_id) }
    if (unread === 'true') { query += ` AND c.unread_count > 0` }
    query += ` ORDER BY ct.type DESC, c.last_message_at DESC NULLS LAST`
    query += ` LIMIT $${idx++} OFFSET $${idx++}`
    params.push(limit, offset)
    const r = await pool.query(query, params)
    const total = await pool.query(`SELECT COUNT(*) FROM conversations c JOIN contacts ct ON ct.id=c.contact_id WHERE c.workspace_id=$1 AND c.project_id=$2${type ? ` AND ct.type='${type}'` : ''}`, [wsId, req.params.id])
    res.json({ conversations: r.rows, total: parseInt(total.rows[0].count), page: parseInt(page), limit: parseInt(limit) })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.patch('/projects/:id/assign-conversations', auth, async (req, res) => {
  try {
    const wsId = await getWorkspaceId(req.user.id)
    const { conversation_ids } = req.body
    if (!Array.isArray(conversation_ids) || conversation_ids.length === 0) return res.status(400).json({ error: 'conversation_ids array required' })
    await pool.query(`UPDATE conversations SET project_id=$1, updated_at=NOW() WHERE id=ANY($2) AND workspace_id=$3`, [req.params.id, conversation_ids, wsId])
    await logAudit(wsId, req.user.id, 'assign_to_project', 'project', req.params.id, null, { conversation_ids, count: conversation_ids.length })
    res.json({ success: true, assigned: conversation_ids.length })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.patch('/conversations/:id/project', auth, async (req, res) => {
  try {
    const wsId = await getWorkspaceId(req.user.id)
    const { project_id } = req.body
    const r = await pool.query(`UPDATE conversations SET project_id=$1, updated_at=NOW() WHERE id=$2 AND workspace_id=$3 RETURNING *`, [project_id, req.params.id, wsId])
    res.json(r.rows[0])
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ─── PIN MESSAGES ──────────────────────────────────────────────────────────────
app.patch('/messages/:id/pin', auth, async (req, res) => {
  try {
    const wsId = await getWorkspaceId(req.user.id)
    const msgId = req.params.id
    const msg = await pool.query(`SELECT id, conversation_id, pinned_at FROM messages WHERE id=$1 AND workspace_id=$2`, [msgId, wsId])
    if (!msg.rows.length) return res.status(404).json({ error: 'Message not found' })
    const { conversation_id, pinned_at } = msg.rows[0]
    if (pinned_at) {
      await pool.query(`UPDATE messages SET pinned_at=NULL, pinned_by=NULL WHERE id=$1`, [msgId])
      return res.json({ id: msgId, pinned: false })
    }
    const count = await pool.query(`SELECT COUNT(*) FROM messages WHERE conversation_id=$1 AND pinned_at IS NOT NULL`, [conversation_id])
    if (parseInt(count.rows[0].count) >= 3) {
      return res.status(400).json({ error: 'Maximum 3 pins per conversation. Unpin one first.' })
    }
    await pool.query(`UPDATE messages SET pinned_at=NOW(), pinned_by=$1 WHERE id=$2`, [req.user.id, msgId])
    res.json({ id: msgId, pinned: true })
  } catch (err) {
    console.error('Pin error:', err)
    res.status(500).json({ error: err.message })
  }
})

// ─── GLOBAL MESSAGE SEARCH ─────────────────────────────────────────────────────
app.get('/search', auth, async (req, res) => {
  try {
    const wsId = await getWorkspaceId(req.user.id)
    const q = (req.query.q || '').trim()
    if (!q || q.length < 2) return res.json({ results: [] })
    const searchLike = `%${q}%`
    const r = await pool.query(
      `SELECT m.id as message_id, m.text, m.direction, m.created_at, m.conversation_id,
              ct.name as contact_name, ct.phone as contact_phone, ct.type as contact_type,
              c.status as conversation_status
       FROM messages m
       JOIN conversations c ON c.id = m.conversation_id
       JOIN contacts ct ON ct.id = c.contact_id
       WHERE m.workspace_id = $1
         AND (m.text ILIKE $2 OR ct.name ILIKE $2 OR ct.phone ILIKE $2)
       ORDER BY m.created_at DESC
       LIMIT 30`,
      [wsId, searchLike]
    )
    res.json({ results: r.rows, query: q })
  } catch (err) {
    console.error('Search error:', err)
    res.status(500).json({ error: err.message })
  }
})

// ─── WHATSAPP WEBHOOK ──────────────────────────────────────────────────────────
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode']
  const token = req.query['hub.verify_token']
  const challenge = req.query['hub.challenge']
  const verifyToken = process.env.META_VERIFY_TOKEN
  if (mode === 'subscribe' && token === verifyToken) {
    console.log('✅ Webhook verified by Meta')
    return res.status(200).send(challenge)
  }
  console.warn('❌ Webhook verification failed. Mode:', mode, 'Token match:', token === verifyToken)
  return res.sendStatus(403)
})

app.post('/webhook', async (req, res) => {
  res.sendStatus(200)
  try {
    const body = req.body
    if (body?.object !== 'whatsapp_business_account') return
    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        if (change.field !== 'messages') continue
        const value = change.value || {}
        const wsRow = await pool.query(`SELECT id FROM workspaces WHERE workspace_type='internal' OR plan='enterprise' ORDER BY id ASC LIMIT 1`)
        const wsId = wsRow.rows[0]?.id
        if (!wsId) { console.warn('No workspace found for webhook'); continue }
        const phoneRow = await pool.query(`SELECT id FROM phone_numbers WHERE workspace_id=$1 ORDER BY is_primary DESC, id ASC LIMIT 1`, [wsId])
        const phoneId = phoneRow.rows[0]?.id
        for (const msg of value.messages || []) {
          const fromPhone = '+' + msg.from
          const text = msg.text?.body || msg.button?.text || `[${msg.type} message]`
          const waMessageId = msg.id
          let contactRow = await pool.query(`SELECT id, name FROM contacts WHERE phone=$1 AND workspace_id=$2 LIMIT 1`, [fromPhone, wsId])
          let contactId = contactRow.rows[0]?.id
          if (!contactId) {
            const newContact = await pool.query(`INSERT INTO contacts (workspace_id, name, phone, type, pipeline_stage) VALUES ($1, $2, $3, 'candidate', 'new') RETURNING id, name`, [wsId, fromPhone, fromPhone])
            contactId = newContact.rows[0].id
          }
          let convoRow = await pool.query(`SELECT id FROM conversations WHERE contact_id=$1 AND workspace_id=$2 AND status='open' LIMIT 1`, [contactId, wsId])
          let convoId = convoRow.rows[0]?.id
          if (!convoId) {
            const newConvo = await pool.query(`INSERT INTO conversations (workspace_id, phone_number_id, contact_id, status, last_message_at) VALUES ($1, $2, $3, 'open', NOW()) RETURNING id`, [wsId, phoneId, contactId])
            convoId = newConvo.rows[0].id
          }
          const insertedMsg = await pool.query(`INSERT INTO messages (conversation_id, workspace_id, direction, text, type, status, whatsapp_message_id, sent_at) VALUES ($1, $2, 'in', $3, 'text', 'received', $4, NOW()) RETURNING *`, [convoId, wsId, text, waMessageId])
          await pool.query(`UPDATE conversations SET last_message_at=NOW(), last_message_preview=$1, unread_count=COALESCE(unread_count,0)+1, updated_at=NOW() WHERE id=$2`, [text.slice(0, 100), convoId])
          io.emit('new_message', { ...insertedMsg.rows[0], conversation_id: convoId })
          console.log(`📥 Inbound message from ${fromPhone} saved to convo ${convoId}`)
        }
        for (const statusUpdate of value.statuses || []) {
          const waId = statusUpdate.id
          const status = statusUpdate.status
          const timestamp = new Date(parseInt(statusUpdate.timestamp) * 1000)
          const column = status === 'delivered' ? 'delivered_at' : status === 'read' ? 'read_at' : null
          if (column) {
            await pool.query(`UPDATE messages SET status=$1, ${column}=$2 WHERE whatsapp_message_id=$3`, [status, timestamp, waId])
          } else {
            await pool.query(`UPDATE messages SET status=$1 WHERE whatsapp_message_id=$2`, [status, waId])
          }
        }
      }
    }
  } catch (err) {
    console.error('Webhook processing error:', err)
  }
})

// ─── SOCKET.IO ─────────────────────────────────────────────────────────────────
io.on('connection', socket => {
  socket.on('join_conversation', id => socket.join(`conversation_${id}`))
  socket.on('leave_conversation', id => socket.leave(`conversation_${id}`))
  socket.on('agent_status', async ({ userId, status }) => {
    try {
      await pool.query('UPDATE users SET status=$1 WHERE id=$2', [status, userId])
      io.emit('agent_status_changed', { userId, status })
    } catch {}
  })
})

// ─── HEALTH CHECK ──────────────────────────────────────────────────────────────
app.get('/', (req, res) => res.json({ status: 'ok', platform: 'Tel-Cloud', version: '2.0.0', timestamp: new Date().toISOString() }))

// ─── START ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 4000
setupDatabase().then(() => {
  httpServer.listen(PORT, () => {
    console.log(`🚀 Tel-Cloud server running on port ${PORT}`)
    console.log(`📧 Super admin login: superadmin@tel-cloud.com / admin123`)
  })
})