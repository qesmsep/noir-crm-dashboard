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

    // Attach the payment method to the customer and set as default
    if (paymentIntent.payment_method && waitlist.stripe_customer_id) {
      try {
        const paymentMethodId = paymentIntent.payment_method as string;

        // First, check if payment method is already attached to the customer
        const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);

        // If not attached (customer is null), attach it now
        if (!paymentMethod.customer) {
          await stripe.paymentMethods.attach(paymentMethodId, {
            customer: waitlist.stripe_customer_id,
          });
          console.log('Payment method attached to customer:', waitlist.stripe_customer_id);
        }

        // Now set it as the default payment method
        await stripe.customers.update(waitlist.stripe_customer_id, {
          invoice_settings: {
            default_payment_method: paymentMethodId,
          },
        });

        console.log('Payment method set as default for customer:', waitlist.stripe_customer_id);
      } catch (error: any) {
        console.error('Error setting default payment method:', error);
        // Non-fatal error, continue with member creation
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
  let paymentMethodType: string | null = null;
  let paymentMethodLast4: string | null = null;
  let paymentMethodBrand: string | null = null;

  if (paymentIntent.payment_method) {
    const pm = await stripe.paymentMethods.retrieve(paymentIntent.payment_method as string);
    if (pm.card) {
      paymentMethodType = 'card';
      paymentMethodLast4 = pm.card.last4;
      paymentMethodBrand = pm.card.brand;
    } else if (pm.us_bank_account) {
      paymentMethodType = 'us_bank_account';
      paymentMethodLast4 = pm.us_bank_account.last4;
      paymentMethodBrand = pm.us_bank_account.bank_name || null;
    }
  }

  // Get credit card fee from payment intent metadata (check early to set on account)
  let creditCardFee = 0;
  if (paymentIntent.metadata?.credit_card_fee) {
    creditCardFee = parseInt(paymentIntent.metadata.credit_card_fee);
  }

  // Create account first
  const accountId = crypto.randomUUID();
  const { data: account, error: accountError } = await supabase
    .from('accounts')
    .insert({
      account_id: accountId,
      stripe_customer_id: waitlist.stripe_customer_id,
      subscription_status: 'active',
      subscription_start_date: startDate.toISOString(),
      next_billing_date: nextBillingDate.toISOString(),
      monthly_dues: monthlyDues,
      membership_plan_id: membershipPlanId,
      payment_method_type: paymentMethodType,
      payment_method_last4: paymentMethodLast4,
      payment_method_brand: paymentMethodBrand,
      credit_card_fee_enabled: creditCardFee > 0 // Enable fee if it was charged during signup
    })
    .select()
    .single();

  if (accountError) throw accountError;

  // Create member
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
      member_type: 'primary',
      membership: waitlist.selected_membership || 'Solo',
      monthly_credit: monthlyDues,
      stripe_customer_id: waitlist.stripe_customer_id,
      address: waitlist.address,
      city: waitlist.city,
      state: waitlist.state,
      zip: waitlist.zip_code,
      company: waitlist.company,
      dob: waitlist.date_of_birth,
      photo: waitlist.photo_url,
      join_date: startDate.toISOString(),
      deactivated: false
    })
    .select()
    .single();

  if (memberError) throw memberError;

  // creditCardFee already retrieved above before account creation
  const totalPaid = waitlist.payment_amount / 100; // Convert cents to dollars
  const feeAmount = creditCardFee / 100; // Convert cents to dollars

  // Create ledger entries
  const ledgerEntries: Array<{
    account_id: string;
    member_id: string;
    type: string;
    amount: string;
    date: string;
    note: string;
    stripe_payment_intent_id: string;
  }> = [];

  // 1. Payment entry (full amount charged)
  ledgerEntries.push({
    account_id: account.account_id,
    member_id: member.member_id,
    type: 'payment',
    amount: totalPaid.toFixed(2),
    date: getTodayLocalDate(),
    note: `Initial ${waitlist.selected_membership} membership payment`,
    stripe_payment_intent_id: waitlist.stripe_payment_intent_id
  });

  // 2. Processing fee debit (if fee exists)
  if (creditCardFee > 0) {
    ledgerEntries.push({
      account_id: account.account_id,
      member_id: member.member_id,
      type: 'debit',
      amount: (-feeAmount).toFixed(2), // Negative amount for debit
      date: getTodayLocalDate(),
      note: 'Credit card processing fee (4%)',
      stripe_payment_intent_id: waitlist.stripe_payment_intent_id
    });
  }

  // Insert all ledger entries
  await supabase
    .from('ledger')
    .insert(ledgerEntries);

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

Your membership to Noir is now active.

We HIGHLY recommend saving this number as "Noir"—this is how we stay in touch. To make a reservation, text "Reservation + Date/time + # of Guests" to this number anytime.

You can also manage your membership at:
https://noirkc.com/member/login

Questions? Just reply to this text.

We're excited to have you!`;

  // Send SMS using shared utility
  const { sendSMS } = await import('@/lib/sms');
  await sendSMS({
    to: waitlist.phone,
    content: message
  });
}
