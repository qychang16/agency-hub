-- Migration: WhatsApp disconnect handling
-- Adds disconnected_at, disconnect_reason to phone_numbers for storing
-- Meta PARTNER_REMOVED webhook info. Existing connection_status column already
-- supports DISCONNECTED state (varchar(30) with no enum constraint).
--
-- Apply via:
--   $env:PGCLIENTENCODING = "UTF8"
--   & "C:\Program Files\PostgreSQL\17\bin\psql.exe" -f .\migration_whatsapp_disconnect_v1.sql "$env:LOCAL_DATABASE_URL" --pset=pager=off

BEGIN;

ALTER TABLE phone_numbers
  ADD COLUMN IF NOT EXISTS disconnected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS disconnect_reason VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_phone_numbers_connection_status
  ON phone_numbers(connection_status)
  WHERE connection_status IN ('DISCONNECTED', 'TOKEN_INVALID', 'ERROR');

DO $$
DECLARE
  total INTEGER;
  disconnected INTEGER;
BEGIN
  SELECT COUNT(*) INTO total FROM phone_numbers;
  SELECT COUNT(*) INTO disconnected FROM phone_numbers WHERE connection_status = 'DISCONNECTED';
  RAISE NOTICE 'Migration complete: % phone_numbers total, % currently disconnected', total, disconnected;
END $$;

COMMIT;