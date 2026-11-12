/**
 * @jest-environment node
 */
/**
 * The campaign cron's reservation_created path: immediate messages are left
 * to the booking route, minute offsets count from the booking (not snapped to
 * a clock time), cancelled bookings are skipped, and a reservation already
 * sent inline is not sent again.
 */
import { Settings } from 'luxon';
import { FakeDb } from '../../test-utils/fakeSupabase';

const mockSend = jest.fn();
let db: FakeDb;

jest.mock('@/lib/supabase', () => ({
  get supabaseAdmin() {
    return db;
  },
  get supabase() {
    return db;
  },
}));
jest.mock('@/lib/sms', () => ({ sendSMS: (...args: unknown[]) => mockSend(...args) }));

import handler from '../../pages/api/process-campaign-messages';

const NOIR = '796ddc86-8054-4e45-9eba-7fb65ae30088';
const campaign = {
  id: 'camp-1',
  name: 'Reservation confirmation',
  trigger_type: 'reservation_created',
  is_active: true,
  applies_to_all_locations: false,
  selected_private_event_id: null,
  campaign_locations: [{ location_id: NOIR, location: { id: NOIR, name: 'Noir KC', slug: 'noirkc' } }],
};

function msg(id: string, extra: Record<string, unknown>) {
  return {
    id,
    name: id,
    content: 'Hi {{first_name}}, {{reservation_date}} {{reservation_time}} at {{location_name}}',
    recipient_type: 'member',
    specific_phone: null,
    is_active: true,
    include_ledger_pdf: false,
    campaigns: campaign,
    ...extra,
  };
}

function res(id: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    phone: '9135550101',
    first_name: 'Ava',
    last_name: 'Stone',
    email: null,
    party_size: 2,
    start_time: '2026-11-20T02:00:00.000Z',
    end_time: '2026-11-20T04:00:00.000Z',
    created_at: '2026-11-12T18:00:00.000Z',
    status: 'confirmed',
    member_id: null,
    location_id: NOIR,
    ...extra,
  };
}

async function run() {
  const out: { statusCode?: number; body?: unknown } = {};
  const resObj = {
    status(c: number) {
      out.statusCode = c;
      return this;
    },
    json(b: unknown) {
      out.body = b;
      return this;
    },
    setHeader() {},
    end() {},
  };
  await handler({ method: 'GET', headers: { 'x-vercel-cron': '1' }, query: {} } as never, resObj as never);
  return out;
}

beforeAll(() => {
  Settings.defaultZone = 'utc';
  jest.spyOn(console, 'log').mockImplementation(() => {});
});
afterAll(() => {
  Settings.defaultZone = 'system';
  jest.useRealTimers();
});
beforeEach(() => {
  mockSend.mockReset().mockResolvedValue({ success: true });
  global.fetch = jest.fn() as never; // no raw OpenPhone calls on this path
});

function seed(messages: Record<string, unknown>[], reservations: Record<string, unknown>[], scheduled: Record<string, unknown>[] = []) {
  db = new FakeDb(
    {
      campaign_messages: messages,
      reservations,
      locations: [{ id: NOIR, name: 'Noir KC', timezone: 'America/Chicago' }],
      scheduled_messages: scheduled,
    },
    {
      unique: {
        scheduled_messages: [
          {
            columns: ['campaign_message_id', 'reservation_id'],
            where: (r) => r.reservation_id != null && (r.status === 'pending' || r.status === 'sent'),
          },
        ],
      },
    },
  );
}

describe('process-campaign-messages: reservation_created', () => {
  it('sends a "15 minutes after" message 15 minutes after booking, not at 10:00', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-12T18:15:00.000Z'));
    seed([msg('m-15', { timing_type: 'relative', relative_quantity: 15, relative_unit: 'minute', relative_proximity: 'after', relative_time: '10:00' })], [res('r-1')]);
    await run();
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend.mock.calls[0][0]).toEqual({ to: '+19135550101', content: 'Hi Ava, November 19, 2026 8:00 PM at Noir KC' });
    expect(db.rows('scheduled_messages')[0]).toMatchObject({ reservation_id: 'r-1', status: 'sent', scheduled_time: '2026-11-12T12:15:00.000-06:00' });
  });

  it('does not send a minute-offset message early', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-12T18:02:00.000Z'));
    seed([msg('m-15', { timing_type: 'relative', relative_quantity: 15, relative_unit: 'minute', relative_proximity: 'after' })], [res('r-1')]);
    await run();
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('leaves "Send immediately" messages to the booking route', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-12T18:00:30.000Z'));
    seed([msg('m-now', { timing_type: 'immediate' })], [res('r-1')]);
    await run();
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('skips cancelled reservations', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-12T18:15:00.000Z'));
    seed([msg('m-15', { timing_type: 'relative', relative_quantity: 15, relative_unit: 'minute', relative_proximity: 'after' })], [res('r-1', { status: 'cancelled' })]);
    await run();
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('splits members from non-members', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-12T18:15:00.000Z'));
    const timing = { timing_type: 'relative', relative_quantity: 15, relative_unit: 'minute', relative_proximity: 'after' };
    seed(
      [msg('m-members', { ...timing, recipient_type: 'member_only' })],
      [res('r-member', { member_id: 'mem-1', phone: '9135550199' }), res('r-guest')],
    );
    await run();
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend.mock.calls[0][0].to).toBe('+19135550199');
  });

  it('does not resend a reservation already sent, but sends a second booking by the same phone', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-12T18:15:00.000Z'));
    seed(
      [msg('m-15', { timing_type: 'relative', relative_quantity: 15, relative_unit: 'minute', relative_proximity: 'after' })],
      [res('r-1'), res('r-2')],
      [{ id: 'sm-1', campaign_message_id: 'm-15', reservation_id: 'r-1', phone_number: '+19135550101', status: 'sent' }],
    );
    await run();
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(db.rows('scheduled_messages').filter((r) => r.reservation_id === 'r-2')).toHaveLength(1);
  });
});
