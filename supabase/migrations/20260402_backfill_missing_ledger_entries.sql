-- Backfill Missing Ledger Entries
-- Created: 2026-04-02
-- Purpose: Backfill ledger entries for accounts billed on April 1-2, 2026
--          that were successfully charged in Stripe but failed to write to ledger
--          because the migration adding 'source' and 'ledger_entry_key' columns
--          was not yet applied.

-- Background:
-- - On 2026-03-30, commit 235963e added source and ledger_entry_key columns to ledger
-- - The migration was not applied to production before billing cron ran
-- - Billing cron on 2026-04-01 and 2026-04-02 successfully charged 4 accounts via Stripe
-- - But ledger inserts failed due to missing columns
-- - This migration backfills those missing entries with correct data from Stripe

BEGIN;

-- Insert missing ledger entries for the 4 affected accounts
-- Each account gets: 1 credit entry (payment) + 1 charge entry (admin fee)

-- Account 1: 3b8cf6cb-9b76-41cb-86d9-a5d4b6d52462 (April 1)
INSERT INTO ledger (
  account_id,
  member_id,
  type,
  amount,
  date,
  note,
  ledger_entry_key,
  stripe_charge_id,
  stripe_payment_intent_id,
  source,
  status
) VALUES
  -- Credit: Monthly dues payment
  (
    '3b8cf6cb-9b76-41cb-86d9-a5d4b6d52462',
    '34fe9068-cae4-4344-9b0c-c3e1391a461e',
    'credit',
    150.00,
    '2026-04-01',
    'Monthly dues - April 2026',
    'pi_3THPJWFdjSPifIH50x9rXJ51',
    'ch_3THPJWFdjSPifIH50byT7RJQ',
    'pi_3THPJWFdjSPifIH50x9rXJ51',
    'billing_cron',
    'cleared'
  ),
  -- Charge: Admin fee
  (
    '3b8cf6cb-9b76-41cb-86d9-a5d4b6d52462',
    '34fe9068-cae4-4344-9b0c-c3e1391a461e',
    'charge',
    -50.00,
    '2026-04-01',
    'Membership administration fee',
    'pi_3THPJWFdjSPifIH50x9rXJ51:admin_fee',
    'ch_3THPJWFdjSPifIH50byT7RJQ',
    'pi_3THPJWFdjSPifIH50x9rXJ51',
    'billing_cron',
    'cleared'
  );

-- Account 2: f9e7e988-3f52-4568-a03e-9cbe36b66724 (April 1)
INSERT INTO ledger (
  account_id,
  member_id,
  type,
  amount,
  date,
  note,
  ledger_entry_key,
  stripe_charge_id,
  stripe_payment_intent_id,
  source,
  status
) VALUES
  -- Credit: Monthly dues payment
  (
    'f9e7e988-3f52-4568-a03e-9cbe36b66724',
    '209f2fea-d4c3-4d91-899c-6a19dcb33701',
    'credit',
    150.00,
    '2026-04-01',
    'Monthly dues - April 2026',
    'pi_3THPJcFdjSPifIH51J7fZXhS',
    'ch_3THPJcFdjSPifIH51WZcMD0P',
    'pi_3THPJcFdjSPifIH51J7fZXhS',
    'billing_cron',
    'cleared'
  ),
  -- Charge: Admin fee
  (
    'f9e7e988-3f52-4568-a03e-9cbe36b66724',
    '209f2fea-d4c3-4d91-899c-6a19dcb33701',
    'charge',
    -50.00,
    '2026-04-01',
    'Membership administration fee',
    'pi_3THPJcFdjSPifIH51J7fZXhS:admin_fee',
    'ch_3THPJcFdjSPifIH51WZcMD0P',
    'pi_3THPJcFdjSPifIH51J7fZXhS',
    'billing_cron',
    'cleared'
  );

-- Account 3: 53814dc3-36d2-4d40-b075-8d030f920ec4 (April 1)
INSERT INTO ledger (
  account_id,
  member_id,
  type,
  amount,
  date,
  note,
  ledger_entry_key,
  stripe_charge_id,
  stripe_payment_intent_id,
  source,
  status
) VALUES
  -- Credit: Monthly dues payment
  (
    '53814dc3-36d2-4d40-b075-8d030f920ec4',
    'c86603e4-7e9b-4a1c-b88e-d6e84a3250f3',
    'credit',
    150.00,
    '2026-04-01',
    'Monthly dues - April 2026',
    'pi_3THPJeFdjSPifIH51xYtOnVZ',
    'ch_3THPJeFdjSPifIH51VSRBs5E',
    'pi_3THPJeFdjSPifIH51xYtOnVZ',
    'billing_cron',
    'cleared'
  ),
  -- Charge: Admin fee
  (
    '53814dc3-36d2-4d40-b075-8d030f920ec4',
    'c86603e4-7e9b-4a1c-b88e-d6e84a3250f3',
    'charge',
    -50.00,
    '2026-04-01',
    'Membership administration fee',
    'pi_3THPJeFdjSPifIH51xYtOnVZ:admin_fee',
    'ch_3THPJeFdjSPifIH51VSRBs5E',
    'pi_3THPJeFdjSPifIH51xYtOnVZ',
    'billing_cron',
    'cleared'
  );

-- Account 4: d21bd26b-f5cd-492f-83ef-8e88a2c7acc1 (April 2)
INSERT INTO ledger (
  account_id,
  member_id,
  type,
  amount,
  date,
  note,
  ledger_entry_key,
  stripe_charge_id,
  stripe_payment_intent_id,
  source,
  status
) VALUES
  -- Credit: Monthly dues payment
  (
    'd21bd26b-f5cd-492f-83ef-8e88a2c7acc1',
    '9c755f7d-c75a-485c-90c9-0300f3787ba0',
    'credit',
    150.00,
    '2026-04-02',
    'Monthly dues - April 2026',
    'pi_3THln9FdjSPifIH51ygPBiDq',
    'ch_3THln9FdjSPifIH51eNhdBBy',
    'pi_3THln9FdjSPifIH51ygPBiDq',
    'billing_cron',
    'cleared'
  ),
  -- Charge: Admin fee
  (
    'd21bd26b-f5cd-492f-83ef-8e88a2c7acc1',
    '9c755f7d-c75a-485c-90c9-0300f3787ba0',
    'charge',
    -50.00,
    '2026-04-02',
    'Membership administration fee',
    'pi_3THln9FdjSPifIH51ygPBiDq:admin_fee',
    'ch_3THln9FdjSPifIH51eNhdBBy',
    'pi_3THln9FdjSPifIH51ygPBiDq',
    'billing_cron',
    'cleared'
  );

-- Note: Skipping subscription_events inserts as they are not critical for ledger backfill
-- The ledger entries themselves provide the necessary audit trail

COMMIT;

-- Verification query (run after migration to confirm)
-- SELECT account_id, member_id, type, amount, date, note, source, ledger_entry_key
-- FROM ledger
-- WHERE date IN ('2026-04-01', '2026-04-02')
--   AND source = 'billing_cron'
-- ORDER BY account_id, type DESC;
