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

    // Step 1: Atomically claim pending messages by setting status = 'processing'
    // This prevents duplicate sends when concurrent cron invocations overlap.
    // Only rows still in 'pending' status will be claimed — if another process
    // already claimed them, this returns an empty set.
    const { data: claimed, error: claimError } = await supabaseAdmin
      .from('sms_intake_scheduled_messages')
      .update({ status: 'processing' })
      .eq('status', 'pending')
      .lte('scheduled_for', now)
      .select('*')
      .order('scheduled_for', { ascending: true })
      .limit(50);

    if (claimError) throw claimError;

    if (!claimed || claimed.length === 0) {
      return { processed: 0, sent: 0, failed: 0 };
    }

    let sent = 0;
    let failed = 0;

    // Pre-fetch campaign cancel_on_signup flags for all claimed messages
    // to avoid repeated DB lookups inside the loop
    const enrollmentIds = [...new Set(claimed.map(m => m.enrollment_id))];
    const { data: enrollments } = await supabaseAdmin
      .from('sms_intake_enrollments')
      .select('id, campaign_id, phone')
      .in('id', enrollmentIds);

    const campaignIds = [...new Set((enrollments || []).map(e => e.campaign_id))];
    const { data: campaigns } = await supabaseAdmin
      .from('sms_intake_campaigns')
      .select('id, cancel_on_signup')
      .in('id', campaignIds);

    const cancelOnSignupCampaigns = new Set(
      (campaigns || []).filter(c => c.cancel_on_signup).map(c => c.id)
    );
    const enrollmentMap = new Map(
      (enrollments || []).map(e => [e.id, e])
    );

    // For cancel_on_signup campaigns, check which phones have completed signup
    const phonesToCheck = [...new Set(
      (enrollments || [])
        .filter(e => cancelOnSignupCampaigns.has(e.campaign_id))
        .map(e => e.phone)
    )];

    const convertedPhones = new Set<string>();
    if (phonesToCheck.length > 0) {
      const { data: signedUp, error: signupCheckError } = await supabaseAdmin
        .from('waitlist')
        .select('phone')
        .in('phone', phonesToCheck)
        .not('member_id', 'is', null);

      if (signupCheckError) {
        console.error('Failed to check converted phones — proceeding without signup detection:', signupCheckError);
      }

      for (const entry of signedUp || []) {
        convertedPhones.add(entry.phone);
      }
    }

    for (const msg of claimed) {
      const enrollment = enrollmentMap.get(msg.enrollment_id);

      // Signup detection: if this phone has converted, cancel this message
      // and all remaining pending messages for this enrollment
      if (enrollment && cancelOnSignupCampaigns.has(enrollment.campaign_id) && convertedPhones.has(msg.phone)) {
        await supabaseAdmin
          .from('sms_intake_scheduled_messages')
          .update({ status: 'cancelled' })
          .eq('enrollment_id', msg.enrollment_id)
          .in('status', ['pending', 'processing']);

        await supabaseAdmin
          .from('sms_intake_enrollments')
          .update({ status: 'completed' })
          .eq('id', msg.enrollment_id);

        console.log(`Signup detected for ${msg.phone} — cancelled remaining nurture messages`);
        continue;
      }

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
    const batchEnrollmentIds = [...new Set(claimed.map(m => m.enrollment_id))];
    if (batchEnrollmentIds.length > 0) {
      // Single query: find enrollments that still have pending/processing messages
      const { data: pendingRemaining } = await supabaseAdmin
        .from('sms_intake_scheduled_messages')
        .select('enrollment_id')
        .in('enrollment_id', batchEnrollmentIds)
        .in('status', ['pending', 'processing']);

      const stillPending = new Set((pendingRemaining || []).map(r => r.enrollment_id));

      const completedIds = batchEnrollmentIds.filter(id => !stillPending.has(id));
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
        status: 'pending', // Reset from 'processing' so cron picks it up again
        retry_count: newRetryCount,
        error_message: errorMessage,
        scheduled_for: nextAttempt,
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
