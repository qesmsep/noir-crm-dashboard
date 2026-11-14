/**
 * @jest-environment node
 */
/**
 * The reservation reminder cron must not text cancelled or deleted
 * reservations: their pending reminders are marked cancelled instead.
 */
import { FakeDb } from '../../test-utils/fakeSupabase';

let db: FakeDb;
jest.mock('../../lib/supabase', () => ({
  get supabaseAdmin() {
    return db;
  },
  get supabase() {
    return db;
  },
}));

import handler from '../../pages/api/cron-process-reminders';

const past = new Date(Date.now() - 60_000).toISOString();
function reminder(id: string, reservationId: string) {
  return { id, reservation_id: reservationId, customer_phone: '9135550101', customer_name: 'Ava', message_content: 'See you tonight', scheduled_for: past, status: 'pending' };
}

beforeEach(() => {
  db = new FakeDb({
    scheduled_reservation_reminders: [reminder('rem-live', 'r-live'), reminder('rem-cancelled', 'r-cancelled'), reminder('rem-deleted', 'r-gone')],
    reservations: [
      { id: 'r-live', status: 'confirmed' },
      { id: 'r-cancelled', status: 'cancelled' },
    ],
  });
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { id: 'op-1' } }), text: async () => '' }) as never;
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

it('texts only live reservations and cancels the rest', async () => {
  const out: { code?: number; body?: any } = {};
  const res = {
    status(c: number) {
      out.code = c;
      return this;
    },
    json(b: unknown) {
      out.body = b;
      return this;
    },
    setHeader() {},
    end() {},
  };
  await handler({ method: 'GET', headers: { 'x-vercel-cron': '1' }, query: {} } as never, res as never);
  expect(global.fetch).toHaveBeenCalledTimes(1);
  const status = Object.fromEntries(db.rows('scheduled_reservation_reminders').map((r) => [r.id, r.status]));
  expect(status).toEqual({ 'rem-live': 'sent', 'rem-cancelled': 'cancelled', 'rem-deleted': 'cancelled' });
});
