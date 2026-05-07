# Tel-Cloud Roadmap

Living document capturing future work, product decisions, and context for Claude sessions.

Last updated: 2026-05-08 (engineering hardening: dotenv, queue abstraction, AWS roadmap, full Btn-to-Button migration, mobile responsive grids)

---

## Currently Building

Tech Provider Phase 1 - Foundation. Domain + Workspace done. Pending: AWS Activate Portfolio application, marketing landing site at tel-cloud.sg root, legal docs (Privacy / ToS / AUP).

Engineering foundation hardening complete as of 8 May 2026: dotenv-managed secrets, queue abstraction layer (Postgres -> SQS-ready), full Btn-to-Button component migration (single source of truth), mobile responsive grid fixes across 6 components.

AWS Phase 6 migration roadmap committed as roadmap addendum. Decision: migrate before Tech Provider submission to ensure Singapore data residency and avoid forced post-launch migration. Estimated 4-6 weeks calendar time.

---

## Product Decisions Locked

### Scope
- Focus: Tel-Cloud as SaaS platform for recruitment agencies
- First tenant: Eque Singapore (dogfood, billing-exempt)
- Target tenant size: 5-50 person agencies
- Frontend hosted on Vercel (`agency-hub-teal.vercel.app`)
- Backend hosted on Railway (`agency-hub-production-e5af.up.railway.app`)

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

### Resolved 7 May 2026
- Frontend hosting decision: Vercel (separate from Railway) — auto-deploys from GitHub master
- Google Sign-In integrated end-to-end (production verified)
- Production database migration applied: chunk_22 (google_id, auth_provider columns), super_admin email renamed `superadmin@tel-cloud.com` → `quiinn@tel-cloud.sg`
- Tel-Cloud Demo workspace created on production for dogfooding (separate from Eque tenant)
- Brand redesign deployed: login screen, AdminPanel, favicon all use chrome rings logo + design tokens
- Top nav restructured: 9 tabs in usage-frequency order, PDPA moved into Settings as 13th sub-tab

### Pending before Eque go-live
- Create Eque Singapore workspace on production (UEN 202231751D) via superadmin UI
- Onboard Eque director account on production with secure password
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

### In-app Password Change UI
**Status:** No UI exists for users to change their own password.

Painfully discovered during 7 May session: user has no way to change password from inside the app. Required PowerShell + bcrypt + psql recovery dance to reset. Must build:
- Profile/settings menu with "Change password" option
- Verify current password before allowing change
- Enforce password strength rules (already in security_settings table)
- Should also include "Forgot password" email-based reset flow once email infra exists

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
- **AdminPanel** — designed for desktop, modals and table cramp on phone. Lower priority since AdminPanel is platform-staff-only.

### Test steps when ready
Open any conversation on phone at <400px width. Verify (1) header buttons wrap to a second row cleanly if they don't fit, (2) composer hint is hidden, (3) status pill ("24hr window open") still aligns to the right.

---

## Open Follow-ups

### chunk_22 migration not embedded in runner
chunk_22_google_auth schema (google_id, auth_provider columns + partial unique index) was applied manually via psql to both local and production DBs. NOT yet added to the migration runner in `server/index.js`. Future Railway redeploys are safe (idempotent IF NOT EXISTS guards needed if we add it). Tech debt to embed properly.

### ~~Local server env vars not persistent~~ - Resolved 8 May 2026
dotenv installed, `server/.env` created (gitignored), `server/.env.example` committed for reference. JWT_SECRET hardcoded fallback removed (server now exits if not set). NODE_ENV-based SSL toggle added. JWT_SECRET rotated to fresh 96-char hex.

### Boot log message wrong
Server prints `📧 Super admin login: superadmin@tel-cloud.com / admin123` on startup. Should reflect renamed super_admin (`quiinn@tel-cloud.sg`).

### phone_numbers.whatsapp_phone_id needs UNIQUE+lookup index
Pre-existing deferred item. Multi-tenant correctness blocker before second tenant goes live.

### 401 auth noise on page load
8-16 failed requests fire on every refresh before AuthContext hydrates. Token is still valid (pages render), but wasteful and clutters console. Pre-existing, not caused by any specific feature work. Investigate which components fire fetches before token is available.

### UI permission gating — stub files
Contacts.jsx and Broadcasts.jsx are placeholder "Coming soon" pages. When built, apply the same `hasPermission` pattern used in Chunk 5d Tier 1-5.

