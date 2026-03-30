import { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '../../../lib/supabase';
import { DateTime } from 'luxon';

const DEFAULT_TIMEZONE = 'America/Chicago';

/**
 * Enroll a phone number into an intake campaign.
 * Called from the webhook (trigger-based) or admin UI (manual).
 *
 * POST body: { campaign_id, phone, source?: 'trigger' | 'manual' }
 *   OR
 * POST body: { trigger_word, phone, source?: 'trigger' }
 *
 * GET: list enrollments for a campaign
 *   ?campaign_id=UUID
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      const { campaign_id } = req.query;
      if (!campaign_id) {
        return res.status(400).json({ error: 'campaign_id is required' });
      }

      const { data, error } = await supabaseAdmin
        .from('sms_intake_enrollments')
        .select('*')
        .eq('campaign_id', campaign_id)
        .order('enrolled_at', { ascending: false });

      if (error) throw error;
      return res.status(200).json(data || []);
    } catch (error) {
      console.error('Error fetching enrollments:', error);
      return res.status(500).json({ error: 'Failed to fetch enrollments' });
    }
  }

  if (req.method === 'POST') {
    try {
      const { campaign_id, trigger_word, phone, source = 'manual' } = req.body;

      if (!phone) {
        return res.status(400).json({ error: 'Phone number is required' });
      }

      // Resolve campaign_id from trigger_word if needed
      let resolvedCampaignId = campaign_id;
      if (!resolvedCampaignId && trigger_word) {
        const { data: campaign } = await supabaseAdmin
          .from('sms_intake_campaigns')
          .select('id')
          .ilike('trigger_word', trigger_word.trim())
          .eq('status', 'active')
          .single();

        if (!campaign) {
          return res.status(404).json({ error: 'No active campaign found for this trigger word' });
        }
        resolvedCampaignId = campaign.id;
      }

      if (!resolvedCampaignId) {
        return res.status(400).json({ error: 'campaign_id or trigger_word is required' });
      }

      // Check for existing active enrollment
      const { data: existing } = await supabaseAdmin
        .from('sms_intake_enrollments')
        .select('id')
        .eq('campaign_id', resolvedCampaignId)
        .eq('phone', phone)
        .eq('status', 'active')
        .single();

      if (existing) {
        return res.status(200).json({ message: 'Already enrolled', enrollment_id: existing.id });
      }

      // Create enrollment
      const { data: enrollment, error: enrollError } = await supabaseAdmin
        .from('sms_intake_enrollments')
        .insert({
          campaign_id: resolvedCampaignId,
          phone,
          source,
          status: 'active',
        })
        .select()
        .single();

      if (enrollError) throw enrollError;

      // Get campaign messages
      const { data: messages, error: msgError } = await supabaseAdmin
        .from('sms_intake_campaign_messages')
        .select('*')
        .eq('campaign_id', resolvedCampaignId)
        .order('sort_order', { ascending: true });

      if (msgError) throw msgError;

      if (messages && messages.length > 0) {
        const now = DateTime.now().setZone(DEFAULT_TIMEZONE);
        const scheduledRows = messages.map((msg: any) => {
          let scheduledFor: DateTime;

          if (msg.delay_minutes === 0 && !msg.send_time) {
            // Send immediately
            scheduledFor = now;
          } else if (msg.send_time) {
            // Send at specific time, delay_minutes represents delay in days (converted)
            const delayDays = Math.floor(msg.delay_minutes / 1440);
            const targetDay = now.plus({ days: delayDays || 1 });
            const [hours, minutes] = msg.send_time.split(':').map(Number);
            scheduledFor = targetDay.set({ hour: hours, minute: minutes, second: 0, millisecond: 0 });

            // If the scheduled time has already passed today, push to next day
            if (scheduledFor <= now) {
              scheduledFor = scheduledFor.plus({ days: 1 });
            }
          } else {
            // Delay by minutes from now
            scheduledFor = now.plus({ minutes: msg.delay_minutes });
          }

          return {
            enrollment_id: enrollment.id,
            campaign_message_id: msg.id,
            phone,
            message_content: msg.message_content,
            scheduled_for: scheduledFor.toISO(),
            status: 'pending',
          };
        });

        const { error: schedError } = await supabaseAdmin
          .from('sms_intake_scheduled_messages')
          .insert(scheduledRows);

        if (schedError) throw schedError;
      }

      return res.status(201).json({
        enrollment_id: enrollment.id,
        messages_scheduled: messages?.length || 0,
      });
    } catch (error) {
      console.error('Error enrolling phone:', error);
      return res.status(500).json({ error: 'Failed to enroll phone number' });
    }
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).end(`Method ${req.method} Not Allowed`);
}
