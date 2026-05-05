const express = require('express')
const cors = require('cors')
const { createServer } = require('http')
const { Server } = require('socket.io')
const { Pool } = require('pg')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const metaLibraryMock = require('./metaLibraryMock')

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

// ─── CHUNK 4B: Access control helpers ──────────────────────────────────────────
// Role semantics:
//   - director, manager: workspace-wide access
//   - supervisor, senior_consultant, consultant: scoped to project memberships
//   - admin: scoped to project memberships AND read-only
//   - super_admin: platform layer, doesn't touch these helpers

// ─── CHUNK 5: Permission helpers (DB-driven) ────────────────────────────────
// Replaces Chunk 4B's hardcoded WORKSPACE_WIDE_ROLES / READ_ONLY_ROLES.
// Permissions live in role_permissions table, editable per workspace.

// Director always has everything. Other roles: read from DB.
async function getRolePermissions(workspaceId, role) {
  if (role === 'director') {
    return { scope: 'workspace_wide', permissions: ALL_PERMISSIONS_TRUE }
  }
  if (role === 'super_admin') {
    return { scope: 'workspace_wide', permissions: ALL_PERMISSIONS_TRUE }
  }

  const r = await pool.query(
    `SELECT scope, permissions FROM role_permissions WHERE workspace_id=$1 AND role=$2`,
    [workspaceId, role]
  )

  if (r.rows.length > 0) {
    return { scope: r.rows[0].scope, permissions: r.rows[0].permissions }
  }

  // Auto-seed fallback: workspace exists but has no rows for this role.
  // Seed all 5 default roles for this workspace atomically, then return the one we need.
  console.log(`   auto-seeding role_permissions for workspace ${workspaceId}`)
  for (const [r, config] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
    await pool.query(
      `INSERT INTO role_permissions (workspace_id, role, scope, permissions)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (workspace_id, role) DO NOTHING`,
      [workspaceId, r, config.scope, JSON.stringify(config.permissions)]
    )
  }

  // Return the defaults for the requested role
  const defaults = DEFAULT_ROLE_PERMISSIONS[role]
  if (defaults) return defaults

  // Unknown role: deny everything
  return { scope: 'project_only', permissions: ALL_PERMISSIONS_FALSE }
}

// Returns true if the user has the named permission.
async function hasPermission(req, permName) {
  const wsId = await getWorkspaceId(req.user.id)
  const config = await getRolePermissions(wsId, req.user.role)
  return config.permissions[permName] === true
}

// Express middleware. Blocks the request with 403 if the user lacks the permission.
function requirePermission(permName) {
  return async (req, res, next) => {
    try {
      if (await hasPermission(req, permName)) return next()
      return res.status(403).json({ error: `You do not have permission to ${permName.replace(/_/g, ' ')}.` })
    } catch (err) {
      console.error('requirePermission error:', err)
      return res.status(500).json({ error: 'Permission check failed' })
    }
  }
}

// Returns what projects this user can access.
// For workspace-wide scope: { workspaceWide: true, workspaceId }
// For project-only scope: { workspaceWide: false, workspaceId, projectIds: [array] }
async function getAccessibleProjects(req) {
  const role = req.user.role
  const wsId = await getWorkspaceId(req.user.id)

  // Director and super_admin always see everything
  if (role === 'director' || role === 'super_admin') {
    return { workspaceWide: true, workspaceId: wsId }
  }

  // Read scope from DB
  const config = await getRolePermissions(wsId, role)
  if (config.scope === 'workspace_wide') {
    return { workspaceWide: true, workspaceId: wsId }
  }

  // Project-only: fetch memberships
  const r = await pool.query(
    `SELECT project_id FROM project_members WHERE user_id = $1`,
    [req.user.id]
  )
  const projectIds = r.rows.map(row => row.project_id)
  return { workspaceWide: false, workspaceId: wsId, projectIds }
}

// Backward-compat wrapper. Chunk 4B code uses requireWrite; we map it to a generic
// check. Eventually every endpoint should use requirePermission(specific_permission)
// and this can be removed. For now, requireWrite treats all write permissions as one.
function requireWrite(req, res, next) {
  // Admin has no writes in default matrix. Director always writes. Others check DB.
  if (req.user.role === 'director' || req.user.role === 'super_admin') return next()
  if (req.user.role === 'admin') {
    return res.status(403).json({ error: 'Your account has view-only access.' })
  }
  // Other roles: pass through (Chunk 4B endpoints stay working, we'll tighten per-endpoint later)
  next()
}

// ─── CHUNK 5: Shared role-permissions logic (used by both director and super admin endpoints) ───
async function listRolePermissions(workspaceId) {
  const r = await pool.query(
    `SELECT role, scope, permissions FROM role_permissions WHERE workspace_id=$1
     ORDER BY CASE role
       WHEN 'manager' THEN 1
       WHEN 'supervisor' THEN 2
       WHEN 'senior_consultant' THEN 3
       WHEN 'consultant' THEN 4
       WHEN 'admin' THEN 5
       ELSE 99
     END`,
    [workspaceId]
  )
  return [
    { role: 'director', scope: 'workspace_wide', permissions: ALL_PERMISSIONS_TRUE, locked: true },
    ...r.rows.map(row => ({ role: row.role, scope: row.scope, permissions: row.permissions, locked: false }))
  ]
}

async function updateRolePermissions(workspaceId, role, scope, permissions) {
  if (role === 'director' || role === 'super_admin') {
    const err = new Error(`Cannot edit ${role} role permissions`)
    err.statusCode = 400
    throw err
  }
  if (!DEFAULT_ROLE_PERMISSIONS[role]) {
    const err = new Error(`Unknown role: ${role}`)
    err.statusCode = 400
    throw err
  }
  const validScopes = ['workspace_wide', 'project_only']
  if (!validScopes.includes(scope)) {
    const err = new Error(`Invalid scope: ${scope}. Must be workspace_wide or project_only.`)
    err.statusCode = 400
    throw err
  }
  // Ensure all 13 permissions are present (prevent partial updates from corrupting state)
  const validKeys = Object.keys(ALL_PERMISSIONS_TRUE)
  const cleanPermissions = {}
  for (const key of validKeys) {
    cleanPermissions[key] = permissions[key] === true
  }
  const r = await pool.query(
    `UPDATE role_permissions SET scope=$1, permissions=$2, updated_at=NOW()
     WHERE workspace_id=$3 AND role=$4 RETURNING role, scope, permissions`,
    [scope, JSON.stringify(cleanPermissions), workspaceId, role]
  )
  if (!r.rows.length) {
    const err = new Error(`No role_permissions row for workspace ${workspaceId} role ${role}`)
    err.statusCode = 404
    throw err
  }
  return r.rows[0]
}

async function resetRolePermissionsToDefaults(workspaceId) {
  for (const [role, config] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
    await pool.query(
      `INSERT INTO role_permissions (workspace_id, role, scope, permissions)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (workspace_id, role) DO UPDATE SET
         scope=EXCLUDED.scope, permissions=EXCLUDED.permissions, updated_at=NOW()`,
      [workspaceId, role, config.scope, JSON.stringify(config.permissions)]
    )
  }
}

// ─── CHUNK 5: Default permission matrix ─────────────────────────────────────
// Seeded into role_permissions table when a workspace is created.
// Director role is NOT in this matrix �?directors always have everything.
const ALL_PERMISSIONS_TRUE = {
  send_messages: true, write_notes: true, manage_conversations: true,
  manage_contacts: true, manage_projects: true, manage_project_members: true,
  manage_templates: true, manage_scheduled_messages: true,
  manage_phone_numbers: true, manage_teams: true,
  manage_workspace_settings: true, manage_staff: true,
  manage_role_permissions: true,
  manage_quick_replies: true,
  manage_calendar: true,
  manage_broadcasts: true,
  manage_pdpa: true
}
const ALL_PERMISSIONS_FALSE = {
  send_messages: false, write_notes: false, manage_conversations: false,
  manage_contacts: false, manage_projects: false, manage_project_members: false,
  manage_templates: false, manage_scheduled_messages: false,
  manage_phone_numbers: false, manage_teams: false,
  manage_workspace_settings: false, manage_staff: false,
  manage_role_permissions: false,
  manage_quick_replies: false,
  manage_calendar: false,
  manage_broadcasts: false,
  manage_pdpa: false
}
const DEFAULT_ROLE_PERMISSIONS = {
  manager: {
    scope: 'workspace_wide',
    permissions: { ...ALL_PERMISSIONS_TRUE, manage_role_permissions: false }
  },
  supervisor: {
    scope: 'project_only',
    permissions: {
      ...ALL_PERMISSIONS_FALSE,
      send_messages: true, write_notes: true, manage_conversations: true,
      manage_contacts: true, manage_project_members: true,
      manage_templates: true, manage_scheduled_messages: true,
      manage_quick_replies: true, manage_broadcasts: true
    }
  },
  senior_consultant: {
    scope: 'project_only',
    permissions: {
      ...ALL_PERMISSIONS_FALSE,
      send_messages: true, write_notes: true, manage_conversations: true,
      manage_contacts: true,
      manage_templates: true, manage_scheduled_messages: true,
      manage_quick_replies: true, manage_broadcasts: true
    }
  },
  consultant: {
    scope: 'project_only',
    permissions: {
      ...ALL_PERMISSIONS_FALSE,
      send_messages: true, write_notes: true, manage_conversations: true,
      manage_contacts: true,
      manage_quick_replies: true
    }
  },
  admin: {
    scope: 'project_only',
    permissions: { ...ALL_PERMISSIONS_FALSE }
  }
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

    await client.query(`CREATE TABLE IF NOT EXISTS team_members (id SERIAL PRIMARY KEY, team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE, user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, UNIQUE(team_id, user_id))`)
    await client.query(`CREATE TABLE IF NOT EXISTS routing_rules (id SERIAL PRIMARY KEY, workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE, mode VARCHAR(20) DEFAULT 'smart', sticky_assignment BOOLEAN DEFAULT true, round_robin BOOLEAN DEFAULT true, candidate_team_id INTEGER, client_team_id INTEGER, max_capacity INTEGER DEFAULT 20, escalation_enabled BOOLEAN DEFAULT true, escalation_steps JSONB DEFAULT '[]', after_hours_action VARCHAR(20) DEFAULT 'auto_reply', unassigned_queue BOOLEAN DEFAULT true, blackout_start VARCHAR(5) DEFAULT '22:00', blackout_end VARCHAR(5) DEFAULT '08:00', created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW())`)
    await client.query(`CREATE TABLE IF NOT EXISTS business_hours (id SERIAL PRIMARY KEY, workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE, phone_number_id INTEGER, day_of_week VARCHAR(20), is_open BOOLEAN DEFAULT true, open_time VARCHAR(5) DEFAULT '09:00', close_time VARCHAR(5) DEFAULT '18:00', created_at TIMESTAMP DEFAULT NOW())`)
    await client.query(`CREATE TABLE IF NOT EXISTS contacts (id SERIAL PRIMARY KEY, workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE, name VARCHAR(255), phone VARCHAR(50), email VARCHAR(255), type VARCHAR(20) DEFAULT 'candidate', pipeline_stage VARCHAR(50) DEFAULT 'new', assigned_to INTEGER, team_id INTEGER, pdpa_consented BOOLEAN DEFAULT false, pdpa_consented_at TIMESTAMP, dnc BOOLEAN DEFAULT false, dnc_reason TEXT, opted_out BOOLEAN DEFAULT false, tags JSONB DEFAULT '[]', notes TEXT, source VARCHAR(100), candidate_role VARCHAR(255), current_company VARCHAR(255), expected_salary DECIMAL, notice_period VARCHAR(50), linkedin_url TEXT, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW())`)
    await client.query(`CREATE TABLE IF NOT EXISTS conversations (id SERIAL PRIMARY KEY, workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE, phone_number_id INTEGER, contact_id INTEGER REFERENCES contacts(id) ON DELETE CASCADE, assigned_to INTEGER, team_id INTEGER, status VARCHAR(20) DEFAULT 'open', labels JSONB DEFAULT '[]', last_message_at TIMESTAMP, last_message_preview TEXT, unread_count INTEGER DEFAULT 0, priority VARCHAR(20) DEFAULT 'normal', handover_note TEXT, handover_note_by INTEGER, handover_note_at TIMESTAMP, closed_at TIMESTAMP, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW())`)
    await client.query(`CREATE TABLE IF NOT EXISTS messages (id SERIAL PRIMARY KEY, conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE, workspace_id INTEGER, user_id INTEGER, direction VARCHAR(10), type VARCHAR(20) DEFAULT 'text', text TEXT, media_url TEXT, template_id INTEGER, status VARCHAR(20) DEFAULT 'sent', whatsapp_message_id VARCHAR(255), delivered_at TIMESTAMP, read_at TIMESTAMP, is_note BOOLEAN DEFAULT false, is_scheduled BOOLEAN DEFAULT false, scheduled_at TIMESTAMP, sent_at TIMESTAMP, created_at TIMESTAMP DEFAULT NOW())`)
    await client.query(`CREATE TABLE IF NOT EXISTS scheduled_messages (id SERIAL PRIMARY KEY, workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE, conversation_id INTEGER, contact_id INTEGER, phone_number_id INTEGER, created_by INTEGER, channel VARCHAR(20) DEFAULT 'whatsapp', template_id INTEGER, subject TEXT, body TEXT, variables JSONB DEFAULT '{}', buttons JSONB DEFAULT '[]', scheduled_at TIMESTAMP, send_mode VARCHAR(20) DEFAULT 'scheduled', status VARCHAR(20) DEFAULT 'pending', sent_at TIMESTAMP, failed_at TIMESTAMP, failed_reason TEXT, email_to VARCHAR(255), email_cc VARCHAR(255), email_opened_at TIMESTAMP, email_bounced BOOLEAN DEFAULT false, bulk_batch_id VARCHAR(100), created_at TIMESTAMP DEFAULT NOW())`)
    await client.query(`CREATE TABLE IF NOT EXISTS templates (id SERIAL PRIMARY KEY, workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE, name VARCHAR(255), category VARCHAR(50) DEFAULT 'utility', type VARCHAR(20) DEFAULT 'whatsapp', status VARCHAR(20) DEFAULT 'draft', body TEXT, subject TEXT, buttons JSONB DEFAULT '[]', variables JSONB DEFAULT '[]', language VARCHAR(10) DEFAULT 'en', meta_template_id VARCHAR(255), approved_at TIMESTAMP, rejected_reason TEXT, created_by INTEGER, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW())`)
    await client.query(`CREATE TABLE IF NOT EXISTS template_library (id SERIAL PRIMARY KEY, category VARCHAR(50), industry VARCHAR(100), template_key VARCHAR(100) UNIQUE NOT NULL, display_name VARCHAR(200), description TEXT, header TEXT, body TEXT NOT NULL, footer TEXT, buttons JSONB, variables JSONB, is_active BOOLEAN DEFAULT true, is_featured BOOLEAN DEFAULT false, created_at TIMESTAMP DEFAULT NOW())`)
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
    console.log('�?Database schema ready')
    await seedDatabase()
    await runPlatformCleanupMigration()
    await runChunk5Migration()
    await runChunk5bMigration()
    await runTemplateLibrarySeedsMigration()
    await runTemplateLibraryV2Migration()
    await runPhaseII1Migration()
    await runChunk9HeaderFooterMigration()
    await runChunk10BackfillAudienceMigration()
    await runChunk11VariablesShapeMigration()
    await runChunk12MetaLibraryLabelsMigration()
    await runChunk13CalendarMigration()
    await runChunk13bCalendarPermissionJsonbMigration()
    await runChunk14EventRemindersMigration()
    await runChunk15BroadcastsMigration()
    await runChunk16BroadcastsPermissionMigration()
    await runChunk17BroadcastSafetyMigration()
    await runChunk18ContactViewsMigration()
    await runChunk19NotificationPreferencesMigration()
    await runChunk20EmailSettingsMigration()
    await runChunk21PdpaConstraintsMigration()
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('�?DB setup error:', err.message)
  } finally { client.release() }
}

async function seedDatabase() {
  try {
    const existing = await pool.query('SELECT id FROM workspaces WHERE slug=$1', ['telcloud-main'])
    if (existing.rows.length > 0) { console.log('�?Seed data exists'); return }
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
    console.log('�?Seed data created (Tel-Cloud Sandbox, no users)')
  } catch (err) { console.error('�?Seed error:', err.message) }
}

// ─── PLATFORM CLEANUP MIGRATION (one-time) ──────────────────────────────────────
// Deletes legacy agency-hub users and any demo tenant data, then creates the
// super admin account. Runs once via _migrations lock.
async function runPlatformCleanupMigration() {
  const MIGRATION_ID = 'platform_cleanup_v1'
  try {
    const applied = await pool.query('SELECT id FROM _migrations WHERE id=$1', [MIGRATION_ID])
    if (applied.rows.length > 0) {
      console.log(`�?Migration ${MIGRATION_ID} already applied, skipping`)
      return
    }
    console.log(`🔧 Running migration ${MIGRATION_ID}...`)

    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      const ws = await client.query(`SELECT id FROM workspaces WHERE slug='telcloud-main' LIMIT 1`)
      if (!ws.rows.length) throw new Error('telcloud-main workspace missing �?seedDatabase must run first')
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
      console.log(`�?Migration ${MIGRATION_ID} complete`)
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  } catch (err) {
    console.error(`�?Migration ${MIGRATION_ID} FAILED:`, err.message)
    throw err
  }
}

// ─── CHUNK 5: Role Permissions Migration ────────────────────────────────────
async function runChunk5Migration() {
  const MIGRATION_ID = 'chunk_5_role_permissions_v1'
  try {
    const applied = await pool.query('SELECT id FROM _migrations WHERE id=$1', [MIGRATION_ID])
    if (applied.rows.length > 0) {
      console.log(`�?Migration ${MIGRATION_ID} already applied, skipping`)
      return
    }
    console.log(`🔧 Running migration ${MIGRATION_ID}...`)

    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // 1. Create role_permissions table
      await client.query(`
        CREATE TABLE IF NOT EXISTS role_permissions (
          id SERIAL PRIMARY KEY,
          workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE,
          role VARCHAR(50) NOT NULL,
          scope VARCHAR(20) NOT NULL DEFAULT 'project_only',
          permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(workspace_id, role)
        )
      `)

      // 2. Seed defaults for every existing tenant workspace (skip platform workspace)
      const workspaces = await client.query(
        `SELECT id, name FROM workspaces WHERE workspace_type != 'platform' OR workspace_type IS NULL`
      )

      let seededCount = 0
      for (const ws of workspaces.rows) {
        for (const [role, config] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
          const result = await client.query(
            `INSERT INTO role_permissions (workspace_id, role, scope, permissions)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (workspace_id, role) DO NOTHING`,
            [ws.id, role, config.scope, JSON.stringify(config.permissions)]
          )
          if (result.rowCount > 0) seededCount++
        }
        console.log(`   processed workspace ${ws.id} (${ws.name})`)
      }
      console.log(`   seeded ${seededCount} role_permissions rows total`)

      await client.query(`INSERT INTO _migrations (id) VALUES ($1)`, [MIGRATION_ID])
      await client.query('COMMIT')
      console.log(`�?Migration ${MIGRATION_ID} complete`)
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  } catch (err) {
    console.error(`�?Migration ${MIGRATION_ID} FAILED:`, err.message)
    throw err
  }
}

// ─── CHUNK 5B: Backfill manage_quick_replies on existing role_permissions ─────
async function runChunk5bMigration() {
  const MIGRATION_ID = 'chunk_5b_quick_replies_v1'
  try {
    const applied = await pool.query('SELECT id FROM _migrations WHERE id=$1', [MIGRATION_ID])
    if (applied.rows.length > 0) {
      console.log(`�?Migration ${MIGRATION_ID} already applied, skipping`)
      return
    }
    console.log(`🔧 Running migration ${MIGRATION_ID}...`)

    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // Backfill manage_quick_replies key on every existing row.
      // Default value matches DEFAULT_ROLE_PERMISSIONS (true for everyone except admin).
      const rows = await client.query(`SELECT id, role, permissions FROM role_permissions`)

      let updated = 0
      for (const row of rows.rows) {
        if (row.permissions.manage_quick_replies !== undefined) continue

        const defaultValue = row.role === 'admin' ? false : true
        const newPermissions = { ...row.permissions, manage_quick_replies: defaultValue }

        await client.query(
          `UPDATE role_permissions SET permissions=$1, updated_at=NOW() WHERE id=$2`,
          [JSON.stringify(newPermissions), row.id]
        )
        updated++
      }
      console.log(`   backfilled manage_quick_replies on ${updated} rows`)

      await client.query(`INSERT INTO _migrations (id) VALUES ($1)`, [MIGRATION_ID])
      await client.query('COMMIT')
      console.log(`�?Migration ${MIGRATION_ID} complete`)
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  } catch (err) {
    console.error(`�?Migration ${MIGRATION_ID} FAILED:`, err.message)
    throw err
  }
}

// ─── CHUNK 6: Template Library Seeds ────────────────────────────────────────
async function runTemplateLibrarySeedsMigration() {
  const MIGRATION_ID = 'template_library_seeds_v1'
  try {
    const applied = await pool.query('SELECT id FROM _migrations WHERE id=$1', [MIGRATION_ID])
    if (applied.rows.length > 0) {
      console.log(`Migration ${MIGRATION_ID} already applied, skipping`)
      return
    }
    console.log(`Running migration ${MIGRATION_ID}...`)

    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      const templates = [
        // GENERAL (6)
        { category: 'application', industry: 'general', template_key: 'application_received',
          display_name: 'Application Received',
          description: 'Auto-acknowledgement when a candidate submits an application.',
          header: 'Application Received',
          body: 'Hi {{1}}, thank you for applying for the {{2}} position at {{3}}. We have received your application and our team will review it within {{4}} working days. We will be in touch shortly.',
          footer: 'Sent by {{3}} via Tel-Cloud',
          buttons: [],
          variables: { '1': 'candidate_name', '2': 'job_title', '3': 'company_name', '4': 'review_days' },
          is_featured: true },

        { category: 'interview', industry: 'general', template_key: 'interview_invitation',
          display_name: 'Interview Invitation',
          description: 'Invite a shortlisted candidate to an interview with date, time, and location.',
          header: 'Interview Invitation',
          body: 'Hi {{1}}, you have been shortlisted for the {{2}} role at {{3}}. We would like to invite you for an interview on {{4}} at {{5}}. Location: {{6}}. Please confirm your attendance by replying YES.',
          footer: 'Reply STOP to opt out',
          buttons: [{ type: 'QUICK_REPLY', text: 'Confirm' }, { type: 'QUICK_REPLY', text: 'Reschedule' }],
          variables: { '1': 'candidate_name', '2': 'job_title', '3': 'company_name', '4': 'interview_date', '5': 'interview_time', '6': 'location' },
          is_featured: true },

        { category: 'interview', industry: 'general', template_key: 'interview_reminder',
          display_name: 'Interview Reminder',
          description: 'Sent 24 hours before a scheduled interview.',
          header: 'Reminder: Interview Tomorrow',
          body: 'Hi {{1}}, this is a friendly reminder of your interview for the {{2}} role tomorrow, {{3}} at {{4}}. Location: {{5}}. Please bring a copy of your NRIC and resume. See you soon.',
          footer: null,
          buttons: [],
          variables: { '1': 'candidate_name', '2': 'job_title', '3': 'interview_date', '4': 'interview_time', '5': 'location' },
          is_featured: false },

        { category: 'interview', industry: 'general', template_key: 'interview_reschedule',
          display_name: 'Interview Reschedule',
          description: 'Notify candidate that an interview has been moved to a new slot.',
          header: 'Interview Rescheduled',
          body: 'Hi {{1}}, we need to reschedule your interview for the {{2}} role. The new date is {{3}} at {{4}}. Location remains {{5}}. Please reply YES to confirm or contact us if this does not work for you.',
          footer: null,
          buttons: [{ type: 'QUICK_REPLY', text: 'Confirm new slot' }, { type: 'QUICK_REPLY', text: 'Suggest another time' }],
          variables: { '1': 'candidate_name', '2': 'job_title', '3': 'new_date', '4': 'new_time', '5': 'location' },
          is_featured: false },

        { category: 'offer', industry: 'general', template_key: 'offer_letter',
          display_name: 'Offer Letter Notification',
          description: 'Notify a candidate that an offer letter has been issued.',
          header: 'Congratulations',
          body: 'Hi {{1}}, congratulations. We are pleased to offer you the position of {{2}} at {{3}}, with a start date of {{4}}. Your offer letter has been sent to {{5}}. Please review and respond by {{6}}.',
          footer: 'Sent by {{3}} via Tel-Cloud',
          buttons: [{ type: 'QUICK_REPLY', text: 'Accept' }, { type: 'QUICK_REPLY', text: 'I have questions' }],
          variables: { '1': 'candidate_name', '2': 'job_title', '3': 'company_name', '4': 'start_date', '5': 'email', '6': 'response_deadline' },
          is_featured: true },

        { category: 'onboarding', industry: 'general', template_key: 'document_request',
          display_name: 'Document Submission Request',
          description: 'Request onboarding documents from a successful candidate.',
          header: 'Documents Required',
          body: 'Hi {{1}}, to proceed with your onboarding for the {{2}} role, please send us the following: {{3}}. Kindly submit them by {{4}}. You can reply directly to this message with the files attached.',
          footer: null,
          buttons: [],
          variables: { '1': 'candidate_name', '2': 'job_title', '3': 'document_list', '4': 'submission_deadline' },
          is_featured: false },

        // EQUE-FLAVOURED (6)
        { category: 'compliance', industry: 'security_fnb_cleaning', template_key: 'security_license_check',
          display_name: 'Security License Verification',
          description: 'Request PLRD security license details from a security officer applicant.',
          header: 'License Verification',
          body: 'Hi {{1}}, thank you for applying for the Security Officer role with {{2}}. Please reply with: (1) your PLRD license number, (2) license grade, and (3) expiry date. We need this to proceed with your application.',
          footer: 'Required by MOM and PLRD regulations',
          buttons: [],
          variables: { '1': 'candidate_name', '2': 'company_name' },
          is_featured: true },

        { category: 'shift_assignment', industry: 'security_fnb_cleaning', template_key: 'cleaning_shift_offer',
          display_name: 'Cleaning Shift Offer',
          description: 'Offer a cleaning shift to a registered cleaner with site, hours, and pay rate.',
          header: 'Shift Available',
          body: 'Hi {{1}}, a cleaning shift is available: {{2}} on {{3}}, {{4}} to {{5}}. Pay: ${{6}}/hour. Reply YES to accept or NO to decline within 30 minutes.',
          footer: null,
          buttons: [{ type: 'QUICK_REPLY', text: 'Accept shift' }, { type: 'QUICK_REPLY', text: 'Decline' }],
          variables: { '1': 'candidate_name', '2': 'site_address', '3': 'shift_date', '4': 'start_time', '5': 'end_time', '6': 'hourly_rate' },
          is_featured: true },

        { category: 'trial', industry: 'security_fnb_cleaning', template_key: 'fnb_trial_shift',
          display_name: 'F&B Trial Shift Invitation',
          description: 'Invite an F&B candidate to a paid trial shift before formal hiring.',
          header: 'Trial Shift Confirmed',
          body: 'Hi {{1}}, your trial shift at {{2}} is confirmed for {{3}} from {{4}} to {{5}}. Dress code: black top, black pants, covered shoes. Report to {{6}} on arrival. Trial pay: ${{7}}.',
          footer: null,
          buttons: [],
          variables: { '1': 'candidate_name', '2': 'outlet_name', '3': 'trial_date', '4': 'start_time', '5': 'end_time', '6': 'manager_name', '7': 'trial_pay' },
          is_featured: false },

        { category: 'onboarding', industry: 'security_fnb_cleaning', template_key: 'uniform_collection',
          display_name: 'Uniform Collection Notice',
          description: 'Inform a new hire when and where to collect their uniform.',
          header: 'Uniform Collection',
          body: 'Hi {{1}}, please collect your uniform from our office at {{2}} on {{3}} between {{4}} and {{5}}. Bring your IC for verification. Sizes available: S, M, L, XL.',
          footer: null,
          buttons: [],
          variables: { '1': 'candidate_name', '2': 'office_address', '3': 'collection_date', '4': 'start_time', '5': 'end_time' },
          is_featured: false },

        { category: 'onboarding', industry: 'security_fnb_cleaning', template_key: 'first_day_reporting',
          display_name: 'First Day Reporting Instructions',
          description: 'Send first-day reporting details: time, address, supervisor, and what to bring.',
          header: 'Welcome to the Team',
          body: 'Hi {{1}}, welcome aboard. Your first day is {{2}}. Report to {{3}} at {{4}} by {{5}}. Bring your IC, bank details, and the uniform issued. Your supervisor on site is {{6}} ({{7}}).',
          footer: 'See you on site',
          buttons: [],
          variables: { '1': 'candidate_name', '2': 'start_date', '3': 'site_name', '4': 'site_address', '5': 'report_time', '6': 'supervisor_name', '7': 'supervisor_phone' },
          is_featured: true },

        { category: 'onboarding', industry: 'security_fnb_cleaning', template_key: 'payroll_setup_request',
          display_name: 'Payroll and Bank Details Request',
          description: 'Collect bank account details for payroll setup before first payday.',
          header: 'Payroll Setup',
          body: 'Hi {{1}}, to set up your payroll, please reply with: (1) full name as per bank, (2) bank name, (3) account number. Salary will be credited on the {{2}} of each month. All details are kept confidential.',
          footer: 'Compliant with PDPA Singapore',
          buttons: [],
          variables: { '1': 'candidate_name', '2': 'payroll_day' },
          is_featured: false }
      ]

      let inserted = 0
      for (const t of templates) {
        const r = await client.query(
          `INSERT INTO template_library
             (category, industry, template_key, display_name, description,
              header, body, footer, buttons, variables, is_active, is_featured)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,true,$11)
           ON CONFLICT (template_key) DO NOTHING`,
          [t.category, t.industry, t.template_key, t.display_name, t.description,
           t.header, t.body, t.footer,
           JSON.stringify(t.buttons), JSON.stringify(t.variables),
           t.is_featured]
        )
        if (r.rowCount > 0) inserted++
      }
      console.log(`   inserted ${inserted} of ${templates.length} library templates`)

      await client.query(`INSERT INTO _migrations (id) VALUES ($1)`, [MIGRATION_ID])
      await client.query('COMMIT')
      console.log(`Migration ${MIGRATION_ID} complete`)
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  } catch (err) {
    console.error(`Migration ${MIGRATION_ID} FAILED:`, err.message)
    throw err
  }
}

