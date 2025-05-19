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
      .select('id')
      .eq('email', email)
      .single();

    if (error || !member) {
      return res.status(404).json({ error: "Member not found" });
    }

    // Update the member's stripe_customer_id and status
    await supabase
      .from('members')
      .update({ stripe_customer_id: stripeCustomerId, status: 'active' })
      .eq('id', member.id);
  }

  res.json({ received: true });
}