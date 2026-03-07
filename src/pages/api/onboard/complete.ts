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

    // Get membership plan details from database
    const { data: plan, error: planError } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('plan_name', membership_type)
      .eq('is_active', true)
      .single();

    let base_fee: number;
    let monthly_credit: number;

    if (planError || !plan) {
      // Fallback to hardcoded values for legacy support
      console.log('[ONBOARD COMPLETE] Using fallback plan for:', membership_type);
      const membershipPlans: Record<string, any> = {
        Solo: { base_fee: 500, monthly_price: 50 },
        Duo: { base_fee: 750, monthly_price: 75 },
        Skyline: { base_fee: 1000, monthly_price: 100 },
        Annual: { base_fee: 1200, monthly_price: 100 }
      };

      const fallbackPlan = membershipPlans[membership_type];
      if (!fallbackPlan) {
        return res.status(400).json({ error: 'Invalid membership type' });
      }

      base_fee = fallbackPlan.base_fee;
      monthly_credit = fallbackPlan.monthly_price;
    } else {
      // Convert monthly_price to cents if needed
      base_fee = Math.round(plan.monthly_price * 100);
      monthly_credit = plan.monthly_price;
      console.log('[ONBOARD COMPLETE] Using database plan:', { plan_name: plan.plan_name, base_fee, monthly_credit });
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

    // Create primary member
    const { data: member, error: memberError } = await supabase
      .from('members')
      .insert({
        account_id: account.id,
        first_name: waitlist.first_name,
        last_name: waitlist.last_name,
        email: waitlist.email,
        phone: waitlist.phone,
        photo_url: waitlist.photo_url,
        is_primary: true,
        member_type: 'primary'
      })
      .select()
      .single();

    if (memberError || !member) {
      // Rollback account if member creation fails
      await supabase.from('accounts').delete().eq('id', account.id);
      throw new Error('Failed to create member');
    }

    // Create additional members if any
    const additionalMembers = waitlist.additional_members || [];
    if (Array.isArray(additionalMembers) && additionalMembers.length > 0) {
      console.log('[ONBOARD COMPLETE] Creating', additionalMembers.length, 'additional members');

      for (const additionalMember of additionalMembers) {
        try {
          await supabase
            .from('members')
            .insert({
              account_id: account.id,
              first_name: additionalMember.first_name,
              last_name: additionalMember.last_name,
              email: additionalMember.email,
              phone: additionalMember.phone,
              dob: additionalMember.dob,
              photo_url: additionalMember.photo || null,
              is_primary: false,
              member_type: 'secondary'
            });
        } catch (error) {
          console.error('Failed to create additional member:', error);
          // Continue creating other members even if one fails
        }
      }
    }

    // Calculate additional members fee
    const additionalMemberFee = membership_type === 'Skyline' ? 0 : 25;
    const additionalMembersTotalFee = additionalMembers.length * additionalMemberFee;
    const totalInitialFee = base_fee + additionalMembersTotalFee;

    // Create ledger entry for membership fee
    const { error: ledgerError } = await supabase
      .from('ledger_entries')
      .insert({
        account_id: account.id,
        entry_type: 'charge',
        amount: base_fee,
        balance_after: -base_fee,
        description: `${membership_type} Membership - Initial Fee`,
        created_by: 'system'
      });

    if (ledgerError) {
      console.error('Failed to create ledger entry:', ledgerError);
    }

    // Create ledger entry for additional members if applicable
    if (additionalMembersTotalFee > 0) {
      const { error: additionalFeeLedgerError } = await supabase
        .from('ledger_entries')
        .insert({
          account_id: account.id,
          entry_type: 'charge',
          amount: additionalMembersTotalFee,
          balance_after: -totalInitialFee,
          description: `Additional Members Fee - ${additionalMembers.length} member${additionalMembers.length > 1 ? 's' : ''} @ $${additionalMemberFee}/month`,
          created_by: 'system'
        });

      if (additionalFeeLedgerError) {
        console.error('Failed to create additional members ledger entry:', additionalFeeLedgerError);
      }
    }

    // Create initial credit if applicable
    if (monthly_credit > 0) {
      const { error: creditError} = await supabase
        .from('ledger_entries')
        .insert({
          account_id: account.id,
          entry_type: 'credit',
          amount: monthly_credit,
          balance_after: -totalInitialFee + monthly_credit,
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
        payment_amount: totalInitialFee,
        stripe_customer_id: stripeCustomerId
      })
      .eq('id', waitlist.id);

    if (updateError) {
      console.error('Failed to update waitlist:', updateError);
    }

    // Send welcome SMS (optional - using existing SMS infrastructure)
    try {
      const { sendSMS } = await import('@/lib/sms');
      await sendSMS({
        to: waitlist.phone,
        content: `Welcome to Noir, ${waitlist.first_name}! Your ${membership_type} membership is now active. You will be recieving a text message shortly to access your Member Portal. Welcome to Noir. 🖤`
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