// ============================================================
// Chunk 18 Contact Views v1
// Saved filter/sort/visibility configurations per user. A user can save
// "Active engineering candidates assigned to me" and reload it instantly.
// Workspace-scoped because filter values reference workspace-specific data
// like recruiter ids and tag names.
async function runChunk18ContactViewsMigration() {
  const MIGRATION_ID = 'chunk_18_contact_views_v1'
  try {
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
        CREATE TABLE IF NOT EXISTS contact_views (
          id SERIAL PRIMARY KEY,
          workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          name VARCHAR(100) NOT NULL,
          filters JSONB NOT NULL DEFAULT '{}'::jsonb,
          sort JSONB DEFAULT '{}'::jsonb,
          columns JSONB DEFAULT '[]'::jsonb,
          is_shared BOOLEAN DEFAULT false,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `)
      console.log(`   created contact_views table`)

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_contact_views_user
        ON contact_views(workspace_id, user_id)
      `)
      // Shared views index lets us efficiently query "views I have access to":
      // my own + all shared in this workspace.
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_contact_views_shared
        ON contact_views(workspace_id, is_shared)
        WHERE is_shared = true
      `)
      console.log(`   created 2 indexes`)

      await client.query(`INSERT INTO _migrations (id) VALUES ($1)`, [MIGRATION_ID])
      await client.query('COMMIT')
      console.log(`Migration ${MIGRATION_ID} complete`)
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  } catch (err) {
    console.error(`Migration ${MIGRATION_ID} FAILED:`, err.message)
    throw err
  }
}

// ============================================================
// Chunk 19 Notification Preferences v1
// Per-user notification preferences stored as JSONB on the users table.
// Each user has a map of { event_key: { in_app: bool, email: bool } }.
// JSONB chosen over a separate prefs table because reads are always
// "give me my preferences" (one row by user_id) and the data is bounded
// (~15 events × 2 channels = 30 booleans). Defaults are applied at the
// API layer, not in the DB, so we can change defaults without re-running
// migrations.
async function runChunk19NotificationPreferencesMigration() {
  const MIGRATION_ID = 'chunk_19_notification_preferences_v1'
  try {
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
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{}'::jsonb
      `)
      console.log(`   added notification_preferences column to users`)
      await client.query(`INSERT INTO _migrations (id) VALUES ($1)`, [MIGRATION_ID])
      await client.query('COMMIT')
      console.log(`Migration ${MIGRATION_ID} complete`)
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  } catch (err) {
    console.error(`Migration ${MIGRATION_ID} FAILED:`, err.message)
    throw err
  }
}
// ============================================================
// Chunk 20 Email Settings v1
// Workspace-level email integration settings. Separate table (not workspace
// columns) because this domain will grow with Outlook OAuth state, sender
// domain verification, and tracking preferences. Mirrors the pattern used
// for security_settings, business_hours, routing_rules.
//
// Outlook OAuth fields (whatsapp_token-style) intentionally NOT added here —
// connection state stays on workspaces table to keep auth state co-located
// with the workspace identity. This table is for behavioural settings only:
// what name to send as, what time to suppress sends, what signature to use.
async function runChunk20EmailSettingsMigration() {
  const MIGRATION_ID = 'chunk_20_email_settings_v1'
  try {
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
        CREATE TABLE IF NOT EXISTS email_settings (
          id SERIAL PRIMARY KEY,
          workspace_id INTEGER NOT NULL UNIQUE REFERENCES workspaces(id) ON DELETE CASCADE,
          sender_name VARCHAR(255),
          reply_to VARCHAR(255),
          send_mode VARCHAR(20) DEFAULT 'manual',
          blackout_start VARCHAR(5) DEFAULT '22:00',
          blackout_end VARCHAR(5) DEFAULT '08:00',
          default_signature TEXT,
          open_tracking BOOLEAN DEFAULT true,
          bounce_alerts BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `)
      console.log(`   created email_settings table`)
      // Backfill: ensure every existing workspace has a row so GET always
      // returns something (even if all defaults). Avoids the NotificationSettings
      // pattern of "merge defaults at API layer" — here we just have a single
      // row per workspace and let the column DEFAULTs do the work.
      await client.query(`
        INSERT INTO email_settings (workspace_id)
        SELECT id FROM workspaces
        WHERE id NOT IN (SELECT workspace_id FROM email_settings)
      `)
      console.log(`   backfilled email_settings rows for existing workspaces`)
      await client.query(`INSERT INTO _migrations (id) VALUES ($1)`, [MIGRATION_ID])
      await client.query('COMMIT')
      console.log(`Migration ${MIGRATION_ID} complete`)
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  } catch (err) {
    console.error(`Migration ${MIGRATION_ID} FAILED:`, err.message)
    throw err
  }
}
// ============================================================
// Chunk 21 PDPA Constraints v1
// Adds missing foreign-key constraints and a query index on the existing
// pdpa_records table. The table was created in an earlier session with
// only workspace_id constrained — contact_id and collected_by were left
// as raw integers, allowing orphan records.
//
// Also adds an index on contact_id since the most common query pattern
// is "show consent history for this contact" (sorted desc by created_at).
async function runChunk21PdpaConstraintsMigration() {
  const MIGRATION_ID = 'chunk_21_pdpa_constraints_v1'
  try {
    const applied = await pool.query('SELECT id FROM _migrations WHERE id=$1', [MIGRATION_ID])
    if (applied.rows.length > 0) {
      console.log(`Migration ${MIGRATION_ID} already applied, skipping`)
      return
    }
    console.log(`Running migration ${MIGRATION_ID}...`)
    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // contact_id FK: orphan records become meaningless when the contact
      // is deleted. CASCADE delete removes consent history along with the
      // contact — this is intentional, no separate audit trail expected
      // beyond the contact-level events.
      await client.query(`
        ALTER TABLE pdpa_records
        ADD CONSTRAINT pdpa_records_contact_id_fkey
        FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
      `)
      console.log(`   added contact_id FK constraint`)

      // collected_by FK: SET NULL on user delete because losing the agent
      // who recorded consent should not destroy the record itself — the
      // consent is still valid, just unattributed.
      await client.query(`
        ALTER TABLE pdpa_records
        ADD CONSTRAINT pdpa_records_collected_by_fkey
        FOREIGN KEY (collected_by) REFERENCES users(id) ON DELETE SET NULL
      `)
      console.log(`   added collected_by FK constraint`)

      // Compound index for the most common query: "history for this
      // contact, newest first". Sort direction is part of the index so
      // queries get index-only scans without a separate sort step.
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_pdpa_records_contact
        ON pdpa_records(contact_id, created_at DESC)
      `)
      console.log(`   created idx_pdpa_records_contact`)

      // Workspace dashboard query: count by status across whole workspace.
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_pdpa_records_workspace_status
        ON pdpa_records(workspace_id, status)
      `)
      console.log(`   created idx_pdpa_records_workspace_status`)

      await client.query(`INSERT INTO _migrations (id) VALUES ($1)`, [MIGRATION_ID])
      await client.query('COMMIT')
      console.log(`Migration ${MIGRATION_ID} complete`)
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  } catch (err) {
    console.error(`Migration ${MIGRATION_ID} FAILED:`, err.message)
    throw err
  }
}
// ============================================================
// Chunk 17 Broadcast Safety v1
// Adds safety configuration to broadcasts: quiet hours window, force-send
// override, and a circuit-breaker fail limit. The worker (chunk_18, next
// session) reads these to protect WhatsApp account quality.
async function runChunk17BroadcastSafetyMigration() {
  const MIGRATION_ID = 'chunk_17_broadcast_safety_v1'
  try {
    const applied = await pool.query('SELECT id FROM _migrations WHERE id=$1', [MIGRATION_ID])
    if (applied.rows.length > 0) {
      console.log(`Migration ${MIGRATION_ID} already applied, skipping`)
      return
    }
    console.log(`Running migration ${MIGRATION_ID}...`)
    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // Quiet hours window. Default is "10pm to 8am" expressed as integers
      // (hours of day, 0-23). Stored as integers not TIME because we want
      // simple hour-of-day comparison without timezone gymnastics. The worker
      // applies these in the recipient's workspace timezone (workspaces.timezone).
      await client.query(`ALTER TABLE broadcasts ADD COLUMN IF NOT EXISTS quiet_hours_enabled BOOLEAN DEFAULT true`)
      await client.query(`ALTER TABLE broadcasts ADD COLUMN IF NOT EXISTS quiet_hours_start_hour INTEGER DEFAULT 22 CHECK (quiet_hours_start_hour >= 0 AND quiet_hours_start_hour <= 23)`)
      await client.query(`ALTER TABLE broadcasts ADD COLUMN IF NOT EXISTS quiet_hours_end_hour INTEGER DEFAULT 8 CHECK (quiet_hours_end_hour >= 0 AND quiet_hours_end_hour <= 23)`)
      console.log(`   added quiet hours config (default 22:00 to 08:00, enabled)`)

      // Override flag for marketing campaigns user explicitly wants to send
      // outside business hours. Defaults false; user has to consciously enable.
      await client.query(`ALTER TABLE broadcasts ADD COLUMN IF NOT EXISTS force_send_outside_hours BOOLEAN DEFAULT false`)
      console.log(`   added force_send_outside_hours flag`)

      // Circuit breaker: if N consecutive recipients fail to send, the worker
      // pauses the entire broadcast and marks it 'failed' to prevent burning
      // through Meta API quota with broken sends. Default 5 = conservative.
      await client.query(`ALTER TABLE broadcasts ADD COLUMN IF NOT EXISTS consecutive_fail_limit INTEGER DEFAULT 5 CHECK (consecutive_fail_limit > 0)`)
      console.log(`   added consecutive_fail_limit (default 5)`)

      await client.query(`INSERT INTO _migrations (id) VALUES ($1)`, [MIGRATION_ID])
      await client.query('COMMIT')
      console.log(`Migration ${MIGRATION_ID} complete`)
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  } catch (err) {
    console.error(`Migration ${MIGRATION_ID} FAILED:`, err.message)
    throw err
  }
}

// ============================================================
// Chunk 16 Broadcasts Permission v1
// Backfills the manage_broadcasts permission key into existing role_permissions
// rows for all workspaces that pre-date the broadcasts feature. Sets to false
// by default for safety. Mirrors the existing manage_scheduled_messages gate
// for parity (mass outbound = same risk profile). Director is unaffected
// because directors bypass the role_permissions check via ALL_PERMISSIONS_TRUE.
async function runChunk16BroadcastsPermissionMigration() {
  const MIGRATION_ID = 'chunk_16_broadcasts_permission_v1'
  try {
    const applied = await pool.query('SELECT id FROM _migrations WHERE id=$1', [MIGRATION_ID])
    if (applied.rows.length > 0) {
      console.log(`Migration ${MIGRATION_ID} already applied, skipping`)
      return
    }
    console.log(`Running migration ${MIGRATION_ID}...`)
    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // Roles that should default to true match the existing manage_scheduled_messages
      // gate: manager, supervisor, senior_consultant. All others default false.
      const ROLES_TRUE = ['manager', 'supervisor', 'senior_consultant']

      // Use jsonb concat to add the key. If the key already exists (someone
      // was on a fresh seed), the OR condition skips the row.
      const trueResult = await client.query(`
        UPDATE role_permissions
        SET permissions = permissions || '{"manage_broadcasts": true}'::jsonb
        WHERE role = ANY($1::text[])
          AND NOT (permissions ? 'manage_broadcasts')
      `, [ROLES_TRUE])
      console.log(`   set manage_broadcasts=true on ${trueResult.rowCount} rows (manager/supervisor/senior_consultant)`)

      const falseResult = await client.query(`
        UPDATE role_permissions
        SET permissions = permissions || '{"manage_broadcasts": false}'::jsonb
        WHERE NOT (role = ANY($1::text[]))
          AND NOT (permissions ? 'manage_broadcasts')
      `, [ROLES_TRUE])
      console.log(`   set manage_broadcasts=false on ${falseResult.rowCount} rows (other roles)`)

      await client.query(`INSERT INTO _migrations (id) VALUES ($1)`, [MIGRATION_ID])
      await client.query('COMMIT')
      console.log(`Migration ${MIGRATION_ID} complete`)
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  } catch (err) {
    console.error(`Migration ${MIGRATION_ID} FAILED:`, err.message)
    throw err
  }
}

// ─── CHUNK 7: Template Library v2 Overhaul ──────────────────────────────────
// Replaces the v1 12 placeholder templates with 34 finalised templates
// (18 candidate-side + 16 client-side). Adds 'audience' column, drops 'industry'.
// Also reseeds Eque (workspace_id=2) since Eque currently has 0 templates.
async function runTemplateLibraryV2Migration() {
  const MIGRATION_ID = 'template_library_v2_overhaul'
  try {
    const applied = await pool.query('SELECT id FROM _migrations WHERE id=$1', [MIGRATION_ID])
    if (applied.rows.length > 0) {
      console.log(`Migration ${MIGRATION_ID} already applied, skipping`)
      return
    }
    console.log(`Running migration ${MIGRATION_ID}...`)

    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // 1. Schema change: replace 'industry' column with 'audience'
      await client.query(`ALTER TABLE template_library ADD COLUMN IF NOT EXISTS audience VARCHAR(20)`)
      // We will drop 'industry' after data migration completes (next migration), to avoid
      // breaking any in-flight queries. For now, keep both columns.

      // 2. Wipe old v1 content
      const wiped = await client.query(`DELETE FROM template_library`)
      console.log(`   wiped ${wiped.rowCount} v1 templates`)

      // 3. Insert 34 finalised templates
      const templates = [
        // ============== CANDIDATE-SIDE (18) ==============
        {
          category: 'application', audience: 'candidate', template_key: 'application_received',
          display_name: 'Application Received',
          description: 'Auto-acknowledgement when a candidate submits an application.',
          header: 'Application Received',
          body: 'Dear {{1}},\n\nThank you for your application for the position of {{2}} at {{3}}.\n\nWe have received your submission and our team will revert within {{4}} working days.\n\nWe appreciate your interest.\n\nBest regards,\n{{5}}',
          footer: null,
          buttons: [],
          variables: { '1': 'candidate_name', '2': 'job_title', '3': 'company_name', '4': 'review_days', '5': 'consultant_name' },
          is_featured: true
        },
        {
          category: 'application', audience: 'candidate', template_key: 'application_status_update',
          display_name: 'Application Status Update',
          description: 'Mid-process check-in to update candidate on application progress.',
          header: 'Application Update',
          body: 'Dear {{1}},\n\nWe are writing to update you on your application for the position of {{2}} at {{3}}.\n\nYour application is currently {{4}}. We anticipate the next update will be by {{5}}.\n\nWe appreciate your continued patience.\n\nBest regards,\n{{6}}',
          footer: null,
          buttons: [],
          variables: { '1': 'candidate_name', '2': 'job_title', '3': 'company_name', '4': 'current_stage', '5': 'next_update_date', '6': 'consultant_name' },
          is_featured: false
        },
        {
          category: 'application', audience: 'candidate', template_key: 'application_not_selected',
          display_name: 'Application Not Selected',
          description: 'Polite rejection at application stage (pre-interview).',
          header: 'Application Outcome',
          body: 'Dear {{1}},\n\nThank you for your interest in the position of {{2}} at {{3}}.\n\nAfter careful consideration, we regret to inform you that your application has not been successful on this occasion.\n\nWe will retain your details on file and will be in touch should a more suitable opportunity arise.\n\nWe wish you every success in your career.\n\nBest regards,\n{{4}}',
          footer: null,
          buttons: [],
          variables: { '1': 'candidate_name', '2': 'job_title', '3': 'company_name', '4': 'consultant_name' },
          is_featured: false
        },
        {
          category: 'screening', audience: 'candidate', template_key: 'screening_call_request',
          display_name: 'Screening Call Request',
          description: 'Pre-interview phone screen invitation.',
          header: 'Screening Call Request',
          body: 'Dear {{1}},\n\nThank you for your application for the position of {{2}} at {{3}}.\n\nWe would like to arrange a brief screening call with you to discuss your background and the role in further detail.\n\nPlease indicate your availability for a 15-minute call within the next {{4}}.\n\nBest regards,\n{{5}}',
          footer: null,
          buttons: [{ type: 'QUICK_REPLY', text: 'Share My Availability' }, { type: 'QUICK_REPLY', text: 'Request to Reschedule' }],
          variables: { '1': 'candidate_name', '2': 'job_title', '3': 'company_name', '4': 'availability_window', '5': 'consultant_name' },
          is_featured: false
        },
        {
          category: 'interview', audience: 'candidate', template_key: 'interview_invitation',
          display_name: 'Interview Invitation',
          description: 'Formal interview invitation with date, time, location, and interviewer.',
          header: 'Interview Invitation',
          body: 'Dear {{1}},\n\nWe are pleased to invite you to an interview for the position of {{2}} at {{3}}.\n\nDate: {{4}}\nTime: {{5}}\nLocation: {{6}}\nInterviewer: {{7}}\n\nKindly confirm your attendance using the buttons below.\n\nBest regards,\n{{8}}',
          footer: null,
          buttons: [{ type: 'QUICK_REPLY', text: 'Confirm Attendance' }, { type: 'QUICK_REPLY', text: 'Request to Reschedule' }],
          variables: { '1': 'candidate_name', '2': 'job_title', '3': 'company_name', '4': 'interview_date', '5': 'interview_time', '6': 'location', '7': 'interviewer_name', '8': 'consultant_name' },
          is_featured: true
        },
        {
          category: 'interview', audience: 'candidate', template_key: 'interview_reminder',
          display_name: 'Interview Reminder',
          description: 'Sent 24 hours before a scheduled interview.',
          header: 'Interview Reminder',
          body: 'Dear {{1}},\n\nThis is a courtesy reminder of your scheduled interview for the position of {{2}} tomorrow.\n\nDate: {{3}}\nTime: {{4}}\nLocation: {{5}}\n\nKindly bring along your NRIC and a copy of your resume.\n\nWe look forward to meeting you.\n\nBest regards,\n{{6}}',
          footer: null,
          buttons: [{ type: 'QUICK_REPLY', text: 'Reschedule' }],
          variables: { '1': 'candidate_name', '2': 'job_title', '3': 'interview_date', '4': 'interview_time', '5': 'location', '6': 'consultant_name' },
          is_featured: false
        },
        {
          category: 'interview', audience: 'candidate', template_key: 'interview_reschedule',
          display_name: 'Interview Reschedule',
          description: 'Notify candidate of rescheduled interview.',
          header: 'Interview Rescheduled',
          body: 'Dear {{1}},\n\nWe regret to inform you that we need to reschedule your interview for the position of {{2}}.\n\nThe interview has been moved to:\nDate: {{3}}\nTime: {{4}}\nLocation: {{5}}\n\nKindly confirm whether the new schedule is convenient for you. We apologise for any inconvenience caused.\n\nBest regards,\n{{6}}',
          footer: null,
          buttons: [{ type: 'QUICK_REPLY', text: 'Confirm New Slot' }, { type: 'QUICK_REPLY', text: 'Suggest Another Time' }],
          variables: { '1': 'candidate_name', '2': 'job_title', '3': 'new_date', '4': 'new_time', '5': 'location', '6': 'consultant_name' },
          is_featured: false
        },
        {
          category: 'interview', audience: 'candidate', template_key: 'interview_outcome_next_round',
          display_name: 'Interview Outcome (Next Round)',
          description: 'Notify candidate they have been shortlisted for the next stage.',
          header: 'Interview Outcome',
          body: 'Dear {{1}},\n\nThank you for attending the interview for the position of {{2}} at {{3}}.\n\nWe are pleased to inform you that you have been shortlisted for the next round of interviews. Our team will be in touch shortly with the details.\n\nWe look forward to the next stage of the process.\n\nBest regards,\n{{4}}',
          footer: null,
          buttons: [],
          variables: { '1': 'candidate_name', '2': 'job_title', '3': 'company_name', '4': 'consultant_name' },
          is_featured: false
        },
        {
          category: 'interview', audience: 'candidate', template_key: 'interview_outcome_not_selected',
          display_name: 'Interview Outcome (Not Selected)',
          description: 'Polite rejection post-interview, warmer than application-stage rejection.',
          header: 'Interview Outcome',
          body: 'Dear {{1}},\n\nThank you for attending the interview for the position of {{2}} at {{3}}, and for the time you invested in the process.\n\nAfter careful consideration, we regret to inform you that you have not been selected for the role on this occasion.\n\nThe decision was a difficult one given the strength of the candidates considered. We will retain your details on file for future opportunities.\n\nWe wish you every success in your career.\n\nBest regards,\n{{4}}',
          footer: null,
          buttons: [],
          variables: { '1': 'candidate_name', '2': 'job_title', '3': 'company_name', '4': 'consultant_name' },
          is_featured: false
        },
        {
          category: 'reference', audience: 'candidate', template_key: 'reference_check_request',
          display_name: 'Reference Check Request',
          description: 'Request candidate to provide professional references.',
          header: 'Reference Check',
          body: 'Dear {{1}},\n\nAs part of our standard process for the position of {{2}} at {{3}}, we would like to conduct a reference check.\n\nKindly provide the contact details of two professional references, ideally former supervisors or managers. Required information:\n\n1. Full name\n2. Job title\n3. Company\n4. Email address and contact number\n\nYou may reply directly to this message with the details. Thank you for your cooperation.\n\nBest regards,\n{{4}}',
          footer: null,
          buttons: [],
          variables: { '1': 'candidate_name', '2': 'job_title', '3': 'company_name', '4': 'consultant_name' },
          is_featured: false
        },
        {
          category: 'offer', audience: 'candidate', template_key: 'offer_letter_notification',
          display_name: 'Offer Letter Notification',
          description: 'Notify candidate that an offer letter has been issued.',
          header: 'Offer Letter Issued',
          body: 'Dear {{1}},\n\nWe are pleased to inform you that we are extending an offer for the position of {{2}} at {{3}}, with a proposed commencement date of {{4}}.\n\nYour offer letter has been sent to {{5}} for your review.\n\nKindly indicate your acceptance by {{6}}. Should you have any queries, please do not hesitate to contact us.\n\nWe look forward to your favourable response.\n\nBest regards,\n{{7}}',
          footer: null,
          buttons: [{ type: 'QUICK_REPLY', text: 'Accept Offer' }, { type: 'QUICK_REPLY', text: 'Request Clarification' }],
          variables: { '1': 'candidate_name', '2': 'job_title', '3': 'company_name', '4': 'start_date', '5': 'email', '6': 'response_deadline', '7': 'consultant_name' },
          is_featured: true
        },
        {
          category: 'offer', audience: 'candidate', template_key: 'offer_acceptance_confirmation',
          display_name: 'Offer Acceptance Confirmation',
          description: 'Acknowledge candidate accepting an offer.',
          header: 'Offer Accepted',
          body: 'Dear {{1}},\n\nThank you for accepting our offer for the position of {{2}} at {{3}}. We are delighted to welcome you to the team.\n\nYour confirmed commencement date is {{4}}. We will be in touch shortly with the next steps for your onboarding.\n\nOnce again, congratulations.\n\nBest regards,\n{{5}}',
          footer: null,
          buttons: [],
          variables: { '1': 'candidate_name', '2': 'job_title', '3': 'company_name', '4': 'start_date', '5': 'consultant_name' },
          is_featured: true
        },
        {
          category: 'onboarding', audience: 'candidate', template_key: 'document_submission_request',
          display_name: 'Document Submission Request',
          description: 'Request onboarding documents from a successful candidate.',
          header: 'Documents Required',
          body: 'Dear {{1}},\n\nTo proceed with your onboarding for the position of {{2}}, kindly submit the following documents:\n\n{{3}}\n\nPlease ensure all documents are submitted by {{4}}. You may reply directly to this message with the files attached.\n\nThank you for your cooperation.\n\nBest regards,\n{{5}}',
          footer: null,
          buttons: [],
          variables: { '1': 'candidate_name', '2': 'job_title', '3': 'document_list', '4': 'submission_deadline', '5': 'consultant_name' },
          is_featured: false
        },
        {
          category: 'onboarding', audience: 'candidate', template_key: 'document_submission_reminder',
          display_name: 'Document Submission Reminder',
          description: 'Follow-up if onboarding documents not received.',
          header: 'Document Reminder',
          body: 'Dear {{1}},\n\nThis is a gentle reminder regarding the documents requested for your onboarding for the position of {{2}}.\n\nOutstanding documents: {{3}}\n\nThe submission deadline is {{4}}. Kindly attend to this at your earliest convenience to avoid any delay in your onboarding.\n\nThank you.\n\nBest regards,\n{{5}}',
          footer: null,
          buttons: [],
          variables: { '1': 'candidate_name', '2': 'job_title', '3': 'outstanding_list', '4': 'submission_deadline', '5': 'consultant_name' },
          is_featured: false
        },
        {
          category: 'onboarding', audience: 'candidate', template_key: 'pre_employment_medical',
          display_name: 'Pre-Employment Medical',
          description: 'Schedule pre-employment medical check-up.',
          header: 'Medical Check-Up',
          body: 'Dear {{1}},\n\nAs part of your onboarding for the position of {{2}}, a pre-employment medical check-up is required.\n\nThe check-up has been scheduled at:\nClinic: {{3}}\nAddress: {{4}}\nDate: {{5}}\nTime: {{6}}\n\nKindly fast for at least eight hours prior to the appointment, and bring your NRIC for registration.\n\nBest regards,\n{{7}}',
          footer: null,
          buttons: [{ type: 'QUICK_REPLY', text: 'Confirm Attendance' }, { type: 'QUICK_REPLY', text: 'Request to Reschedule' }],
          variables: { '1': 'candidate_name', '2': 'job_title', '3': 'clinic_name', '4': 'clinic_address', '5': 'appointment_date', '6': 'appointment_time', '7': 'consultant_name' },
          is_featured: false
        },
        {
          category: 'onboarding', audience: 'candidate', template_key: 'first_day_reporting',
          display_name: 'First Day Reporting Instructions',
          description: 'Pre-Day-1 logistics: site, address, reporting time, supervisor contact.',
          header: 'First Day Reporting',
          body: 'Dear {{1}},\n\nWe are pleased to welcome you to the team. Your first day of work will be on {{2}}.\n\nReporting details:\nSite: {{3}}\nAddress: {{4}}\nReporting time: {{5}}\n\nPlease bring along your NRIC and any documents previously requested.\n\nYour point of contact on site is {{6}}, contactable at {{7}}.\n\nWe wish you every success in your new role.\n\nBest regards,\n{{8}}',
          footer: null,
          buttons: [],
          variables: { '1': 'candidate_name', '2': 'start_date', '3': 'site_name', '4': 'site_address', '5': 'report_time', '6': 'supervisor_name', '7': 'supervisor_phone', '8': 'consultant_name' },
          is_featured: true
        },
        {
          category: 'post_placement', audience: 'candidate', template_key: 'probation_check_in',
          display_name: 'Probation Check-In',
          description: 'Mid-probation wellness check with the placed candidate.',
          header: 'Probation Check-In',
          body: 'Dear {{1}},\n\nIt has been {{2}} weeks since you commenced your role at {{3}}. We hope you are settling in well.\n\nWe would like to check in on how you are finding the role and the team. Should you have any concerns or feedback, please feel free to share them with us.\n\nWe are here to support you throughout your probation period.\n\nBest regards,\n{{4}}',
          footer: null,
          buttons: [{ type: 'QUICK_REPLY', text: 'All Going Well' }, { type: 'QUICK_REPLY', text: 'I Have Some Concerns' }],
          variables: { '1': 'candidate_name', '2': 'weeks_since_start', '3': 'company_name', '4': 'consultant_name' },
          is_featured: false
        },
        {
          category: 'post_placement', audience: 'candidate', template_key: 'probation_completed',
          display_name: 'Probation Successfully Completed',
          description: 'Congratulate candidate on completing probation, soft referral ask.',
          header: 'Probation Successfully Completed',
          body: 'Dear {{1}},\n\nCongratulations on successfully completing your probation period at {{2}}. This reflects the strong contribution you have made in your role as {{3}}.\n\nWe are delighted to have been part of your career journey, and we look forward to staying in touch.\n\nShould you know of others in your network who may benefit from our services, your referral would be greatly appreciated.\n\nOnce again, congratulations on this milestone.\n\nBest regards,\n{{4}}',
          footer: null,
          buttons: [],
          variables: { '1': 'candidate_name', '2': 'company_name', '3': 'job_title', '4': 'consultant_name' },
          is_featured: false
        },

        // ============== CLIENT-SIDE (16) ==============
        {
          category: 'job_order', audience: 'client', template_key: 'job_order_acknowledgement',
          display_name: 'Job Order Acknowledgement',
          description: 'Confirm receipt of new job requisition from client.',
          header: 'Job Order Received',
          body: 'Dear {{1}},\n\nThank you for the opportunity to assist {{2}} with the recruitment for the position of {{3}}.\n\nWe confirm receipt of the job order and have begun sourcing suitable candidates. We anticipate sharing an initial shortlist within {{4}} working days.\n\nPlease feel free to share any additional context or specific requirements at any time.\n\nBest regards,\n{{5}}',
          footer: null,
          buttons: [],
          variables: { '1': 'contact_name', '2': 'client_company', '3': 'job_title', '4': 'shortlist_timeline', '5': 'consultant_name' },
          is_featured: true
        },
        {
          category: 'job_order', audience: 'client', template_key: 'job_brief_clarification',
          display_name: 'Job Brief Clarification',
          description: 'Request client to clarify role requirements.',
          header: 'Job Brief Clarification',
          body: 'Dear {{1}},\n\nThank you for the brief on the position of {{2}}.\n\nTo ensure we identify the most suitable candidates, we would appreciate your clarification on the following:\n\n{{3}}\n\nA brief response at your earliest convenience would be greatly appreciated.\n\nBest regards,\n{{4}}',
          footer: null,
          buttons: [],
          variables: { '1': 'contact_name', '2': 'job_title', '3': 'clarification_points', '4': 'consultant_name' },
          is_featured: false
        },
        {
          category: 'submission', audience: 'client', template_key: 'cv_submission',
          display_name: 'CV Submission',
          description: 'Submit a single candidate profile to client for consideration.',
          header: 'Candidate Profile Submitted',
          body: 'Dear {{1}},\n\nPlease find attached the profile of {{2}} for your consideration for the position of {{3}}.\n\nSummary:\nCurrent role: {{4}}\nYears of experience: {{5}}\nNotice period: {{6}}\nExpected salary: {{7}}\n\nWe believe the candidate\'s background aligns well with your requirements. Should you wish to proceed with an interview or require further information, please let us know.\n\nBest regards,\n{{8}}',
          footer: null,
          buttons: [{ type: 'QUICK_REPLY', text: 'Schedule Interview' }, { type: 'QUICK_REPLY', text: 'Request More Info' }],
          variables: { '1': 'contact_name', '2': 'candidate_name', '3': 'job_title', '4': 'current_role', '5': 'years_experience', '6': 'notice_period', '7': 'expected_salary', '8': 'consultant_name' },
          is_featured: true
        },
        {
          category: 'submission', audience: 'client', template_key: 'multiple_cv_submission',
          display_name: 'Multiple CV Submissions',
          description: 'Submit a shortlist of candidates to client for consideration.',
          header: 'Shortlist Submitted',
          body: 'Dear {{1}},\n\nFollowing our search for the position of {{2}}, we are pleased to submit a shortlist of {{3}} candidates for your consideration.\n\nProfiles attached:\n{{4}}\n\nEach profile includes a summary of relevant experience, current notice period, and expected salary. Should you wish to proceed with any of the candidates, kindly let us know who you would like to interview.\n\nBest regards,\n{{5}}',
          footer: null,
          buttons: [],
          variables: { '1': 'contact_name', '2': 'job_title', '3': 'candidate_count', '4': 'candidate_summary_list', '5': 'consultant_name' },
          is_featured: false
        },
        {
          category: 'interview_coordination', audience: 'client', template_key: 'interview_slot_request',
          display_name: 'Interview Slot Request',
          description: 'Request client availability to conduct an interview.',
          header: 'Interview Slot Request',
          body: 'Dear {{1}},\n\nWe are pleased to inform you that {{2}} has expressed strong interest in the position of {{3}} at {{4}}.\n\nKindly indicate your availability to conduct an interview within the following window:\n\n{{5}}\n\nWe will coordinate with the candidate accordingly upon receiving your preferred slots.\n\nBest regards,\n{{6}}',
          footer: null,
          buttons: [{ type: 'QUICK_REPLY', text: 'Share My Availability' }, { type: 'QUICK_REPLY', text: 'Suggest Other Dates' }],
          variables: { '1': 'contact_name', '2': 'candidate_name', '3': 'job_title', '4': 'client_company', '5': 'availability_window', '6': 'consultant_name' },
          is_featured: true
        },
        {
          category: 'interview_coordination', audience: 'client', template_key: 'interview_confirmed_to_client',
          display_name: 'Interview Confirmed (to Client)',
          description: 'Confirm interview scheduled with candidate.',
          header: 'Interview Confirmed',
          body: 'Dear {{1}},\n\nThis is to confirm the interview details for {{2}} for the position of {{3}}:\n\nDate: {{4}}\nTime: {{5}}\nLocation: {{6}}\n\nThe candidate has been briefed and confirmed attendance. Should there be any last-minute changes, please notify us as early as possible.\n\nBest regards,\n{{7}}',
          footer: null,
          buttons: [],
          variables: { '1': 'contact_name', '2': 'candidate_name', '3': 'job_title', '4': 'interview_date', '5': 'interview_time', '6': 'location', '7': 'consultant_name' },
          is_featured: false
        },
        {
          category: 'interview_coordination', audience: 'client', template_key: 'candidate_withdrew',
          display_name: 'Candidate Withdrew',
          description: 'Notify client that submitted candidate is no longer available.',
          header: 'Candidate Withdrawn',
          body: 'Dear {{1}},\n\nWe regret to inform you that {{2}}, previously submitted for the position of {{3}}, has withdrawn from the process.\n\nReason cited: {{4}}\n\nWe will continue our search for suitable candidates and will share updated profiles as soon as possible. We apologise for any inconvenience caused.\n\nBest regards,\n{{5}}',
          footer: null,
          buttons: [],
          variables: { '1': 'contact_name', '2': 'candidate_name', '3': 'job_title', '4': 'withdrawal_reason', '5': 'consultant_name' },
          is_featured: false
        },
        {
          category: 'feedback', audience: 'client', template_key: 'feedback_request',
          display_name: 'Feedback Request (Post-Interview)',
          description: 'Request client feedback after interview.',
          header: 'Interview Feedback Request',
          body: 'Dear {{1}},\n\nThank you for taking the time to interview {{2}} for the position of {{3}} on {{4}}.\n\nWe would appreciate your feedback at your earliest convenience to inform our next steps. In particular:\n\n1. Overall assessment of the candidate\n2. Whether you wish to proceed to the next stage\n3. Any specific feedback we may share with the candidate\n\nYour input would be greatly appreciated.\n\nBest regards,\n{{5}}',
          footer: null,
          buttons: [{ type: 'QUICK_REPLY', text: 'Proceed to Next Stage' }, { type: 'QUICK_REPLY', text: 'Not Proceeding' }],
          variables: { '1': 'contact_name', '2': 'candidate_name', '3': 'job_title', '4': 'interview_date', '5': 'consultant_name' },
          is_featured: true
        },
        {
          category: 'feedback', audience: 'client', template_key: 'feedback_reminder',
          display_name: 'Feedback Reminder',
          description: 'Follow up with client if no feedback received post-interview.',
          header: 'Feedback Reminder',
          body: 'Dear {{1}},\n\nWe hope this message finds you well.\n\nWe are following up regarding the interview with {{2}} for the position of {{3}}, conducted on {{4}}.\n\nThe candidate is keen to know the outcome, and we would appreciate your feedback whenever convenient.\n\nBest regards,\n{{5}}',
          footer: null,
          buttons: [],
          variables: { '1': 'contact_name', '2': 'candidate_name', '3': 'job_title', '4': 'interview_date', '5': 'consultant_name' },
          is_featured: false
        },
        {
          category: 'offer', audience: 'client', template_key: 'offer_recommendation',
          display_name: 'Offer Recommendation',
          description: 'Recommend client extends an offer to a candidate.',
          header: 'Offer Recommendation',
          body: 'Dear {{1}},\n\nFollowing the interviews conducted, we recommend extending an offer to {{2}} for the position of {{3}}.\n\nRecommended offer terms:\nSalary: {{4}}\nCommencement date: {{5}}\nNotice period to serve: {{6}}\n\nThe candidate has indicated strong interest and is awaiting confirmation. Should you wish to proceed, kindly confirm so we may communicate the offer.\n\nBest regards,\n{{7}}',
          footer: null,
          buttons: [{ type: 'QUICK_REPLY', text: 'Proceed with Offer' }, { type: 'QUICK_REPLY', text: 'Discuss Further' }],
          variables: { '1': 'contact_name', '2': 'candidate_name', '3': 'job_title', '4': 'recommended_salary', '5': 'proposed_start_date', '6': 'notice_period', '7': 'consultant_name' },
          is_featured: true
        },
        {
          category: 'offer', audience: 'client', template_key: 'offer_status_check',
          display_name: 'Offer Status Check',
          description: 'Ask client about offer status when candidate is awaiting confirmation.',
          header: 'Offer Status',
          body: 'Dear {{1}},\n\nWe are following up on the offer extended to {{2}} for the position of {{3}}.\n\nThe candidate is awaiting confirmation. Kindly let us know the current status, or whether any further information is required from our side to facilitate the process.\n\nBest regards,\n{{4}}',
          footer: null,
          buttons: [],
          variables: { '1': 'contact_name', '2': 'candidate_name', '3': 'job_title', '4': 'consultant_name' },
          is_featured: false
        },
        {
          category: 'placement', audience: 'client', template_key: 'placement_confirmation_to_client',
          display_name: 'Placement Confirmation',
          description: 'Confirm successful placement to client.',
          header: 'Placement Confirmed',
          body: 'Dear {{1}},\n\nWe are pleased to confirm the successful placement of {{2}} in the position of {{3}} at {{4}}.\n\nConfirmed commencement date: {{5}}\n\nThe candidate has been briefed on the onboarding process. Our invoice for the placement fee will follow under separate cover.\n\nThank you for your trust in working with us.\n\nBest regards,\n{{6}}',
          footer: null,
          buttons: [],
          variables: { '1': 'contact_name', '2': 'candidate_name', '3': 'job_title', '4': 'client_company', '5': 'start_date', '6': 'consultant_name' },
          is_featured: true
        },
        {
          category: 'commercial', audience: 'client', template_key: 'invoice_issued',
          display_name: 'Invoice Issued',
          description: 'Notify client of placement fee invoice.',
          header: 'Invoice Issued',
          body: 'Dear {{1}},\n\nPlease find attached our invoice {{2}} for the placement of {{3}} in the position of {{4}}.\n\nInvoice details:\nAmount: {{5}}\nPayment terms: {{6}}\nDue date: {{7}}\n\nShould you have any queries regarding the invoice, please feel free to contact us.\n\nBest regards,\n{{8}}',
          footer: null,
          buttons: [],
          variables: { '1': 'contact_name', '2': 'invoice_number', '3': 'candidate_name', '4': 'job_title', '5': 'invoice_amount', '6': 'payment_terms', '7': 'due_date', '8': 'consultant_name' },
          is_featured: true
        },
        {
          category: 'commercial', audience: 'client', template_key: 'replacement_candidate_notice',
          display_name: 'Replacement Candidate Notice',
          description: 'Activate replacement guarantee period for client.',
          header: 'Replacement Search Activated',
          body: 'Dear {{1}},\n\nWe refer to the placement of {{2}} for the position of {{3}}, who departed on {{4}}.\n\nIn accordance with the replacement guarantee terms of our engagement, we will activate a replacement search at no additional fee. We anticipate sharing initial profiles within {{5}} working days.\n\nWe appreciate your understanding and remain committed to securing a suitable replacement.\n\nBest regards,\n{{6}}',
          footer: null,
          buttons: [],
          variables: { '1': 'contact_name', '2': 'candidate_name', '3': 'job_title', '4': 'departure_date', '5': 'replacement_timeline', '6': 'consultant_name' },
          is_featured: false
        },
        {
          category: 'post_placement', audience: 'client', template_key: 'probation_outcome_update',
          display_name: 'Probation Outcome Update',
          description: 'Report on candidate\'s probation status to client.',
          header: 'Probation Outcome',
          body: 'Dear {{1}},\n\nWe are writing to confirm that {{2}}, placed in the position of {{3}}, has {{4}} their probation period.\n\n{{5}}\n\nShould you require any further information or wish to discuss the candidate\'s progress, please feel free to reach out.\n\nBest regards,\n{{6}}',
          footer: null,
          buttons: [],
          variables: { '1': 'contact_name', '2': 'candidate_name', '3': 'job_title', '4': 'probation_outcome', '5': 'outcome_notes', '6': 'consultant_name' },
          is_featured: false
        },
        {
          category: 'post_placement', audience: 'client', template_key: 'relationship_check_in',
          display_name: 'Relationship Check-In',
          description: 'Periodic touch-base with client, no specific transaction.',
          header: 'Touching Base',
          body: 'Dear {{1}},\n\nWe hope this message finds you well.\n\nIt has been some time since our last engagement with {{2}}. We wanted to reach out to enquire if there are any current or upcoming hiring needs we may assist with.\n\nWe would also welcome the opportunity to update you on the talent landscape in your sector, should that be of interest.\n\nBest regards,\n{{3}}',
          footer: null,
          buttons: [{ type: 'QUICK_REPLY', text: 'We Have Hiring Needs' }, { type: 'QUICK_REPLY', text: 'Not at the Moment' }],
          variables: { '1': 'contact_name', '2': 'client_company', '3': 'consultant_name' },
          is_featured: false
        }
      ]

      let inserted = 0
      for (const t of templates) {
        await client.query(
          `INSERT INTO template_library
             (category, audience, template_key, display_name, description,
              header, body, footer, buttons, variables, is_active, is_featured)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,true,$11)`,
          [t.category, t.audience, t.template_key, t.display_name, t.description,
           t.header, t.body, t.footer,
           JSON.stringify(t.buttons), JSON.stringify(t.variables),
           t.is_featured]
        )
        inserted++
      }
      console.log(`   inserted ${inserted} v2 templates (${templates.filter(t => t.audience === 'candidate').length} candidate, ${templates.filter(t => t.audience === 'client').length} client)`)

      // 4. Reseed Eque (workspace_id=2) with all templates as drafts
      const equeCheck = await client.query(`SELECT id FROM workspaces WHERE id=2`)
      if (equeCheck.rows.length > 0) {
        const equeSeeded = await client.query(
          `INSERT INTO templates (workspace_id, name, category, body, buttons, status, type, created_by)
           SELECT 2, template_key, category, body, buttons, 'draft', 'whatsapp', NULL
           FROM template_library
           WHERE is_active = true
           ON CONFLICT DO NOTHING`,
        )
        console.log(`   seeded ${equeSeeded.rowCount} templates into Eque (workspace_id=2) as drafts`)
      } else {
        console.log(`   skipped Eque reseed (workspace not found)`)
      }

      await client.query(`INSERT INTO _migrations (id) VALUES ($1)`, [MIGRATION_ID])
      await client.query('COMMIT')
      console.log(`Migration ${MIGRATION_ID} complete`)
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  } catch (err) {
    console.error(`Migration ${MIGRATION_ID} FAILED:`, err.message)
    throw err
  }
}

// ─── CHUNK 8: Phase II1 - Reset Eque, add source/library/meta columns ───────
// Phase II1 from TECH_PROVIDER_ROADMAP.md v2 addendum.
// 1. Wipe Eque's premature auto-seeded templates (the 34 from v2 migration).
// 2. Add new columns to templates table for the three-surfaces model.
// 3. Existing endpoints will be updated to populate source='tenant' separately.
async function runPhaseII1Migration() {
  const MIGRATION_ID = 'chunk_8_phase_ii1_reset_and_schema'
  try {
    const applied = await pool.query('SELECT id FROM _migrations WHERE id=$1', [MIGRATION_ID])
    if (applied.rows.length > 0) {
      console.log(`Migration ${MIGRATION_ID} already applied, skipping`)
      return
    }
    console.log(`Running migration ${MIGRATION_ID}...`)

    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // 1. Add new columns to templates table
      await client.query(`ALTER TABLE templates ADD COLUMN IF NOT EXISTS source VARCHAR(20) NOT NULL DEFAULT 'tenant'`)
      await client.query(`ALTER TABLE templates ADD COLUMN IF NOT EXISTS library_template_name VARCHAR(100)`)
      await client.query(`ALTER TABLE templates ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP`)
      await client.query(`ALTER TABLE templates ADD COLUMN IF NOT EXISTS meta_status VARCHAR(20)`)
      console.log(`   added source, library_template_name, submitted_at, meta_status columns to templates`)

      // 2. Wipe Eque's auto-seeded templates
      // The v2 migration seeded 34 templates into Eque (workspace_id=2).
      // These were status='draft' with no source set (now defaults to 'tenant').
      // We delete them so Eque starts clean and uses the three-surfaces model.
      const wipe = await client.query(
        `DELETE FROM templates WHERE workspace_id = 2 AND status = 'draft'`
      )
      console.log(`   wiped ${wipe.rowCount} auto-seeded draft templates from Eque (workspace_id=2)`)

      await client.query(`INSERT INTO _migrations (id) VALUES ($1)`, [MIGRATION_ID])
      await client.query('COMMIT')
      console.log(`Migration ${MIGRATION_ID} complete`)
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  } catch (err) {
    console.error(`Migration ${MIGRATION_ID} FAILED:`, err.message)
    throw err
  }
}

// ─── CHUNK 9: Add header/footer columns to templates ───────────────────────
// Phase II2 prep. Aligns templates table with template_library and Meta's
// actual template structure (which has separate header, body, footer).
async function runChunk9HeaderFooterMigration() {
  const MIGRATION_ID = 'chunk_9_templates_header_footer'
  try {
    const applied = await pool.query('SELECT id FROM _migrations WHERE id=$1', [MIGRATION_ID])
    if (applied.rows.length > 0) {
      console.log(`Migration ${MIGRATION_ID} already applied, skipping`)
      return
    }
    console.log(`Running migration ${MIGRATION_ID}...`)

    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      await client.query(`ALTER TABLE templates ADD COLUMN IF NOT EXISTS header TEXT`)
      await client.query(`ALTER TABLE templates ADD COLUMN IF NOT EXISTS footer TEXT`)
      console.log(`   added header, footer columns to templates`)

      await client.query(`INSERT INTO _migrations (id) VALUES ($1)`, [MIGRATION_ID])
      await client.query('COMMIT')
      console.log(`Migration ${MIGRATION_ID} complete`)
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  } catch (err) {
    console.error(`Migration ${MIGRATION_ID} FAILED:`, err.message)
    throw err
  }
}

// ─── CHUNK 10: Backfill audience column on template_library ────────────────
// The v2 overhaul migration was supposed to set audience for all 34 rows but
// ran against an earlier version of the seed data missing audience values.
// This migration backfills audience based on template_key.
async function runChunk10BackfillAudienceMigration() {
  const MIGRATION_ID = 'chunk_10_backfill_audience'
  try {
    const applied = await pool.query('SELECT id FROM _migrations WHERE id=$1', [MIGRATION_ID])
    if (applied.rows.length > 0) {
      console.log(`Migration ${MIGRATION_ID} already applied, skipping`)
      return
    }
    console.log(`Running migration ${MIGRATION_ID}...`)

    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // Candidate-side templates (18)
      const candidateKeys = [
        'application_received', 'application_status_update', 'application_not_selected',
        'screening_call_request',
        'interview_invitation', 'interview_reminder', 'interview_reschedule',
        'interview_outcome_next_round', 'interview_outcome_not_selected',
        'reference_check_request',
        'offer_letter_notification', 'offer_acceptance_confirmation',
        'document_submission_request', 'document_submission_reminder',
        'pre_employment_medical', 'first_day_reporting',
        'probation_check_in', 'probation_completed'
      ]

      // Client-side templates (16)
      const clientKeys = [
        'job_order_acknowledgement', 'job_brief_clarification',
        'cv_submission', 'multiple_cv_submission',
        'interview_slot_request', 'interview_confirmed_to_client', 'candidate_withdrew',
        'feedback_request', 'feedback_reminder',
        'offer_recommendation', 'offer_acceptance_to_client', 'offer_decline_to_client',
        'placement_confirmation', 'probation_outcome_update',
        'invoice_issued', 'business_development_followup'
      ]

      const cRes = await client.query(
        `UPDATE template_library SET audience = 'candidate' WHERE template_key = ANY($1::text[])`,
        [candidateKeys]
      )
      console.log(`   set audience='candidate' for ${cRes.rowCount} templates`)

      const clRes = await client.query(
        `UPDATE template_library SET audience = 'client' WHERE template_key = ANY($1::text[])`,
        [clientKeys]
      )
      console.log(`   set audience='client' for ${clRes.rowCount} templates`)

      // Diagnostic: any rows still NULL?
      const stillNull = await client.query(
        `SELECT template_key FROM template_library WHERE audience IS NULL`
      )
      if (stillNull.rows.length > 0) {
        console.log(`   WARNING: ${stillNull.rows.length} templates still have NULL audience:`)
        stillNull.rows.forEach(r => console.log(`     - ${r.template_key}`))
      }

      await client.query(`INSERT INTO _migrations (id) VALUES ($1)`, [MIGRATION_ID])
      await client.query('COMMIT')
      console.log(`Migration ${MIGRATION_ID} complete`)
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  } catch (err) {
    console.error(`Migration ${MIGRATION_ID} FAILED:`, err.message)
    throw err
  }
}

// ─── CHUNK 11: Variables shape migration ─────────────────────────────────
// Old shape (positional, used by Meta Library install and old Suggested seeds):
//   { "1": "candidate_name", "2": "job_title" }   (key = position, value = name)
//   OR
//   { "1": "John Tan", "2": "Software Engineer" }  (key = position, value = sample value)
//
// New shape (named, used by Custom and post-import Suggested):
//   {
//     ordered: ["candidate_name", "job_title"],
//     defaults: { candidate_name: "", job_title: "" }
//   }
//
// Migration converts existing rows to new shape:
//   - If keys are numeric strings ("1", "2"), treat values as variable names
//   - If row already has 'ordered' key, skip (already migrated)
async function runChunk11VariablesShapeMigration() {
  const MIGRATION_ID = 'chunk_11_variables_shape_v1'
  try {
    const applied = await pool.query('SELECT id FROM _migrations WHERE id=$1', [MIGRATION_ID])
    if (applied.rows.length > 0) {
      console.log(`Migration ${MIGRATION_ID} already applied, skipping`)
      return
    }
    console.log(`Running migration ${MIGRATION_ID}...`)

    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      const all = await client.query(`SELECT id, variables, source FROM templates WHERE variables IS NOT NULL`)
      let converted = 0
      let alreadyOk = 0
      let emptied = 0

      for (const row of all.rows) {
        const v = row.variables
        if (!v || (typeof v === 'object' && Object.keys(v).length === 0)) {
          // Empty -> set canonical empty shape
          await client.query(
            `UPDATE templates SET variables=$1 WHERE id=$2`,
            [JSON.stringify({ ordered: [], defaults: {} }), row.id]
          )
          emptied++
          continue
        }
        if (v.ordered && Array.isArray(v.ordered) && v.defaults) {
          alreadyOk++
          continue
        }
        // Old positional shape: keys are "1", "2", etc.
        const keys = Object.keys(v).filter(k => /^\d+$/.test(k))
        if (keys.length === 0) {
          // Unknown shape - normalise to empty
          await client.query(
            `UPDATE templates SET variables=$1 WHERE id=$2`,
            [JSON.stringify({ ordered: [], defaults: {} }), row.id]
          )
          emptied++
          continue
        }
        // Sort by numeric position
        keys.sort((a, b) => parseInt(a) - parseInt(b))
        const ordered = []
        const defaults = {}
        for (const k of keys) {
          const value = v[k]
          if (row.source === 'meta_library') {
            // Meta library: positions are locked, value is sample data, name is param_N
            const name = `param_${k}`
            ordered.push(name)
            defaults[name] = String(value || '')
          } else {
            // Library/Suggested old shape: value IS the variable name
            const name = String(value).toLowerCase().replace(/[^a-z0-9_]/g, '_')
            ordered.push(name)
            defaults[name] = ''
          }
        }
        await client.query(
          `UPDATE templates SET variables=$1 WHERE id=$2`,
          [JSON.stringify({ ordered, defaults }), row.id]
        )
        converted++
      }

      console.log(`   converted ${converted} rows from old shape, ${alreadyOk} already in new shape, ${emptied} normalised to empty`)

      await client.query(`INSERT INTO _migrations (id) VALUES ($1)`, [MIGRATION_ID])
      await client.query('COMMIT')
      console.log(`Migration ${MIGRATION_ID} complete`)
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  } catch (err) {
    console.error(`Migration ${MIGRATION_ID} FAILED:`, err.message)
    throw err
  }
}

// ─── CHUNK 12: Backfill labels on existing Meta Library template installs ───
// Templates installed via Meta Library before chunk 12 don't have variables.labels.
// This migration looks up the original library template's param_labels in the mock
// and merges them into the stored variables JSONB.
async function runChunk12MetaLibraryLabelsMigration() {
  const MIGRATION_ID = 'chunk_12_meta_library_labels_v1'
  try {
    const applied = await pool.query('SELECT id FROM _migrations WHERE id=$1', [MIGRATION_ID])
    if (applied.rows.length > 0) {
      console.log(`Migration ${MIGRATION_ID} already applied, skipping`)
      return
    }
    console.log(`Running migration ${MIGRATION_ID}...`)

    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      const rows = await client.query(
        `SELECT id, library_template_name, variables FROM templates WHERE source='meta_library'`
      )
      let backfilled = 0
      let skipped = 0

      for (const row of rows.rows) {
        const v = row.variables
        if (!v || !v.ordered) { skipped++; continue }
        if (v.labels && Object.keys(v.labels).length > 0) { skipped++; continue }
        const sourceTpl = metaLibraryMock.SAMPLE_TEMPLATES.find(t => t.name === row.library_template_name)
        if (!sourceTpl || !Array.isArray(sourceTpl.param_labels)) { skipped++; continue }

        const labels = {}
        sourceTpl.param_labels.forEach((label, idx) => {
          const name = `param_${idx + 1}`
          if (v.ordered.includes(name) && label) {
            labels[name] = String(label)
          }
        })

        const newVariables = { ordered: v.ordered, defaults: v.defaults || {}, labels }
        await client.query(
          `UPDATE templates SET variables=$1 WHERE id=$2`,
          [JSON.stringify(newVariables), row.id]
        )
        backfilled++
      }

      console.log(`   backfilled labels on ${backfilled} Meta Library templates, skipped ${skipped}`)

      await client.query(`INSERT INTO _migrations (id) VALUES ($1)`, [MIGRATION_ID])
      await client.query('COMMIT')
      console.log(`Migration ${MIGRATION_ID} complete`)
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  } catch (err) {
    console.error(`Migration ${MIGRATION_ID} FAILED:`, err.message)
    throw err
  }
}

async function runChunk13CalendarMigration() {
  const MIGRATION_ID = 'chunk_13_calendar_v1'
  try {
    const applied = await pool.query('SELECT id FROM _migrations WHERE id=$1', [MIGRATION_ID])
    if (applied.rows.length > 0) {
      console.log(`Migration ${MIGRATION_ID} already applied, skipping`)
      return
    }
    console.log(`Running migration ${MIGRATION_ID}...`)
    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // 1. Add manage_calendar permission column to role_permissions
      await client.query(`
        ALTER TABLE role_permissions
        ADD COLUMN IF NOT EXISTS manage_calendar BOOLEAN DEFAULT false
      `)

      // 2. Backfill manage_calendar for existing roles
      //    Director and Manager get true; others get false (matches manage_scheduled_messages pattern)
      await client.query(`
        UPDATE role_permissions
        SET manage_calendar = CASE
          WHEN role IN ('director', 'manager') THEN true
          ELSE false
        END
        WHERE manage_calendar IS NULL OR manage_calendar = false
      `)

      // 3. Create event_types table
      await client.query(`
        CREATE TABLE IF NOT EXISTS event_types (
          id SERIAL PRIMARY KEY,
          workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          name VARCHAR(100) NOT NULL,
          color_bg VARCHAR(20) NOT NULL,
          color_fg VARCHAR(20) NOT NULL,
          sort_order INTEGER DEFAULT 0,
          is_default BOOLEAN DEFAULT false,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `)
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_event_types_workspace
        ON event_types(workspace_id)
      `)

      // 4. Add event_type_id to calendar_events (nullable for back-compat)
      await client.query(`
        ALTER TABLE calendar_events
        ADD COLUMN IF NOT EXISTS event_type_id INTEGER REFERENCES event_types(id) ON DELETE SET NULL
      `)

      // 5. Seed 5 default event types into every existing workspace
      const DEFAULT_TYPES = [
        { name: 'Interview',         color_bg: '#e0e7ff', color_fg: '#4338ca', sort_order: 1 },
        { name: 'Client Meeting',    color_bg: '#dcfce7', color_fg: '#16a34a', sort_order: 2 },
        { name: 'Candidate Meeting', color_bg: '#fef3c7', color_fg: '#92400e', sort_order: 3 },
        { name: 'Internal',          color_bg: '#f5f3ef', color_fg: '#6e6a63', sort_order: 4 },
        { name: 'Other',             color_bg: '#ede9fe', color_fg: '#5b21b6', sort_order: 5 },
      ]

      const wsRows = await client.query(`SELECT id FROM workspaces WHERE status='active'`)
      let typesCreated = 0
      for (const ws of wsRows.rows) {
        const existing = await client.query(
          `SELECT id FROM event_types WHERE workspace_id=$1`,
          [ws.id]
        )
        if (existing.rows.length > 0) continue
        for (const t of DEFAULT_TYPES) {
          await client.query(
            `INSERT INTO event_types (workspace_id, name, color_bg, color_fg, sort_order, is_default)
             VALUES ($1, $2, $3, $4, $5, true)`,
            [ws.id, t.name, t.color_bg, t.color_fg, t.sort_order]
          )
          typesCreated++
        }
      }
      console.log(`   seeded ${typesCreated} event types across ${wsRows.rows.length} workspaces`)

      // 6. Backfill existing calendar_events.type strings to event_type_id where possible
      //    Maps legacy 'interview' string to the new Interview type per workspace
      const ceRows = await client.query(
        `SELECT id, workspace_id, type FROM calendar_events WHERE event_type_id IS NULL AND type IS NOT NULL`
      )
      let eventsBackfilled = 0
      for (const ce of ceRows.rows) {
        // map old type string to new event_type by name (case-insensitive, with fallback)
        const typeMatch = await client.query(
          `SELECT id FROM event_types
           WHERE workspace_id=$1 AND LOWER(name) = LOWER($2)
           LIMIT 1`,
          [ce.workspace_id, ce.type === 'interview' ? 'Interview' : ce.type]
        )
        if (typeMatch.rows.length > 0) {
          await client.query(
            `UPDATE calendar_events SET event_type_id=$1 WHERE id=$2`,
            [typeMatch.rows[0].id, ce.id]
          )
          eventsBackfilled++
        }
      }
      console.log(`   backfilled event_type_id on ${eventsBackfilled} calendar_events`)

      await client.query(`INSERT INTO _migrations (id) VALUES ($1)`, [MIGRATION_ID])
      await client.query('COMMIT')
      console.log(`Migration ${MIGRATION_ID} complete`)
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  } catch (err) {
    console.error(`Migration ${MIGRATION_ID} FAILED:`, err.message)
    throw err
  }
}

