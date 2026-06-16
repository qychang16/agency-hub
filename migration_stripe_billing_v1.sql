-- Migration: Stripe billing wiring
-- Adds Stripe references to workspaces, links plans to Stripe prices,
-- adds cost tracking to messages, and seeds Meta WhatsApp pricing table.
--
-- Apply via:
--   $env:PGCLIENTENCODING = "UTF8"
--   & "C:\Program Files\PostgreSQL\17\bin\psql.exe" -f .\migration_stripe_billing_v1.sql "$env:LOCAL_DATABASE_URL" --pset=pager=off

BEGIN;

-- 1. Stripe references on workspaces
ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(64),
  ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(64),
  ADD COLUMN IF NOT EXISTS stripe_subscription_status VARCHAR(30);

CREATE INDEX IF NOT EXISTS idx_workspaces_stripe_customer
  ON workspaces(stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

-- 2. Link plans to Stripe price IDs and lookup keys
ALTER TABLE plans
  ADD COLUMN IF NOT EXISTS stripe_price_id_monthly VARCHAR(64),
  ADD COLUMN IF NOT EXISTS stripe_price_id_annual VARCHAR(64),
  ADD COLUMN IF NOT EXISTS stripe_lookup_monthly VARCHAR(64),
  ADD COLUMN IF NOT EXISTS stripe_lookup_annual VARCHAR(64);

-- Seed the 7 Stripe price IDs and lookup keys for the 4 plans
UPDATE plans SET 
  stripe_price_id_monthly = 'price_1Tj3yo8suEAolKEQv5EWI8EN',
  stripe_price_id_annual  = 'price_1Tj40z8suEAolKEQyebTK6e3',
  stripe_lookup_monthly   = 'starter_monthly',
  stripe_lookup_annual    = 'starter_annual'
WHERE slug = 'starter';

UPDATE plans SET 
  stripe_price_id_monthly = 'price_1Tj44N8suEAolKEQ4ijtB64v',
  stripe_price_id_annual  = 'price_1Tj4578suEAolKEQa5xvM7SB',
  stripe_lookup_monthly   = 'professional_monthly',
  stripe_lookup_annual    = 'professional_annual'
WHERE slug = 'professional';

UPDATE plans SET 
  stripe_price_id_monthly = 'price_1Tj46M8suEAolKEQrjS3xRkd',
  stripe_price_id_annual  = 'price_1Tj46v8suEAolKEQrRNRmnCi',
  stripe_lookup_monthly   = 'business_monthly',
  stripe_lookup_annual    = 'business_annual'
WHERE slug = 'business';

UPDATE plans SET 
  stripe_price_id_monthly = 'price_1Tj48I8suEAolKEQ6meagkvW',
  stripe_lookup_monthly   = 'enterprise_monthly'
WHERE slug = 'enterprise';

-- 3. Cost tracking on messages (per-message billing trail)
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS cost_cents INTEGER,
  ADD COLUMN IF NOT EXISTS cost_category VARCHAR(20),
  ADD COLUMN IF NOT EXISTS cost_country VARCHAR(2),
  ADD COLUMN IF NOT EXISTS cost_calculated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_messages_cost_lookup
  ON messages(workspace_id, sent_at)
  WHERE direction = 'out' AND cost_cents IS NOT NULL;

-- 4. Meta WhatsApp pricing table (per country, per category)
-- Seeded with Meta's published Singapore rates as of June 2026.
-- These are the rates BEFORE workspace markup is applied.
CREATE TABLE IF NOT EXISTS meta_pricing (
  id SERIAL PRIMARY KEY,
  country_code VARCHAR(2) NOT NULL,
  category VARCHAR(20) NOT NULL,
  cost_cents INTEGER NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'SGD',
  effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  effective_until TIMESTAMPTZ,
  notes TEXT,
  UNIQUE(country_code, category, effective_from)
);

CREATE INDEX IF NOT EXISTS idx_meta_pricing_lookup
  ON meta_pricing(country_code, category)
  WHERE effective_until IS NULL;

-- Singapore rates (per Meta's published pricing, June 2026)
-- Convert USD prices to SGD cents (1 USD = 1.35 SGD approx)
INSERT INTO meta_pricing (country_code, category, cost_cents, currency, notes) VALUES
  ('SG', 'marketing',     11, 'SGD', 'Singapore marketing conversation, ~USD 0.08 = SGD 0.11'),
  ('SG', 'utility',        2, 'SGD', 'Singapore utility conversation, ~USD 0.012 = SGD 0.02'),
  ('SG', 'authentication', 2, 'SGD', 'Singapore auth conversation, ~USD 0.012 = SGD 0.02'),
  ('SG', 'service',        0, 'SGD', 'Service conversations are free per Meta policy (Nov 2024+)')
ON CONFLICT (country_code, category, effective_from) DO NOTHING;

-- 5. Verify everything
DO $$
DECLARE
  workspaces_stripe_cols INTEGER;
  plans_with_stripe INTEGER;
  messages_cost_cols INTEGER;
  pricing_rows INTEGER;
BEGIN
  SELECT COUNT(*) INTO workspaces_stripe_cols
    FROM information_schema.columns
    WHERE table_name = 'workspaces' AND column_name LIKE 'stripe%';
  SELECT COUNT(*) INTO plans_with_stripe
    FROM plans WHERE stripe_price_id_monthly IS NOT NULL;
  SELECT COUNT(*) INTO messages_cost_cols
    FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name LIKE 'cost%';
  SELECT COUNT(*) INTO pricing_rows FROM meta_pricing;
  RAISE NOTICE 'Migration complete: % stripe cols on workspaces, % plans linked to Stripe, % cost cols on messages, % pricing rows seeded',
    workspaces_stripe_cols, plans_with_stripe, messages_cost_cols, pricing_rows;
END $$;

COMMIT;