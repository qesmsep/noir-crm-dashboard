import { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';
import { supabase, supabaseAdmin } from '../../lib/supabase';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { paymentIntentId, reservationId } = req.body;

    if (!paymentIntentId) {
      return res.status(400).json({ error: 'Payment intent ID is required' });
    }

    console.log(`[PAYMENT CAPTURE] Attempting to capture payment: ${paymentIntentId}`);
    console.log(`[PAYMENT CAPTURE] For reservation: ${reservationId || 'unknown'}`);

    // Retrieve the payment intent first to check its status
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    // Check if already captured
    if (paymentIntent.status === 'succeeded') {
      console.log(`[PAYMENT CAPTURE] Payment already captured: ${paymentIntentId}`);
      return res.status(200).json({
        success: true,
        paymentIntent,
        alreadyCaptured: true,
      });
    }

    // Check if payment intent is in a capturable state
    if (paymentIntent.status !== 'requires_capture') {
      console.error(`[PAYMENT CAPTURE] Payment intent not capturable. Status: ${paymentIntent.status}`);
      return res.status(400).json({
        error: `Payment cannot be captured. Current status: ${paymentIntent.status}`,
        status: paymentIntent.status,
      });
    }

    // If a reservationId was provided, verify it actually belongs to this payment intent
    // before capturing funds, to guard against stale/mismatched IDs from client retries.
    if (reservationId) {
      const client = supabaseAdmin || supabase;
      const { data: reservation, error: reservationError } = await client
        .from('reservations')
        .select('id, payment_intent_id')
        .eq('id', reservationId)
        .maybeSingle();

      if (reservationError) {
        console.error('[PAYMENT CAPTURE] Error verifying reservation ownership:', reservationError);
        return res.status(500).json({ error: 'Failed to verify reservation for capture' });
      }

      if (!reservation || reservation.payment_intent_id !== paymentIntentId) {
        console.error(`[PAYMENT CAPTURE] Reservation ${reservationId} does not match payment intent ${paymentIntentId}`);
        return res.status(400).json({ error: 'Reservation does not match the provided payment intent' });
      }
    }

    // Capture the payment
    const capturedPayment = await stripe.paymentIntents.capture(paymentIntentId, {
      metadata: {
        ...paymentIntent.metadata,
        captured_at: new Date().toISOString(),
        reservation_id: reservationId || paymentIntent.metadata.reservation_id || 'unknown',
      },
    });

    console.log(`[PAYMENT CAPTURE] Successfully captured payment: ${paymentIntentId}`);

    return res.status(200).json({
      success: true,
      paymentIntent: capturedPayment,
    });
  } catch (error: any) {
    console.error('[PAYMENT CAPTURE] Error capturing payment:', error);

    // Handle specific Stripe errors
    if (error.type === 'StripeCardError') {
      return res.status(400).json({
        error: 'Card declined during capture',
        details: error.message,
      });
    }

    if (error.type === 'StripeInvalidRequestError') {
      return res.status(400).json({
        error: 'Invalid payment capture request',
        details: error.message,
      });
    }

    return res.status(500).json({
      error: 'Failed to capture payment',
      details: error.message,
    });
  }
}
