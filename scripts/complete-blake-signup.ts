import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { getTodayLocalDate } from '../src/lib/utils';
import * as path from 'path';

// Load environment variables
config({ path: path.join(__dirname, '..', '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function completeBlakeSignup() {
  const waitlistId = 'd0388be8-6a6d-4688-b5ec-411904b05989';
  const paymentIntentId = 'pi_3T8WjxFdjSPifIH51J6vLsoQ'; // The one that actually succeeded

  try {
    // Get waitlist entry
    const { data: waitlist, error: waitlistError } = await supabase
      .from('waitlist')
      .select('*')
      .eq('id', waitlistId)
      .single();

    if (waitlistError || !waitlist) {
      console.error('Waitlist not found:', waitlistError);
      return;
    }

    console.log('Found waitlist:', {
      id: waitlist.id,
      name: `${waitlist.first_name} ${waitlist.last_name}`,
      email: waitlist.email,
      phone: waitlist.phone,
      membership: waitlist.selected_membership,
      amount: waitlist.payment_amount
    });

    // Check if already processed
    if (waitlist.member_id) {
      console.log('Already processed - member_id:', waitlist.member_id);
      return;
    }

    // Create account
    console.log('Creating account...');
    const accountId = crypto.randomUUID();
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .insert({
        account_id: accountId,
        stripe_customer_id: waitlist.stripe_customer_id,
        subscription_status: 'active'
      })
      .select()
      .single();

    if (accountError) {
      console.error('Failed to create account:', accountError);
      return;
    }

    console.log('Account created:', account.account_id);

    // Get monthly credit from subscription_plans
    const { data: plan } = await supabase
      .from('subscription_plans')
      .select('monthly_price')
      .eq('plan_name', waitlist.selected_membership)
      .single();

    const monthlyCredit = plan?.monthly_price || 50;

    // Create member
    console.log('Creating member...');
    const memberId = crypto.randomUUID();
    const { data: member, error: memberError } = await supabase
      .from('members')
      .insert({
        member_id: memberId,
        account_id: account.account_id,
        first_name: waitlist.first_name,
        last_name: waitlist.last_name,
        email: waitlist.email,
        phone: waitlist.phone,
        membership: waitlist.selected_membership,
        monthly_credit: monthlyCredit,
        stripe_customer_id: waitlist.stripe_customer_id,
        // photo_url is too large for this operation - skipping
        deactivated: false
      })
      .select()
      .single();

    if (memberError) {
      console.error('Failed to create member:', memberError);
      return;
    }

    console.log('Member created:', member.member_id);

    // Create ledger entry
    console.log('Creating ledger entry...');
    const { error: ledgerError } = await supabase
      .from('ledger')
      .insert({
        account_id: account.account_id,
        member_id: member.member_id,
        type: 'payment',
        amount: (waitlist.payment_amount / 100).toFixed(2),
        date: getTodayLocalDate(),
        note: `Initial ${waitlist.selected_membership} membership payment`,
        stripe_payment_intent_id: paymentIntentId
      });

    if (ledgerError) {
      console.error('Failed to create ledger entry:', ledgerError);
      return;
    }

    console.log('Ledger entry created');

    // Update waitlist
    console.log('Updating waitlist...');
    const { error: updateError } = await supabase
      .from('waitlist')
      .update({
        payment_completed_at: new Date().toISOString(),
        member_id: member.member_id,
        status: 'approved',
        stripe_payment_intent_id: paymentIntentId // Update to the correct payment intent
      })
      .eq('id', waitlist.id);

    if (updateError) {
      console.error('Failed to update waitlist:', updateError);
      return;
    }

    console.log('✅ Successfully completed signup for Blake Miller');
    console.log('Account ID:', account.account_id);
    console.log('Member ID:', member.member_id);

  } catch (error) {
    console.error('Error:', error);
  }
}

completeBlakeSignup();
