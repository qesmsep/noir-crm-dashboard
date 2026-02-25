import type { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-06-30.basil',
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/stripe/payment-methods/setup-intent
 *
 * Creates a Stripe SetupIntent for adding/updating payment methods
 *
 * Body:
 *   - member_id: UUID
 *   - payment_method_type: 'card' | 'us_bank_account'
 *
 * Returns:
 *   - client_secret: string (for Stripe Elements)
 *   - setup_intent_id: string
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { member_id, payment_method_type = 'card' } = req.body;

  if (!member_id) {
    return res.status(400).json({ error: 'member_id is required' });
  }

  try {
    // Fetch member
    const { data: member, error: memberError } = await supabase
      .from('members')
      .select('stripe_customer_id, first_name, last_name, email')
      .eq('member_id', member_id)
      .single();

    if (memberError || !member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    // Get or create Stripe customer
    let customerId = member.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: member.email || undefined,
        name: `${member.first_name} ${member.last_name}`,
        metadata: {
          member_id,
        },
      });

      customerId = customer.id;

      // Update member with stripe_customer_id
      await supabase
        .from('members')
        .update({ stripe_customer_id: customerId })
        .eq('member_id', member_id);
    }

    // Create SetupIntent
    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: [payment_method_type],
      metadata: {
        member_id,
      },
    });

    return res.json({
      client_secret: setupIntent.client_secret,
      setup_intent_id: setupIntent.id,
    });
  } catch (error: any) {
    console.error('Error creating SetupIntent:', error);
    return res.status(500).json({ error: error.message });
  }
}
