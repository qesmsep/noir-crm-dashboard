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
  console.log('[CREATE INTENT] Request:', { method: req.method, body: req.body });

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { token, membership_type, additional_members_count = 0 } = req.body;

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

    // Calculate 4% credit card processing fee (applied by default for new memberships)
    const creditCardFee = Math.round(subtotal * 0.04);

    // Total amount including credit card fee
    const totalAmount = subtotal + creditCardFee;

    console.log('[CREATE INTENT] Base amount:', basePlanAmount, 'Additional members:', additional_members_count, 'Additional amount:', additionalMembersAmount, 'Subtotal:', subtotal, 'Credit card fee:', creditCardFee, 'Total:', totalAmount);

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

    // Create payment intent with 4% credit card fee included
    // Note: Fee is charged upfront for credit card payments (default)
    // If customer pays via ACH, they can request a refund of the processing fee
    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalAmount,
      currency: 'usd',
      customer: customerId,
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
      automatic_payment_methods: {
        enabled: true,
      },
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

    return res.status(200).json({
      client_secret: paymentIntent.client_secret,
      amount: totalAmount,
      baseAmount: basePlanAmount,
      additionalMembersAmount,
      additionalMembersCount: additional_members_count,
      subtotal: subtotal,
      creditCardFee: creditCardFee,
      feeMessage: '4% credit card processing fee included'
    });

  } catch (error: any) {
    console.error('Payment intent creation error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
