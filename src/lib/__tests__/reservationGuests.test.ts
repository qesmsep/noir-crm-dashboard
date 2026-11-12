/**
 * @jest-environment node
 */
/**
 * Reservation guests: add-guests rules, scheduling math in the venue timezone,
 * reschedule/cancel, the sending cron's re-checks, and STOP/START handling.
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
  addGuests,
  classifyOptKeyword,
  GuestServiceError,
  handleGuestOptKeyword,
  introCoveredByDayOf,
  listGuests,
  onReservationCancelled,
  onReservationRescheduled,
  planGuestMessages,
  processDueGuestMessages,
  removeGuest,
  renderGuestMessage,
  updateGuest,
} from '../reservationGuests';

const LOC = 'loc-noir';
// 2026-11-19 20:00 Central = 2026-11-20T02:00Z
const START = '2026-11-20T02:00:00.000Z';
const END = '2026-11-20T04:00:00.000Z';
const NOW = DateTime.fromISO('2026-11-12T18:00:00.000Z', { zone: 'utc' });

let clock = NOW;
const deps = () => ({ now: () => clock });

const INTRO = {
  id: 'msg-intro',
  name: 'Guest intro',
  content: 'Hi {{guest_first_name}}, {{host_first_name}} put you on their reservation at {{location_name}} on {{reservation_date}} at {{reservation_time}}. Reply STOP to opt out.',
  recipient_type: 'reservation_guest',
  specific_phone: null,
  timing_type: 'immediate',
  is_active: true,
  campaigns: { id: 'camp-g', trigger_type: 'reservation_guest_added', is_active: true, applies_to_all_locations: true, campaign_locations: [] },
};

function seed(extra: { reservation?: Record<string, unknown>; members?: Record<string, unknown>[]; templates?: Record<string, unknown>[]; intro?: boolean } = {}) {
  db = new FakeDb(
    {
      reservations: [
        {
          id: 'r-1',
          status: 'confirmed',
          start_time: START,
          end_time: END,
          party_size: 3,
          phone: '+19135550100',
          first_name: 'Tim',
          member_id: 'm-host',
          location_id: LOC,
          ...extra.reservation,
        },
      ],
      members: extra.members ?? [
        { member_id: 'm-host', first_name: 'Tim', phone: '913-555-0100', status: 'active' },
        { member_id: 'm-other', first_name: 'Jo', phone: '(816) 555-0177', status: 'active' },
      ],
      locations: [{ id: LOC, name: 'Noir KC', timezone: 'America/Chicago', guest_arrival_instructions: 'Use the alley door and say Noir.' }],
      guest_message_templates: extra.templates ?? [
        { kind: 'day_of', body: 'Tonight {{time}} with {{host_first_name}}. Reply STOP to opt out.', is_active: true, send_offset_minutes: 120 },
        { kind: 'time_changed', body: 'Moved to {{date}} at {{time}}. Reply STOP to opt out.', is_active: true, send_offset_minutes: null },
        { kind: 'cancelled', body: '{{host_first_name}} cancelled. Reply STOP to opt out.', is_active: true, send_offset_minutes: null },
      ],
      guest_contacts: [],
      reservation_guests: [],
      scheduled_guest_messages: [],
      guest_messages: [],
      campaign_messages: extra.intro ? [INTRO] : [],
      scheduled_messages: [],
    },
    {
      relations: { reservation_guests: { guest_contacts: { table: 'guest_contacts', fk: 'guest_contact_id' } } },
      unique: {
        guest_contacts: [{ columns: ['phone'] }],
        reservation_guests: [{ columns: ['reservation_id', 'guest_contact_id'], where: (r) => r.status === 'active' }],
        scheduled_guest_messages: [{ columns: ['reservation_guest_id', 'kind'], where: (r) => r.status === 'pending' }],
        scheduled_messages: [{ columns: ['campaign_message_id', 'reservation_guest_id'], where: (r) => r.reservation_guest_id != null && (r.status === 'pending' || r.status === 'sent') }],
      },
    },
  );
}

beforeEach(() => {
  clock = NOW;
  mockSend.mockReset().mockResolvedValue({ success: true, messageId: 'op-9' });
  seed();
});

async function expectError(p: Promise<unknown>, code: string) {
  await expect(p).rejects.toBeInstanceOf(GuestServiceError);
  await p.catch((e: GuestServiceError) => expect(e.code).toBe(code));
}

describe('addGuests rules', () => {
  it('adds a guest, normalizes the phone, and returns masked data to members', async () => {
    await addGuests('r-1', [{ first_name: ' Ava ', phone: '(913) 555-0101' }], { via: 'portal', actorMemberId: 'm-host' }, deps());
    expect(db.rows('guest_contacts')[0]).toMatchObject({ phone: '+19135550101', first_name: 'Ava' });
    const view = await listGuests('r-1', 'member', deps());
    expect(view).toEqual([{ id: expect.any(String), first_name: 'Ava', last_name: null, phone_masked: '•••-0101' }]);
  });

  it('rejects invalid phones per row and saves nothing', async () => {
    const p = addGuests('r-1', [{ first_name: 'Ava', phone: '9135550101' }, { first_name: 'Bo', phone: '555-12' }], { via: 'portal' }, deps());
    await expectError(p, 'invalid_rows');
    await p.catch((e: GuestServiceError) => expect(e.rowErrors).toEqual([{ index: 1, field: 'phone', error: 'Enter a valid mobile number.' }]));
    expect(db.rows('reservation_guests')).toHaveLength(0);
  });

  it("rejects the host's own phone (reservation or member record)", async () => {
    await expectError(addGuests('r-1', [{ first_name: 'Me', phone: '9135550100' }], { via: 'portal' }, deps()), 'invalid_rows');
  });

  it('rejects duplicates within a batch and against existing guests', async () => {
    await expectError(
      addGuests('r-1', [{ first_name: 'A', phone: '9135550101' }, { first_name: 'B', phone: '+1 913 555 0101' }], { via: 'portal' }, deps()),
      'invalid_rows',
    );
    await addGuests('r-1', [{ first_name: 'A', phone: '9135550101' }], { via: 'portal' }, deps());
    await expectError(addGuests('r-1', [{ first_name: 'A2', phone: '913.555.0101' }], { via: 'portal' }, deps()), 'invalid_rows');
  });

  it('caps active guests at party size − 1 and says to raise party size', async () => {
    const p = addGuests(
      'r-1',
      [
        { first_name: 'A', phone: '9135550101' },
        { first_name: 'B', phone: '9135550102' },
        { first_name: 'C', phone: '9135550103' },
      ],
      { via: 'portal' },
      deps(),
    );
    await expectError(p, 'over_party_size');
    await p.catch((e: GuestServiceError) => expect(e.message).toMatch(/Raise the party size/));
    expect(db.rows('reservations')[0].party_size).toBe(3); // never changed automatically
  });

  it('a removed guest frees a slot', async () => {
    await addGuests('r-1', [{ first_name: 'A', phone: '9135550101' }, { first_name: 'B', phone: '9135550102' }], { via: 'portal' }, deps());
    const [first] = await listGuests('r-1', 'staff', deps());
    await removeGuest('r-1', first.id, deps());
    await addGuests('r-1', [{ first_name: 'C', phone: '9135550103' }], { via: 'portal' }, deps());
    expect((await listGuests('r-1', 'staff', deps())).map((g) => g.first_name)).toEqual(['B', 'C']);
  });

  it('rejects cancelled and ended reservations', async () => {
    seed({ reservation: { status: 'cancelled' } });
    await expectError(addGuests('r-1', [{ first_name: 'A', phone: '9135550101' }], { via: 'portal' }, deps()), 'reservation_cancelled');
    seed();
    clock = DateTime.fromISO(END).plus({ minutes: 1 });
    await expectError(addGuests('r-1', [{ first_name: 'A', phone: '9135550101' }], { via: 'portal' }, deps()), 'reservation_ended');
  });

  it('marks a guest who is already a member and schedules no texts', async () => {
    await addGuests('r-1', [{ first_name: 'Jo', phone: '8165550177' }], { via: 'portal' }, deps());
    expect(db.rows('reservation_guests')[0].matched_member_id).toBe('m-other');
    expect(db.rows('scheduled_guest_messages')).toHaveLength(0);
    expect((await listGuests('r-1', 'staff', deps()))[0].is_member).toBe(true);
  });

  it("doesn't overwrite an existing contact's name unless staff edit it", async () => {
    await addGuests('r-1', [{ first_name: 'Ava', phone: '9135550101' }], { via: 'portal' }, deps());
    seed();
    db.rows('guest_contacts').push({ id: 'c-old', phone: '+19135550101', first_name: 'Ava', last_name: 'Stone', sms_opted_out_at: null });
    await addGuests('r-1', [{ first_name: 'Avery', phone: '9135550101' }], { via: 'portal' }, deps());
    expect(db.rows('guest_contacts')[0]).toMatchObject({ first_name: 'Ava', last_name: 'Stone' });
    const [g] = await listGuests('r-1', 'staff', deps());
    expect(g.first_name).toBe('Avery'); // this visit's name
    await updateGuest('r-1', g.id, { first_name: 'Avery', last_name: 'Stone' }, { via: 'staff' }, deps());
    expect(db.rows('guest_contacts')[0].first_name).toBe('Avery');
  });
});

describe('scheduling math (venue timezone)', () => {
  const tz = 'America/Chicago';
  it('a week out: day_of two hours before start', () => {
    const plan = planGuestMessages({ start: START, now: NOW, timezone: tz });
    expect(plan.map((p) => [p.kind, p.scheduledFor.toUTC().toISO()])).toEqual([['day_of', '2026-11-20T00:00:00.000Z']]);
  });

  it('starts within 2 hours: day_of now, and the campaign intro is covered by it', () => {
    const now = DateTime.fromISO('2026-11-20T00:30:00.000Z', { zone: 'utc' });
    const plan = planGuestMessages({ start: START, now, timezone: tz });
    expect(plan.map((p) => p.kind)).toEqual(['day_of']);
    expect(plan[0].scheduledFor.toUTC().toISO()).toBe(now.toISO());
    expect(introCoveredByDayOf({ start: START, now, dayOfActive: true })).toBe(true);
    expect(introCoveredByDayOf({ start: START, now, dayOfActive: false })).toBe(false);
    expect(introCoveredByDayOf({ start: START, now: NOW, dayOfActive: true })).toBe(false);
  });

  it('custom 60-minute offset, start in 90 minutes: day_of at start−60', () => {
    const now = DateTime.fromISO('2026-11-20T00:30:00.000Z', { zone: 'utc' });
    const plan = planGuestMessages({ start: START, now, timezone: tz, dayOfOffsetMinutes: 60 });
    expect(plan.map((p) => [p.kind, p.scheduledFor.toUTC().toISO()])).toEqual([['day_of', '2026-11-20T01:00:00.000Z']]);
  });

  it('across a DST change the offset is still exact minutes before the venue start', () => {
    // 2027-03-14 is DST start in Chicago; reservation 2027-03-14 3:30 AM CDT
    const plan = planGuestMessages({ start: '2027-03-14T08:30:00.000Z', now: DateTime.fromISO('2027-03-10T12:00:00Z'), timezone: tz });
    expect(plan[0].scheduledFor.toUTC().toISO()).toBe('2027-03-14T06:30:00.000Z');
  });

  it('day_of switched off: nothing built-in', () => {
    expect(planGuestMessages({ start: START, now: NOW, timezone: tz, activeKinds: new Set(['time_changed', 'cancelled']) })).toEqual([]);
  });

  it('past start: nothing', () => {
    expect(planGuestMessages({ start: START, now: DateTime.fromISO(START).plus({ minutes: 5 }), timezone: tz })).toEqual([]);
  });
});

describe('render', () => {
  it('fills tokens in the venue timezone with arrival instructions', () => {
    const text = renderGuestMessage('Hi {{guest_first_name}}, {{host_first_name}} • {{location_name}} {{date}} {{time}}. {{arrival_instructions}}', {
      guestFirstName: 'Ava',
      hostFirstName: 'Tim',
      locationName: 'Noir KC',
      start: START,
      timezone: 'America/Chicago',
      arrivalInstructions: null,
    });
    expect(text).toBe("Hi Ava, Tim • Noir KC Thursday, November 19 8:00 PM. Give your name at the door and we'll take it from there.");
  });
});

describe('guest added → campaign intro', () => {
  it('sends the intro at once, logs it and sets notified_at; host is linked', async () => {
    seed({ intro: true });
    await addGuests('r-1', [{ first_name: 'Ava', phone: '9135550101' }], { via: 'guest_link' }, deps());
    expect(mockSend).toHaveBeenCalledWith({
      to: '+19135550101',
      content: 'Hi Ava, Tim put you on their reservation at Noir KC on Thursday, November 19 at 8:00 PM. Reply STOP to opt out.',
    });
    const g = db.rows('reservation_guests')[0];
    expect(g.host_member_id).toBe('m-host'); // connected to the member even via the link
    expect(g.notified_at).toBeTruthy();
    expect(db.rows('guest_messages')[0]).toMatchObject({ reservation_id: 'r-1', sent_by: 'system:campaign', status: 'sent' });
    expect(db.rows('scheduled_messages')[0]).toMatchObject({ campaign_message_id: 'msg-intro', reservation_guest_id: g.id, status: 'sent' });
  });

  it('no intro campaign: nothing sent at add, day_of still queued', async () => {
    await addGuests('r-1', [{ first_name: 'Ava', phone: '9135550101' }], { via: 'portal' }, deps());
    expect(mockSend).not.toHaveBeenCalled();
    expect(db.rows('scheduled_guest_messages').map((m) => m.kind)).toEqual(['day_of']);
  });

  it('within 2 hours of start: intro skipped, day_of goes now', async () => {
    seed({ intro: true });
    clock = DateTime.fromISO('2026-11-20T00:30:00.000Z', { zone: 'utc' });
    await addGuests('r-1', [{ first_name: 'Ava', phone: '9135550101' }], { via: 'portal' }, deps());
    expect(db.rows('scheduled_messages')).toHaveLength(0);
    await processDueGuestMessages({}, deps());
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend.mock.calls[0][0].content).toMatch(/^Tonight 8:00 PM with Tim/);
  });

  it('guest who is already a member gets no intro', async () => {
    seed({ intro: true });
    await addGuests('r-1', [{ first_name: 'Jo', phone: '8165550177' }], { via: 'portal' }, deps());
    expect(mockSend).not.toHaveBeenCalled();
  });
});

describe('sending cron re-checks (day_of)', () => {
  const DAY_OF = DateTime.fromISO('2026-11-20T00:00:30.000Z', { zone: 'utc' });
  async function addAvaThenWait() {
    await addGuests('r-1', [{ first_name: 'Ava', phone: '9135550101' }], { via: 'portal', actorMemberId: 'm-host' }, deps());
    clock = DAY_OF;
  }

  it('sends day_of with arrival instructions, logs it and sets notified_at', async () => {
    await addAvaThenWait();
    const out = await processDueGuestMessages({}, deps());
    expect(out).toMatchObject({ claimed: 1, sent: 1 });
    expect(mockSend).toHaveBeenCalledWith({ to: '+19135550101', content: 'Tonight 8:00 PM with Tim. Reply STOP to opt out.' });
    expect(db.rows('guest_messages')[0]).toMatchObject({ reservation_id: 'r-1', sent_by: 'system:guests', status: 'sent', openphone_message_id: 'op-9' });
    expect(db.rows('reservation_guests')[0].notified_at).toBeTruthy();
  });

  it('nothing before it is due; a second run does not resend', async () => {
    await addGuests('r-1', [{ first_name: 'Ava', phone: '9135550101' }], { via: 'portal' }, deps());
    await processDueGuestMessages({}, deps());
    expect(mockSend).not.toHaveBeenCalled();
    clock = DAY_OF;
    await processDueGuestMessages({}, deps());
    await processDueGuestMessages({}, deps());
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it('skips when the reservation was cancelled', async () => {
    await addAvaThenWait();
    db.rows('reservations')[0].status = 'cancelled';
    const out = await processDueGuestMessages({}, deps());
    expect(out.skipped).toBe(1);
    expect(db.rows('scheduled_guest_messages')[0]).toMatchObject({ status: 'skipped', skip_reason: 'reservation_cancelled' });
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('skips when the contact opted out after scheduling', async () => {
    await addAvaThenWait();
    db.rows('guest_contacts')[0].sms_opted_out_at = NOW.toISO();
    await processDueGuestMessages({}, deps());
    expect(db.rows('scheduled_guest_messages')[0]).toMatchObject({ status: 'skipped', skip_reason: 'opted_out' });
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('skips a guest who became a member since being added', async () => {
    await addAvaThenWait();
    db.rows('members').push({ member_id: 'm-new', phone: '+19135550101', status: 'active' });
    await processDueGuestMessages({}, deps());
    expect(db.rows('scheduled_guest_messages')[0]).toMatchObject({ status: 'skipped', skip_reason: 'matched_member' });
    expect(db.rows('reservation_guests')[0].matched_member_id).toBe('m-new');
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('records a failed send without retrying', async () => {
    await addAvaThenWait();
    mockSend.mockResolvedValueOnce({ success: false, error: 'bad number' });
    await processDueGuestMessages({}, deps());
    expect(db.rows('scheduled_guest_messages')[0]).toMatchObject({ status: 'failed', error_message: 'bad number' });
    expect(db.rows('guest_messages')[0]).toMatchObject({ status: 'failed' });
    expect(db.rows('reservation_guests')[0].notified_at).toBeUndefined();
  });
});

describe('reschedule and cancel', () => {
  it('reschedule: notified guests get time_changed now and a moved day_of', async () => {
    seed({ intro: true });
    await addGuests('r-1', [{ first_name: 'Ava', phone: '9135550101' }], { via: 'portal' }, deps()); // intro → notified
    db.rows('reservations')[0].start_time = '2026-11-21T02:00:00.000Z';
    db.rows('reservations')[0].end_time = '2026-11-21T04:00:00.000Z';
    await onReservationRescheduled('r-1', deps());
    const pending = db.rows('scheduled_guest_messages').filter((m) => m.status === 'pending');
    expect(pending.map((m) => [m.kind, m.scheduled_for])).toEqual(
      expect.arrayContaining([
        ['time_changed', NOW.toUTC().toISO()],
        ['day_of', '2026-11-21T00:00:00.000Z'],
      ]),
    );
    expect(pending).toHaveLength(2);
  });

  it('reschedule: not-yet-texted guests just get a fresh plan', async () => {
    await addGuests('r-1', [{ first_name: 'Ava', phone: '9135550101' }], { via: 'portal' }, deps());
    db.rows('reservations')[0].start_time = '2026-11-12T19:00:00.000Z'; // now within 2h
    db.rows('reservations')[0].end_time = '2026-11-12T21:00:00.000Z';
    await onReservationRescheduled('r-1', deps());
    const pending = db.rows('scheduled_guest_messages').filter((m) => m.status === 'pending');
    expect(pending.map((m) => [m.kind, m.scheduled_for])).toEqual([['day_of', NOW.toUTC().toISO()]]);
  });

  it('cancel: pending cancelled; only notified guests get the cancelled text', async () => {
    await addGuests('r-1', [{ first_name: 'Ava', phone: '9135550101' }, { first_name: 'Bo', phone: '9135550102' }], { via: 'portal' }, deps());
    db.rows('reservation_guests').find((g) => g.first_name_snapshot === 'Ava')!.notified_at = NOW.toISO();
    db.rows('reservations')[0].status = 'cancelled';
    await onReservationCancelled('r-1', {}, deps());
    const pending = db.rows('scheduled_guest_messages').filter((m) => m.status === 'pending');
    expect(pending).toHaveLength(1);
    expect(pending[0].kind).toBe('cancelled');
    await processDueGuestMessages({}, deps());
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend.mock.calls[0][0]).toEqual({ to: '+19135550101', content: 'Tim cancelled. Reply STOP to opt out.' });
  });

  it('cancel with sendNow (reservation about to be deleted) texts inline', async () => {
    await addGuests('r-1', [{ first_name: 'Ava', phone: '9135550101' }], { via: 'portal' }, deps());
    db.rows('reservation_guests')[0].notified_at = NOW.toISO();
    await onReservationCancelled('r-1', { sendNow: true }, deps());
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(db.rows('scheduled_guest_messages').filter((m) => m.status === 'pending')).toHaveLength(0);
  });
});

describe('opt-out keywords', () => {
  it.each([
    ['STOP', 'opt_out'],
    ['stop', 'opt_out'],
    [' Unsubscribe. ', 'opt_out'],
    ['QUIT', 'opt_out'],
    ['END', 'opt_out'],
    ['cancel', 'opt_out'],
    ['STOPALL', 'opt_out'],
    ['START', 'opt_in'],
    ['unstop', 'opt_in'],
    ['stop texting me please', null],
    ['INVITATION', null],
    ['reservation for 4', null],
  ])('%p -> %p', (text, expected) => {
    expect(classifyOptKeyword(text)).toBe(expected);
  });

  it('STOP sets sms_opted_out_at and cancels pending; START clears it', async () => {
    await addGuests('r-1', [{ first_name: 'Ava', phone: '9135550101' }], { via: 'portal' }, deps());
    expect(await handleGuestOptKeyword('+19135550101', 'STOP', deps())).toBe('opted_out');
    expect(db.rows('guest_contacts')[0].sms_opted_out_at).toBeTruthy();
    expect(db.rows('scheduled_guest_messages').every((m) => m.status === 'cancelled')).toBe(true);
    expect(await handleGuestOptKeyword('9135550101', 'START', deps())).toBe('opted_in');
    expect(db.rows('guest_contacts')[0].sms_opted_out_at).toBeNull();
  });

  it('unknown numbers and non-keywords are left alone', async () => {
    expect(await handleGuestOptKeyword('+18165550000', 'STOP', deps())).toBe('no_contact');
    expect(await handleGuestOptKeyword('+19135550101', 'hello', deps())).toBe('not_keyword');
  });
});
