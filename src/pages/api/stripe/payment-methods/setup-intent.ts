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
 *   - account_id: UUID
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

  const { account_id, payment_method_type = 'card' } = req.body;

  if (!account_id) {
    return res.status(400).json({ error: 'account_id is required' });
  }

  try {
    // Fetch account
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('stripe_customer_id')
      .eq('account_id', account_id)
      .single();

    if (accountError || !account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    // Get or create Stripe customer
    let customerId = account.stripe_customer_id;

    if (!customerId) {
      // Fetch a member from this account to get email/name
      const { data: member } = await supabase
        .from('members')
        .select('first_name, last_name, email')
        .eq('account_id', account_id)
        .limit(1)
        .single();

      const customer = await stripe.customers.create({
        email: member?.email || undefined,
        name: member ? `${member.first_name} ${member.last_name}` : undefined,
        metadata: {
          account_id,
        },
      });

      customerId = customer.id;

      // Update account with stripe_customer_id
      await supabase
        .from('accounts')
        .update({ stripe_customer_id: customerId })
        .eq('account_id', account_id);
    }

    // Create SetupIntent
    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: [payment_method_type],
      metadata: {
        account_id,
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
