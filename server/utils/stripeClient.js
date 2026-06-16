// Stripe client utility module
//
// Centralizes Stripe SDK initialization and reusable helpers for the
// billing system. All Stripe API calls flow through here so we have one
// place to audit, mock for tests, or swap SDK versions.
//
// Required env vars:
//   STRIPE_SECRET_KEY      - sk_test_... or sk_live_...
//   STRIPE_WEBHOOK_SECRET  - whsec_... for signature verification
//   STRIPE_PUBLISHABLE_KEY - pk_test_... or pk_live_... (frontend only; included
//                            here for symmetry but not used in this module)
//
// API version pinned to 2026-05-27.dahlia (matches our webhook destination
// config in Stripe Dashboard). Pinning prevents Stripe SDK upgrades from
// silently changing event shapes in production.

const Stripe = require('stripe')

const SECRET = process.env.STRIPE_SECRET_KEY
if (!SECRET) {
  console.error('[stripe] FATAL: STRIPE_SECRET_KEY not set in env')
  process.exit(1)
}

const stripe = new Stripe(SECRET, {
  apiVersion: '2026-05-27.dahlia',
  appInfo: { name: 'Tel-Cloud', version: '2.0.0', url: 'https://tel-cloud.sg' },
})

// Get or create a Stripe Customer for the given workspace.
// Idempotent: if workspace already has stripe_customer_id, reuse it.
// Otherwise creates new Customer and persists the ID.
async function getOrCreateCustomer(pool, workspaceId) {
  const wsRes = await pool.query(
    `SELECT id, name, slug, stripe_customer_id FROM workspaces WHERE id = $1`,
    [workspaceId]
  )
  if (wsRes.rows.length === 0) throw new Error(`Workspace ${workspaceId} not found`)
  const ws = wsRes.rows[0]
  if (ws.stripe_customer_id) {
    try {
      // Verify the customer still exists in Stripe (could be deleted in dashboard)
      const existing = await stripe.customers.retrieve(ws.stripe_customer_id)
      if (existing && !existing.deleted) return existing
    } catch (err) {
      // If retrieve fails, fall through and create a new one
      console.warn(`[stripe] Failed to retrieve customer ${ws.stripe_customer_id}, creating new: ${err.message}`)
    }
  }
  // Find a director email to associate with the Stripe customer (for receipts/notifications)
  const dirRes = await pool.query(
    `SELECT email, name FROM users
     WHERE workspace_id = $1 AND role = 'director' AND email IS NOT NULL
     ORDER BY id ASC LIMIT 1`,
    [workspaceId]
  )
  const dirEmail = dirRes.rows[0]?.email || null
  const dirName = dirRes.rows[0]?.name || null
  const customer = await stripe.customers.create({
    name: ws.name,
    email: dirEmail,
    description: `Tel-Cloud workspace ${ws.id} (${ws.slug})`,
    metadata: {
      workspace_id: String(ws.id),
      workspace_slug: ws.slug,
      director_name: dirName || '',
      created_via: 'tel-cloud-api',
    },
  })
  await pool.query(
    `UPDATE workspaces SET stripe_customer_id = $1 WHERE id = $2`,
    [customer.id, workspaceId]
  )
  console.log(`[stripe] Created Customer ${customer.id} for workspace ${workspaceId}`)
  return customer
}

// Create a one-off Checkout Session for wallet top-up.
// Returns the Checkout URL that the user is redirected to.
async function createTopupCheckoutSession({ pool, workspaceId, amountCents, successUrl, cancelUrl }) {
  if (!Number.isInteger(amountCents) || amountCents < 1000 || amountCents > 1000000) {
    throw new Error(`Invalid top-up amount: ${amountCents} cents (must be 1000-1000000)`)
  }
  const customer = await getOrCreateCustomer(pool, workspaceId)
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer: customer.id,
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency: 'sgd',
        product_data: {
          name: 'Tel-Cloud Wallet Top-Up',
          description: `Add SGD ${(amountCents / 100).toFixed(2)} credit to your Tel-Cloud wallet.`,
        },
        unit_amount: amountCents,
      },
      quantity: 1,
    }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      workspace_id: String(workspaceId),
      topup_amount_cents: String(amountCents),
      purpose: 'wallet_topup',
    },
  })
  console.log(`[stripe] Created Checkout Session ${session.id} for workspace ${workspaceId}, amount ${amountCents} cents`)
  return session
}

// Verify a webhook event came from Stripe (signature check).
// Returns the parsed event on success, throws on signature mismatch.
function verifyWebhookEvent(rawBody, signatureHeader) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) throw new Error('STRIPE_WEBHOOK_SECRET not set in env')
  return stripe.webhooks.constructEvent(rawBody, signatureHeader, webhookSecret)
}

module.exports = {
  stripe,
  getOrCreateCustomer,
  createTopupCheckoutSession,
  verifyWebhookEvent,
}