-- Add referral tracking to members table
-- This allows tracking which member referred a new member

-- Add referral columns to members table
ALTER TABLE members
ADD COLUMN IF NOT EXISTS referred_by_member_id UUID REFERENCES members(member_id),
ADD COLUMN IF NOT EXISTS referral_code VARCHAR(20) UNIQUE,
ADD COLUMN IF NOT EXISTS referral_count INTEGER DEFAULT 0;

-- Create index for faster referral lookups
CREATE INDEX IF NOT EXISTS idx_members_referral_code ON members(referral_code);
CREATE INDEX IF NOT EXISTS idx_members_referred_by ON members(referred_by_member_id);

-- Function to generate unique referral code for a member
CREATE OR REPLACE FUNCTION generate_referral_code(first_name TEXT, last_name TEXT, member_id UUID)
RETURNS TEXT AS $$
DECLARE
  base_code TEXT;
  final_code TEXT;
  counter INTEGER := 0;
BEGIN
  -- Create base code from first name + last initial + random digits
  base_code := UPPER(LEFT(first_name, 3) || LEFT(last_name, 1)) || LPAD((FLOOR(RANDOM() * 9999)::TEXT), 4, '0');
  final_code := base_code;

  -- Ensure uniqueness
  WHILE EXISTS (SELECT 1 FROM members WHERE referral_code = final_code) LOOP
    counter := counter + 1;
    final_code := base_code || counter::TEXT;
  END LOOP;

  RETURN final_code;
END;
$$ LANGUAGE plpgsql;

-- Generate referral codes for existing members who don't have one
UPDATE members
SET referral_code = generate_referral_code(first_name, last_name, member_id)
WHERE referral_code IS NULL
AND first_name IS NOT NULL
AND last_name IS NOT NULL;

-- Trigger to auto-generate referral code for new members
CREATE OR REPLACE FUNCTION auto_generate_referral_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.referral_code IS NULL AND NEW.first_name IS NOT NULL AND NEW.last_name IS NOT NULL THEN
    NEW.referral_code := generate_referral_code(NEW.first_name, NEW.last_name, NEW.member_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_generate_referral_code
BEFORE INSERT ON members
FOR EACH ROW
EXECUTE FUNCTION auto_generate_referral_code();

-- Trigger to update referral count when a new member is referred
CREATE OR REPLACE FUNCTION update_referral_count()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.referred_by_member_id IS NOT NULL THEN
    UPDATE members
    SET referral_count = referral_count + 1
    WHERE member_id = NEW.referred_by_member_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_referral_count
AFTER INSERT ON members
FOR EACH ROW
WHEN (NEW.referred_by_member_id IS NOT NULL)
EXECUTE FUNCTION update_referral_count();

-- Add comment for documentation
COMMENT ON COLUMN members.referral_code IS 'Unique code members can share to refer others';
COMMENT ON COLUMN members.referred_by_member_id IS 'ID of the member who referred this member';
COMMENT ON COLUMN members.referral_count IS 'Number of members this member has successfully referred';
