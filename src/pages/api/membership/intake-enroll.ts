import { NextApiRequest, NextApiResponse } from 'next';
import { randomBytes } from 'crypto';
import { supabaseAdmin } from '../../../lib/supabase';
import { verifyAdmin, isInternalCall } from '../../../lib/admin-auth';
import { DateTime } from 'luxon';

const DEFAULT_TIMEZONE = 'America/Chicago';

interface MemberRecord {
  member_id: string;
  account_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
}

interface CampaignActions {
  create_onboarding_link?: { enabled?: boolean; selected_membership?: string; token_expiry_hours?: number };
  add_ledger_charge?: { enabled?: boolean; amount?: number; description?: string };
  create_event_rsvp?: { enabled?: boolean; event_id?: string; party_size?: number };
}

interface CampaignRecord {
  id: string;
  name: string;
  trigger_word: string;
  status: string;
  actions: CampaignActions | null;
  non_member_response: string | null;
}

interface CampaignMessageRecord {
  id: string;
  campaign_id: string;
  message_content: string;
  delay_minutes: number;
  send_time: string | null;
  sort_order: number;
}

interface ActionResult {
  action: string;
  success: boolean;
  error?: string;
}

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

// ── Phone Normalization ────────────────────────────────────────────────────
// Normalize phone to E.164 format (+1XXXXXXXXXX) for consistent storage
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  const last10 = digits.slice(-10);
  if (last10.length === 10) return '+1' + last10;
  if (digits.length === 11 && digits.startsWith('1')) return '+' + digits;
  return phone; // Return as-is if we can't normalize
}

// ── Member Lookup ──────────────────────────────────────────────────────────
// Consolidated into a single query using OR to avoid sequential DB round-trips
async function lookupMemberByPhone(phone: string): Promise<MemberRecord | null> {
  const digits = phone.replace(/\D/g, '');
  const last10 = digits.slice(-10);

  const variants = [...new Set([phone, digits, last10, '+1' + last10, '1' + last10, '+' + digits])];

  // Single query: exact match on any phone format variant
  const { data: member } = await supabaseAdmin
    .from('members')
    .select('member_id, account_id, first_name, last_name, email, phone')
    .in('phone', variants)
    .limit(1)
    .maybeSingle();

  if (member) return member;

  // Fallback: ILIKE on last 10 digits (handles unexpected storage formats)
  const { data: fallback } = await supabaseAdmin
    .from('members')
    .select('member_id, account_id, first_name, last_name, email, phone')
    .ilike('phone', `%${last10}%`)
    .limit(1)
    .maybeSingle();

  return fallback;
}

// ── Action: Create Onboarding Link ─────────────────────────────────────────
// Replicates the INVITATION / SKYLINE logic from the legacy webhook
async function executeCreateOnboardingLink(
  phone: string,
  actionConfig: { selected_membership?: string; token_expiry_hours?: number }
): Promise<{ onboard_url: string }> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://noirkc.com';

  // Check for existing approved waitlist entry with a valid token
  const { data: existingEntry } = await supabaseAdmin
    .from('waitlist')
    .select('id, agreement_token, agreement_token_created_at, application_expires_at')
    .eq('phone', phone)
    .eq('status', 'approved')
    .single();

  let signupToken: string;

  const now = new Date();
  const hasValidToken = existingEntry && existingEntry.agreement_token && (() => {
    if (existingEntry.application_expires_at) {
      // Use explicit expiry timestamp
      return new Date(existingEntry.application_expires_at) > now;
    }
    // Pre-migration fallback: 7-day window from token creation
    if (existingEntry.agreement_token_created_at) {
      const daysSinceCreation = (now.getTime() - new Date(existingEntry.agreement_token_created_at).getTime()) / (1000 * 60 * 60 * 24);
      return daysSinceCreation < 7;
    }
    return false;
  })();

  if (hasValidToken) {
    // Reuse existing valid token (confirmed not expired)
    signupToken = existingEntry.agreement_token;
  } else {
    // Generate new token (cryptographically secure)
    // Token expiry is configurable via campaign actions (default 24h)
    const expiryHours = actionConfig.token_expiry_hours || 24;
    signupToken = randomBytes(24).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + expiryHours);

    const tokenFields: Record<string, string> = {
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
      // Space char satisfies NOT NULL constraint — matches legacy webhook pattern
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
  member: Pick<MemberRecord, 'member_id' | 'account_id'>,
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
  member: MemberRecord,
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
    (sum: number, r: { party_size: number }) => sum + (r.party_size || 0),
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
  // Strip any remaining unreplaced placeholders so users don't see raw {{var}} text
  result = result.replace(/\{\{[a-z_]+\}\}/g, '');
  return result;
}

