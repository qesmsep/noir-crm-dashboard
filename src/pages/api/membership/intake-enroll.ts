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

// ── Member Lookup ──────────────────────────────────────────────────────────
// Mirrors the checkMemberStatus logic from openphoneWebhook.js
async function lookupMemberByPhone(phone: string) {
  const digits = phone.replace(/\D/g, '');
  const last10 = digits.slice(-10);

  const possiblePhones = [
    phone,
    digits,
    last10,
    '+1' + last10,
    '1' + last10,
    '+' + digits,
  ];
  const uniquePhones = [...new Set(possiblePhones)];

  for (const fmt of uniquePhones) {
    const { data: member } = await supabaseAdmin
      .from('members')
      .select('member_id, account_id, first_name, last_name, email, phone')
      .eq('phone', fmt)
      .maybeSingle();

    if (member) return member;
  }

  // Fallback: LIKE search
  for (const variant of [digits, last10]) {
    const { data: members } = await supabaseAdmin
      .from('members')
      .select('member_id, account_id, first_name, last_name, email, phone')
      .ilike('phone', `%${variant}%`)
      .limit(1);

    if (members && members.length > 0) return members[0];
  }

  return null;
}

// ── Action: Create Onboarding Link ─────────────────────────────────────────
// Replicates the INVITATION / SKYLINE logic from the legacy webhook
async function executeCreateOnboardingLink(
  phone: string,
  actionConfig: { selected_membership?: string }
): Promise<{ onboard_url: string }> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://noirkc.com';

  // Check for existing approved waitlist entry with a valid token
  const { data: existingEntry } = await supabaseAdmin
    .from('waitlist')
    .select('id, agreement_token, application_expires_at')
    .eq('phone', phone)
    .eq('status', 'approved')
    .single();

  let signupToken: string;

  if (
    existingEntry &&
    existingEntry.agreement_token &&
    new Date(existingEntry.application_expires_at) > new Date()
  ) {
    // Reuse existing valid token
    signupToken = existingEntry.agreement_token;
  } else {
    // Generate new 24-hour token
    signupToken =
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15);
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    const tokenFields: Record<string, any> = {
      agreement_token: signupToken,
      agreement_token_created_at: new Date().toISOString(),
      application_expires_at: expiresAt.toISOString(),
      application_link_sent_at: new Date().toISOString(),
    };

    if (actionConfig.selected_membership) {
      tokenFields.selected_membership = actionConfig.selected_membership;
    }

    if (existingEntry) {
      await supabaseAdmin
        .from('waitlist')
        .update(tokenFields)
        .eq('id', existingEntry.id);
    } else {
      await supabaseAdmin.from('waitlist').insert({
        phone,
        first_name: ' ',
        last_name: ' ',
        email: ' ',
        status: 'approved',
        submitted_at: new Date().toISOString(),
        ...tokenFields,
      });
    }
  }

  return { onboard_url: `${baseUrl}/onboard/${signupToken}` };
}

// ── Action: Add Ledger Charge ──────────────────────────────────────────────
async function executeAddLedgerCharge(
  member: { member_id: string; account_id: string },
  actionConfig: { amount: number; description: string }
) {
  const cstDate = DateTime.now().setZone(DEFAULT_TIMEZONE).toISODate();

  const { error } = await supabaseAdmin.from('ledger').insert({
    member_id: member.member_id,
    account_id: member.account_id,
    type: 'purchase',
    amount: -Math.abs(actionConfig.amount), // Negative for charges
    note: actionConfig.description,
    date: cstDate,
  });

  if (error) {
    console.error('Error creating ledger charge:', error);
    throw new Error('Failed to create ledger charge');
  }
}

