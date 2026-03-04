import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-06-30.basil',
});

const MEMBERSHIP_FEES: Record<string, number> = {
  'Solo': 50000,
  'Duo': 75000,
  'Skyline': 100000,
  'Annual': 120000,
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { token, membership_type } = req.body;

  if (!token || !membership_type) {
    return res.status(400).json({ error: 'Missing required fields' });
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

    // Get membership fee
    const amount = MEMBERSHIP_FEES[membership_type];
    if (!amount) {
      return res.status(400).json({ error: 'Invalid membership type' });
    }

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

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'usd',
      customer: customerId,
      metadata: {
        waitlist_id: waitlist.id,
        membership_type,
        token
      },
      description: `Noir ${membership_type} Membership - ${waitlist.first_name} ${waitlist.last_name}`,
      automatic_payment_methods: {
        enabled: true,
      },
    });

    // Update waitlist with payment intent ID and selected membership
    await supabase
      .from('waitlist')
      .update({
        stripe_payment_intent_id: paymentIntent.id,
        selected_membership: membership_type,
        payment_amount: amount
      })
      .eq('id', waitlist.id);

    return res.status(200).json({
      client_secret: paymentIntent.client_secret,
      amount
    });

  } catch (error: any) {
    console.error('Payment intent creation error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
