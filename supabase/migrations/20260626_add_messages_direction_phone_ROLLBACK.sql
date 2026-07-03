-- Rollback for 20260626_add_messages_direction_phone.sql

ALTER TABLE public.messages
  DROP COLUMN IF EXISTS direction,
  DROP COLUMN IF EXISTS phone_number,
  DROP COLUMN IF EXISTS sent_by;
