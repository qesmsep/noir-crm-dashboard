const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { paymentMethodId, amount } = req.body;

    // Create a payment intent with capture_method: 'manual' to create a hold
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount * 100, // Convert to cents
      currency: 'usd',
      payment_method: paymentMethodId,
      capture_method: 'manual',
      confirm: true,
      description: 'Reservation hold',
    });

    res.status(200).json({ 
      holdId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret 
    });
  } catch (error) {
    console.error('Error creating hold:', error);
    res.status(500).json({ error: error.message });
  }
} 