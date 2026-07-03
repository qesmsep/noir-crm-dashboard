-- Re-add direction, phone_number, and sent_by columns to the messages table.
--
-- The live messages table had drifted from its original schema (20240615_add_messages.sql):
-- the `direction` and `phone_number` columns were missing, and `sent_by` was never added.
-- As a result, inserts in /api/send-bulk-message (which write those columns) failed silently,
-- so bulk texts to members were sent via OpenPhone but never logged to the database.
--
-- These columns are added as nullable so existing rows are unaffected.

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS direction TEXT DEFAULT 'outbound',
  ADD COLUMN IF NOT EXISTS phone_number TEXT,
  ADD COLUMN IF NOT EXISTS sent_by TEXT;

-- Backfill existing rows: all historical messages were outbound.
UPDATE public.messages SET direction = 'outbound' WHERE direction IS NULL;
