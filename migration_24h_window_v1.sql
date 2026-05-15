-- Migration: 24-hour customer service window + TIMESTAMPTZ consistency cleanup
--
-- This migration does TWO things atomically:
--   1. Adds conversations.last_inbound_at for the 24-hour window feature
--   2. Converts all plain TIMESTAMP columns to TIMESTAMPTZ across:
--      conversations, messages, contacts, users, phone_numbers
--
-- WHY: chunk 28a started moving timestamps to TIMESTAMPTZ. The rest of the
-- schema still uses plain TIMESTAMP, which is inconsistent and risks subtle
-- timezone bugs. Existing values are interpreted as being in the server's
-- timezone setting at the time of ALTER (Asia/Kuala_Lumpur on local,
-- UTC on Railway prod), then stored as UTC. Math doesn't change visually
-- because Singapore/KL are UTC+8 no-DST.
--
-- SAFETY:
--   - Wrapped in a single transaction
--   - All ALTERs use USING clauses so explicit conversion happens
--   - Sanity-check NOTICE at the end shows row counts
--   - Re-runnable via IF NOT EXISTS / DO blocks where possible
--
-- Apply via:
--   $env:PGCLIENTENCODING = "UTF8"
--   & "C:\Program Files\PostgreSQL\17\bin\psql.exe" -f .\migration_24h_window_v1.sql "$env:LOCAL_DATABASE_URL" --pset=pager=off
--
-- For prod:
--   $env:PGCLIENTENCODING = "UTF8"
--   & "C:\Program Files\PostgreSQL\18\bin\psql.exe" -f .\migration_24h_window_v1.sql "$env:DATABASE_PUBLIC_URL" --pset=pager=off

BEGIN;

-- =============================================================================
-- PART 1: TIMESTAMPTZ conversion for existing columns
-- =============================================================================

-- conversations: 5 plain TIMESTAMP columns
ALTER TABLE conversations
  ALTER COLUMN last_message_at   TYPE TIMESTAMPTZ USING last_message_at   AT TIME ZONE current_setting('TimeZone'),
  ALTER COLUMN handover_note_at  TYPE TIMESTAMPTZ USING handover_note_at  AT TIME ZONE current_setting('TimeZone'),
  ALTER COLUMN closed_at         TYPE TIMESTAMPTZ USING closed_at         AT TIME ZONE current_setting('TimeZone'),
  ALTER COLUMN created_at        TYPE TIMESTAMPTZ USING created_at        AT TIME ZONE current_setting('TimeZone'),
  ALTER COLUMN updated_at        TYPE TIMESTAMPTZ USING updated_at        AT TIME ZONE current_setting('TimeZone');

-- messages: 7 plain TIMESTAMP columns
ALTER TABLE messages
  ALTER COLUMN delivered_at  TYPE TIMESTAMPTZ USING delivered_at  AT TIME ZONE current_setting('TimeZone'),
  ALTER COLUMN read_at       TYPE TIMESTAMPTZ USING read_at       AT TIME ZONE current_setting('TimeZone'),
  ALTER COLUMN scheduled_at  TYPE TIMESTAMPTZ USING scheduled_at  AT TIME ZONE current_setting('TimeZone'),
  ALTER COLUMN sent_at       TYPE TIMESTAMPTZ USING sent_at       AT TIME ZONE current_setting('TimeZone'),
  ALTER COLUMN created_at    TYPE TIMESTAMPTZ USING created_at    AT TIME ZONE current_setting('TimeZone'),
  ALTER COLUMN pinned_at     TYPE TIMESTAMPTZ USING pinned_at     AT TIME ZONE current_setting('TimeZone');

-- contacts: 2 plain TIMESTAMP columns (pdpa_consented_at is already TIMESTAMPTZ)
ALTER TABLE contacts
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE current_setting('TimeZone'),
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE current_setting('TimeZone');

-- users: 4 plain TIMESTAMP columns
ALTER TABLE users
  ALTER COLUMN last_login_at TYPE TIMESTAMPTZ USING last_login_at AT TIME ZONE current_setting('TimeZone'),
  ALTER COLUMN locked_until  TYPE TIMESTAMPTZ USING locked_until  AT TIME ZONE current_setting('TimeZone'),
  ALTER COLUMN created_at    TYPE TIMESTAMPTZ USING created_at    AT TIME ZONE current_setting('TimeZone'),
  ALTER COLUMN updated_at    TYPE TIMESTAMPTZ USING updated_at    AT TIME ZONE current_setting('TimeZone');

-- phone_numbers: 2 plain TIMESTAMP columns
ALTER TABLE phone_numbers
  ALTER COLUMN created_at               TYPE TIMESTAMPTZ USING created_at               AT TIME ZONE current_setting('TimeZone'),
  ALTER COLUMN last_connection_check_at TYPE TIMESTAMPTZ USING last_connection_check_at AT TIME ZONE current_setting('TimeZone');

-- =============================================================================
-- PART 2: Add last_inbound_at column for 24-hour window feature
-- =============================================================================

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS last_inbound_at TIMESTAMPTZ;

-- Backfill from most recent inbound message per conversation
UPDATE conversations c
SET last_inbound_at = sub.max_created
FROM (
  SELECT conversation_id, MAX(created_at) AS max_created
  FROM messages
  WHERE direction = 'in'
  GROUP BY conversation_id
) sub
WHERE c.id = sub.conversation_id
  AND c.last_inbound_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_conversations_last_inbound_at
  ON conversations(last_inbound_at);

-- =============================================================================
-- PART 3: Sanity check
-- =============================================================================

DO $$
DECLARE
  total_convos INTEGER;
  with_inbound INTEGER;
  open_windows INTEGER;
  conv_tz_count INTEGER;
  msg_tz_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_convos FROM conversations;
  SELECT COUNT(*) INTO with_inbound FROM conversations WHERE last_inbound_at IS NOT NULL;
  SELECT COUNT(*) INTO open_windows FROM conversations WHERE last_inbound_at > NOW() - INTERVAL '24 hours';

  -- Count how many columns are now TIMESTAMPTZ (sanity: should be 6 in conversations, 7 in messages)
  SELECT COUNT(*) INTO conv_tz_count
  FROM information_schema.columns
  WHERE table_name = 'conversations'
    AND data_type = 'timestamp with time zone';

  SELECT COUNT(*) INTO msg_tz_count
  FROM information_schema.columns
  WHERE table_name = 'messages'
    AND data_type = 'timestamp with time zone';

  RAISE NOTICE 'Migration complete.';
  RAISE NOTICE '  Conversations: % total, % with inbound history, % currently in 24h window',
    total_convos, with_inbound, open_windows;
  RAISE NOTICE '  TIMESTAMPTZ columns: conversations=% (expect 6+), messages=% (expect 6+)',
    conv_tz_count, msg_tz_count;
END $$;

COMMIT;
