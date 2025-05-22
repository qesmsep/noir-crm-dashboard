// /api/stripeWebhook.js

import { buffer } from 'micro';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-08-16',
});

export const config = {
  api: {
    bodyParser: false, // Stripe requires the raw body
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).end('Method Not Allowed');
  }

  // Get the raw body for Stripe signature verification
  const buf = await buffer(req);
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    event = stripe.webhooks.constructEvent(buf, sig, webhookSecret);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Only handle checkout.session.completed events
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;

    // Pull email and customer ID
    const email = session.customer_email;
    const stripeCustomerId = session.customer;

    // Connect to Supabase
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

    // Find member by email
    const { data: member, error } = await supabase
      .from('members')
      .select('member_id')
      .eq('email', email)
      .single();

    if (error || !member) {
      return res.status(404).json({ error: "Member not found" });
    }

    // Update the member's stripe_customer_id and status
    await supabase
      .from('members')
      .update({ stripe_customer_id: stripeCustomerId, status: 'active' })
      .eq('member_id', member.member_id);
  }

  // Handle automatic subscription renewals
  if (event.type === 'invoice.payment_succeeded') {
    const invoice = event.data.object;
    const stripeCustomerId = invoice.customer;
    const amountPaid = invoice.amount_paid; // in cents
    // Connect to Supabase
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
    // Find member by stripe_customer_id
    const { data: member, error: memberErr } = await supabase
      .from('members')
      .select('member_id, membership')
      .eq('stripe_customer_id', stripeCustomerId)
      .single();
    if (!memberErr && member) {
      const date = new Date(invoice.status_transitions.paid_at * 1000).toISOString();
      if (member.membership === 'Host') {
        // Charge renewal fee
        await supabase.from('ledger').insert([{
          member_id: member.member_id,
          type: 'purchase',
          amount: 1,
          note: 'Host membership renewal',
          date
        }]);
        // Reset host credit
        await supabase.from('ledger').insert([{
          member_id: member.member_id,
          type: 'payment',
          amount: 100,
          note: 'Host membership credit reset',
          date
        }]);
      } else {
        // Standard renewal credit
        await supabase.from('ledger').insert([{
          member_id: member.member_id,
          type: 'payment',
          amount: amountPaid / 100,
          note: 'Subscription renewal',
          date
        }]);
      }
    }
  }

  res.json({ received: true });
}