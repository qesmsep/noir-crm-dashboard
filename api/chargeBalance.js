// api/chargeBalance.js

import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL,
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

  // 1. Fetch stripe_customer_id from accounts
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

  // 2. Retrieve default payment method (invoice_settings or active subscription)
  let defaultPaymentMethodId = null;
  const stripeCustomer = await stripe.customers.retrieve(stripe_customer_id);
  defaultPaymentMethodId = stripeCustomer.invoice_settings.default_payment_method;

  if (!defaultPaymentMethodId) {
    const subs = await stripe.subscriptions.list({
      customer: stripe_customer_id,
      status: 'active',
      limit: 1,
    });
    if (subs.data.length > 0) {
      defaultPaymentMethodId =
        subs.data[0].default_payment_method || subs.data[0].default_source;
    }
  }
  if (!defaultPaymentMethodId) {
    return res
      .status(400)
      .json({ error: 'No default payment method found' });
  }

  // 3. Compute account balance from ledger
  const { data: ledgerRows, error: ledgerErr } = await supabase
    .from('ledger')
    .select('amount')
    .eq('account_id', account_id);
  if (ledgerErr) {
    return res.status(500).json({ error: ledgerErr.message });
  }

  const balance = (ledgerRows || []).reduce(
    (sum, t) => sum + Number(t.amount),
    0
  );
  if (balance >= 0) {
    return res.status(400).json({ error: 'No outstanding balance' });
  }
  const amountToCharge = Math.round(Math.abs(balance) * 100); // in cents

  // 4. Create & confirm a Stripe PaymentIntent
  let intent;
  try {
    intent = await stripe.paymentIntents.create({
      amount: amountToCharge,
      currency: 'usd',
      customer: stripe_customer_id,
      payment_method: defaultPaymentMethodId,
      off_session: true,
      confirm: true,
    });
  } catch (err) {
    return res
      .status(500)
      .json({ error: 'Stripe charge failed', details: err.message });
  }

  // 5. Log payment in ledger
  const { error: insertErr } = await supabase
    .from('ledger')
    .insert({
      account_id,
      type: 'payment',
      amount: Math.abs(balance),
      note: 'Balance charged via Stripe',
    });
  if (insertErr) {
    return res
      .status(500)
      .json({ error: 'Failed to update ledger', details: insertErr.message });
  }

  return res.status(200).json({ success: true, paymentIntent: intent });
}