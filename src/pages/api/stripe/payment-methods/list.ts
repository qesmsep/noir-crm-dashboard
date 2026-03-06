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
 * GET /api/stripe/payment-methods/list?account_id=xxx
 *
 * Lists all payment methods for an account
 *
 * Query params:
 *   - account_id: UUID
 *
 * Returns:
 *   - payment_methods: Array of Stripe PaymentMethod objects
 *   - default_payment_method: string | null (payment method ID)
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { account_id } = req.query;

  if (!account_id || typeof account_id !== 'string') {
    return res.status(400).json({ error: 'account_id is required' });
  }

  try {
    // Fetch account
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('stripe_customer_id, stripe_subscription_id')
      .eq('account_id', account_id)
      .single();

    if (accountError || !account || !account.stripe_customer_id) {
      return res.status(404).json({ error: 'Account or Stripe customer not found' });
    }

    // List payment methods - fetch both cards and bank accounts
    // Note: Stripe requires separate calls for different payment method types
    const [cards, bankAccounts] = await Promise.all([
      stripe.paymentMethods.list({
        customer: account.stripe_customer_id,
        type: 'card',
        limit: 100,
      }),
      stripe.paymentMethods.list({
        customer: account.stripe_customer_id,
        type: 'us_bank_account',
        limit: 100,
      }),
    ]);

    const paymentMethods = {
      data: [...cards.data, ...bankAccounts.data],
    };

    // Get default payment method from subscription or customer
    let defaultPaymentMethod: string | null = null;

    if (account.stripe_subscription_id) {
      const subscription = await stripe.subscriptions.retrieve(account.stripe_subscription_id);
      defaultPaymentMethod = subscription.default_payment_method as string;
    } else {
      const customer = await stripe.customers.retrieve(account.stripe_customer_id);
      if ('invoice_settings' in customer) {
        defaultPaymentMethod = customer.invoice_settings?.default_payment_method as string;
      }
    }

    return res.json({
      payment_methods: paymentMethods.data,
      default_payment_method: defaultPaymentMethod,
    });
  } catch (error: any) {
    console.error('Error listing payment methods:', error);
    return res.status(500).json({ error: error.message });
  }
}
