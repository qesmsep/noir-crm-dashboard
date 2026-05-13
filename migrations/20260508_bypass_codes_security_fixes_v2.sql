-- =====================================================
-- Bypass Code Security Fixes v2
-- Date: 2026-05-08
-- Fixes:
--   1. increment_bypass_code_usage: log insert moved inside function
--      so the idempotency check and counter increment are in one transaction
--   2. check_rate_limit: FOR UPDATE on blocked check to close TOCTOU gap
--   3. check_rate_limit: probabilistic cleanup to prevent unbounded table growth
-- =====================================================

-- =====================================================
-- 1. FIX increment_bypass_code_usage
--
-- The previous version checked the usage log for an existing validation_id,
-- but inserted the log row AFTER the function returned (in application code).
-- This left a window where two concurrent requests with the same validation_id
-- could both pass the check and both increment current_uses.
--
-- Fix: insert the log entry inside this function, within the same transaction
-- as the FOR UPDATE lock and the counter increment.
-- =====================================================

CREATE OR REPLACE FUNCTION increment_bypass_code_usage(
  p_bypass_code_id  UUID,
  p_validation_id   UUID,
  p_reservation_id  UUID    DEFAULT NULL,
  p_user_phone      TEXT    DEFAULT NULL,
  p_user_email      TEXT    DEFAULT NULL,
  p_user_name       TEXT    DEFAULT NULL,
  p_party_size      INTEGER DEFAULT NULL,
  p_amount_waived   NUMERIC DEFAULT NULL,
  p_ip_address      TEXT    DEFAULT NULL,
  p_user_agent      TEXT    DEFAULT NULL
)
RETURNS TABLE(success BOOLEAN, message TEXT) AS $$
DECLARE
  v_code_record RECORD;
BEGIN
  -- Lock the code row to serialize concurrent requests for the same code.
  -- Any other call with the same p_bypass_code_id will block here until
  -- this transaction commits, guaranteeing the log-existence check below
  -- sees the final state.
  SELECT * INTO v_code_record
  FROM location_bypass_codes
  WHERE id = p_bypass_code_id
    AND is_active = true
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Code not found or inactive'::TEXT;
    RETURN;
  END IF;

  -- Idempotency check — now runs inside the FOR UPDATE lock, so a concurrent
  -- call that already committed the log row will be visible here.
  IF EXISTS (
    SELECT 1 FROM location_bypass_code_usage_log
    WHERE validation_id = p_validation_id
  ) THEN
    RETURN QUERY SELECT true, 'Already processed'::TEXT;
    RETURN;
  END IF;

  -- Defensive max-uses re-check (state may have changed since validation).
  IF v_code_record.max_uses IS NOT NULL
     AND v_code_record.current_uses >= v_code_record.max_uses THEN
    RETURN QUERY SELECT false, 'Code has reached maximum uses'::TEXT;
    RETURN;
  END IF;

  -- Increment the counter.
  UPDATE location_bypass_codes
  SET current_uses = current_uses + 1,
      updated_at   = NOW()
  WHERE id = p_bypass_code_id;

  -- Insert the usage log in the same transaction.
  -- The UNIQUE constraint on validation_id acts as a secondary guard,
  -- but the FOR UPDATE lock above makes this path single-threaded per code.
  INSERT INTO location_bypass_code_usage_log (
    bypass_code_id,
    validation_id,
    reservation_id,
    user_phone,
    user_email,
    user_name,
    party_size,
    amount_waived,
    ip_address,
    user_agent
  ) VALUES (
    p_bypass_code_id,
    p_validation_id,
    p_reservation_id,
    p_user_phone,
    p_user_email,
    p_user_name,
    p_party_size,
    p_amount_waived,
    p_ip_address,
    p_user_agent
  );

  RETURN QUERY SELECT true, 'Usage incremented'::TEXT;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 2. FIX check_rate_limit
--
-- (a) The blocked-status check did not use FOR UPDATE, creating a TOCTOU
--     window: two simultaneous requests could both read "not blocked", then
--     both proceed to the window check even if a block had just been imposed.
--     Adding FOR UPDATE to the blocked-row SELECT closes this gap.
--
-- (b) cleanup_old_rate_limits() existed but was never wired to a cron job,
--     so api_rate_limits grows without bound. A 1% probabilistic inline
--     cleanup prevents unbounded growth without needing external scheduling.
-- =====================================================

CREATE OR REPLACE FUNCTION check_rate_limit(
  p_identifier    TEXT,
  p_endpoint      TEXT,
  p_max_attempts  INTEGER DEFAULT 5,
  p_window_minutes INTEGER DEFAULT 1
)
RETURNS TABLE(allowed BOOLEAN, attempts_remaining INTEGER) AS $$
DECLARE
  v_record RECORD;
  v_now    TIMESTAMPTZ := NOW();
BEGIN
  -- Probabilistic inline cleanup (~1% of calls).
  -- Prevents unbounded growth without requiring an external cron job.
  IF RANDOM() < 0.01 THEN
    DELETE FROM api_rate_limits
    WHERE window_end < v_now - INTERVAL '1 hour'
      AND (blocked_until IS NULL OR blocked_until < v_now);
  END IF;

  -- Check if currently blocked.
  -- FOR UPDATE locks the row so a concurrent request cannot read a
  -- stale (pre-block) snapshot and slip through immediately after a
  -- block is imposed by a sibling call.
  SELECT * INTO v_record
  FROM api_rate_limits
  WHERE identifier   = p_identifier
    AND endpoint     = p_endpoint
    AND blocked_until > v_now
  FOR UPDATE;

  IF FOUND THEN
    RETURN QUERY SELECT false, 0;
    RETURN;
  END IF;

  -- Check the current sliding window (also FOR UPDATE to serialize increments).
  SELECT * INTO v_record
  FROM api_rate_limits
  WHERE identifier = p_identifier
    AND endpoint   = p_endpoint
    AND window_end > v_now
  FOR UPDATE;

  IF FOUND THEN
    IF v_record.attempt_count >= p_max_attempts THEN
      UPDATE api_rate_limits
      SET blocked_until = v_now + INTERVAL '15 minutes'
      WHERE id = v_record.id;

      RETURN QUERY SELECT false, 0;
      RETURN;
    ELSE
      UPDATE api_rate_limits
      SET attempt_count = attempt_count + 1
      WHERE id = v_record.id;

      RETURN QUERY SELECT true, (p_max_attempts - v_record.attempt_count - 1);
      RETURN;
    END IF;
  ELSE
    -- First request in a new window.
    INSERT INTO api_rate_limits (identifier, endpoint, attempt_count, window_start, window_end)
    VALUES (p_identifier, p_endpoint, 1, v_now, v_now + (p_window_minutes || ' minutes')::INTERVAL);

    RETURN QUERY SELECT true, (p_max_attempts - 1);
    RETURN;
  END IF;
END;
$$ LANGUAGE plpgsql;
