import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  console.log('Webhook received:', {
    method: req.method,
    body: req.body,
    headers: req.headers
  });

  if (req.method !== 'POST') {
    console.log('Method not allowed:', req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify webhook signature if OpenPhone provides one
  // TODO: Add signature verification when OpenPhone provides this feature

  const { type, data } = req.body;
  console.log('Event data:', { type, data });

  // Only process incoming message events
  if (type !== 'message.received') {
    console.log('Event type not handled:', type);
    return res.status(200).json({ message: 'Event type not handled' });
  }

  // Extract message details from OpenPhone format with fallbacks
  const { from, text } = {
    from: data?.object?.from || '',
    text: data?.object?.text || data?.object?.body || ''
  };
  console.log('Full data.object:', JSON.stringify(data.object, null, 2));
  console.log('Processing message:', { from, text });

  // Forward to SMS reservation handler
  try {
    // Use the deployment URL from the request headers
    const baseUrl = `https://${req.headers.host}`;
    console.log('Calling SMS reservation handler at:', `${baseUrl}/api/smsReservation`);
    
    const response = await fetch(`${baseUrl}/api/smsReservation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        text
      })
    });

    const result = await response.json();
    console.log('SMS reservation handler response:', result);

    // If the reservation was successful, send a confirmation SMS
    if (response.ok) {
      console.log('Sending confirmation SMS to:', from);
      await fetch('https://api.openphone.com/v1/messages', {
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
      console.log('Sending error SMS to:', from);
      await fetch('https://api.openphone.com/v1/messages', {
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