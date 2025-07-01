import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { phone, content, reservation_id, sent_by } = req.body;

  if (!phone || !content) {
    return res.status(400).json({ error: 'Phone number and message content are required' });
  }

  // Debug logging for API key
  console.log('OpenPhone API Key exists:', !!process.env.OPENPHONE_API_KEY);
  console.log('OpenPhone API Key length:', process.env.OPENPHONE_API_KEY?.length);
  console.log('OpenPhone Phone Number ID exists:', !!process.env.OPENPHONE_PHONE_NUMBER_ID);
  console.log('OpenPhone Phone Number ID:', process.env.OPENPHONE_PHONE_NUMBER_ID);

  if (!process.env.OPENPHONE_API_KEY) {
    return res.status(500).json({ error: 'OpenPhone API key not configured' });
  }

  if (!process.env.OPENPHONE_PHONE_NUMBER_ID) {
    return res.status(500).json({ error: 'OpenPhone phone number ID not configured' });
  }

  try {
    // Format phone number to ensure it starts with +
    let formattedPhone = phone;
    if (!formattedPhone.startsWith('+')) {
      // Remove all non-digits
      const digits = formattedPhone.replace(/\D/g, '');
      // If it's 10 digits, add +1, if it's 11 digits and starts with 1, add +
      if (digits.length === 10) {
        formattedPhone = '+1' + digits;
      } else if (digits.length === 11 && digits.startsWith('1')) {
        formattedPhone = '+' + digits;
      } else {
        formattedPhone = '+' + digits;
      }
    }

    console.log('Sending message to:', formattedPhone);
    console.log('Sending from phone ID:', process.env.OPENPHONE_PHONE_NUMBER_ID);
    
    // Send message using OpenPhone API
    const response = await fetch('https://api.openphone.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': process.env.OPENPHONE_API_KEY,
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        to: [formattedPhone],
        from: process.env.OPENPHONE_PHONE_NUMBER_ID,
        content: content
      })
    });

    // Debug logging for response
    console.log('OpenPhone API Response Status:', response.status);
    const responseText = await response.text();
    console.log('OpenPhone API Response:', responseText);

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error('Failed to parse response as JSON:', e);
      throw new Error('Invalid response from OpenPhone API');
    }

    if (!response.ok) {
      throw new Error(data.message || `Failed to send message: ${response.status} ${response.statusText}`);
    }

    // Store message in database for tracking (optional)
    const timestamp = new Date().toISOString();
    try {
      const { error: insertError } = await supabase
        .from('guest_messages')
        .insert({
          phone: formattedPhone,
          content: content,
          reservation_id: reservation_id || null,
          sent_by: sent_by || null,
          timestamp: timestamp,
          status: 'sent',
          openphone_message_id: data.id || null
        });

      if (insertError) {
        console.error('Error storing guest message:', insertError);
        // Don't throw here, we still want to return success since message was sent
      }
    } catch (dbError) {
      console.error('Database error (table may not exist):', dbError);
      // Continue without database storage
    }

    return res.status(200).json({ 
      success: true, 
      message: 'Message sent successfully',
      openphone_message_id: data.id 
    });

  } catch (error) {
    console.error('Error sending guest message:', error);

    // Store failed message in database for tracking
    const timestamp = new Date().toISOString();
    try {
      const { error: insertError } = await supabase
        .from('guest_messages')
        .insert({
          phone: phone,
          content: content,
          reservation_id: reservation_id || null,
          sent_by: sent_by || null,
          timestamp: timestamp,
          status: 'failed',
          error_message: JSON.stringify({ message: error.message })
        });

      if (insertError) {
        console.error('Error storing failed guest message:', insertError);
      }
    } catch (dbError) {
      console.error('Database error (table may not exist):', dbError);
      // Continue without database storage
    }

    return res.status(500).json({ 
      error: 'Failed to send message',
      details: error.message 
    });
  }
} 