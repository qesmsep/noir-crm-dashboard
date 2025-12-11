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

  const { content, member_ids } = req.body;

  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'Message content is required' });
  }

  if (!process.env.OPENPHONE_API_KEY) {
    return res.status(500).json({ error: 'OpenPhone API key not configured' });
  }

  if (!process.env.OPENPHONE_PHONE_NUMBER_ID) {
    return res.status(500).json({ error: 'OpenPhone phone number ID not configured' });
  }

  try {
    // Get selected members or all active members if no selection
    let query = supabase
      .from('members')
      .select('member_id, account_id, phone, first_name, last_name')
      .eq('deactivated', false)
      .not('phone', 'is', null);
    
    if (member_ids && Array.isArray(member_ids) && member_ids.length > 0) {
      query = query.in('member_id', member_ids);
    }
    
    const { data: members, error: membersError } = await query;

    if (membersError) {
      throw membersError;
    }

    if (!members || members.length === 0) {
      return res.status(404).json({ error: 'No active members with phone numbers found' });
    }

    const results = [];
    const timestamp = new Date().toISOString();
    let successCount = 0;
    let failCount = 0;

    // Send messages to each member
    for (const member of members) {
      if (!member.phone) {
        results.push({
          member_id: member.member_id,
          member_name: `${member.first_name} ${member.last_name}`,
          status: 'failed',
          error: 'No phone number available'
        });
        failCount++;
        continue;
      }

      try {
        // Format phone number (ensure it starts with +)
        let formattedPhone = member.phone.trim();
        if (!formattedPhone.startsWith('+')) {
          const digits = formattedPhone.replace(/\D/g, '');
          if (digits.length === 10) {
            formattedPhone = '+1' + digits;
          } else if (digits.length === 11 && digits.startsWith('1')) {
            formattedPhone = '+' + digits;
          } else {
            formattedPhone = '+' + digits;
          }
        }

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

        const responseText = await response.text();
        let data;
        try {
          data = JSON.parse(responseText);
        } catch (e) {
          throw new Error('Invalid response from OpenPhone API');
        }

        if (!response.ok) {
          throw new Error(data.message || `Failed to send message: ${response.status}`);
        }

        // Store message in database
        const { error: insertError } = await supabase
          .from('messages')
          .insert({
            member_id: member.member_id,
            account_id: member.account_id,
            content: content,
            direction: 'outbound',
            status: 'sent',
            phone_number: formattedPhone,
            created_at: timestamp
          });

        if (insertError) {
          console.error('Error storing message:', insertError);
        }

        results.push({
          member_id: member.member_id,
          member_name: `${member.first_name} ${member.last_name}`,
          phone: formattedPhone,
          status: 'sent',
          message_id: data.id || null
        });
        successCount++;
      } catch (error) {
        console.error(`Error sending message to ${member.first_name} ${member.last_name}:`, error);

        // Store failed message in database
        const { error: insertError } = await supabase
          .from('messages')
          .insert({
            member_id: member.member_id,
            account_id: member.account_id,
            content: content,
            direction: 'outbound',
            status: 'failed',
            phone_number: member.phone,
            error_message: error.message,
            created_at: timestamp
          });

        if (insertError) {
          console.error('Error storing failed message:', insertError);
        }

        results.push({
          member_id: member.member_id,
          member_name: `${member.first_name} ${member.last_name}`,
          phone: member.phone,
          status: 'failed',
          error: error.message
        });
        failCount++;
      }
    }

    return res.status(200).json({
      success: true,
      total: members.length,
      sent: successCount,
      failed: failCount,
      results: results
    });
  } catch (error) {
    console.error('Error in send-bulk-message:', error);
    return res.status(500).json({ error: error.message || 'Failed to send bulk messages' });
  }
}
