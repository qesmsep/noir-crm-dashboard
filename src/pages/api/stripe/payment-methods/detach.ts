import type { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-08-27.basil',
});

/**
 * DELETE /api/stripe/payment-methods/detach
 *
 * Removes a payment method from a customer
 *
 * Body:
 *   - payment_method_id: string (Stripe PaymentMethod ID)
 *
 * Returns:
 *   - success: boolean
 *   - message: string
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { payment_method_id } = req.body;

  if (!payment_method_id) {
    return res.status(400).json({ error: 'payment_method_id is required' });
  }

  try {
    // Detach payment method
    await stripe.paymentMethods.detach(payment_method_id);

    return res.json({
      success: true,
      message: 'Payment method removed successfully',
    });
  } catch (error: any) {
    console.error('Error detaching payment method:', error);
    return res.status(500).json({ error: error.message });
  }
}
