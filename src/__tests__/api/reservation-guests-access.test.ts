/**
 * @jest-environment node
 */
/**
 * Access rules for reservation guests:
 * - member API refuses another member's reservation (and anonymous callers)
 * - member API returns only first/last name and a masked phone
 * - guest link: invalid, expired and closed tokens are refused; a valid one
 *   exposes only location, date, time and host first name
 */
import { DateTime } from 'luxon';
import { FakeDb } from '../../test-utils/fakeSupabase';

let db: FakeDb;
jest.mock('@/lib/supabase', () => ({
  get supabaseAdmin() {
    return db;
  },
  get supabase() {
    return db;
  },
}));
jest.mock('@/lib/sms', () => ({ sendSMS: jest.fn().mockResolvedValue({ success: true }) }));
jest.mock('@/lib/admin-auth', () => ({ resolveAdmin: jest.fn().mockResolvedValue(null) }));

import guestsHandler from '../../pages/api/member/reservations/[id]/guests/index';
import guestLinkHandler from '../../pages/api/guest-link/[token]';
import { lookupGuestLink } from '../../lib/guestLink';
import { memberOwnsReservation, tokenExpired, newGuestLinkToken } from '../../lib/guestApi';

const R_MINE = '11111111-1111-4111-8111-111111111111';
const R_THEIRS = '22222222-2222-4222-8222-222222222222';
const R_OLD_MINE = '33333333-3333-4333-8333-333333333333';
const TOKEN = 'a'.repeat(43);
const future = DateTime.utc().plus({ days: 3 });

function seed() {
  db = new FakeDb(
    {
      member_portal_sessions: [
        { id: 's1', session_token: 'sess-me', member_id: 'm-me', expires_at: DateTime.utc().plus({ days: 1 }).toISO() },
        { id: 's2', session_token: 'sess-old', member_id: 'm-me', expires_at: DateTime.utc().minus({ days: 1 }).toISO() },
      ],
      members: [
        { member_id: 'm-me', phone: '(913) 555-0100', email: 'me@example.com', first_name: 'Tim', status: 'active' },
        { member_id: 'm-them', phone: '913-555-0200', email: 'them@example.com', first_name: 'Sam', status: 'active' },
      ],
      reservations: [
        { id: R_MINE, member_id: 'm-me', phone: '+19135550100', email: null, status: 'confirmed', start_time: future.toISO(), end_time: future.plus({ hours: 2 }).toISO(), party_size: 4, first_name: 'Tim', location_id: 'loc', guest_link_token: TOKEN, guest_link_expires_at: future.plus({ hours: 2 }).toISO() },
        { id: R_THEIRS, member_id: 'm-them', phone: '+19135550200', email: null, status: 'confirmed', start_time: future.toISO(), end_time: future.plus({ hours: 2 }).toISO(), party_size: 4, first_name: 'Sam', location_id: 'loc' },
        { id: R_OLD_MINE, member_id: null, phone: '9135550100', email: null, status: 'confirmed', start_time: future.toISO(), end_time: future.plus({ hours: 2 }).toISO(), party_size: 2, first_name: 'Tim', location_id: 'loc' },
      ],
      locations: [{ id: 'loc', name: 'Noir KC', timezone: 'America/Chicago' }],
      guest_contacts: [{ id: 'c1', phone: '+19135550111', first_name: 'Ava', last_name: 'Stone', sms_opted_out_at: null }],
      reservation_guests: [{ id: 'g1', reservation_id: R_MINE, guest_contact_id: 'c1', status: 'active', first_name_snapshot: 'Ava', added_via: 'portal', created_at: '2026-01-01' }],
      guest_message_templates: [],
      scheduled_guest_messages: [],
    },
    {
      relations: {
        member_portal_sessions: { members: { table: 'members', fk: 'member_id', pk: 'member_id' } },
        reservation_guests: { guest_contacts: { table: 'guest_contacts', fk: 'guest_contact_id' } },
      },
    },
  );
}

function call(handler: (req: never, res: never) => unknown, req: Record<string, unknown>) {
  const out: { statusCode?: number; body?: any } = {};
  const res = {
    status(c: number) {
      out.statusCode = c;
      return this;
    },
    json(b: unknown) {
      out.body = b;
      return this;
    },
    setHeader() {},
  };
  return Promise.resolve(handler({ headers: {}, query: {}, socket: {}, ...req } as never, res as never)).then(() => out);
}

beforeEach(seed);

