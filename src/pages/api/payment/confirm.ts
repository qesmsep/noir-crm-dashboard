import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { getTodayLocalDate } from '@/lib/utils';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-08-27.basil',
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ error: 'Token is required' });
  }

  try {
    // Get waitlist entry
    const { data: waitlist, error: waitlistError } = await supabase
      .from('waitlist')
      .select('*')
      .eq('application_token', token)
      .single();

    if (waitlistError || !waitlist) {
      return res.status(404).json({ error: 'Invalid token' });
    }

    // Check if payment already processed
    if (waitlist.member_id) {
      return res.status(200).json({ success: true, message: 'Already processed' });
    }

    // Verify payment with Stripe
    if (!waitlist.stripe_payment_intent_id) {
      return res.status(400).json({ error: 'No payment intent found' });
    }

    const paymentIntent = await stripe.paymentIntents.retrieve(waitlist.stripe_payment_intent_id);

    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({ error: 'Payment not completed' });
    }

    // Create member and account
    const memberData = await createMemberFromWaitlist(waitlist);

    // Update waitlist with completion data
    await supabase
      .from('waitlist')
      .update({
        payment_completed_at: new Date().toISOString(),
        member_id: memberData.member_id,
        status: 'approved'
      })
      .eq('id', waitlist.id);

    // Send welcome SMS
    try {
      await sendWelcomeSMS(waitlist);
    } catch (smsError) {
      console.error('Failed to send welcome SMS:', smsError);
    }

    return res.status(200).json({
      success: true,
      member_id: memberData.member_id,
      message: 'Member created successfully'
    });

  } catch (error: any) {
    console.error('Payment confirmation error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

// Helper function to create member from waitlist
async function createMemberFromWaitlist(waitlist: any) {
  // Create account first
  const { data: account, error: accountError } = await supabase
    .from('accounts')
    .insert({
      account_name: `${waitlist.first_name} ${waitlist.last_name}`,
      status: 'active'
    })
    .select()
    .single();

  if (accountError) throw accountError;

  // Create member
  const { data: member, error: memberError } = await supabase
    .from('members')
    .insert({
      account_id: account.id,
      first_name: waitlist.first_name,
      last_name: waitlist.last_name,
      email: waitlist.email,
      phone: waitlist.phone,
      membership: waitlist.selected_membership || 'Solo',
      monthly_credit: getMonthlyCreditForMembership(waitlist.selected_membership),
      stripe_customer_id: waitlist.stripe_customer_id,
      photo_url: waitlist.photo_url,
      deactivated: false
    })
    .select()
    .single();

  if (memberError) throw memberError;

  // Create initial ledger entry for membership payment
  await supabase
    .from('ledger_entries')
    .insert({
      account_id: account.id,
      member_id: member.member_id,
      type: 'payment',
      amount: (waitlist.payment_amount / 100).toFixed(2), // Convert cents to dollars
      date: getTodayLocalDate(),
      note: `Initial ${waitlist.selected_membership} membership payment`,
      stripe_payment_intent_id: waitlist.stripe_payment_intent_id
    });

  return { member_id: member.member_id, account_id: account.id };
}

// Helper function to get monthly credit based on membership
function getMonthlyCreditForMembership(membership: string): number {
  const credits: Record<string, number> = {
    'Solo': 50,
    'Duo': 75,
    'Skyline': 100,
    'Annual': 100
  };
  return credits[membership] || 50;
}

// Helper function to send welcome SMS
async function sendWelcomeSMS(waitlist: any): Promise<void> {
  const message = `Welcome to Noir, ${waitlist.first_name}! 🖤

Your ${waitlist.selected_membership} membership is now active.

To make a reservation, text "RESERVATION" to this number anytime.

You can also manage your membership at:
https://noirkc.com/member

Questions? Just reply to this text.

We're excited to have you!`;

  // Send SMS using shared utility
  const { sendSMS } = await import('@/lib/sms');
  await sendSMS({
    to: waitlist.phone,
    content: message
  });
}
