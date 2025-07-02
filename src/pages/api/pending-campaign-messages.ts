import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../lib/supabase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      // Get pending campaign messages with related data
      const { data: pendingMessages, error: fetchError } = await supabase
        .from('scheduled_messages')
        .select(`
          *,
          members (
            first_name,
            last_name,
            phone
          ),
          campaign_templates (
            id,
            name,
            default_delay_days,
            default_send_time
          ),
          member_campaigns (
            id,
            campaign_status,
            activation_date
          )
        `)
        .eq('status', 'pending')
        .order('scheduled_for', { ascending: true });

      if (fetchError) {
        console.error('Error fetching pending campaign messages:', fetchError);
        return res.status(500).json({ error: 'Failed to fetch pending messages' });
      }

      res.status(200).json({ pendingMessages: pendingMessages || [] });
    } catch (error) {
      console.error('Error in pending campaign messages API:', error);
      res.status(500).json({ error: 'Failed to fetch pending messages' });
    }
  } else if (req.method === 'POST') {
    try {
      const { message_id } = req.body;

      if (!message_id) {
        return res.status(400).json({ error: 'Message ID is required' });
      }

      // Get the specific message
      const { data: message, error: fetchError } = await supabase
        .from('scheduled_messages')
        .select(`
          *,
          members (
            first_name,
            last_name,
            phone
          )
        `)
        .eq('id', message_id)
        .eq('status', 'pending')
        .single();

      if (fetchError || !message) {
        return res.status(404).json({ error: 'Message not found or already processed' });
      }

      // Format phone number
      let formattedPhone = message.members.phone;
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

      // Send SMS using OpenPhone API
      const smsResponse = await fetch('https://api.openphone.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': process.env.OPENPHONE_API_KEY!,
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          to: [formattedPhone],
          from: process.env.OPENPHONE_PHONE_NUMBER_ID!,
          content: message.message_content
        })
      });

      if (!smsResponse.ok) {
        throw new Error(`SMS API returned ${smsResponse.status}`);
      }

      const smsResult = await smsResponse.json();

      // Update message status
      const { error: updateError } = await supabase
        .from('scheduled_messages')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          openphone_message_id: smsResult.id || null
        })
        .eq('id', message_id);

      if (updateError) {
        console.error('Error updating message status:', updateError);
        return res.status(500).json({ error: 'Failed to update message status' });
      }

      res.status(200).json({ 
        message: 'Message sent successfully',
        openphone_message_id: smsResult.id 
      });

    } catch (error) {
      console.error('Error sending individual campaign message:', error);
      res.status(500).json({ error: 'Failed to send message' });
    }
  } else {
    res.setHeader('Allow', ['GET', 'POST']);
    res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }
} 