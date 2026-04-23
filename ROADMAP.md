# Tel-Cloud Roadmap

Living document capturing future work, product decisions, and context for Claude sessions.

Last updated: 2026-04-23 (end of Chunk 5a session)

---

## Currently Building

**Chunk 5: Role Permissions System** (in progress)
- 5a complete: DB-driven helpers, API endpoints, migration, auto-seed on tenant creation (committed as c5795d6)
- 5b pending: refactor 34 write endpoints to use requirePermission(specific_perm)
- 5c pending: Director UI (Settings > Roles & Permissions)
- 5d pending: Super admin UI (Tenants > [tenant] > Roles & Permissions)

---

## Product Decisions Locked

### Scope
- Focus: Tel-Cloud as SaaS platform for recruitment agencies
- First tenant: Eque Singapore (dogfood, billing-exempt)
- Target tenant size: 5-50 person agencies

### Out of scope for now
- **Jobs / Positions** — recruiters have external ATS, Tel-Cloud is not a jobs database
- **PDPA** — simple checkbox is enough, not a complex consent tracking system

---

## Future Features Backlog

### Calendar / Interview Invites
**Status:** Not yet built properly. Current endpoint exists but feature is incomplete.

Needed when we build this:
- Send interview invites to candidates
- Send meeting invites to clients
- Trigger email template (not WhatsApp) to recipients
- Send immediately OR schedule for later
- **Must attach job description to candidate-side invites**
- **Blocker:** Job Description Directory must exist first (see below)

### Job Description Directory
**Status:** Not yet built. Required before Calendar feature can be completed.

Needed:
- Structured JD entries (not free-text — prevents wrong JD from being sent)
- Point-form fields (title, responsibilities, requirements, location, etc.)
- Probably tied to projects (INZY has its own JDs, PPS2 has others)
- Searchable / filterable for quick attachment
- Preview before sending

### Send On Behalf
**Status:** DB columns exist (sent_as_user_id, sent_by_user_id on messages table), not yet wired up.

Use case: Director sends message "as" a consultant, or admin sends on behalf of a consultant during their leave.

### Super Admin Polish
- Workspace suspend / reactivate
- Impersonate tenant user (with audit log)
- Billing dashboard
- Plan tier enforcement

### Frontend UX Polish
- READ-ONLY badge for admin role
- Disabled message composer for admin with tooltip
- Permission-aware UI (hide buttons users cannot action)

### Production Deployment
**Status:** Blocked by Railway DB credential mismatch. Production app still serving from cached connection.

Next session priorities:
- Fix Railway Postgres password desync (support ticket or service recreate)
- Survey production DB state
- Push local commits (4 commits ahead at last count)

---

## Architecture Notes

### Multi-tenancy
- workspace_type: 'platform' | 'client' | 'internal' (legacy, being phased out)
- Tel-Cloud Platform = workspace_type 'platform' (super admin's own workspace)
- Eque Singapore = workspace_type 'client', billing_exempt=true
- Test Agency = workspace_type 'client', billing_exempt=false (sample)

### Roles (fixed list, not customizable)
- super_admin — platform layer
- director — workspace owner (always full permissions, locked)
- manager
- supervisor
- senior_consultant
- consultant
- admin (read-only oversight)

### Permissions (12 + meta, configurable per workspace)
- Messaging: send_messages, write_notes, manage_conversations
- Contacts: manage_contacts
- Projects: manage_projects, manage_project_members
- Communication: manage_templates, manage_scheduled_messages
- Config: manage_phone_numbers, manage_teams, manage_workspace_settings, manage_staff
- Meta: manage_role_permissions

### Scope (independent of permissions)
- workspace_wide — sees all data in workspace
- project_only — sees only data tied to their project memberships

---

## Conventions

- Git commits: feat(d1 chunk Xy): short description
- Migration IDs: chunk_X_feature_name_v1 (recorded in _migrations table)
- Roles in DB use snake_case (senior_consultant not seniorConsultant)
- Permission names use snake_case (manage_contacts not manageContacts)

