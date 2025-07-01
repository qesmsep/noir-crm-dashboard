// api/getStripeCustomer.js

import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { account_id } = req.body;
  if (!account_id) {
    return res.status(400).json({ error: 'account_id is required' });
  }

  // 1. Fetch stripe_customer_id from accounts table
  const { data: acct, error: acctErr } = await supabase
    .from('accounts')
    .select('stripe_customer_id')
    .eq('account_id', account_id)
    .single();

  if (acctErr || !acct || !acct.stripe_customer_id) {
    return res
      .status(400)
      .json({ error: 'Stripe customer not found for account' });
  }
  const stripe_customer_id = acct.stripe_customer_id;

  try {
    // 2. Fetch subscription (if any)
    const subs = await stripe.subscriptions.list({
      customer: stripe_customer_id,
      status: 'all',
      limit: 1,
    });
    const subscription = subs.data[0] || null;

    // 3. Determine last payment timestamp (if invoice exists)
    let last_payment = null;
    if (subscription?.latest_invoice) {
      const invoice = await stripe.invoices.retrieve(subscription.latest_invoice);
      last_payment = invoice.status === 'paid' ? invoice.paid_at : null;
    }

    return res.status(200).json({
      status: subscription ? subscription.status : 'none',
      next_renewal: subscription ? subscription.current_period_end : null,
      last_payment,
      subscription_id: subscription ? subscription.id : null,
      plan: subscription?.items.data[0]?.plan.nickname || null,
    });
  } catch (error) {
    console.error('Error in getStripeCustomer:', error);
    return res.status(500).json({ error: error.message });
  }
}