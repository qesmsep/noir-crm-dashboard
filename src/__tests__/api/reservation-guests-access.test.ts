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
import guestJoinHandler from '../../pages/api/guest-join/[token]';
import { guestDisplayName, guestJoinToken, lookupCalendar, lookupGuestJoin, lookupGuestLink } from '../../lib/guestLink';
import { reservationIcs } from '../../lib/reservationIcs';
import { GET as calendarGet } from '../../app/r/[token]/cal.ics/route';
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
      locations: [{ id: 'loc', name: 'Noir KC', slug: 'noirkc', timezone: 'America/Chicago', address: '1234 Main St, Kansas City, MO', parking_instructions: 'Garage on 13th' }],
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

  it('valid token shows only location, date, time, host first name and guest names', async () => {
    const link = await lookupGuestLink(TOKEN);
    expect(link.ok).toBe(true);
    if (!link.ok) return;
    expect(Object.keys(link.summary).sort()).toEqual(['date', 'guests', 'host_first_name', 'join_path', 'location_name', 'location_slug', 'max_more', 'party_size', 'spots_left', 'time']);
    expect(link.summary).toMatchObject({ location_name: 'Noir KC', location_slug: 'noirkc', host_first_name: 'Tim', spots_left: 2 });
  });

  it('guest names are first name and last initial only', async () => {
    const link = await lookupGuestLink(TOKEN);
    if (!link.ok) throw new Error('link not ok');
    expect(link.summary.guests).toEqual(['Ava S.']);
    expect(guestDisplayName('Bo', null)).toBe('Bo');
    expect(guestDisplayName('Cy', ' lee')).toBe('Cy L.');
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

  it('API: caps total adds through one link (removed guests still count)', async () => {
    // party of 4 → 3 guests + 2 corrections = 5 adds through the link, ever
    db.rows('reservation_guests').push(
      ...[1, 2, 3, 4].map((i) => ({ id: `gl-${i}`, reservation_id: R_MINE, guest_contact_id: 'c1', status: 'removed', added_via: 'guest_link', created_at: '2026-01-02' })),
    );
    const ok = await call(guestLinkHandler, { method: 'POST', query: { token: TOKEN }, body: { guests: [{ first_name: 'Bo', phone: '9135550122' }] } });
    expect(ok.statusCode).toBe(201);
    const capped = await call(guestLinkHandler, { method: 'POST', query: { token: TOKEN }, body: { guests: [{ first_name: 'Cy', phone: '9135550123' }] } });
    expect(capped.statusCode).toBe(429);
    expect(capped.body.code).toBe('GUEST_LINK_CAP');
  });

  it('API: adds guests through a valid link', async () => {
    const res = await call(guestLinkHandler, { method: 'POST', query: { token: TOKEN }, body: { guests: [{ first_name: 'Bo', phone: '9135550122' }] } });
    expect(res.statusCode).toBe(201);
    expect(res.body.reservation.spots_left).toBe(1);
    expect(JSON.stringify(res.body)).not.toMatch(/555/);
    expect(db.rows('reservation_guests').find((g) => g.first_name_snapshot === 'Bo')?.added_via).toBe('guest_link');
  });
});

