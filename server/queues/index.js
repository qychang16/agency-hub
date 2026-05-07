// ============================================================
// Queue Provider Selector
// ============================================================
// Picks the queue implementation at startup based on QUEUE_PROVIDER
// in .env. The application code (worker in server/index.js) imports
// from this file only — never directly from postgresQueue.js etc.
//
// To migrate to SQS later:
//   1. Create server/queues/sqsQueue.js implementing the same interface
//   2. Set QUEUE_PROVIDER=sqs in Railway / AWS env vars
//   3. No application code changes
// ============================================================

const provider = process.env.QUEUE_PROVIDER || 'postgres'

let impl
switch (provider) {
  case 'postgres':
    impl = require('./postgresQueue')
    break
  // case 'sqs':
  //   impl = require('./sqsQueue')
  //   break
  default:
    throw new Error(
      `Unknown QUEUE_PROVIDER: "${provider}". ` +
      `Supported values: postgres. ` +
      `Set QUEUE_PROVIDER in your .env file.`
    )
}

console.log(`[queue] Using "${provider}" provider`)

module.exports = impl