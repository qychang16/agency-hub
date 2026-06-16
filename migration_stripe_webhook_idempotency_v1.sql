-- Migration: Stripe webhook idempotency
-- Adds stripe_event_id to wallet_transactions for deduplication.
-- Critical: Stripe may deliver webhooks multiple times. Without this, retried
-- events would credit the wallet twice (real money bug).

BEGIN;

ALTER TABLE wallet_transactions
  ADD COLUMN IF NOT EXISTS stripe_event_id VARCHAR(255);

-- Partial UNIQUE constraint: if stripe_event_id is set, it must be unique.
-- NULLs (non-Stripe events like message debits) are not constrained.
CREATE UNIQUE INDEX IF NOT EXISTS idx_wallet_tx_stripe_event_unique
  ON wallet_transactions(stripe_event_id)
  WHERE stripe_event_id IS NOT NULL;

DO $$
DECLARE
  total INTEGER;
BEGIN
  SELECT COUNT(*) INTO total FROM wallet_transactions;
  RAISE NOTICE 'Migration complete: % existing wallet_transactions rows, new column ready for Stripe webhook events', total;
END $$;

COMMIT;