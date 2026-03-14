import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-08-27.basil',
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('\n========== CREATE PAYMENT INTENT ==========');
  console.log('[CREATE INTENT] Method:', req.method);
  console.log('[CREATE INTENT] Body:', JSON.stringify(req.body, null, 2));

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { token, membership_type, additional_members_count = 0, payment_method_type = 'card' } = req.body;

  if (!token || !membership_type) {
    console.log('[CREATE INTENT] Missing fields');
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Get waitlist entry
    const { data: waitlist, error: waitlistError } = await supabase
      .from('waitlist')
      .select('*')
      .or(`application_token.eq.${token},agreement_token.eq.${token}`)
      .single();

    if (waitlistError || !waitlist) {
      console.log('[CREATE INTENT] Waitlist not found:', waitlistError);
      return res.status(404).json({ error: 'Invalid token' });
    }

    console.log('[CREATE INTENT] Waitlist found:', waitlist.id);

    // Get membership plan from database
    const { data: plan, error: planError } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('plan_name', membership_type)
      .eq('is_active', true)
      .single();

    if (planError || !plan) {
      console.log('[CREATE INTENT] Plan not found:', membership_type);
      return res.status(400).json({ error: 'Invalid membership type' });
    }

    // Convert monthly_price to cents
    const basePlanAmount = Math.round(plan.monthly_price * 100);

    // Calculate additional members fee ($25/month each, $0 for Skyline)
    const additionalMemberFee = membership_type === 'Skyline' ? 0 : 25;
    const additionalMembersAmount = Math.round(additional_members_count * additionalMemberFee * 100);

    // Calculate subtotal before credit card fee
    const subtotal = basePlanAmount + additionalMembersAmount;

    // Calculate 4% credit card processing fee (only for card payments, not ACH)
    const creditCardFee = payment_method_type === 'card' ? Math.round(subtotal * 0.04) : 0;

    // Total amount including credit card fee (if applicable)
    const totalAmount = subtotal + creditCardFee;

    console.log('[CREATE INTENT] Payment calculation:');
    console.log('  - Payment method type:', payment_method_type);
    console.log('  - Base amount:', basePlanAmount, 'cents');
    console.log('  - Additional members:', additional_members_count);
    console.log('  - Additional amount:', additionalMembersAmount, 'cents');
    console.log('  - Subtotal:', subtotal, 'cents');
    console.log('  - Credit card fee:', creditCardFee, 'cents', payment_method_type === 'card' ? '(APPLIED)' : '(SKIPPED for ACH)');
    console.log('  - Total amount:', totalAmount, 'cents ($' + (totalAmount / 100).toFixed(2) + ')');

    // Create or get Stripe customer
    let customerId = waitlist.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: waitlist.email,
        name: `${waitlist.first_name} ${waitlist.last_name}`,
        phone: waitlist.phone,
        metadata: {
          waitlist_id: waitlist.id,
          membership_type
        }
      });

      customerId = customer.id;

      // Update waitlist with customer ID
      await supabase
        .from('waitlist')
        .update({ stripe_customer_id: customerId })
        .eq('id', waitlist.id);
    }

    console.log('[CREATE INTENT] Creating PaymentIntent with:');
    console.log('  - payment_method_types:', ['card', 'us_bank_account']);
    console.log('  - amount:', totalAmount);
    console.log('  - customer:', customerId);

    // Create payment intent
    // For card payments: includes 4% processing fee
    // For ACH payments: no processing fee
    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalAmount,
      currency: 'usd',
      customer: customerId,
      payment_method_types: ['card', 'us_bank_account'], // Allow both cards and ACH
      metadata: {
        waitlist_id: waitlist.id,
        membership_type,
        token,
        base_amount: basePlanAmount,
        additional_members_count: additional_members_count.toString(),
        additional_members_amount: additionalMembersAmount.toString(),
        subtotal: subtotal.toString(),
        credit_card_fee: creditCardFee.toString(),
        fee_enabled: 'true'
      },
      description: additional_members_count > 0
        ? `Noir ${membership_type} Membership + ${additional_members_count} Additional Member${additional_members_count > 1 ? 's' : ''} - ${waitlist.first_name} ${waitlist.last_name}`
        : `Noir ${membership_type} Membership - ${waitlist.first_name} ${waitlist.last_name}`,
      setup_future_usage: 'off_session', // Save payment method for recurring billing
    });

    // Update waitlist with payment intent ID and selected membership
    await supabase
      .from('waitlist')
      .update({
        stripe_payment_intent_id: paymentIntent.id,
        selected_membership: membership_type,
        payment_amount: totalAmount
      })
      .eq('id', waitlist.id);

    console.log('[CREATE INTENT] PaymentIntent created successfully:');
    console.log('  - ID:', paymentIntent.id);
    console.log('  - Status:', paymentIntent.status);
    console.log('  - Amount:', paymentIntent.amount, 'cents');
    console.log('  - Payment method types:', paymentIntent.payment_method_types);
    console.log('==========================================\n');

    return res.status(200).json({
      client_secret: paymentIntent.client_secret,
      amount: totalAmount,
      baseAmount: basePlanAmount,
      additionalMembersAmount,
      additionalMembersCount: additional_members_count,
      subtotal: subtotal,
      creditCardFee: creditCardFee,
      feeMessage: payment_method_type === 'card'
        ? '4% credit card processing fee included'
        : 'No processing fee for ACH payments'
    });

  } catch (error: any) {
    console.error('Payment intent creation error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
