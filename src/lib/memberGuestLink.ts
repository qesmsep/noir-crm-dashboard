/**
 * Staff "Text link to member": send the host the no-login add-guests link,
 * using the "Member guest link" message edited in Campaigns → Reservation guests.
 */
import { DateTime } from 'luxon';
import { supabaseAdmin } from '@/lib/supabase';
import { sendSMS } from '@/lib/sms';
import { toE164 } from '@/lib/phone';
import { ensureGuestLink } from '@/lib/guestLink';
import { guestLinkUrl } from '@/lib/guestApi';
import { DEFAULT_TIMEZONE, loadTemplates, type GuestDeps } from '@/lib/reservationGuests';
import { renderMemberLinkMessage } from '@/lib/guestMessageRender';

export async function textGuestLinkToMember(
  reservationId: string,
  sentBy: string,
  deps: GuestDeps = {},
): Promise<{ ok: true; url: string } | { ok: false; status: number; error: string }> {
  const db = deps.db ?? supabaseAdmin;
  const send = deps.send ?? sendSMS;
  const now = (deps.now ?? (() => DateTime.utc()))();

  const templates = await loadTemplates(db);
  const template = templates.get('member_link');
  if (!template || !template.is_active) {
    return { ok: false, status: 409, error: 'Turn on the "Member guest link" message in Campaigns → Reservation guests first.' };
  }

  const { data: r } = await db
    .from('reservations')
    .select('id, phone, first_name, member_id, account_id, start_time, location_id')
    .eq('id', reservationId)
    .maybeSingle();
  if (!r) return { ok: false, status: 404, error: 'Reservation not found' };
  const phone = toE164(r.phone);
  if (!phone) return { ok: false, status: 400, error: 'This reservation has no valid mobile number.' };

  const link = await ensureGuestLink(reservationId, { db, now });
  if (!link.ok) return link;
  const url = guestLinkUrl(link.token);

  const { data: loc } = r.location_id
    ? await db.from('locations').select('name, timezone').eq('id', r.location_id).maybeSingle()
    : { data: null };
  let first = (r.first_name || '').trim().split(' ')[0];
  if (!first && r.member_id) {
    const { data: m } = await db.from('members').select('first_name').eq('member_id', r.member_id).maybeSingle();
    first = ((m as { first_name?: string } | null)?.first_name || '').trim();
  }

  const content = renderMemberLinkMessage(template.body, {
    memberFirstName: first || 'there',
    locationName: (loc as { name?: string } | null)?.name || 'Noir',
    start: r.start_time,
    timezone: (loc as { timezone?: string } | null)?.timezone || DEFAULT_TIMEZONE,
    guestLink: url,
  });

  // Members' texts are logged to their message history by sendSMS; non-member
  // reservations go to guest_messages like other non-member texts.
  const isMember = !!(r.member_id && r.account_id);
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
  if (!result.success) return { ok: false, status: 502, error: result.error || 'Send failed.' };
  return { ok: true, url };
}
