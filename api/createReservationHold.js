import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { payment_method_id, party_size, reservation_id } = req.body;

  if (!payment_method_id || !party_size || !reservation_id) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Calculate hold amount ($25 per guest)
    const holdAmount = party_size * 25 * 100; // Convert to cents

    // Create a payment intent with capture_method: 'manual' for authorization
    const paymentIntent = await stripe.paymentIntents.create({
      amount: holdAmount,
      currency: 'usd',
      payment_method: payment_method_id,
      capture_method: 'manual',
      confirm: true,
      metadata: {
        reservation_id,
        type: 'reservation_hold'
      }
    });

    // Update the reservation with the payment intent ID
    const { error: updateError } = await supabase
      .from('reservations')
      .update({
        payment_intent_id: paymentIntent.id,
        hold_amount: holdAmount / 100 // Store in dollars
      })
      .eq('id', reservation_id);

    if (updateError) {
      throw updateError;
    }

    return res.status(200).json({
      success: true,
      payment_intent_id: paymentIntent.id,
      amount: holdAmount / 100
    });
  } catch (error) {
    console.error('Error creating reservation hold:', error);
    return res.status(500).json({ error: error.message });
  }
} 