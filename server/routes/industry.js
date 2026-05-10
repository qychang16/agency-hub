// server/routes/industry.js
//
// Industry vertical wizard handlers. Exported as named functions
// to match server/index.js's existing inline app.get/app.post style.
//
// Permission model (Option 2):
//   - super_admin can manage any workspace's industry config
//   - director can manage their OWN workspace only
//   - unlock is super_admin only (directors cannot self-unlock; that would
//     defeat the lock's purpose)
//   - catalog is readable by any authenticated user (harmless metadata)

const INDUSTRY_CATALOG = [
  {
    slug: 'recruitment',
    display_name: 'Recruitment',
    description: 'Talent agencies, headhunters, executive search.',
    status: 'available',
    default_preset: {
      pipeline_stages: ['new', 'contacted', 'screening', 'interviewing', 'offered', 'placed', 'rejected'],
      custom_fields: [
        { key: 'candidate_role', label: 'Role', type: 'text', required: false },
        { key: 'current_company', label: 'Current Company', type: 'text', required: false },
        { key: 'expected_salary', label: 'Expected Salary (SGD)', type: 'number', required: false },
        { key: 'notice_period', label: 'Notice Period', type: 'text', required: false },
        { key: 'linkedin_url', label: 'LinkedIn URL', type: 'url', required: false }
      ],
      ui_labels: {
        contact_singular: 'candidate',
        contact_plural: 'candidates',
        agent_role: 'consultant',
        primary_artifact_singular: 'job order',
        primary_artifact_plural: 'job orders',
        outcome_singular: 'placement',
        outcome_plural: 'placements'
      },
      template_library_seed: 'recruitment'
    }
  },
  {
    slug: 'real_estate',
    display_name: 'Real Estate',
    description: 'Property agencies, listings, viewings, transactions.',
    status: 'coming_soon'
  },
  {
    slug: 'insurance',
    display_name: 'Insurance',
    description: 'Insurance agencies, advisors, policies, renewals.',
    status: 'coming_soon'
  },
  {
    slug: 'beauty_clinic',
    display_name: 'Beauty Clinics',
    description: 'Aesthetic clinics, treatment plans, patient follow-up.',
    status: 'coming_soon'
  },
  {
    slug: 'tutoring',
    display_name: 'Tutoring',
    description: 'Tuition centres, private tutors, lesson management.',
    status: 'coming_soon'
  }
]

// super_admin: any workspace. director: own workspace only.
function canManageIndustry(req, workspaceId) {
  if (!req.user) return false
  if (req.user.is_super_admin === true) return true
  if (req.user.role === 'director' && req.user.workspace_id === workspaceId) return true
  return false
}

function parseWorkspaceId(req, res) {
  const wsId = parseInt(req.params.workspaceId, 10)
  if (!Number.isInteger(wsId) || wsId < 1) {
    res.status(400).json({ error: 'Invalid workspace id.' })
    return null
  }
  return wsId
}