// ── Action: Create Event RSVP ──────────────────────────────────────────────
async function executeCreateEventRsvp(
  member: { member_id: string; account_id: string; first_name: string; last_name: string; email: string; phone: string },
  actionConfig: { event_id: string; party_size?: number }
): Promise<{ event_title: string }> {
  const partySize = actionConfig.party_size || 1;

  // Get event details
  const { data: event, error: eventError } = await supabaseAdmin
    .from('private_events')
    .select('*')
    .eq('id', actionConfig.event_id)
    .eq('status', 'active')
    .single();

  if (eventError || !event) {
    throw new Error('Event not found or inactive');
  }

  // Check capacity
  const { data: attendeeReservations } = await supabaseAdmin
    .from('reservations')
    .select('party_size')
    .eq('private_event_id', actionConfig.event_id);

  const currentAttendees = (attendeeReservations || []).reduce(
    (sum: number, r: any) => sum + (r.party_size || 0),
    0
  );

  if (event.total_attendees_maximum && currentAttendees + partySize > event.total_attendees_maximum) {
    throw new Error(`Event is full (${currentAttendees}/${event.total_attendees_maximum})`);
  }

  // Check for existing RSVP by phone
  const { data: existingRsvp } = await supabaseAdmin
    .from('reservations')
    .select('id')
    .eq('private_event_id', actionConfig.event_id)
    .eq('phone', member.phone)
    .single();

  if (existingRsvp) {
    return { event_title: event.title }; // Already RSVP'd, skip
  }

  // Create reservation
  await supabaseAdmin.from('reservations').insert({
    private_event_id: actionConfig.event_id,
    table_id: null,
    start_time: event.start_time,
    end_time: event.end_time,
    party_size: partySize,
    first_name: member.first_name,
    last_name: member.last_name,
    email: member.email,
    phone: member.phone,
    member_id: member.member_id,
    notes: `RSVP via SMS trigger for ${event.title}`,
    source: 'sms_intake_campaign',
  });

  // Charge if event has price_per_seat
  if (event.price_per_seat && event.price_per_seat > 0) {
    const totalCost = event.price_per_seat * partySize;
    const cstDate = DateTime.now().setZone(DEFAULT_TIMEZONE).toISODate();

    await supabaseAdmin.from('ledger').insert({
      member_id: member.member_id,
      account_id: member.account_id,
      type: 'purchase',
      amount: -totalCost,
      note: `Private Event: ${event.title} - ${partySize} seat${partySize > 1 ? 's' : ''}`,
      date: cstDate,
    });
  }

  return { event_title: event.title };
}

// ── Template Variable Expansion ────────────────────────────────────────────
// Only expand known safe variable names - no dynamic regex from user input
const KNOWN_TEMPLATE_VARS = ['onboard_url', 'member_name', 'charge_amount', 'event_title'];

function expandTemplateVars(
  content: string,
  vars: Record<string, string>
): string {
  let result = content;
  for (const key of KNOWN_TEMPLATE_VARS) {
    if (vars[key]) {
      result = result.split(`{{${key}}}`).join(vars[key]);
    }
  }
  return result;
}

// ── Admin Auth ─────────────────────────────────────────────────────────────
async function verifyAdmin(req: NextApiRequest): Promise<boolean> {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return false;

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return false;

  const { data: admin } = await supabaseAdmin
    .from('admins')
    .select('access_level')
    .eq('auth_user_id', user.id)
    .eq('status', 'active')
    .single();

  return !!admin;
}

function isInternalCall(req: NextApiRequest): boolean {
  // Allow webhook/cron internal calls via CRON_SECRET
  return req.headers.authorization === `Bearer ${process.env.CRON_SECRET}`;
}

