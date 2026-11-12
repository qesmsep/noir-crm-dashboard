/**
 * Reservation campaign messages (trigger `reservation_created` / `reservation_time`).
 *
 * The reservation confirmation text used to be hard-coded in
 * `POST /api/reservations`. It now lives in Campaigns as a `reservation_created`
 * message with timing "Send immediately", and this module is what sends it at
 * booking time. Delayed reservation messages (relative / specific time) are
 * still sent by the campaign cron (`/api/process-campaign-messages`), which
 * uses the helpers here for recipient filtering, rendering and dedupe so both
 * paths behave the same.
 *
 * Naming: the campaign engine has historically called anyone with a
 * reservation phone a "guest" (virtual member, `member_type: 'guest'`). That is
 * NOT the reservation-guests feature (people a member brings). This module says
 * "non-member reservation" for the former to keep the two apart.
 */
import { DateTime } from 'luxon';
import { supabaseAdmin } from '@/lib/supabase';
import { sendSMS } from '@/lib/sms';
import { toE164 } from '@/lib/phone';

export const DEFAULT_VENUE_TIMEZONE = 'America/Chicago';

export interface CampaignReservation {
  id: string;
  phone: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  party_size: number | null;
  start_time: string;
  end_time?: string | null;
  created_at?: string | null;
  status: string | null;
  member_id: string | null;
  location_id: string | null;
}

export interface CampaignMessageForReservation {
  id: string;
  content: string;
  recipient_type: string;
  specific_phone?: string | null;
  timing_type: string;
  is_active?: boolean | null;
  campaigns?: {
    id: string;
    name?: string;
    trigger_type: string;
    is_active?: boolean | null;
    applies_to_all_locations?: boolean | null;
    campaign_locations?: Array<{ location_id: string | null; location?: unknown }> | null;
  } | null;
}

export interface LocationInfo {
  id: string;
  name: string | null;
  timezone: string | null;
}

/**
 * Recipient types that apply to reservation triggers.
 * - `member` (labelled "Phone number on the reservation") and
 *   `reservation_phones`: every reservation.
 * - `member_only`  ("Members' reservations"): reservations with a member_id.
 * - `guest_only`   ("Non-member reservations"): reservations without one.
 * - `specific_phone`: one fixed number per reservation.
 */
export function reservationMatchesRecipientType(
  recipientType: string,
  reservation: Pick<CampaignReservation, 'member_id'>,
): boolean {
  if (recipientType === 'member_only') return !!reservation.member_id;
  if (recipientType === 'guest_only') return !reservation.member_id;
  return true;
}

export function messageAppliesToLocation(
  message: CampaignMessageForReservation,
  locationId: string | null,
): boolean {
  const campaign = message.campaigns;
  if (!campaign) return false;
  if (campaign.applies_to_all_locations) return true;
  if (!locationId) return false;
  return (campaign.campaign_locations || []).some((cl) => cl.location_id === locationId);
}

export function isCancelled(status: string | null | undefined): boolean {
  return status === 'cancelled';
}

/** The phone this message goes to for this reservation, in E.164, or null. */
export function recipientPhoneFor(
  message: Pick<CampaignMessageForReservation, 'recipient_type' | 'specific_phone'>,
  reservation: Pick<CampaignReservation, 'phone'>,
): string | null {
  if (message.recipient_type === 'specific_phone') return toE164(message.specific_phone);
  return toE164(reservation.phone);
}

/**
 * Fill reservation placeholders. Dates and times are rendered in the
 * reservation's own location timezone.
 */
export function renderReservationMessage(
  content: string,
  reservation: Pick<CampaignReservation, 'first_name' | 'last_name' | 'email' | 'phone' | 'party_size' | 'start_time'>,
  location: { name?: string | null; timezone?: string | null } | null,
): string {
  const tz = location?.timezone || DEFAULT_VENUE_TIMEZONE;
  const start = DateTime.fromISO(reservation.start_time, { zone: 'utc' }).setZone(tz);
  const first = reservation.first_name || 'Guest';
  const last = reservation.last_name || '';
  return content
    .replace(/\{\{first_name\}\}/g, first)
    .replace(/\{\{last_name\}\}/g, last)
    .replace(/\{\{member_name\}\}/g, `${first} ${last}`.trim())
    .replace(/\{\{phone\}\}/g, reservation.phone || '')
    .replace(/\{\{email\}\}/g, reservation.email || '')
    .replace(/\{\{reservation_time\}\}/g, start.isValid ? start.toFormat('h:mm a') : '')
    .replace(/\{\{reservation_date\}\}/g, start.isValid ? start.toFormat('MMMM d, yyyy') : '')
    .replace(/\{\{party_size\}\}/g, reservation.party_size != null ? String(reservation.party_size) : '')
    .replace(/\{\{location_name\}\}/g, location?.name || '');
}

