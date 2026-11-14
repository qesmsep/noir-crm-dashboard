/**
 * @jest-environment node
 */
/**
 * Campaign trigger "Guest Registration": delayed follow-ups timed from
 * when the guest was added, once per guest, stop only on STOP, keep going
 * after the visit, skip cancelled reservations and removed guests. Plus the
 * staff "Text link to member" message.
 */
import { DateTime } from 'luxon';
import { FakeDb } from '../../test-utils/fakeSupabase';

let db: FakeDb;
const mockSend = jest.fn();
jest.mock('@/lib/supabase', () => ({
  get supabaseAdmin() {
    return db;
  },
}));
jest.mock('@/lib/sms', () => ({ sendSMS: (...a: unknown[]) => mockSend(...a) }));

import {
  guestAddedSendTime,
  lookbackMinutes,
  processGuestAddedCampaignMessage,
  type GuestCampaignMessage,
} from '../guestCampaigns';
import { textGuestLinkToMember } from '../memberGuestLink';

const LOC = 'loc-noir';
const ADDED = '2026-11-12T18:00:00.000Z'; // 12:00 PM Central
const campaign = { id: 'camp-g', trigger_type: 'guest_registration', is_active: true, applies_to_all_locations: false, campaign_locations: [{ location_id: LOC }] };

function msg(extra: Partial<GuestCampaignMessage>): GuestCampaignMessage {
  return {
    id: 'msg-follow',
    content: 'Hi {{guest_first_name}}, any questions before {{reservation_date}}? Reply STOP to opt out.',
    recipient_type: 'reservation_guest',
    timing_type: 'relative',
    relative_quantity: 1,
    relative_unit: 'day',
    relative_proximity: 'after',
    relative_time: '10:00',
    campaigns: campaign,
    ...extra,
  } as GuestCampaignMessage;
}

function seed(guestExtra: Record<string, unknown> = {}, reservationExtra: Record<string, unknown> = {}) {
  db = new FakeDb(
    {
      reservations: [
        { id: 'r-1', status: 'confirmed', start_time: '2026-11-20T02:00:00.000Z', end_time: '2026-11-20T04:00:00.000Z', party_size: 3, first_name: 'Tim', member_id: 'm-host', account_id: 'a-host', phone: '+19135550100', location_id: LOC, ...reservationExtra },
      ],
      locations: [{ id: LOC, name: 'Noir KC', timezone: 'America/Chicago', guest_arrival_instructions: null }],
      members: [{ member_id: 'm-host', first_name: 'Tim', phone: '9135550100', status: 'active' }],
      guest_contacts: [{ id: 'c-1', phone: '+19135550101', first_name: 'Ava', last_name: null, sms_opted_out_at: null }],
      reservation_guests: [
        { id: 'g-1', reservation_id: 'r-1', guest_contact_id: 'c-1', location_id: LOC, status: 'active', first_name_snapshot: 'Ava', matched_member_id: null, notified_at: ADDED, created_at: ADDED, ...guestExtra },
      ],
      campaign_messages: [
        {
          id: 'msg-link',
          content: 'Hi {{first_name}}, add guests for {{reservation_date}} at {{reservation_time}}: {{guest_link}}',
          is_active: true,
          created_at: '2026-11-01T00:00:00Z',
          campaigns: { is_active: true, trigger_type: 'member_guest_link', applies_to_all_locations: true, campaign_locations: [] },
        },
      ],
      scheduled_messages: [],
      guest_messages: [],
    },
    {
      relations: { reservation_guests: { guest_contacts: { table: 'guest_contacts', fk: 'guest_contact_id' } } },
      unique: {
        scheduled_messages: [{ columns: ['campaign_message_id', 'reservation_guest_id'], where: (r) => r.reservation_guest_id != null && (r.status === 'pending' || r.status === 'sent') }],
      },
    },
  );
}

const at = (iso: string) => ({ now: () => DateTime.fromISO(iso, { zone: 'utc' }) });

beforeEach(() => {
  mockSend.mockReset().mockResolvedValue({ success: true, messageId: 'op-1' });
  seed();
});

describe('timing', () => {
  const added = DateTime.fromISO(ADDED, { zone: 'utc' });
  it('"1 day after at 10:00" lands at 10:00 venue time the next day', () => {
    expect(guestAddedSendTime(msg({}), added, 'America/Chicago')!.toUTC().toISO()).toBe('2026-11-13T16:00:00.000Z');
  });
  it('"30 minutes after" counts from when the guest was added', () => {
    expect(guestAddedSendTime(msg({ relative_quantity: 30, relative_unit: 'minute' }), added, 'America/Chicago')!.toUTC().toISO()).toBe('2026-11-12T18:30:00.000Z');
  });
  it('lookback covers the offset', () => {
    expect(lookbackMinutes(msg({ relative_quantity: 3, relative_unit: 'day' }))).toBeGreaterThan(3 * 1440);
  });
});