// ── Main Handler ───────────────────────────────────────────────────────────
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    // GET requires admin auth
    if (!(await verifyAdmin(req))) {
      return res.status(401).json({ error: 'Admin authentication required' });
    }
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
    // POST requires admin auth OR internal call (from webhook)
    if (!isInternalCall(req) && !(await verifyAdmin(req))) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    try {
      const { campaign_id, trigger_word, phone, source = 'manual' } = req.body;

      if (!phone) {
        return res.status(400).json({ error: 'Phone number is required' });
      }

      // Resolve campaign from trigger_word or campaign_id
      let resolvedCampaignId = campaign_id;
      let campaignData: any = null;

      if (resolvedCampaignId) {
        const { data } = await supabaseAdmin
          .from('sms_intake_campaigns')
          .select('*')
          .eq('id', resolvedCampaignId)
          .single();

        if (data && data.status !== 'active') {
          return res.status(400).json({ error: 'Campaign is not active' });
        }
        campaignData = data;
      } else if (trigger_word) {
        const { data } = await supabaseAdmin
          .from('sms_intake_campaigns')
          .select('*')
          .ilike('trigger_word', trigger_word.trim())
          .eq('status', 'active')
          .single();

        if (!data) {
          return res.status(404).json({ error: 'No active campaign found for this trigger word' });
        }
        campaignData = data;
        resolvedCampaignId = data.id;
      }

      if (!resolvedCampaignId || !campaignData) {
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

      // ── Execute Actions ──────────────────────────────────────────────
      const actions = campaignData.actions || {};
      const templateVars: Record<string, string> = {};
      const actionResults: { action: string; success: boolean; error?: string }[] = [];
      let member: any = null;

      // Check if any action requires member lookup
      const needsMember =
        (actions.add_ledger_charge?.enabled) ||
        (actions.create_event_rsvp?.enabled);

      if (needsMember) {
        member = await lookupMemberByPhone(phone);

        if (!member) {
          // Non-member trying a members-only action
          const nonMemberMsg = campaignData.non_member_response ||
            'We apologize but our system cannot find this phone number registered to a member. Please text us to resolve this issue.';

          // Send the non-member response via OpenPhone
          await fetch('https://api.openphone.com/v1/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': process.env.OPENPHONE_API_KEY || '',
              'Accept': 'application/json',
            },
            body: JSON.stringify({
              to: [phone],
              from: process.env.OPENPHONE_PHONE_NUMBER_ID,
              content: nonMemberMsg,
            }),
          });

          return res.status(200).json({
            message: 'Non-member response sent',
            is_member: false,
          });
        }

        templateVars.member_name = member.first_name;
      }

      // Action: Create Onboarding Link
      if (actions.create_onboarding_link?.enabled) {
        try {
          const { onboard_url } = await executeCreateOnboardingLink(phone, {
            selected_membership: actions.create_onboarding_link.selected_membership,
          });
          templateVars.onboard_url = onboard_url;
          actionResults.push({ action: 'create_onboarding_link', success: true });
        } catch (err: any) {
          console.error('Error creating onboarding link:', err);
          actionResults.push({ action: 'create_onboarding_link', success: false, error: err.message });
        }
      }

      // Action: Add Ledger Charge (member already verified above)
      if (actions.add_ledger_charge?.enabled && member) {
        const amount = Number(actions.add_ledger_charge.amount);
        const description = actions.add_ledger_charge.description || 'Intake campaign charge';
        if (!amount || amount <= 0 || !isFinite(amount)) {
          actionResults.push({ action: 'add_ledger_charge', success: false, error: 'Invalid charge amount' });
        } else {
          try {
            await executeAddLedgerCharge(member, { amount, description });
            templateVars.charge_amount = `$${amount.toFixed(2)}`;
            actionResults.push({ action: 'add_ledger_charge', success: true });
          } catch (err: any) {
            console.error('Error adding ledger charge:', err);
            actionResults.push({ action: 'add_ledger_charge', success: false, error: err.message });
          }
        }
      }

      // Action: Create Event RSVP (member already verified above)
      if (actions.create_event_rsvp?.enabled && member) {
        const eventId = actions.create_event_rsvp.event_id;
        if (!eventId) {
          actionResults.push({ action: 'create_event_rsvp', success: false, error: 'No event selected' });
        } else {
          try {
            const { event_title } = await executeCreateEventRsvp(member, {
              event_id: eventId,
              party_size: Math.max(1, parseInt(actions.create_event_rsvp.party_size) || 1),
            });
            templateVars.event_title = event_title;
            actionResults.push({ action: 'create_event_rsvp', success: true });
          } catch (err: any) {
            console.error('Error creating event RSVP:', err);
            actionResults.push({ action: 'create_event_rsvp', success: false, error: err.message });
          }
        }
      }

      // ── Create Enrollment ────────────────────────────────────────────
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

      if (enrollError) {
        // Handle race condition: unique constraint violation means already enrolled
        if (enrollError.code === '23505') {
          return res.status(200).json({ message: 'Already enrolled' });
        }
        throw enrollError;
      }

      // ── Schedule Messages ────────────────────────────────────────────
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
            scheduledFor = now;
          } else if (msg.send_time) {
            const delayDays = Math.floor(msg.delay_minutes / 1440);
            const targetDay = now.plus({ days: delayDays || 1 });
            const [hours, minutes] = msg.send_time.split(':').map(Number);
            scheduledFor = targetDay.set({ hour: hours, minute: minutes, second: 0, millisecond: 0 });

            if (scheduledFor <= now) {
              scheduledFor = scheduledFor.plus({ days: 1 });
            }
          } else {
            scheduledFor = now.plus({ minutes: msg.delay_minutes });
          }

          // Expand template variables in message content
          const expandedContent = expandTemplateVars(msg.message_content, templateVars);

          return {
            enrollment_id: enrollment.id,
            campaign_message_id: msg.id,
            phone,
            message_content: expandedContent,
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
        action_results: actionResults,
      });
    } catch (error) {
      console.error('Error enrolling phone:', error);
      return res.status(500).json({ error: 'Failed to enroll phone number' });
    }
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).end(`Method ${req.method} Not Allowed`);
}
