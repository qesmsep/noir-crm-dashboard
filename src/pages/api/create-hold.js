import Stripe from 'stripe';
import { getHoldFeeConfig, getHoldAmount } from '../../utils/holdFeeUtils';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { amount, payment_method_id, reservation_id, party_size } = req.body;

    if (!payment_method_id) {
      return res.status(400).json({ error: 'payment_method_id is required' });
    }

    // Get hold fee configuration
    const holdFeeConfig = await getHoldFeeConfig();
    
    // If hold fee is disabled, return success without creating hold
    if (!holdFeeConfig.enabled) {
      return res.status(200).json({ 
        clientSecret: null,
        paymentIntentId: null,
        status: 'no_hold_required',
        message: 'Hold fee is disabled'
      });
    }

    // Use configured amount or provided amount
    const holdAmount = amount || holdFeeConfig.amount;

    // Create a PaymentIntent for the hold
    const paymentIntent = await stripe.paymentIntents.create({
      amount: holdAmount * 100, // Convert to cents
      currency: 'usd',
      capture_method: 'manual', // This creates a hold, not a charge
      payment_method: payment_method_id,
      confirm: true, // Confirm the payment method immediately
      metadata: {
        reservation_id: reservation_id || 'pending',
        hold_type: 'reservation_hold',
        hold_amount: holdAmount.toString(),
        party_size: party_size?.toString() || 'unknown'
      },
      description: `Reservation hold - $${holdAmount}`,
      return_url: process.env.NEXT_PUBLIC_BASE_URL
        ? `${process.env.NEXT_PUBLIC_BASE_URL}/reservation/confirmation`
        : 'https://noir-crm-dashboard.vercel.app/reservation/confirmation',
    });

    res.status(200).json({ 
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      status: paymentIntent.status
    });
  } catch (error) {
    console.error('Error creating hold:', error);
    res.status(500).json({ error: error.message });
  }
} 