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