import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-08-16',
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { account_id, payment_method_id } = req.body;

  if (!account_id || !payment_method_id) {
    return res.status(400).json({ error: 'Account ID and payment method ID are required' });
  }

  try {
    // Connect to Supabase
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

    // Get the first member's Stripe customer ID for this account
    const { data: member, error: memberError } = await supabase
      .from('members')
      .select('stripe_customer_id')
      .eq('account_id', account_id)
      .not('stripe_customer_id', 'is', null)
      .limit(1)
      .single();

    if (memberError || !member?.stripe_customer_id) {
      return res.status(404).json({ error: 'No Stripe customer found for this account' });
    }

    // Set the payment method as default
    await stripe.customers.update(member.stripe_customer_id, {
      invoice_settings: {
        default_payment_method: payment_method_id,
      },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error setting default payment method:', error);
    res.status(500).json({ error: 'Failed to set default payment method' });
  }
} 