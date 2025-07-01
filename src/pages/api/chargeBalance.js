// api/chargeBalance.js

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

  // 1) Fetch stripe_customer_id from accounts
  const { data: acct, error: acctErr } = await supabase
    .from('accounts')
    .select('stripe_customer_id')
    .eq('account_id', account_id)
    .single();
  if (acctErr || !acct || !acct.stripe_customer_id) {
    return res.status(400).json({ error: 'Stripe customer not found for account' });
  }
  const stripe_customer_id = acct.stripe_customer_id;

  // 2) Get the primary member_id for this account
  const { data: primaryMember, error: pmErr } = await supabase
    .from('members')
    .select('member_id')
    .eq('account_id', account_id)
    .eq('member_type', 'primary')
    .single();
  if (pmErr || !primaryMember || !primaryMember.member_id) {
    return res.status(400).json({ error: 'Primary member not found for account' });
  }
  const member_id = primaryMember.member_id;

  // 3) Determine a default payment method:
  let defaultPaymentMethodId = null;
  // 3a) Try invoice_settings.default_payment_method
  try {
    const stripeCustomer = await stripe.customers.retrieve(stripe_customer_id);
    defaultPaymentMethodId = stripeCustomer.invoice_settings.default_payment_method;
  } catch (err) {
    console.error('Error retrieving Stripe customer:', err);
  }
  // 3b) If still none, check active subscription
  if (!defaultPaymentMethodId) {
    try {
      const subs = await stripe.subscriptions.list({
        customer: stripe_customer_id,
        status: 'active',
        limit: 1,
      });
      if (subs.data.length > 0) {
        const sub = subs.data[0];
        defaultPaymentMethodId = sub.default_payment_method || sub.default_source || null;
      }
    } catch (err) {
      console.error('Error listing subscriptions:', err);
    }
  }
  // 3c) If still none, list attached cards
  if (!defaultPaymentMethodId) {
    try {
      const pmList = await stripe.paymentMethods.list({
        customer: stripe_customer_id,
        type: 'card',
        limit: 1,
      });
      if (pmList.data.length > 0) {
        defaultPaymentMethodId = pmList.data[0].id;
      }
    } catch (err) {
      console.error('Error listing payment methods:', err);
    }
  }
  if (!defaultPaymentMethodId) {
    return res.status(400).json({ error: 'No default payment method found' });
  }

  // 4) Compute account balance from ledger
  const { data: ledgerRows, error: ledgerErr } = await supabase
    .from('ledger')
    .select('amount')
    .eq('account_id', account_id);
  if (ledgerErr) {
    return res.status(500).json({ error: ledgerErr.message });
  }
  const balance = (ledgerRows || []).reduce((sum, t) => sum + Number(t.amount), 0);
  if (balance >= 0) {
    return res.status(400).json({ error: 'No outstanding balance' });
  }
  const amountToCharge = Math.round(Math.abs(balance) * 100); // in cents

  // 5) Create & confirm a PaymentIntent
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
    console.error('Stripe charge failed:', err);
    return res.status(500).json({ error: 'Stripe charge failed', details: err.message });
  }

  // 6) Log payment in ledger (include both account_id and member_id)
  const { error: insertErr } = await supabase
    .from('ledger')
    .insert({
      account_id,
      member_id,
      type: 'payment',
      amount: Math.abs(balance),
      note: 'Balance charged via Stripe',
      // date will default to today if your schema has a default
    });
  if (insertErr) {
    console.error('Failed to update ledger:', insertErr);
    return res.status(500).json({ error: 'Failed to update ledger', details: insertErr.message });
  }

  return res.status(200).json({ success: true, paymentIntent: intent });
}