const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { amount, payment_method_id, reservation_id } = req.body;

    if (!amount || !payment_method_id) {
      return res.status(400).json({ error: 'Amount and payment_method_id are required' });
    }

    // Create a PaymentIntent for the hold
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount * 100, // Convert to cents
      currency: 'usd',
      capture_method: 'manual', // This creates a hold, not a charge
      payment_method: payment_method_id,
      confirm: true, // Confirm the payment method immediately
      metadata: {
        reservation_id: reservation_id || 'pending',
        hold_type: 'reservation_hold',
        hold_amount: amount.toString()
      },
      description: `Reservation hold - $${amount}`
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