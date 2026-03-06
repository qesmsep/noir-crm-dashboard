import type { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-08-27.basil',
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/stripe/payment-methods/create-from-fc
 *
 * Creates a PaymentMethod from a Financial Connections account
 *
 * Body:
 *   - account_id: UUID (our internal account ID)
 *   - financial_connections_account_id: string (Stripe Financial Connections account ID)
 *
 * Returns:
 *   - payment_method_id: string
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { account_id, financial_connections_account_id } = req.body;

  if (!account_id || !financial_connections_account_id) {
    return res.status(400).json({ error: 'account_id and financial_connections_account_id are required' });
  }

  try {
    // Fetch account to get customer info
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('stripe_customer_id')
      .eq('account_id', account_id)
      .single();

    if (accountError || !account || !account.stripe_customer_id) {
      return res.status(404).json({ error: 'Account or Stripe customer not found' });
    }

    // Get customer name for billing details
    const customer = await stripe.customers.retrieve(account.stripe_customer_id);
    const customerName = ('name' in customer && customer.name) ? customer.name : 'Account Holder';

    console.log('[Create PM from FC] Creating PaymentMethod from Financial Connections account:', financial_connections_account_id);

    // Create PaymentMethod from Financial Connections account
    const paymentMethod = await stripe.paymentMethods.create({
      type: 'us_bank_account',
      us_bank_account: {
        financial_connections_account: financial_connections_account_id,
      },
      billing_details: {
        name: customerName,
      },
    });

    console.log('[Create PM from FC] PaymentMethod created:', paymentMethod.id);

    // Attach to customer (should already be attached, but make sure)
    if (paymentMethod.customer !== account.stripe_customer_id) {
      await stripe.paymentMethods.attach(paymentMethod.id, {
        customer: account.stripe_customer_id,
      });
      console.log('[Create PM from FC] Attached to customer');
    }

    return res.json({
      payment_method_id: paymentMethod.id,
      bank_name: paymentMethod.us_bank_account?.bank_name,
      last4: paymentMethod.us_bank_account?.last4,
    });
  } catch (error: any) {
    console.error('Error creating PaymentMethod from Financial Connections:', error);
    return res.status(500).json({ error: error.message });
  }
}
