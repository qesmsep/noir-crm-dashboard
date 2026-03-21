import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { getTodayLocalDate } from '@/lib/utils';
import { DateTime } from 'luxon';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-08-27.basil',
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('\n========== CONFIRM PAYMENT ==========');
  console.log('[CONFIRM] Method:', req.method);
  console.log('[CONFIRM] Body:', JSON.stringify(req.body, null, 2));

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { token } = req.body;

  if (!token) {
    console.log('[CONFIRM] ERROR: No token provided');
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
      console.log('[CONFIRM] ERROR: Waitlist not found for token:', token);
      console.log('[CONFIRM] Error:', waitlistError);
      return res.status(404).json({ error: 'Invalid token' });
    }

    console.log('[CONFIRM] Waitlist found:', {
      id: waitlist.id,
      name: `${waitlist.first_name} ${waitlist.last_name}`,
      email: waitlist.email,
      membership: waitlist.selected_membership,
      payment_intent_id: waitlist.stripe_payment_intent_id,
      member_id: waitlist.member_id
    });

    // Check if payment already processed
    if (waitlist.member_id) {
      console.log('[CONFIRM] Already processed - member already created');
      return res.status(200).json({ success: true, message: 'Already processed' });
    }

    // Verify payment with Stripe (we use Stripe for payment processing only, not subscriptions)
    if (!waitlist.stripe_payment_intent_id) {
      console.log('[CONFIRM] ERROR: No payment intent ID found on waitlist record');
      return res.status(400).json({ error: 'No payment intent found' });
    }

    console.log('[CONFIRM] Retrieving PaymentIntent:', waitlist.stripe_payment_intent_id);
    const paymentIntent = await stripe.paymentIntents.retrieve(waitlist.stripe_payment_intent_id);

    console.log('[CONFIRM] PaymentIntent details:');
    console.log('  - ID:', paymentIntent.id);
    console.log('  - Status:', paymentIntent.status);
    console.log('  - Amount:', paymentIntent.amount, 'cents ($' + (paymentIntent.amount / 100).toFixed(2) + ')');
    console.log('  - Payment method:', paymentIntent.payment_method);
    console.log('  - Payment method types:', paymentIntent.payment_method_types);

    // ACH payments can be 'requires_confirmation', 'processing', or 'requires_action' (microdeposits) initially
    // ACH payments take 3-5 days to settle
    // Card payments are 'succeeded' immediately
    const acceptedStatuses = ['succeeded', 'processing', 'requires_confirmation', 'requires_action'];
    if (!acceptedStatuses.includes(paymentIntent.status)) {
      console.log('[CONFIRM] ERROR: Invalid payment status');
      console.log('  - Current status:', paymentIntent.status);
      console.log('  - Accepted statuses:', acceptedStatuses);
      return res.status(400).json({
        error: 'Payment not completed',
        status: paymentIntent.status,
        message: `Payment status is ${paymentIntent.status}. Expected: ${acceptedStatuses.join(' or ')}`
      });
    }

    console.log('[CONFIRM] Payment status OK:', paymentIntent.status);

    // If payment requires confirmation (ACH payments), confirm it now
    if (paymentIntent.status === 'requires_confirmation') {
      console.log('[CONFIRM] Payment requires confirmation - confirming now...');

      // For ACH payments with setup_future_usage, mandate_data is required
      const confirmParams: Stripe.PaymentIntentConfirmParams = {};

      // Check if this is an ACH payment
      if (paymentIntent.payment_method_types.includes('us_bank_account')) {
        confirmParams.mandate_data = {
          customer_acceptance: {
            type: 'online',
            online: {
              ip_address: req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || '0.0.0.0',
              user_agent: req.headers['user-agent'] || 'Unknown'
            }
          }
        };
        console.log('[CONFIRM] Adding mandate_data for ACH payment');
      }

      try {
        const confirmedPayment = await stripe.paymentIntents.confirm(paymentIntent.id, confirmParams);
        console.log('[CONFIRM] Payment confirmed. New status:', confirmedPayment.status);

        // Update the paymentIntent variable with the confirmed version
        Object.assign(paymentIntent, confirmedPayment);
      } catch (confirmError: any) {
        console.error('[CONFIRM] Error during confirmation:', confirmError.message);

        // If error is about payment method already attached, that's OK - retrieve the latest intent
        if (confirmError.code === 'resource_already_exists' || confirmError.message?.includes('already attached')) {
          console.log('[CONFIRM] Payment method already attached - retrieving latest PaymentIntent');
          const latestIntent = await stripe.paymentIntents.retrieve(paymentIntent.id);
          Object.assign(paymentIntent, latestIntent);
        } else {
          // Re-throw other errors
          throw confirmError;
        }
      }
    }

    // Handle ACH payments that require verification (microdeposits)
    if (paymentIntent.status === 'requires_action' && paymentIntent.next_action?.type === 'verify_with_microdeposits') {
      console.log('[CONFIRM] ⚠️  Payment requires microdeposit verification');
      console.log('[CONFIRM] Customer will receive microdeposits in 1-2 business days');
      // Don't fail - just proceed with member creation
      // Customer will verify later, and we'll handle it via webhook
    }

    // Attach the payment method to the customer and set as default
    if (paymentIntent.payment_method && waitlist.stripe_customer_id) {
      try {
        const paymentMethodId = paymentIntent.payment_method as string;

        // First, check if payment method is already attached to the customer
        const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
        console.log('[CONFIRM] Payment method details:', {
          id: paymentMethod.id,
          type: paymentMethod.type,
          customer: paymentMethod.customer,
          alreadyAttached: !!paymentMethod.customer
        });

        // If not attached (customer is null), attach it now
        if (!paymentMethod.customer) {
          console.log('[CONFIRM] Attaching payment method to customer...');
          await stripe.paymentMethods.attach(paymentMethodId, {
            customer: waitlist.stripe_customer_id,
          });
          console.log('[CONFIRM] ✓ Payment method attached to customer:', waitlist.stripe_customer_id);
        } else {
          console.log('[CONFIRM] Payment method already attached to customer');
        }

        // Now set it as the default payment method
        await stripe.customers.update(waitlist.stripe_customer_id, {
          invoice_settings: {
            default_payment_method: paymentMethodId,
          },
        });

        console.log('[CONFIRM] ✓ Payment method set as default for customer:', waitlist.stripe_customer_id);
      } catch (error: any) {
        console.error('[CONFIRM] Error setting default payment method:', error.message);
        // Non-fatal error, continue with member creation
        // Financial Connections usually handles attachment, so this is often not needed
      }
    }

    console.log('[CONFIRM] Creating member and account...');
    // Create member and account
    const memberData = await createMemberFromWaitlist(waitlist, paymentIntent);
    console.log('[CONFIRM] Member created:', memberData.member_id);

    // Update waitlist with completion data
    await supabase
      .from('waitlist')
      .update({
        payment_completed_at: DateTime.now().setZone('America/Chicago').toISO(),
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

    console.log('[CONFIRM] Success! Member onboarding complete');
    console.log('==========================================\n');

    return res.status(200).json({
      success: true,
      member_id: memberData.member_id,
      message: 'Member created successfully'
    });

  } catch (error: any) {
    console.error('\n[CONFIRM] ❌ ERROR during confirmation:', error);
    console.error('Error stack:', error.stack);
    console.log('==========================================\n');
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

// Helper function to create member from waitlist
async function createMemberFromWaitlist(waitlist: any, paymentIntent: any) {
  // Get membership plan details
  const { data: plan } = await supabase
    .from('subscription_plans')
    .select('id, monthly_price, interval')
    .eq('plan_name', waitlist.selected_membership)
    .single();

  const basePriceAmount = plan?.monthly_price || 50;
  const membershipPlanId = plan?.id || null;
  const billingInterval = plan?.interval || 'month';

  // Calculate next billing date based on billing interval (using Chicago timezone)
  const CHICAGO_TZ = 'America/Chicago';
  const startDateTime = DateTime.now().setZone(CHICAGO_TZ).startOf('day');
  const nextBillingDateTime = billingInterval === 'year'
    ? startDateTime.plus({ years: 1 })
    : startDateTime.plus({ months: 1 });

  // Convert to ISO strings for database storage
  const startDate = startDateTime.toISO();
  const nextBillingDate = nextBillingDateTime.toISO();

  // Check if there are additional members being added during signup
  // For annual plans, multiply additional member fee by 12
  const additionalMembers = waitlist.additional_members || [];
  const additionalMemberCount = additionalMembers.length;
  const isSkylinePlan = basePriceAmount === 10;
  const additionalMemberFee = isSkylinePlan ? 0 : 25;
  const feeMultiplier = billingInterval === 'year' ? 12 : 1;
  const monthlyDues = basePriceAmount + (additionalMemberCount * additionalMemberFee * feeMultiplier);

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
      subscription_start_date: startDate,
      next_billing_date: nextBillingDate,
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
      join_date: startDate,
      deactivated: false
    })
    .select()
    .single();

  if (memberError) throw memberError;

  // creditCardFee already retrieved above before account creation
  const totalPaid = waitlist.payment_amount / 100; // Convert cents to dollars
  const feeAmount = creditCardFee / 100; // Convert cents to dollars

  // Get beverage credit from subscription plan to calculate admin fee
  let beverageCredit = 0;
  let adminFee = 0;

  if (plan && plan.id) {
    const { data: planDetails } = await supabase
      .from('subscription_plans')
      .select('beverage_credit')
      .eq('id', plan.id)
      .single();

    if (planDetails && planDetails.beverage_credit) {
      beverageCredit = parseFloat(planDetails.beverage_credit.toString());
      adminFee = basePriceAmount - beverageCredit;
    }
  }

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

  // 1. Payment entry (full amount paid including processing fee as credit)
  ledgerEntries.push({
    account_id: account.account_id,
    member_id: member.member_id,
    type: 'credit',
    amount: totalPaid.toFixed(2),
    date: getTodayLocalDate(),
    note: `Initial ${waitlist.selected_membership} membership payment`,
    stripe_payment_intent_id: waitlist.stripe_payment_intent_id
  });

  // 2. Admin fee charge (non-beverage portion)
  if (adminFee > 0) {
    ledgerEntries.push({
      account_id: account.account_id,
      member_id: member.member_id,
      type: 'charge',
      amount: adminFee.toFixed(2),
      date: getTodayLocalDate(),
      note: 'Membership administration fee',
      stripe_payment_intent_id: waitlist.stripe_payment_intent_id
    });
  }

  // 3. Additional members fee charge (if additional members exist)
  const additionalMembersFee = additionalMemberCount * additionalMemberFee * feeMultiplier;
  if (additionalMembersFee > 0) {
    ledgerEntries.push({
      account_id: account.account_id,
      member_id: member.member_id,
      type: 'charge',
      amount: additionalMembersFee.toFixed(2),
      date: getTodayLocalDate(),
      note: `Additional members fee (${additionalMemberCount} member${additionalMemberCount > 1 ? 's' : ''})`,
      stripe_payment_intent_id: waitlist.stripe_payment_intent_id
    });
  }

  // 4. Processing fee charge (if fee exists)
  if (creditCardFee > 0) {
    ledgerEntries.push({
      account_id: account.account_id,
      member_id: member.member_id,
      type: 'charge',
      amount: feeAmount.toFixed(2),
      date: getTodayLocalDate(),
      note: 'Credit card processing fee',
      stripe_payment_intent_id: waitlist.stripe_payment_intent_id
    });
  }

  // Insert all ledger entries
  const { error: ledgerError } = await supabase
    .from('ledger')
    .insert(ledgerEntries);

  if (ledgerError) {
    console.error('[PAYMENT CONFIRM] Failed to create ledger entries:', ledgerError);
    throw new Error(`Failed to create ledger entries: ${ledgerError.message}`);
  }

  console.log(`[PAYMENT CONFIRM] Created ${ledgerEntries.length} ledger entries for member ${member.member_id}`);
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
