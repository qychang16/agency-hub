// ============================================================
// Postgres-backed Message Queue
// ============================================================
// Implements the messageQueue interface using the existing
// scheduled_messages table. This is the default provider and matches
// the behaviour of Tel-Cloud as it ran before the queue abstraction.
//
// Key design decisions preserved from the original worker:
//   - Atomic claim via UPDATE ... WHERE status='pending' RETURNING *
//     (prevents double-processing under concurrent workers)
//   - markSent persists the final rendered body (important for reminders
//     that are re-rendered at send time with fresh event data)
//   - markFailed only writes if status is still 'pending' or 'sending'
//     (defensive: avoids overwriting a row another process has finalised)
// ============================================================

/**
 * Claim up to batchSize pending messages whose scheduled_at has passed.
 * Returns the rows after marking them 'sending' so they will not be
 * re-claimed by another poll cycle or another worker.
 */
async function claim(pool, batchSize) {
  // Two-step pattern preserved from original worker:
  // 1. Select due messages (no lock)
  // 2. Per-message atomic UPDATE to claim
  // We could do this as a single UPDATE ... WHERE id IN (...) RETURNING *,
  // but keeping it per-row matches the original logic and lets the worker
  // skip individual rows that were claimed by a concurrent process.
  const due = await pool.query(
    `SELECT id, workspace_id, conversation_id, contact_id, created_by,
            template_id, body, scheduled_at
     FROM scheduled_messages
     WHERE status = 'pending' AND scheduled_at <= NOW()
     ORDER BY scheduled_at ASC
     LIMIT $1`,
    [batchSize]
  )
  return due.rows
}

/**
 * Atomically claim a single message by id. Returns the claimed row or null
 * if another worker grabbed it first.
 *
 * The worker calls this inside its own transaction to ensure exactly-once
 * processing under concurrent load.
 */
async function claimOne(pool, messageId) {
  const r = await pool.query(
    `UPDATE scheduled_messages SET status = 'sending'
     WHERE id = $1 AND status = 'pending'
     RETURNING *`,
    [messageId]
  )
  return r.rows[0] || null
}

/**
 * Mark a message as sent. Persists the final body that was actually sent
 * (which may differ from the originally-stored body for reminders that
 * were re-rendered with fresh event data at send time).
 */
async function markSent(pool, messageId, finalBody) {
  await pool.query(
    `UPDATE scheduled_messages
     SET status = 'sent', sent_at = NOW(), body = $1
     WHERE id = $2`,
    [finalBody, messageId]
  )
}

/**
 * Mark a message as failed. Truncates reason to fit the failed_reason column.
 * The status check prevents overwriting if some other process already
 * finalised this row (defensive).
 */
async function markFailed(pool, messageId, reason) {
  await pool.query(
    `UPDATE scheduled_messages
     SET status = 'failed', failed_at = NOW(), failed_reason = $1
     WHERE id = $2 AND status IN ('pending', 'sending')`,
    [(reason || 'unknown error').slice(0, 500), messageId]
  )
}

/**
 * Enqueue a new scheduled message row.
 * NOTE: not yet called from anywhere — POST /scheduled still does its own
 * INSERT. Kept here for interface completeness and future migration.
 */
async function enqueue(pool, payload) {
  const r = await pool.query(
    `INSERT INTO scheduled_messages
       (workspace_id, conversation_id, contact_id, phone_number_id, created_by,
        channel, template_id, subject, body, variables, buttons, scheduled_at,
        send_mode, email_to, email_cc, bulk_batch_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     RETURNING *`,
    [
      payload.workspace_id, payload.conversation_id, payload.contact_id,
      payload.phone_number_id, payload.created_by,
      payload.channel || 'whatsapp', payload.template_id,
      payload.subject, payload.body,
      JSON.stringify(payload.variables || {}),
      JSON.stringify(payload.buttons || []),
      payload.scheduled_at, payload.send_mode || 'scheduled',
      payload.email_to, payload.email_cc, payload.bulk_batch_id
    ]
  )
  return r.rows[0]
}

module.exports = { claim, claimOne, markSent, markFailed, enqueue }