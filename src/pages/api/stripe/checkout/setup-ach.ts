import type { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-08-27.basil',
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/stripe/checkout/setup-ach
 *
 * Creates a Stripe Checkout Session for ACH setup
 *
 * Body:
 *   - account_id: UUID
 *
 * Returns:
 *   - url: string (redirect URL for Stripe Checkout)
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

      await supabase
        .from('accounts')
        .update({ stripe_customer_id: customerId })
        .eq('account_id', account_id);
    }

    // Get base URL from request or environment
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const host = req.headers['host'];
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${protocol}://${host}`;

    // Create Checkout Session for ACH setup
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'setup',
      payment_method_types: ['us_bank_account'],
      success_url: `${baseUrl}/member/dashboard?payment_setup=success`,
      cancel_url: `${baseUrl}/member/dashboard?payment_setup=cancelled`,
      metadata: {
        account_id,
      },
    });

    return res.json({
      url: session.url,
    });
  } catch (error: any) {
    console.error('Error creating Checkout Session:', error);
    return res.status(500).json({ error: error.message });
  }
}