type Db = typeof supabaseAdmin;
type SendFn = typeof sendSMS;

export interface ReservationCampaignDeps {
  db?: Db;
  send?: SendFn;
  now?: () => DateTime;
}

function isMissingColumnError(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return error.code === 'PGRST204' || error.code === '42703' || /reservation_id/.test(error.message || '') && /column/i.test(error.message || '');
}

export type ClaimResult =
  | { kind: 'claimed'; rowId: string | null }
  | { kind: 'duplicate' }
  | { kind: 'error'; error: string };

/**
 * Claim the (campaign message, reservation) slot before sending, so the
 * inline send, overlapping cron runs and retries can never text the same
 * reservation twice. Relies on the partial unique index
 * `scheduled_messages_campaign_reservation_once` (pending/sent rows only), so a
 * failed attempt frees the slot for a retry.
 *
 * If the `reservation_id` column is not there yet (migration not applied) we
 * fall back to a read-then-send check by phone + recent window, which is what
 * the old code did, so the feature still works in the gap.
 */
export async function claimReservationSend(
  db: Db,
  args: {
    campaignMessageId: string;
    reservationId: string;
    memberId: string | null;
    phone: string;
    content: string;
    scheduledTime: string;
  },
): Promise<ClaimResult> {
  const { data, error } = await db
    .from('scheduled_messages')
    .insert({
      campaign_message_id: args.campaignMessageId,
      reservation_id: args.reservationId,
      member_id: args.memberId,
      phone_number: args.phone,
      message_content: args.content,
      scheduled_time: args.scheduledTime,
      status: 'pending',
    })
    .select('id')
    .single();

  if (!error) return { kind: 'claimed', rowId: (data as { id: string } | null)?.id ?? null };
  if (error.code === '23505') return { kind: 'duplicate' };
  if (isMissingColumnError(error)) {
    console.warn('[reservation campaigns] scheduled_messages.reservation_id missing — apply the migration. Falling back to phone dedupe.');
    const { data: existing } = await db
      .from('scheduled_messages')
      .select('id')
      .eq('campaign_message_id', args.campaignMessageId)
      .eq('phone_number', args.phone)
      .eq('status', 'sent')
      .gte('sent_time', DateTime.now().minus({ minutes: 10 }).toISO()!)
      .limit(1);
    if (existing && existing.length > 0) return { kind: 'duplicate' };
    return { kind: 'claimed', rowId: null };
  }
  return { kind: 'error', error: error.message };
}

/** Record the outcome of a claimed send. */
export async function finishReservationSend(
  db: Db,
  rowId: string | null,
  outcome: { ok: boolean; error?: string },
  fallback: { campaignMessageId: string; memberId: string | null; phone: string; content: string; scheduledTime: string },
  now: DateTime,
): Promise<void> {
  if (rowId) {
    await db
      .from('scheduled_messages')
      .update(
        outcome.ok
          ? { status: 'sent', sent_time: now.toISO() }
          : { status: 'failed', error_message: outcome.error || 'Unknown error' },
      )
      .eq('id', rowId);
    return;
  }
  // Pre-migration fallback: log without reservation_id.
  await db.from('scheduled_messages').insert({
    campaign_message_id: fallback.campaignMessageId,
    member_id: fallback.memberId,
    phone_number: fallback.phone,
    message_content: fallback.content,
    scheduled_time: fallback.scheduledTime,
    sent_time: outcome.ok ? now.toISO() : null,
    status: outcome.ok ? 'sent' : 'failed',
    error_message: outcome.ok ? null : outcome.error || 'Unknown error',
  });
}

