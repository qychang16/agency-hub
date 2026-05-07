// ============================================================
// Message Queue Interface
// ============================================================
// Every queue implementation (postgresQueue.js, future sqsQueue.js, etc.)
// MUST export these four methods with the same signatures.
//
// The worker in server/index.js calls these methods only.
// It must not import postgresQueue.js or sqsQueue.js directly.
//
// Switch implementations by setting QUEUE_PROVIDER in .env:
//   QUEUE_PROVIDER=postgres   (default, current behaviour)
//   QUEUE_PROVIDER=sqs        (future, AWS migration)
// ============================================================

/**
 * Claim the next batch of due messages atomically.
 * Marks them as 'sending' so concurrent workers do not double-process.
 *
 * @param {object} pool - Postgres pool (passed in for postgresQueue;
 *                       sqsQueue will ignore it)
 * @param {number} batchSize - max number of messages to claim
 * @returns {Promise<Array>} array of message rows; empty array if nothing due
 *
 * Each row has shape:
 *   { id, workspace_id, conversation_id, contact_id, created_by,
 *     template_id, body, scheduled_at }
 */
async function claim(pool, batchSize) {
  throw new Error('claim() must be implemented by queue provider')
}

/**
 * Mark a message as successfully sent.
 *
 * @param {object} pool - Postgres pool (postgresQueue uses; sqsQueue ignores)
 * @param {number} messageId - the scheduled_messages.id
 * @param {string} finalBody - the rendered body that was actually sent
 *                             (may differ from claimed.body for reminders
 *                             that were re-rendered with fresh event data)
 */
async function markSent(pool, messageId, finalBody) {
  throw new Error('markSent() must be implemented by queue provider')
}

/**
 * Mark a message as failed.
 *
 * @param {object} pool - Postgres pool
 * @param {number} messageId
 * @param {string} reason - error message (will be truncated to 500 chars)
 */
async function markFailed(pool, messageId, reason) {
  throw new Error('markFailed() must be implemented by queue provider')
}

/**
 * Enqueue a new scheduled message.
 * (Used by POST /scheduled and the calendar reminder flow.)
 *
 * Note: in v1 we keep the existing INSERT INTO scheduled_messages logic
 * inside the route handlers themselves. This function is reserved for the
 * future SQS migration when enqueue logic differs from "INSERT a row".
 * Not yet wired up — kept here as a placeholder for the contract.
 *
 * @param {object} pool
 * @param {object} payload - { workspace_id, conversation_id, contact_id,
 *                             phone_number_id, created_by, channel,
 *                             template_id, body, scheduled_at, ... }
 * @returns {Promise<object>} the created message row
 */
async function enqueue(pool, payload) {
  throw new Error('enqueue() must be implemented by queue provider')
}

module.exports = { claim, markSent, markFailed, enqueue }