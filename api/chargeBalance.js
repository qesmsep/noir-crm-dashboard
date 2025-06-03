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

  const { member_id, account_id } = req.body;
  if (!member_id || !account_id) {
    return res.status(400).json({ error: 'member_id and account_id are required' });
  }

  // 1) Fetch this member’s account_id (already have account_id, but still fetch to validate member)
  const { data: thisMember, error: memErr } = await supabase
    .from('members')
    .select('account_id')
    .eq('member_id', member_id)
    .single();
  if (memErr || !thisMember) {
    return res.status(404).json({ error: 'Member not found' });
  }

  // 2) Find primary member’s Stripe customer for that account
  const { data: primary, error: primaryErr } = await supabase
    .from('members')
    .select('stripe_customer_id')
    .eq('account_id', thisMember.account_id)
    .eq('member_type', 'primary')
    .single();

  if (primaryErr || !primary || !primary.stripe_customer_id) {
    return res.status(400).json({ error: 'Primary Stripe customer not found for account' });
  }

  const stripe_customer_id = primary.stripe_customer_id;

  // Retrieve default payment method from customer or subscription
  let defaultPaymentMethodId = null;
  // Try customer's invoice settings
  const stripeCustomer = await stripe.customers.retrieve(stripe_customer_id);
  defaultPaymentMethodId = stripeCustomer.invoice_settings.default_payment_method;
  // If none, try the active subscription's default payment method or source
  if (!defaultPaymentMethodId) {
    const subs = await stripe.subscriptions.list({
      customer: stripe_customer_id,
      status: 'active',
      limit: 1
    });
    if (subs.data.length > 0) {
      defaultPaymentMethodId = subs.data[0].default_payment_method || subs.data[0].default_source;
    }
  }
  if (!defaultPaymentMethodId) {
    return res.status(400).json({ error: 'No default payment method found on customer or subscription' });
  }

  // 3. Get ledger for account and compute balance
  const { data: ledger, error: ledgerError } = await supabase
    .from('ledger')
    .select('amount,type')
    .eq('account_id', account_id);
  if (ledgerError) {
    return res.status(500).json({ error: 'Failed to fetch ledger' });
  }
  let balance = 0;
  for (const t of ledger || []) {
    balance += Number(t.amount);
  }
  // Only charge if balance is negative (i.e., account owes money)
  if (balance >= 0) {
    return res.status(400).json({ error: 'No outstanding balance' });
  }
  // Convert to positive for Stripe charge
  const chargeAmount = Math.abs(balance);

  // 4. Create Stripe PaymentIntent and confirm
  let intent;
  try {
    intent = await stripe.paymentIntents.create({
      amount: Math.round(chargeAmount * 100), // in cents
      currency: 'usd',
      customer: stripe_customer_id,
      payment_method: defaultPaymentMethodId,
      off_session: true,
      confirm: true,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Stripe charge failed', details: err.message });
  }

  // 5. Insert payment into ledger
  const { error: ledgerInsertError } = await supabase
    .from('ledger')
    .insert({
      member_id,
      account_id,
      type: 'payment',
      amount: chargeAmount,
      note: 'Balance charged via Stripe',
    });
  if (ledgerInsertError) {
    return res.status(500).json({ error: 'Failed to update ledger', details: ledgerInsertError.message });
  }

  return res.status(200).json({ success: true, paymentIntent: intent });
}