async function runChunk13bCalendarPermissionJsonbMigration() {
  const MIGRATION_ID = 'chunk_13b_calendar_perm_jsonb_v1'
  try {
    const applied = await pool.query('SELECT id FROM _migrations WHERE id=$1', [MIGRATION_ID])
    if (applied.rows.length > 0) {
      console.log(`Migration ${MIGRATION_ID} already applied, skipping`)
      return
    }
    console.log(`Running migration ${MIGRATION_ID}...`)
    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // Backfill manage_calendar key into existing role_permissions JSONB rows.
      // Match the manage_quick_replies precedent: admin gets false, others get true.
      const rows = await client.query(`SELECT id, role, permissions FROM role_permissions`)
      let updated = 0
      for (const row of rows.rows) {
        if (row.permissions.manage_calendar !== undefined) continue
        // Default per role (matches DEFAULT_ROLE_PERMISSIONS where applicable):
        //   admin/consultant: false
        //   manager/supervisor/senior_consultant: true
        const grantTrue = ['manager', 'supervisor', 'senior_consultant'].includes(row.role)
        const newPermissions = { ...row.permissions, manage_calendar: grantTrue }
        await client.query(
          `UPDATE role_permissions SET permissions=$1, updated_at=NOW() WHERE id=$2`,
          [JSON.stringify(newPermissions), row.id]
        )
        updated++
      }
      console.log(`   backfilled manage_calendar on ${updated} role_permissions rows`)

      await client.query(`INSERT INTO _migrations (id) VALUES ($1)`, [MIGRATION_ID])
      await client.query('COMMIT')
      console.log(`Migration ${MIGRATION_ID} complete`)
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  } catch (err) {
    console.error(`Migration ${MIGRATION_ID} FAILED:`, err.message)
    throw err
  }
}

// ─── CHUNK 14: Event Reminders ──────────────────────────────────────────────
// Adds event_reminders table linking calendar_events to scheduled_messages.
// Each event can have at most one active reminder. The reminder is a child of
// the event: when the event date/time changes, the reminder's send time is
// re-anchored. When the event is deleted, the reminder is cancelled.
async function runChunk14EventRemindersMigration() {
  const MIGRATION_ID = 'chunk_14_event_reminders_v1'
  try {
    const applied = await pool.query('SELECT id FROM _migrations WHERE id=$1', [MIGRATION_ID])
    if (applied.rows.length > 0) {
      console.log(`Migration ${MIGRATION_ID} already applied, skipping`)
      return
    }
    console.log(`Running migration ${MIGRATION_ID}...`)
    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // Create the event_reminders table. One row per active reminder per event.
      // Status flow: active -> sent (when scheduled_message fires) OR active -> cancelled
      // (when recruiter cancels OR event is deleted/rescheduled in a way that requires re-queue).
      await client.query(`
        CREATE TABLE IF NOT EXISTS event_reminders (
          id SERIAL PRIMARY KEY,
          workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          event_id INTEGER NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
          scheduled_message_id INTEGER NOT NULL REFERENCES scheduled_messages(id) ON DELETE CASCADE,
          template_id INTEGER REFERENCES templates(id) ON DELETE SET NULL,
          offset_hours INTEGER NOT NULL CHECK (offset_hours IN (3, 12, 24)),
          status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'sent', 'cancelled')),
          created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `)

      // Index for fast lookup by event when checking "does this event have a reminder?"
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_event_reminders_event_id
        ON event_reminders(event_id)
        WHERE status = 'active'
      `)

      // Index for fast workspace-scoped queries
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_event_reminders_workspace
        ON event_reminders(workspace_id, status)
      `)

      console.log(`   created event_reminders table with indexes`)

      await client.query(`INSERT INTO _migrations (id) VALUES ($1)`, [MIGRATION_ID])
      await client.query('COMMIT')
      console.log(`Migration ${MIGRATION_ID} complete`)
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  } catch (err) {
    console.error(`Migration ${MIGRATION_ID} FAILED:`, err.message)
    throw err
  }
}

// ============================================================
// Chunk 15 Broadcasts v1
// Extends the bare broadcasts table created at platform setup with the columns
// needed for proper broadcast lifecycle: cancellation tracking, error capture,
// variable snapshots, and target filter audit. Creates broadcast_recipients
// for per-recipient delivery tracking. Worker integration ships in v2.
async function runChunk15BroadcastsMigration() {
  const MIGRATION_ID = 'chunk_15_broadcasts_v1'
  try {
    const applied = await pool.query('SELECT id FROM _migrations WHERE id=$1', [MIGRATION_ID])
    if (applied.rows.length > 0) {
      console.log(`Migration ${MIGRATION_ID} already applied, skipping`)
      return
    }
    console.log(`Running migration ${MIGRATION_ID}...`)
    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // Extend broadcasts with lifecycle columns. Existing rows (none expected
      // in production) get sensible defaults via the ALTERs.
      await client.query(`ALTER TABLE broadcasts ADD COLUMN IF NOT EXISTS variables JSONB DEFAULT '{}'::jsonb`)
      await client.query(`ALTER TABLE broadcasts ADD COLUMN IF NOT EXISTS target_filters JSONB DEFAULT '{}'::jsonb`)
      await client.query(`ALTER TABLE broadcasts ADD COLUMN IF NOT EXISTS started_at TIMESTAMP`)
      await client.query(`ALTER TABLE broadcasts ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP`)
      await client.query(`ALTER TABLE broadcasts ADD COLUMN IF NOT EXISTS cancelled_by INTEGER REFERENCES users(id) ON DELETE SET NULL`)
      await client.query(`ALTER TABLE broadcasts ADD COLUMN IF NOT EXISTS error_summary TEXT`)
      await client.query(`ALTER TABLE broadcasts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()`)
      console.log(`   extended broadcasts table with 7 lifecycle columns`)

      // Recipient table. One row per (broadcast, contact). Status flow:
      // pending -> sending -> sent OR pending -> sending -> failed OR pending -> skipped.
      // Skipped covers PDPA opt-outs, DNC contacts, and missing phone numbers.
      await client.query(`
        CREATE TABLE IF NOT EXISTS broadcast_recipients (
          id SERIAL PRIMARY KEY,
          broadcast_id INTEGER NOT NULL REFERENCES broadcasts(id) ON DELETE CASCADE,
          workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
          variables JSONB DEFAULT '{}'::jsonb,
          status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'skipped')),
          sent_at TIMESTAMP,
          failed_reason TEXT,
          skipped_reason TEXT,
          whatsapp_message_id VARCHAR(255),
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `)
      console.log(`   created broadcast_recipients table`)

      // Index for the worker's primary query: "give me all pending recipients
      // for an in-flight broadcast, ordered by id for stable pagination".
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_broadcast_recipients_broadcast_status
        ON broadcast_recipients(broadcast_id, status)
      `)
      // Index for tenant-scoped list pages and stat aggregations.
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_broadcast_recipients_workspace_status
        ON broadcast_recipients(workspace_id, status)
      `)
      // Index for broadcasts list page filtering by tenant + status.
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_broadcasts_workspace_status
        ON broadcasts(workspace_id, status)
      `)
      // Partial index for the worker's poll query: "find scheduled broadcasts
      // ready to send right now". Partial on status keeps the index tiny.
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_broadcasts_scheduled_due
        ON broadcasts(scheduled_at)
        WHERE status = 'scheduled'
      `)
      console.log(`   created 4 indexes`)

      await client.query(`INSERT INTO _migrations (id) VALUES ($1)`, [MIGRATION_ID])
      await client.query('COMMIT')
      console.log(`Migration ${MIGRATION_ID} complete`)
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  } catch (err) {
    console.error(`Migration ${MIGRATION_ID} FAILED:`, err.message)
    throw err
  }
}