const RESERVATION_COLUMNS =
  'id, phone, first_name, last_name, email, party_size, start_time, end_time, created_at, status, member_id, location_id';

const CAMPAIGN_MESSAGE_SELECT = `
  id, content, recipient_type, specific_phone, timing_type, is_active,
  campaigns!inner (
    id, name, trigger_type, is_active, applies_to_all_locations,
    campaign_locations ( location_id )
  )
`;

export interface SendReservationCreatedResult {
  sent: number;
  skipped: number;
  failed: number;
  reason?: string;
}

/**
 * Send every active "Send immediately" `reservation_created` campaign message
 * that matches this reservation's location and recipient type.
 *
 * Never throws: a booking must not fail because a text did.
 */
export async function sendReservationCreatedMessages(
  reservationId: string,
  deps: ReservationCampaignDeps = {},
): Promise<SendReservationCreatedResult> {
  const db = deps.db ?? supabaseAdmin;
  const send = deps.send ?? sendSMS;
  const now = (deps.now ?? (() => DateTime.now()))();
  const result: SendReservationCreatedResult = { sent: 0, skipped: 0, failed: 0 };

  try {
    const { data: reservation, error: resError } = await db
      .from('reservations')
      .select(RESERVATION_COLUMNS)
      .eq('id', reservationId)
      .single();
    if (resError || !reservation) {
      console.warn('[reservation campaigns] reservation not found', reservationId, resError?.message);
      return { ...result, reason: 'reservation_not_found' };
    }
    const r = reservation as CampaignReservation;
    if (isCancelled(r.status)) return { ...result, reason: 'cancelled' };

    const { data: messages, error: msgError } = await db
      .from('campaign_messages')
      .select(CAMPAIGN_MESSAGE_SELECT)
      .eq('is_active', true)
      .eq('timing_type', 'immediate')
      .eq('campaigns.trigger_type', 'reservation_created');
    if (msgError) {
      console.error('[reservation campaigns] failed to load campaign messages', msgError.message);
      return { ...result, reason: 'load_failed' };
    }

    const matching = ((messages || []) as unknown as CampaignMessageForReservation[]).filter(
      (m) =>
        m.campaigns?.trigger_type === 'reservation_created' &&
        m.campaigns?.is_active !== false &&
        messageAppliesToLocation(m, r.location_id) &&
        reservationMatchesRecipientType(m.recipient_type, r),
    );

    if (matching.length === 0) {
      console.warn(
        `[reservation campaigns] no active "Send immediately" reservation_created message matches reservation ${r.id} — no confirmation text sent`,
      );
      return { ...result, reason: 'no_matching_message' };
    }

    let location: LocationInfo | null = null;
    if (r.location_id) {
      const { data: loc } = await db.from('locations').select('id, name, timezone').eq('id', r.location_id).single();
      location = (loc as LocationInfo) || null;
    }

    if (!r.first_name && r.member_id) {
      const { data: member } = await db.from('members').select('first_name').eq('member_id', r.member_id).maybeSingle();
      if (member && (member as { first_name?: string }).first_name) r.first_name = (member as { first_name: string }).first_name;
    }

    for (const message of matching) {
      const phone = recipientPhoneFor(message, r);
      if (!phone) {
        result.skipped++;
        continue;
      }
      const content = renderReservationMessage(message.content, r, location);
      const scheduledTime = now.toISO()!;
      const claim = await claimReservationSend(db, {
        campaignMessageId: message.id,
        reservationId: r.id,
        memberId: r.member_id,
        phone,
        content,
        scheduledTime,
      });
      if (claim.kind === 'duplicate') {
        result.skipped++;
        continue;
      }
      if (claim.kind === 'error') {
        console.error('[reservation campaigns] could not record send', claim.error);
        result.failed++;
        continue;
      }
      const sendResult = await send({ to: phone, content });
      await finishReservationSend(
        db,
        claim.rowId,
        { ok: sendResult.success, error: sendResult.error },
        { campaignMessageId: message.id, memberId: r.member_id, phone, content, scheduledTime },
        now,
      );
      if (sendResult.success) result.sent++;
      else result.failed++;
    }
    return result;
  } catch (err) {
    console.error('[reservation campaigns] unexpected error', err);
    return { ...result, reason: 'error' };
  }
}
