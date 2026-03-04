import type { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

// Initialize Stripe with error handling
const stripeKey = process.env.STRIPE_SECRET_KEY;
if (!stripeKey) {
  console.error('[ACH Setup Intent] STRIPE_SECRET_KEY is not defined');
}

const stripe = new Stripe(stripeKey || 'sk_test_placeholder', {
  apiVersion: '2024-11-20.acacia',
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/stripe/ach/setup-intent
 *
 * Creates a SetupIntent for ACH bank account collection
 *
 * Body params:
 *   - account_id: UUID
 *
 * Returns:
 *   - client_secret: string
 *   - setup_intent_id: string
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { account_id } = req.body;

  if (!account_id) {
    return res.status(400).json({ error: 'account_id is required' });
  }

  try {
    // Fetch account to get Stripe customer ID
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('stripe_customer_id')
      .eq('account_id', account_id)
      .single();

    if (accountError || !account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    let stripeCustomerId = account.stripe_customer_id;

    // Create Stripe customer if doesn't exist
    if (!stripeCustomerId) {
      const { data: primaryMember } = await supabase
        .from('members')
        .select('first_name, last_name, email, phone')
        .eq('account_id', account_id)
        .eq('member_type', 'primary')
        .single();

      if (primaryMember) {
        const customer = await stripe.customers.create({
          name: `${primaryMember.first_name} ${primaryMember.last_name}`,
          email: primaryMember.email,
          phone: primaryMember.phone,
        });

        stripeCustomerId = customer.id;

        // Update account with customer ID
        await supabase
          .from('accounts')
          .update({ stripe_customer_id: stripeCustomerId })
          .eq('account_id', account_id);
      } else {
        return res.status(404).json({ error: 'Primary member not found' });
      }
    }

    // Create SetupIntent for ACH
    const setupIntent = await stripe.setupIntents.create({
      customer: stripeCustomerId,
      payment_method_types: ['us_bank_account'],
      payment_method_options: {
        us_bank_account: {
          verification_method: 'instant', // Try instant verification first, fallback to microdeposits
        },
      },
    });

    return res.json({
      client_secret: setupIntent.client_secret,
      setup_intent_id: setupIntent.id,
    });
  } catch (error: any) {
    console.error('Error creating ACH SetupIntent:', error);
    return res.status(500).json({ error: error.message });
  }
}