module.exports = function createIndustryHandlers(pool, logAudit) {

  async function getCatalog(req, res) {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' })
    }
    res.json({ industries: INDUSTRY_CATALOG })
  }

  async function getPreset(req, res) {
    const wsId = parseWorkspaceId(req, res)
    if (wsId === null) return
    if (!canManageIndustry(req, wsId)) {
      return res.status(403).json({ error: 'Permission denied. Director or super admin only.' })
    }

    try {
      const wsResult = await pool.query(
        'SELECT id, name, industry_vertical, industry_locked_at FROM workspaces WHERE id = $1',
        [wsId]
      )
      if (wsResult.rows.length === 0) {
        return res.status(404).json({ error: 'Workspace not found.' })
      }
      const workspace = wsResult.rows[0]

      const presetResult = await pool.query(
        `SELECT vertical, pipeline_stages, custom_fields, ui_labels,
                template_library_seed, updated_at
         FROM industry_presets
         WHERE workspace_id = $1`,
        [wsId]
      )
      const preset = presetResult.rows[0] || null

      res.json({
        workspace: {
          id: workspace.id,
          name: workspace.name,
          industry_vertical: workspace.industry_vertical,
          industry_locked_at: workspace.industry_locked_at,
          is_locked: workspace.industry_locked_at !== null
        },
        preset
      })
    } catch (err) {
      console.error('[industry] GET preset failed:', err.message)
      res.status(500).json({ error: 'Internal error fetching preset.' })
    }
  }

  async function updatePreset(req, res) {
    const wsId = parseWorkspaceId(req, res)
    if (wsId === null) return
    if (!canManageIndustry(req, wsId)) {
      return res.status(403).json({ error: 'Permission denied. Director or super admin only.' })
    }

    const { vertical, pipeline_stages, custom_fields, ui_labels, template_library_seed } = req.body || {}

    if (vertical !== undefined) {
      const catalogEntry = INDUSTRY_CATALOG.find(i => i.slug === vertical)
      if (!catalogEntry) {
        return res.status(400).json({ error: `Unknown industry vertical: ${vertical}` })
      }
      if (catalogEntry.status === 'coming_soon') {
        return res.status(400).json({
          error: `${catalogEntry.display_name} is not yet available. Contact Tel-Cloud support to register interest.`
        })
      }
    }

    try {
      const lockCheck = await pool.query(
        'SELECT industry_locked_at FROM workspaces WHERE id = $1',
        [wsId]
      )
      if (lockCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Workspace not found.' })
      }
      if (lockCheck.rows[0].industry_locked_at !== null) {
        return res.status(409).json({
          error: 'Industry is locked. Contact Tel-Cloud support to unlock.'
        })
      }

      const upsertResult = await pool.query(
        `INSERT INTO industry_presets (
           workspace_id, vertical, pipeline_stages, custom_fields, ui_labels, template_library_seed
         ) VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (workspace_id) DO UPDATE SET
           vertical = COALESCE($2, industry_presets.vertical),
           pipeline_stages = COALESCE($3, industry_presets.pipeline_stages),
           custom_fields = COALESCE($4, industry_presets.custom_fields),
           ui_labels = COALESCE($5, industry_presets.ui_labels),
           template_library_seed = COALESCE($6, industry_presets.template_library_seed),
           updated_at = NOW()
         RETURNING *`,
        [
          wsId,
          vertical ?? null,
          pipeline_stages ? JSON.stringify(pipeline_stages) : null,
          custom_fields ? JSON.stringify(custom_fields) : null,
          ui_labels ? JSON.stringify(ui_labels) : null,
          template_library_seed ?? null
        ]
      )

      if (vertical !== undefined) {
        await pool.query(
          'UPDATE workspaces SET industry_vertical = $1 WHERE id = $2',
          [vertical, wsId]
        )
      }

      res.json({ preset: upsertResult.rows[0] })
    } catch (err) {
      console.error('[industry] PATCH preset failed:', err.message)
      res.status(500).json({ error: 'Internal error updating preset.' })
    }
  }

  async function lockIndustry(req, res) {
    const wsId = parseWorkspaceId(req, res)
    if (wsId === null) return
    if (!canManageIndustry(req, wsId)) {
      return res.status(403).json({ error: 'Permission denied. Director or super admin only.' })
    }

    if (!req.body || req.body.confirm !== true) {
      return res.status(400).json({
        error: 'Lock requires explicit confirmation: { confirm: true } in body.'
      })
    }

    try {
      const presetCheck = await pool.query(
        'SELECT vertical FROM industry_presets WHERE workspace_id = $1',
        [wsId]
      )
      if (presetCheck.rows.length === 0) {
        return res.status(400).json({
          error: 'No preset configured. Save industry preset before locking.'
        })
      }

      const result = await pool.query(
        `UPDATE workspaces
         SET industry_locked_at = COALESCE(industry_locked_at, NOW())
         WHERE id = $1
         RETURNING id, name, industry_vertical, industry_locked_at`,
        [wsId]
      )
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Workspace not found.' })
      }

      if (typeof logAudit === 'function') {
        await logAudit(
          wsId, req.user.id, 'industry_locked', 'workspace', wsId,
          null, { vertical: presetCheck.rows[0].vertical }
        )
      }

      res.json({ workspace: result.rows[0] })
    } catch (err) {
      console.error('[industry] POST lock failed:', err.message)
      res.status(500).json({ error: 'Internal error locking industry.' })
    }
  }

  // Unlock is super_admin ONLY. Directors cannot self-unlock - that
  // would defeat the lock. Customers must request unlock from support.
  async function unlockIndustry(req, res) {
    const wsId = parseWorkspaceId(req, res)
    if (wsId === null) return
    if (!req.user || req.user.is_super_admin !== true) {
      return res.status(403).json({ error: 'Super admin only. Contact Tel-Cloud support to unlock.' })
    }

    const reason = (req.body && typeof req.body.reason === 'string') ? req.body.reason.trim() : ''
    if (reason.length < 10) {
      return res.status(400).json({
        error: 'Unlock requires a reason string of at least 10 characters.'
      })
    }

    try {
      const result = await pool.query(
        `UPDATE workspaces
         SET industry_locked_at = NULL
         WHERE id = $1 AND industry_locked_at IS NOT NULL
         RETURNING id, name, industry_vertical`,
        [wsId]
      )
      if (result.rows.length === 0) {
        return res.status(404).json({
          error: 'Workspace not found, or industry was not locked.'
        })
      }

      if (typeof logAudit === 'function') {
        await logAudit(
          wsId, req.user.id, 'industry_unlocked', 'workspace', wsId,
          null, { reason }
        )
      }

      res.json({ workspace: result.rows[0], unlocked_by: req.user.id })
    } catch (err) {
      console.error('[industry] POST unlock failed:', err.message)
      res.status(500).json({ error: 'Internal error unlocking industry.' })
    }
  }

  return {
    getCatalog,
    getPreset,
    updatePreset,
    lockIndustry,
    unlockIndustry
  }
}