/**
 * Who a guest campaign message goes to. Mirrors "Members' reservations" /
 * "Non-member reservations" on reservation campaigns: a guest is a member when
 * their phone matches one (reservation_guests.matched_member_id).
 * Plain constants so the campaign editor can import them on the client.
 */
export const GUEST_RECIPIENT_TYPES = ['reservation_guest', 'reservation_guest_member', 'reservation_guest_nonmember'] as const;
export type GuestRecipientType = (typeof GUEST_RECIPIENT_TYPES)[number];

export function isGuestRecipient(recipientType: string | null | undefined): boolean {
  return (GUEST_RECIPIENT_TYPES as readonly string[]).includes(recipientType || '');
}

/** True when a message with this recipient type goes to this guest. */
export function guestRecipientMatches(recipientType: string | null | undefined, guestIsMember: boolean): boolean {
  if (recipientType === 'reservation_guest_member') return guestIsMember;
  if (recipientType === 'reservation_guest_nonmember') return !guestIsMember;
  return recipientType === 'reservation_guest';
}
