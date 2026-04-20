import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { amount, partySize, firstName, lastName, email, reservationDate, location } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    // Create a PaymentIntent for the cover charge
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: 'usd',
      capture_method: 'automatic', // Charge immediately
      metadata: {
        type: 'cover_charge',
        party_size: partySize?.toString() || 'unknown',
        location: location || 'unknown',
        reservation_date: reservationDate || 'unknown',
        customer_name: `${firstName} ${lastName}`.trim(),
      },
      description: `${location || 'RooftopKC'} Reservation - ${reservationDate || 'TBD'} - ${partySize} ${partySize === 1 ? 'guest' : 'guests'}`,
      receipt_email: email || undefined,
    });

    res.status(200).json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });
  } catch (error) {
    console.error('Error creating cover charge payment:', error);
    res.status(500).json({ error: error.message });
  }
}
