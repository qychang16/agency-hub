# Tech Provider Roadmap

Y.E.C Consultancy / Tel-Cloud platform path to Meta WhatsApp
Business Platform Tech Provider status.

Created: 26 Apr 2026
Last updated: 7 May 2026 (auth + brand redesign session)
Owner: Quiinn Chang (Director, Y.E.C Consultancy)
Target: Direct Tech Provider with Meta (not via BSP)
Estimated total timeline: 2-3 months from start

---

## Strategic context

Y.E.C Consultancy operates Tel-Cloud, a SaaS platform for Singapore
recruitment agencies to manage WhatsApp communications with
candidates and clients. First tenant: Eque Singapore (UEN
202231751D).

To onboard clients quickly with low friction, Tel-Cloud must
implement Embedded Signup. Embedded Signup requires Meta Tech
Provider status.

Two paths considered:
- Path A: Direct Tech Provider with Meta (chosen)
- Path B: Via BSP partner (Gupshup/360dialog/Twilio/Infobip)

Path A chosen for: full commercial control, no BSP markup, direct
Meta relationship, long-term independence. Trade-off: longer
timeline, more upfront infrastructure work.

---

## Phase 1 - Foundation (Week 1-2)

### Step 1: Domain registration
- [x] Buy tel-cloud.sg via Vodien (2 years, ~SGD $76)
      Bought: 26 Apr 2026
- [x] Complete SGNIC VerifiedID@SG (verified May 2026)
- [ ] Enable auto-renew in Vodien dashboard
- [ ] Optional defensive: tel-cloud.com.sg

Note: tel-cloud.com is taken by US company TELCLOUD (CPaaS). Using
.sg avoids brand collision and signals Singapore origin.

### Step 2: Meta account security
- [x] Y.E.C Meta Business verified
- [x] 2FA enabled on personal Facebook (Y.E.C admin)
      Done: 26 Apr 2026
- [ ] Confirm "1 out of 1 people" shows in Y.E.C Security Center
      (may take 24h to sync)

### Step 3: Email infrastructure
- [x] Google Workspace Business Starter set up for tel-cloud.sg
- [x] Primary mailbox: quiinn@tel-cloud.sg
- [x] Aliases configured: tech, support, legal, hello, noreply
- [ ] Add demo@tel-cloud.sg alias (needed for Tel-Cloud Demo
      workspace director account on production)

### Step 4: Legal documents
- [ ] Privacy Policy (PDPA-compliant, mentions WhatsApp data handling)
- [ ] Terms of Service (governing law: Singapore)
- [ ] Acceptable Use Policy (forbids spam, illegal content)

Approach options:
- Termly.io / iubenda generators (cheap, ~$10-20/month)
- Singapore lawyer on Fiverr (~SGD $200-400, more rigorous)
- DIY from templates (free, time-intensive, risky)

Recommendation: lawyer for first version, Termly for updates.

### Step 5: Marketing landing site
- [x] Vercel hosting platform set up (currently used for app frontend)
- [ ] 1-page marketing site at tel-cloud.sg root
      Sections: Hero, Features, Pricing (or "Contact"), Footer
      Footer must link: Privacy Policy, ToS, Contact
