-- Function to handle monthly credit replenishment for Skyline members
-- This function processes renewals and charges based on join_date

CREATE OR REPLACE FUNCTION process_monthly_credits()
RETURNS TABLE(
    member_id UUID,
    account_id UUID,
    membership TEXT,
    current_balance DECIMAL(10,2),
    credit_applied DECIMAL(10,2),
    charge_amount DECIMAL(10,2),
    action_taken TEXT
) AS $$
DECLARE
    member_record RECORD;
    current_balance DECIMAL(10,2);
    credit_needed DECIMAL(10,2);
    charge_amount DECIMAL(10,2);
    renewal_date DATE;
    today_date DATE := CURRENT_DATE;
    cst_timezone TEXT := 'America/Chicago';
BEGIN
    -- Process Skyline members only
    FOR member_record IN 
        SELECT 
            m.member_id,
            m.account_id,
            m.membership,
            m.join_date,
            m.credit_renewal_date,
            m.last_credit_date,
            a.stripe_customer_id 
        FROM members m 
        LEFT JOIN accounts a ON m.account_id = a.account_id
        WHERE m.membership = 'Skyline' 
        AND m.deactivated = false
        AND m.status = 'active'
    LOOP
        -- Calculate renewal date based on join_date (monthly from join date)
        renewal_date := (member_record.join_date::date + 
                        (EXTRACT(YEAR FROM today_date) - EXTRACT(YEAR FROM member_record.join_date::date)) * INTERVAL '1 year' +
                        (EXTRACT(MONTH FROM today_date) - EXTRACT(MONTH FROM member_record.join_date::date)) * INTERVAL '1 month' +
                        (EXTRACT(DAY FROM today_date) - EXTRACT(DAY FROM member_record.join_date::date)) * INTERVAL '1 day')::date;
        
        -- Check if it's time for renewal (within 1 day of renewal date)
        IF ABS(renewal_date - today_date) <= 1 THEN
            -- Calculate current balance
            SELECT COALESCE(SUM(amount), 0) INTO current_balance
            FROM ledger 
            WHERE account_id = member_record.account_id;
            
            -- Hard reset to $100 - determine what action is needed
            IF current_balance < 100 THEN
                -- Need to add credit to reach $100
                credit_needed := 100 - current_balance;
                charge_amount := 0;
                
                -- Add credit to ledger
                INSERT INTO ledger (member_id, account_id, type, amount, note, date)
                VALUES (member_record.member_id, member_record.account_id, 'credit', credit_needed, 'Monthly Skyline credit replenishment', today_date);
                
                RETURN QUERY SELECT 
                    member_record.member_id,
                    member_record.account_id,
                    member_record.membership,
                    current_balance,
                    credit_needed,
                    0::DECIMAL(10,2),
                    'credit_applied';
                    
            ELSIF current_balance > 100 THEN
                -- Member has overspent, charge the difference
                charge_amount := current_balance - 100;
                credit_needed := 0;
                
                -- Add charge to ledger (negative amount)
                INSERT INTO ledger (member_id, account_id, type, amount, note, date)
                VALUES (member_record.member_id, member_record.account_id, 'charge', -charge_amount, 'Monthly Skyline overspend charge', today_date);
                
                RETURN QUERY SELECT 
                    member_record.member_id,
                    member_record.account_id,
                    member_record.membership,
                    current_balance,
                    0::DECIMAL(10,2),
                    charge_amount,
                    'charge_applied';
            ELSE
                -- Balance is exactly $100, no action needed
                RETURN QUERY SELECT 
                    member_record.member_id,
                    member_record.account_id,
                    member_record.membership,
                    current_balance,
                    0::DECIMAL(10,2),
                    0::DECIMAL(10,2),
                    'no_action_needed';
            END IF;
            
            -- Update member record
            UPDATE members 
            SET credit_renewal_date = renewal_date + INTERVAL '1 month',
                last_credit_date = today_date
            WHERE member_id = member_record.member_id;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Create a function to manually trigger monthly credit processing
CREATE OR REPLACE FUNCTION trigger_monthly_credits()
RETURNS TEXT AS $$
BEGIN
    PERFORM process_monthly_credits();
    RETURN 'Monthly credit processing completed';
END;
$$ LANGUAGE plpgsql; 