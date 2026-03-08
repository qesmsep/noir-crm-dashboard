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
    // Get waitlist entry (check both application_token and agreement_token)
    const { data: waitlist, error: waitlistError } = await supabase
      .from('waitlist')
      .select('*')
      .or(`application_token.eq.${token},agreement_token.eq.${token}`)
      .single();

    if (waitlistError || !waitlist) {
      return res.status(404).json({ error: 'Invalid token' });
    }

    // Check if payment already processed
    if (waitlist.member_id) {
      return res.status(200).json({ success: true, message: 'Already processed' });
    }

    // Verify payment with Stripe (we use Stripe for payment processing only, not subscriptions)
    if (!waitlist.stripe_payment_intent_id) {
      return res.status(400).json({ error: 'No payment intent found' });
    }

    const paymentIntent = await stripe.paymentIntents.retrieve(waitlist.stripe_payment_intent_id);

    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({ error: 'Payment not completed' });
    }

    // Save the payment method to the customer for future charges
    if (paymentIntent.payment_method && waitlist.stripe_customer_id) {
      try {
        // Attach the payment method to the customer if not already attached
        await stripe.paymentMethods.attach(
          paymentIntent.payment_method as string,
          { customer: waitlist.stripe_customer_id }
        );

        // Set it as the default payment method for the customer
        await stripe.customers.update(waitlist.stripe_customer_id, {
          invoice_settings: {
            default_payment_method: paymentIntent.payment_method as string,
          },
        });

        console.log('Payment method saved as default for customer:', waitlist.stripe_customer_id);
      } catch (error: any) {
        // If payment method is already attached, that's fine
        if (error.code !== 'resource_already_exists') {
          console.error('Error saving payment method:', error);
        }
      }
    }

    // Create member and account
    const memberData = await createMemberFromWaitlist(waitlist, paymentIntent);

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
async function createMemberFromWaitlist(waitlist: any, paymentIntent: any) {
  // Get membership plan details
  const { data: plan } = await supabase
    .from('subscription_plans')
    .select('id, monthly_price')
    .eq('plan_name', waitlist.selected_membership)
    .single();

  const monthlyDues = plan?.monthly_price || 50;
  const membershipPlanId = plan?.id || null;

  // Calculate next billing date (1 month from now)
  const startDate = new Date();
  const nextBillingDate = new Date(startDate);
  nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);

  // Extract payment method details from the payment intent
  let paymentMethodType = null;
  let paymentMethodLast4 = null;
  let paymentMethodBrand = null;

  if (paymentIntent.payment_method) {
    const pm = await stripe.paymentMethods.retrieve(paymentIntent.payment_method as string);
    if (pm.card) {
      paymentMethodType = 'card';
      paymentMethodLast4 = pm.card.last4;
      paymentMethodBrand = pm.card.brand;
    } else if (pm.us_bank_account) {
      paymentMethodType = 'us_bank_account';
      paymentMethodLast4 = pm.us_bank_account.last4;
      paymentMethodBrand = pm.us_bank_account.bank_name;
    }
  }

  // Create account first
  const { data: account, error: accountError } = await supabase
    .from('accounts')
    .insert({
      stripe_customer_id: waitlist.stripe_customer_id,
      subscription_status: 'active',
      subscription_start_date: startDate.toISOString(),
      next_billing_date: nextBillingDate.toISOString(),
      monthly_dues: monthlyDues,
      membership_plan_id: membershipPlanId,
      payment_method_type: paymentMethodType,
      payment_method_last4: paymentMethodLast4,
      payment_method_brand: paymentMethodBrand
    })
    .select()
    .single();

  if (accountError) throw accountError;

  // Create member
  const { data: member, error: memberError } = await supabase
    .from('members')
    .insert({
      account_id: account.account_id,
      first_name: waitlist.first_name,
      last_name: waitlist.last_name,
      email: waitlist.email,
      phone: waitlist.phone,
      membership: waitlist.selected_membership || 'Solo',
      monthly_credit: monthlyDues,
      stripe_customer_id: waitlist.stripe_customer_id,
      address: waitlist.address,
      city: waitlist.city,
      state: waitlist.state,
      zip: waitlist.zip_code,
      photo: waitlist.photo_url,
      deactivated: false
    })
    .select()
    .single();

  if (memberError) throw memberError;

  // Create initial ledger entry for membership payment
  await supabase
    .from('ledger')
    .insert({
      account_id: account.account_id,
      member_id: member.member_id,
      type: 'payment',
      amount: (waitlist.payment_amount / 100).toFixed(2), // Convert cents to dollars
      date: getTodayLocalDate(),
      note: `Initial ${waitlist.selected_membership} membership payment`,
      stripe_payment_intent_id: waitlist.stripe_payment_intent_id
    });

  return { member_id: member.member_id, account_id: account.account_id };
}

// Helper function to get monthly credit based on membership
async function getMonthlyCreditForMembership(membership: string): Promise<number> {
  // Try to get from database first
  const { data: plan } = await supabase
    .from('subscription_plans')
    .select('monthly_price')
    .eq('plan_name', membership)
    .single();

  if (plan && plan.monthly_price) {
    return plan.monthly_price;
  }

  // Fallback for legacy data
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
