import type { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { account_id, payment_method_id } = req.body;

  if (!account_id || !payment_method_id) {
    return res.status(400).json({ error: 'account_id and payment_method_id are required' });
  }

  try {
    // Get Stripe customer ID from account
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('stripe_customer_id')
      .eq('account_id', account_id)
      .single();

    if (accountError || !account?.stripe_customer_id) {
      return res.status(400).json({ error: 'No Stripe customer found for this account' });
    }

    // Attach payment method to customer
    await stripe.paymentMethods.attach(payment_method_id, {
      customer: account.stripe_customer_id,
    });

    // If this is the first card, set it as default
    const existing = await stripe.paymentMethods.list({
      customer: account.stripe_customer_id,
      type: 'card',
    });

    if (existing.data.length === 1) {
      await stripe.customers.update(account.stripe_customer_id, {
        invoice_settings: {
          default_payment_method: payment_method_id,
        },
      });
    }

    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('Error setting up payment method:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
