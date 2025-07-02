import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../lib/supabase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    // Get pending messages that are due to be sent
    const now = new Date().toISOString();
    const { data: pendingMessages, error: fetchError } = await supabase
      .from('scheduled_messages')
      .select(`
        *,
        member_campaigns!inner(*),
        campaign_templates!inner(*)
      `)
      .eq('message_status', 'pending')
      .lte('scheduled_time', now)
      .order('scheduled_time', { ascending: true });

    if (fetchError) {
      console.error('Error fetching pending messages:', fetchError);
      return res.status(500).json({ error: 'Failed to fetch pending messages' });
    }

    if (!pendingMessages || pendingMessages.length === 0) {
      return res.status(200).json({ message: 'No pending messages to process' });
    }

    const results = {
      processed: 0,
      sent: 0,
      failed: 0,
      errors: [] as string[]
    };

    // Process each pending message
    for (const message of pendingMessages) {
      try {
        // Send SMS via OpenPhone
        const smsResponse = await fetch('/api/sendText', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            to: message.phone_number,
            message: message.message_content
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
            message_status: 'sent',
            sent_at: new Date().toISOString(),
            openphone_message_id: smsResult.message_id || null
          })
          .eq('id', message.id);

        if (updateError) {
          console.error('Error updating message status:', updateError);
          results.errors.push(`Failed to update message ${message.id}: ${updateError.message}`);
        } else {
          results.sent++;
        }

        // Update campaign sent count
        if (message.campaign_id) {
          const { error: campaignUpdateError } = await supabase
            .from('member_campaigns')
            .update({
              sent_messages: message.member_campaigns.sent_messages + 1
            })
            .eq('id', message.campaign_id);

          if (campaignUpdateError) {
            console.error('Error updating campaign sent count:', campaignUpdateError);
          }
        }

        results.processed++;

      } catch (error) {
        console.error('Error processing message:', error);
        
        // Update message status to failed
        const { error: updateError } = await supabase
          .from('scheduled_messages')
          .update({
            message_status: 'failed',
            error_message: error instanceof Error ? error.message : 'Unknown error'
          })
          .eq('id', message.id);

        if (updateError) {
          console.error('Error updating failed message status:', updateError);
        }

        results.failed++;
        results.errors.push(`Message ${message.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    res.status(200).json({
      message: 'Message processing completed',
      ...results
    });

  } catch (error) {
    console.error('Error processing scheduled messages:', error);
    res.status(500).json({ error: 'Failed to process messages' });
  }
} 