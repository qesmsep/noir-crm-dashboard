import type { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { account_id, payment_method_id } = req.body;

  if (!account_id || !payment_method_id) {
    return res.status(400).json({ error: 'account_id and payment_method_id are required' });
  }

  try {
    // Get Stripe customer ID from account to verify ownership
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('stripe_customer_id')
      .eq('account_id', account_id)
      .single();

    if (accountError || !account?.stripe_customer_id) {
      return res.status(400).json({ error: 'No Stripe customer found for this account' });
    }

    // Verify the payment method belongs to this customer
    const paymentMethod = await stripe.paymentMethods.retrieve(payment_method_id);
    if (paymentMethod.customer !== account.stripe_customer_id) {
      return res.status(403).json({ error: 'Payment method does not belong to this account' });
    }

    // Detach payment method from customer
    await stripe.paymentMethods.detach(payment_method_id);

    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('Error removing payment method:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
