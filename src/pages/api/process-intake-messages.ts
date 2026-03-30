import { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '../../lib/supabase';

const MAX_RETRIES = 3;

/**
 * Process pending SMS intake campaign messages.
 * Called by Vercel cron, manually, or directly from the webhook.
 * Sends messages whose scheduled_for time has passed.
 * Failed messages are retried up to MAX_RETRIES times with exponential backoff.
 */

// Exported so the webhook can call it directly without an HTTP round-trip
export async function processIntakeMessages(): Promise<{ processed: number; sent: number; failed: number }> {
  if (!process.env.OPENPHONE_API_KEY) {
    console.error('OPENPHONE_API_KEY is not configured');
    throw new Error('OPENPHONE_API_KEY is not configured');
  }

  try {
    const now = new Date().toISOString();

    // Get pending messages that are due (includes retries that have waited long enough)
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
            'Authorization': process.env.OPENPHONE_API_KEY,
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
          await handleSendFailure(msg, errorText.substring(0, 500));
          failed++;
        }
      } catch (sendError) {
        console.error(`Error sending intake message ${msg.id}:`, sendError);
        await handleSendFailure(msg, sendError instanceof Error ? sendError.message : 'Unknown error');
        failed++;
      }
    }

    // Mark enrollments as completed if all messages are sent/permanently failed
    const enrollmentIds = [...new Set(pendingMessages.map(m => m.enrollment_id))];
    if (enrollmentIds.length > 0) {
      // Single query: find enrollments that still have pending messages
      const { data: pendingRemaining } = await supabaseAdmin
        .from('sms_intake_scheduled_messages')
        .select('enrollment_id')
        .in('enrollment_id', enrollmentIds)
        .eq('status', 'pending');

      const stillPending = new Set((pendingRemaining || []).map(r => r.enrollment_id));

      // Mark enrollments with no remaining pending messages as completed
      const completedIds = enrollmentIds.filter(id => !stillPending.has(id));
      if (completedIds.length > 0) {
        await supabaseAdmin
          .from('sms_intake_enrollments')
          .update({ status: 'completed' })
          .in('id', completedIds);
      }
    }

    return { processed: sent + failed, sent, failed };
  } catch (error) {
    console.error('Error processing intake messages:', error);
    throw error;
  }
}

// Retry with exponential backoff or mark as permanently failed
async function handleSendFailure(msg: { id: string; retry_count: number }, errorMessage: string) {
  const newRetryCount = (msg.retry_count || 0) + 1;

  if (newRetryCount < MAX_RETRIES) {
    // Exponential backoff: 2min, 8min, 32min
    const backoffMinutes = Math.pow(2, newRetryCount * 2 - 1);
    const nextAttempt = new Date(Date.now() + backoffMinutes * 60_000).toISOString();

    await supabaseAdmin
      .from('sms_intake_scheduled_messages')
      .update({
        retry_count: newRetryCount,
        error_message: errorMessage,
        scheduled_for: nextAttempt, // Push back for retry
      })
      .eq('id', msg.id);
  } else {
    // Max retries exhausted — permanently mark as failed
    await supabaseAdmin
      .from('sms_intake_scheduled_messages')
      .update({
        status: 'failed',
        retry_count: newRetryCount,
        error_message: errorMessage,
      })
      .eq('id', msg.id);
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    res.setHeader('Allow', ['POST', 'GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  // Verify: CRON_SECRET (primary) or Vercel cron header (matches existing cron pattern)
  const isAuthorized = req.headers.authorization === `Bearer ${process.env.CRON_SECRET}` ||
    req.headers['x-vercel-cron'] === '1';

  if (!isAuthorized) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const result = await processIntakeMessages();
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to process intake messages' });
  }
}
