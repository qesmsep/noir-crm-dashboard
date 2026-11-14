/**
 * @jest-environment node
 */
/**
 * Reservation confirmation via Campaigns: "Send immediately" reservation_created
 * messages go out at booking, members vs non-members get their own message,
 * one send per reservation, cancelled bookings get nothing, and the cron does
 * not resend what the booking already sent.
 */
import { DateTime } from 'luxon';
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

import {
  claimReservationSend,
  missingRequiredLink,
  renderReservationMessage,
  reservationMatchesRecipientType,
  sendReservationCreatedMessages,
} from '../reservationCampaigns';

const NOIR = '796ddc86-8054-4e45-9eba-7fb65ae30088';
const ROOF = 'ebcff7e8-edbf-4134-90dc-f58cf9fba486';

function campaign(overrides: Record<string, unknown> = {}) {
  return {
    id: 'camp-1',
    name: 'Reservation confirmation',
    trigger_type: 'reservation_created',
    is_active: true,
    applies_to_all_locations: false,
    campaign_locations: [{ location_id: NOIR }],
    ...overrides,
  };
}

function message(id: string, recipient_type: string, content: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    campaign_id: 'camp-1',
    name: id,
    content,
    recipient_type,
    specific_phone: null,
    timing_type: 'immediate',
    is_active: true,
    campaigns: campaign(),
    ...extra,
  };
}

function reservation(id: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    phone: '(913) 555-0101',
    first_name: 'Ava',
    last_name: 'Stone',
    email: null,
    party_size: 4,
    start_time: '2026-11-20T02:00:00.000Z', // 8:00 PM Central on Nov 19
    end_time: '2026-11-20T04:00:00.000Z',
    created_at: '2026-11-12T18:00:00.000Z',
    status: 'confirmed',
    member_id: null,
    location_id: NOIR,
    ...extra,
  };
}

const UNIQUE = {
  scheduled_messages: [
    {
      columns: ['campaign_message_id', 'reservation_id'],
      where: (r: Record<string, unknown>) => r.reservation_id != null && (r.status === 'pending' || r.status === 'sent'),
    },
  ],
};

function seed(reservations: Record<string, unknown>[], messages: Record<string, unknown>[], opts = {}) {
  db = new FakeDb(
    {
      reservations,
      campaign_messages: messages,
      locations: [
        { id: NOIR, name: 'Noir KC', timezone: 'America/Chicago' },
        { id: ROOF, name: 'RooftopKC', timezone: 'America/Chicago' },
      ],
      members: [{ member_id: 'm-1', first_name: 'Mia' }],
      scheduled_messages: [],
    },
    { unique: UNIQUE, ...opts },
  );
}

const MEMBER_MSG = message('msg-members', 'member_only', 'Hi {{first_name}}, see you {{reservation_date}} at {{reservation_time}} at {{location_name}} (party of {{party_size}}). Bringing guests? Reply with their name and cell.');
const NONMEMBER_MSG = message('msg-nonmembers', 'guest_only', 'Hi {{first_name}}! Your reservation for {{party_size}} on {{reservation_date}} at {{reservation_time}} at {{location_name}} is confirmed.');

beforeEach(() => {
  mockSend.mockReset().mockResolvedValue({ success: true, messageId: 'op-1' });
});

