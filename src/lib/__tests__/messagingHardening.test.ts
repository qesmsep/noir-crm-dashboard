/**
 * @jest-environment node
 */
/**
 * Messaging hardening:
 *  1. routes that read/write sent texts and campaign messages require an admin
 *     (or the internal secret);
 *  3. failed or interrupted "Send immediately" texts are retried, at most 3
 *     attempts in total, only within 2 hours.
 * (Fix 2 — guest link caps — is in reservation-guests-access.test.ts; fix 4 —
 * reminders for cancelled reservations — in cron-process-reminders-cancelled.test.ts.)
 */
import { DateTime } from 'luxon';
import { FakeDb } from '../../test-utils/fakeSupabase';

let db: FakeDb & { auth?: unknown };
const mockSend = jest.fn();
jest.mock('@/lib/supabase', () => ({
  get supabaseAdmin() {
    return db;
  },
  get supabase() {
    return db;
  },
}));
jest.mock('../supabase', () => ({
  get supabaseAdmin() {
    return db;
  },
  get supabase() {
    return db;
  },
}));
jest.mock('@/lib/sms', () => ({ sendSMS: (...a: unknown[]) => mockSend(...a) }));

import { requireAdmin } from '../admin-auth';
import {
  MAX_SEND_ATTEMPTS,
  retryImmediateReservationSends,
  sendReservationCreatedMessages,
} from '../reservationCampaigns';

function res() {
  const out: { code?: number; body?: unknown } = {};
  return {
    out,
    status(c: number) {
      out.code = c;
      return { json: (b: unknown) => ((out.body = b), undefined) };
    },
  };
}

describe('requireAdmin', () => {
  const saved = process.env.CRON_SECRET;
  beforeEach(() => {
    db = new FakeDb({ admins: [{ id: 'a1', auth_user_id: 'u-admin', status: 'active', access_level: 'admin' }] });
    db.auth = {
      getUser: async (token: string) =>
        token === 'good' ? { data: { user: { id: 'u-admin', email: 'staff@example.com' } }, error: null } : { data: { user: null }, error: { message: 'bad' } },
    };
    process.env.CRON_SECRET = 'cron-secret';
  });
  afterAll(() => {
    process.env.CRON_SECRET = saved;
  });

  it('refuses anonymous callers with 401', async () => {
    const r = res();
    expect(await requireAdmin({ headers: {} } as never, r)).toBe(false);
    expect(r.out.code).toBe(401);
  });
  it('refuses a bad token', async () => {
    const r = res();
    expect(await requireAdmin({ headers: { authorization: 'Bearer nope' } } as never, r)).toBe(false);
  });
  it('lets an active admin through', async () => {
    expect(await requireAdmin({ headers: { authorization: 'Bearer good' } } as never, res())).toBe(true);
  });
  it('lets the internal secret through, unless disallowed', async () => {
    expect(await requireAdmin({ headers: { 'x-internal-secret': 'cron-secret' } } as never, res())).toBe(true);
    expect(await requireAdmin({ headers: { 'x-internal-secret': 'cron-secret' } } as never, res(), { allowInternal: false })).toBe(false);
  });
});

describe('retryImmediateReservationSends', () => {
  const message = {
    id: 'msg-1',
    content: 'Hi {{first_name}}, confirmed.',
    recipient_type: 'member',
    specific_phone: null,
    timing_type: 'immediate',
    is_active: true,
    campaigns: { id: 'c1', trigger_type: 'reservation_created', is_active: true, applies_to_all_locations: true, campaign_locations: [] },
  };
  const reservation = {
    id: 'r-1',
    phone: '9135550101',
    first_name: 'Ava',
    last_name: null,
    email: null,
    party_size: 2,
    start_time: DateTime.utc().plus({ days: 3 }).toISO(),
    status: 'confirmed',
    member_id: null,
    location_id: 'loc',
  };
  beforeEach(() => {
    mockSend.mockReset();
    db = new FakeDb(
      { reservations: [reservation], campaign_messages: [message], locations: [{ id: 'loc', name: 'Noir KC', timezone: 'America/Chicago' }], scheduled_messages: [] },
      {
        unique: {
          scheduled_messages: [{ columns: ['campaign_message_id', 'reservation_id'], where: (r) => r.reservation_id != null && (r.status === 'pending' || r.status === 'sent') }],
        },
      },
    );
  });

  it('retries a failed confirmation and stops once it is sent', async () => {
    mockSend.mockResolvedValueOnce({ success: false, error: 'carrier timeout' }).mockResolvedValue({ success: true });
    await sendReservationCreatedMessages('r-1');
    expect((await retryImmediateReservationSends()).retried).toBe(1);
    expect((await retryImmediateReservationSends()).retried).toBe(0);
    expect(mockSend).toHaveBeenCalledTimes(2);
  });

  it(`gives up after ${MAX_SEND_ATTEMPTS} attempts`, async () => {
    mockSend.mockResolvedValue({ success: false, error: 'bad number' });
    await sendReservationCreatedMessages('r-1');
    for (let i = 0; i < 5; i++) await retryImmediateReservationSends();
    expect(mockSend).toHaveBeenCalledTimes(MAX_SEND_ATTEMPTS);
    expect(db.rows('scheduled_messages').filter((r) => r.status === 'failed')).toHaveLength(MAX_SEND_ATTEMPTS);
  });

  it('frees a claim left pending by a dead sender, then retries it', async () => {
    mockSend.mockResolvedValue({ success: true });
    db.rows('scheduled_messages').push({
      id: 'stale',
      campaign_message_id: 'msg-1',
      reservation_id: 'r-1',
      phone_number: '+19135550101',
      status: 'pending',
      sent_time: null,
      created_at: DateTime.utc().minus({ minutes: 15 }).toISO(),
    });
    const out = await retryImmediateReservationSends();
    expect(out.staleMarked).toBe(1);
    expect(out.retried).toBe(1);
    expect(db.rows('scheduled_messages').find((r) => r.id === 'stale')!.status).toBe('failed');
  });

  it('does not retry failures older than 2 hours', async () => {
    db.rows('scheduled_messages').push({ id: 'old', campaign_message_id: 'msg-1', reservation_id: 'r-1', status: 'failed', created_at: DateTime.utc().minus({ hours: 3 }).toISO() });
    expect((await retryImmediateReservationSends()).retried).toBe(0);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('a recent claim still in flight is left alone', async () => {
    db.rows('scheduled_messages').push({ id: 'fresh', campaign_message_id: 'msg-1', reservation_id: 'r-1', status: 'pending', sent_time: null, created_at: DateTime.utc().minus({ minutes: 2 }).toISO() });
    expect((await retryImmediateReservationSends()).staleMarked).toBe(0);
    expect(mockSend).not.toHaveBeenCalled();
  });
});
