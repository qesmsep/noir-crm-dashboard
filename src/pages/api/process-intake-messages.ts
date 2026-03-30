import { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '../../lib/supabase';

/**
 * Process pending SMS intake campaign messages.
 * Called by Vercel cron, manually, or directly from the webhook.
 * Sends messages whose scheduled_for time has passed.
 */

// Exported so the webhook can call it directly without an HTTP round-trip
export async function processIntakeMessages(): Promise<{ processed: number; sent: number; failed: number }> {
  try {
    const now = new Date().toISOString();

    // Get pending messages that are due
    const { data: pendingMessages, error } = await supabaseAdmin
      .from('sms_intake_scheduled_messages')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_for', now)
      .order('scheduled_for', { ascending: true })
      .limit(50);

    if (error) throw error;

    if (!pendingMessages || pendingMessages.length === 0) {
      return { processed: 0, sent: 0, failed: 0 };
    }

    let sent = 0;
    let failed = 0;

    for (const msg of pendingMessages) {
      try {
        // Send via OpenPhone API
        const response = await fetch('https://api.openphone.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': process.env.OPENPHONE_API_KEY || '',
            'Accept': 'application/json',
          },
          body: JSON.stringify({
            to: [msg.phone],
            from: process.env.OPENPHONE_PHONE_NUMBER_ID,
            content: msg.message_content,
          }),
        });

        if (response.ok) {
          await supabaseAdmin
            .from('sms_intake_scheduled_messages')
            .update({ status: 'sent', sent_at: new Date().toISOString() })
            .eq('id', msg.id);
          sent++;
        } else {
          const errorText = await response.text();
          console.error(`Failed to send intake message ${msg.id}:`, errorText);
          await supabaseAdmin
            .from('sms_intake_scheduled_messages')
            .update({ status: 'failed', error_message: errorText.substring(0, 500) })
            .eq('id', msg.id);
          failed++;
        }
      } catch (sendError) {
        console.error(`Error sending intake message ${msg.id}:`, sendError);
        await supabaseAdmin
          .from('sms_intake_scheduled_messages')
          .update({
            status: 'failed',
            error_message: sendError instanceof Error ? sendError.message : 'Unknown error',
          })
          .eq('id', msg.id);
        failed++;
      }
    }

    // Mark enrollments as completed if all messages sent
    const enrollmentIds = [...new Set(pendingMessages.map(m => m.enrollment_id))];
    for (const enrollmentId of enrollmentIds) {
      const { data: remaining } = await supabaseAdmin
        .from('sms_intake_scheduled_messages')
        .select('id')
        .eq('enrollment_id', enrollmentId)
        .eq('status', 'pending')
        .limit(1);

      if (!remaining || remaining.length === 0) {
        await supabaseAdmin
          .from('sms_intake_enrollments')
          .update({ status: 'completed' })
          .eq('id', enrollmentId);
      }
    }

    return { processed: sent + failed, sent, failed };
  } catch (error) {
    console.error('Error processing intake messages:', error);
    throw error;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    res.setHeader('Allow', ['POST', 'GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  // Verify cron or auth token
  const isVercelCron = req.headers['x-vercel-cron'] === '1' ||
    req.headers.authorization === `Bearer ${process.env.CRON_SECRET}`;

  if (!isVercelCron) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const result = await processIntakeMessages();
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to process intake messages' });
  }
}
