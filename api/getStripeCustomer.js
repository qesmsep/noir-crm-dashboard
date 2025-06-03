import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Extract member_id from the request body
  const { member_id } = req.body;

  if (!member_id) {
    return res.status(400).json({ error: 'member_id is required' });
  }

  // Initialize Supabase client
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  // 1) Fetch this member’s account_id
  const { data: thisMember, error: memErr } = await supabase
    .from('members')
    .select('account_id')
    .eq('member_id', member_id)
    .single();

  if (memErr || !thisMember) {
    return res.status(404).json({ error: 'Member not found' });
  }

  // 2) Find primary member for that account
  const { data: primary, error: primaryErr } = await supabase
    .from('members')
    .select('stripe_customer_id')
    .eq('account_id', thisMember.account_id)
    .eq('member_type', 'Primary')
    .single();

  if (primaryErr || !primary || !primary.stripe_customer_id) {
    return res.status(400).json({ error: 'Primary Stripe customer not found for account' });
  }

  const stripe_customer_id = primary.stripe_customer_id;

  try {
    // Get subscriptions for the customer
    const subscriptions = await stripe.subscriptions.list({
      customer: stripe_customer_id,
      status: 'all',
      limit: 1,
    });

    const subscription = subscriptions.data[0];

    // Get last payment if available
    let last_payment = null;
    if (subscription && subscription.latest_invoice) {
      const invoice = await stripe.invoices.retrieve(subscription.latest_invoice);
      last_payment = invoice.status === 'paid' ? invoice.paid_at : null;
    }

    res.status(200).json({
      status: subscription ? subscription.status : 'none',
      next_renewal: subscription ? subscription.current_period_end : null,
      last_payment,
      subscription_id: subscription ? subscription.id : null,
      plan: subscription && subscription.items.data[0]
        ? subscription.items.data[0].plan.nickname
        : null,
    });
  } catch (error) {
    console.error('Stripe error:', error);
    res.status(500).json({ error: error.message });
  }
}