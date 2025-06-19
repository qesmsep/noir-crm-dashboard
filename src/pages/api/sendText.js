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

  try {
    // Get phone numbers for all members
    const { data: members, error: membersError } = await supabase
      .from('members')
      .select('member_id, phone_number, first_name, last_name')
      .in('member_id', member_ids)
      .eq('account_id', account_id);

    if (membersError) {
      throw membersError;
    }

    if (!members.length) {
      return res.status(404).json({ error: 'No members found' });
    }

    const results = [];
    const now = new Date().toISOString();

    // Send messages to each member
    for (const member of members) {
      if (!member.phone_number) {
        results.push({
          member_id: member.member_id,
          status: 'failed',
          error: 'No phone number available'
        });
        continue;
      }

      try {
        // Send message using OpenPhone API
        const response = await fetch('https://api.openphone.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.OPENPHONE_API_KEY}`
          },
          body: JSON.stringify({
            to: member.phone_number,
            text: content
          })
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || 'Failed to send message');
        }

        // Store message in database
        const { error: insertError } = await supabase
          .from('messages')
          .insert({
            member_id: member.member_id,
            account_id: account_id,
            content: content,
            direction: 'outbound',
            status: 'sent',
            phone_number: member.phone_number,
            created_at: now
          });

        if (insertError) {
          throw insertError;
        }

        results.push({
          member_id: member.member_id,
          status: 'sent',
          phone_number: member.phone_number
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
            direction: 'outbound',
            status: 'failed',
            phone_number: member.phone_number,
            error_message: error.message,
            created_at: now
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