describe('processGuestAddedCampaignMessage', () => {
  it('sends the follow-up when due, once', async () => {
    const m = msg({});
    expect(await processGuestAddedCampaignMessage(m, at('2026-11-13T15:50:00Z'))).toBe(0); // not yet
    expect(await processGuestAddedCampaignMessage(m, at('2026-11-13T16:01:00Z'))).toBe(1);
    expect(await processGuestAddedCampaignMessage(m, at('2026-11-13T16:02:00Z'))).toBe(0);
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend.mock.calls[0][0]).toEqual({ to: '+19135550101', content: 'Hi Ava, any questions before Thursday, November 19? Reply STOP to opt out.' });
    expect(db.rows('guest_messages')[0]).toMatchObject({ sent_by: 'system:campaign', reservation_id: 'r-1' });
  });

  it('stops only on STOP: an opted-out guest gets nothing', async () => {
    seed({}, {});
    db.rows('guest_contacts')[0].sms_opted_out_at = '2026-11-12T19:00:00Z';
    expect(await processGuestAddedCampaignMessage(msg({}), at('2026-11-13T16:01:00Z'))).toBe(0);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('keeps going after the visit (post-visit follow-up)', async () => {
    const m = msg({ relative_quantity: 10, relative_unit: 'day' });
    expect(await processGuestAddedCampaignMessage(m, at('2026-11-22T16:01:00Z'))).toBe(1);
  });

  it('skips cancelled reservations and removed guests', async () => {
    seed({}, { status: 'cancelled' });
    expect(await processGuestAddedCampaignMessage(msg({}), at('2026-11-13T16:01:00Z'))).toBe(0);
    seed({ status: 'removed' });
    expect(await processGuestAddedCampaignMessage(msg({}), at('2026-11-13T16:01:00Z'))).toBe(0);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('respects campaign locations and on/off', async () => {
    expect(await processGuestAddedCampaignMessage(msg({ campaigns: { ...campaign, campaign_locations: [{ location_id: 'other' }] } }), at('2026-11-13T16:01:00Z'))).toBe(0);
    expect(await processGuestAddedCampaignMessage(msg({ campaigns: { ...campaign, is_active: false } }), at('2026-11-13T16:01:00Z'))).toBe(0);
  });

  it('immediate messages are left to the add-guest path', async () => {
    expect(await processGuestAddedCampaignMessage(msg({ timing_type: 'immediate' }), at(ADDED))).toBe(0);
  });

  it('staff alert to a custom phone', async () => {
    const m = msg({ id: 'msg-alert', recipient_type: 'specific_phone', specific_phone: '(816) 555-0999', content: '{{host_first_name}} added {{guest_first_name}}', relative_quantity: 5, relative_unit: 'minute' });
    expect(await processGuestAddedCampaignMessage(m, at('2026-11-12T18:05:30Z'))).toBe(1);
    expect(mockSend.mock.calls[0][0]).toEqual({ to: '+18165550999', content: 'Tim added Ava' });
    expect(db.rows('guest_messages')).toHaveLength(0); // not a text to the guest
  });
});

describe('textGuestLinkToMember', () => {
  it('creates the link and texts the member with the Campaigns message', async () => {
    const result = await textGuestLinkToMember('r-1', 'staff@example.com', at('2026-11-12T18:00:00Z'));
    expect(result.ok).toBe(true);
    const token = db.rows('reservations')[0].guest_link_token;
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ to: '+19135550100', memberId: 'm-host', accountId: 'a-host', content: expect.stringMatching(new RegExp(`^Hi Tim, add guests for November 19, 2026 at 8:00 PM: .*/r/${token}/guests$`)) }),
    );
  });

  it('refuses when the message is off', async () => {
    db.rows('campaign_messages')[0].campaigns.is_active = false;
    const result = await textGuestLinkToMember('r-1', 'staff@example.com', at('2026-11-12T18:00:00Z'));
    expect(result).toMatchObject({ ok: false, status: 409 });
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('non-member reservation: logged to guest_messages with the staff email', async () => {
    db.rows('reservations')[0].member_id = null;
    db.rows('reservations')[0].account_id = null;
    await textGuestLinkToMember('r-1', 'staff@example.com', at('2026-11-12T18:00:00Z'));
    expect(db.rows('guest_messages')[0]).toMatchObject({ sent_by: 'staff@example.com', reservation_id: 'r-1', status: 'sent' });
  });

  it('can include the guest self-register link', async () => {
    const id = '7d3c6c2e-5b1a-4f7e-9d43-2a8b1c0e9f11';
    db.rows('reservations')[0].id = id;
    db.rows('campaign_messages')[0].content = 'Share with your guests: {{guest_join_link}}';
    expect((await textGuestLinkToMember(id, 'x', at('2026-11-12T18:00:00Z'))).ok).toBe(true);
    expect(mockSend.mock.calls[0][0].content).toMatch(/^Share with your guests: .*\/r\/[A-Za-z0-9_-]{44}\/join$/);
  });

  it('keeps sending after one message fails and says how many went', async () => {
    const first = db.rows('campaign_messages')[0];
    db.rows('campaign_messages').push({ ...first, id: 'msg-link-2', content: 'Second text' });
    mockSend.mockResolvedValueOnce({ success: false, error: 'Carrier error' });
    const result = await textGuestLinkToMember('r-1', 'x', at('2026-11-12T18:00:00Z'));
    expect(mockSend).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ ok: false, status: 502, error: 'Sent 1 of 2 texts. Carrier error' });
  });

  it('refuses a cancelled reservation', async () => {
    db.rows('reservations')[0].status = 'cancelled';
    expect(await textGuestLinkToMember('r-1', 'x', at('2026-11-12T18:00:00Z'))).toMatchObject({ ok: false, status: 409 });
  });
});