### China connectivity — VPN proxy ghost risk
LetsVPN uninstall left a `127.0.0.1:7890` proxy in HKCU registry that broke ALL command-line HTTPS (git, Node). Disabling via `Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings" -Name ProxyEnable -Value 0` fixed it. Document this in any future "developing from China" guide. Reinstalling LetsVPN re-enables the proxy.

---

## Architecture Notes

### Multi-tenancy
- `workspace_type`: `platform` | `client` | `internal` (legacy, being phased out)
- Tel-Cloud Sandbox = workspace_type `internal` (super admin's own workspace, slug `telcloud-main`)
- Tel-Cloud Demo = workspace_type `internal` (production dogfooding workspace, slug `tc-demo`)
- Eque Singapore = workspace_type `client`, billing_exempt=true (local only, not yet on production)
- Test Agency = workspace_type `client`, billing_exempt=false (local only, sample)

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

### Authentication
- Password sign-in: bcrypt hash in `users.password_hash`, lockout after 5 failed attempts (15 min)
- Google sign-in: domain allowlist enforced server-side (`tel-cloud.sg` only). Existing users matched by email; google_id linked on first sign-in. auth_provider tracks 'password' | 'google' | 'both'.
- Production OAuth Client: `131482043793-jthli7dijfjlgnhf5gdaodn947i1ufn6.apps.googleusercontent.com`
- Authorized origins: localhost:5173, Railway URL, Vercel URL, future app.tel-cloud.sg

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

### Auth + Brand + IA refactor (May 6-7, 2026 session)

7 commits. Major shipping push covering authentication, visual identity, and information architecture.

- **44af47d** Pipeline recovery (357 lines from prior uncommitted work)
- **63ab0f7** Google Sign-In feature
  - Migration chunk_22: `google_id` + `auth_provider` columns + partial unique index
  - Server endpoint `POST /auth/google` with `tel-cloud.sg` domain allowlist
  - AuthContext gains `loginWithGoogle()` method
  - main.jsx wraps app with `GoogleOAuthProvider`
- **748d6d7** Login screen redesign
  - Real Tel-Cloud chrome rings logo (radial gradient SVG)
  - Library Indigo `#2d2a7a` primary button
  - Warm cream `ink[50]` background
  - Satoshi display heading "Welcome back"
  - Mobile responsive `clamp()` padding
- **9956387** AdminPanel redesign
  - Logo header with chrome rings
  - Library Indigo create button
  - Refined typography (Satoshi for headings, Inter for body)
  - Subtle 0.5px borders, soft shadows
  - All modals (Create/Edit/Roles/Password) updated to design tokens
- **d49de13** + **e3f21f7** Favicon
  - First attempt: flat circles (rejected — didn't look like the brand)
  - Final: real chrome rings with radial gradients (matches login + AdminPanel logo)
- **77346e8** Nav refactor + PDPA into Settings
  - Top nav reordered to usage-frequency: Inbox · Contacts · Calendar · Scheduled · Broadcasts · Projects · Templates · Analytics · Settings
  - PDPA removed from top nav, added as 13th sub-tab in Settings
  - Cleaner IA matching mature SaaS patterns

Production database changes (manual SQL, not yet in migration runner):
- chunk_22 schema applied to local + Railway production
- super_admin email renamed: `superadmin@tel-cloud.com` → `quiinn@tel-cloud.sg`

Production workspace created:
- Tel-Cloud Demo (slug: `tc-demo`, ENTERPRISE plan, billing_exempt) — for dogfooding/demos, separate from Eque tenant

End state: Brand identity coherent across login → admin → favicon. Authentication has both password and Google paths. Production has Tel-Cloud Sandbox (platform admin) + Tel-Cloud Demo (operator dogfooding). Tech debt accumulated documented in Open Follow-ups.

### Engineering hardening + UI consistency (May 8, 2026 session)

Single-day session, 7 commits. Foundation work to harden the codebase before Tech Provider work begins.

**Secrets and configuration (commit c5f14eb)**
- Installed `dotenv` in server/package.json
- Created server/.env (gitignored) and server/.env.example (committed)
- Removed hardcoded JWT_SECRET fallback from server/index.js — server now exits cleanly if not set rather than running with a known-leaked secret
- Generated fresh 96-char hex JWT_SECRET, stored in local .env
- Added NODE_ENV-based SSL toggle for database connections

**Queue abstraction layer (commit 97fa6c4)**
- New server/queues/ directory with messageQueue.js (interface), postgresQueue.js (current implementation), index.js (provider selector via QUEUE_PROVIDER env var)
- Refactored server/index.js scheduled message worker to use abstraction (queue.claim, queue.claimOne, queue.markSent, queue.markFailed)
- Smoke test verified: scheduled message id 6 went through abstraction cleanly, failed correctly with "No recipient phone number on contact"
- Future SQS swap is now a single new file (sqsQueue.js) plus env var change

**AWS Phase 6 migration roadmap (commit c3bcde9)**
- Appended ~280 lines to TECH_PROVIDER_ROADMAP.md documenting full AWS migration plan
- Target architecture: ap-southeast-1, RDS Postgres Multi-AZ, ECS Fargate, SQS, S3, CloudFront
- 8 phases (6.1 through 6.8) covering account foundation through DNS cutover
- 3-tier cost estimates ($148 / $260 / $1,110 monthly)
- 8-item risk register with mitigations
- Decision points and rollback procedures
- Decision committed: migrate before Tech Provider submission, accept ~4-6 week timeline slip on Meta approval

**Btn -> Button component migration (5 commits: 1d29fa7, 10465a8, c12eaad, 8ae1c1a, 3e09314)**
Migrated 15 files from inconsistent local `function Btn` declarations to a single shared `client/src/components/ui/Button.jsx`. Each file previously had its own ~17-line Btn component with subtle variant differences.

Files migrated (in batch order):
- Batch 1: Routing, BusinessHours, AuditLog, EmailIntegration, AgencyProfile
- Batch 2: SecuritySettings, WhatsAppAPI, ScheduledComposer, RolesPermissions
- Batch 3: Teams, Scheduled, PhoneNumbers
- Batch 4: BulkScheduler, Agents, Projects + delete legacy ui/Btn.jsx

Patterns established and saved to memory:
- `variant="ghost"` (old: 0.5px border) -> `variant="secondary"` (new: bordered)
- `variant="dark"` (old: NAVY) -> `variant="primary"` (new: Library Indigo)
- `variant="success"` and `variant="danger"` preserved 1:1
- `loading={saving}` only on the button that initiates the operation; `disabled={saving}` on Cancel/Discard buttons that should grey out without spinner
- ASCII ellipsis `...` preferred over Unicode `\u2026`
- Mojibake in PowerShell console display does NOT equal mojibake in browser. Don't "fix" UTF-8 quirks unless browser visually confirms breakage.

Net effect: ~280 lines of duplicated button code eliminated. Single source of truth for the entire app's button styling.

**Mobile responsive grid fixes (commit 26a29ca)**
Fixed cramped 2-column layouts on mobile in 6 components. Replaced inline `gridTemplateColumns: '1fr 1fr'` with Tailwind `className="grid grid-cols-1 md:grid-cols-2"` so columns stack vertically below 768px.

Files fixed: ScheduledComposer, Teams, Agents, AuditLog, Routing, EventModal.

Files intentionally NOT fixed (cramped but functional, or super-admin-only):
- AdminPanel.jsx (5 occurrences) - super admin tool, desktop-only use
- BulkScheduler.jsx (1 occurrence) - already verified working visually on mobile
- Projects.jsx (1 occurrence) - small Month/Year dropdowns, fine on mobile

The actual breaking issue was ScheduledComposer (2-column form squeezing TEMPLATE/MESSAGE column to a sliver on phone). Verified fix on 375px-wide DevTools mobile view.

**UI close icon consistency (commit 173e753)**
- Projects.jsx ProjectModal close button: literal `X` character -> `\u2715` (Heavy Multiplication X) for visual consistency with other modals
- Templates.jsx delete button: lowercase `x` -> `\u2715` (28x28 red square button, semantically a delete action)
- Contacts.jsx tag-remove button (small inline `x` in tag chips) intentionally left as-is - different design context

End state: Engineering foundation is significantly hardened. dotenv-managed secrets, pluggable queue infrastructure, single-source-of-truth button component, mobile-responsive across all primary pages. AWS migration roadmap documented. Ready to proceed with Tech Provider Phase 1 (landing site, legal docs) and AWS Phase 6 (account setup, RDS provisioning) in parallel.

Tech debt acknowledged but not addressed today:
- server/node_modules/.package-lock.json still tracked by git (should be in .gitignore)
- chunk_22 still applied to prod manually rather than via migration runner
- 401 auth noise on page load (8-16 failed pre-auth requests)
- Mojibake in source files (intentional skip — renders fine in browser)
- AdminPanel/BulkScheduler/Projects.jsx have inline 2-col grids (intentional skip per triage)
- In-app password change UI (Phase A3, still pending)
- demo@tel-cloud.sg Google Workspace alias (still pending)