// ─── Variables helpers
// Validates a variable name. Returns true if valid.
// Rules: starts with letter, contains only lowercase letters/digits/underscores, max 30 chars.
function isValidVariableName(name) {
  if (typeof name !== 'string') return false
  return /^[a-z][a-z0-9_]{0,29}$/.test(name)
}

// Extracts {{name}} variables from body text in order of first appearance.
// Returns an array of unique names.
function extractVariablesFromBody(body) {
  if (!body) return []
  const matches = body.match(/\{\{\s*([a-z][a-z0-9_]{0,29})\s*\}\}/g) || []
  const seen = new Set()
  const ordered = []
  for (const m of matches) {
    const name = m.replace(/[{}\s]/g, '')
    if (!seen.has(name)) {
      seen.add(name)
      ordered.push(name)
    }
  }
  return ordered
}

// Normalises a variables payload from the client.
// Accepts either the new shape { ordered, defaults } or a legacy shape; returns canonical new shape.
// Removes invalid names, deduplicates, and ensures every name in ordered has an entry in defaults.
function normaliseVariables(input) {
  if (!input) return { ordered: [], defaults: {} }
  if (typeof input !== 'object') return { ordered: [], defaults: {} }
  const ordered = Array.isArray(input.ordered) ? input.ordered : []
  const defaults = (input.defaults && typeof input.defaults === 'object') ? input.defaults : {}
  const labels = (input.labels && typeof input.labels === 'object') ? input.labels : null
  // event_field_map: { varName: 'contact_name'|'event_date'|'event_time'|'location'|'event_title' }
  // Used by Send Template auto-fill when conversation has linked calendar events.
  const eventFieldMap = (input.event_field_map && typeof input.event_field_map === 'object') ? input.event_field_map : null
  const VALID_EVENT_FIELDS = ['contact_name', 'event_date', 'event_time', 'location', 'event_title']
  const cleanOrdered = []
  const cleanDefaults = {}
  const cleanLabels = {}
  const cleanEventFieldMap = {}
  const seen = new Set()
  for (const raw of ordered) {
    const name = String(raw || '').trim()
    if (!isValidVariableName(name)) continue
    if (seen.has(name)) continue
    seen.add(name)
    cleanOrdered.push(name)
    cleanDefaults[name] = (defaults[name] !== undefined && defaults[name] !== null) ? String(defaults[name]) : ''
    if (labels && typeof labels[name] === 'string' && labels[name].trim()) {
      cleanLabels[name] = labels[name]
    }
    // Only preserve mapping if value is a known field. Drop unknown values silently.
    if (eventFieldMap && typeof eventFieldMap[name] === 'string' && VALID_EVENT_FIELDS.includes(eventFieldMap[name])) {
      cleanEventFieldMap[name] = eventFieldMap[name]
    }
  }
  const result = { ordered: cleanOrdered, defaults: cleanDefaults }
  if (Object.keys(cleanLabels).length > 0) result.labels = cleanLabels
  if (Object.keys(cleanEventFieldMap).length > 0) result.event_field_map = cleanEventFieldMap
  return result
}

// Reconciles variables with body content.
// - Adds variables found in body but missing from list (auto-extract on save)
// - Keeps unused variables in the list (user might have removed temporarily)
// Returns the merged { ordered, defaults }.
function reconcileVariablesWithBody(variables, body) {
  const norm = normaliseVariables(variables)
  const bodyVars = extractVariablesFromBody(body)
  for (const name of bodyVars) {
    if (!norm.ordered.includes(name)) {
      norm.ordered.push(name)
      norm.defaults[name] = ''
    }
  }
  return norm
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
    // Resolve permissions for this user's role (Chunk 5)
    const permsConfig = await getRolePermissions(user.workspace_id, user.role)
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, workspace_id: user.workspace_id, workspace_name: user.workspace_name, is_super_admin: user.is_super_admin, billing_exempt: user.billing_exempt, plan: user.plan, permissions: user.permissions, send_behaviour: user.send_behaviour || 'enter', force_password_change: user.force_password_change, permissions_resolved: permsConfig.permissions, scope: permsConfig.scope } })
  } catch (err) { console.error('Login error:', err); res.status(500).json({ error: 'Server error' }) }
})

