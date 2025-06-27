// api/linkStripeCustomer.js

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

  const { account_id, first_name, last_name, email } = req.body;
  if (!account_id || !email) {
    return res.status(400).json({ error: 'Missing account_id or email' });
  }

  try {
    // 1. Look for an existing Stripe customer by email
    const customers = await stripe.customers.list({ email, limit: 1 });
    let customer = customers.data[0];
    if (!customer) {
      // 2. If none, create a new Stripe customer
      customer = await stripe.customers.create({
        email,
        name: `${first_name || ''} ${last_name || ''}`.trim(),
      });
    }

    // 3. Upsert account’s stripe_customer_id
    const { error: upsertErr } = await supabase
      .from('accounts')
      .upsert(
        { account_id, stripe_customer_id: customer.id },
        { onConflict: 'account_id' }
      );
    if (upsertErr) throw upsertErr;

    return res.status(200).json({ success: true, stripe_customer: customer });
  } catch (err) {
    console.error('Error in linkStripeCustomer:', err);
    return res.status(500).json({ error: err.message });
  }
}