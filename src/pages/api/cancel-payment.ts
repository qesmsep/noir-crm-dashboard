import { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { paymentIntentId, reason } = req.body;

    if (!paymentIntentId) {
      return res.status(400).json({ error: 'Payment intent ID is required' });
    }

    console.log(`[PAYMENT CANCEL] Attempting to cancel payment: ${paymentIntentId}`);
    console.log(`[PAYMENT CANCEL] Reason: ${reason || 'No reason provided'}`);

    // Retrieve the payment intent first to check its status
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    // Check if already canceled
    if (paymentIntent.status === 'canceled') {
      console.log(`[PAYMENT CANCEL] Payment already canceled: ${paymentIntentId}`);
      return res.status(200).json({
        success: true,
        paymentIntent,
        alreadyCanceled: true,
      });
    }

    // Check if payment was already captured (succeeded)
    if (paymentIntent.status === 'succeeded') {
      console.error(`[PAYMENT CANCEL] Cannot cancel - payment already captured: ${paymentIntentId}`);
      console.log(`[PAYMENT CANCEL] Consider refunding instead`);

      return res.status(400).json({
        error: 'Payment has already been captured and cannot be canceled. Consider issuing a refund instead.',
        status: paymentIntent.status,
        paymentIntentId,
      });
    }

    // Check if payment intent can be canceled
    const cancelableStatuses = [
      'requires_payment_method',
      'requires_confirmation',
      'requires_action',
      'processing',
      'requires_capture',
    ];

    if (!cancelableStatuses.includes(paymentIntent.status)) {
      console.error(`[PAYMENT CANCEL] Payment intent not cancelable. Status: ${paymentIntent.status}`);
      return res.status(400).json({
        error: `Payment cannot be canceled. Current status: ${paymentIntent.status}`,
        status: paymentIntent.status,
      });
    }

    // Update metadata to track cancellation before canceling - PaymentIntents can only be
    // updated while still in a cancelable state, not after they've been canceled.
    await stripe.paymentIntents.update(paymentIntentId, {
      metadata: {
        ...paymentIntent.metadata,
        canceled_at: new Date().toISOString(),
        cancellation_reason: reason || 'reservation_failed',
      },
    });

    // Map our internal reason to a Stripe-native cancellation_reason value
    const stripeCancellationReason = reason === 'reservation_failed' ? 'abandoned' : 'requested_by_customer';

    // Cancel the payment intent
    const canceledPayment = await stripe.paymentIntents.cancel(paymentIntentId, {
      cancellation_reason: stripeCancellationReason,
    });

    console.log(`[PAYMENT CANCEL] Successfully canceled payment: ${paymentIntentId}`);

    return res.status(200).json({
      success: true,
      paymentIntent: canceledPayment,
    });
  } catch (error: any) {
    console.error('[PAYMENT CANCEL] Error canceling payment:', error);

    // Handle specific Stripe errors
    if (error.type === 'StripeInvalidRequestError') {
      return res.status(400).json({
        error: 'Invalid payment cancellation request',
        details: error.message,
      });
    }

    return res.status(500).json({
      error: 'Failed to cancel payment',
      details: error.message,
    });
  }
}
