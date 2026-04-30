# Tech Provider Roadmap

Y.E.C Consultancy / Tel-Cloud platform path to Meta WhatsApp
Business Platform Tech Provider status.

Created: 26 Apr 2026
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
- [ ] Complete SGNIC VerifiedID@SG within 21 days
      Deadline: 17 May 2026
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
- [ ] Set up Google Workspace for tel-cloud.sg domain
      Plan: Business Starter ~SGD $8/user/month
      Needed addresses:
      - tech@tel-cloud.sg     (Meta app contact email)
      - support@tel-cloud.sg  (client-facing)
      - legal@tel-cloud.sg    (privacy/ToS contact)
      - hello@tel-cloud.sg    (general inquiries)
      - quiinn@tel-cloud.sg   (director)

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
- [ ] Buy/setup Vercel hosting (free for static)
- [ ] 1-page site at tel-cloud.sg
      Sections: Hero, Features, Pricing (or "Contact"), Footer
      Footer must link: Privacy Policy, ToS, Contact
- [ ] DNS: point tel-cloud.sg from Vodien to Vercel
- [ ] SSL certificate (Vercel auto-issues via Let's Encrypt)
- [ ] Optional: simple "Sign in" link routing to app subdomain

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
      App icon: Tel-Cloud logo
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
Hosting: Railway (existing, agency-hub-production)
Code: github.com/qychang16/agency-hub
Y.E.C UEN: 202231751D
Meta Business Account: linked to personal Facebook with 2FA

External services to set up:
- Google Workspace (email)
- Vercel (marketing site hosting)
- Termly.io or lawyer (legal docs)
- Stripe Singapore or HitPay (payments)

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

2. SGNIC VerifiedID lapse (21 days from domain purchase)
   Mitigation: complete by 17 May 2026 latest

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

#### Phase A1 - Google OAuth login
- [ ] Google Cloud project + OAuth consent screen for Tel-Cloud
- [ ] `/auth/google` endpoints (initiate, callback)
- [ ] Link Google identities to existing tenant users by email match
- [ ] Per-workspace setting: require Google login / allow password
- [ ] "Sign in with Google" button on login page
- [ ] Test that existing password users aren't locked out

#### Phase A2 - Verification codes
Scope to be defined before building. Possibilities:
- Email verification on signup (recommended for new tenants)
- 2FA via authenticator app (recommended for super admin)
- 2FA via email code (alternative for tenant users)
- Password reset codes (must-have)

Decision needed: which subset to ship first, and via what channel
(email via Google Workspace SMTP? SendGrid? Postmark?)

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

- I1 (starter pack auto-seed) should complete before any second
  tenant signs up, otherwise that tenant gets an empty starter pack.
- I2 (approved template locking) must complete before I5 (Meta
  submission), otherwise tenants could send modified content under
  an approved template name and trigger Meta violations.
- I4 (super admin tenant view) should complete before second tenant
  signs up, otherwise support requests will be unworkable.
- A1 (Google OAuth) can ship anytime after Phase 1 of the external
  roadmap (after tel-cloud.sg domain and email are live).

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

Authentication enhancements (Google OAuth, verification codes,
super admin tenant view) remain as separate workstreams from the v1
addendum, untouched by this overhaul.

The starter pack concept itself is dropped. Tenants no longer get
auto-seeded content. Instead they browse the three surfaces on
first login and install what they want. This is more honest about
where content comes from and respects tenant agency.

---

End of v2 addendum. Implementation begins with Phase II1.