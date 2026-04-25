# Tel-Cloud Roadmap

Living document capturing future work, product decisions, and context for Claude sessions.

Last updated: 2026-04-25 (production deploy resolved)

---

## Currently Building

Nothing actively in progress. Permissions system (Chunk 5) shipped end-to-end. Mobile responsiveness foundation shipped across 5 primary pages + 5 Settings sub-tabs.

Next likely work: Eque go-live setup on production, or ChatWindow mobile polish once live conversations exist.

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

## Production deployment

### Resolved 25 Apr 2026
- Diagnosed Railway credential desync (PostgreSQL error 28P01: hardcoded `DATABASE_URL` had stale Postgres password)
- Compromised password leaked during diagnostic — rotated by deleting Postgres service entirely (volume had no real production data)
- Created fresh Postgres service with auto-generated password
- Replaced hardcoded `DATABASE_URL` on agency-hub with `${{Postgres.DATABASE_URL}}` reference — desync now structurally impossible
- Disabled public TCP proxy after fix (was temporarily enabled for SQL access, no longer needed)
- Verified production: health check returns 200, login enforces auth, superadmin login works

### Pending before Eque go-live
- Create Eque Singapore workspace on production (UEN 202231751D) via superadmin UI
- Add Director Quiinn account on production with secure password
- Decide frontend hosting: separate service (Vercel/Netlify) vs backend serving `client/dist`
- Configure Meta WhatsApp API credentials in agency-hub Variables tab once Meta approves
- Apply ChatWindow mobile polish (deferred from 25 Apr session) once live conversations exist
- Re-test end-to-end with production backend before announcing go-live

---

## Future Features Backlog

### Calendar / Interview Invites
**Status:** Not yet built properly. Current endpoint exists but feature is incomplete.

Needed when we build this:
- Send interview invites to candidates
- Send meeting invites to clients
- Trigger email template (not WhatsApp) to recipients
- Send immediately OR schedule for later
- Must attach job description to candidate-side invites
- **Blocker:** Job Description Directory must exist first (see below)

### Job Description Directory
**Status:** Not yet built. Required before Calendar feature can be completed.

Needed:
- Structured JD entries (not free-text — prevents wrong JD from being sent)
- Point-form fields (title, responsibilities, requirements, location, etc.)
- Probably tied to projects (each project has its own JDs)
- Searchable / filterable for quick attachment
- Preview before sending

### Send On Behalf
**Status:** DB columns exist (`sent_as_user_id`, `sent_by_user_id` on messages table), not yet wired up.

Use case: Director sends message "as" a consultant, or admin sends on behalf of a consultant during their leave.

### Super Admin Polish
- Workspace suspend / reactivate
- Impersonate tenant user (with audit log)
- Billing dashboard
- Plan tier enforcement

---

## Mobile Polish — Deferred Items

Test once Meta WhatsApp API is connected and real conversations are flowing.

### ChatWindow header buttons crowd on narrow mobile widths
Four action buttons (+ Project / Resolve / Reassign / Contact) sit after avatar + name. On screens under ~400px these may overflow or cramp.

- Fix: add `className="flex-wrap md:flex-nowrap"` to the outer header row container and to the actions `<div>` wrapping the GhostButtons
- File: `client/src/components/inbox/ChatWindow.jsx` (header around line 240, actions row around line 330)

### Composer hint text is desktop-only noise on mobile
The "Enter to send · Shift+Enter for new line · Ctrl+K to search" hint below the composer is meaningless on mobile (no physical keyboard).

- Fix: wrap the hint `<span>` with `className="hidden md:inline"`, and add an empty placeholder `<span className="md:hidden" />` to preserve `justify-content: space-between` alignment of the status pill on the right
- File: `client/src/components/inbox/ChatWindow.jsx` (composer footer around line 550)

### Other deferred mobile items
- **Inbox empty state** — "No conversations" alone reads as broken. Add icon + helpful copy similar to Projects / Templates empty states.
- **Templates editor Buttons row** — 4-element inline row (type select + label + url + remove) overflows on mobile. Low priority — editing on mobile is an edge case.

### Test steps when ready
Open any conversation on phone at <400px width. Verify (1) header buttons wrap to a second row cleanly if they don't fit, (2) composer hint is hidden, (3) status pill ("24hr window open") still aligns to the right.

---

## Open Follow-ups

