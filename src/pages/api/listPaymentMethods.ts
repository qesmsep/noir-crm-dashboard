import type { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { account_id } = req.query;

  if (!account_id || typeof account_id !== 'string') {
    return res.status(400).json({ error: 'account_id is required' });
  }

  try {
    // Get Stripe customer ID from account
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('stripe_customer_id')
      .eq('account_id', account_id)
      .single();

    if (accountError || !account?.stripe_customer_id) {
      return res.status(200).json({ payment_methods: [] });
    }

    // Fetch payment methods from Stripe
    const paymentMethods = await stripe.paymentMethods.list({
      customer: account.stripe_customer_id,
      type: 'card',
    });

    // Get default payment method
    const customer = await stripe.customers.retrieve(account.stripe_customer_id) as Stripe.Customer;
    const defaultPaymentMethodId = customer.invoice_settings?.default_payment_method;

    const methods = paymentMethods.data.map((pm) => ({
      id: pm.id,
      brand: pm.card?.brand || 'unknown',
      last4: pm.card?.last4 || '????',
      exp_month: pm.card?.exp_month || 0,
      exp_year: pm.card?.exp_year || 0,
      is_default: pm.id === defaultPaymentMethodId,
    }));

    return res.status(200).json({ payment_methods: methods });
  } catch (error: any) {
    console.error('Error listing payment methods:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
