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
  address?: string | null;
  parking_instructions?: string | null;
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
  location: { name?: string | null; timezone?: string | null; address?: string | null; parking_instructions?: string | null } | null,
): string {
  const tz = location?.timezone || DEFAULT_VENUE_TIMEZONE;
  const start = DateTime.fromISO(reservation.start_time, { zone: 'utc' }).setZone(tz);
  const first = reservation.first_name || 'Guest';
  const last = reservation.last_name || '';
  return content
    .replace(/\{\{first_name\}\}/g, () => first)
    .replace(/\{\{last_name\}\}/g, () => last)
    .replace(/\{\{member_name\}\}/g, () => `${first} ${last}`.trim())
    .replace(/\{\{phone\}\}/g, () => reservation.phone || '')
    .replace(/\{\{email\}\}/g, () => reservation.email || '')
    .replace(/\{\{reservation_time\}\}/g, () => start.isValid ? start.toFormat('h:mm a') : '')
    .replace(/\{\{reservation_date\}\}/g, () => start.isValid ? start.toFormat('MMMM d, yyyy') : '')
    .replace(/\{\{party_size\}\}/g, () => reservation.party_size != null ? String(reservation.party_size) : '')
    .replace(/\{\{location_name\}\}/g, () => location?.name || '')
    .replace(/\{\{location_address\}\}/g, () => (location?.address || '').trim())
    .replace(/\{\{parking_instructions\}\}/g, () => (location?.parking_instructions || '').trim())
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
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

/** A text is attempted at most this many times (first try + 2 retries). */
export const MAX_SEND_ATTEMPTS = 3;
/** A claim still pending after this long means the sender died mid-send. */
export const STALE_CLAIM_MINUTES = 10;
/** Failed "Send immediately" texts are retried only this soon after booking. */
export const RETRY_WINDOW_MINUTES = 120;

export type ClaimResult =
  | { kind: 'claimed'; rowId: string | null }
  | { kind: 'duplicate' }
  | { kind: 'exhausted' }
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
  // Stop after MAX_SEND_ATTEMPTS failed tries for this (message, reservation).
  const { data: failedRows, error: countError } = await db
    .from('scheduled_messages')
    .select('id')
    .eq('campaign_message_id', args.campaignMessageId)
    .eq('reservation_id', args.reservationId)
    .eq('status', 'failed');
  if (countError) {
    // Can't read the attempt count: carry on (a confirmation matters more than
    // the cap), but make it visible.
    console.error('[reservation campaigns] could not count failed attempts', countError.message);
  } else if ((failedRows || []).length >= MAX_SEND_ATTEMPTS) {
    return { kind: 'exhausted' };
  }

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
  deps: ReservationCampaignDeps & { onlyMessageIds?: string[] } = {},
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
        (!deps.onlyMessageIds || deps.onlyMessageIds.includes(m.id)) &&
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
      const { data: loc } = await db.from('locations').select('id, name, timezone, address, parking_instructions').eq('id', r.location_id).single();
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
      if (claim.kind === 'duplicate' || claim.kind === 'exhausted') {
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

/**
 * Cron safety net for "Send immediately" confirmations:
 *  1. a claim left pending for STALE_CLAIM_MINUTES (the sender died mid-send)
 *     is marked failed, which frees the slot;
 *  2. a failed send for a reservation booked in the last RETRY_WINDOW_MINUTES
 *     is retried, up to MAX_SEND_ATTEMPTS attempts in total.
 * A retry after an interrupted send can, rarely, repeat a text OpenPhone had
 * already delivered; that trade was chosen over a lost confirmation.
 */
export async function retryImmediateReservationSends(deps: ReservationCampaignDeps = {}): Promise<{ staleMarked: number; retried: number }> {
  const db = deps.db ?? supabaseAdmin;
  const now = (deps.now ?? (() => DateTime.now()))();
  const out = { staleMarked: 0, retried: 0 };
  try {
    const { data: stale } = await db
      .from('scheduled_messages')
      .update({ status: 'failed', error_message: 'Interrupted before the send finished' })
      .eq('status', 'pending')
      .not('reservation_id', 'is', null)
      .is('sent_time', null)
      .lt('created_at', now.minus({ minutes: STALE_CLAIM_MINUTES }).toUTC().toISO()!)
      .select('id');
    out.staleMarked = ((stale as unknown[]) || []).length;

    const { data: failed } = await db
      .from('scheduled_messages')
      .select('campaign_message_id, reservation_id')
      .eq('status', 'failed')
      .not('reservation_id', 'is', null)
      .gte('created_at', now.minus({ minutes: RETRY_WINDOW_MINUTES }).toUTC().toISO()!);
    const attempts = new Map<string, { messageId: string; reservationId: string; count: number }>();
    for (const row of (failed || []) as Array<{ campaign_message_id: string; reservation_id: string }>) {
      const key = `${row.campaign_message_id}|${row.reservation_id}`;
      const a = attempts.get(key) || { messageId: row.campaign_message_id, reservationId: row.reservation_id, count: 0 };
      a.count++;
      attempts.set(key, a);
    }
    const byReservation = new Map<string, string[]>();
    for (const a of attempts.values()) {
      if (a.count >= MAX_SEND_ATTEMPTS) continue;
      byReservation.set(a.reservationId, [...(byReservation.get(a.reservationId) || []), a.messageId]);
    }
    for (const [reservationId, messageIds] of byReservation) {
      const r = await sendReservationCreatedMessages(reservationId, { ...deps, onlyMessageIds: messageIds });
      out.retried += r.sent;
    }
  } catch (err) {
    console.error('[reservation campaigns] retry pass failed', err);
  }
  return out;
}
