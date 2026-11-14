/**
 * Shared auth + error helpers for the reservation-guests API routes
 * (member portal, guest link, admin). Every route checks auth itself.
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { parse } from 'cookie';
import { randomBytes } from 'crypto';
import { DateTime } from 'luxon';
import { supabaseAdmin } from '@/lib/supabase';
import { resolveAdmin } from '@/lib/admin-auth';
import { last10 } from '@/lib/phone';
import { GuestServiceError } from '@/lib/reservationGuests';

export interface SessionMember {
  member_id: string;
  phone: string | null;
  email: string | null;
  first_name: string | null;
}

/** Member from the `member_session` cookie, or null. */
export async function getSessionMember(req: NextApiRequest): Promise<SessionMember | null> {
  const token = parse(req.headers.cookie || '').member_session;
  if (!token) return null;
  const { data: session } = await supabaseAdmin
    .from('member_portal_sessions')
    .select('member_id, members(member_id, phone, email, first_name)')
    .eq('session_token', token)
    .gte('expires_at', new Date().toISOString())
    .maybeSingle();
  if (!session) return null;
  const m = Array.isArray(session.members) ? session.members[0] : session.members;
  if (!m) return null;
  return {
    member_id: session.member_id,
    phone: (m as SessionMember).phone ?? null,
    email: (m as SessionMember).email ?? null,
    first_name: (m as SessionMember).first_name ?? null,
  };
}

export interface OwnableReservation {
  member_id: string | null;
  phone: string | null;
  email: string | null;
}

/**
 * Same rule the portal's reservation list uses: the reservation's member_id is
 * the member, or (older bookings with no member_id) its phone/email is theirs.
 */
export function memberOwnsReservation(member: SessionMember, r: OwnableReservation): boolean {
  if (r.member_id) return r.member_id === member.member_id;
  const p = last10(r.phone);
  if (p && p === last10(member.phone)) return true;
  if (r.email && member.email && r.email.trim().toLowerCase() === member.email.trim().toLowerCase()) return true;
  return false;
}

export async function loadOwnedReservation(member: SessionMember, reservationId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(reservationId)) return null;
  const { data } = await supabaseAdmin
    .from('reservations')
    .select('id, member_id, phone, email, status, start_time, end_time, party_size')
    .eq('id', reservationId)
    .maybeSingle();
  if (!data || !memberOwnsReservation(member, data)) return null;
  return data;
}

/** Admin identity (email for sent_by / followed_up_by), or null. */
export async function getAdmin(req: NextApiRequest): Promise<{ email: string } | null> {
  const token = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null;
  const admin = await resolveAdmin(token);
  if (!admin) return null;
  return { email: admin.user.email || admin.user.id };
}

export function sendGuestError(res: NextApiResponse, err: unknown) {
  if (err instanceof GuestServiceError) {
    return res.status(err.status).json({ error: err.message, code: err.code, rowErrors: err.rowErrors });
  }
  console.error('[reservation guests api]', err);
  return res.status(500).json({ error: 'Something went wrong. Please try again.' });
}

/** URL-safe, 32 random bytes (43 chars). */
export function newGuestLinkToken(): string {
  return randomBytes(32).toString('base64url');
}

export function isValidTokenShape(token: unknown): token is string {
  return typeof token === 'string' && /^[A-Za-z0-9_-]{43,128}$/.test(token);
}

export function tokenExpired(expiresAt: string | null | undefined, now = DateTime.utc()): boolean {
  if (!expiresAt) return true;
  const exp = DateTime.fromISO(expiresAt, { zone: 'utc' });
  return !exp.isValid || exp <= now;
}

let warnedMissingSiteUrl = false;

export function guestLinkUrl(token: string): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_BASE_URL || '';
  if (!base && !warnedMissingSiteUrl) {
    warnedMissingSiteUrl = true;
    console.warn('[guest link] NEXT_PUBLIC_SITE_URL is not set; guest links will be relative and unusable in texts');
  }
  return `${base.replace(/\/$/, '')}/r/${token}/guests`;
}

/** The guest self-register link: one guest adds themselves (token from guestJoinToken). */
export function guestJoinUrl(joinToken: string): string {
  return guestLinkUrl(joinToken).replace(/\/guests$/, '/join');
}

/** The reservation's add-to-calendar file (.ics), opened with the same join token. */
export function guestCalendarUrl(joinToken: string): string {
  return guestLinkUrl(joinToken).replace(/\/guests$/, '/cal.ics');
}
