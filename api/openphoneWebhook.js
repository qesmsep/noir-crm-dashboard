import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify webhook signature if OpenPhone provides one
  // TODO: Add signature verification when OpenPhone provides this feature

  const { event, data } = req.body;

  // Only process incoming message events
  if (event !== 'message.received') {
    return res.status(200).json({ message: 'Event type not handled' });
  }

  const { from, text } = data;

  // Forward to SMS reservation handler
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/smsReservation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        body: text
      })
    });

    const result = await response.json();

    // If the reservation was successful, send a confirmation SMS
    if (response.ok) {
      await fetch('https://api.openphone.co/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': process.env.OPENPHONE_API_KEY,
        },
        body: JSON.stringify({
          from: process.env.OPENPHONE_PHONE_NUMBER_ID,
          to: from,
          text: `Your reservation has been confirmed! We've sent the details to your email.`
        })
      });
    } else {
      // Send error message back to the member
      await fetch('https://api.openphone.co/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': process.env.OPENPHONE_API_KEY,
        },
        body: JSON.stringify({
          from: process.env.OPENPHONE_PHONE_NUMBER_ID,
          to: from,
          text: result.message || 'Sorry, we could not process your reservation request. Please try again or contact us directly.'
        })
      });
    }

    return res.status(200).json({ message: 'Webhook processed' });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 