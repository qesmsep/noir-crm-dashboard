/**
 * @jest-environment node
 */
/**
 * New placeholders ({{location_address}}, {{parking_instructions}},
 * {{host_last_name}}) and Guest Registration messages timed from the
 * reservation start.
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

import { renderGuestMessage } from '../guestMessageRender';
import { renderReservationMessage } from '../reservationCampaigns';
import { guestAddedSendTime, processGuestAddedCampaignMessage, renderGuestCampaignMessage, type GuestCampaignMessage } from '../guestCampaigns';

const TZ = 'America/Chicago';
const START = '2026-11-20T02:00:00.000Z'; // Thu Nov 19, 8:00 PM Central

describe('new placeholders', () => {
  it('built-in guest texts', () => {
    expect(
      renderGuestMessage('{{host_first_name}} {{host_last_name}} · {{location_address}} · {{parking_instructions}}', {
        guestFirstName: 'Ava',
        hostFirstName: 'Tim',
        hostLastName: 'Wirick',
        locationName: 'Noir KC',
        locationAddress: '1234 Main St',
        parkingInstructions: 'Garage on 13th',
        start: START,
        timezone: TZ,
      }),
    ).toBe('Tim Wirick · 1234 Main St · Garage on 13th');
  });

  it('Guest Registration campaign texts', () => {
    expect(
      renderGuestCampaignMessage('Hi {{guest_first_name}}, {{host_first_name}} {{host_last_name}} at {{location_address}}. {{parking_instructions}}', {
        guestFirstName: 'Ava',
        guestLastName: null,
        hostFirstName: 'Tim',
        hostLastName: 'Wirick',
        locationName: 'Noir KC',
        locationAddress: '1234 Main St',
        parkingInstructions: 'Park on 13th.',
        start: START,
        partySize: 3,
        timezone: TZ,
      }),
    ).toBe('Hi Ava, Tim Wirick at 1234 Main St. Park on 13th.');
  });

  it('reservation campaigns get address and parking; blanks collapse cleanly', () => {
    const r = { first_name: 'Ava', last_name: null, email: null, phone: null, party_size: 2, start_time: START };
    expect(renderReservationMessage('See you at {{location_address}}. {{parking_instructions}}', r, { name: 'Noir KC', timezone: TZ, address: '1234 Main St', parking_instructions: 'Valet out front.' })).toBe(
      'See you at 1234 Main St. Valet out front.',
    );
    expect(renderReservationMessage('Confirmed. {{parking_instructions}}', r, { name: 'Noir KC', timezone: TZ })).toBe('Confirmed.');
  });
});

function msg(extra: Partial<GuestCampaignMessage>): GuestCampaignMessage {
  return {
    id: 'm-res',
    content: 'Hi {{guest_first_name}}, see you at {{reservation_time}}. {{parking_instructions}} Reply STOP to opt out.',
    recipient_type: 'reservation_guest',
    timing_type: 'relative',
    relative_anchor: 'reservation_start',
    relative_quantity: 3,
    relative_unit: 'hour',
    relative_proximity: 'before',
    relative_time: '10:00',
    campaigns: { id: 'c', trigger_type: 'guest_registration', is_active: true, applies_to_all_locations: true, campaign_locations: [] },
    ...extra,
  } as GuestCampaignMessage;
}

describe('admin-entered text is inserted literally', () => {
  it('keeps $ sequences and braces as typed', () => {
    const r = { first_name: 'Ava', last_name: null, email: null, phone: null, party_size: 2, start_time: START };
    expect(renderReservationMessage('{{parking_instructions}}', r, { name: 'Noir KC', timezone: TZ, parking_instructions: "Valet $5 $& $' {{first_name}}" })).toBe(
      "Valet $5 $& $' {{first_name}}",
    );
    expect(
      renderGuestMessage('{{location_address}}', { guestFirstName: 'A', hostFirstName: 'T', locationName: 'N', locationAddress: 'Suite $1', start: START, timezone: TZ }),
    ).toBe('Suite $1');
  });
});

describe('timing relative to the reservation', () => {
  const added = DateTime.fromISO('2026-11-12T18:00:00Z', { zone: 'utc' });
  it('"3 hours before the reservation" is exact', () => {
    expect(guestAddedSendTime(msg({}), added, TZ, START)!.toUTC().toISO()).toBe('2026-11-19T23:00:00.000Z');
  });
  it('"1 day after the reservation" lands on the clock time', () => {
    const t = guestAddedSendTime(msg({ relative_quantity: 1, relative_unit: 'day', relative_proximity: 'after', relative_time: '11:00' }), added, TZ, START)!;
    expect(t.setZone(TZ).toFormat('yyyy-LL-dd HH:mm')).toBe('2026-11-20 11:00');
  });
  it('default anchor is still when the guest was added', () => {
    expect(guestAddedSendTime(msg({ relative_anchor: null, relative_quantity: 30, relative_unit: 'minute', relative_proximity: 'after' }), added, TZ, START)!.toUTC().toISO()).toBe(
      '2026-11-12T18:30:00.000Z',
    );
  });
});

describe('cron: reservation-anchored Guest Registration messages', () => {
  beforeEach(() => {
    mockSend.mockReset().mockResolvedValue({ success: true });
    db = new FakeDb(
      {
        reservations: [
          { id: 'r-1', status: 'confirmed', start_time: START, party_size: 3, first_name: 'Tim', last_name: 'Wirick', member_id: null, location_id: 'loc' },
          { id: 'r-x', status: 'cancelled', start_time: START, party_size: 3, first_name: 'Sam', last_name: null, member_id: null, location_id: 'loc' },
        ],
        locations: [{ id: 'loc', name: 'Noir KC', timezone: TZ, address: '1234 Main St', parking_instructions: 'Garage on 13th.' }],
        members: [],
        guest_contacts: [
          { id: 'c1', phone: '+19135550101', first_name: 'Ava', last_name: null, sms_opted_out_at: null },
          { id: 'c2', phone: '+19135550102', first_name: 'Bo', last_name: null, sms_opted_out_at: null },
        ],
        reservation_guests: [
          { id: 'g1', reservation_id: 'r-1', guest_contact_id: 'c1', location_id: 'loc', status: 'active', first_name_snapshot: 'Ava', matched_member_id: null, notified_at: null, created_at: '2026-11-10T18:00:00Z' },
          { id: 'g2', reservation_id: 'r-x', guest_contact_id: 'c2', location_id: 'loc', status: 'active', first_name_snapshot: 'Bo', matched_member_id: null, notified_at: null, created_at: '2026-11-10T18:00:00Z' },
        ],
        guest_message_templates: [],
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
  });

  it('"1 month before" is found despite month-length differences', async () => {
    // Reservation Nov 19 8 PM Central; 1 month before at 10:00 → Oct 19 10:00 CDT = 15:00Z
    db.rows('reservation_guests')[0].created_at = '2026-10-01T18:00:00Z';
    const m = msg({ relative_quantity: 1, relative_unit: 'month', relative_proximity: 'before', relative_time: '10:00' });
    expect(await processGuestAddedCampaignMessage(m, { now: () => DateTime.fromISO('2026-10-19T15:01:00Z', { zone: 'utc' }) })).toBe(1);
  });

  it('sends 3 hours before the reservation, once, and skips cancelled reservations', async () => {
    const at = (iso: string) => ({ now: () => DateTime.fromISO(iso, { zone: 'utc' }) });
    expect(await processGuestAddedCampaignMessage(msg({}), at('2026-11-19T22:50:00Z'))).toBe(0); // 10 min early
    expect(await processGuestAddedCampaignMessage(msg({}), at('2026-11-19T23:01:00Z'))).toBe(1);
    expect(await processGuestAddedCampaignMessage(msg({}), at('2026-11-19T23:02:00Z'))).toBe(0);
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend.mock.calls[0][0]).toEqual({ to: '+19135550101', content: 'Hi Ava, see you at 8:00 PM. Garage on 13th. Reply STOP to opt out.' });
  });

  it('{{calendar_link}} sends the add-to-calendar link for the reservation', async () => {
    const id = '44444444-4444-4444-8444-444444444444';
    db.rows('reservations')[0].id = id;
    db.rows('reservation_guests')[0].reservation_id = id;
    const m = msg({ content: 'Add it to your calendar: {{calendar_link}}' });
    expect(await processGuestAddedCampaignMessage(m, { now: () => DateTime.fromISO('2026-11-19T23:01:00Z', { zone: 'utc' }) })).toBe(1);
    expect(mockSend.mock.calls[0][0].content).toMatch(/^Add it to your calendar: \S*\/r\/[A-Za-z0-9_-]{44}\/cal\.ics$/);
  });
});