describe('guest self-register (join) link', () => {
  const JOIN = () => guestJoinToken(R_MINE, TOKEN)!;

  it('member link carries the join path; the join token is not the member token', async () => {
    const link = await lookupGuestLink(TOKEN);
    if (!link.ok) throw new Error('link not ok');
    expect(link.summary.join_path).toBe(`/r/${JOIN()}/join`);
    expect(JOIN()).toHaveLength(44);
    expect(JOIN()).not.toContain(TOKEN);
    expect(await lookupGuestLink(JOIN())).toEqual({ ok: false, reason: 'invalid' });
  });

  it('shows only location, date, time and host first name (no guest list)', async () => {
    const join = await lookupGuestJoin(JOIN());
    if (!join.ok) throw new Error('join not ok');
    expect(Object.keys(join.summary).sort()).toEqual(['date', 'host_first_name', 'location_name', 'location_slug', 'time']);
    const res = await call(guestJoinHandler, { method: 'GET', query: { token: JOIN() } });
    expect(res.statusCode).toBe(200);
    expect(JSON.stringify(res.body)).not.toMatch(/Ava|555|phone|member_id/);
  });

  it('refuses forged, member-token, rotated, expired and cancelled', async () => {
    const t = JOIN();
    const forged = t.slice(0, 22) + (t[22] === 'A' ? 'B' : 'A') + t.slice(23);
    expect(await lookupGuestJoin(forged)).toEqual({ ok: false, reason: 'invalid' });
    expect(await lookupGuestJoin(guestJoinToken(R_THEIRS, TOKEN))).toEqual({ ok: false, reason: 'invalid' });
    expect(await lookupGuestJoin(TOKEN)).toEqual({ ok: false, reason: 'invalid' });
    expect(await lookupGuestJoin(t, { now: future.plus({ hours: 3 }) })).toEqual({ ok: false, reason: 'expired' });
    db.rows('reservations')[0].guest_link_token = 'c'.repeat(43);
    expect(await lookupGuestJoin(t)).toEqual({ ok: false, reason: 'invalid' });
    db.rows('reservations')[0].guest_link_token = TOKEN;
    db.rows('reservations')[0].status = 'cancelled';
    expect(await lookupGuestJoin(t)).toEqual({ ok: false, reason: 'closed' });
  });

  it('API: a guest adds exactly themselves, via the guest link', async () => {
    const res = await call(guestJoinHandler, { method: 'POST', query: { token: JOIN() }, body: { first_name: 'Bo', phone: '9135550122', guests: [{ first_name: 'X', phone: '9135550199' }] } });
    expect(res.statusCode).toBe(201);
    expect(JSON.stringify(res.body)).not.toMatch(/555|Ava/);
    const added = db.rows('reservation_guests').filter((g) => g.reservation_id === R_MINE && g.status === 'active');
    expect(added.map((g) => g.first_name_snapshot).sort()).toEqual(['Ava', 'Bo']);
    expect(added.find((g) => g.first_name_snapshot === 'Bo')?.added_via).toBe('guest_link');
  });

  it('API: says "already on the list" in guest words', async () => {
    const res = await call(guestJoinHandler, { method: 'POST', query: { token: JOIN() }, body: { first_name: 'Ava', phone: '9135550111' } });
    expect(res.statusCode).toBe(400);
    expect(res.body.rowErrors[0].error).toBe("You're already on the list.");
  });

  it('API: shares the per-reservation add cap with the member link', async () => {
    db.rows('reservation_guests').push(
      ...[1, 2, 3, 4, 5].map((i) => ({ id: `gl-${i}`, reservation_id: R_MINE, guest_contact_id: 'c1', status: 'removed', added_via: 'guest_link', created_at: '2026-01-02' })),
    );
    const capped = await call(guestJoinHandler, { method: 'POST', query: { token: JOIN() }, body: { first_name: 'Cy', phone: '9135550123' } });
    expect(capped.statusCode).toBe(429);
    expect(capped.body.code).toBe('GUEST_LINK_CAP');
  });
});

describe('add-to-calendar link', () => {
  const JOIN = () => guestJoinToken(R_MINE, TOKEN)!;

  it('returns an .ics with location, times and party; no phones or guest names', async () => {
    const res = await calendarGet(new Request('http://x'), { params: Promise.resolve({ token: JOIN() }) });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/^text\/calendar/);
    const body = await res.text();
    expect(body).toMatch(/^BEGIN:VCALENDAR\r\n/);
    expect(body).toContain(`UID:${R_MINE}@noirkc.com`);
    expect(body).toContain('SUMMARY:Noir KC reservation');
    expect(body).toContain('LOCATION:Noir KC\\, 1234 Main St\\, Kansas City\\, MO');
    expect(body).toContain(`DTSTART:${future.toUTC().toFormat("yyyyMMdd'T'HHmmss'Z'")}`);
    expect(body).toContain(`DTEND:${future.plus({ hours: 2 }).toUTC().toFormat("yyyyMMdd'T'HHmmss'Z'")}`);
    expect(body).toContain('Party of 4\\, hosted by Tim.');
    expect(body).not.toMatch(/555|Ava|me@example|m-me/);
  });

  it('refuses the member token, forged, expired and cancelled with 404', async () => {
    const t = JOIN();
    expect(await lookupCalendar(TOKEN)).toEqual({ ok: false, reason: 'invalid' });
    expect(await lookupCalendar(t.slice(0, 22) + (t[22] === 'A' ? 'B' : 'A') + t.slice(23))).toEqual({ ok: false, reason: 'invalid' });
    expect(await lookupCalendar(t, { now: future.plus({ hours: 3 }) })).toEqual({ ok: false, reason: 'expired' });
    db.rows('reservations')[0].status = 'cancelled';
    const res = await calendarGet(new Request('http://x'), { params: Promise.resolve({ token: t }) });
    expect(res.status).toBe(404);
  });

  it('escapes text and folds long lines', () => {
    const ics = reservationIcs({
      reservationId: R_MINE,
      start: future.toISO()!,
      end: future.plus({ hours: 2 }).toISO()!,
      partySize: 2,
      hostFirstName: '',
      location: { name: 'Noir; OP', address: null, parkingInstructions: 'Lot A, then\nwalk '.repeat(10) },
    });
    expect(ics).toContain('SUMMARY:Noir\\; OP reservation');
    expect(ics.split('\r\n').every((l) => Buffer.byteLength(l) <= 75)).toBe(true);
    expect(ics).toContain('Party of 2.');
  });
});
