import Stripe from 'stripe';
import { supabaseAdmin } from '../../lib/supabase';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const MAX_PARTY_SIZE = 50;

// Older clients sent only the display name.
const LEGACY_LOCATION_NAMES = {
  RooftopKC: 'rooftopkc',
  'Noir KC': 'noirkc',
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Any `amount` in the body is ignored: the charge is the location's
    // configured cover price times the party size, computed here.
    const { partySize, firstName, lastName, email, reservationDate, location, location_slug } = req.body;

    const size = Number.parseInt(partySize, 10);
    if (!Number.isInteger(size) || size < 1 || size > MAX_PARTY_SIZE) {
      return res.status(400).json({ error: 'Invalid party size' });
    }

    const slug = location_slug || LEGACY_LOCATION_NAMES[location];
    if (!slug || typeof slug !== 'string') {
      return res.status(400).json({ error: 'location_slug is required' });
    }

    const { data: loc, error: locError } = await supabaseAdmin
      .from('locations')
      .select('slug, name, cover_enabled, cover_price')
      .eq('slug', slug)
      .maybeSingle();

    if (locError) {
      console.error('Error loading location for cover charge:', locError);
      return res.status(500).json({ error: 'Failed to load location' });
    }
    if (!loc) {
      return res.status(400).json({ error: 'Unknown location' });
    }

    const coverPrice = Number(loc.cover_price);
    if (!loc.cover_enabled || !Number.isFinite(coverPrice) || coverPrice <= 0) {
      return res.status(400).json({ error: 'No cover charge applies at this location' });
    }

    const amountCents = Math.round(coverPrice * 100) * size;
    const locationName = loc.name || location || slug;

    // Create a PaymentIntent for the cover charge
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: 'usd',
      capture_method: 'manual', // Hold funds only, capture after reservation confirmed
      metadata: {
        type: 'cover_charge',
        party_size: size.toString(),
        location: locationName,
        location_slug: slug,
        cover_price: coverPrice.toString(),
        reservation_date: reservationDate || 'unknown',
        customer_name: `${firstName || ''} ${lastName || ''}`.trim(),
      },
      description: `${locationName} Reservation - ${reservationDate || 'TBD'} - ${size} ${size === 1 ? 'guest' : 'guests'}`,
      receipt_email: email || undefined,
    });

    res.status(200).json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: amountCents / 100,
    });
  } catch (error) {
    console.error('Error creating cover charge payment:', error);
    res.status(500).json({ error: 'Failed to create cover charge payment' });
  }
}
