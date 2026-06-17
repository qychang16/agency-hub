-- migration_contacts_country_code_v1.sql
-- Adds country_code column to contacts for per-contact rate selection.
-- Used by walletBilling.calculateMessageCost to look up meta_pricing by
-- contact's country instead of hardcoded 'SG'.
--
-- Safe to run multiple times. Idempotent via IF NOT EXISTS and IS NULL guards.
--
-- Apply locally:
--   psql "$env:LOCAL_DATABASE_URL" -f migration_contacts_country_code_v1.sql
--
-- Apply to prod:
--   psql "$env:DATABASE_PUBLIC_URL" -f migration_contacts_country_code_v1.sql

BEGIN;

-- Add country_code column (ISO 3166-1 alpha-2, e.g. 'SG', 'MY', 'ID')
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS country_code VARCHAR(2);

-- Index for billing lookups (joins to meta_pricing.country_code)
CREATE INDEX IF NOT EXISTS idx_contacts_country_code
  ON contacts(country_code)
  WHERE country_code IS NOT NULL;

-- Backfill from phone number prefix.
-- Phone numbers stored as E.164 (e.g. '+6591234567') let us match the
-- leading country code digits. Order: longer prefixes first to avoid
-- mis-matching (e.g. '+852' HK must come before '+8' patterns).
UPDATE contacts SET country_code = 'HK'  WHERE country_code IS NULL AND phone LIKE '+852%';
UPDATE contacts SET country_code = 'TW'  WHERE country_code IS NULL AND phone LIKE '+886%';
UPDATE contacts SET country_code = 'AE'  WHERE country_code IS NULL AND phone LIKE '+971%';
UPDATE contacts SET country_code = 'SA'  WHERE country_code IS NULL AND phone LIKE '+966%';
UPDATE contacts SET country_code = 'SG'  WHERE country_code IS NULL AND phone LIKE '+65%';
UPDATE contacts SET country_code = 'MY'  WHERE country_code IS NULL AND phone LIKE '+60%';
UPDATE contacts SET country_code = 'ID'  WHERE country_code IS NULL AND phone LIKE '+62%';
UPDATE contacts SET country_code = 'PH'  WHERE country_code IS NULL AND phone LIKE '+63%';
UPDATE contacts SET country_code = 'TH'  WHERE country_code IS NULL AND phone LIKE '+66%';
UPDATE contacts SET country_code = 'VN'  WHERE country_code IS NULL AND phone LIKE '+84%';
UPDATE contacts SET country_code = 'CN'  WHERE country_code IS NULL AND phone LIKE '+86%';
UPDATE contacts SET country_code = 'JP'  WHERE country_code IS NULL AND phone LIKE '+81%';
UPDATE contacts SET country_code = 'KR'  WHERE country_code IS NULL AND phone LIKE '+82%';
UPDATE contacts SET country_code = 'IN'  WHERE country_code IS NULL AND phone LIKE '+91%';
UPDATE contacts SET country_code = 'AU'  WHERE country_code IS NULL AND phone LIKE '+61%';
UPDATE contacts SET country_code = 'NZ'  WHERE country_code IS NULL AND phone LIKE '+64%';
UPDATE contacts SET country_code = 'GB'  WHERE country_code IS NULL AND phone LIKE '+44%';
UPDATE contacts SET country_code = 'US'  WHERE country_code IS NULL AND phone LIKE '+1%';
-- Note: +1 also covers Canada, but Tel-Cloud cannot distinguish US/CA from
-- phone prefix alone. Default to US for billing purposes (rates are identical).

COMMIT;

-- Verification queries (run after COMMIT, separately):
-- SELECT country_code, COUNT(*) FROM contacts GROUP BY country_code ORDER BY 2 DESC;
-- SELECT COUNT(*) AS unbackfilled FROM contacts WHERE country_code IS NULL AND phone IS NOT NULL;
