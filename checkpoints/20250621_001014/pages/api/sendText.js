import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { member_ids, content, account_id } = req.body;

  if (!member_ids || !content || !account_id) {
    return res.status(400).json({ error: 'Missing required fields' });
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
    // Get phone numbers for all members
    const { data: members, error: membersError } = await supabase
      .from('members')
      .select('member_id, phone, first_name, last_name')
      .in('member_id', member_ids)
      .eq('account_id', account_id);

    if (membersError) {
      throw membersError;
    }

    if (!members.length) {
      return res.status(404).json({ error: 'No members found' });
    }

    const results = [];
    const timestamp = new Date().toISOString();

    // Send messages to each member
    for (const member of members) {
      if (!member.phone) {
        results.push({
          member_id: member.member_id,
          status: 'failed',
          error: 'No phone number available'
        });
        continue;
      }

      try {
        // Debug logging for request
        console.log('Sending message to:', member.phone);
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
            to: [member.phone],
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

        // Store message in database with existing schema
        const { error: insertError } = await supabase
          .from('messages')
          .insert({
            member_id: member.member_id,
            account_id: account_id,
            content: content,
            timestamp: timestamp,
            status: 'sent',
            sent_by: req.headers['x-user-email'] || null  // Assuming we get the sender's email from headers
          });

        if (insertError) {
          console.error('Error storing successful message:', insertError);
          // Don't throw here, we still want to return success since message was sent
        }

        results.push({
          member_id: member.member_id,
          status: 'sent'
        });
      } catch (error) {
        console.error('Error sending message:', error);

        // Store failed message in database
        const { error: insertError } = await supabase
          .from('messages')
          .insert({
            member_id: member.member_id,
            account_id: account_id,
            content: content,
            timestamp: timestamp,
            status: 'failed',
            error_message: JSON.stringify({ message: error.message }),
            sent_by: req.headers['x-user-email'] || null
          });

        if (insertError) {
          console.error('Error storing failed message:', insertError);
        }

        results.push({
          member_id: member.member_id,
          status: 'failed',
          error: error.message
        });
      }
    }

    return res.status(200).json({ results });
  } catch (error) {
    console.error('Error in sendText:', error);
    return res.status(500).json({ error: 'Failed to send messages' });
  }
} 