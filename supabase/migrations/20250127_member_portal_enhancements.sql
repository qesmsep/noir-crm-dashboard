-- Migration to add member portal enhancements
-- This adds tables for photo uploads, profile change approvals, and enhanced member management

-- Add new enum types
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'approval_status') THEN
        CREATE TYPE approval_status AS ENUM ('pending', 'approved', 'rejected');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'change_type') THEN
        CREATE TYPE change_type AS ENUM ('profile_info', 'photo', 'preferences', 'billing');
    END IF;
END $$;

-- Create members table if it doesn't exist (based on existing references)
CREATE TABLE IF NOT EXISTS public.members (
    member_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT UNIQUE NOT NULL,
    photo_url TEXT,
    join_date TIMESTAMPTZ DEFAULT NOW(),
    membership_type TEXT DEFAULT 'standard',
    membership_status TEXT DEFAULT 'active',
    stripe_customer_id TEXT UNIQUE,
    billing_address JSONB DEFAULT '{}',
    preferences JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create member_profile_changes table for approval workflow
CREATE TABLE IF NOT EXISTS public.member_profile_changes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    member_id UUID NOT NULL REFERENCES members(member_id) ON DELETE CASCADE,
    change_type change_type NOT NULL,
    current_data JSONB,
    proposed_data JSONB NOT NULL,
    reason TEXT,
    status approval_status DEFAULT 'pending',
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    reviewed_by UUID REFERENCES auth.users(id),
    admin_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create member_ledger table for financial tracking
CREATE TABLE IF NOT EXISTS public.member_ledger (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    member_id UUID NOT NULL REFERENCES members(member_id) ON DELETE CASCADE,
    transaction_type TEXT NOT NULL, -- 'charge', 'credit', 'payment', 'membership_fee', 'beverage_credit'
    amount DECIMAL(10,2) NOT NULL,
    description TEXT NOT NULL,
    reference_id TEXT, -- Stripe payment intent, reservation ID, etc.
    transaction_date TIMESTAMPTZ DEFAULT NOW(),
    balance_after DECIMAL(10,2),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create member_billing_info table
CREATE TABLE IF NOT EXISTS public.member_billing_info (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    member_id UUID NOT NULL REFERENCES members(member_id) ON DELETE CASCADE,
    stripe_payment_method_id TEXT,
    card_last_four TEXT,
    card_brand TEXT,
    card_exp_month INTEGER,
    card_exp_year INTEGER,
    billing_name TEXT,
    billing_email TEXT,
    billing_address JSONB DEFAULT '{}',
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create password_reset_tokens table for member password resets
CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_members_user_id ON members(user_id);
CREATE INDEX IF NOT EXISTS idx_members_email ON members(email);
CREATE INDEX IF NOT EXISTS idx_members_phone ON members(phone);
CREATE INDEX IF NOT EXISTS idx_members_stripe_customer_id ON members(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_member_profile_changes_member_id ON member_profile_changes(member_id);
CREATE INDEX IF NOT EXISTS idx_member_profile_changes_status ON member_profile_changes(status);
CREATE INDEX IF NOT EXISTS idx_member_ledger_member_id ON member_ledger(member_id);
CREATE INDEX IF NOT EXISTS idx_member_ledger_date ON member_ledger(transaction_date);
CREATE INDEX IF NOT EXISTS idx_member_billing_info_member_id ON member_billing_info(member_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token);

-- Enable RLS
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_profile_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_billing_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;

-- RLS Policies for members
CREATE POLICY "Members can view own profile"
ON public.members FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Members can update own profile"
ON public.members FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all members"
ON public.members FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid()
        AND r.permissions->>'can_manage_members' = 'true'
    )
);

-- RLS Policies for profile changes
CREATE POLICY "Members can view own profile changes"
ON public.member_profile_changes FOR SELECT
USING (
    member_id IN (
        SELECT member_id FROM members WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Members can create own profile changes"
ON public.member_profile_changes FOR INSERT
WITH CHECK (
    member_id IN (
        SELECT member_id FROM members WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Admins can manage all profile changes"
ON public.member_profile_changes FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid()
        AND r.permissions->>'can_manage_members' = 'true'
    )
);

-- RLS Policies for ledger
CREATE POLICY "Members can view own ledger"
ON public.member_ledger FOR SELECT
USING (
    member_id IN (
        SELECT member_id FROM members WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Admins can manage all ledgers"
ON public.member_ledger FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid()
        AND r.permissions->>'can_manage_members' = 'true'
    )
);

-- RLS Policies for billing info
CREATE POLICY "Members can manage own billing info"
ON public.member_billing_info FOR ALL
USING (
    member_id IN (
        SELECT member_id FROM members WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Admins can view all billing info"
ON public.member_billing_info FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid()
        AND r.permissions->>'can_manage_members' = 'true'
    )
);

-- RLS Policies for password reset tokens
CREATE POLICY "Users can manage own password reset tokens"
ON public.password_reset_tokens FOR ALL
USING (user_id = auth.uid());

-- Create triggers for updated_at
CREATE OR REPLACE FUNCTION update_members_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_member_profile_changes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_member_billing_info_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_members_updated_at
    BEFORE UPDATE ON public.members
    FOR EACH ROW
    EXECUTE FUNCTION update_members_updated_at();

CREATE TRIGGER trigger_update_member_profile_changes_updated_at
    BEFORE UPDATE ON public.member_profile_changes
    FOR EACH ROW
    EXECUTE FUNCTION update_member_profile_changes_updated_at();

CREATE TRIGGER trigger_update_member_billing_info_updated_at
    BEFORE UPDATE ON public.member_billing_info
    FOR EACH ROW
    EXECUTE FUNCTION update_member_billing_info_updated_at();

-- Function to calculate member balance
CREATE OR REPLACE FUNCTION calculate_member_balance(p_member_id UUID)
RETURNS DECIMAL(10,2)
LANGUAGE plpgsql
AS $$
DECLARE
    balance DECIMAL(10,2) := 0;
BEGIN
    SELECT COALESCE(SUM(
        CASE 
            WHEN transaction_type IN ('credit', 'payment', 'beverage_credit') THEN amount
            WHEN transaction_type IN ('charge', 'membership_fee') THEN -amount
            ELSE 0
        END
    ), 0) INTO balance
    FROM member_ledger
    WHERE member_id = p_member_id;
    
    RETURN balance;
END;
$$;

-- Function to add ledger entry and update balance
CREATE OR REPLACE FUNCTION add_ledger_entry(
    p_member_id UUID,
    p_transaction_type TEXT,
    p_amount DECIMAL(10,2),
    p_description TEXT,
    p_reference_id TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
    new_balance DECIMAL(10,2);
    entry_id UUID;
BEGIN
    -- Calculate new balance
    new_balance := calculate_member_balance(p_member_id);
    
    IF p_transaction_type IN ('credit', 'payment', 'beverage_credit') THEN
        new_balance := new_balance + p_amount;
    ELSE
        new_balance := new_balance - p_amount;
    END IF;
    
    -- Insert ledger entry
    INSERT INTO member_ledger (
        member_id,
        transaction_type,
        amount,
        description,
        reference_id,
        balance_after,
        metadata
    ) VALUES (
        p_member_id,
        p_transaction_type,
        p_amount,
        p_description,
        p_reference_id,
        new_balance,
        p_metadata
    ) RETURNING id INTO entry_id;
    
    RETURN entry_id;
END;
$$;