// ─── CHUNK 5: Current user's resolved permissions ──────────────────────────
// Used by the frontend to hydrate permission state on app mount / login.
app.get('/me/permissions', auth, async (req, res) => {
  try {
    const wsId = await getWorkspaceId(req.user.id)
    const config = await getRolePermissions(wsId, req.user.role)
    res.json({
      role: req.user.role,
      scope: config.scope,
      permissions: config.permissions
    })
  } catch (err) {
    console.error('GET /me/permissions error:', err)
    res.status(500).json({ error: err.message })
  }
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

// GET /admin/workspaces �?list all workspaces with summary counts
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

// GET /admin/workspaces/:id �?single workspace detail
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

// ─── CHUNK 5: Role Permissions (Super admin-facing) ──────────────────────────
// Super admin can view/edit any workspace's role permissions.
app.get('/admin/workspaces/:id/role-permissions', auth, superAdmin, async (req, res) => {
  try {
    const wsId = parseInt(req.params.id, 10)
    if (isNaN(wsId)) return res.status(400).json({ error: 'Invalid workspace id' })
    const wsCheck = await pool.query('SELECT id, name FROM workspaces WHERE id=$1', [wsId])
    if (!wsCheck.rows.length) return res.status(404).json({ error: 'Workspace not found' })
    const roles = await listRolePermissions(wsId)
    res.json({ workspace_id: wsId, workspace_name: wsCheck.rows[0].name, roles })
  } catch (err) {
    console.error('GET /admin/workspaces/:id/role-permissions error:', err)
    res.status(500).json({ error: err.message })
  }
})

app.patch('/admin/workspaces/:id/role-permissions/:role', auth, superAdmin, async (req, res) => {
  try {
    const wsId = parseInt(req.params.id, 10)
    if (isNaN(wsId)) return res.status(400).json({ error: 'Invalid workspace id' })
    const { scope, permissions } = req.body
    const updated = await updateRolePermissions(wsId, req.params.role, scope, permissions)
    await logAudit(wsId, req.user.id, 'role_permissions.update_by_super_admin', 'role', req.params.role, null, { scope, permissions, actor_super_admin: true })
    res.json(updated)
  } catch (err) {
    console.error('PATCH /admin/workspaces/:id/role-permissions/:role error:', err)
    res.status(err.statusCode || 500).json({ error: err.message })
  }
})

app.post('/admin/workspaces/:id/role-permissions/reset', auth, superAdmin, async (req, res) => {
  try {
    const wsId = parseInt(req.params.id, 10)
    if (isNaN(wsId)) return res.status(400).json({ error: 'Invalid workspace id' })
    await resetRolePermissionsToDefaults(wsId)
    await logAudit(wsId, req.user.id, 'role_permissions.reset_by_super_admin', 'workspace', wsId, null, { actor_super_admin: true })
    const roles = await listRolePermissions(wsId)
    res.json({ workspace_id: wsId, roles })
  } catch (err) {
    console.error('POST /admin/workspaces/:id/role-permissions/reset error:', err)
    res.status(500).json({ error: err.message })
  }
})

// POST /admin/workspaces �?create workspace + first director atomically
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

    // 6. Seed default role_permissions for this tenant
    for (const [role, config] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
      await client.query(
        `INSERT INTO role_permissions (workspace_id, role, scope, permissions)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (workspace_id, role) DO NOTHING`,
        [workspace.id, role, config.scope, JSON.stringify(config.permissions)]
      )
    }

    // 7. Audit log (attributed to super admin, targeting the new workspace)
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

// PATCH /admin/workspaces/:id �?update workspace metadata
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

app.patch('/workspace', auth, requirePermission('manage_workspace_settings'), async (req, res) => {
  try {
    const wsId = await getWorkspaceId(req.user.id)

    // Whitelist of fields that can be updated. Anything else in req.body is
    // silently ignored — protects against accidental column overwrites and
    // basic injection. Add new updateable workspace columns here.
    const ALLOWED = [
      'name', 'email', 'phone', 'address', 'registration_number', 'timezone',
      'whatsapp_account_id', 'whatsapp_token'
    ]

    // Only build SET clauses for fields actually present in the request body.
    // Frontend may send a partial form (e.g. WhatsApp tab only updates 2 fields,
    // Profile tab updates 6); both must work without nulling out the others.
    const updates = []
    const values = []
    let idx = 1
    for (const field of ALLOWED) {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        updates.push(`${field}=$${idx++}`)
        values.push(req.body[field])
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields provided to update' })
    }

    // Validate name when present — it's NOT NULL in the schema
    if (Object.prototype.hasOwnProperty.call(req.body, 'name')) {
      const trimmed = (req.body.name || '').trim()
      if (!trimmed) {
        return res.status(400).json({ error: 'Workspace name cannot be empty' })
      }
    }

    updates.push(`updated_at=NOW()`)
    values.push(wsId)
    const sql = `UPDATE workspaces SET ${updates.join(', ')} WHERE id=$${idx} RETURNING *`
    const r = await pool.query(sql, values)
    res.json(r.rows[0])
  } catch (err) {
    console.error('PATCH /workspace error:', err)
    res.status(500).json({ error: err.message })
  }
})

// ─── PHONE NUMBERS ─────────────────────────────────────────────────────────────
app.get('/phone-numbers', auth, async (req, res) => {
  try {
    const wsId = await getWorkspaceId(req.user.id)
    const r = await pool.query(`
      SELECT pn.*,
             u.name  AS owner_name,
             u.email AS owner_email,
             p.client_name AS project_name,
             p.colour AS project_colour
      FROM phone_numbers pn
      LEFT JOIN users u ON u.id = pn.owner_user_id
      LEFT JOIN projects p ON p.id = pn.project_id
      WHERE pn.workspace_id=$1
      ORDER BY pn.is_primary DESC, pn.created_at ASC
    `, [wsId])
    res.json(r.rows)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.post('/phone-numbers', auth, requirePermission('manage_phone_numbers'), async (req, res) => {
  try {
    const wsId = await getWorkspaceId(req.user.id)
    const { number, display_name, whatsapp_phone_id, is_primary, owner_user_id, project_id } = req.body

    // Required field check
    if (!number || !number.trim()) {
      return res.status(400).json({ error: 'Phone number is required' })
    }
    const cleaned = number.trim()

    // Format validation: must start with + and contain only digits after.
    // E.164 allows up to 15 digits. We're lenient on minimum length to allow
    // for shortcodes / internal numbers, but enforce + prefix for clarity.
    if (!/^\+\d{6,15}$/.test(cleaned)) {
      return res.status(400).json({
        error: 'Phone number must start with + followed by digits only (e.g. +6591234567)'
      })
    }

    // Workspace-scoped duplicate check. Different workspaces can have the
    // same number (multi-tenant), but a single workspace cannot.
    const dup = await pool.query(
      `SELECT id, display_name FROM phone_numbers WHERE number=$1 AND workspace_id=$2`,
      [cleaned, wsId]
    )
    if (dup.rows.length > 0) {
      const existing = dup.rows[0]
      return res.status(409).json({
        error: `This number is already registered as "${existing.display_name || cleaned}". Each number can only be added once per workspace.`
      })
    }

    if (is_primary) {
      await pool.query('UPDATE phone_numbers SET is_primary=false WHERE workspace_id=$1', [wsId])
    }
    const r = await pool.query(
      `INSERT INTO phone_numbers
         (workspace_id, number, display_name, whatsapp_phone_id, is_primary, owner_user_id, project_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [wsId, cleaned, display_name?.trim() || null, whatsapp_phone_id?.trim() || null, is_primary || false, owner_user_id || null, project_id || null]
    )
    res.json(r.rows[0])
  } catch (err) {
    console.error('POST /phone-numbers error:', err)
    res.status(500).json({ error: err.message })
  }
})

app.patch('/phone-numbers/:id', auth, requirePermission('manage_phone_numbers'), async (req, res) => {
  try {
    const wsId = await getWorkspaceId(req.user.id)
    const { display_name, is_primary, status, team_id, owner_user_id, project_id } = req.body
    if (is_primary) await pool.query('UPDATE phone_numbers SET is_primary=false WHERE workspace_id=$1', [wsId])
    const r = await pool.query(
      `UPDATE phone_numbers
          SET display_name   = COALESCE($1, display_name),
              is_primary     = COALESCE($2, is_primary),
              status         = COALESCE($3, status),
              team_id        = $4,
              owner_user_id  = $5,
              project_id     = $6
        WHERE id=$7 AND workspace_id=$8 RETURNING *`,
      [display_name, is_primary, status, team_id || null, owner_user_id || null, project_id || null, req.params.id, wsId]
    )
    res.json(r.rows[0])
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.delete('/phone-numbers/:id', auth, requirePermission('manage_phone_numbers'), async (req, res) => {
  try {
    const wsId = await getWorkspaceId(req.user.id)
    await pool.query('DELETE FROM phone_numbers WHERE id=$1 AND workspace_id=$2', [req.params.id, wsId])
    res.json({ success: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ─── CHUNK 5: Role Permissions (Director-facing) ─────────────────────────────
// Director manages role permissions for their own workspace.
// Requires the 'manage_role_permissions' permission.
app.get('/role-permissions', auth, requirePermission('manage_role_permissions'), async (req, res) => {
  try {
    const wsId = await getWorkspaceId(req.user.id)
    const roles = await listRolePermissions(wsId)
    res.json({ workspace_id: wsId, roles })
  } catch (err) {
    console.error('GET /role-permissions error:', err)
    res.status(500).json({ error: err.message })
  }
})

app.patch('/role-permissions/:role', auth, requirePermission('manage_role_permissions'), async (req, res) => {
  try {
    const wsId = await getWorkspaceId(req.user.id)
    const { scope, permissions } = req.body
    const updated = await updateRolePermissions(wsId, req.params.role, scope, permissions)
    await logAudit(wsId, req.user.id, 'role_permissions.update', 'role', req.params.role, null, { scope, permissions })
    res.json(updated)
  } catch (err) {
    console.error('PATCH /role-permissions/:role error:', err)
    res.status(err.statusCode || 500).json({ error: err.message })
  }
})

app.post('/role-permissions/reset', auth, requirePermission('manage_role_permissions'), async (req, res) => {
  try {
    const wsId = await getWorkspaceId(req.user.id)
    await resetRolePermissionsToDefaults(wsId)
    await logAudit(wsId, req.user.id, 'role_permissions.reset', 'workspace', wsId, null, {})
    const roles = await listRolePermissions(wsId)
    res.json({ workspace_id: wsId, roles })
  } catch (err) {
    console.error('POST /role-permissions/reset error:', err)
    res.status(500).json({ error: err.message })
  }
})

// ─── AGENTS ────────────────────────────────────────────────────────────────────
app.get('/agents', auth, async (req, res) => {
  try {
    const wsId = await getWorkspaceId(req.user.id)
    const r = await pool.query(`SELECT u.*, t.name as team_name, t.color as team_color FROM users u LEFT JOIN teams t ON t.id=u.team_id WHERE u.workspace_id=$1 ORDER BY u.created_at ASC`, [wsId])
    res.json(r.rows.map(u => ({ ...u, password_hash: undefined })))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.post('/agents', auth, requirePermission('manage_staff'), async (req, res) => {
  try {
    const wsId = await getWorkspaceId(req.user.id)
    const { name, email, role, team_id, capacity, password } = req.body
    const hash = await bcrypt.hash(password || 'Welcome@123', 10)
    const teamIdValue = (team_id === '' || team_id === null || team_id === undefined) ? null : parseInt(team_id)
    const capacityValue = (capacity === '' || capacity === null || capacity === undefined) ? 20 : parseInt(capacity)
    const r = await pool.query(`INSERT INTO users (workspace_id, name, email, password_hash, role, team_id, capacity, force_password_change) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`, [wsId, name, email, hash, role, teamIdValue, capacityValue, true])
    if (teamIdValue) await pool.query('INSERT INTO team_members (team_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [teamIdValue, r.rows[0].id])
    await logAudit(wsId, req.user.id, 'create_agent', 'user', r.rows[0].id, null, { name, email, role })
    res.json({ ...r.rows[0], password_hash: undefined })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.patch('/agents/:id', auth, requirePermission('manage_staff'), async (req, res) => {
  try {
    const wsId = await getWorkspaceId(req.user.id)

    // Whitelist of updateable user fields. Frontend may send a partial body
    // (e.g. AgentModal sends 5 fields, PermissionsModal sends 1, toggleActive
    // sends a full clone). All must work without nulling out the rest.
    const ALLOWED = ['name', 'email', 'role', 'team_id', 'capacity', 'status', 'active', 'permissions']

    const updates = []
    const values = []
    let idx = 1
    for (const field of ALLOWED) {
      if (!Object.prototype.hasOwnProperty.call(req.body, field)) continue

      let val = req.body[field]
      if (field === 'team_id') {
        val = (val === '' || val === null || val === undefined) ? null : parseInt(val)
      } else if (field === 'capacity') {
        val = (val === '' || val === null || val === undefined) ? null : parseInt(val)
      } else if (field === 'permissions') {
        val = JSON.stringify(val || [])
      }

      updates.push(`${field}=$${idx++}`)
      values.push(val)
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields provided to update' })
    }

    updates.push(`updated_at=NOW()`)
    values.push(req.params.id, wsId)
    const sql = `UPDATE users SET ${updates.join(', ')} WHERE id=$${idx} AND workspace_id=$${idx + 1} RETURNING *`
    const r = await pool.query(sql, values)

    // Side-effect: keep team_members in sync if team_id was updated
    if (Object.prototype.hasOwnProperty.call(req.body, 'team_id')) {
      const teamIdValue = (req.body.team_id === '' || req.body.team_id === null || req.body.team_id === undefined)
        ? null
        : parseInt(req.body.team_id)
      await pool.query('DELETE FROM team_members WHERE user_id=$1', [req.params.id])
      if (teamIdValue) {
        await pool.query('INSERT INTO team_members (team_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [teamIdValue, req.params.id])
      }
    }

    res.json({ ...r.rows[0], password_hash: undefined })
  } catch (err) {
    console.error('PATCH /agents/:id error:', err)
    res.status(500).json({ error: err.message })
  }
})

app.post('/agents/:id/reset-password', auth, requirePermission('manage_staff'), async (req, res) => {
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

app.post('/teams', auth, requirePermission('manage_teams'), async (req, res) => {
  try {
    const wsId = await getWorkspaceId(req.user.id)
    const { name, key, type, lead_user_id, color, description } = req.body
    const r = await pool.query(`INSERT INTO teams (workspace_id, name, key, type, lead_user_id, color, description) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`, [wsId, name, key, type, lead_user_id, color, description])
    res.json(r.rows[0])
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.patch('/teams/:id', auth, requirePermission('manage_teams'), async (req, res) => {
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

app.delete('/teams/:id', auth, requirePermission('manage_teams'), async (req, res) => {
  try {
    const wsId = await getWorkspaceId(req.user.id)
    await pool.query('DELETE FROM teams WHERE id=$1 AND workspace_id=$2', [req.params.id, wsId])
    res.json({ success: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ─── CONVERSATIONS ─────────────────────────────────────────────────────────────
app.get('/conversations', auth, async (req, res) => {
  try {
    const access = await getAccessibleProjects(req)
    const { phone_number_id, status, contact_id } = req.query

    let query = `SELECT c.*, ct.name, ct.phone, ct.email, ct.type, ct.pipeline_stage, ct.pdpa_consented, ct.dnc, u.name as assigned_name, pn.number as phone_number, pn.display_name as phone_line, c.last_message_preview as preview FROM conversations c JOIN contacts ct ON ct.id=c.contact_id LEFT JOIN users u ON u.id=c.assigned_to LEFT JOIN phone_numbers pn ON pn.id=c.phone_number_id WHERE c.workspace_id=$1`
    const params = [access.workspaceId]
    let idx = 2

    // Scope to accessible projects (unless workspace-wide role)
    if (!access.workspaceWide) {
      query += ` AND (c.project_id = ANY($${idx}::int[]))`
      params.push(access.projectIds)
      idx++
    }

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
    const access = await getAccessibleProjects(req)

    let sql = `SELECT c.*, ct.name, ct.phone, ct.email, ct.type, ct.pipeline_stage, ct.pdpa_consented, ct.dnc, ct.notes as contact_notes, u.name as assigned_name, pn.number as phone_number, pn.display_name as phone_line FROM conversations c JOIN contacts ct ON ct.id=c.contact_id LEFT JOIN users u ON u.id=c.assigned_to LEFT JOIN phone_numbers pn ON pn.id=c.phone_number_id WHERE c.id=$1 AND c.workspace_id=$2`
    const params = [req.params.id, access.workspaceId]
    if (!access.workspaceWide) {
      sql += ` AND c.project_id = ANY($3::int[])`
      params.push(access.projectIds)
    }

    const convo = await pool.query(sql, params)
    if (!convo.rows.length) return res.status(404).json({ error: 'Not found' })
    const messages = await pool.query(`SELECT m.*, u.name as sender_name, pu.name as pinned_by_name FROM messages m LEFT JOIN users u ON u.id=m.user_id LEFT JOIN users pu ON pu.id=m.pinned_by WHERE m.conversation_id=$1 ORDER BY m.created_at ASC`, [req.params.id])
    const result = convo.rows[0]
    result.assigned_to = result.assigned_name
    result.messages = messages.rows
    result.pinned_messages = messages.rows.filter(m => m.pinned_at).sort((a, b) => new Date(b.pinned_at) - new Date(a.pinned_at))
    res.json(result)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.patch('/conversations/:id/status', auth, requirePermission('manage_conversations'), async (req, res) => {
  try {
    const access = await getAccessibleProjects(req)
    const { status } = req.body

    let sql = `UPDATE conversations SET status=$1, closed_at=$2, updated_at=NOW() WHERE id=$3 AND workspace_id=$4`
    const params = [status, status === 'resolved' ? new Date() : null, req.params.id, access.workspaceId]
    if (!access.workspaceWide) {
      sql += ` AND project_id = ANY($5::int[])`
      params.push(access.projectIds)
    }
    sql += ` RETURNING *`

    const r = await pool.query(sql, params)
    if (!r.rows.length) return res.status(404).json({ error: 'Conversation not found or not accessible' })
    res.json(r.rows[0])
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.patch('/conversations/:id/assign', auth, requirePermission('manage_conversations'), async (req, res) => {
  try {
    const access = await getAccessibleProjects(req)
    const { assigned_to, team_id, handover_note } = req.body
    const agentId = assigned_to ? (await pool.query('SELECT id FROM users WHERE name=$1 AND workspace_id=$2', [assigned_to, access.workspaceId])).rows[0]?.id : null

    let sql = `UPDATE conversations SET assigned_to=$1, team_id=$2, handover_note=$3, handover_note_by=$4, handover_note_at=$5, updated_at=NOW() WHERE id=$6 AND workspace_id=$7`
    const params = [agentId, team_id, handover_note, handover_note ? req.user.id : null, handover_note ? new Date() : null, req.params.id, access.workspaceId]
    if (!access.workspaceWide) {
      sql += ` AND project_id = ANY($8::int[])`
      params.push(access.projectIds)
    }
    sql += ` RETURNING *`

    const r = await pool.query(sql, params)
    if (!r.rows.length) return res.status(404).json({ error: 'Conversation not found or not accessible' })
    res.json(r.rows[0])
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.post('/conversations', auth, requirePermission('manage_conversations'), async (req, res) => {
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
app.post('/messages', auth, requirePermission('send_messages'), async (req, res) => {
  try {
    const access = await getAccessibleProjects(req)
    const { conversation_id, direction, text, type, is_note, template_id } = req.body

    // Scope check: confirm the conversation is within the user's workspace AND accessible project
    const scopeCheck = await pool.query(
      `SELECT project_id FROM conversations WHERE id=$1 AND workspace_id=$2`,
      [conversation_id, access.workspaceId]
    )
    if (!scopeCheck.rows.length) return res.status(404).json({ error: 'Conversation not found' })
    if (!access.workspaceWide) {
      const projectId = scopeCheck.rows[0].project_id
      if (projectId === null || !access.projectIds.includes(projectId)) {
        return res.status(404).json({ error: 'Conversation not found' })
      }
    }

    const r = await pool.query(
      `INSERT INTO messages (conversation_id, workspace_id, user_id, direction, text, type, is_note, template_id, status, sent_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending',NOW()) RETURNING *`,
      [conversation_id, access.workspaceId, req.user.id, direction, text, type || 'text', is_note || false, template_id]
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
          [conversation_id, access.workspaceId]
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
    const access = await getAccessibleProjects(req)
    const { type, stage, search } = req.query
    let query = 'SELECT * FROM contacts WHERE workspace_id=$1'
    const params = [access.workspaceId]; let idx = 2

    // Scope to accessible projects �?strict: contact must have a conversation in user's project
    if (!access.workspaceWide) {
      query += ` AND EXISTS (SELECT 1 FROM conversations conv WHERE conv.contact_id = contacts.id AND conv.project_id = ANY($${idx}::int[]))`
      params.push(access.projectIds)
      idx++
    }

    if (type) { query += ` AND type=$${idx++}`; params.push(type) }
    if (stage) { query += ` AND pipeline_stage=$${idx++}`; params.push(stage) }
    if (search) { query += ` AND (name ILIKE $${idx} OR phone ILIKE $${idx} OR email ILIKE $${idx})`; params.push(`%${search}%`); idx++ }
    query += ' ORDER BY created_at DESC'
    const r = await pool.query(query, params)
    res.json(r.rows)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.post('/contacts', auth, requirePermission('manage_contacts'), async (req, res) => {
  try {
    const wsId = await getWorkspaceId(req.user.id)
    const {
      name, phone, email, type, pipeline_stage,
      tags, notes, source, candidate_role, current_company,
      expected_salary, notice_period, linkedin_url,
      pdpa_consented, dnc, dnc_reason, opted_out,
      // PDPA auto-log fields — optional, only used if pdpa_consented is true
      pdpa_method, pdpa_notes, pdpa_expires_in_months,
    } = req.body
    if (!name || !name.trim()) return res.status(400).json({ error: 'Contact name is required' })
    if (phone) {
      const dup = await pool.query('SELECT id, name FROM contacts WHERE phone=$1 AND workspace_id=$2', [phone, wsId])
      if (dup.rows.length > 0) return res.status(409).json({ error: `Duplicate: ${phone} already exists as ${dup.rows[0].name}`, existing_id: dup.rows[0].id })
    }
    const now = new Date()
    const r = await pool.query(`
      INSERT INTO contacts (
        workspace_id, name, phone, email, type, pipeline_stage,
        tags, notes, source, candidate_role, current_company,
        expected_salary, notice_period, linkedin_url,
        pdpa_consented, pdpa_consented_at, dnc, dnc_reason, opted_out
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11,
        $12, $13, $14,
        $15, $16, $17, $18, $19
      ) RETURNING *`,
      [
        wsId, name.trim(), phone || null, email || null,
        type || 'candidate', pipeline_stage || 'new',
        JSON.stringify(tags || []), notes || null, source || null,
        candidate_role || null, current_company || null,
        expected_salary || null, notice_period || null, linkedin_url || null,
        pdpa_consented || false,
        pdpa_consented ? now : null,
        dnc || false, dnc_reason || null, opted_out || false
      ]
    )

    // Auto-log a PDPA record if consent was captured during contact creation.
    // The PDPA tab's "manual entry" workflow goes through here too — anywhere
    // the consent flag flips on, we want an audit-trail row in pdpa_records.
    if (pdpa_consented) {
      const months = parseInt(pdpa_expires_in_months) || 24
      const expires = new Date(now)
      expires.setMonth(expires.getMonth() + months)
      await pool.query(`
        INSERT INTO pdpa_records
          (workspace_id, contact_id, status, method, consented_at, expires_at, collected_by, notes)
        VALUES ($1, $2, 'consented', $3, $4, $5, $6, $7)
      `, [wsId, r.rows[0].id, pdpa_method || 'manual', now, expires, req.user.id, pdpa_notes || null])
    }

    await logAudit(wsId, req.user.id, 'create_contact', 'contact', r.rows[0].id, null, req.body)
    res.json(r.rows[0])
  } catch (err) {
    console.error('POST /contacts error:', err)
    res.status(500).json({ error: err.message })
  }
})
// Bulk import contacts from a parsed CSV. Frontend parses the CSV and POSTs an
// array of row objects; we validate, dedupe, and insert. Returns per-row results
// so the UI can display "23 imported, 4 duplicates, 1 invalid".
app.post('/contacts/bulk', auth, requirePermission('manage_contacts'), async (req, res) => {
  const client = await pool.connect()
  try {
    const wsId = await getWorkspaceId(req.user.id)
    const {
      rows,
      // Optional: PDPA consent applied to all imported rows. The frontend
      // collects this once, applies it to the whole batch (e.g. "all of
      // these candidates filled out the consent form on the same date").
      // Per-row variation is not supported — simpler model, fewer mistakes.
      import_consent_collected,
      import_consent_method,
      import_consent_notes,
      import_consent_expires_in_months,
    } = req.body
    if (!Array.isArray(rows)) {
      return res.status(400).json({ error: 'rows must be an array' })
    }
    if (rows.length === 0) {
      return res.status(400).json({ error: 'No rows to import' })
    }
    if (rows.length > 5000) {
      return res.status(400).json({ error: 'Maximum 5000 rows per import. Split into smaller batches.' })
    }

    // Pre-fetch existing phones in this workspace for dedup
    const existing = await client.query(
      `SELECT phone FROM contacts WHERE workspace_id=$1 AND phone IS NOT NULL`,
      [wsId]
    )
    const existingPhones = new Set(existing.rows.map(r => r.phone))
    // Track in-batch duplicates too (CSV with same phone twice)
    const batchPhones = new Set()

    await client.query('BEGIN')
    const results = { imported: 0, duplicates: 0, invalid: 0, errors: [] }

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const rowNum = i + 1
      // Validate required fields
      if (!row.name || !row.name.trim()) {
        results.invalid++
        results.errors.push({ row: rowNum, reason: 'Missing name' })
        continue
      }
      // Normalize phone: strip all non-digits, then re-prepend + if length > 0.
      // This handles Excel stripping + signs and inconsistent CSV formats.
      const phoneRaw = (row.phone || '').trim()
      const phoneDigits = phoneRaw.replace(/\D/g, '')
      const phone = phoneDigits ? '+' + phoneDigits : null
      // Dedup against DB and against earlier rows in this batch
      if (phone) {
        if (existingPhones.has(phone)) {
          results.duplicates++
          results.errors.push({ row: rowNum, reason: `Phone ${phone} already exists in workspace` })
          continue
        }
        if (batchPhones.has(phone)) {
          results.duplicates++
          results.errors.push({ row: rowNum, reason: `Phone ${phone} appears more than once in CSV` })
          continue
        }
        batchPhones.add(phone)
      }
      try {
        const insertResult = await client.query(`
          INSERT INTO contacts (
            workspace_id, name, phone, email, type, pipeline_stage,
            notes, source, candidate_role, current_company,
            pdpa_consented, pdpa_consented_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          RETURNING id
        `, [
          wsId,
          row.name.trim(),
          phone,
          row.email?.trim() || null,
          row.type?.trim() || 'candidate',
          row.pipeline_stage?.trim() || 'new',
          row.notes?.trim() || null,
          row.source?.trim() || 'csv_import',
          row.candidate_role?.trim() || null,
          row.current_company?.trim() || null,
          import_consent_collected ? true : false,
          import_consent_collected ? new Date() : null,
        ])
        results.imported++
        // If consent was collected for this batch, append a pdpa_records row
        // for every successful import. Single insert per row keeps it simple
        // and consistent with the manual-entry path; bulk-insert optimization
        // can come later if imports get genuinely large.
        if (import_consent_collected) {
          const now = new Date()
          const months = parseInt(import_consent_expires_in_months) || 24
          const expires = new Date(now)
          expires.setMonth(expires.getMonth() + months)
          await client.query(`
            INSERT INTO pdpa_records
              (workspace_id, contact_id, status, method, consented_at, expires_at, collected_by, notes)
            VALUES ($1, $2, 'consented', $3, $4, $5, $6, $7)
          `, [
            wsId,
            insertResult.rows[0].id,
            import_consent_method || 'csv_import',
            now,
            expires,
            req.user.id,
            import_consent_notes || `Bulk CSV import on ${now.toISOString().slice(0, 10)}`,
          ])
        }
      } catch (err) {
        results.invalid++
        results.errors.push({ row: rowNum, reason: err.message?.slice(0, 200) || 'insert failed' })
      }
    }

    await client.query('COMMIT')
    await logAudit(wsId, req.user.id, 'bulk_import_contacts', 'contact', null, null, {
      total: rows.length, imported: results.imported, duplicates: results.duplicates, invalid: results.invalid
    })
    res.json(results)
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('POST /contacts/bulk error:', err)
    res.status(500).json({ error: err.message })
  } finally {
    client.release()
  }
})

app.patch('/contacts/:id', auth, requirePermission('manage_contacts'), async (req, res) => {
  try {
    const wsId = await getWorkspaceId(req.user.id)
    const {
      name, phone, email, type, pipeline_stage,
      pdpa_consented, dnc, dnc_reason, opted_out,
      tags, notes, expected_salary, notice_period, linkedin_url,
      current_role, current_company,
      // PDPA auto-log fields — only used if pdpa_consented transitions on/off
      pdpa_method, pdpa_notes, pdpa_expires_in_months,
    } = req.body

    // Read current consent state to detect transitions. We auto-log a record
    // when consent flips: false→true (consented) or true→false (withdrawn).
    // Edits that don't touch the flag don't generate spurious records.
    const before = await pool.query(
      'SELECT pdpa_consented FROM contacts WHERE id=$1 AND workspace_id=$2',
      [req.params.id, wsId]
    )
    if (before.rows.length === 0) {
      return res.status(404).json({ error: 'Contact not found' })
    }
    const wasConsented = before.rows[0].pdpa_consented === true
    const willBeConsented = pdpa_consented === true
    const consentJustGiven    = !wasConsented && willBeConsented
    const consentJustWithdrawn = wasConsented && pdpa_consented === false

    const r = await pool.query(
      `UPDATE contacts SET name=$1, phone=$2, email=$3, type=$4, pipeline_stage=$5, pdpa_consented=$6, dnc=$7, dnc_reason=$8, opted_out=$9, tags=$10, notes=$11, expected_salary=$12, notice_period=$13, linkedin_url=$14, candidate_role=$15, current_company=$16, pdpa_consented_at=CASE WHEN $6=true AND pdpa_consented_at IS NULL THEN NOW() WHEN $6=false THEN NULL ELSE pdpa_consented_at END, updated_at=NOW() WHERE id=$17 AND workspace_id=$18 RETURNING *`,
      [name, phone, email, type, pipeline_stage, pdpa_consented, dnc, dnc_reason, opted_out, JSON.stringify(tags), notes, expected_salary, notice_period, linkedin_url, current_role, current_company, req.params.id, wsId]
    )

    // Auto-log the PDPA transition. Note that PATCH-driven consent is
    // typically the editor's "I'm just toggling this" path, not the PDPA
    // tab's deliberate Record-Consent flow (which goes through POST
    // /pdpa/records directly). Both paths produce the same audit-trail row.
    if (consentJustGiven) {
      const now = new Date()
      const months = parseInt(pdpa_expires_in_months) || 24
      const expires = new Date(now)
      expires.setMonth(expires.getMonth() + months)
      await pool.query(`
        INSERT INTO pdpa_records
          (workspace_id, contact_id, status, method, consented_at, expires_at, collected_by, notes)
        VALUES ($1, $2, 'consented', $3, $4, $5, $6, $7)
      `, [wsId, req.params.id, pdpa_method || 'manual', now, expires, req.user.id, pdpa_notes || null])
    } else if (consentJustWithdrawn) {
      await pool.query(`
        INSERT INTO pdpa_records
          (workspace_id, contact_id, status, method, withdrawn_at, collected_by, notes)
        VALUES ($1, $2, 'withdrawn', $3, NOW(), $4, $5)
      `, [wsId, req.params.id, pdpa_method || 'manual', req.user.id, pdpa_notes || null])
    }

    res.json(r.rows[0])
  } catch (err) {
    console.error('PATCH /contacts/:id error:', err)
    res.status(500).json({ error: err.message })
  }
})

app.delete('/contacts/:id', auth, requirePermission('manage_contacts'), async (req, res) => {
  try {
    const wsId = await getWorkspaceId(req.user.id)
    await pool.query('DELETE FROM contacts WHERE id=$1 AND workspace_id=$2', [req.params.id, wsId])
    res.json({ success: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// Bulk operations on contacts. Single endpoint with action discriminator
// instead of N separate endpoints — keeps the API surface small as we add
// more actions over time. Action types so far: delete, change_stage,
// mark_opted_out, unmark_opted_out, mark_dnc, unmark_dnc, set_assigned_to.
// Returns affected row count and per-id errors for transparency.
app.post('/contacts/bulk-action', auth, requirePermission('manage_contacts'), async (req, res) => {
  const client = await pool.connect()
  try {
    const wsId = await getWorkspaceId(req.user.id)
    const { ids, action, payload } = req.body

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids must be a non-empty array' })
    }
    if (ids.length > 1000) {
      return res.status(400).json({ error: 'Maximum 1000 contacts per bulk action' })
    }
    if (!action) return res.status(400).json({ error: 'action is required' })

    await client.query('BEGIN')

    let affected = 0
    let result = null

    switch (action) {
      case 'delete': {
        const r = await client.query(
          `DELETE FROM contacts WHERE id = ANY($1::int[]) AND workspace_id = $2`,
          [ids, wsId]
        )
        affected = r.rowCount
        break
      }
      case 'change_stage': {
        if (!payload?.pipeline_stage) {
          await client.query('ROLLBACK')
          return res.status(400).json({ error: 'payload.pipeline_stage required for change_stage' })
        }
        const r = await client.query(
          `UPDATE contacts SET pipeline_stage = $1, updated_at = NOW()
           WHERE id = ANY($2::int[]) AND workspace_id = $3`,
          [payload.pipeline_stage, ids, wsId]
        )
        affected = r.rowCount
        break
      }
      case 'mark_opted_out':
      case 'unmark_opted_out': {
        const value = action === 'mark_opted_out'
        const r = await client.query(
          `UPDATE contacts SET opted_out = $1, updated_at = NOW()
           WHERE id = ANY($2::int[]) AND workspace_id = $3`,
          [value, ids, wsId]
        )
        affected = r.rowCount
        break
      }
      case 'mark_dnc':
      case 'unmark_dnc': {
        const value = action === 'mark_dnc'
        const reason = payload?.dnc_reason || null
        const r = await client.query(
          `UPDATE contacts SET dnc = $1, dnc_reason = $2, updated_at = NOW()
           WHERE id = ANY($3::int[]) AND workspace_id = $4`,
          [value, reason, ids, wsId]
        )
        affected = r.rowCount
        break
      }
      case 'set_assigned_to': {
        // payload.assigned_to can be null (unassign) or a user_id
        const r = await client.query(
          `UPDATE contacts SET assigned_to = $1, updated_at = NOW()
           WHERE id = ANY($2::int[]) AND workspace_id = $3`,
          [payload?.assigned_to || null, ids, wsId]
        )
        affected = r.rowCount
        break
      }
      case 'add_tag':
      case 'remove_tag': {
        if (!payload?.tag) {
          await client.query('ROLLBACK')
          return res.status(400).json({ error: 'payload.tag required' })
        }
        // Update tags as jsonb array. add_tag uses jsonb_set semantics with
        // dedup; remove_tag filters the array. We do this row-by-row because
        // SQL set-ops on jsonb arrays without unnest get messy.
        const rows = await client.query(
          `SELECT id, tags FROM contacts WHERE id = ANY($1::int[]) AND workspace_id = $2`,
          [ids, wsId]
        )
        for (const row of rows.rows) {
          const existing = Array.isArray(row.tags) ? row.tags : []
          let next
          if (action === 'add_tag') {
            next = existing.includes(payload.tag) ? existing : [...existing, payload.tag]
          } else {
            next = existing.filter(t => t !== payload.tag)
          }
          await client.query(
            `UPDATE contacts SET tags = $1, updated_at = NOW() WHERE id = $2 AND workspace_id = $3`,
            [JSON.stringify(next), row.id, wsId]
          )
        }
        affected = rows.rows.length
        break
      }
      default:
        await client.query('ROLLBACK')
        return res.status(400).json({ error: `Unknown action: ${action}` })
    }

    await client.query('COMMIT')
    await logAudit(wsId, req.user.id, `bulk_${action}_contacts`, 'contact', null, null, {
      ids_count: ids.length, affected, payload
    })
    res.json({ affected, action })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('POST /contacts/bulk-action error:', err)
    res.status(500).json({ error: err.message })
  } finally {
    client.release()
  }
})
// Saved views. Each user has private views; shared views are visible to
// everyone in the same workspace but only the creator can edit/delete.
app.get('/contact-views', auth, async (req, res) => {
  try {
    const wsId = await getWorkspaceId(req.user.id)
    const r = await pool.query(`
      SELECT cv.*, u.name AS creator_name
      FROM contact_views cv
      LEFT JOIN users u ON u.id = cv.user_id
      WHERE cv.workspace_id = $1
        AND (cv.user_id = $2 OR cv.is_shared = true)
      ORDER BY cv.created_at DESC
    `, [wsId, req.user.id])
    res.json(r.rows)
  } catch (err) {
    console.error('GET /contact-views error:', err)
    res.status(500).json({ error: err.message })
  }
})
app.post('/contact-views', auth, requirePermission('manage_contacts'), async (req, res) => {
  try {
    const wsId = await getWorkspaceId(req.user.id)
    const { name, filters, sort, columns, is_shared } = req.body
    if (!name || !name.trim()) return res.status(400).json({ error: 'View name is required' })
    const r = await pool.query(`
      INSERT INTO contact_views (workspace_id, user_id, name, filters, sort, columns, is_shared)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
      wsId, req.user.id, name.trim(),
      JSON.stringify(filters || {}),
      JSON.stringify(sort || {}),
      JSON.stringify(columns || []),
      is_shared === true
    ])
    res.json(r.rows[0])
  } catch (err) {
    console.error('POST /contact-views error:', err)
    res.status(500).json({ error: err.message })
  }
})
app.patch('/contact-views/:id', auth, requirePermission('manage_contacts'), async (req, res) => {
  try {
    const wsId = await getWorkspaceId(req.user.id)
    // Only creator can edit
    const current = await pool.query(
      `SELECT id, user_id FROM contact_views WHERE id=$1 AND workspace_id=$2`,
      [req.params.id, wsId]
    )
    if (!current.rows.length) return res.status(404).json({ error: 'View not found' })
    if (current.rows[0].user_id !== req.user.id) {
      return res.status(403).json({ error: 'Only the creator can edit this view' })
    }
    const { name, filters, sort, columns, is_shared } = req.body
    const sets = []
    const params = []
    let p = 1
    if (name !== undefined) { sets.push(`name = $${p++}`); params.push(name.trim()) }
    if (filters !== undefined) { sets.push(`filters = $${p++}`); params.push(JSON.stringify(filters)) }
    if (sort !== undefined) { sets.push(`sort = $${p++}`); params.push(JSON.stringify(sort)) }
    if (columns !== undefined) { sets.push(`columns = $${p++}`); params.push(JSON.stringify(columns)) }
    if (is_shared !== undefined) { sets.push(`is_shared = $${p++}`); params.push(is_shared === true) }
    if (sets.length === 0) return res.status(400).json({ error: 'No fields to update' })
    sets.push(`updated_at = NOW()`)
    params.push(req.params.id, wsId)
    const r = await pool.query(
      `UPDATE contact_views SET ${sets.join(', ')} WHERE id=$${p++} AND workspace_id=$${p++} RETURNING *`,
      params
    )
    res.json(r.rows[0])
  } catch (err) {
    console.error('PATCH /contact-views/:id error:', err)
    res.status(500).json({ error: err.message })
  }
})
app.delete('/contact-views/:id', auth, requirePermission('manage_contacts'), async (req, res) => {
  try {
    const wsId = await getWorkspaceId(req.user.id)
    const current = await pool.query(
      `SELECT id, user_id FROM contact_views WHERE id=$1 AND workspace_id=$2`,
      [req.params.id, wsId]
    )
    if (!current.rows.length) return res.status(404).json({ error: 'View not found' })
    if (current.rows[0].user_id !== req.user.id) {
      return res.status(403).json({ error: 'Only the creator can delete this view' })
    }
    await pool.query(`DELETE FROM contact_views WHERE id=$1 AND workspace_id=$2`, [req.params.id, wsId])
    res.json({ success: true })
  } catch (err) {
    console.error('DELETE /contact-views/:id error:', err)
    res.status(500).json({ error: err.message })
  }
})

// Aggregate analytics for the dashboard. Single round-trip across multiple
// data sources. All counts are workspace-scoped. Date ranges use the
// server's clock (UTC); frontend formats for display.
app.get('/analytics/dashboard', auth, async (req, res) => {
  try {
    const wsId = await getWorkspaceId(req.user.id)
    const now = new Date()
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    // Contact KPIs
    const contactStats = await pool.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE created_at >= $2)::int AS new_this_week,
        COUNT(*) FILTER (WHERE type = 'candidate')::int AS candidates,
        COUNT(*) FILTER (WHERE type = 'client')::int AS clients,
        COUNT(*) FILTER (WHERE opted_out = true)::int AS opted_out,
        COUNT(*) FILTER (WHERE dnc = true)::int AS dnc,
        COUNT(*) FILTER (WHERE pdpa_consented = true)::int AS pdpa_consented
      FROM contacts WHERE workspace_id = $1
    `, [wsId, sevenDaysAgo])

    // Pipeline distribution
    const pipelineDist = await pool.query(`
      SELECT pipeline_stage, COUNT(*)::int AS count
      FROM contacts
      WHERE workspace_id = $1 AND pipeline_stage IS NOT NULL
      GROUP BY pipeline_stage
    `, [wsId])

    // Broadcast KPIs
    const broadcastStats = await pool.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE created_at >= $2)::int AS this_month,
        COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
        COUNT(*) FILTER (WHERE status = 'failed')::int AS failed,
        COUNT(*) FILTER (WHERE status IN ('scheduled', 'sending'))::int AS active,
        COALESCE(SUM(sent_count), 0)::int AS total_sent
      FROM broadcasts WHERE workspace_id = $1
    `, [wsId, startOfMonth])

    // Template KPIs
    const templateStats = await pool.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE meta_status = 'APPROVED')::int AS approved,
        COUNT(*) FILTER (WHERE meta_status = 'PENDING')::int AS pending,
        COUNT(*) FILTER (WHERE meta_status = 'REJECTED')::int AS rejected
      FROM templates WHERE workspace_id = $1
    `, [wsId])

    // 30-day message volume — daily counts of sent and received messages.
    // We pull from the messages table if it exists. If conversations table
    // is the source instead, this query may need adjustment.
    let messagesPerDay = []
    try {
      const r = await pool.query(`
        SELECT
          DATE_TRUNC('day', created_at)::date AS day,
          COUNT(*) FILTER (WHERE direction = 'outbound')::int AS sent,
          COUNT(*) FILTER (WHERE direction = 'inbound')::int AS received
        FROM messages
        WHERE workspace_id = $1 AND created_at >= $2
        GROUP BY day
        ORDER BY day ASC
      `, [wsId, thirtyDaysAgo])
      messagesPerDay = r.rows
    } catch (err) {
      // Messages table may not exist yet or have different schema. Return empty.
      console.warn('messages query failed, returning empty array:', err.message)
    }

    // Active conversations — distinct conversations with messages in last 7 days
    let activeConversations = 0
    try {
      const r = await pool.query(`
        SELECT COUNT(DISTINCT conversation_id)::int AS count
        FROM messages
        WHERE workspace_id = $1 AND created_at >= $2 AND conversation_id IS NOT NULL
      `, [wsId, sevenDaysAgo])
      activeConversations = r.rows[0]?.count || 0
    } catch (err) {
      console.warn('active conversations query failed:', err.message)
    }

    // Recent broadcasts (last 5)
    const recentBroadcasts = await pool.query(`
      SELECT id, name, status,
        recipient_count AS total_recipients,
        sent_count AS sent_recipients,
        failed_count AS failed_recipients,
        created_at
      FROM broadcasts
      WHERE workspace_id = $1
      ORDER BY created_at DESC
      LIMIT 5
    `, [wsId])

    // Recent contacts (last 10 added)
    const recentContacts = await pool.query(`
      SELECT id, name, type, pipeline_stage, created_at
      FROM contacts
      WHERE workspace_id = $1
      ORDER BY created_at DESC
      LIMIT 10
    `, [wsId])

    res.json({
      contacts: contactStats.rows[0],
      pipeline: pipelineDist.rows,
      broadcasts: broadcastStats.rows[0],
      templates: templateStats.rows[0],
      messages_per_day: messagesPerDay,
      active_conversations: activeConversations,
      recent_broadcasts: recentBroadcasts.rows,
      recent_contacts: recentContacts.rows,
      computed_at: now.toISOString()
    })
  } catch (err) {
    console.error('GET /analytics/dashboard error:', err)
    res.status(500).json({ error: err.message })
  }
})

// ─── TEMPLATES ─────────────────────────────────────────────────────────────────
app.get('/templates', auth, async (req, res) => {
  try {
    const wsId = await getWorkspaceId(req.user.id)
    const r = await pool.query('SELECT * FROM templates WHERE workspace_id=$1 ORDER BY created_at DESC', [wsId])
    res.json(r.rows)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.post('/templates', auth, requirePermission('manage_templates'), async (req, res) => {
  try {
    const wsId = await getWorkspaceId(req.user.id)
    const { name, category, body, buttons, subject, type, status, variables, header, footer } = req.body
    if (!name || !name.trim()) return res.status(400).json({ error: 'Template name is required' })
    const cleanName = name.trim()
    // Duplicate name check (Meta WABA enforces uniqueness; fail fast in our DB)
    const dup = await pool.query(
      `SELECT id FROM templates WHERE workspace_id=$1 AND LOWER(name)=LOWER($2)`,
      [wsId, cleanName]
    )
    if (dup.rows.length > 0) {
      return res.status(409).json({ error: `A template named "${cleanName}" already exists in your workspace. Choose a different name.` })
    }
    // Normalise variables and reconcile with body (auto-extract any {{name}} from body that's missing from list)
    const reconciled = reconcileVariablesWithBody(variables, body)
    const r = await pool.query(
      `INSERT INTO templates (workspace_id, name, category, body, buttons, subject, type, status, created_by, source, variables, header, footer)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'tenant',$10,$11,$12) RETURNING *`,
      [wsId, cleanName, category, body, JSON.stringify(buttons || []), subject, type || 'whatsapp', status || 'draft', req.user.id, JSON.stringify(reconciled), header || null, footer || null]
    )
    res.json(r.rows[0])
  } catch (err) {
    console.error('POST /templates error:', err)
    res.status(500).json({ error: err.message })
  }
})

app.patch('/templates/:id', auth, requirePermission('manage_templates'), async (req, res) => {
  try {
    const wsId = await getWorkspaceId(req.user.id)
    const { name, category, body, buttons, status, subject, variables, header, footer } = req.body

    // Fetch current row to know its source/status before mutating
    const current = await pool.query(`SELECT id, name, source, status, body, variables FROM templates WHERE id=$1 AND workspace_id=$2`, [req.params.id, wsId])
    if (!current.rows.length) return res.status(404).json({ error: 'Template not found' })
    const tpl = current.rows[0]

    // Lock body/header/buttons edits on Meta-library templates (always)
    // For Meta library templates, we still allow updating defaults (the values inside variables.defaults)
    if (tpl.source === 'meta_library') {
      if (body !== undefined || buttons !== undefined || header !== undefined || footer !== undefined) {
        return res.status(403).json({ error: 'Body, buttons, header, and footer of Meta library templates cannot be edited. You may update default values for variables.' })
      }
      // Meta library: variable names and ordering are locked, only defaults can change
      if (variables !== undefined) {
        const incoming = normaliseVariables(variables)
        const existing = tpl.variables || { ordered: [], defaults: {} }
        // Verify ordered list is unchanged (names locked)
        const sameNames = JSON.stringify(incoming.ordered) === JSON.stringify(existing.ordered)
        if (!sameNames) {
          return res.status(403).json({ error: 'Variable names of Meta library templates cannot be changed. Only default values may be edited.' })
        }
      }
    }

    // Lock body/buttons edits on approved templates (clone-for-reapproval pattern)
    if (tpl.status === 'approved' && tpl.source !== 'meta_library' && (body !== undefined || buttons !== undefined || header !== undefined || footer !== undefined)) {
      return res.status(403).json({ error: 'Approved templates cannot be edited. Clone for re-approval instead.' })
    }

    // Duplicate name check on rename (case-insensitive, excluding self)
    if (name !== undefined && name.trim() && name.trim().toLowerCase() !== (tpl.name || '').toLowerCase()) {
      const dup = await pool.query(
        `SELECT id FROM templates WHERE workspace_id=$1 AND LOWER(name)=LOWER($2) AND id != $3`,
        [wsId, name.trim(), req.params.id]
      )
      if (dup.rows.length > 0) {
        return res.status(409).json({ error: `A template named "${name.trim()}" already exists in your workspace. Choose a different name.` })
      }
    }

    // Determine final variables value: reconcile with whatever body is being saved (or existing body if not changing)
    let finalVariables = null
    if (variables !== undefined) {
      const finalBody = body !== undefined ? body : tpl.body
      finalVariables = reconcileVariablesWithBody(variables, finalBody)
    } else if (body !== undefined) {
      // Body changed but variables not sent: reconcile existing variables against new body
      finalVariables = reconcileVariablesWithBody(tpl.variables, body)
    }

    const r = await pool.query(
      `UPDATE templates SET
         name = COALESCE($1, name),
         category = COALESCE($2, category),
         body = COALESCE($3, body),
         buttons = COALESCE($4, buttons),
         status = COALESCE($5, status),
         subject = COALESCE($6, subject),
         variables = COALESCE($7, variables),
         header = COALESCE($8, header),
         footer = COALESCE($9, footer),
         updated_at = NOW()
       WHERE id=$10 AND workspace_id=$11 RETURNING *`,
      [
        name !== undefined ? name.trim() : null,
        category !== undefined ? category : null,
        body !== undefined ? body : null,
        buttons !== undefined ? JSON.stringify(buttons || []) : null,
        status !== undefined ? status : null,
        subject !== undefined ? subject : null,
        finalVariables !== null ? JSON.stringify(finalVariables) : null,
        header !== undefined ? header : null,
        footer !== undefined ? footer : null,
        req.params.id,
        wsId
      ]
    )
    res.json(r.rows[0])
  } catch (err) {
    console.error('PATCH /templates/:id error:', err)
    res.status(500).json({ error: err.message })
  }
})

app.delete('/templates/:id', auth, requirePermission('manage_templates'), async (req, res) => {
  try {
    const wsId = await getWorkspaceId(req.user.id)
    await pool.query('DELETE FROM templates WHERE id=$1 AND workspace_id=$2', [req.params.id, wsId])
    res.json({ success: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ─── TEMPLATE LIBRARY (read-only catalog of pre-built starter templates) ──
app.get('/template-library', auth, async (req, res) => {
  try {
    const { category, audience, featured } = req.query
    const conditions = ['is_active = true']
    const params = []
    if (category) { params.push(category); conditions.push(`category = $${params.length}`) }
    if (audience) { params.push(audience); conditions.push(`audience = $${params.length}`) }
    if (featured === 'true') { conditions.push('is_featured = true') }
    const sql = `SELECT id, category, audience, template_key, display_name, description,
                            header, body, footer, buttons, variables, is_featured, created_at
                     FROM template_library
                 WHERE ${conditions.join(' AND ')}
                 ORDER BY is_featured DESC, category ASC, display_name ASC`
    const r = await pool.query(sql, params)
    res.json({ count: r.rowCount, templates: r.rows })
  } catch (err) {
    console.error('GET /template-library error:', err)
    res.status(500).json({ error: err.message })
  }
})

app.get('/template-library/meta/categories', auth, async (req, res) => {
  try {
    const cats = await pool.query(`SELECT DISTINCT category FROM template_library WHERE is_active=true ORDER BY category`)
    const auds = await pool.query(`SELECT DISTINCT audience FROM template_library WHERE is_active=true AND audience IS NOT NULL ORDER BY audience`)
    res.json({
      categories: cats.rows.map(r => r.category),
      audiences: auds.rows.map(r => r.audience)
    })
  } catch (err) {
    console.error('GET /template-library/meta/categories error:', err)
    res.status(500).json({ error: err.message })
  }
})

app.get('/template-library/:template_key', auth, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT id, category, audience, template_key, display_name, description,
              header, body, footer, buttons, variables, is_featured, created_at
       FROM template_library
       WHERE template_key=$1 AND is_active=true`,
      [req.params.template_key]
    )
    if (!r.rows.length) return res.status(404).json({ error: 'Template not found' })
    res.json(r.rows[0])
  } catch (err) {
    console.error('GET /template-library/:template_key error:', err)
    res.status(500).json({ error: err.message })
  }
})

// ─── Meta Library endpoints (Phase II2) ────────────────────────────────────
// In mock mode (default), returns hardcoded sample data matching Meta's API
// shape. When credentials are sorted, set META_MOCK_MODE=false and these
// endpoints will proxy to Meta's real /message_template_library endpoint.

const META_MOCK_MODE = process.env.META_MOCK_MODE !== 'false'

// Browse Meta's library catalogue with optional filters
app.get('/api/meta-library', auth, async (req, res) => {
  try {
    const { search, topic, usecase, industry, language, name } = req.query

    if (META_MOCK_MODE) {
      const templates = metaLibraryMock.filterTemplates({ search, topic, usecase, industry, language, name })
      return res.json({
        templates,
        filters: metaLibraryMock.AVAILABLE_FILTERS,
        mock: true
      })
    }

    // Real Meta call (not yet implemented - awaiting credentials)
    return res.status(501).json({
      error: 'Real Meta API mode not yet implemented. Set META_MOCK_MODE=true.'
    })
  } catch (err) {
    console.error('GET /api/meta-library error:', err)
    res.status(500).json({ error: err.message })
  }
})

// Install a Meta library template into tenant's workspace
// In mock mode: just inserts a row with status='approved'.
// In real mode: would call POST /<WABAID>/message_templates with library_template_name
app.post('/api/meta-library/install', auth, async (req, res) => {
  try {
    const { library_template_name, custom_name, language, button_inputs, body_inputs } = req.body
    const wsId = req.user.workspace_id

    if (!library_template_name || !custom_name) {
      return res.status(400).json({ error: 'library_template_name and custom_name are required' })
    }

    // Check if template name already exists in this workspace
    const existing = await pool.query(
      `SELECT id FROM templates WHERE workspace_id = $1 AND name = $2`,
      [wsId, custom_name]
    )
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'A template with this name already exists in your workspace' })
    }

    if (META_MOCK_MODE) {
      // Look up the template in the mock library
      const sourceTpl = metaLibraryMock.SAMPLE_TEMPLATES.find(t => t.name === library_template_name)
      if (!sourceTpl) {
        return res.status(404).json({ error: 'Template not found in Meta library' })
      }

      // Generate a fake meta_template_id
      const fakeMetaId = `mock_${Date.now()}_${Math.floor(Math.random() * 10000)}`
      const now = new Date()

      // Build the buttons array (use button_inputs from request if provided, else from source template)
      const buttons = button_inputs || sourceTpl.buttons || []

      // Build variables map from body_params (NEW SHAPE: ordered + defaults + labels)
      // Meta library uses positional {{1}} {{2}}; we name them param_1, param_2 etc.,
      // store sample values as defaults, and friendly labels for display in editor.
      const ordered = []
      const defaults = {}
      const labels = {}
      if (Array.isArray(sourceTpl.body_params)) {
        sourceTpl.body_params.forEach((sample, idx) => {
          const name = `param_${idx + 1}`
          ordered.push(name)
          defaults[name] = String(sample || '')
          if (Array.isArray(sourceTpl.param_labels) && sourceTpl.param_labels[idx]) {
            labels[name] = String(sourceTpl.param_labels[idx])
          }
        })
      }
      const variables = { ordered, defaults, labels }

      const insert = await pool.query(
        `INSERT INTO templates (
          workspace_id, name, category, language, header, body, footer,
          buttons, variables, status, source, library_template_name,
          meta_template_id, meta_status, submitted_at, approved_at, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, 'approved', 'meta_library', $10,
          $11, 'APPROVED', $12, $12, $12, $12
        ) RETURNING id, name, status, source, meta_template_id, meta_status, created_at`,
        [
          wsId,
          custom_name,
          sourceTpl.category.toLowerCase(),
          language || sourceTpl.language || 'en_US',
          sourceTpl.header || null,
          sourceTpl.body,
          null,
          JSON.stringify(buttons),
          JSON.stringify(variables),
          library_template_name,
          fakeMetaId,
          now
        ]
      )

      return res.json({
        ...insert.rows[0],
        mock: true,
        message: 'Template installed from Meta library (mock mode). Status: APPROVED, ready to send.'
      })
    }

    // Real Meta call (not yet implemented)
    return res.status(501).json({
      error: 'Real Meta API mode not yet implemented. Set META_MOCK_MODE=true.'
    })
  } catch (err) {
    console.error('POST /api/meta-library/install error:', err)
    res.status(500).json({ error: err.message })
  }
})

// ─── BROADCASTS ───────────────────────────────────────────────────────────────
// List broadcasts in workspace with aggregated recipient stats. Stats are
// computed via LEFT JOIN + GROUP BY so a list of 100 broadcasts costs one query
// instead of 101. Recipient counts come from broadcast_recipients (source of
// truth); the legacy recipient_count/sent_count/failed_count columns on the
// broadcasts table are kept for backwards compatibility but not authoritative.
app.get('/broadcasts', auth, async (req, res) => {
  try {
    const wsId = await getWorkspaceId(req.user.id)
    const r = await pool.query(`
      SELECT
        b.*,
        t.name AS template_name,
        t.status AS template_status,
        u.name AS created_by_name,
        COALESCE(COUNT(br.id), 0)::int AS total_recipients,
        COALESCE(SUM(CASE WHEN br.status = 'pending'  THEN 1 ELSE 0 END), 0)::int AS pending_recipients,
        COALESCE(SUM(CASE WHEN br.status = 'sending'  THEN 1 ELSE 0 END), 0)::int AS sending_recipients,
        COALESCE(SUM(CASE WHEN br.status = 'sent'     THEN 1 ELSE 0 END), 0)::int AS sent_recipients,
        COALESCE(SUM(CASE WHEN br.status = 'failed'   THEN 1 ELSE 0 END), 0)::int AS failed_recipients,
        COALESCE(SUM(CASE WHEN br.status = 'skipped'  THEN 1 ELSE 0 END), 0)::int AS skipped_recipients
      FROM broadcasts b
      LEFT JOIN templates t  ON t.id = b.template_id
      LEFT JOIN users u      ON u.id = b.created_by
      LEFT JOIN broadcast_recipients br ON br.broadcast_id = b.id
      WHERE b.workspace_id = $1
      GROUP BY b.id, t.name, t.status, u.name
      ORDER BY b.created_at DESC
    `, [wsId])
    res.json(r.rows)
  } catch (err) {
    console.error('GET /broadcasts error:', err)
    res.status(500).json({ error: err.message })
  }
})
// Single broadcast with the same stats as the list view. No recipient list
// here yet (paginated endpoint comes in v3); this is the detail-page header.
app.get('/broadcasts/:id', auth, async (req, res) => {
  try {
    const wsId = await getWorkspaceId(req.user.id)
    const r = await pool.query(`
      SELECT
        b.*,
        t.name AS template_name,
        t.status AS template_status,
        t.body AS template_body,
        t.buttons AS template_buttons,
        u.name AS created_by_name,
        cu.name AS cancelled_by_name,
        COALESCE(COUNT(br.id), 0)::int AS total_recipients,
        COALESCE(SUM(CASE WHEN br.status = 'pending'  THEN 1 ELSE 0 END), 0)::int AS pending_recipients,
        COALESCE(SUM(CASE WHEN br.status = 'sending'  THEN 1 ELSE 0 END), 0)::int AS sending_recipients,
        COALESCE(SUM(CASE WHEN br.status = 'sent'     THEN 1 ELSE 0 END), 0)::int AS sent_recipients,
        COALESCE(SUM(CASE WHEN br.status = 'failed'   THEN 1 ELSE 0 END), 0)::int AS failed_recipients,
        COALESCE(SUM(CASE WHEN br.status = 'skipped'  THEN 1 ELSE 0 END), 0)::int AS skipped_recipients
      FROM broadcasts b
      LEFT JOIN templates t  ON t.id = b.template_id
      LEFT JOIN users u      ON u.id = b.created_by
      LEFT JOIN users cu     ON cu.id = b.cancelled_by
      LEFT JOIN broadcast_recipients br ON br.broadcast_id = b.id
      WHERE b.id = $1 AND b.workspace_id = $2
      GROUP BY b.id, t.name, t.status, t.body, t.buttons, u.name, cu.name
    `, [req.params.id, wsId])
    if (!r.rows.length) return res.status(404).json({ error: 'Broadcast not found' })
    res.json(r.rows[0])
  } catch (err) {
    console.error('GET /broadcasts/:id error:', err)
    res.status(500).json({ error: err.message })
  }
})
// Create draft broadcast. Recipients and scheduling come via PATCH later.
// Validates that any referenced template belongs to the workspace and is
// approved (you cannot broadcast a draft or rejected template).
app.post('/broadcasts', auth, requirePermission('manage_broadcasts'), async (req, res) => {
  try {
    const wsId = await getWorkspaceId(req.user.id)
    const {
      name, template_id, phone_number_id, variables, target_filters, scheduled_at,
      quiet_hours_enabled, quiet_hours_start_hour, quiet_hours_end_hour,
      force_send_outside_hours, consecutive_fail_limit
    } = req.body
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Broadcast name is required' })
    }
    // Validate quiet hours range if provided
    if (quiet_hours_start_hour !== undefined && (quiet_hours_start_hour < 0 || quiet_hours_start_hour > 23)) {
      return res.status(400).json({ error: 'quiet_hours_start_hour must be 0-23' })
    }
    if (quiet_hours_end_hour !== undefined && (quiet_hours_end_hour < 0 || quiet_hours_end_hour > 23)) {
      return res.status(400).json({ error: 'quiet_hours_end_hour must be 0-23' })
    }
    if (consecutive_fail_limit !== undefined && consecutive_fail_limit < 1) {
      return res.status(400).json({ error: 'consecutive_fail_limit must be at least 1' })
    }
    const cleanName = name.trim()
    // Validate template if provided
    if (template_id) {
      const tpl = await pool.query(
        `SELECT id, status FROM templates WHERE id=$1 AND workspace_id=$2`,
        [template_id, wsId]
      )
      if (!tpl.rows.length) {
        return res.status(404).json({ error: 'Template not found in your workspace' })
      }
      if (tpl.rows[0].status !== 'approved') {
        return res.status(400).json({ error: 'Only approved templates can be broadcast. Submit the template for approval first.' })
      }
    }
    // Validate phone_number_id if provided
    if (phone_number_id) {
      const ph = await pool.query(
        `SELECT id FROM phone_numbers WHERE id=$1 AND workspace_id=$2`,
        [phone_number_id, wsId]
      )
      if (!ph.rows.length) {
        return res.status(404).json({ error: 'Phone number not found in your workspace' })
      }
    }
    const r = await pool.query(`
      INSERT INTO broadcasts (
        workspace_id, name, template_id, phone_number_id, created_by,
        variables, target_filters, scheduled_at, status,
        quiet_hours_enabled, quiet_hours_start_hour, quiet_hours_end_hour,
        force_send_outside_hours, consecutive_fail_limit
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'draft', $9, $10, $11, $12, $13)
      RETURNING *
    `, [
      wsId, cleanName, template_id || null, phone_number_id || null, req.user.id,
      JSON.stringify(variables || {}),
      JSON.stringify(target_filters || {}),
      scheduled_at || null,
      quiet_hours_enabled !== undefined ? quiet_hours_enabled : true,
      quiet_hours_start_hour !== undefined ? quiet_hours_start_hour : 22,
      quiet_hours_end_hour !== undefined ? quiet_hours_end_hour : 8,
      force_send_outside_hours !== undefined ? force_send_outside_hours : false,
      consecutive_fail_limit !== undefined ? consecutive_fail_limit : 5
    ])
    res.json(r.rows[0])
  } catch (err) {
    console.error('POST /broadcasts error:', err)
    res.status(500).json({ error: err.message })
  }
})
// Update draft broadcast. Locked to status='draft' to prevent retroactive
// edits to broadcasts that are already scheduled, sending, or completed.
// Use PATCH /broadcasts/:id/cancel (v3) to stop a broadcast in flight.
app.patch('/broadcasts/:id', auth, requirePermission('manage_broadcasts'), async (req, res) => {
  try {
    const wsId = await getWorkspaceId(req.user.id)
    const current = await pool.query(
      `SELECT id, status FROM broadcasts WHERE id=$1 AND workspace_id=$2`,
      [req.params.id, wsId]
    )
    if (!current.rows.length) return res.status(404).json({ error: 'Broadcast not found' })
    if (current.rows[0].status !== 'draft') {
      return res.status(409).json({ error: `Cannot edit a broadcast in status "${current.rows[0].status}". Only drafts can be edited.` })
    }
    const {
      name, template_id, phone_number_id, variables, target_filters, scheduled_at,
      quiet_hours_enabled, quiet_hours_start_hour, quiet_hours_end_hour,
      force_send_outside_hours, consecutive_fail_limit
    } = req.body
    // Validate quiet hours range if provided
    if (quiet_hours_start_hour !== undefined && (quiet_hours_start_hour < 0 || quiet_hours_start_hour > 23)) {
      return res.status(400).json({ error: 'quiet_hours_start_hour must be 0-23' })
    }
    if (quiet_hours_end_hour !== undefined && (quiet_hours_end_hour < 0 || quiet_hours_end_hour > 23)) {
      return res.status(400).json({ error: 'quiet_hours_end_hour must be 0-23' })
    }
    if (consecutive_fail_limit !== undefined && consecutive_fail_limit < 1) {
      return res.status(400).json({ error: 'consecutive_fail_limit must be at least 1' })
    }
    // Re-validate template if changed
    if (template_id !== undefined && template_id !== null) {
      const tpl = await pool.query(
        `SELECT id, status FROM templates WHERE id=$1 AND workspace_id=$2`,
        [template_id, wsId]
      )
      if (!tpl.rows.length) return res.status(404).json({ error: 'Template not found in your workspace' })
      if (tpl.rows[0].status !== 'approved') {
        return res.status(400).json({ error: 'Only approved templates can be broadcast.' })
      }
    }
    // Re-validate phone if changed
    if (phone_number_id !== undefined && phone_number_id !== null) {
      const ph = await pool.query(
        `SELECT id FROM phone_numbers WHERE id=$1 AND workspace_id=$2`,
        [phone_number_id, wsId]
      )
      if (!ph.rows.length) return res.status(404).json({ error: 'Phone number not found in your workspace' })
    }
    // Build dynamic SET clause from provided fields
    const sets = []
    const params = []
    let p = 1
    if (name !== undefined) { sets.push(`name = $${p++}`); params.push(name.trim()) }
    if (template_id !== undefined) { sets.push(`template_id = $${p++}`); params.push(template_id) }
    if (phone_number_id !== undefined) { sets.push(`phone_number_id = $${p++}`); params.push(phone_number_id) }
    if (variables !== undefined) { sets.push(`variables = $${p++}`); params.push(JSON.stringify(variables)) }
    if (target_filters !== undefined) { sets.push(`target_filters = $${p++}`); params.push(JSON.stringify(target_filters)) }
    if (scheduled_at !== undefined) { sets.push(`scheduled_at = $${p++}`); params.push(scheduled_at) }
    if (quiet_hours_enabled !== undefined) { sets.push(`quiet_hours_enabled = $${p++}`); params.push(quiet_hours_enabled) }
    if (quiet_hours_start_hour !== undefined) { sets.push(`quiet_hours_start_hour = $${p++}`); params.push(quiet_hours_start_hour) }
    if (quiet_hours_end_hour !== undefined) { sets.push(`quiet_hours_end_hour = $${p++}`); params.push(quiet_hours_end_hour) }
    if (force_send_outside_hours !== undefined) { sets.push(`force_send_outside_hours = $${p++}`); params.push(force_send_outside_hours) }
    if (consecutive_fail_limit !== undefined) { sets.push(`consecutive_fail_limit = $${p++}`); params.push(consecutive_fail_limit) }
    if (sets.length === 0) {
      return res.status(400).json({ error: 'No fields to update' })
    }
    sets.push(`updated_at = NOW()`)
    params.push(req.params.id, wsId)
    const r = await pool.query(
      `UPDATE broadcasts SET ${sets.join(', ')} WHERE id=$${p++} AND workspace_id=$${p++} RETURNING *`,
      params
    )
    res.json(r.rows[0])
  } catch (err) {
    console.error('PATCH /broadcasts/:id error:', err)
    res.status(500).json({ error: err.message })
  }
})
// Hard delete. Director-only by policy: even an empty draft is intent +
// audit trail. Managers should use cancel (v3) instead. Recipient rows
// cascade-delete via FK.
app.delete('/broadcasts/:id', auth, requirePermission('manage_broadcasts'), async (req, res) => {
  try {
    if (req.user.role !== 'director') {
      return res.status(403).json({ error: 'Only directors can delete broadcasts. Use cancel to stop a broadcast in flight.' })
    }
    const wsId = await getWorkspaceId(req.user.id)
    const current = await pool.query(
      `SELECT id, status FROM broadcasts WHERE id=$1 AND workspace_id=$2`,
      [req.params.id, wsId]
    )
    if (!current.rows.length) return res.status(404).json({ error: 'Broadcast not found' })
    if (current.rows[0].status !== 'draft') {
      return res.status(409).json({ error: `Cannot delete a broadcast in status "${current.rows[0].status}". Only drafts can be deleted.` })
    }
    await pool.query(`DELETE FROM broadcasts WHERE id=$1 AND workspace_id=$2`, [req.params.id, wsId])
    res.json({ success: true })
  } catch (err) {
    console.error('DELETE /broadcasts/:id error:', err)
    res.status(500).json({ error: err.message })
  }
})

// Bulk-add recipients to a draft broadcast. Replaces any existing recipients
// (idempotent for the composer's "save and continue" flow). Server-side PDPA
// filtering: contacts with opted_out=true or dnc=true are auto-skipped with
// the reason recorded. Contacts without phone are also skipped. This endpoint
// only works on drafts; once scheduled, recipients are locked.
app.post('/broadcasts/:id/recipients', auth, requirePermission('manage_broadcasts'), async (req, res) => {
  const client = await pool.connect()
  try {
    const wsId = await getWorkspaceId(req.user.id)
    const { contact_ids, per_recipient_variables } = req.body
    if (!Array.isArray(contact_ids)) {
      return res.status(400).json({ error: 'contact_ids must be an array' })
    }
    // Verify broadcast belongs to this workspace and is editable
    const bcheck = await client.query(
      `SELECT id, status FROM broadcasts WHERE id=$1 AND workspace_id=$2`,
      [req.params.id, wsId]
    )
    if (!bcheck.rows.length) return res.status(404).json({ error: 'Broadcast not found' })
    if (bcheck.rows[0].status !== 'draft') {
      return res.status(409).json({ error: 'Recipients can only be modified on draft broadcasts' })
    }
    await client.query('BEGIN')
    // Wipe existing recipients (idempotent re-save)
    await client.query(`DELETE FROM broadcast_recipients WHERE broadcast_id=$1`, [req.params.id])
    if (contact_ids.length === 0) {
      await client.query(
        `UPDATE broadcasts SET recipient_count=0, updated_at=NOW() WHERE id=$1`,
        [req.params.id]
      )
      await client.query('COMMIT')
      return res.json({ inserted: 0, skipped: 0, total: 0 })
    }
    // Pull all referenced contacts in one query, scoped to workspace.
    // We get back: id, phone, opted_out, dnc, name. Used both for validation
    // and for the skip-reason logic below.
    const contactsResult = await client.query(
      `SELECT id, phone, opted_out, dnc, name
       FROM contacts
       WHERE workspace_id=$1 AND id = ANY($2::int[])`,
      [wsId, contact_ids]
    )
    const contactsById = new Map(contactsResult.rows.map(c => [c.id, c]))
    let inserted = 0, skipped = 0
    const perVars = per_recipient_variables || {}
    for (const cid of contact_ids) {
      const contact = contactsById.get(cid)
      if (!contact) {
        // Contact not in this workspace - silently drop (no row created)
        continue
      }
      let status = 'pending'
      let skippedReason = null
      if (contact.opted_out) {
        status = 'skipped'; skippedReason = 'Contact has opted out of communications'
      } else if (contact.dnc) {
        status = 'skipped'; skippedReason = 'Contact is on Do Not Contact list'
      } else if (!contact.phone || !contact.phone.trim()) {
        status = 'skipped'; skippedReason = 'Contact has no phone number'
      }
      const recipientVars = perVars[cid] || {}
      await client.query(
        `INSERT INTO broadcast_recipients (broadcast_id, workspace_id, contact_id, variables, status, skipped_reason)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [req.params.id, wsId, cid, JSON.stringify(recipientVars), status, skippedReason]
      )
      if (status === 'skipped') skipped++
      else inserted++
    }
    // Update legacy recipient_count for parity with old broadcast schema
    await client.query(
      `UPDATE broadcasts SET recipient_count=$1, updated_at=NOW() WHERE id=$2`,
      [inserted + skipped, req.params.id]
    )
    await client.query('COMMIT')
    res.json({ inserted, skipped, total: inserted + skipped })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('POST /broadcasts/:id/recipients error:', err)
    res.status(500).json({ error: err.message })
  } finally {
    client.release()
  }
})
// Get recipients for a broadcast. Paginated for large lists. Includes contact
// name/phone joined in. Used by the detail view (Chunk D) and the composer's
// "Review" step (Chunk A).
app.get('/broadcasts/:id/recipients', auth, async (req, res) => {
  try {
    const wsId = await getWorkspaceId(req.user.id)
    const limit = Math.min(parseInt(req.query.limit) || 100, 500)
    const offset = parseInt(req.query.offset) || 0
    // Verify broadcast belongs to workspace
    const bcheck = await pool.query(
      `SELECT id FROM broadcasts WHERE id=$1 AND workspace_id=$2`,
      [req.params.id, wsId]
    )
    if (!bcheck.rows.length) return res.status(404).json({ error: 'Broadcast not found' })
    const r = await pool.query(`
      SELECT
        br.id, br.broadcast_id, br.contact_id, br.status, br.sent_at,
        br.failed_reason, br.skipped_reason, br.whatsapp_message_id,
        br.variables, br.created_at,
        c.name AS contact_name, c.phone AS contact_phone, c.type AS contact_type,
        c.pipeline_stage AS contact_pipeline_stage
      FROM broadcast_recipients br
      LEFT JOIN contacts c ON c.id = br.contact_id
      WHERE br.broadcast_id=$1 AND br.workspace_id=$2
      ORDER BY br.id ASC
      LIMIT $3 OFFSET $4
    `, [req.params.id, wsId, limit, offset])
    const totalResult = await pool.query(
      `SELECT COUNT(*)::int AS total FROM broadcast_recipients WHERE broadcast_id=$1`,
      [req.params.id]
    )
    res.json({
      recipients: r.rows,
      total: totalResult.rows[0].total,
      limit, offset
    })
  } catch (err) {
    console.error('GET /broadcasts/:id/recipients error:', err)
    res.status(500).json({ error: err.message })
  }
})
// Transition a draft broadcast to scheduled. Requires that the broadcast has
// a template, a phone_number_id, and at least 1 non-skipped recipient. Worker
// (Chunk C) will pick it up when scheduled_at <= NOW().
app.patch('/broadcasts/:id/schedule', auth, requirePermission('manage_broadcasts'), async (req, res) => {
  try {
    const wsId = await getWorkspaceId(req.user.id)
    const current = await pool.query(`
      SELECT b.*, COALESCE(r.sendable, 0) AS sendable_count
      FROM broadcasts b
      LEFT JOIN (
        SELECT broadcast_id, COUNT(*) FILTER (WHERE status = 'pending') AS sendable
        FROM broadcast_recipients GROUP BY broadcast_id
      ) r ON r.broadcast_id = b.id
      WHERE b.id=$1 AND b.workspace_id=$2
    `, [req.params.id, wsId])
    if (!current.rows.length) return res.status(404).json({ error: 'Broadcast not found' })
    const b = current.rows[0]
    if (b.status !== 'draft') {
      return res.status(409).json({ error: `Cannot schedule a broadcast in status "${b.status}"` })
    }
    if (!b.template_id) {
      return res.status(400).json({ error: 'Cannot schedule: no template selected' })
    }
    if (!b.phone_number_id) {
      return res.status(400).json({ error: 'Cannot schedule: no sender phone number selected' })
    }
    if (parseInt(b.sendable_count) === 0) {
      return res.status(400).json({ error: 'Cannot schedule: no sendable recipients (all are opted-out, DNC, or missing phone)' })
    }
    if (!b.scheduled_at) {
      return res.status(400).json({ error: 'Cannot schedule: no send time set' })
    }
    const r = await pool.query(
      `UPDATE broadcasts SET status='scheduled', updated_at=NOW() WHERE id=$1 AND workspace_id=$2 RETURNING *`,
      [req.params.id, wsId]
    )
    res.json(r.rows[0])
  } catch (err) {
    console.error('PATCH /broadcasts/:id/schedule error:', err)
    res.status(500).json({ error: err.message })
  }
})

// Cancel a broadcast in flight. Allowed transitions: scheduled -> cancelled,
// sending -> cancelled. Pending recipients flip to skipped with a cancellation
// reason. In-flight 'sending' recipients are left as-is (the worker won't
// pick them up again because the broadcast status changed). Sent recipients
// are unchanged - we don't unsend what's gone out.
app.patch('/broadcasts/:id/cancel', auth, requirePermission('manage_broadcasts'), async (req, res) => {
  const client = await pool.connect()
  try {
    const wsId = await getWorkspaceId(req.user.id)
    await client.query('BEGIN')

    const current = await client.query(
      `SELECT id, status, name FROM broadcasts WHERE id=$1 AND workspace_id=$2`,
      [req.params.id, wsId]
    )
    if (!current.rows.length) {
      await client.query('ROLLBACK')
      return res.status(404).json({ error: 'Broadcast not found' })
    }
    const b = current.rows[0]
    if (!['scheduled', 'sending'].includes(b.status)) {
      await client.query('ROLLBACK')
      return res.status(409).json({ error: `Cannot cancel a broadcast in status "${b.status}". Only scheduled or sending broadcasts can be cancelled.` })
    }

    // Mark broadcast cancelled
    const updated = await client.query(
      `UPDATE broadcasts
       SET status='cancelled', cancelled_at=NOW(), cancelled_by=$1, updated_at=NOW()
       WHERE id=$2 AND workspace_id=$3
       RETURNING *`,
      [req.user.id, req.params.id, wsId]
    )

    // Skip all pending recipients with a cancellation reason
    const skipResult = await client.query(
      `UPDATE broadcast_recipients
       SET status='skipped', skipped_reason='Broadcast cancelled by user', updated_at=NOW()
       WHERE broadcast_id=$1 AND status='pending'
       RETURNING id`,
      [req.params.id]
    )

    await client.query('COMMIT')
    res.json({ ...updated.rows[0], cancelled_pending_count: skipResult.rowCount })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('PATCH /broadcasts/:id/cancel error:', err)
    res.status(500).json({ error: err.message })
  } finally {
    client.release()
  }
})
// Retry failed recipients in a broadcast. Resets each failed recipient to
// 'pending' (clearing failed_reason and whatsapp_message_id) and flips the
// broadcast status from 'failed' back to 'scheduled' so the worker re-picks it
// up. Only works on 'failed' or 'completed' broadcasts. Skipped recipients
// (PDPA opt-outs, DNC) are NOT retried because the skip reason is unchanged.
app.post('/broadcasts/:id/retry-failed', auth, requirePermission('manage_broadcasts'), async (req, res) => {
  const client = await pool.connect()
  try {
    const wsId = await getWorkspaceId(req.user.id)
    await client.query('BEGIN')

    const current = await client.query(
      `SELECT id, status, name FROM broadcasts WHERE id=$1 AND workspace_id=$2`,
      [req.params.id, wsId]
    )
    if (!current.rows.length) {
      await client.query('ROLLBACK')
      return res.status(404).json({ error: 'Broadcast not found' })
    }
    const b = current.rows[0]
    if (!['failed', 'completed'].includes(b.status)) {
      await client.query('ROLLBACK')
      return res.status(409).json({ error: `Cannot retry a broadcast in status "${b.status}". Only failed or completed broadcasts can have failed recipients retried.` })
    }

    // Reset failed recipients
    const reset = await client.query(
      `UPDATE broadcast_recipients
       SET status='pending', failed_reason=NULL, whatsapp_message_id=NULL,
           sent_at=NULL, updated_at=NOW()
       WHERE broadcast_id=$1 AND status='failed'
       RETURNING id`,
      [req.params.id]
    )
    if (reset.rowCount === 0) {
      await client.query('ROLLBACK')
      return res.status(400).json({ error: 'No failed recipients to retry' })
    }

    // Flip broadcast status back to scheduled. Clear error_summary so the UI
    // doesn't keep showing the old reason. Bump scheduled_at to NOW() so the
    // worker picks it up on the next poll. Reset started_at and sent_at.
    const updated = await client.query(
      `UPDATE broadcasts
       SET status='scheduled', scheduled_at=NOW(), started_at=NULL, sent_at=NULL,
           error_summary=NULL, updated_at=NOW()
       WHERE id=$1 AND workspace_id=$2
       RETURNING *`,
      [req.params.id, wsId]
    )

    await client.query('COMMIT')
    res.json({ ...updated.rows[0], retried_count: reset.rowCount })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('POST /broadcasts/:id/retry-failed error:', err)
    res.status(500).json({ error: err.message })
  } finally {
    client.release()
  }
})

// ─── SCHEDULED MESSAGES ────────────────────────────────────────────────────────
app.get('/scheduled', auth, async (req, res) => {
  try {
    const wsId = await getWorkspaceId(req.user.id)
    const r = await pool.query(`SELECT s.*, c.name as contact_name, c.phone as contact_phone, u.name as created_by_name, pn.display_name as phone_line FROM scheduled_messages s LEFT JOIN contacts c ON c.id=s.contact_id LEFT JOIN users u ON u.id=s.created_by LEFT JOIN phone_numbers pn ON pn.id=s.phone_number_id WHERE s.workspace_id=$1 ORDER BY s.scheduled_at ASC`, [wsId])
    res.json(r.rows)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.post('/scheduled', auth, requirePermission('manage_scheduled_messages'), async (req, res) => {
  try {
    const wsId = await getWorkspaceId(req.user.id)
    const { conversation_id, contact_id, phone_number_id, channel, template_id, subject, body, variables, buttons, scheduled_at, send_mode, email_to, email_cc, bulk_batch_id } = req.body
    const r = await pool.query(`INSERT INTO scheduled_messages (workspace_id, conversation_id, contact_id, phone_number_id, created_by, channel, template_id, subject, body, variables, buttons, scheduled_at, send_mode, email_to, email_cc, bulk_batch_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`, [wsId, conversation_id, contact_id, phone_number_id, req.user.id, channel || 'whatsapp', template_id, subject, body, JSON.stringify(variables || {}), JSON.stringify(buttons || []), scheduled_at, send_mode || 'scheduled', email_to, email_cc, bulk_batch_id])
    res.json(r.rows[0])
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.patch('/scheduled/:id/cancel', auth, requirePermission('manage_scheduled_messages'), async (req, res) => {
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

app.post('/quick-replies', auth, requirePermission('manage_quick_replies'), async (req, res) => {
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

app.patch('/business-hours', auth, requirePermission('manage_workspace_settings'), async (req, res) => {
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

app.patch('/routing', auth, requirePermission('manage_workspace_settings'), async (req, res) => {
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

app.patch('/security', auth, requirePermission('manage_workspace_settings'), async (req, res) => {
  try {
    const wsId = await getWorkspaceId(req.user.id)
    const { session_timeout_minutes, max_failed_logins, force_password_change, two_factor_required, password_min_length, password_require_special } = req.body
    const r = await pool.query(`UPDATE security_settings SET session_timeout_minutes=$1, max_failed_logins=$2, force_password_change=$3, two_factor_required=$4, password_min_length=$5, password_require_special=$6, updated_at=NOW() WHERE workspace_id=$7 RETURNING *`, [session_timeout_minutes, max_failed_logins, force_password_change, two_factor_required, password_min_length, password_require_special, wsId])
    res.json(r.rows[0])
  } catch (err) { res.status(500).json({ error: err.message }) }
})
// ─── NOTIFICATIONS ─────────────────────────────────────────────────────────
// Per-user notification preferences. Each user has their own toggles
// (workspace setting wouldn't make sense — different agents care about
// different events). Stored as JSONB on users.notification_preferences.
//
// Data shape: { event_key: { in_app: bool, email: bool } }
// Example:    { "sla_breach": { in_app: true, email: true },
//               "new_conversation": { in_app: true, email: false } }
//
// Defaults are applied at the API layer (DEFAULT_PREFS below) so the source
// of truth lives in code, not data — we can change defaults without a
// migration. Frontend merges user prefs over defaults to compute display.

const DEFAULT_NOTIFICATION_PREFS = {
  // Conversations — in-app on, email off (most agents don't want email spam)
  new_conversation:        { in_app: true,  email: false },
  conversation_reassigned: { in_app: true,  email: false },
  message_received:        { in_app: true,  email: false },
  watching_message:        { in_app: true,  email: false },
  // SLA — breaches get email by default because they're urgent
  sla_warning:             { in_app: true,  email: false },
  sla_breach:              { in_app: true,  email: true  },
  escalation:              { in_app: true,  email: false },
  // Broadcasts — failures get email, success in-app only
  broadcast_sent:          { in_app: true,  email: false },
  broadcast_failed:        { in_app: true,  email: true  },
  // Scheduled
  scheduled_sent:          { in_app: true,  email: false },
  scheduled_failed:        { in_app: true,  email: true  },
  // Team
  new_agent:               { in_app: true,  email: false },
  agent_offline:           { in_app: true,  email: false },
  // CRM & Compliance
  placement_logged:        { in_app: true,  email: false },
  pdpa_expiring:           { in_app: true,  email: true  },
}

app.get('/notification-preferences', auth, async (req, res) => {
  try {
    const r = await pool.query(
      'SELECT notification_preferences FROM users WHERE id=$1',
      [req.user.id]
    )
    const stored = r.rows[0]?.notification_preferences || {}
    // Merge stored prefs over defaults so frontend always gets a complete map.
    // User-customized values win; un-customized events fall back to defaults.
    const merged = {}
    for (const eventKey of Object.keys(DEFAULT_NOTIFICATION_PREFS)) {
      merged[eventKey] = {
        ...DEFAULT_NOTIFICATION_PREFS[eventKey],
        ...(stored[eventKey] || {})
      }
    }
    res.json(merged)
  } catch (err) {
    console.error('GET /notifications error:', err)
    res.status(500).json({ error: err.message })
  }
})

app.patch('/notification-preferences', auth, async (req, res) => {
  try {
    const prefs = req.body
    if (!prefs || typeof prefs !== 'object' || Array.isArray(prefs)) {
      return res.status(400).json({ error: 'Request body must be a preferences object' })
    }
    // Sanitize — only accept known event keys, only accept boolean values for
    // in_app/email channels. Anything else is silently dropped to prevent
    // arbitrary data from being written into the JSONB column.
    const sanitized = {}
    for (const eventKey of Object.keys(DEFAULT_NOTIFICATION_PREFS)) {
      if (!Object.prototype.hasOwnProperty.call(prefs, eventKey)) continue
      const channels = prefs[eventKey] || {}
      sanitized[eventKey] = {
        in_app: typeof channels.in_app === 'boolean' ? channels.in_app : DEFAULT_NOTIFICATION_PREFS[eventKey].in_app,
        email: typeof channels.email === 'boolean' ? channels.email : DEFAULT_NOTIFICATION_PREFS[eventKey].email,
      }
    }
    await pool.query(
      'UPDATE users SET notification_preferences=$1, updated_at=NOW() WHERE id=$2',
      [JSON.stringify(sanitized), req.user.id]
    )
    res.json({ success: true, preferences: sanitized })
  } catch (err) {
    console.error('PATCH /notifications error:', err)
    res.status(500).json({ error: err.message })
  }
})
// ─── EMAIL SETTINGS ────────────────────────────────────────────────────────
// Workspace-level email integration settings. The Outlook OAuth connection
// state lives on the workspaces table (alongside whatsapp_token etc.) — this
// table is for behavioural settings: sender name, reply-to, send mode,
// blackout window, default signature.
//
// One row per workspace, backfilled at migration time (chunk_20). GET always
// returns the row (defaults applied at column level), so frontend never has
// to handle "no settings yet" state.

app.get('/email-settings', auth, async (req, res) => {
  try {
    const wsId = await getWorkspaceId(req.user.id)
    const r = await pool.query('SELECT * FROM email_settings WHERE workspace_id=$1', [wsId])
    if (r.rows.length === 0) {
      // Defensive: should never happen due to migration backfill, but if a
      // workspace was created after migration ran, insert defaults now.
      await pool.query('INSERT INTO email_settings (workspace_id) VALUES ($1)', [wsId])
      const r2 = await pool.query('SELECT * FROM email_settings WHERE workspace_id=$1', [wsId])
      return res.json(r2.rows[0])
    }
    res.json(r.rows[0])
  } catch (err) {
    console.error('GET /email-settings error:', err)
    res.status(500).json({ error: err.message })
  }
})

app.patch('/email-settings', auth, requirePermission('manage_workspace_settings'), async (req, res) => {
  try {
    const wsId = await getWorkspaceId(req.user.id)

    // Whitelist updateable fields. Same partial-update pattern as
    // PATCH /workspace and PATCH /agents/:id — partial body must work
    // without nulling unspecified fields.
    const ALLOWED = [
      'sender_name', 'reply_to', 'send_mode',
      'blackout_start', 'blackout_end',
      'default_signature', 'open_tracking', 'bounce_alerts'
    ]

    const updates = []
    const values = []
    let idx = 1
    for (const field of ALLOWED) {
      if (!Object.prototype.hasOwnProperty.call(req.body, field)) continue

      let val = req.body[field]
      // send_mode validation — only accept known values
      if (field === 'send_mode' && val !== 'manual' && val !== 'immediate') {
        return res.status(400).json({ error: `Invalid send_mode: must be "manual" or "immediate"` })
      }
      // blackout times: validate HH:MM format if provided
      if ((field === 'blackout_start' || field === 'blackout_end') && val) {
        if (!/^\d{2}:\d{2}$/.test(val)) {
          return res.status(400).json({ error: `${field} must be in HH:MM format` })
        }
      }
      // Reply-to email validation if provided and non-empty
      if (field === 'reply_to' && val && val.trim() && !/\S+@\S+\.\S+/.test(val)) {
        return res.status(400).json({ error: 'Reply-to address must be a valid email' })
      }

      updates.push(`${field}=$${idx++}`)
      values.push(val)
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields provided to update' })
    }

    updates.push(`updated_at=NOW()`)
    values.push(wsId)
    const sql = `UPDATE email_settings SET ${updates.join(', ')} WHERE workspace_id=$${idx} RETURNING *`
    const r = await pool.query(sql, values)
    res.json(r.rows[0])
  } catch (err) {
    console.error('PATCH /email-settings error:', err)
    res.status(500).json({ error: err.message })
  }
})
// ─── PDPA RECORDS ──────────────────────────────────────────────────────────
// Singapore PDPA compliance: every contact's consent state needs an audit
// trail (when given, when withdrawn, by whom, through what channel). The
// pdpa_records table is append-only history; latest row per contact is the
// effective consent state.
//
// Status values:
//   - 'pending'    : created but not yet acted on (rare, default)
//   - 'consented'  : active consent, valid until expires_at
//   - 'withdrawn'  : contact has withdrawn consent
//   - 'expired'    : consent expired without renewal
//
// Method values: 'manual' | 'inbound_whatsapp' | 'csv_import' | 'web_form'
// | 'verbal' (with notes). Free-form to support future channels.
//
// Default consent validity: 24 months. Singapore PDPA has no statutory
// expiry but industry practice for recruitment is 12-24 months.
const DEFAULT_CONSENT_MONTHS = 24

// Aggregate dashboard stats for the workspace.
// One query that returns counts grouped by effective consent status.
// "Effective" means the latest record per contact; we use a window function
// to pick the newest record per contact_id and group from there.
app.get('/pdpa/dashboard', auth, async (req, res) => {
  try {
    const wsId = await getWorkspaceId(req.user.id)
    const r = await pool.query(`
      WITH latest AS (
        SELECT DISTINCT ON (contact_id)
          contact_id, status, expires_at, withdrawn_at
        FROM pdpa_records
        WHERE workspace_id = $1
        ORDER BY contact_id, created_at DESC
      ),
      classified AS (
        SELECT
          CASE
            WHEN status = 'withdrawn' THEN 'withdrawn'
            WHEN status = 'expired' THEN 'expired'
            WHEN status = 'consented' AND expires_at IS NOT NULL AND expires_at < NOW() THEN 'expired'
            WHEN status = 'consented' AND expires_at IS NOT NULL AND expires_at < NOW() + INTERVAL '30 days' THEN 'expiring'
            WHEN status = 'consented' THEN 'consented'
            ELSE 'pending'
          END AS effective_status
        FROM latest
      )
      SELECT
        COUNT(*) FILTER (WHERE effective_status = 'consented')   AS consented,
        COUNT(*) FILTER (WHERE effective_status = 'expiring')    AS expiring,
        COUNT(*) FILTER (WHERE effective_status = 'expired')     AS expired,
        COUNT(*) FILTER (WHERE effective_status = 'withdrawn')   AS withdrawn,
        COUNT(*) FILTER (WHERE effective_status = 'pending')     AS pending,
        (SELECT COUNT(*) FROM contacts WHERE workspace_id = $1)  AS total_contacts
      FROM classified
    `, [wsId])
    const row = r.rows[0] || {}
    // Postgres returns counts as strings (BIGINT) — coerce to number for the API
    res.json({
      consented:      parseInt(row.consented      || 0),
      expiring:       parseInt(row.expiring       || 0),
      expired:        parseInt(row.expired        || 0),
      withdrawn:      parseInt(row.withdrawn      || 0),
      pending:        parseInt(row.pending        || 0),
      total_contacts: parseInt(row.total_contacts || 0),
      // "Not consented" = total minus everything that has a record
      not_consented:  parseInt(row.total_contacts || 0)
                    - parseInt(row.consented || 0)
                    - parseInt(row.expiring || 0)
                    - parseInt(row.expired || 0)
                    - parseInt(row.withdrawn || 0)
                    - parseInt(row.pending || 0),
    })
  } catch (err) {
    console.error('GET /pdpa/dashboard error:', err)
    res.status(500).json({ error: err.message })
  }
})

// List all contacts with their effective PDPA status.
// Returns a row per contact (not per record) — this is the dashboard list.
app.get('/pdpa/contacts', auth, async (req, res) => {
  try {
    const wsId = await getWorkspaceId(req.user.id)
    const r = await pool.query(`
      SELECT
        c.id, c.name, c.phone, c.email, c.type, c.pipeline_stage,
        latest.status AS pdpa_status,
        latest.method AS pdpa_method,
        latest.consented_at,
        latest.expires_at,
        latest.withdrawn_at,
        u.name AS collected_by_name,
        CASE
          WHEN latest.status IS NULL THEN 'not_consented'
          WHEN latest.status = 'withdrawn' THEN 'withdrawn'
          WHEN latest.status = 'expired' THEN 'expired'
          WHEN latest.status = 'consented' AND latest.expires_at IS NOT NULL AND latest.expires_at < NOW() THEN 'expired'
          WHEN latest.status = 'consented' AND latest.expires_at IS NOT NULL AND latest.expires_at < NOW() + INTERVAL '30 days' THEN 'expiring'
          WHEN latest.status = 'consented' THEN 'consented'
          ELSE 'pending'
        END AS effective_status
      FROM contacts c
      LEFT JOIN LATERAL (
        SELECT * FROM pdpa_records r
        WHERE r.contact_id = c.id AND r.workspace_id = $1
        ORDER BY r.created_at DESC
        LIMIT 1
      ) latest ON TRUE
      LEFT JOIN users u ON u.id = latest.collected_by
      WHERE c.workspace_id = $1
      ORDER BY c.updated_at DESC
    `, [wsId])
    res.json(r.rows)
  } catch (err) {
    console.error('GET /pdpa/contacts error:', err)
    res.status(500).json({ error: err.message })
  }
})

// Full consent history for one contact (newest first).
app.get('/pdpa/contacts/:id/history', auth, async (req, res) => {
  try {
    const wsId = await getWorkspaceId(req.user.id)
    const r = await pool.query(`
      SELECT r.*, u.name AS collected_by_name
      FROM pdpa_records r
      LEFT JOIN users u ON u.id = r.collected_by
      WHERE r.contact_id = $1 AND r.workspace_id = $2
      ORDER BY r.created_at DESC
    `, [req.params.id, wsId])
    res.json(r.rows)
  } catch (err) {
    console.error('GET /pdpa/contacts/:id/history error:', err)
    res.status(500).json({ error: err.message })
  }
})

// Record a new PDPA event. Append-only — never updates existing records.
// Director or anyone with manage_pdpa permission can record.
app.post('/pdpa/records', auth, requirePermission('manage_pdpa'), async (req, res) => {
  try {
    const wsId = await getWorkspaceId(req.user.id)
    const { contact_id, status, method, notes, expires_in_months } = req.body

    // Validation
    if (!contact_id) {
      return res.status(400).json({ error: 'contact_id is required' })
    }
    const validStatuses = ['pending', 'consented', 'withdrawn', 'expired']
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${validStatuses.join(', ')}` })
    }

    // Verify the contact actually belongs to this workspace before writing
    const contactCheck = await pool.query(
      'SELECT id FROM contacts WHERE id = $1 AND workspace_id = $2',
      [contact_id, wsId]
    )
    if (contactCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Contact not found in this workspace' })
    }

    // Compute timestamps based on status
    const now = new Date()
    let consented_at = null
    let withdrawn_at = null
    let expires_at = null

    if (status === 'consented') {
      consented_at = now
      const months = parseInt(expires_in_months) || DEFAULT_CONSENT_MONTHS
      expires_at = new Date(now)
      expires_at.setMonth(expires_at.getMonth() + months)
    } else if (status === 'withdrawn') {
      withdrawn_at = now
    }

    const r = await pool.query(`
      INSERT INTO pdpa_records
        (workspace_id, contact_id, status, method, consented_at, expires_at, withdrawn_at, collected_by, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [wsId, contact_id, status, method || 'manual', consented_at, expires_at, withdrawn_at, req.user.id, notes || null])

    // Sync the contacts.pdpa_consented flag for backwards compatibility with
    // existing UI that reads it directly (Contacts list, broadcasts safety).
    const pdpaConsented = status === 'consented'
    await pool.query(
      `UPDATE contacts SET pdpa_consented = $1, pdpa_consented_at = $2 WHERE id = $3 AND workspace_id = $4`,
      [pdpaConsented, pdpaConsented ? now : null, contact_id, wsId]
    )

    res.json(r.rows[0])
  } catch (err) {
    console.error('POST /pdpa/records error:', err)
    res.status(500).json({ error: err.message })
  }
})

// CSV export of all PDPA records for the workspace. Used for compliance
// audits — Director can produce this on demand for PDPC inspection.
// Returns text/csv with content-disposition so the browser downloads it
// rather than rendering inline.
//
// CSV escaping: any field containing a comma, quote, or newline is
// double-quoted, with internal quotes doubled. This is the RFC 4180
// standard and what Excel / Google Sheets expect.
function csvEscape(value) {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (/[",\n\r]/.test(str)) {
    return '"' + str.replace(/"/g, '""') + '"'
  }
  return str
}

app.get('/pdpa/export', auth, requirePermission('manage_pdpa'), async (req, res) => {
  try {
    const wsId = await getWorkspaceId(req.user.id)
    const r = await pool.query(`
      SELECT
        c.id AS contact_id,
        c.name AS contact_name,
        c.phone AS contact_phone,
        c.email AS contact_email,
        p.id AS record_id,
        p.status,
        p.method,
        p.consented_at,
        p.expires_at,
        p.withdrawn_at,
        u.name AS collected_by_name,
        p.notes,
        p.created_at
      FROM pdpa_records p
      JOIN contacts c ON c.id = p.contact_id
      LEFT JOIN users u ON u.id = p.collected_by
      WHERE p.workspace_id = $1
      ORDER BY c.name ASC, p.created_at DESC
    `, [wsId])

    const headers = [
      'Contact ID', 'Contact Name', 'Contact Phone', 'Contact Email',
      'Record ID', 'Status', 'Method',
      'Consented At', 'Expires At', 'Withdrawn At',
      'Recorded By', 'Notes', 'Created At'
    ]
    const lines = [headers.join(',')]

    // Format timestamps in ISO 8601 with the SGT offset for unambiguous
    // audit reading. PDPC inspectors will be in Singapore, so SGT is the
    // expected reference frame.
    function fmt(ts) {
      if (!ts) return ''
      const d = new Date(ts)
      // toISOString gives UTC; convert to SGT (+08:00) for display
      const utc = d.getTime()
      const sgt = new Date(utc + 8 * 60 * 60 * 1000)
      return sgt.toISOString().replace('Z', '+08:00')
    }

    for (const row of r.rows) {
      lines.push([
        csvEscape(row.contact_id),
        csvEscape(row.contact_name),
        csvEscape(row.contact_phone),
        csvEscape(row.contact_email),
        csvEscape(row.record_id),
        csvEscape(row.status),
        csvEscape(row.method),
        csvEscape(fmt(row.consented_at)),
        csvEscape(fmt(row.expires_at)),
        csvEscape(fmt(row.withdrawn_at)),
        csvEscape(row.collected_by_name),
        csvEscape(row.notes),
        csvEscape(fmt(row.created_at)),
      ].join(','))
    }

    const csv = lines.join('\r\n')
    const today = new Date().toISOString().slice(0, 10)
    const wsName = await pool.query('SELECT name FROM workspaces WHERE id = $1', [wsId])
    const safeName = (wsName.rows[0]?.name || 'workspace').replace(/[^a-zA-Z0-9-_]/g, '_')

    // BOM prefix so Excel opens the file with UTF-8 encoding (otherwise it
    // defaults to system charset and mangles non-ASCII characters in notes)
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="pdpa-records_${safeName}_${today}.csv"`)
    res.send('\uFEFF' + csv)
  } catch (err) {
    console.error('GET /pdpa/export error:', err)
    res.status(500).json({ error: err.message })
  }
})

// ─── CALENDAR ──────────────────────────────────────────────────────────────

// ─── REMINDER HELPERS (Phase 4) ─────────────────────────────────────────────

// Compute the reminder send time from event_date + event_time + offset_hours.
// If event has no time, treats it as 09:00 SGT (start of business day).
// Returns a JS Date object (in UTC, ready for DB INSERT).
//
// IMPORTANT: pg driver converts DATE columns to JS Date at local midnight,
// which means .toISOString() shifts the date by the server's timezone offset.
// We avoid this by extracting date components from local-time accessors when
// the input is a Date object, or string-slicing when the input is a string.
function computeReminderSendTime(event_date, event_time, offset_hours) {
  let dateStr
  if (typeof event_date === 'string') {
    dateStr = event_date.slice(0, 10)
  } else {
    // Date object from pg - read local-time components, NOT UTC
    const d = event_date instanceof Date ? event_date : new Date(event_date)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    dateStr = `${y}-${m}-${day}`
  }
  const timeStr = event_time ? String(event_time).slice(0, 5) : '09:00'
  // Construct as SGT (UTC+8) - Singapore timezone
  const eventDateTime = new Date(`${dateStr}T${timeStr}:00+08:00`)
  // Subtract offset hours
  return new Date(eventDateTime.getTime() - (offset_hours * 60 * 60 * 1000))
}

// Resolves and renders the reminder message body using current event data and template.
// Reads template variables, applies event_field_map auto-fill, renders {{name}} placeholders.
// Returns the final text string ready to send.
async function renderReminderBody(client, eventId, templateId, contactName) {
  const evRes = await client.query(
    `SELECT ce.*, ct.name as contact_name
     FROM calendar_events ce
     LEFT JOIN contacts ct ON ct.id = ce.contact_id
     WHERE ce.id = $1`,
    [eventId]
  )
  if (evRes.rows.length === 0) throw new Error('Event not found')
  const ev = evRes.rows[0]

  const tplRes = await client.query(`SELECT body, variables FROM templates WHERE id = $1`, [templateId])
  if (tplRes.rows.length === 0) throw new Error('Template not found')
  const tpl = tplRes.rows[0]
  const ordered = tpl.variables?.ordered || []
  const defaults = tpl.variables?.defaults || {}
  const fieldMap = tpl.variables?.event_field_map || {}

  // Build values: start from defaults, override with event field mapping
  const values = {}
  for (const vname of ordered) {
    values[vname] = defaults[vname] || ''
    const field = fieldMap[vname]
    if (!field) continue
    if (field === 'contact_name') values[vname] = contactName || ev.contact_name || ''
    else if (field === 'event_date') {
      const d = new Date(ev.event_date)
      values[vname] = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Singapore' })
    }
    else if (field === 'event_time') {
      values[vname] = ev.event_time ? String(ev.event_time).slice(0, 5) : ''
    }
    else if (field === 'location') values[vname] = ev.location || ''
    else if (field === 'event_title') values[vname] = ev.title || ''
  }

  // Substitute {{name}} and {{1}} (positional) in the body
  return (tpl.body || '').replace(/\{\{\s*(\w+)\s*\}\}/g, (match, vname) => {
    if (values[vname] !== undefined && values[vname] !== '') return values[vname]
    if (/^\d+$/.test(vname)) {
      const idx = parseInt(vname) - 1
      const mapped = ordered[idx]
      if (mapped && values[mapped] !== undefined && values[mapped] !== '') return values[mapped]
    }
    return match
  })
}

// Cancels an active reminder for an event by:
// 1. Marking the scheduled_message as 'cancelled'
// 2. Marking the event_reminders row as 'cancelled'
// Idempotent — does nothing if no active reminder exists.
async function cancelReminderForEvent(client, eventId) {
  const reminderRes = await client.query(
    `SELECT id, scheduled_message_id FROM event_reminders WHERE event_id = $1 AND status = 'active' LIMIT 1`,
    [eventId]
  )
  if (reminderRes.rows.length === 0) return null
  const reminder = reminderRes.rows[0]
  // Cancel the queued scheduled_message (only if still pending)
  await client.query(
    `UPDATE scheduled_messages SET status = 'cancelled' WHERE id = $1 AND status = 'pending'`,
    [reminder.scheduled_message_id]
  )
  await client.query(
    `UPDATE event_reminders SET status = 'cancelled', updated_at = NOW() WHERE id = $1`,
    [reminder.id]
  )
  return reminder.id
}

// Re-queues an existing reminder against an updated event. Used by PATCH /calendar/:id
// when the event date or time changes. Cancels the old reminder + creates a new one
// with the same template and offset, but a fresh send time.
// Returns the new reminder id, or null if no active reminder existed.
async function requeueReminderForEvent(client, eventId, wsId) {
  const reminderRes = await client.query(
    `SELECT er.template_id, er.offset_hours, er.created_by, sm.conversation_id, sm.contact_id, sm.phone_number_id
     FROM event_reminders er
     JOIN scheduled_messages sm ON sm.id = er.scheduled_message_id
     WHERE er.event_id = $1 AND er.status = 'active'
     LIMIT 1`,
    [eventId]
  )
  if (reminderRes.rows.length === 0) return null
  const old = reminderRes.rows[0]

  // Cancel the old one
  await cancelReminderForEvent(client, eventId)

  // Get fresh event data to compute new send time
  const evRes = await client.query(
    `SELECT ce.event_date, ce.event_time, ct.name as contact_name
     FROM calendar_events ce
     LEFT JOIN contacts ct ON ct.id = ce.contact_id
     WHERE ce.id = $1`,
    [eventId]
  )
  if (evRes.rows.length === 0) return null
  const ev = evRes.rows[0]

  const newSendTime = computeReminderSendTime(ev.event_date, ev.event_time, old.offset_hours)

  // Skip re-queue if new send time is in the past (event was rescheduled to imminent)
  if (newSendTime <= new Date()) {
    console.log(`[reminder] Skipping requeue for event ${eventId}: new send time ${newSendTime.toISOString()} is in the past`)
    return null
  }

  // Render fresh body with updated event data
  const renderedBody = await renderReminderBody(client, eventId, old.template_id, ev.contact_name)

  // Insert new scheduled_message
  const smRes = await client.query(
    `INSERT INTO scheduled_messages
       (workspace_id, conversation_id, contact_id, phone_number_id, created_by,
        channel, template_id, body, scheduled_at, send_mode, status)
     VALUES ($1, $2, $3, $4, $5, 'whatsapp', $6, $7, $8, 'scheduled', 'pending')
     RETURNING id`,
    [wsId, old.conversation_id, old.contact_id, old.phone_number_id, old.created_by,
     old.template_id, renderedBody, newSendTime]
  )
  const newSmId = smRes.rows[0].id

  // Insert new event_reminders row linking the new scheduled_message
  const erRes = await client.query(
    `INSERT INTO event_reminders
       (workspace_id, event_id, scheduled_message_id, template_id, offset_hours, status, created_by)
     VALUES ($1, $2, $3, $4, $5, 'active', $6)
     RETURNING id`,
    [wsId, eventId, newSmId, old.template_id, old.offset_hours, old.created_by]
  )
  return erRes.rows[0].id
}

// ─── CALENDAR ENDPOINTS ─────────────────────────────────────────────────────
app.get('/calendar', auth, async (req, res) => {
  try {
    const wsId = await getWorkspaceId(req.user.id)
    const { from, to } = req.query
    let query = `SELECT ce.*, c.name as contact_name, u.name as created_by_name,
                        et.name as event_type_name, et.color_bg as event_type_bg, et.color_fg as event_type_fg
                 FROM calendar_events ce
                 LEFT JOIN contacts c ON c.id=ce.contact_id
                 LEFT JOIN users u ON u.id=ce.created_by
                 LEFT JOIN event_types et ON et.id=ce.event_type_id
                 WHERE ce.workspace_id=$1`
    const params = [wsId]
    if (from) { query += ` AND ce.event_date >= $${params.length + 1}`; params.push(from) }
    if (to) { query += ` AND ce.event_date <= $${params.length + 1}`; params.push(to) }
    if (req.query.conversation_id) { query += ` AND ce.conversation_id = $${params.length + 1}`; params.push(req.query.conversation_id) }
    query += ' ORDER BY ce.event_date ASC, ce.event_time ASC'
    const r = await pool.query(query, params)
    res.json(r.rows)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.post('/calendar', auth, requirePermission('manage_calendar'), async (req, res) => {
  try {
    const wsId = await getWorkspaceId(req.user.id)
    const { conversation_id, contact_id, job_order_id, title, event_date, event_time, location, notes, event_type_id, type } = req.body
    if (!title || !event_date) return res.status(400).json({ error: 'Title and date are required' })
    const r = await pool.query(
      `INSERT INTO calendar_events
       (workspace_id, conversation_id, contact_id, job_order_id, created_by, title, event_date, event_time, location, notes, type, event_type_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [wsId, conversation_id || null, contact_id || null, job_order_id || null, req.user.id, title, event_date, event_time || null, location || null, notes || null, type || 'event', event_type_id || null]
    )
    res.json(r.rows[0])
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// PATCH /calendar/:id — update an event
app.patch('/calendar/:id', auth, requirePermission('manage_calendar'), async (req, res) => {
  const client = await pool.connect()
  try {
    const wsId = await getWorkspaceId(req.user.id)
    const eventId = parseInt(req.params.id)
    const { conversation_id, contact_id, job_order_id, title, event_date, event_time, location, notes, event_type_id } = req.body

    await client.query('BEGIN')

    // Capture pre-update state to detect what changed
    const beforeRes = await client.query(
      `SELECT event_date, event_time, conversation_id FROM calendar_events WHERE id = $1 AND workspace_id = $2`,
      [eventId, wsId]
    )
    if (beforeRes.rows.length === 0) {
      await client.query('ROLLBACK')
      return res.status(404).json({ error: 'Event not found' })
    }
    const before = beforeRes.rows[0]

    // Apply the update
    const r = await client.query(
      `UPDATE calendar_events
       SET conversation_id=COALESCE($1, conversation_id),
           contact_id=COALESCE($2, contact_id),
           job_order_id=COALESCE($3, job_order_id),
           title=COALESCE($4, title),
           event_date=COALESCE($5, event_date),
           event_time=$6,
           location=$7,
           notes=$8,
           event_type_id=COALESCE($9, event_type_id)
       WHERE id=$10 AND workspace_id=$11 RETURNING *`,
      [conversation_id, contact_id, job_order_id, title, event_date, event_time, location, notes, event_type_id, eventId, wsId]
    )
    const updated = r.rows[0]

    // Detect changes that require reminder sync.
    // Date or time changed? -> requeue reminder with new send time.
    // Conversation unlinked? -> cancel reminder (can't send without recipient).
    const dateChanged = event_date !== undefined && String(before.event_date).slice(0, 10) !== String(updated.event_date).slice(0, 10)
    const timeChanged = String(before.event_time || '') !== String(updated.event_time || '')
    const convoUnlinked = before.conversation_id && !updated.conversation_id

    if (convoUnlinked) {
      const cancelledId = await cancelReminderForEvent(client, eventId)
      if (cancelledId) console.log(`[reminder sync] Event ${eventId} conversation unlinked -> reminder cancelled`)
    } else if (dateChanged || timeChanged) {
      const newReminderId = await requeueReminderForEvent(client, eventId, wsId)
      if (newReminderId) console.log(`[reminder sync] Event ${eventId} date/time changed -> reminder requeued (new id ${newReminderId})`)
    }

    await client.query('COMMIT')
    res.json(updated)
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('PATCH /calendar/:id error:', err)
    res.status(500).json({ error: err.message })
  } finally {
    client.release()
  }
})

// DELETE /calendar/:id — delete an event
app.delete('/calendar/:id', auth, requirePermission('manage_calendar'), async (req, res) => {
  try {
    const wsId = await getWorkspaceId(req.user.id)
    const r = await pool.query(
      `DELETE FROM calendar_events WHERE id=$1 AND workspace_id=$2 RETURNING id`,
      [req.params.id, wsId]
    )
    if (r.rows.length === 0) return res.status(404).json({ error: 'Event not found' })
    // CASCADE on event_reminders.event_id handles cleanup of reminder + scheduled_message rows
    res.json({ deleted: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// GET /calendar/:id — single event with linked reminder details if any
app.get('/calendar/:id', auth, async (req, res) => {
  try {
    const wsId = await getWorkspaceId(req.user.id)
    const r = await pool.query(
      `SELECT ce.*, c.name as contact_name, u.name as created_by_name,
              et.name as event_type_name, et.color_bg as event_type_bg, et.color_fg as event_type_fg
       FROM calendar_events ce
       LEFT JOIN contacts c ON c.id=ce.contact_id
       LEFT JOIN users u ON u.id=ce.created_by
       LEFT JOIN event_types et ON et.id=ce.event_type_id
       WHERE ce.id=$1 AND ce.workspace_id=$2`,
      [req.params.id, wsId]
    )
    if (r.rows.length === 0) return res.status(404).json({ error: 'Event not found' })
    const event = r.rows[0]
    // Fetch active reminder if any
    const reminderRes = await pool.query(
      `SELECT er.id, er.template_id, er.offset_hours, er.status,
              t.name as template_name,
              sm.scheduled_at, sm.status as scheduled_message_status
       FROM event_reminders er
       LEFT JOIN templates t ON t.id = er.template_id
       LEFT JOIN scheduled_messages sm ON sm.id = er.scheduled_message_id
       WHERE er.event_id = $1 AND er.status = 'active'
       LIMIT 1`,
      [req.params.id]
    )
    event.reminder = reminderRes.rows[0] || null
    res.json(event)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// POST /calendar/:id/reminder — schedule a reminder for an event
app.post('/calendar/:id/reminder', auth, requirePermission('manage_calendar'), async (req, res) => {
  const client = await pool.connect()
  try {
    const wsId = await getWorkspaceId(req.user.id)
    const eventId = parseInt(req.params.id)
    const { template_id, offset_hours } = req.body

    // Validate input
    if (!template_id) return res.status(400).json({ error: 'template_id is required' })
    if (![3, 12, 24].includes(parseInt(offset_hours))) {
      return res.status(400).json({ error: 'offset_hours must be 3, 12, or 24' })
    }

    await client.query('BEGIN')

    // Load event + verify ownership + verify it has a linked conversation
    const evRes = await client.query(
      `SELECT ce.*, ct.name as contact_name, ct.id as contact_id_resolved,
              c.phone_number_id
       FROM calendar_events ce
       LEFT JOIN conversations c ON c.id = ce.conversation_id
       LEFT JOIN contacts ct ON ct.id = c.contact_id
       WHERE ce.id = $1 AND ce.workspace_id = $2`,
      [eventId, wsId]
    )
    if (evRes.rows.length === 0) {
      await client.query('ROLLBACK')
      return res.status(404).json({ error: 'Event not found' })
    }
    const ev = evRes.rows[0]
    if (!ev.conversation_id) {
      await client.query('ROLLBACK')
      return res.status(400).json({ error: 'Event must have a linked conversation before scheduling a reminder' })
    }

    // Compute send time and check it's not in the past
    const sendTime = computeReminderSendTime(ev.event_date, ev.event_time, parseInt(offset_hours))
    if (sendTime <= new Date()) {
      await client.query('ROLLBACK')
      return res.status(400).json({ error: 'Reminder send time is in the past. Pick a shorter offset or reschedule the event.' })
    }

    // Cancel any existing active reminder (1 reminder per event policy)
    await cancelReminderForEvent(client, eventId)

    // Verify template is approved + workspace-owned
    const tplRes = await client.query(
      `SELECT id, status FROM templates WHERE id = $1 AND workspace_id = $2`,
      [template_id, wsId]
    )
    if (tplRes.rows.length === 0) {
      await client.query('ROLLBACK')
      return res.status(404).json({ error: 'Template not found' })
    }
    if (tplRes.rows[0].status !== 'approved') {
      await client.query('ROLLBACK')
      return res.status(400).json({ error: 'Template must be approved before use in reminder' })
    }

    // Render the body using current event data
    const renderedBody = await renderReminderBody(client, eventId, template_id, ev.contact_name)

    // Insert scheduled_message
    const smRes = await client.query(
      `INSERT INTO scheduled_messages
         (workspace_id, conversation_id, contact_id, phone_number_id, created_by,
          channel, template_id, body, scheduled_at, send_mode, status)
       VALUES ($1, $2, $3, $4, $5, 'whatsapp', $6, $7, $8, 'scheduled', 'pending')
       RETURNING id`,
      [wsId, ev.conversation_id, ev.contact_id_resolved, ev.phone_number_id, req.user.id,
       template_id, renderedBody, sendTime]
    )
    const smId = smRes.rows[0].id

    // Insert event_reminders row
    const erRes = await client.query(
      `INSERT INTO event_reminders
         (workspace_id, event_id, scheduled_message_id, template_id, offset_hours, status, created_by)
       VALUES ($1, $2, $3, $4, $5, 'active', $6)
       RETURNING *`,
      [wsId, eventId, smId, template_id, parseInt(offset_hours), req.user.id]
    )

    await client.query('COMMIT')
    res.json({ ...erRes.rows[0], scheduled_at: sendTime, rendered_body: renderedBody })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('POST /calendar/:id/reminder error:', err)
    res.status(500).json({ error: err.message })
  } finally {
    client.release()
  }
})

// DELETE /calendar/:id/reminder — cancel an active reminder
app.delete('/calendar/:id/reminder', auth, requirePermission('manage_calendar'), async (req, res) => {
  const client = await pool.connect()
  try {
    const wsId = await getWorkspaceId(req.user.id)
    const eventId = parseInt(req.params.id)

    await client.query('BEGIN')

    // Verify event ownership
    const evCheck = await client.query(
      `SELECT id FROM calendar_events WHERE id = $1 AND workspace_id = $2`,
      [eventId, wsId]
    )
    if (evCheck.rows.length === 0) {
      await client.query('ROLLBACK')
      return res.status(404).json({ error: 'Event not found' })
    }

    const cancelledId = await cancelReminderForEvent(client, eventId)
    await client.query('COMMIT')

    if (cancelledId === null) {
      return res.status(404).json({ error: 'No active reminder for this event' })
    }
    res.json({ cancelled: true, reminder_id: cancelledId })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('DELETE /calendar/:id/reminder error:', err)
    res.status(500).json({ error: err.message })
  } finally {
    client.release()
  }
})

// GET /event-types — list event types for current workspace
app.get('/event-types', auth, async (req, res) => {
  try {
    const wsId = await getWorkspaceId(req.user.id)
    const r = await pool.query(
      `SELECT id, name, color_bg, color_fg, sort_order, is_default
       FROM event_types WHERE workspace_id=$1
       ORDER BY sort_order ASC, name ASC`,
      [wsId]
    )
    res.json(r.rows)
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

app.post('/projects', auth, requirePermission('manage_projects'), async (req, res) => {
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

app.patch('/projects/:id', auth, requirePermission('manage_projects'), async (req, res) => {
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

app.delete('/projects/:id', auth, requirePermission('manage_projects'), async (req, res) => {
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

app.patch('/projects/:id/assign-conversations', auth, requirePermission('manage_projects'), async (req, res) => {
  try {
    const wsId = await getWorkspaceId(req.user.id)
    const { conversation_ids } = req.body
    if (!Array.isArray(conversation_ids) || conversation_ids.length === 0) return res.status(400).json({ error: 'conversation_ids array required' })
    await pool.query(`UPDATE conversations SET project_id=$1, updated_at=NOW() WHERE id=ANY($2) AND workspace_id=$3`, [req.params.id, conversation_ids, wsId])
    await logAudit(wsId, req.user.id, 'assign_to_project', 'project', req.params.id, null, { conversation_ids, count: conversation_ids.length })
    res.json({ success: true, assigned: conversation_ids.length })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ─── PROJECT MEMBERS (Session D1 Chunk 4A) ─────────────────────────────────────

// GET /projects/:id/members �?list all members of a project
app.get('/projects/:id/members', auth, async (req, res) => {
  try {
    const wsId = await getWorkspaceId(req.user.id)
    // Confirm project belongs to this workspace (prevents cross-tenant peek)
    const proj = await pool.query('SELECT id FROM projects WHERE id=$1 AND workspace_id=$2', [req.params.id, wsId])
    if (!proj.rows.length) return res.status(404).json({ error: 'Project not found' })

    const r = await pool.query(`
      SELECT pm.project_id, pm.user_id, pm.role_in_project, pm.created_at,
             u.name, u.email, u.role AS user_role, u.active, u.status
      FROM project_members pm
      JOIN users u ON u.id = pm.user_id
      WHERE pm.project_id = $1
      ORDER BY pm.role_in_project DESC, u.name ASC
    `, [req.params.id])
    res.json(r.rows)
  } catch (err) {
    console.error('GET /projects/:id/members error:', err)
    res.status(500).json({ error: err.message })
  }
})

// POST /projects/:id/members �?add a user to a project
// Body: { user_id, role_in_project? }  role default = 'member'
app.post('/projects/:id/members', auth, requirePermission('manage_project_members'), async (req, res) => {
  try {
    const wsId = await getWorkspaceId(req.user.id)
    const { user_id, role_in_project } = req.body
    if (!user_id) return res.status(400).json({ error: 'user_id is required' })
    const role = (role_in_project === 'lead') ? 'lead' : 'member'

    // Confirm project and user both belong to this workspace
    const proj = await pool.query('SELECT id FROM projects WHERE id=$1 AND workspace_id=$2', [req.params.id, wsId])
    if (!proj.rows.length) return res.status(404).json({ error: 'Project not found' })
    const usr = await pool.query('SELECT id FROM users WHERE id=$1 AND workspace_id=$2 AND active=true', [user_id, wsId])
    if (!usr.rows.length) return res.status(404).json({ error: 'User not found in this workspace' })

    // Upsert (allows re-adding with a different role)
    const r = await pool.query(`
      INSERT INTO project_members (project_id, user_id, role_in_project)
      VALUES ($1, $2, $3)
      ON CONFLICT (project_id, user_id) DO UPDATE SET role_in_project = EXCLUDED.role_in_project
      RETURNING *
    `, [req.params.id, user_id, role])

    await logAudit(wsId, req.user.id, 'add_project_member', 'project', req.params.id, null, { user_id, role })
    res.json(r.rows[0])
  } catch (err) {
    console.error('POST /projects/:id/members error:', err)
    res.status(500).json({ error: err.message })
  }
})

// PATCH /projects/:id/members/:userId �?change a member's role
// Body: { role_in_project: 'member' | 'lead' }
app.patch('/projects/:id/members/:userId', auth, requirePermission('manage_project_members'), async (req, res) => {
  try {
    const wsId = await getWorkspaceId(req.user.id)
    const { role_in_project } = req.body
    if (!['member', 'lead'].includes(role_in_project)) {
      return res.status(400).json({ error: "role_in_project must be 'member' or 'lead'" })
    }

    const proj = await pool.query('SELECT id FROM projects WHERE id=$1 AND workspace_id=$2', [req.params.id, wsId])
    if (!proj.rows.length) return res.status(404).json({ error: 'Project not found' })

    const r = await pool.query(`
      UPDATE project_members SET role_in_project=$1
      WHERE project_id=$2 AND user_id=$3 RETURNING *
    `, [role_in_project, req.params.id, req.params.userId])

    if (!r.rows.length) return res.status(404).json({ error: 'Member not found' })
    await logAudit(wsId, req.user.id, 'update_project_member', 'project', req.params.id, null, { user_id: req.params.userId, role_in_project })
    res.json(r.rows[0])
  } catch (err) {
    console.error('PATCH /projects/:id/members/:userId error:', err)
    res.status(500).json({ error: err.message })
  }
})

// DELETE /projects/:id/members/:userId �?remove from project
app.delete('/projects/:id/members/:userId', auth, requirePermission('manage_project_members'), async (req, res) => {
  try {
    const wsId = await getWorkspaceId(req.user.id)
    const proj = await pool.query('SELECT id FROM projects WHERE id=$1 AND workspace_id=$2', [req.params.id, wsId])
    if (!proj.rows.length) return res.status(404).json({ error: 'Project not found' })

    const r = await pool.query(
      `DELETE FROM project_members WHERE project_id=$1 AND user_id=$2 RETURNING *`,
      [req.params.id, req.params.userId]
    )
    if (!r.rows.length) return res.status(404).json({ error: 'Member not found' })
    await logAudit(wsId, req.user.id, 'remove_project_member', 'project', req.params.id, null, { user_id: req.params.userId })
    res.json({ success: true })
  } catch (err) {
    console.error('DELETE /projects/:id/members/:userId error:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET /my-projects �?returns the current user's project memberships + project details
// Used later in Chunk 4B to scope consultant views
app.get('/my-projects', auth, async (req, res) => {
  try {
    const wsId = await getWorkspaceId(req.user.id)
    const r = await pool.query(`
      SELECT p.*, pm.role_in_project
      FROM project_members pm
      JOIN projects p ON p.id = pm.project_id
      WHERE pm.user_id = $1 AND p.workspace_id = $2
      ORDER BY p.status ASC, p.created_at DESC
    `, [req.user.id, wsId])
    res.json(r.rows)
  } catch (err) {
    console.error('GET /my-projects error:', err)
    res.status(500).json({ error: err.message })
  }
})

app.patch('/conversations/:id/project', auth, requirePermission('manage_conversations'), async (req, res) => {
  try {
    const access = await getAccessibleProjects(req)
    const { project_id } = req.body

    // Scoped users can only move conversations within their accessible projects
    // (and the target project must also be accessible to them)
    if (!access.workspaceWide) {
      if (project_id !== null && project_id !== undefined && !access.projectIds.includes(project_id)) {
        return res.status(403).json({ error: 'You do not have access to the target project' })
      }
    }

    let sql = `UPDATE conversations SET project_id=$1, updated_at=NOW() WHERE id=$2 AND workspace_id=$3`
    const params = [project_id, req.params.id, access.workspaceId]
    if (!access.workspaceWide) {
      sql += ` AND project_id = ANY($4::int[])`
      params.push(access.projectIds)
    }
    sql += ` RETURNING *`

    const r = await pool.query(sql, params)
    if (!r.rows.length) return res.status(404).json({ error: 'Conversation not found or not accessible' })
    res.json(r.rows[0])
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ─── PIN MESSAGES ──────────────────────────────────────────────────────────────
app.patch('/messages/:id/pin', auth, requirePermission('manage_conversations'), async (req, res) => {
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
    const access = await getAccessibleProjects(req)
    const q = (req.query.q || '').trim()
    if (!q || q.length < 2) return res.json({ results: [] })
    const searchLike = `%${q}%`

    let sql = `SELECT m.id as message_id, m.text, m.direction, m.created_at, m.conversation_id,
              ct.name as contact_name, ct.phone as contact_phone, ct.type as contact_type,
              c.status as conversation_status
       FROM messages m
       JOIN conversations c ON c.id = m.conversation_id
       JOIN contacts ct ON ct.id = c.contact_id
       WHERE m.workspace_id = $1
         AND (m.text ILIKE $2 OR ct.name ILIKE $2 OR ct.phone ILIKE $2)`
    const params = [access.workspaceId, searchLike]

    // Scope by project_id on the conversation
    if (!access.workspaceWide) {
      sql += ` AND c.project_id = ANY($3::int[])`
      params.push(access.projectIds)
    }

    sql += ` ORDER BY m.created_at DESC LIMIT 30`

    const r = await pool.query(sql, params)
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
    console.log('�?Webhook verified by Meta')
    return res.status(200).send(challenge)
  }
  console.warn('�?Webhook verification failed. Mode:', mode, 'Token match:', token === verifyToken)
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
          let isNewContact = false
          if (!contactId) {
            // Auto-create contact AND mark them as PDPA-consented from the
            // get-go. When a contact initiates WhatsApp contact with us,
            // PDPA permits us to respond — they've effectively given implied
            // consent to receive a reply. We sync the contacts.pdpa_consented
            // flag too so existing UI (broadcasts safety check, contact list
            // PDPA pill) reflects this.
            const consentNow = new Date()
            const consentExpires = new Date(consentNow)
            consentExpires.setMonth(consentExpires.getMonth() + 24)
            const newContact = await pool.query(`
              INSERT INTO contacts
                (workspace_id, name, phone, type, pipeline_stage, source, pdpa_consented, pdpa_consented_at)
              VALUES ($1, $2, $3, 'candidate', 'new', 'inbound_whatsapp', true, $4)
              RETURNING id, name
            `, [wsId, fromPhone, fromPhone, consentNow])
            contactId = newContact.rows[0].id
            isNewContact = true
            // Audit-trail row in pdpa_records. Note we don't have a user-id
            // for "collected_by" since this is system-initiated, so we leave
            // it null (the FK we added in chunk_21 is ON DELETE SET NULL,
            // null is permitted).
            await pool.query(`
              INSERT INTO pdpa_records
                (workspace_id, contact_id, status, method, consented_at, expires_at, collected_by, notes)
              VALUES ($1, $2, 'consented', 'inbound_whatsapp', $3, $4, NULL, $5)
            `, [
              wsId, contactId, consentNow, consentExpires,
              `Auto-logged: contact initiated WhatsApp conversation on ${consentNow.toISOString().slice(0, 10)} (msg: "${text.slice(0, 80).replace(/"/g, "'")}"${text.length > 80 ? '...' : ''}")`,
            ])
            console.log(`📝 Auto-logged PDPA consent for new contact ${fromPhone} (inbound WhatsApp)`)
          } else {
            // Existing contact: check if they have ANY pdpa_records yet.
            // Zero records = never logged either way, this inbound message
            // is the first signal of consent. We auto-log to fix that.
            // Records already exist (consented OR withdrawn) = consent state
            // is already established, do nothing — including the case where
            // they explicitly withdrew, we don't want to silently re-consent.
            const recordsCheck = await pool.query(
              `SELECT id FROM pdpa_records WHERE contact_id=$1 LIMIT 1`,
              [contactId]
            )
            if (recordsCheck.rows.length === 0) {
              const consentNow = new Date()
              const consentExpires = new Date(consentNow)
              consentExpires.setMonth(consentExpires.getMonth() + 24)
              await pool.query(`
                INSERT INTO pdpa_records
                  (workspace_id, contact_id, status, method, consented_at, expires_at, collected_by, notes)
                VALUES ($1, $2, 'consented', 'inbound_whatsapp', $3, $4, NULL, $5)
              `, [
                wsId, contactId, consentNow, consentExpires,
                `Auto-logged: first inbound WhatsApp from existing contact on ${consentNow.toISOString().slice(0, 10)} (msg: "${text.slice(0, 80).replace(/"/g, "'")}"${text.length > 80 ? '...' : ''}")`,
              ])
              await pool.query(
                `UPDATE contacts SET pdpa_consented=true, pdpa_consented_at=$1 WHERE id=$2`,
                [consentNow, contactId]
              )
              console.log(`📝 Auto-logged PDPA consent for existing contact ${fromPhone} (first inbound WhatsApp)`)
            }
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

// ─── HEALTH CHECK ───────────────────────────────────────────────────────────
app.get('/', (req, res) => res.json({ status: 'ok', platform: 'Tel-Cloud', version: '2.0.0', timestamp: new Date().toISOString() }))

// ─── SCHEDULED MESSAGES WORKER ──────────────────────────────────────────────
// Polls every WORKER_INTERVAL_MS for pending scheduled_messages whose scheduled_at
// has arrived. Sends each via the existing sendWhatsAppMessage helper. Updates
// status to 'sent' on success or 'failed' on error. If the message is a reminder
// (linked via event_reminders), marks the reminder as 'sent' too.
//
// Design rules:
// - Never crashes the process - all errors caught and logged
// - Idempotent at the message level - status check prevents double-send if poll
//   overlaps a slow send (rare, but possible under load)
// - Multi-tenant safe - each message carries its workspace_id and is sent via
//   that workspace's recipient phone (looked up via conversation -> contact)
// - Re-renders body for reminders at send time (always fresh event data)
const WORKER_INTERVAL_MS = 60 * 1000  // 60 seconds
const WORKER_BATCH_SIZE = 20  // Max messages per poll cycle

async function processScheduledMessage(msg) {
  // Guard: only send if still pending. If another worker (or a previous poll) already
  // grabbed this row, skip. We re-query inside a transaction to claim the message.
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // Atomic claim: only proceed if still pending
    const claimRes = await client.query(
      `UPDATE scheduled_messages SET status = 'sending'
       WHERE id = $1 AND status = 'pending'
       RETURNING *`,
      [msg.id]
    )
    if (claimRes.rows.length === 0) {
      // Another worker beat us, or status changed - just skip
      await client.query('COMMIT')
      return { skipped: true }
    }
    const claimed = claimRes.rows[0]

    // Check if this is a reminder - if so, re-render body using current event data
    const reminderRes = await client.query(
      `SELECT er.event_id, er.template_id, er.id as reminder_id
       FROM event_reminders er
       WHERE er.scheduled_message_id = $1 AND er.status = 'active'
       LIMIT 1`,
      [claimed.id]
    )
    let bodyToSend = claimed.body
    let reminderId = null
    if (reminderRes.rows.length > 0) {
      const reminder = reminderRes.rows[0]
      reminderId = reminder.reminder_id
      // Re-render with fresh event data
      try {
        const evRes = await client.query(
          `SELECT ct.name as contact_name FROM calendar_events ce
           LEFT JOIN contacts ct ON ct.id = ce.contact_id
           WHERE ce.id = $1`,
          [reminder.event_id]
        )
        const contactName = evRes.rows[0]?.contact_name || ''
        bodyToSend = await renderReminderBody(client, reminder.event_id, reminder.template_id, contactName)
      } catch (renderErr) {
        console.error(`[worker] Failed to re-render reminder body for sm ${claimed.id}:`, renderErr.message)
        // Fall through with the original frozen body
      }
    }

    // Look up recipient phone via conversation -> contact
    const phoneRes = await client.query(
      `SELECT ct.phone FROM conversations c
       JOIN contacts ct ON ct.id = c.contact_id
       WHERE c.id = $1 AND c.workspace_id = $2`,
      [claimed.conversation_id, claimed.workspace_id]
    )
    const toPhone = phoneRes.rows[0]?.phone
    if (!toPhone) {
      throw new Error('No recipient phone number on contact')
    }

    // Commit the claim before sending - we don't want the send to hold a DB transaction
    await client.query('COMMIT')

    // Send via existing helper. This may throw on Meta credential issues or API errors.
    const waMessageId = await sendWhatsAppMessage(toPhone, bodyToSend)

    // Mark sent. Use a fresh client (the previous transaction has been committed).
    await pool.query(
      `UPDATE scheduled_messages SET status = 'sent', sent_at = NOW(), body = $1
       WHERE id = $2`,
      [bodyToSend, claimed.id]
    )

    // Also create the actual messages table row so it appears in the conversation thread
    await pool.query(
      `INSERT INTO messages (conversation_id, workspace_id, user_id, direction, text, type, is_note, template_id, status, whatsapp_message_id, sent_at)
       VALUES ($1, $2, $3, 'out', $4, 'text', false, $5, 'sent', $6, NOW())`,
      [claimed.conversation_id, claimed.workspace_id, claimed.created_by, bodyToSend, claimed.template_id, waMessageId]
    )

    // Update conversation's last_message_at + preview
    await pool.query(
      `UPDATE conversations SET last_message_at = NOW(), last_message_preview = $1, updated_at = NOW()
       WHERE id = $2`,
      [bodyToSend.slice(0, 100), claimed.conversation_id]
    )

    // Mark reminder as sent if applicable
    if (reminderId) {
      await pool.query(
        `UPDATE event_reminders SET status = 'sent', updated_at = NOW() WHERE id = $1`,
        [reminderId]
      )
    }

    return { sent: true, sm_id: claimed.id, wa_id: waMessageId }
  } catch (err) {
    // Mark as failed - try to release transaction first if still in one
    try { await client.query('ROLLBACK') } catch {}
    try {
      await pool.query(
        `UPDATE scheduled_messages SET status = 'failed', failed_at = NOW(), failed_reason = $1
         WHERE id = $2 AND status IN ('pending', 'sending')`,
        [err.message?.slice(0, 500) || 'unknown error', msg.id]
      )
    } catch (markErr) {
      console.error(`[worker] Failed to mark sm ${msg.id} as failed:`, markErr.message)
    }
    return { failed: true, sm_id: msg.id, error: err.message }
  } finally {
    client.release()
  }
}

async function pollScheduledMessages() {
  try {
    const res = await pool.query(
      `SELECT id, workspace_id, conversation_id, contact_id, created_by, template_id, body
       FROM scheduled_messages
       WHERE status = 'pending' AND scheduled_at <= NOW()
       ORDER BY scheduled_at ASC
       LIMIT $1`,
      [WORKER_BATCH_SIZE]
    )
    if (res.rows.length === 0) return  // Nothing to do, stay quiet

    console.log(`[worker] Processing ${res.rows.length} due scheduled message(s)`)
    let sent = 0, failed = 0, skipped = 0
    for (const msg of res.rows) {
      const result = await processScheduledMessage(msg)
      if (result.sent) sent++
      else if (result.failed) failed++
      else if (result.skipped) skipped++
    }
    console.log(`[worker] Cycle complete: ${sent} sent, ${failed} failed, ${skipped} skipped`)
  } catch (err) {
    console.error('[worker] Poll cycle error:', err.message)
  }
}

function startScheduledMessageWorker() {
  console.log(`[worker] Scheduled message worker starting (poll every ${WORKER_INTERVAL_MS / 1000}s)`)
  // Run once immediately so any messages already due fire promptly on boot
  pollScheduledMessages()
  // Then poll on interval
  setInterval(pollScheduledMessages, WORKER_INTERVAL_MS)
}

// ============================================================
// BROADCAST WORKER (chunk 18)
// ============================================================
// Sends one broadcast at a time end-to-end. Each broadcast iterates its
// recipients sequentially, with a rate limit and 6 protections (A-F) to
// preserve WhatsApp account quality:
//   A. Tier limit pre-check (24h send window vs phone_numbers.daily_limit)
//   B. Live PDPA recheck per recipient (opted_out, dnc, phone presence)
//   C. Rate-limit pacing with jitter (5/sec target, 200ms +/- 10ms)
//   D. Quiet hours enforcement (in workspace timezone, unless force_send)
//   E. Per-recipient consecutive failure circuit-breaker
//   F. Per-recipient logging (whatsapp_message_id, failed_reason, sent_at)
// ============================================================

const BROADCAST_WORKER_INTERVAL_MS = 60 * 1000
const BROADCAST_RATE_LIMIT_MS = 200          // 5 messages per second
const BROADCAST_RATE_JITTER_MS = 10          // +/- jitter to look human
const BROADCAST_RECIPIENT_BATCH_SIZE = 1000  // safety cap per cycle per broadcast

// Sleep helper. Used between sends to enforce rate limit.
function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

// Compute current hour in a workspace's timezone. Returns 0-23.
// Falls back to UTC if timezone string is invalid (extremely rare).
function currentHourInTimezone(timezone) {
  try {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone || 'Asia/Singapore',
      hour: 'numeric',
      hour12: false
    })
    return parseInt(fmt.format(new Date()), 10)
  } catch {
    return new Date().getUTCHours()
  }
}

// Determine if a given hour falls within a quiet-hours window.
// Window can wrap midnight (e.g. start=22, end=8 means 22:00-23:59 + 00:00-07:59).
function isQuietHour(hour, startHour, endHour) {
  if (startHour === endHour) return false
  if (startHour < endHour) {
    return hour >= startHour && hour < endHour
  }
  // wraps midnight
  return hour >= startHour || hour < endHour
}

// Check 24h tier limit for a phone number. Returns { sent24h, limit, allowed }.
// "sent24h" counts both successful broadcast sends and successful scheduled_messages
// sends from the same phone, so we don't blow past Meta's per-number tier.
async function checkTierLimit(client, phoneNumberId) {
  const phRes = await client.query(
    `SELECT daily_limit FROM phone_numbers WHERE id = $1`,
    [phoneNumberId]
  )
  const limit = phRes.rows[0]?.daily_limit || 1000
  // Count broadcast sends in last 24h (recipient.status='sent')
  const brCount = await client.query(
    `SELECT COUNT(*)::int AS c FROM broadcast_recipients br
     JOIN broadcasts b ON b.id = br.broadcast_id
     WHERE b.phone_number_id = $1
       AND br.status = 'sent'
       AND br.sent_at > NOW() - INTERVAL '24 hours'`,
    [phoneNumberId]
  )
  // Count direct scheduled_messages sends in last 24h
  const smCount = await client.query(
    `SELECT COUNT(*)::int AS c FROM scheduled_messages
     WHERE phone_number_id = $1
       AND status = 'sent'
       AND sent_at > NOW() - INTERVAL '24 hours'`,
    [phoneNumberId]
  )
  const sent24h = (brCount.rows[0]?.c || 0) + (smCount.rows[0]?.c || 0)
  return { sent24h, limit, allowed: sent24h < limit, remaining: Math.max(0, limit - sent24h) }
}

// Render a template body with per-recipient variable substitution.
// Falls back to template defaults for variables not in per-recipient overrides.
function renderBroadcastBody(templateBody, templateVars, recipientVars) {
  if (!templateBody) return ''
  const defaults = (templateVars && templateVars.defaults) || {}
  const overrides = recipientVars || {}
  return templateBody.replace(/\{\{\s*([a-z][a-z0-9_]{0,29})\s*\}\}/gi, (match, name) => {
    if (overrides[name] !== undefined) return overrides[name]
    if (defaults[name] !== undefined) return defaults[name]
    return match  // leave {{name}} as-is if no value provided
  })
}

// Process one broadcast end-to-end. Atomic claim, then iterate recipients.
async function processBroadcast(broadcast) {
  const client = await pool.connect()
  let claimed = null
  try {
    // ─── ATOMIC CLAIM ──────────────────────────────────────
    // Transition status from 'scheduled' to 'sending'. If another worker
    // beat us, the UPDATE returns no rows and we silently skip.
    await client.query('BEGIN')
    const claimRes = await client.query(
      `UPDATE broadcasts
       SET status = 'sending', started_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND status = 'scheduled'
       RETURNING *`,
      [broadcast.id]
    )
    if (claimRes.rows.length === 0) {
      await client.query('COMMIT')
      return { skipped: true, reason: 'already_claimed' }
    }
    claimed = claimRes.rows[0]
    await client.query('COMMIT')
    console.log(`[broadcast worker] Claimed broadcast ${claimed.id} "${claimed.name}"`)

    // ─── PROTECTION A: TIER LIMIT PRE-CHECK ────────────────
    const tierCheck = await checkTierLimit(client, claimed.phone_number_id)
    // Count pending recipients to know if this broadcast would blow the tier
    const pendingCount = await client.query(
      `SELECT COUNT(*)::int AS c FROM broadcast_recipients
       WHERE broadcast_id = $1 AND status = 'pending'`,
      [claimed.id]
    )
    const wouldSend = pendingCount.rows[0]?.c || 0
    if (wouldSend > tierCheck.remaining) {
      const errorMsg = `Would exceed daily tier limit (${tierCheck.sent24h} already sent, ${tierCheck.remaining} remaining, ${wouldSend} pending). Wait or split the broadcast.`
      await pool.query(
        `UPDATE broadcasts SET status = 'failed', error_summary = $1, updated_at = NOW()
         WHERE id = $2`,
        [errorMsg, claimed.id]
      )
      console.warn(`[broadcast worker] Broadcast ${claimed.id} BLOCKED by tier limit: ${errorMsg}`)
      return { failed: true, reason: 'tier_limit', error: errorMsg }
    }

    // ─── LOAD TEMPLATE + WORKSPACE TIMEZONE ────────────────
    const tplRes = await client.query(
      `SELECT body, buttons, variables FROM templates WHERE id = $1 AND workspace_id = $2`,
      [claimed.template_id, claimed.workspace_id]
    )
    if (tplRes.rows.length === 0) {
      const errorMsg = 'Template no longer exists in workspace'
      await pool.query(
        `UPDATE broadcasts SET status = 'failed', error_summary = $1, updated_at = NOW()
         WHERE id = $2`,
        [errorMsg, claimed.id]
      )
      return { failed: true, reason: 'template_missing' }
    }
    const template = tplRes.rows[0]
    const wsRes = await client.query(
      `SELECT timezone FROM workspaces WHERE id = $1`,
      [claimed.workspace_id]
    )
    const workspaceTz = wsRes.rows[0]?.timezone || 'Asia/Singapore'

    // ─── ITERATE RECIPIENTS ────────────────────────────────
    const recRes = await client.query(
      `SELECT id, contact_id, variables FROM broadcast_recipients
       WHERE broadcast_id = $1 AND status = 'pending'
       ORDER BY id ASC
       LIMIT $2`,
      [claimed.id, BROADCAST_RECIPIENT_BATCH_SIZE]
    )
    const recipients = recRes.rows

    let sentCount = 0
    let failedCount = 0
    let skippedCount = 0
    let consecutiveFails = 0
    let circuitTripped = false

    for (const rec of recipients) {
      // ─── PROTECTION D: QUIET HOURS ──────────────────────
      // Check at every iteration because broadcasts can span hours.
      // If quiet hours are enabled AND we're in the window AND force_send is off,
      // pause the entire broadcast until later.
      if (claimed.quiet_hours_enabled && !claimed.force_send_outside_hours) {
        const currentHour = currentHourInTimezone(workspaceTz)
        if (isQuietHour(currentHour, claimed.quiet_hours_start_hour, claimed.quiet_hours_end_hour)) {
          // Don't fail the broadcast - just stop this cycle and reset to scheduled.
          // The next poll cycle will pick it up again and re-check.
          await pool.query(
            `UPDATE broadcasts SET status = 'scheduled', updated_at = NOW()
             WHERE id = $1`,
            [claimed.id]
          )
          console.log(`[broadcast worker] Broadcast ${claimed.id} paused for quiet hours (current hour ${currentHour}, window ${claimed.quiet_hours_start_hour}-${claimed.quiet_hours_end_hour})`)
          return { paused: true, reason: 'quiet_hours', sent: sentCount, failed: failedCount, skipped: skippedCount }
        }
      }

      // ─── PROTECTION B: LIVE PDPA RECHECK ────────────────
      // Re-query the contact at send time. If they opted out between compose
      // and now, mark as skipped and don't send.
      const contactRes = await client.query(
        `SELECT id, phone, name, opted_out, dnc FROM contacts
         WHERE id = $1 AND workspace_id = $2`,
        [rec.contact_id, claimed.workspace_id]
      )
      if (contactRes.rows.length === 0) {
        await pool.query(
          `UPDATE broadcast_recipients
           SET status = 'skipped', skipped_reason = $1, updated_at = NOW()
           WHERE id = $2`,
          ['Contact deleted before send', rec.id]
        )
        skippedCount++
        continue
      }
      const contact = contactRes.rows[0]
      let skipReason = null
      if (contact.opted_out) skipReason = 'Contact opted out before send'
      else if (contact.dnc) skipReason = 'Contact on DNC list at send time'
      else if (!contact.phone || !contact.phone.trim()) skipReason = 'Contact has no phone number'
      if (skipReason) {
        await pool.query(
          `UPDATE broadcast_recipients
           SET status = 'skipped', skipped_reason = $1, updated_at = NOW()
           WHERE id = $2`,
          [skipReason, rec.id]
        )
        skippedCount++
        continue
      }

      // ─── ATTEMPT SEND ───────────────────────────────────
      // Mark recipient as sending right before the API call so we can detect
      // worker crashes mid-broadcast. If recovery is needed in a future poll,
      // these stuck-in-sending rows can be reset (Chunk D will add a recovery query).
      await pool.query(
        `UPDATE broadcast_recipients SET status = 'sending', updated_at = NOW() WHERE id = $1`,
        [rec.id]
      )
      const renderedBody = renderBroadcastBody(template.body, template.variables, rec.variables)
      try {
        const waMessageId = await sendWhatsAppMessage(contact.phone, renderedBody)
        await pool.query(
          `UPDATE broadcast_recipients
           SET status = 'sent', sent_at = NOW(), whatsapp_message_id = $1, updated_at = NOW()
           WHERE id = $2`,
          [waMessageId, rec.id]
        )
        sentCount++
        consecutiveFails = 0  // reset circuit breaker on success
      } catch (err) {
        const errorText = (err.message || 'Unknown error').slice(0, 500)
        await pool.query(
          `UPDATE broadcast_recipients
           SET status = 'failed', failed_reason = $1, updated_at = NOW()
           WHERE id = $2`,
          [errorText, rec.id]
        )
        failedCount++
        consecutiveFails++
        console.error(`[broadcast worker] Recipient ${rec.id} failed: ${errorText}`)

        // ─── PROTECTION E: CIRCUIT BREAKER ────────────────
        if (consecutiveFails >= claimed.consecutive_fail_limit) {
          circuitTripped = true
          break
        }
      }

      // ─── PROTECTION C: RATE LIMIT WITH JITTER ──────────
      const jitter = Math.floor((Math.random() - 0.5) * 2 * BROADCAST_RATE_JITTER_MS)
      await sleep(BROADCAST_RATE_LIMIT_MS + jitter)
    }

    // ─── FINALIZE BROADCAST STATUS ─────────────────────────
    let finalStatus = 'completed'
    let errorSummary = null
    if (circuitTripped) {
      finalStatus = 'failed'
      errorSummary = `Circuit breaker tripped: ${claimed.consecutive_fail_limit} consecutive recipients failed. Broadcast paused to protect quota. Investigate failures and create a new broadcast for remaining recipients.`
    } else if (sentCount === 0 && failedCount > 0) {
      finalStatus = 'failed'
      errorSummary = `All ${failedCount} send attempts failed. No messages delivered.`
    }
    await pool.query(
      `UPDATE broadcasts
       SET status = $1, sent_at = NOW(), error_summary = $2,
           sent_count = (SELECT COUNT(*) FROM broadcast_recipients WHERE broadcast_id = $3 AND status = 'sent'),
           failed_count = (SELECT COUNT(*) FROM broadcast_recipients WHERE broadcast_id = $3 AND status = 'failed'),
           updated_at = NOW()
       WHERE id = $3`,
      [finalStatus, errorSummary, claimed.id]
    )

    console.log(`[broadcast worker] Broadcast ${claimed.id} ${finalStatus.toUpperCase()}: ${sentCount} sent, ${failedCount} failed, ${skippedCount} skipped`)
    return { completed: true, status: finalStatus, sent: sentCount, failed: failedCount, skipped: skippedCount }

  } catch (err) {
    // Catastrophic failure: try to mark broadcast as failed with diagnostic info
    console.error(`[broadcast worker] Catastrophic failure on broadcast ${broadcast.id}:`, err.message)
    try { await client.query('ROLLBACK') } catch {}
    try {
      await pool.query(
        `UPDATE broadcasts SET status = 'failed', error_summary = $1, updated_at = NOW()
         WHERE id = $2 AND status IN ('scheduled', 'sending')`,
        [`Worker error: ${err.message?.slice(0, 400) || 'unknown'}`, broadcast.id]
      )
    } catch {}
    return { failed: true, error: err.message }
  } finally {
    client.release()
  }
}

// Main poll loop. Picks up broadcasts that are due, handles them sequentially.
// Sequential processing (not parallel) keeps total send rate manageable across
// broadcasts and simplifies tier-limit reasoning.
async function pollBroadcasts() {
  try {
    const res = await pool.query(
      `SELECT id, name FROM broadcasts
       WHERE status = 'scheduled' AND scheduled_at <= NOW()
       ORDER BY scheduled_at ASC
       LIMIT 5`
    )
    if (res.rows.length === 0) return

    console.log(`[broadcast worker] Processing ${res.rows.length} due broadcast(s)`)
    for (const b of res.rows) {
      await processBroadcast(b)
    }
  } catch (err) {
    console.error('[broadcast worker] Poll cycle error:', err.message)
  }
}

function startBroadcastWorker() {
  console.log(`[broadcast worker] Broadcast worker starting (poll every ${BROADCAST_WORKER_INTERVAL_MS / 1000}s)`)
  pollBroadcasts()
  setInterval(pollBroadcasts, BROADCAST_WORKER_INTERVAL_MS)
}

// ============================================================
// PDPA EXPIRY WORKER (chunk 21 follow-up)
// ============================================================
// Polls hourly (expiry tracking doesn't need minute-level precision).
// Finds consented records whose expires_at has passed AND no later record
// exists for the same contact. For each such record, inserts an 'expired'
// row in pdpa_records and flips contacts.pdpa_consented to false.
//
// Strategy: append-only audit trail (matches the rest of the PDPA model)
// + sync the boolean flag on contacts so existing UI continues to work.
// The latest-record-wins query in /pdpa/dashboard already classifies
// expired status from the timestamp; this worker makes that visible by
// writing real rows so contact lists, broadcasts safety, etc., reflect it.
const PDPA_EXPIRY_WORKER_INTERVAL_MS = 60 * 60 * 1000  // 1 hour

async function pollPdpaExpiry() {
  try {
    // Find all "currently consented" records that are past their expiry.
    // "Currently consented" = the latest record for that contact is a
    // 'consented' status. We use DISTINCT ON to pick the latest per
    // contact, then filter by expiry. This catches the legit case
    // (consent given 2 years ago, never re-asserted, now lapsed) and
    // ignores already-handled cases (a withdrawn record after consent
    // means the latest is 'withdrawn', not eligible for expiry).
    const expired = await pool.query(`
      WITH latest AS (
        SELECT DISTINCT ON (contact_id)
          id, workspace_id, contact_id, status, expires_at
        FROM pdpa_records
        ORDER BY contact_id, created_at DESC
      )
      SELECT id, workspace_id, contact_id, expires_at
      FROM latest
      WHERE status = 'consented'
        AND expires_at IS NOT NULL
        AND expires_at < NOW()
    `)

    if (expired.rows.length === 0) {
      // Quiet log — only print when there's actual work.
      return
    }

    console.log(`[pdpa expiry worker] Found ${expired.rows.length} expired consent record(s)`)

    for (const row of expired.rows) {
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        // Append the 'expired' row. Notes captures the original consent's
        // expiry timestamp so the audit trail is self-explanatory.
        await client.query(`
          INSERT INTO pdpa_records
            (workspace_id, contact_id, status, method, collected_by, notes)
          VALUES ($1, $2, 'expired', 'system_expiry', NULL, $3)
        `, [
          row.workspace_id,
          row.contact_id,
          `Auto-expired by system on ${new Date().toISOString().slice(0, 10)} (consent had expires_at ${new Date(row.expires_at).toISOString().slice(0, 10)})`,
        ])
        // Sync the contacts.pdpa_consented flag so existing UI (broadcasts
        // safety check, contact list PDPA pill) reflects the lapse.
        await client.query(`
          UPDATE contacts
          SET pdpa_consented = false, pdpa_consented_at = NULL
          WHERE id = $1 AND workspace_id = $2
        `, [row.contact_id, row.workspace_id])
        await client.query('COMMIT')
        console.log(`[pdpa expiry worker]   expired contact_id=${row.contact_id} (workspace ${row.workspace_id})`)
      } catch (err) {
        await client.query('ROLLBACK')
        console.error(`[pdpa expiry worker] Failed to expire contact_id=${row.contact_id}:`, err.message)
      } finally {
        client.release()
      }
    }
  } catch (err) {
    console.error('[pdpa expiry worker] Poll cycle error:', err.message)
  }
}

function startPdpaExpiryWorker() {
  console.log(`[pdpa expiry worker] PDPA expiry worker starting (poll every ${PDPA_EXPIRY_WORKER_INTERVAL_MS / 1000 / 60}min)`)
  // Run once on startup to clean up anything that expired while server was down.
  pollPdpaExpiry()
  setInterval(pollPdpaExpiry, PDPA_EXPIRY_WORKER_INTERVAL_MS)
}

// ─── START ──────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 4000
setupDatabase().then(() => {
  httpServer.listen(PORT, () => {
    console.log(`🚀 Tel-Cloud server running on port ${PORT}`)
    console.log(`📧 Super admin login: superadmin@tel-cloud.com / admin123`)
    startScheduledMessageWorker()
    startBroadcastWorker()
    startPdpaExpiryWorker()
  })
})