describe('sendReservationCreatedMessages', () => {
  it('sends the members message, rendered in the venue timezone, for a member booking', async () => {
    seed([reservation('r-1', { member_id: 'm-1' })], [MEMBER_MSG, NONMEMBER_MSG]);
    const result = await sendReservationCreatedMessages('r-1');
    expect(result.sent).toBe(1);
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend).toHaveBeenCalledWith({
      to: '+19135550101',
      content: 'Hi Ava, see you November 19, 2026 at 8:00 PM at Noir KC (party of 4). Bringing guests? Reply with their name and cell.',
    });
    const rows = db.rows('scheduled_messages');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ campaign_message_id: 'msg-members', reservation_id: 'r-1', status: 'sent', member_id: 'm-1' });
  });

  it('sends the non-member message for a booking without a member', async () => {
    seed([reservation('r-2')], [MEMBER_MSG, NONMEMBER_MSG]);
    await sendReservationCreatedMessages('r-2');
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend.mock.calls[0][0].content).toMatch(/^Hi Ava! Your reservation for 4/);
  });

  it('"Phone number on the reservation" (member) goes to every booking', async () => {
    seed([reservation('r-3', { member_id: 'm-1' })], [message('msg-all', 'member', 'Confirmed {{first_name}}')]);
    await sendReservationCreatedMessages('r-3');
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it('sends once per reservation, however often it is called', async () => {
    seed([reservation('r-4')], [NONMEMBER_MSG]);
    await sendReservationCreatedMessages('r-4');
    const second = await sendReservationCreatedMessages('r-4');
    expect(second.sent).toBe(0);
    expect(second.skipped).toBe(1);
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it('a second reservation by the same phone still gets its own confirmation', async () => {
    seed([reservation('r-5'), reservation('r-6', { start_time: '2026-11-27T02:00:00.000Z' })], [NONMEMBER_MSG]);
    await sendReservationCreatedMessages('r-5');
    await sendReservationCreatedMessages('r-6');
    expect(mockSend).toHaveBeenCalledTimes(2);
    expect(mockSend.mock.calls[1][0].content).toContain('November 26, 2026');
  });

  it('skips cancelled reservations', async () => {
    seed([reservation('r-7', { status: 'cancelled' })], [NONMEMBER_MSG]);
    const result = await sendReservationCreatedMessages('r-7');
    expect(result.reason).toBe('cancelled');
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('sends nothing (and does not throw) when no active immediate message matches', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    seed([reservation('r-8')], [message('msg-delayed', 'guest_only', 'x', { timing_type: 'relative' })]);
    const result = await sendReservationCreatedMessages('r-8');
    expect(result.reason).toBe('no_matching_message');
    expect(mockSend).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('respects campaign on/off and location', async () => {
    seed(
      [reservation('r-9'), reservation('r-10', { location_id: ROOF })],
      [message('msg-off', 'guest_only', 'x', { campaigns: campaign({ is_active: false }) }), NONMEMBER_MSG],
    );
    await sendReservationCreatedMessages('r-9');
    expect(mockSend).toHaveBeenCalledTimes(1); // only the active campaign's message
    await sendReservationCreatedMessages('r-10');
    expect(mockSend).toHaveBeenCalledTimes(1); // Rooftop isn't in the campaign's locations
  });

  it('a failed send is recorded and frees the slot for a retry', async () => {
    seed([reservation('r-11')], [NONMEMBER_MSG]);
    mockSend.mockResolvedValueOnce({ success: false, error: 'carrier said no' });
    const first = await sendReservationCreatedMessages('r-11');
    expect(first.failed).toBe(1);
    expect(db.rows('scheduled_messages')[0]).toMatchObject({ status: 'failed', error_message: 'carrier said no' });
    const retry = await sendReservationCreatedMessages('r-11');
    expect(retry.sent).toBe(1);
  });

  it('never throws when the database errors', async () => {
    seed([], []);
    db.from = () => {
      throw new Error('boom');
    };
    const err = jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(sendReservationCreatedMessages('r-x')).resolves.toMatchObject({ reason: 'error' });
    err.mockRestore();
  });

  it('still sends before the reservation_id migration is applied', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    seed([reservation('r-12')], [NONMEMBER_MSG], { missingColumns: { scheduled_messages: ['reservation_id'] } });
    const result = await sendReservationCreatedMessages('r-12');
    expect(result.sent).toBe(1);
    expect(db.rows('scheduled_messages')[0]).toMatchObject({ status: 'sent', campaign_message_id: 'msg-nonmembers' });
    warn.mockRestore();
  });
});

describe('{{guest_link}} in the confirmation', () => {
  const saved = process.env.NEXT_PUBLIC_SITE_URL;
  beforeAll(() => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://noir.example';
  });
  afterAll(() => {
    if (saved === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = saved;
  });

  it("puts the reservation's own add-guests link in the text, reusing it after", async () => {
    seed(
      [reservation('r-gl', { member_id: 'm-1' })],
      [
        message('msg-gl', 'member_only', 'Confirmed! Add your guests: {{guest_link}}'),
        message('msg-gl2', 'member_only', 'Again: {{guest_link}}'),
      ],
    );
    await sendReservationCreatedMessages('r-gl');
    const token = db.rows('reservations')[0].guest_link_token;
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(mockSend.mock.calls[0][0].content).toBe(`Confirmed! Add your guests: https://noir.example/r/${token}/guests`);
    expect(mockSend.mock.calls[1][0].content).toBe(`Again: https://noir.example/r/${token}/guests`);
  });

  it('never sends a {{guest_link}} message without the link; records a failure for retry', async () => {
    const err = jest.spyOn(console, 'error').mockImplementation(() => {});
    seed(
      [reservation('r-nolink', { member_id: 'm-1' })],
      [message('msg-gl', 'member_only', 'Add your guests: {{guest_link}}')],
      { missingColumns: { reservations: ['guest_link_token'] } },
    );
    const result = await sendReservationCreatedMessages('r-nolink');
    expect(result.failed).toBe(1);
    expect(mockSend).not.toHaveBeenCalled();
    expect(db.rows('scheduled_messages')[0]).toMatchObject({ status: 'failed', error_message: 'guest link unavailable' });
    err.mockRestore();
  });

  it('{{guest_join_link}}: the link the booker shares so each guest adds themselves', async () => {
    const id = '7d3c6c2e-5b1a-4f7e-9d43-2a8b1c0e9f11';
    seed([reservation(id, { member_id: 'm-1' })], [message('msg-join', 'member_only', 'Share this with your guests: {{guest_join_link}}')]);
    await sendReservationCreatedMessages(id);
    const token = db.rows('reservations')[0].guest_link_token;
    const { guestJoinToken } = await import('../guestLink');
    expect(mockSend.mock.calls[0][0].content).toBe(`Share this with your guests: https://noir.example/r/${guestJoinToken(id, token)}/join`);
  });

  it('messages without the token never create a link', async () => {
    seed([reservation('r-plain')], [NONMEMBER_MSG]);
    await sendReservationCreatedMessages('r-plain');
    expect(db.rows('reservations')[0].guest_link_token).toBeUndefined();
  });
});

describe('the cron cannot resend what the booking sent', () => {
  it('claimReservationSend reports a duplicate after the inline send', async () => {
    seed([reservation('r-20')], [NONMEMBER_MSG]);
    await sendReservationCreatedMessages('r-20');
    const claim = await claimReservationSend(db as never, {
      campaignMessageId: 'msg-nonmembers',
      reservationId: 'r-20',
      memberId: null,
      phone: '+19135550101',
      content: 'again',
      scheduledTime: DateTime.now().toISO()!,
    });
    expect(claim.kind).toBe('duplicate');
  });
});

describe('helpers', () => {
  it('recipient split', () => {
    expect(reservationMatchesRecipientType('member_only', { member_id: 'm' })).toBe(true);
    expect(reservationMatchesRecipientType('member_only', { member_id: null })).toBe(false);
    expect(reservationMatchesRecipientType('guest_only', { member_id: null })).toBe(true);
    expect(reservationMatchesRecipientType('guest_only', { member_id: 'm' })).toBe(false);
    expect(reservationMatchesRecipientType('member', { member_id: null })).toBe(true);
  });

  it('renders across DST in the location timezone', () => {
    const text = renderReservationMessage(
      '{{reservation_date}} {{reservation_time}}',
      { first_name: null, last_name: null, email: null, phone: null, party_size: 2, start_time: '2026-07-04T01:30:00Z' },
      { name: 'Noir KC', timezone: 'America/Chicago' },
    );
    expect(text).toBe('July 3, 2026 8:30 PM');
  });
});

describe('missingRequiredLink', () => {
  const both = { guestLink: 'https://x/r/a/guests', guestJoinLink: 'https://x/r/b/join' };
  it('is false when no link placeholder is used', () => {
    expect(missingRequiredLink('See you soon', { guestLink: '', guestJoinLink: '' })).toBe(false);
  });
  it('is true when the guest link is missing', () => {
    expect(missingRequiredLink('Add guests: {{guest_link}}', { guestLink: '', guestJoinLink: '' })).toBe(true);
  });
  it('is true when only the join link is missing and it is used', () => {
    expect(missingRequiredLink('Share: {{guest_join_link}}', { ...both, guestJoinLink: '' })).toBe(true);
    expect(missingRequiredLink('Add guests: {{guest_link}}', { ...both, guestJoinLink: '' })).toBe(false);
  });
  it('is false when every used link exists', () => {
    expect(missingRequiredLink('{{guest_link}} {{guest_join_link}}', both)).toBe(false);
  });
});