### 401 auth noise on page load
8-16 failed requests fire on every refresh before AuthContext hydrates. Token is still valid (pages render), but wasteful and clutters console. Pre-existing, not caused by any specific feature work. Investigate which components fire fetches before token is available.

### UI permission gating — stub files
Contacts.jsx and Broadcasts.jsx are placeholder "Coming soon" pages. When built, apply the same `hasPermission` pattern used in Chunk 5d Tier 1-5.

---

## Architecture Notes

### Multi-tenancy
- `workspace_type`: `platform` | `client` | `internal` (legacy, being phased out)
- Tel-Cloud Platform = workspace_type `platform` (super admin's own workspace)
- Eque Singapore = workspace_type `client`, billing_exempt=true
- Test Agency = workspace_type `client`, billing_exempt=false (sample)

### Roles (fixed list, not customizable)
- super_admin — platform layer
- director — workspace owner (always full permissions, locked)
- manager
- supervisor
- senior_consultant
- consultant
- admin (read-only oversight)

### Permissions (12 + meta, configurable per workspace)
- Messaging: `send_messages`, `write_notes`, `manage_conversations`
- Contacts: `manage_contacts`
- Projects: `manage_projects`, `manage_project_members`
- Communication: `manage_templates`, `manage_scheduled_messages`
- Config: `manage_phone_numbers`, `manage_teams`, `manage_workspace_settings`, `manage_staff`
- Meta: `manage_role_permissions`

### Scope (independent of permissions)
- `workspace_wide` — sees all data in workspace
- `project_only` — sees only data tied to their project memberships

---

## Conventions

- Git commits: `feat(d1 chunk Xy): short description` or `fix(scope): description` or `docs(scope): description`
- Migration IDs: `chunk_X_feature_name_v1` (recorded in `_migrations` table)
- Roles in DB use snake_case (`senior_consultant` not `seniorConsultant`)
- Permission names use snake_case (`manage_contacts` not `manageContacts`)
- ASCII-only in code files (PowerShell `Set-Content` corrupts UTF-8 emojis — use VS Code find/replace instead)
- Always dry-run before apply on regex refactors

---

## Completed Work — Reference

### Chunk 5: Role Permissions System (Apr 23-24, 2026)
End-to-end permission system shipped across 5 tiered commits.

- **5a** (commit c5795d6): DB-driven helpers, API endpoints, migration, auto-seed on tenant creation
- **5b**: 34 write endpoints refactored to use `requirePermission(specific_perm)`
- **5c**: Director UI (Settings → Roles & Permissions)
- **5d Tier 1** (commit 1bb3a61): Topbar — Jobs removed from nav, "+ New" gated by `manage_contacts`
- **5d Tier 5** (commit 7a6be89): Settings tabs — PhoneNumbers, Teams, Agents buttons gated
- **5d Tier 4** (commit b0f3aeb): Scheduled + Templates — both pages fully gated
- **5d Tier 3** (commit fd74437): ChatWindow — composer, assign, resolve, pin actions gated
- **5d Tier 2** (commit b4dfd81): Projects — create/edit/archive/delete + members fully gated

End state: 42 backend endpoints enforce `requirePermission`, 7 production frontend pages hide unauthorized UI, role matrix configurable per workspace by director, super admin can manage any tenant's role matrix.

### Mobile Responsiveness (Apr 25, 2026 session)
Foundation + 5 primary pages + 5 Settings sub-tabs shipped across commits 2dd3996 through 5b6a4b2.

- Phase 0: 100vh → 100dvh viewport fix (iOS Safari address bar)
- Projects mobile polish (padding, touch targets, stacked Clients/Candidates)
- Settings floating tab bar bug fix (position:fixed bottom:60 → sticky top)
- Scheduled page responsive polish (stats, filters, expanded detail stacking)
- Templates page responsive polish (stats, filters, editor modal stacking)
- AgencyProfile two-column layout stacks on mobile
- 5 Settings sub-tabs (Routing, Roles & Permissions, Email Integration, WhatsApp API, Security) stack two-column grids on mobile

Real-device QA pass completed on Android Chrome via LAN. Inbox three-pane collapse already worked correctly via `mobileView` state in App.jsx — no changes needed there.

Tailwind v4 confirmed working via `@import "tailwindcss"` in `client/src/index.css`. Mobile polish strategy: add Tailwind classNames alongside existing inline styles rather than rewriting.