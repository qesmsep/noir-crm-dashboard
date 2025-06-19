import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-08-16',
});

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { account_id } = req.query;

  if (!account_id) {
    return res.status(400).json({ error: 'Account ID is required' });
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

    // Get payment methods from Stripe
    const paymentMethods = await stripe.paymentMethods.list({
      customer: member.stripe_customer_id,
      type: 'card',
    });

    // Get customer's default payment method
    const customer = await stripe.customers.retrieve(member.stripe_customer_id);
    const defaultPaymentMethodId = customer.invoice_settings?.default_payment_method;

    // Format the response
    const formattedPaymentMethods = paymentMethods.data.map(pm => ({
      id: pm.id,
      brand: pm.card.brand,
      last4: pm.card.last4,
      exp_month: pm.card.exp_month,
      exp_year: pm.card.exp_year,
      isDefault: pm.id === defaultPaymentMethodId,
    }));

    res.json({ paymentMethods: formattedPaymentMethods });
  } catch (error) {
    console.error('Error listing payment methods:', error);
    res.status(500).json({ error: 'Failed to list payment methods' });
  }
} 