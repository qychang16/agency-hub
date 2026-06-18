-- migration_contacts_bsuid_v1.sql
-- Adds bsuid (Business-Scoped User ID) column to contacts.
--
-- Background: Meta is rolling out WhatsApp usernames starting June 2026.
-- When users adopt usernames, businesses may no longer see their phone
-- number on inbound messages — only a BSUID. Format: country prefix +
-- dot + numeric ID (e.g. 'US.13491208655302741918' or 'SG.20493847562').
--
-- This migration prepares Tel-Cloud's contact resolution to handle
-- BSUID-keyed contacts. Webhook handlers will populate bsuid when Meta
-- includes user_id in inbound message payloads. Contact resolution then
-- matches by phone OR bsuid, so the same person is treated as one contact
-- regardless of which identifier Meta sends on a given message.
--
-- No backfill needed: BSUIDs arrive only via future inbound webhooks,
-- never retroactively. Existing contacts stay phone-keyed until/unless
-- they message in again with BSUID populated.
--
-- Apply locally:
--   psql "$env:LOCAL_DATABASE_URL" -f migration_contacts_bsuid_v1.sql
--
-- Apply to prod:
--   psql "$env:DATABASE_PUBLIC_URL" -f migration_contacts_bsuid_v1.sql

BEGIN;

-- Add bsuid column. Length 255 follows Meta's documented format
-- (2-char ISO country code + '.' + up to 128 alphanumeric chars,
-- so 132 max in theory; 255 is safety margin for future expansion).
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS bsuid VARCHAR(255);

-- Unique partial index: a given BSUID belongs to one contact per workspace.
-- Partial (WHERE bsuid IS NOT NULL) avoids the cost of indexing the vast
-- majority of contacts that have no BSUID yet.
CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_workspace_bsuid_unique
  ON contacts(workspace_id, bsuid)
  WHERE bsuid IS NOT NULL;

-- Lookup index for contact resolution (find-by-bsuid queries during inbound
-- webhook processing). Partial for the same reason.
CREATE INDEX IF NOT EXISTS idx_contacts_bsuid
  ON contacts(bsuid)
  WHERE bsuid IS NOT NULL;

COMMIT;

-- Verification queries (run after COMMIT, separately):
-- SELECT COUNT(*) AS total_contacts, COUNT(bsuid) AS with_bsuid FROM contacts;
-- \d contacts