- [ ] DNS: point tel-cloud.sg from Vodien to Vercel
- [ ] SSL certificate (Vercel auto-issues via Let's Encrypt)
- [ ] Decide: app stays at agency-hub-teal.vercel.app or moves to
      app.tel-cloud.sg subdomain (Google OAuth origins already
      include https://app.tel-cloud.sg in anticipation)

---

## Phase 2 - Meta App Setup (Week 3)

### Step 6: Y.E.C as WhatsApp sender
Before becoming Tech Provider, register one WhatsApp sender for
Y.E.C itself. Required by Meta.

- [ ] Register Y.E.C WhatsApp number via WhatsApp Self Sign-up
- [ ] Test send/receive from Y.E.C number
- [ ] Approve at least 1 Y.E.C template

### Step 7: New Meta App for Tech Provider
Critical: do NOT reuse existing Meta apps. Create new.

- [ ] Go to developers.facebook.com/apps
- [ ] Create new app
      Name: Tel-Cloud (must NOT contain "WhatsApp")
      Contact email: tech@tel-cloud.sg
      Use case: Other
      Type: Business
      Linked portfolio: Y.E.C Consultancy
- [ ] Add WhatsApp product to app
- [ ] Configure app:
      Privacy Policy URL: https://tel-cloud.sg/privacy
      Terms of Service URL: https://tel-cloud.sg/terms
      App icon: Tel-Cloud logo (chrome rings, already designed)
      App description: client-facing, professional

App name "Tel-Cloud" and portfolio name "Y.E.C Consultancy" will be
visible to clients during Embedded Signup. Keep professional.

---

## Phase 3 - Embedded Signup (Week 4-5)

### Step 8: Backend changes
- [ ] Add Meta JS SDK to frontend
- [ ] Add OAuth callback endpoint to backend
- [ ] Store WABA credentials per tenant (workspace) in DB
- [ ] Auto-configure webhooks for new senders
- [ ] Migrate existing manual-credentials code path to legacy mode

### Step 9: Frontend changes
- [ ] Replace "Paste Meta credentials" form with "Connect WhatsApp"
      button
- [ ] Embedded Signup popup integration
- [ ] Status display for connection state
- [ ] Phone number selection / management post-connect

### Step 10: Testing
- [ ] Test Embedded Signup flow end-to-end on Y.E.C account
- [ ] Test on a clean test account
- [ ] Test failure modes (declined permissions, cancelled flow)

---

## Phase 4 - Submit for Review (Week 5-6)

### Step 11: Meta App Review submission
- [ ] Request whatsapp_business_management permission
- [ ] Request whatsapp_business_messaging permission
- [ ] Provide screencast of Embedded Signup flow
- [ ] Provide use case description
- [ ] Confirm data handling complies with Meta Platform Terms

### Step 12: Wait for review
- [ ] Meta processing typically 2-4 weeks
- [ ] Address any rejection feedback promptly
- [ ] Resubmit if needed

---

## Phase 5 - Live (Week 9-10)

### Step 13: Tech Provider approved
- [ ] Migrate Eque from manual credentials to Embedded Signup
- [ ] Migrate any other workspaces
- [ ] Onboard first new client via Embedded Signup
- [ ] Document client onboarding playbook

### Step 14: Optional - Tech Partner upgrade
After 5+ paying clients with proven volume, apply for Tech Partner
status (next tier above Tech Provider). Gives expanded
capabilities and Meta marketing co-promotion.

---

## Eque transition strategy

Eque is the pilot client and currently using the manual-credentials
path in Tel-Cloud. Two options for transition:

Option A: Manual now, migrate later
- Eque pastes their own Meta credentials into Tel-Cloud now
- Continue while Tech Provider status is being built
- Migrate Eque to Embedded Signup once Tel-Cloud is approved
- Risk: requires Eque to do Meta verification themselves
- Benefit: Eque gets live in days, generates real usage data

Option B: Wait for Tech Provider
- Eque waits 2-3 months until Tel-Cloud is Tech Provider
- Onboards via Embedded Signup from day 1
- Clean experience, no migration
- Risk: Eque may lose patience or use a competitor

Decision: Option A. Eque is motivated and willing. Real usage data
helps Tel-Cloud's Meta app review.

---

## Pricing model decisions (TBD)

Open questions to decide before launching to paying clients:

1. Subscription model
   - Per-workspace flat fee per month?
   - Per-agent seat fee?
   - Hybrid (base + per-agent)?

2. Conversation pricing
   - Pass through Meta rates 1:1?
   - Markup per conversation? (industry: 0-30%)
   - Bundle with subscription up to N conversations?

3. Payment infrastructure
   - Stripe Singapore (most common)
   - HitPay (local Singapore alternative)
   - Manual invoicing (start, automate later)

4. Free tier / trial
   - 14-day free trial?
   - Free tier with limited conversations?
   - Pilot pricing for first N clients?

5. Eque-specific terms
   - Founder discount as first client?
   - Long-term contract discount?
   - Equity/ownership in Y.E.C?

---

## Key contacts and resources

Domain: Vodien dashboard (tel-cloud.sg, expires Apr 2028)
Hosting:
- Backend: Railway (agency-hub-production-e5af.up.railway.app)
- Frontend: Vercel (agency-hub-teal.vercel.app)
Code: github.com/qychang16/agency-hub
Y.E.C UEN: 202231751D
Meta Business Account: linked to personal Facebook with 2FA

External services to set up:
- [x] Google Workspace (email)
- [x] Vercel (frontend hosting)
- [x] Railway (backend hosting)
- [x] Google Cloud Console (OAuth Client ID for Sign in with Google)
- [ ] Termly.io or lawyer (legal docs)
- [ ] Stripe Singapore or HitPay (payments)
- [ ] Resend or SendGrid (transactional email — needed for password
      reset, invites, broadcast emails, 2FA codes)

Meta documentation:
- Tech Provider: developers.facebook.com/documentation/business-messaging/whatsapp/solution-providers/get-started-for-tech-providers
- Embedded Signup: developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup-flow
- App review process: developers.facebook.com/docs/app-review

---

## Timeline summary

Week 1: Domain, 2FA, email, policies
Week 2: Landing site live
Week 3: Y.E.C WhatsApp sender, new Meta app
Week 4-5: Embedded Signup engineering
Week 6: Submit for review
Week 7-9: Wait, address feedback
Week 10: Approved, migrate Eque

Total: ~2.5 months realistic, 4 months conservative.

---

## Risk register

1. Meta app review rejection
   Mitigation: thorough first submission, professional polish,
   working Embedded Signup demo

2. ~~SGNIC VerifiedID lapse (21 days from domain purchase)~~
   Resolved May 2026: VerifiedID@SG verified.

3. Eque churns waiting for Tech Provider
   Mitigation: Option A transition (manual now), regular updates

4. Singapore PDPA non-compliance
   Mitigation: lawyer-reviewed Privacy Policy

5. Trademark dispute from US TELCLOUD company
   Mitigation: .sg TLD avoids direct collision; trademark Tel-Cloud
   in Singapore via IPOS if budget allows (~SGD $400)

6. Personal Facebook account compromise = Y.E.C compromise
   Mitigation: 2FA on (done), separate Y.E.C admin account
   (Phase 2 hardening), recovery codes printed and stored offline

7. Working from China with broken VPN setup
   Discovered May 2026: LetsVPN uninstall left registry proxy at
   127.0.0.1:7890 that blocked all command-line HTTPS (git, Node).
   Fix: Set-ItemProperty HKCU:\...\Internet Settings -Name ProxyEnable
   -Value 0. Reinstalling LetsVPN re-enables it.
   Mitigation: prefer system-level VPNs (Astrill, ExpressVPN) over
   proxy-based (LetsVPN, Clash) for development.

---

## Success criteria

Phase 1 done when: tel-cloud.sg landing site live, policies hosted,
Google Workspace working, all admin accounts secured.

Phase 2 done when: New Meta App created and pending review, Y.E.C
has its own WhatsApp sender, Embedded Signup integrated locally.

Phase 3 done when: Meta approves Tech Provider status.

Final goal: First non-Eque client onboarded via Embedded Signup in
under 5 minutes from clicking "Connect WhatsApp" to receiving
test message.

---

End of roadmap.

---

## Internal Architecture - SaaS Multi-Tenant Foundation

Added: 30 Apr 2026
Context: Decisions made during Template Library build, before
proceeding with Meta submission flow.

This section captures the platform's internal architecture decisions
that run in parallel with the Tech Provider phases above. The Tech
Provider work is about Meta-facing approvals; this work is about
making Tel-Cloud itself a real multi-tenant SaaS rather than a
single-tenant app dressed up as one.

---

### Architectural decisions

1. **Master / Copy pattern (Pattern A).**
   Configuration items the platform owns (templates, quick replies,
   labels, role permissions) live in platform-level master tables.
   When a tenant signs up, copies are seeded into their workspace
   tables. Tenants can customise or delete their copies; the master
   stays clean. Eque is treated as a tenant, not a master.

2. **Eque demoted to normal tenant.**
   Eque was the prototype workspace used to design the tenant UX.
   Inspection on 30 Apr 2026 confirmed Eque contains only platform
   defaults (3 standard teams, 7 standard business hours, 5 standard
   role permissions) plus 5 phone_numbers and 3 projects which are
   Eque-specific customer data. Eque has zero customer-facing data
   (contacts, conversations, candidates) at this point, making the
   demotion safe and PDPA-clean.

3. **All future curation happens at the platform level.**
   From 30 Apr 2026 onwards, no new templates, quick replies, or
   labels are added inside Eque's workspace. New content is added
   to the master libraries via the super admin UI (to be built),
   then auto-pushed to all tenants including Eque.

4. **Approved templates are immutable.**
   Once a tenant submits a template to Meta and Meta approves it,
   the body, header, footer, and buttons of that template become
   read-only. The tenant must clone-and-resubmit to make changes.
   Required by Meta policy: sending content under an approved
   template name that differs from what was approved is a violation.

5. **Super admin can view/operate inside any tenant workspace.**
   With explicit guardrails: every action is audit-logged with the
   super admin's identity (not the impersonated tenant user), and
   tenants must agree in ToS that platform operators may access
   their workspace for support purposes. PDPA compliance requires
   that tenant data is never copied into another tenant's workspace,
   even temporarily.

---

### Starter pack contents

What gets seeded into a new tenant's workspace on signup:

**Configuration (copied from platform masters):**
- All active rows from `template_library` -> `templates` (status: draft)
- All active rows from `quick_reply_library` -> `quick_replies` (TBD: needs creation)
- All active rows from `label_library` -> `labels` (TBD: needs creation)
- 5 default rows in `role_permissions` (existing logic, kept)
- 7 default rows in `business_hours` (existing logic, kept)
- 3 default rows in `teams` (existing logic, kept)
- 1 default row in `routing_rules` (existing logic, kept)
- 1 default row in `security_settings` (existing logic, kept)

**Customer data (never seeded, always tenant-owned):**
- contacts, conversations, messages, scheduled_messages
- projects, project_members
- job_orders, job_applications, placements
- pdpa_records, calendar_events
- audit_log, notifications
- phone_numbers (always tenant's own real numbers)
- users (always tenant's own staff)

---

### Internal phases (parallel to Tech Provider phases)

#### Phase I1 - Starter pack capture and auto-seed (Week 1)
- [ ] Create `quick_reply_library` master table
- [ ] Create `label_library` master table
- [ ] Curate initial content for both (mirror style of template_library)
- [ ] Modify `POST /admin/workspaces` to copy from all 3 masters
      into new tenant on signup
- [ ] Reseed Eque from masters (since Eque was created before this)
- [ ] Verify Eque now has 12 starter templates as drafts

Note: superseded by v2 model. See "Internal Architecture v2" section.

#### Phase I2 - Approved template locking (Week 2)
- [ ] Add status check to `PATCH /templates/:id`: reject any body/
      header/footer/buttons edit if status='approved'
- [ ] TemplateEditor UI: disable edit fields when status='approved'
- [ ] Replace Save button with "Clone for re-approval" when status
      is approved
- [ ] Add audit log entry for any approved-template edit attempts
      (security signal)

#### Phase I3 - Super admin library management UI (Week 3)
- [ ] Platform Admin > Master Libraries page
- [ ] CRUD for template_library, quick_reply_library, label_library
- [ ] Visual diff: "X tenants have a draft copy of this; Y tenants
      have an approved copy you can't change"
- [ ] Replace migration-script workflow for adding library content

#### Phase I4 - Super admin tenant view + PDPA controls (Week 4)
- [ ] "Enter workspace" button next to each tenant in Platform Admin
- [ ] JWT claim `acting_workspace_id` to override default workspace
- [ ] Banner in tenant UI when super admin is operating: "Platform
      Admin viewing this workspace - all actions logged"
- [ ] Audit log entries clearly attribute super admin identity
- [ ] Add ToS clause permitting platform operator access for support
- [ ] Add tenant-facing audit log of when platform staff entered
      their workspace (PDPA transparency)

#### Phase I5 - Meta submission flow (Week 5)
- [ ] `POST /templates/:id/submit-to-meta` endpoint
- [ ] Webhook listener for `message_template_status_update`
- [ ] "Submit to Meta" button in TemplateEditor when status=draft
- [ ] Status transitions: draft -> pending -> approved/rejected
- [ ] Rejection reason displayed to tenant with Meta's feedback

---

### Authentication enhancements (separate workstream)

These are independent of the Tech Provider path but needed before
broad customer launch.

#### Phase A1 - Google OAuth login (SHIPPED 7 May 2026)
- [x] Google Cloud project + OAuth consent screen for Tel-Cloud
- [x] `/auth/google` endpoint (server-side ID token verification with
      domain allowlist)
- [x] Link Google identities to existing tenant users by email match
      (matches by email; populates google_id on first sign-in;
      auth_provider becomes 'both')
- [ ] Per-workspace setting: require Google login / allow password
      (deferred — not blocking)
- [x] "Sign in with Google" button on login page (uses
      @react-oauth/google)
- [x] Verified existing password users not locked out
- [x] Production end-to-end verified: quiinn@tel-cloud.sg signed
      in via Google, landed in AdminPanel as super_admin
- [ ] Local dev: dotenv setup so GOOGLE_CLIENT_ID persists across
      reboots (currently must $env: set before each server start)

#### Phase A2 - Verification codes
Scope to be defined before building. Possibilities:
- Email verification on signup (recommended for new tenants)
- 2FA via authenticator app (recommended for super admin)
- 2FA via email code (alternative for tenant users)
- Password reset codes (must-have)

Decision needed: which subset to ship first, and via what channel.
Email infrastructure decision: Resend or SendGrid (deferred).

#### Phase A3 - In-app password change UI (NEW, added 7 May)
Discovered painfully during 7 May session: no UI for users to
change their own password. Reset required PowerShell + bcrypt +
psql recovery dance.

- [ ] Profile/settings menu with "Change password" option
- [ ] Verify current password before allowing change
- [ ] Enforce password strength rules (already in security_settings)
- [ ] Forgot password email-based reset flow (depends on A2 email
      infra)

---

### PDPA compliance principles

These rules apply to every architectural decision going forward:

1. **No cross-tenant data ever.** A tenant's customer data
   (contacts, conversations, messages, candidates) cannot be visible
   to or accessible by any other tenant under any circumstance.

2. **Super admin access is logged and disclosed.** When platform
   staff enter a tenant workspace, the action is audit-logged on
   both sides (platform audit log AND tenant-visible audit feed).
   Tenants can see when their data was accessed by platform staff.

3. **Master library content is non-personal.** Templates in the
   master library use placeholder variables, not real names, real
   phone numbers, or real client identifiers. This is enforced by
   review before any item is added to a master library.

4. **Starter pack copies have no inherited customer data.** Even
   if the master library somehow contained a real name (it
   shouldn't), the auto-seed process only copies template structure
   to new tenants. No contacts, no message history, no PII.

5. **Right to erasure honoured at tenant level.** When a tenant
   asks to delete a contact, that contact is hard-deleted from the
   tenant's workspace. Master library is unaffected.

---

### Sequencing relative to Tech Provider phases

These internal phases (I1-I5, A1-A2) can run in parallel with the
external Tech Provider phases (1-5 above). However:

- I1 (starter pack auto-seed) is superseded by v2 architecture.
- I2 (approved template locking) must complete before I5 (Meta
  submission), otherwise tenants could send modified content under
  an approved template name and trigger Meta violations.
- I4 (super admin tenant view) should complete before second tenant
  signs up, otherwise support requests will be unworkable.
- A1 (Google OAuth) shipped 7 May 2026.
- A3 (password change UI) needs to ship before customer launch.

---

End of internal architecture addendum.

---

## Internal Architecture v2 - Three Surfaces Model

Added: 30 Apr 2026
Status: Supersedes the v1 addendum above for any conflicting details.
The v1 addendum stays in place as historical record of decisions made.

This section captures the architectural overhaul made after we
researched Meta's WhatsApp Cloud API capabilities directly and
realised the earlier "auto-submit at signup" plan was based on an
incomplete understanding of what Meta allows.

---

### Key insight from Meta documentation

Meta's official Template Library is exposed programmatically via:

- `GET /message_template_library` - browse Meta's catalogue
- `POST /<WABAID>/message_templates` with `library_template_name`
  field - create from library on a specific WABA, returns
  status: APPROVED immediately, no 24-hour wait

This means there are TWO distinct fast-approval paths for templates:

1. Meta's own library (instant approval, but Meta-curated content)
2. Custom templates (tenant submits and waits 24h on their WABA)

Meta's library is currently limited to UTILITY and AUTHENTICATION
categories. Available industries: E_COMMERCE, FINANCIAL_SERVICES.
No recruitment-specific templates exist in Meta's library and Tel-
Cloud cannot contribute to Meta's library (it is Meta-curated, not
user-extensible).

This means Tel-Cloud's value is the recruitment-vertical content
gap: 34 curated templates covering interview, offer, placement,
client coordination - which Meta's library does not address.

---

### The three-surfaces model

Every tenant's Templates page exposes three distinct content sources:

#### Surface 1: Meta Library (powered by Meta's API)

- Live data, fetched on-demand from `GET /message_template_library`
- Displayed in a dedicated UI section labelled "Meta Library"
- Filter by topic, use case, industry, language
- Tenant clicks "Add to my workspace" -> Tel-Cloud calls
  `POST /<tenant-WABA>/message_templates` with library_template_name
- Meta returns status APPROVED immediately
- Template appears in tenant's templates list with source='meta_library'
- Body is fixed (Meta-locked); only buttons and certain parameters
  customisable per Meta's allowed inputs (add_contact_number,
  add_security_recommendation, code_expiration_minutes, etc.)
- Practical use: utility templates (payment confirmations, delivery
  updates, account verification) that recruitment agencies might
  send alongside their recruitment communications

#### Surface 2: Tel-Cloud Suggested Templates (master library)

- Stored in Tel-Cloud's `template_library` table (already exists with
  34 templates)
- Curated by Tel-Cloud super admin, recruitment-vertical content
- Tenant clicks "Use this template" -> copies into tenant's
  `templates` table with source='tel_cloud_library', status='draft'
- Tenant edits if needed (Meta requires content match approved version,
  so editing post-approval is forbidden but pre-submission is fine)
- Tenant clicks "Submit to Meta" -> Tel-Cloud calls
  `POST /<tenant-WABA>/message_templates` with custom body
- Standard 24-hour Meta approval applies (per tenant's own WABA)
- Once approved, locked from edits (compliance with Meta policy)
- Practical use: the recruitment-specific templates we've drafted
  (interview invitation, offer letter, placement confirmation, etc.)

#### Surface 3: My Templates (tenant-owned)

- Stored in tenant's `templates` table with source='tenant'
- Tenant drafts entirely from scratch
- Same submit-to-Meta flow as Surface 2
- Standard 24-hour approval, locked once approved
- Practical use: tenant-specific custom wording, brand voice
  variations, edge cases not covered by Tel-Cloud's library

---

### Schema changes required

Add to `templates` table:

- `source VARCHAR(20) NOT NULL DEFAULT 'tenant'`
  Values: 'meta_library' | 'tel_cloud_library' | 'tenant'

- `library_template_name VARCHAR(100)`
  For source='meta_library': Meta's library_template_name string
  For source='tel_cloud_library': references template_library.template_key

- `meta_template_id VARCHAR(255)`
  Already exists. Stores Meta's returned template ID after submission.

- `submitted_at TIMESTAMP`
  When the tenant submitted to Meta.

- `approved_at TIMESTAMP`
  Already exists.

- `meta_status VARCHAR(20)`
  Mirrors Meta's status: APPROVED | PENDING | REJECTED | PAUSED |
  DISABLED. Updated via webhook.

Add `template_library` already has audience VARCHAR(20) from earlier
work. No further changes needed.

---

### Reset before phase work begins

Eque's `templates` table currently has 34 rows from the v1 auto-seed
that we now realise was premature (it copied templates as drafts
without a path to submission). These need to be wiped before
implementing the new model:

- Delete all rows from Eque's templates table where source IS NULL
  or source='tel_cloud_library' AND status='draft' (the auto-seeded
  ones). This restores Eque to a clean tenant state.
- The `template_library` master with 34 rows stays untouched.
- After wipe, Eque will browse Tel-Cloud Suggested via UI like any
  other tenant and explicitly choose which templates to copy in.

This wipe runs as a new migration: chunk_8_template_reset_v1.

---

### Internal phases (revised, supersedes v1's I1-I5)

#### Phase II1 - Reset and schema prep
- [ ] Wipe Eque's auto-seeded templates (chunk_8_template_reset_v1)
- [ ] Add `source`, `library_template_name`, `submitted_at`,
      `meta_status` columns to `templates` table
- [ ] Update existing endpoints to populate `source='tenant'` for
      backward compatibility on any new template created

#### Phase II2 - Meta Library integration (Surface 1)
- [ ] Backend: `GET /api/meta-library` proxy to
      `GET /message_template_library` with filter passthrough
- [ ] Backend: `POST /api/meta-library/install` calls
      `POST /<WABAID>/message_templates` with library_template_name
- [ ] Frontend: "Meta Library" tab/button on Templates page
- [ ] Frontend: Filter UI matching Meta's topic/usecase/industry
- [ ] Frontend: Preview pane shows Meta library template details
- [ ] On install: row created in `templates` with source='meta_library',
      status='approved', meta_template_id populated
- [ ] Cache Meta library results per language for 24h to reduce API
      load

#### Phase II3 - Tel-Cloud Suggested submit-to-Meta flow (Surface 2)
- [ ] Backend: `POST /api/templates/:id/submit-to-meta` endpoint
- [ ] Calls `POST /<tenant-WABA>/message_templates` with custom body
- [ ] Stores meta_template_id and updates status to 'pending'
- [ ] Webhook listener for `message_template_status_update` and
      `message_template_components_update`
- [ ] On webhook: update meta_status, status, approved_at, etc.
- [ ] Frontend: "Submit to Meta" button on draft templates from Tel-
      Cloud Suggested
- [ ] Frontend: pending/approved/rejected status badges
- [ ] Frontend: rejection reason displayed with Meta's feedback

#### Phase II4 - My Templates submit-to-Meta flow (Surface 3)
- [ ] Same submit-to-Meta endpoint reused for source='tenant'
- [ ] No additional UI work beyond what Phase II3 delivers - the
      "Submit to Meta" button just appears for tenant-source drafts
      too
- [ ] Validate template body against Meta's content rules client-
      side before submission to reduce rejection rate

#### Phase II5 - Approved template locking
- [ ] In `PATCH /templates/:id`: reject body/header/footer/buttons
      edits if status='approved' (regardless of source)
- [ ] Frontend: TemplateEditor disables edit fields when approved
- [ ] Frontend: "Clone for re-approval" creates a new draft from an
      approved template, leaving original intact
- [ ] Audit log entries for any approved-template edit attempts

#### Phase II6 - Templates page UI restructure
- [ ] Single Templates page with three sections clearly labelled:
      Meta Library, Tel-Cloud Suggested, My Templates
- [ ] Visual differentiation per source (icon + colour)
- [ ] Filter by status (draft, pending, approved, rejected)
- [ ] Status badges using existing design tokens
- [ ] Empty states per section with onboarding hints

---

### Phases dropped from v1 addendum

The following from the v1 addendum are dropped or absorbed:

- **I1 (auto-seed at signup)**: dropped. Replaced by tenants
  explicitly browsing each surface and choosing what to install. No
  surprises, tenant agency preserved.
- **I3 (super admin library management UI)**: deferred. We can
  manage `template_library` via migrations for now. Build a UI later
  when content updates become frequent.
- **I4 (super admin tenant view + PDPA controls)**: deferred to a
  separate workstream. Not blocked by template work.
- **I5 (Meta submission flow)**: replaced and expanded as Phases II3
  and II4 above.

---

### Phase ordering and dependencies

II1 must precede everything (schema prep is foundational).
II2, II3, II4 can run in parallel after II1.
II5 must precede tenants relying on approved-template locking; can
ship before II3/II4 to harden the existing draft endpoints first.
II6 ties it all together visually; ship last.

Estimated total: 2-3 weeks for II1 through II6 if focused.
Realistic: 4-5 weeks given other commitments and PDPA review.

---

### What this addendum does NOT cover

Authentication enhancements (Google OAuth shipped 7 May 2026,
verification codes deferred, super admin tenant view deferred,
in-app password change UI deferred) remain as separate workstreams
from the v1 addendum, untouched by this overhaul.

The starter pack concept itself is dropped. Tenants no longer get
auto-seeded content. Instead they browse the three surfaces on
first login and install what they want. This is more honest about
where content comes from and respects tenant agency.

---

End of v2 addendum. Implementation begins with Phase II1.

---

## Build log (outside roadmap phases)

This section tracks product features shipped that weren't planned in the
phased roadmap above. Tracking them here so future sessions have full
context on what's already built.

### 2 May 2026 — Calendar v1 + Send Template upgrades + Phase 4 Reminders + Calendar Chunk D

Single-day push, 21 commits.

**Calendar v1** (8 commits, earlier in day)
- New /calendar page with month grid, prev/next navigation, month/year dropdowns
- Event types table seeded: Interview, Client Meeting, Candidate Meeting,
  Internal, Other (each with bg/fg colors)
- POST/PATCH/DELETE/GET /calendar endpoints, GET /event-types
- EventModal with conversation linker, type picker, date/time/location/notes
- Bidirectional jump: open conversation from calendar event, see linked
  events in conversation drawer
- Migration chunk_13_calendar_v1 + chunk_13b_calendar_perm_jsonb_v1

**Send Template Phase 2 — Smart pattern autofill**
- Send Template flow auto-fills variables from linked event when
  conversation has events
- Pattern matcher: name/candidate/customer/client -> contact_name;
  date variants -> event_date; time variants -> event_time;
  venue/location/place -> location; event/eventtitle -> event_title
- AUTO pill + yellow input background indicates auto-filled fields
- Re-runs on event change, preserves manual edits

**Send Template Phase 3 — Explicit event_field_map in template editor**
- Templates.jsx: new event field mapping dropdown next to each variable
- Options: Manual fill | Contact name | Event date | Event time |
  Event venue | Event title
- Backend bug fixed: normaliseVariables in server/index.js was stripping
  event_field_map. Now preserves with whitelist validation
- DB JSONB structure:
  variables = { ordered, defaults, labels, event_field_map }
- SendTemplate.jsx: resolveVarToEventField checks explicit map first,
  falls back to pattern matcher

**Phase 4 — Event Reminders (THE big build, 1063 lines, commit a34cfab)**

Migration chunk_14_event_reminders_v1:
- New event_reminders table (workspace_id, event_id, scheduled_message_id,
  template_id, offset_hours, status, created_by)
- CHECK: offset_hours in (3, 12, 24)
- CHECK: status in ('active', 'sent', 'cancelled')
- CASCADE on event delete

Backend helpers:
- computeReminderSendTime: subtract offset hours from event datetime in
  SGT. Fixed timezone bug: pg DATE column converted to JS Date at local
  midnight, .toISOString() shifted by server TZ. Solution: use local-time
  accessors (getFullYear/getMonth/getDate) when input is Date object.
- renderReminderBody: re-renders template with current event data +
  event_field_map auto-fill, substitutes {{name}} and {{1}} placeholders
- cancelReminderForEvent: marks scheduled_message + event_reminders
  cancelled (idempotent)
- requeueReminderForEvent: cancels old + creates fresh with new send time

New endpoints:
- POST /calendar/:id/reminder (validates conversation linked, template
  approved, offset valid, send time not past)
- DELETE /calendar/:id/reminder
- GET /calendar/:id (returns event + reminder details)

PATCH /calendar/:id extended:
- Date/time change -> requeueReminderForEvent
- Conversation unlinked -> cancelReminderForEvent

Scheduled-Message Worker (was MISSING entirely before this session):
- Polls every 60s, batch 20
- Atomic claim via UPDATE WHERE status='pending' to prevent double-send
- For reminders: re-renders body with fresh event data at send time
- Calls existing sendWhatsAppMessage helper
- On success: marks scheduled_message sent, inserts messages row, updates
  conversation last_message_preview, marks reminder sent
- On failure: marks failed with reason, never crashes
- Boots inside httpServer.listen callback

Frontend:
- EventModal extended with Reminder section showing existing reminder or
  prompting to schedule one (with conditional state messages)
- New ReminderModal: template picker (approved only), offset buttons
  (3h/12h/24h with smart-disable for past offsets), live preview using
  event_field_map autofill, all-offsets-invalid fallback message

Verified end-to-end:
- Schedule reminder for 06 May 14:00 event with 3h offset -> queues for
  06 May 11:00 SGT
- Change event time 12:45am -> 02:00pm -> reminder requeued from
  '05 May 21:45' to '06 May 11:00' SGT
- Manually inserted past-due message -> worker fired within 60s, marked
  failed ('Meta credentials not configured') without crashing
- Cancel reminder -> scheduled_message + event_reminders both cancelled

**Calendar Chunk D — Polish (commit b47d5bd)**
- Filter chips: multi-select chips above grid by event type, with color
  dots, Clear button when active filters
- +N more popover: clickable button opens popover anchored near cell,
  lists all events for that day sorted by time, click event to open in
  EventModal, click backdrop or X to dismiss
- Mobile schedule view (responsive at <768px):
  - isMobile prop wired App.jsx -> Calendar.jsx
  - mobileDayList memo: days with events + today, sorted
  - Empty-state fallback: today + 7 placeholder days when month has no events
  - Vertical day cards with date badge, weekday label, event count
  - Today marker with accent color + 'TODAY' pill
  - Event pills full-width, color-coded by event type
  - Floating + button (FAB) bottom-right opens new event for today
  - Tap day header to add event for that specific date
  - Filter chips and month nav wrap naturally on narrow widths

### 6-7 May 2026 — Auth + Brand redesign + Nav refactor + Production deployment

Multi-day session, 7 commits to master + significant production changes.

**Google Sign-In end-to-end (commit 63ab0f7)**
- Migration chunk_22_google_auth: google_id (TEXT), auth_provider
  (VARCHAR DEFAULT 'password'), partial unique index on google_id
- Server endpoint POST /auth/google with google-auth-library.
  OAuth2Client.verifyIdToken with audience check.
- Domain allowlist (server-side): GOOGLE_ALLOWED_DOMAINS = ['tel-cloud.sg']
- Behaviour: matches existing user by email, populates google_id on first
  sign-in, sets auth_provider to 'both' if user already had password
- AuthContext: new loginWithGoogle(idToken) function exposed
- main.jsx: wraps App with GoogleOAuthProvider from @react-oauth/google
- Production verified end-to-end: quiinn@tel-cloud.sg signed in, landed
  in AdminPanel as super_admin

**Login screen redesign (commit 748d6d7)**
- Real Tel-Cloud chrome rings logo (radial gradient SVG copied from
  Topbar)
- Library Indigo #2d2a7a primary button (matches design tokens)
- Warm cream ink[50] background
- Satoshi display heading "Welcome back"
- "Sign in with Google" button below password form (uses
  @react-oauth/google's GoogleLogin component)
- Mobile responsive padding via clamp()

**AdminPanel redesign (commit 9956387, 355 insertions / 133 deletions)**
- Logo header with chrome rings + "PLATFORM ADMIN / SUPER ADMIN" badge
- Library Indigo "+ Create workspace" button
- Refined typography (Satoshi for "Workspaces" heading, Inter for body)
- Subtle 0.5px borders, soft shadows from design tokens
- All four modals (Create, Edit, Roles, Password Reveal) updated
- Filter pills use ink[900] for active state (deep ink, not navy)
- Status badges use semantic.successSoft / dangerSoft tokens
- Plan badges use accent.soft (light indigo)

**Favicon (commits d49de13, e3f21f7)**
- First attempt: flat circles. Rejected — looked nothing like the brand.
- Final: real chrome rings with radial gradients at 32x32 viewBox.
  Same SVG structure as login + AdminPanel logo, just stripped highlight
  overlays which become invisible at favicon sizes.

**Nav refactor + PDPA into Settings (commit 77346e8)**
- Top nav reordered to usage-frequency: Inbox, Contacts, Calendar,
  Scheduled, Broadcasts, Projects, Templates, Analytics, Settings
- PDPA removed from top nav, added as 13th sub-tab in Settings (with
  shield icon, visible to all users to match prior behaviour)
- Settings.jsx: import added, icon added, TABS entry added, render case
  added
- App.jsx pdpa lazy import + case left in place as harmless dead code

**Production database changes (manual SQL, applied during session)**
Applied to BOTH local DB and Railway production DB:
```sql
ALTER TABLE users
  ADD COLUMN google_id TEXT,
  ADD COLUMN auth_provider VARCHAR(20) DEFAULT 'password';

CREATE UNIQUE INDEX users_google_id_key
  ON users (google_id)
  WHERE google_id IS NOT NULL;

UPDATE users
  SET auth_provider = 'password'
  WHERE auth_provider IS NULL;

UPDATE users
  SET email = 'quiinn@tel-cloud.sg'
  WHERE email = 'superadmin@tel-cloud.com';
```

These changes are NOT yet embedded in the migration runner code. Tech
debt: add chunk_22 to runner with IF NOT EXISTS guards before next major
deploy.

**Production workspace created**
- Tel-Cloud Demo (slug `tc-demo`, ENTERPRISE plan, billing_exempt,
  workspace_type internal) — for operator dogfooding, separate from Eque
  tenant. Director account: demo@tel-cloud.sg (password generated and
  saved by operator).

**Vercel + Google Cloud + Railway configuration**
- Google Cloud project "Tel-Cloud" created (project number 131482043793)
- OAuth Client "Tel-Cloud Web" created
  (Client ID: 131482043793-jthli7dijfjlgnhf5gdaodn947i1ufn6.apps.googleusercontent.com)
- Authorized origins: localhost:5173, Railway URL, Vercel URL,
  https://app.tel-cloud.sg (anticipating future move)
- OAuth consent: External + Testing mode, with
  quiinn@tel-cloud.sg as test user
- Vercel env vars added: VITE_GOOGLE_CLIENT_ID, VITE_API_URL
- Railway env var added: GOOGLE_CLIENT_ID
- Vercel auto-deploys from GitHub master push (verified working)

**China connectivity issue discovered and resolved**
- LetsVPN uninstall left a residual proxy at 127.0.0.1:7890 in HKCU
  registry.
- This silently blocked ALL command-line HTTPS:
  - googleapis.com (couldn't verify Google ID tokens locally)
  - github.com (couldn't push)
  - any other HTTPS endpoint from Node/git/PowerShell
- Browser worked fine because it bypasses this registry proxy in some cases.
- Symptom looked like firewall, antivirus, or VPN issue. Firewall rules
  for Node didn't help. Real cause: registry proxy.
- Fix:
  Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings" -Name ProxyEnable -Value 0
- After fix: git push worked, googleapis.com reachable from Node, local
  Google sign-in worked end-to-end.
- This is now in the risk register.

**Local dev quirks documented**
- Server doesn't load env from a .env file (no dotenv installed, no
  server/.env exists). GOOGLE_CLIENT_ID must be set via $env: in
  PowerShell before each `node server/index.js` start. Tech debt: install
  dotenv and create server/.env (gitignored).
- Local Google sign-in works after registry proxy fix + env var set.
- Local password sign-in continues to work either way.
- Account lockout (5 failed attempts -> 15 min lockout) bit during this
  session when the operator forgot their newly-set password. Recovery
  required psql UPDATE on failed_login_attempts and locked_until columns.
  This is more evidence the in-app password change UI (Phase A3) is
  needed.

**Operator email strategy**
- quiinn@tel-cloud.sg = platform super_admin (sees AdminPanel, manages
  tenants)
- demo@tel-cloud.sg = director of Tel-Cloud Demo workspace (sees product
  UI as a recruiter would)
- quiinn@eque.com.sg = director of Eque tenant (existing, local only)
- Plan: add demo@tel-cloud.sg as Google Workspace alias on tel-cloud.sg
  domain so it can sign in via Google.

### Outstanding for next session

Operational priorities:
1. Eque Railway production deploy (worker needs META_ACCESS_TOKEN,
   META_PHONE_NUMBER_ID, META_API_VERSION env vars to actually fire)
2. Marketing landing site (Vercel) at tel-cloud.sg root (separate from
   app at agency-hub-teal.vercel.app)
3. Legal docs (Privacy/ToS/AUP)
4. Y.E.C as WhatsApp sender setup
5. New Meta App for Tech Provider
6. Email infrastructure decision (Resend vs SendGrid) and integration
   for password reset, invites, notifications, future 2FA codes
7. demo@tel-cloud.sg Google Workspace alias

Tech debt:
- Embed chunk_22 in migration runner with IF NOT EXISTS guards
- Install dotenv + server/.env for persistent local env vars
- Update server boot log message (still says superadmin@tel-cloud.com /
  admin123)
- phone_numbers.whatsapp_phone_id UNIQUE+lookup index
- In-app password change UI (Phase A3)
- 401 auth noise on page load (8-16 failed requests pre-auth-hydrate)

Product polish:
- Pipeline page
- Contacts page (currently a stub "Coming soon")
- Broadcasts page (currently a stub "Coming soon")
- Settings page mobile pass on remaining tabs
- ChatWindow mobile polish (deferred from 25 Apr)
- Inbox empty state (deferred from 25 Apr)

### Critical architecture notes added today

- pg DATE columns return as JS Date at local midnight. Never use
  .toISOString() on them — use getFullYear/getMonth/getDate local-time
  accessors instead. This caused a 24h offset bug in reminder send time
  computation that we caught and fixed.
- scheduled_messages worker now exists in server/index.js. Polls every
  60s. Needs Meta env vars in production to actually send. In dev, marks
  messages as failed with reason 'Meta credentials not configured'.
- Director role auto-gets ALL_PERMISSIONS_TRUE which includes
  manage_calendar (added via chunk_13b migration).
- ASCII-only in code (PowerShell UTF-8 quirks). Lucide-style SVG
  (strokeWidth 1.3-1.7, no fill, stroke="currentColor"). Find/replace
  strings preferred over line numbers.
- LetsVPN registry proxy ghost: when uninstalling Clash-based VPNs in
  China, always check HKCU:\Software\Microsoft\Windows\CurrentVersion\
  Internet Settings ProxyEnable afterward. Set to 0 if 1.
- Production frontend hosted on Vercel (auto-deploy from GitHub master).
  Production backend on Railway (auto-deploy from GitHub master).
  Both configured this session. Next push to master = next production
  deploy on both surfaces.