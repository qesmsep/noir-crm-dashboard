-- Update referral code format to: FirstName + LastInitial + Last4DigitsOfPhone
-- This migration updates the generate_referral_code function to use phone numbers

-- Drop the old function
DROP FUNCTION IF EXISTS generate_referral_code(TEXT, TEXT, UUID);

-- Create new function that includes phone number
CREATE OR REPLACE FUNCTION generate_referral_code(first_name TEXT, last_name TEXT, phone TEXT)
RETURNS TEXT AS $$
DECLARE
  base_code TEXT;
  final_code TEXT;
  counter INTEGER := 0;
  clean_phone TEXT;
  last_four TEXT;
BEGIN
  -- Clean phone number (remove non-digits)
  clean_phone := REGEXP_REPLACE(phone, '[^0-9]', '', 'g');

  -- Get last 4 digits of phone
  last_four := RIGHT(clean_phone, 4);

  -- If phone doesn't have 4 digits, use random 4 digits
  IF LENGTH(last_four) < 4 THEN
    last_four := LPAD((FLOOR(RANDOM() * 9999)::TEXT), 4, '0');
  END IF;

  -- Create base code: FirstName + LastInitial + Last4Digits
  base_code := UPPER(first_name || LEFT(last_name, 1)) || last_four;
  final_code := base_code;

  -- Ensure uniqueness by adding a counter if needed
  WHILE EXISTS (SELECT 1 FROM members WHERE referral_code = final_code) LOOP
    counter := counter + 1;
    final_code := base_code || counter::TEXT;
  END LOOP;

  RETURN final_code;
END;
$$ LANGUAGE plpgsql;

-- Update the trigger function to pass phone number
CREATE OR REPLACE FUNCTION auto_generate_referral_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.referral_code IS NULL AND NEW.first_name IS NOT NULL AND NEW.last_name IS NOT NULL AND NEW.phone IS NOT NULL THEN
    NEW.referral_code := generate_referral_code(NEW.first_name, NEW.last_name, NEW.phone);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Regenerate referral codes for existing members with the new format
UPDATE members
SET referral_code = generate_referral_code(first_name, last_name, phone)
WHERE first_name IS NOT NULL
AND last_name IS NOT NULL
AND phone IS NOT NULL;

-- Add comment for documentation
COMMENT ON FUNCTION generate_referral_code(TEXT, TEXT, TEXT) IS 'Generates unique referral code: FirstName + LastInitial + Last4DigitsOfPhone';
