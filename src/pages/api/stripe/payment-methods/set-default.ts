import type { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-06-30.basil',
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * PUT /api/stripe/payment-methods/set-default
 *
 * Sets the default payment method for an account's subscription
 *
 * Body:
 *   - account_id: UUID
 *   - payment_method_id: string (Stripe PaymentMethod ID)
 *
 * Returns:
 *   - success: boolean
 *   - message: string
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { account_id, payment_method_id } = req.body;

  if (!account_id || !payment_method_id) {
    return res.status(400).json({ error: 'account_id and payment_method_id are required' });
  }

  try {
    // Fetch account
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('stripe_customer_id, stripe_subscription_id')
      .eq('account_id', account_id)
      .single();

    if (accountError || !account || !account.stripe_customer_id) {
      return res.status(404).json({ error: 'Account or Stripe customer not found' });
    }

    // Attach payment method to customer if not already attached
    const paymentMethod = await stripe.paymentMethods.retrieve(payment_method_id);

    if (paymentMethod.customer !== account.stripe_customer_id) {
      await stripe.paymentMethods.attach(payment_method_id, {
        customer: account.stripe_customer_id,
      });
    }

    // Update customer default payment method
    await stripe.customers.update(account.stripe_customer_id, {
      invoice_settings: {
        default_payment_method: payment_method_id,
      },
    });

    // Update subscription default payment method if exists
    if (account.stripe_subscription_id) {
      await stripe.subscriptions.update(account.stripe_subscription_id, {
        default_payment_method: payment_method_id,
      });
    }

    // Update account payment method info in database
    const updatedPaymentMethod = await stripe.paymentMethods.retrieve(payment_method_id);
    let paymentMethodInfo: any = {};

    if (updatedPaymentMethod.type === 'card' && updatedPaymentMethod.card) {
      paymentMethodInfo = {
        payment_method_type: 'card',
        payment_method_last4: updatedPaymentMethod.card.last4,
        payment_method_brand: updatedPaymentMethod.card.brand,
      };
    } else if (updatedPaymentMethod.type === 'us_bank_account' && updatedPaymentMethod.us_bank_account) {
      paymentMethodInfo = {
        payment_method_type: 'us_bank_account',
        payment_method_last4: updatedPaymentMethod.us_bank_account.last4,
        payment_method_brand: updatedPaymentMethod.us_bank_account.bank_name || 'Bank Account',
      };
    }

    await supabase
      .from('accounts')
      .update(paymentMethodInfo)
      .eq('account_id', account_id);

    return res.json({
      success: true,
      message: 'Default payment method updated successfully',
    });
  } catch (error: any) {
    console.error('Error setting default payment method:', error);
    return res.status(500).json({ error: error.message });
  }
}