describe('member guests API', () => {
  it('requires a member session', async () => {
    expect((await call(guestsHandler, { method: 'GET', query: { id: R_MINE } })).statusCode).toBe(401);
    expect((await call(guestsHandler, { method: 'GET', query: { id: R_MINE }, headers: { cookie: 'member_session=sess-old' } })).statusCode).toBe(401);
  });

  it("refuses another member's reservation", async () => {
    const res = await call(guestsHandler, { method: 'GET', query: { id: R_THEIRS }, headers: { cookie: 'member_session=sess-me' } });
    expect(res.statusCode).toBe(404);
    const post = await call(guestsHandler, {
      method: 'POST',
      query: { id: R_THEIRS },
      headers: { cookie: 'member_session=sess-me' },
      body: { guests: [{ first_name: 'X', phone: '9135550123' }] },
    });
    expect(post.statusCode).toBe(404);
    expect(db.rows('reservation_guests')).toHaveLength(1);
  });

  it('returns only names and a masked phone for own reservation', async () => {
    const res = await call(guestsHandler, { method: 'GET', query: { id: R_MINE }, headers: { cookie: 'member_session=sess-me' } });
    expect(res.statusCode).toBe(200);
    expect(res.body.guests).toEqual([{ id: 'g1', first_name: 'Ava', last_name: 'Stone', phone_masked: '•••-0111' }]);
    expect(JSON.stringify(res.body)).not.toContain('5550111');
  });

  it('allows older bookings without member_id when the phone is theirs', async () => {
    const res = await call(guestsHandler, { method: 'GET', query: { id: R_OLD_MINE }, headers: { cookie: 'member_session=sess-me' } });
    expect(res.statusCode).toBe(200);
  });
});

describe('ownership rule', () => {
  const me = { member_id: 'm-me', phone: '+1 913 555 0100', email: 'Me@Example.com', first_name: 'Tim' };
  it('member_id wins when set', () => {
    expect(memberOwnsReservation(me, { member_id: 'm-them', phone: '9135550100', email: null })).toBe(false);
    expect(memberOwnsReservation(me, { member_id: 'm-me', phone: null, email: null })).toBe(true);
  });
  it('falls back to phone (last 10) or email', () => {
    expect(memberOwnsReservation(me, { member_id: null, phone: '(913) 555-0100', email: null })).toBe(true);
    expect(memberOwnsReservation(me, { member_id: null, phone: null, email: 'me@example.com' })).toBe(true);
    expect(memberOwnsReservation(me, { member_id: null, phone: '9135550999', email: null })).toBe(false);
  });
});

describe('guest link tokens', () => {
  it('tokens are 32 random bytes, URL-safe', () => {
    const t = newGuestLinkToken();
    expect(t).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(newGuestLinkToken()).not.toBe(t);
  });

  it('expiry', () => {
    expect(tokenExpired(null)).toBe(true);
    expect(tokenExpired(DateTime.utc().minus({ minutes: 1 }).toISO())).toBe(true);
    expect(tokenExpired(DateTime.utc().plus({ minutes: 1 }).toISO())).toBe(false);
  });

  it('valid token shows only location, date, time, host first name', async () => {
    const link = await lookupGuestLink(TOKEN);
    expect(link.ok).toBe(true);
    if (!link.ok) return;
    expect(Object.keys(link.summary).sort()).toEqual(['date', 'host_first_name', 'location_name', 'spots_left', 'time']);
    expect(link.summary).toMatchObject({ location_name: 'Noir KC', host_first_name: 'Tim', spots_left: 2 });
  });

  it('refuses malformed, unknown, expired and cancelled', async () => {
    expect(await lookupGuestLink('short')).toEqual({ ok: false, reason: 'invalid' });
    expect(await lookupGuestLink('b'.repeat(43))).toEqual({ ok: false, reason: 'invalid' });
    expect(await lookupGuestLink(TOKEN, { now: future.plus({ hours: 3 }) })).toEqual({ ok: false, reason: 'expired' });
    db.rows('reservations')[0].status = 'cancelled';
    expect(await lookupGuestLink(TOKEN)).toEqual({ ok: false, reason: 'closed' });
  });

  it('API: expired link is 410 and never exposes phones', async () => {
    db.rows('reservations')[0].guest_link_expires_at = DateTime.utc().minus({ minutes: 1 }).toISO();
    expect((await call(guestLinkHandler, { method: 'GET', query: { token: TOKEN } })).statusCode).toBe(410);
    db.rows('reservations')[0].guest_link_expires_at = future.plus({ hours: 2 }).toISO();
    const ok = await call(guestLinkHandler, { method: 'GET', query: { token: TOKEN } });
    expect(ok.statusCode).toBe(200);
    expect(JSON.stringify(ok.body)).not.toMatch(/555|phone|member_id/);
  });

  it('API: adds guests through a valid link', async () => {
    const res = await call(guestLinkHandler, { method: 'POST', query: { token: TOKEN }, body: { guests: [{ first_name: 'Bo', phone: '9135550122' }] } });
    expect(res.statusCode).toBe(201);
    expect(res.body.reservation.spots_left).toBe(1);
    expect(JSON.stringify(res.body)).not.toMatch(/555/);
    expect(db.rows('reservation_guests').find((g) => g.first_name_snapshot === 'Bo')?.added_via).toBe('guest_link');
  });
});