// ── Enrollment Result Type ─────────────────────────────────────────────────
interface EnrollmentResult {
  status: number;
  body: Record<string, unknown>;
}

// ── Core Enrollment Logic ──────────────────────────────────────────────────
// Exported so the webhook can call it directly without an HTTP round-trip
export async function enrollPhone(params: {
  campaign_id?: string;
  trigger_word?: string;
  phone: string;
  source?: 'trigger' | 'manual';
}): Promise<EnrollmentResult> {
  const { campaign_id, trigger_word, source = 'manual' } = params;
  const phone = normalizePhone(params.phone);

  // Resolve campaign from trigger_word or campaign_id
  let resolvedCampaignId = campaign_id;
  let campaignData: CampaignRecord | null = null;

  if (resolvedCampaignId) {
    const { data } = await supabaseAdmin
      .from('sms_intake_campaigns')
      .select('*')
      .eq('id', resolvedCampaignId)
      .single();

    if (!data) {
      return { status: 404, body: { error: 'Campaign not found' } };
    }
    if (data.status !== 'active') {
      return { status: 400, body: { error: 'Campaign is not active' } };
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
      return { status: 404, body: { error: 'No active campaign found for this trigger word' } };
    }
    campaignData = data;
    resolvedCampaignId = data.id;
  }

  if (!resolvedCampaignId || !campaignData) {
    return { status: 400, body: { error: 'campaign_id or trigger_word is required' } };
  }

  // ── Member Lookup (if needed for members-only actions) ──────────────
  const actions = campaignData.actions || {};
  const templateVars: Record<string, string> = {};
  let member: MemberRecord | null = null;

  const needsMember =
    (actions.add_ledger_charge?.enabled) ||
    (actions.create_event_rsvp?.enabled);

  if (needsMember) {
    member = await lookupMemberByPhone(phone);

    if (!member) {
      // Non-member trying a members-only action — send response and bail
      const nonMemberMsg = campaignData.non_member_response ||
        'We apologize but our system cannot find this phone number registered to a member. Please text us to resolve this issue.';

      if (process.env.OPENPHONE_API_KEY) {
        try {
          const smsResponse = await fetch('https://api.openphone.com/v1/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': process.env.OPENPHONE_API_KEY,
              'Accept': 'application/json',
            },
            body: JSON.stringify({
              to: [phone],
              from: process.env.OPENPHONE_PHONE_NUMBER_ID,
              content: nonMemberMsg,
            }),
          });
          if (!smsResponse.ok) {
            console.error('Failed to send non-member response:', await smsResponse.text());
          }
        } catch (smsError) {
          console.error('Error sending non-member response:', smsError);
        }
      } else {
        console.error('OPENPHONE_API_KEY is not configured — cannot send non-member response');
      }

      return { status: 200, body: { message: 'Non-member response sent', is_member: false } };
    }

    templateVars.member_name = member.first_name;
  }

  // ── Create Enrollment FIRST (before side effects) ───────────────────
  // This ensures no financial actions are committed without an enrollment record
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
    // Unique constraint violation = already enrolled (race condition)
    if (enrollError.code === '23505') {
      return { status: 200, body: { message: 'Already enrolled' } };
    }
    throw enrollError;
  }

  // ── Execute Actions (after enrollment is persisted) ─────────────────
  const actionResults: ActionResult[] = [];

  // Action: Create Onboarding Link
  if (actions.create_onboarding_link?.enabled) {
    try {
      const { onboard_url } = await executeCreateOnboardingLink(phone, {
        selected_membership: actions.create_onboarding_link.selected_membership,
        token_expiry_hours: actions.create_onboarding_link.token_expiry_hours,
      });
      templateVars.onboard_url = onboard_url;
      actionResults.push({ action: 'create_onboarding_link', success: true });
    } catch (err: unknown) {
      console.error('Error creating onboarding link:', err);
      actionResults.push({ action: 'create_onboarding_link', success: false, error: err instanceof Error ? err.message : 'Unknown error' });
    }
  }

  // Action: Add Ledger Charge (member already verified above)
  if (actions.add_ledger_charge?.enabled && member) {
    const amount = Number(actions.add_ledger_charge.amount);
    const description: string = actions.add_ledger_charge.description || 'Intake campaign charge';
    if (!amount || amount <= 0 || !isFinite(amount)) {
      actionResults.push({ action: 'add_ledger_charge', success: false, error: 'Invalid charge amount' });
    } else {
      try {
        await executeAddLedgerCharge(member, { amount, description });
        templateVars.charge_amount = `$${amount.toFixed(2)}`;
        actionResults.push({ action: 'add_ledger_charge', success: true });
      } catch (err: unknown) {
        console.error('Error adding ledger charge:', err);
        actionResults.push({ action: 'add_ledger_charge', success: false, error: err instanceof Error ? err.message : 'Unknown error' });
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
          party_size: Math.max(1, actions.create_event_rsvp.party_size || 1),
        });
        templateVars.event_title = event_title;
        actionResults.push({ action: 'create_event_rsvp', success: true });
      } catch (err: unknown) {
        console.error('Error creating event RSVP:', err);
        actionResults.push({ action: 'create_event_rsvp', success: false, error: err instanceof Error ? err.message : 'Unknown error' });
      }
    }
  }

  // ── Schedule Messages ────────────────────────────────────────────────
  const { data: messages, error: msgError } = await supabaseAdmin
    .from('sms_intake_campaign_messages')
    .select('*')
    .eq('campaign_id', resolvedCampaignId)
    .order('sort_order', { ascending: true });

  if (msgError) throw msgError;

  if (messages && messages.length > 0) {
    const now = DateTime.now().setZone(DEFAULT_TIMEZONE);
    const scheduledRows = messages.map((msg: CampaignMessageRecord) => {
      let scheduledFor: DateTime;

      if (msg.delay_minutes === 0 && !msg.send_time) {
        scheduledFor = now;
      } else if (msg.send_time) {
        const delayDays = Math.floor(msg.delay_minutes / 1440);
        const targetDay = now.plus({ days: delayDays || 1 });
        const timeParts = (msg.send_time as string).split(':').map(Number);
        const hours = timeParts[0] || 0;
        const minutes = timeParts[1] || 0;
        if (isNaN(hours) || isNaN(minutes)) {
          scheduledFor = targetDay.set({ hour: 10, minute: 0, second: 0, millisecond: 0 });
        } else {
          scheduledFor = targetDay.set({ hour: hours, minute: minutes, second: 0, millisecond: 0 });
        }

        if (scheduledFor <= now) {
          scheduledFor = scheduledFor.plus({ days: 1 });
        }
      } else {
        scheduledFor = now.plus({ minutes: msg.delay_minutes });
      }

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

  return {
    status: 201,
    body: {
      enrollment_id: enrollment.id,
      messages_scheduled: messages?.length || 0,
      action_results: actionResults,
    },
  };
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

      const result = await enrollPhone({ campaign_id, trigger_word, phone, source });
      return res.status(result.status).json(result.body);
    } catch (error) {
      console.error('Error enrolling phone:', error);
      return res.status(500).json({ error: 'Failed to enroll phone number' });
    }
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).end(`Method ${req.method} Not Allowed`);
}
