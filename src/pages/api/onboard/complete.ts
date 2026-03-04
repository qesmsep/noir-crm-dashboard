import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-08-27.basil'
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { token, membership_type } = req.body;

  if (!token || !membership_type) {
    return res.status(400).json({ error: 'Token and membership type required' });
  }

  try {
    // Find waitlist entry
    const { data: waitlist, error: waitlistError } = await supabase
      .from('waitlist')
      .select('*')
      .eq('agreement_token', token)
      .single();

    if (waitlistError || !waitlist) {
      return res.status(404).json({ error: 'Invalid token' });
    }

    // Check if already completed
    if (waitlist.member_id) {
      return res.status(400).json({ error: 'Onboarding already completed' });
    }

    // Get membership plan details
    const membershipPlans: Record<string, any> = {
      Solo: { base_fee: 500, monthly_credit: 50 },
      Duo: { base_fee: 750, monthly_credit: 75 },
      Skyline: { base_fee: 1000, monthly_credit: 100 },
      Annual: { base_fee: 1200, monthly_credit: 100 }
    };

    const plan = membershipPlans[membership_type];
    if (!plan) {
      return res.status(400).json({ error: 'Invalid membership type' });
    }

    // Create Stripe customer if not exists
    let stripeCustomerId = waitlist.stripe_customer_id;

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: waitlist.email,
        name: `${waitlist.first_name} ${waitlist.last_name}`,
        phone: waitlist.phone,
        metadata: {
          waitlist_id: waitlist.id,
          membership_type
        }
      });
      stripeCustomerId = customer.id;
    }

    // Create account
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .insert({
        account_name: `${waitlist.first_name} ${waitlist.last_name}`,
        email: waitlist.email,
        phone: waitlist.phone,
        stripe_customer_id: stripeCustomerId,
        membership_tier: membership_type,
        membership_status: 'active'
      })
      .select()
      .single();

    if (accountError || !account) {
      throw new Error('Failed to create account');
    }

    // Create member
    const { data: member, error: memberError } = await supabase
      .from('members')
      .insert({
        account_id: account.id,
        first_name: waitlist.first_name,
        last_name: waitlist.last_name,
        email: waitlist.email,
        phone: waitlist.phone,
        photo_url: waitlist.photo_url,
        is_primary: true
      })
      .select()
      .single();

    if (memberError || !member) {
      // Rollback account if member creation fails
      await supabase.from('accounts').delete().eq('id', account.id);
      throw new Error('Failed to create member');
    }

    // Create ledger entry for membership fee
    const { error: ledgerError } = await supabase
      .from('ledger_entries')
      .insert({
        account_id: account.id,
        entry_type: 'charge',
        amount: plan.base_fee,
        balance_after: -plan.base_fee,
        description: `${membership_type} Membership - Initial Fee`,
        created_by: 'system'
      });

    if (ledgerError) {
      console.error('Failed to create ledger entry:', ledgerError);
    }

    // Create initial credit if applicable
    if (plan.monthly_credit > 0) {
      const { error: creditError } = await supabase
        .from('ledger_entries')
        .insert({
          account_id: account.id,
          entry_type: 'credit',
          amount: plan.monthly_credit,
          balance_after: -plan.base_fee + plan.monthly_credit,
          description: `${membership_type} Membership - Initial Monthly Credit`,
          created_by: 'system'
        });

      if (creditError) {
        console.error('Failed to create credit entry:', creditError);
      }
    }

    // Update waitlist record
    const { error: updateError } = await supabase
      .from('waitlist')
      .update({
        member_id: member.id,
        selected_membership: membership_type,
        payment_completed_at: new Date().toISOString(),
        payment_amount: plan.base_fee,
        stripe_customer_id: stripeCustomerId
      })
      .eq('id', waitlist.id);

    if (updateError) {
      console.error('Failed to update waitlist:', updateError);
    }

    // Send welcome SMS (optional - using existing SMS infrastructure)
    try {
      await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/send-sms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: waitlist.phone,
          message: `Welcome to Noir, ${waitlist.first_name}! Your ${membership_type} membership is now active. Check your messages for login instructions. 🖤`
        })
      });
    } catch (smsError) {
      console.error('Failed to send welcome SMS:', smsError);
    }

    return res.status(200).json({
      success: true,
      member_id: member.id,
      account_id: account.id
    });
  } catch (error: any) {
    console.error('Onboard complete error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
