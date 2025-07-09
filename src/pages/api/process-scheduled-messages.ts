import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../lib/supabase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      const { days = 7 } = req.query;
      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - parseInt(days as string));

      // Get message statistics
      const { data: stats, error: statsError } = await supabase
        .from('scheduled_messages')
        .select('status')
        .gte('created_at', daysAgo.toISOString());

      if (statsError) {
        console.error('Error fetching message statistics:', statsError);
        return res.status(500).json({ error: 'Failed to fetch statistics' });
      }

      const total = stats?.length || 0;
      const pending = stats?.filter(s => s.status === 'pending').length || 0;
      const sent = stats?.filter(s => s.status === 'sent').length || 0;
      const failed = stats?.filter(s => s.status === 'failed').length || 0;
      const cancelled = stats?.filter(s => s.status === 'cancelled').length || 0;

      res.status(200).json({
        total,
        pending,
        sent,
        failed,
        cancelled,
        period_days: parseInt(days as string)
      });
    } catch (error) {
      console.error('Error in process scheduled messages GET:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else if (req.method === 'POST') {
    try {
      // Get pending messages that are due to be sent
      const now = new Date().toISOString();
      const { data: pendingMessages, error: fetchError } = await supabase
        .from('scheduled_messages')
        .select(`
          *,
          members (
            first_name,
            last_name,
            phone
          )
        `)
        .eq('status', 'pending')
        .lte('scheduled_for', now)
        .order('scheduled_for', { ascending: true });

      if (fetchError) {
        console.error('Error fetching pending messages:', fetchError);
        return res.status(500).json({ error: 'Failed to fetch pending messages' });
      }

      if (!pendingMessages || pendingMessages.length === 0) {
        return res.status(200).json({ 
          message: 'No pending messages to process',
          processed: 0,
          successful: 0,
          failed: 0
        });
      }

      const results = {
        processed: 0,
        successful: 0,
        failed: 0,
        errors: [] as string[]
      };

      // Process each pending message
      for (const message of pendingMessages) {
        try {
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
            .eq('id', message.id);

          if (updateError) {
            console.error('Error updating message status:', updateError);
            results.errors.push(`Failed to update message ${message.id}: ${updateError.message}`);
          } else {
            results.successful++;
          }

          results.processed++;

        } catch (error) {
          console.error('Error processing message:', error);

          // Update message status to failed
          const { error: updateError } = await supabase
            .from('scheduled_messages')
            .update({
              status: 'failed',
              error_message: error instanceof Error ? error.message : 'Unknown error'
            })
            .eq('id', message.id);

          if (updateError) {
            console.error('Error updating failed message status:', updateError);
          }

          results.failed++;
          results.errors.push(`Failed to send message ${message.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      res.status(200).json({
        message: `Processed ${results.processed} messages`,
        ...results
      });

    } catch (error) {
      console.error('Error in process scheduled messages POST:', error);
      res.status(500).json({ error: 'Failed to process messages' });
    }
  } else {
    res.setHeader('Allow', ['GET', 'POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
} 