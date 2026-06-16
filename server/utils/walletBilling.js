// Wallet billing helpers
//
// Two responsibilities:
//   1. calculateMessageCost(client, workspaceId, country, category)
//      Returns the cents this workspace owes for one outbound message:
//      meta_pricing[country][category] cost, plus the workspace's markup%.
//      Billing-exempt workspaces get 0% markup but still owe Meta passthrough.
//
//   2. debitWalletForMessage(client, workspaceId, messageId, costData)
//      Inside an open DB transaction: locks the wallet row FOR UPDATE,
//      checks balance, inserts a wallet_transactions ledger row (debit),
//      updates the wallet balance, and writes cost columns onto the message.
//      Throws if balance is insufficient and workspace is not billing_exempt.
//
// IMPORTANT: This is per-MESSAGE billing (Path X step 5, A1 scope).
// Per Meta's actual pricing model, conversations open for 24h and only the
// FIRST message in that window costs anything. Migrating to per-conversation
// billing is a follow-up task — track in NEXT_SESSION notes.

// Workspace markup percentages by plan tier.
// Aligns with Quiinn's 10 May 2026 pricing decision:
//   Starter 25% / Professional 20% / Business 15% / Enterprise 10%
// Billing-exempt workspaces get 0% regardless of plan.
const MARKUP_BY_PLAN = {
  starter: 25,
  professional: 20,
  business: 15,
  enterprise: 10,
}

async function calculateMessageCost(client, workspaceId, country, category) {
  // 1. Load workspace plan + billing_exempt flag
  const wsRes = await client.query(
    `SELECT plan, billing_exempt FROM workspaces WHERE id = $1`,
    [workspaceId]
  )
  if (wsRes.rows.length === 0) throw new Error(`Workspace ${workspaceId} not found`)
  const { plan, billing_exempt } = wsRes.rows[0]
  // 2. Look up Meta cost from meta_pricing table.
  // Falls back to 'SG' (Singapore base rate) if specific country not seeded.
  // Service category is free per Meta policy (Nov 2024+).
  let priceRes = await client.query(
    `SELECT cost_cents, category, country_code FROM meta_pricing
     WHERE country_code = $1 AND category = $2 AND effective_until IS NULL
     ORDER BY effective_from DESC LIMIT 1`,
    [country, category]
  )
  if (priceRes.rows.length === 0) {
    // Fallback: try SG for same category
    priceRes = await client.query(
      `SELECT cost_cents, category, country_code FROM meta_pricing
       WHERE country_code = 'SG' AND category = $1 AND effective_until IS NULL
       ORDER BY effective_from DESC LIMIT 1`,
      [category]
    )
  }
  const metaCostCents = priceRes.rows[0]?.cost_cents || 0
  // 3. Compute markup
  const markupPct = billing_exempt ? 0 : (MARKUP_BY_PLAN[plan] || 0)
  const markupCents = Math.round(metaCostCents * markupPct / 100)
  const totalCents = metaCostCents + markupCents
  return {
    metaCostCents,
    markupCents,
    totalCents,
    markupPct,
    category,
    country,
    billingExempt: billing_exempt === true,
  }
}

// MUST be called inside an open DB transaction (BEGIN already issued).
// Caller is responsible for COMMIT/ROLLBACK.
async function debitWalletForMessage(client, workspaceId, messageId, costData) {
  const { metaCostCents, markupCents, totalCents, category, country, billingExempt } = costData
  // Skip entirely if cost is 0 (e.g., service category free messages)
  if (totalCents === 0) {
    await client.query(
      `UPDATE messages
       SET cost_cents = 0, cost_category = $1, cost_country = $2, cost_calculated_at = NOW()
       WHERE id = $3`,
      [category, country, messageId]
    )
    return { skipped: true, reason: 'zero_cost' }
  }
  // Lock the wallet row to prevent concurrent debits
  const walletRes = await client.query(
    `SELECT id, balance_cents FROM wallets WHERE workspace_id = $1 FOR UPDATE`,
    [workspaceId]
  )
  if (walletRes.rows.length === 0) {
    // Auto-create wallet for workspace
    const newWallet = await client.query(
      `INSERT INTO wallets (workspace_id, balance_cents, currency) VALUES ($1, 0, 'SGD') RETURNING id, balance_cents`,
      [workspaceId]
    )
    walletRes.rows.push(newWallet.rows[0])
  }
  const wallet = walletRes.rows[0]
  const currentBalance = parseInt(wallet.balance_cents)
  // Check sufficient balance.
  // Billing-exempt workspaces: balance is allowed to go negative (internal/client
  // workspaces shouldn't be blocked from sending due to internal accounting).
  if (!billingExempt && currentBalance < totalCents) {
    throw Object.assign(new Error('Insufficient wallet balance'), {
      code: 'INSUFFICIENT_BALANCE',
      balance_cents: currentBalance,
      required_cents: totalCents,
      shortfall_cents: totalCents - currentBalance,
    })
  }
  const newBalance = currentBalance - totalCents
  // Update wallet balance
  await client.query(
    `UPDATE wallets SET balance_cents = $1, updated_at = NOW() WHERE id = $2`,
    [newBalance, wallet.id]
  )
  // Insert ledger row
  await client.query(
    `INSERT INTO wallet_transactions
       (wallet_id, workspace_id, type, direction, amount_cents, balance_after_cents,
        currency, description, related_message_id, meta_cost_cents, markup_cents, metadata)
     VALUES ($1, $2, 'message_send', 'debit', $3, $4, 'SGD', $5, $6, $7, $8, $9)`,
    [
      wallet.id,
      workspaceId,
      totalCents,
      newBalance,
      `Outbound WhatsApp message (${category}, ${country})`,
      messageId,
      metaCostCents,
      markupCents,
      JSON.stringify({ category, country, billing_exempt: billingExempt }),
    ]
  )
  // Write cost columns onto the message itself for direct trail
  await client.query(
    `UPDATE messages
     SET cost_cents = $1, cost_category = $2, cost_country = $3, cost_calculated_at = NOW()
     WHERE id = $4`,
    [totalCents, category, country, messageId]
  )
  return { skipped: false, newBalance, totalCents, metaCostCents, markupCents }
}

module.exports = {
  calculateMessageCost,
  debitWalletForMessage,
  MARKUP_BY_PLAN,
}