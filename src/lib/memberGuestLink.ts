/**
 * Staff "Text link to member": send the booker the no-login add-guests link,
 * using the message(s) under the Campaigns trigger "Staff Texts Guest Link"
 * (trigger_type 'member_guest_link'). Placeholders are the reservation ones:
 * {{first_name}}, {{location_name}}, {{reservation_date}}, {{reservation_time}},
 * {{guest_link}}, {{guest_join_link}} ...
 */
import { DateTime } from 'luxon';
import { supabaseAdmin } from '@/lib/supabase';
import { sendSMS } from '@/lib/sms';
import { toE164 } from '@/lib/phone';
import { guestLinksForReservation, renderReservationMessage } from '@/lib/reservationCampaigns';
import { type GuestDeps } from '@/lib/reservationGuests';

export const MEMBER_GUEST_LINK_TRIGGER = 'member_guest_link';

interface LinkMessage {
  id: string;
  content: string;
  campaigns?: {
    is_active?: boolean | null;
    applies_to_all_locations?: boolean | null;
    campaign_locations?: Array<{ location_id: string | null }> | null;
  } | null;
}

function appliesToLocation(m: LinkMessage, locationId: string | null): boolean {
  const c = m.campaigns;
  if (!c || c.is_active === false) return false;
  if (c.applies_to_all_locations) return true;
  return !!locationId && (c.campaign_locations || []).some((cl) => cl.location_id === locationId);
}

export async function textGuestLinkToMember(
  reservationId: string,
  sentBy: string,
  deps: GuestDeps = {},
): Promise<{ ok: true; url: string } | { ok: false; status: number; error: string }> {
  const db = deps.db ?? supabaseAdmin;
  const send = deps.send ?? sendSMS;
  const now = (deps.now ?? (() => DateTime.utc()))();

  const { data: r } = await db
    .from('reservations')
    .select('id, phone, first_name, last_name, email, party_size, member_id, account_id, start_time, location_id')
    .eq('id', reservationId)
    .maybeSingle();
  if (!r) return { ok: false, status: 404, error: 'Reservation not found' };

  const { data: rows, error: loadError } = await db
    .from('campaign_messages')
    .select('id, content, campaigns!inner ( is_active, trigger_type, applies_to_all_locations, campaign_locations ( location_id ) )')
    .eq('is_active', true)
    .eq('campaigns.trigger_type', MEMBER_GUEST_LINK_TRIGGER)
    .order('created_at', { ascending: true });
  if (loadError) return { ok: false, status: 500, error: 'Could not load the message.' };
  const messages = ((rows || []) as unknown as LinkMessage[]).filter((m) => appliesToLocation(m, r.location_id));
  if (messages.length === 0) {
    return { ok: false, status: 409, error: 'Turn on a message under the "Staff Texts Guest Link" trigger in Campaigns first.' };
  }

  const phone = toE164(r.phone);
  if (!phone) return { ok: false, status: 400, error: 'This reservation has no valid mobile number.' };

  const links = await guestLinksForReservation(reservationId, db, now);
  if (!links.guestLink) return { ok: false, status: 409, error: 'This reservation is over or cancelled, so it has no guest link.' };
  if (messages.some((m) => m.content.includes('{{guest_join_link}}')) && !links.guestJoinLink) {
    return { ok: false, status: 500, error: 'Could not make the guest self-register link.' };
  }

  const { data: loc } = r.location_id
    ? await db.from('locations').select('name, timezone, address, parking_instructions').eq('id', r.location_id).maybeSingle()
    : { data: null };
  let first = (r.first_name || '').trim().split(' ')[0];
  if (!first && r.member_id) {
    const { data: m } = await db.from('members').select('first_name').eq('member_id', r.member_id).maybeSingle();
    first = ((m as { first_name?: string } | null)?.first_name || '').trim();
  }

  // Members' texts are logged to their message history by sendSMS; non-member
  // reservations go to guest_messages like other non-member texts.
  const isMember = !!(r.member_id && r.account_id);
  // Keep going past a failed send so one bad message doesn't stop the rest;
  // report how many went out so staff know a retry repeats the sent ones.
  let sent = 0;
  let lastError = '';
  for (const message of messages) {
    const content = renderReservationMessage(
      message.content,
      { ...r, first_name: first || 'there' },
      (loc as { name?: string; timezone?: string; address?: string; parking_instructions?: string } | null) || null,
      links,
    );
    const result = await send(isMember ? { to: phone, content, memberId: r.member_id, accountId: r.account_id } : { to: phone, content });
    if (!isMember) {
      await db.from('guest_messages').insert({
        phone,
        content,
        reservation_id: r.id,
        sent_by: sentBy,
        status: result.success ? 'sent' : 'failed',
        error_message: result.success ? null : result.error || 'Send failed',
        openphone_message_id: result.messageId ?? null,
        timestamp: now.toISO(),
      });
    }
    if (result.success) sent += 1;
    else lastError = result.error || 'Send failed.';
  }
  if (sent < messages.length) {
    const error = sent === 0 ? lastError : `Sent ${sent} of ${messages.length} texts. ${lastError}`;
    return { ok: false, status: 502, error };
  }
  return { ok: true, url: links.guestLink };
}
