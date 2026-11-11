import {
  JourneyLogRow,
  JourneyStep,
  arrivalBrief,
  daysBetween,
  isSendWindow,
  journeyDay,
  journeyWeek,
  parseSettings,
  pickNextText,
  renderText,
  sentTextOn,
  teamActions,
  toE164,
  visitDates,
} from '../memberJourney';

const step = (over: Partial<JourneyStep>): JourneyStep => ({
  key: 'k',
  position: 1,
  day_offset: 1,
  label: 'Step',
  body: 'Hello',
  post_id: null,
  audience: 'all',
  is_active: true,
  ...over,
});

const steps: JourneyStep[] = [
  step({ key: 'welcome', position: 1, day_offset: 1 }),
  step({ key: 'reservations', position: 2, day_offset: 4, post_id: 'post-res' }),
  step({ key: 'house', position: 3, day_offset: 8, audience: 'primary' }),
  step({ key: 'profile', position: 4, day_offset: 11 }),
];

const sent = (key: string, at = '2026-11-12T16:28:00Z'): JourneyLogRow => ({
  member_id: 'm', step_key: key, kind: 'text', status: 'sent', attempts: 1, updated_at: at,
});

describe('journey day', () => {
  it('counts the join date as day 0', () => {
    expect(journeyDay('2026-11-11', '2026-11-11')).toBe(0);
    expect(journeyDay('2026-11-11T00:00:00.000-06:00', '2026-12-11')).toBe(30);
    expect(journeyDay(null, '2026-11-11')).toBeNull();
  });

  it('counts days across a daylight-saving change', () => {
    expect(daysBetween('2026-10-30', '2026-11-02')).toBe(3);
    expect(daysBetween('2026-03-06', '2026-03-09')).toBe(3);
  });

  it('puts days 0-6 in week 1 and day 90 in week 13', () => {
    expect(journeyWeek(0)).toBe(1);
    expect(journeyWeek(6)).toBe(1);
    expect(journeyWeek(7)).toBe(2);
    expect(journeyWeek(90)).toBe(13);
  });
});

describe('send window', () => {
  it('opens at 10:28 AM Central in winter and in summer', () => {
    expect(isSendWindow(new Date('2026-11-12T16:28:00Z'))).toBe(true); // CST
    expect(isSendWindow(new Date('2026-11-12T15:28:00Z'))).toBe(false); // 9:28 CST
    expect(isSendWindow(new Date('2026-07-12T15:28:00Z'))).toBe(true); // CDT
    expect(isSendWindow(new Date('2026-07-12T16:28:00Z'))).toBe(false); // 11:28 CDT
  });

  it('is closed just before 10:28', () => {
    expect(isSendWindow(new Date('2026-11-12T16:27:00Z'))).toBe(false);
  });
});

describe('visits', () => {
  it('counts one visit per day with a venue purchase', () => {
    const rows = [
      { type: 'purchase', note: 'Noir attendance 11/12', date: '2026-11-12' },
      { type: 'purchase', note: 'Noir visit - second round', date: '2026-11-12' },
      { type: 'purchase', note: 'RooftopKC 11/20', date: '2026-11-20' },
      { type: 'purchase', note: 'Event ticket', date: '2026-11-21' },
      { type: 'payment', note: 'Noir attendance', date: '2026-11-22' },
    ];
    expect(visitDates(rows)).toEqual(['2026-11-12', '2026-11-20']);
  });

  it('ignores visits before the join date', () => {
    const rows = [
      { type: 'purchase', note: 'Noir attendance', date: '2026-10-01' },
      { type: 'purchase', note: 'Noir attendance', date: '2026-11-15' },
    ];
    expect(visitDates(rows, '2026-11-11')).toEqual(['2026-11-15']);
  });
});

describe('pickNextText', () => {
  const base = { steps, isPrimary: true, publishedPostIds: new Set(['post-res']) };

  it('sends nothing on day 0', () => {
    expect(pickNextText({ ...base, day: 0, log: [] }).send).toBeNull();
  });

  it('sends the welcome on day 1, numbered 1 of 4', () => {
    const { send } = pickNextText({ ...base, day: 1, log: [] });
    expect(send).toMatchObject({ n: 1, total: 4 });
    expect(send!.step.key).toBe('welcome');
  });

  it('does not resend a text that was sent', () => {
    expect(pickNextText({ ...base, day: 2, log: [sent('welcome')] }).send).toBeNull();
  });

  it('catches up one text at a time, oldest first', () => {
    const { send } = pickNextText({ ...base, day: 12, log: [sent('welcome')] });
    expect(send!.step.key).toBe('reservations');
  });

  it('skips account-holder texts for other members and renumbers', () => {
    const { send } = pickNextText({
      ...base, isPrimary: false, day: 12, log: [sent('welcome'), sent('reservations')],
    });
    expect(send!.step.key).toBe('profile');
    expect(send).toMatchObject({ n: 3, total: 3 });
  });

  it('holds a text whose post is a draft without blocking later texts', () => {
    const next = pickNextText({ ...base, publishedPostIds: new Set(), day: 9, log: [sent('welcome')] });
    expect(next.waitingOnPost.map(s => s.key)).toEqual(['reservations']);
    expect(next.send!.step.key).toBe('house');
  });

  it('retries a failed text, then gives up after three attempts', () => {
    const failed = (attempts: number): JourneyLogRow => ({ ...sent('welcome'), status: 'failed', attempts });
    expect(pickNextText({ ...base, day: 2, log: [failed(2)] }).send!.step.key).toBe('welcome');
    expect(pickNextText({ ...base, day: 2, log: [failed(3)] }).send).toBeNull();
  });

  it('skips a text that is turned off', () => {
    const off = steps.map(s => (s.key === 'welcome' ? { ...s, is_active: false } : s));
    const { send } = pickNextText({ ...base, steps: off, day: 5, log: [] });
    expect(send!.step.key).toBe('reservations');
    expect(send).toMatchObject({ n: 1, total: 3 });
  });

  it('stops two weeks after day 90', () => {
    expect(pickNextText({ ...base, day: 104, log: [] }).send).not.toBeNull();
    expect(pickNextText({ ...base, day: 105, log: [] }).send).toBeNull();
  });
});

describe('sentTextOn', () => {
  it('reads the send date in Central time', () => {
    const log = [sent('welcome', '2026-11-13T03:00:00Z')]; // 9 PM on the 12th, Central
    expect(sentTextOn(log, '2026-11-12')).toBe(true);
    expect(sentTextOn(log, '2026-11-13')).toBe(false);
  });
});

describe('renderText', () => {
  const footer = 'Welcome note {{n}} of {{total}}. Sent automatically, but we read and answer every reply.';

  it('fills in the name, the post link and the count', () => {
    const text = renderText({
      step: step({ body: 'Hi {{first_name}}, how-to: {{blog_link}}', post_id: 'abc' }),
      firstName: 'Dana', n: 2, total: 16, footer,
    });
    expect(text).toBe(
      'Hi Dana, how-to: https://noirkc.com/member/noir-life/abc\n\nWelcome note 2 of 16. Sent automatically, but we read and answer every reply.'
    );
  });

  it('links to the feed when the text has no post', () => {
    expect(renderText({ step: step({ body: 'See {{blog_link}}' }), firstName: 'Dana', n: 1, total: 1, footer: '' }))
      .toBe('See https://noirkc.com/member/noir-life');
  });

  it('uses the referral link, or the app when there is no code', () => {
    const s = step({ body: 'Link: {{referral_link}}' });
    expect(renderText({ step: s, firstName: 'Dana', referralCode: 'DANA1', n: 1, total: 1, footer: '' }))
      .toBe('Link: https://noirkc.com/refer/DANA1');
    expect(renderText({ step: s, firstName: 'Dana', referralCode: null, n: 1, total: 1, footer: '' }))
      .toBe('Link: https://noirkc.com/member/dashboard');
  });

  it('reads cleanly when there is no first name', () => {
    const args = { firstName: '', n: 1, total: 1, footer: '' };
    expect(renderText({ step: step({ body: 'Hi {{first_name}}, welcome to Noir.' }), ...args })).toBe('Hi, welcome to Noir.');
    expect(renderText({ step: step({ body: '{{first_name}}, 90 days in.' }), ...args })).toBe('90 days in.');
    expect(renderText({ step: step({ body: "How's everything going so far, {{first_name}}? Anything?" }), ...args }))
      .toBe("How's everything going so far? Anything?");
  });
});

describe('toE164', () => {
  it('normalizes US numbers and rejects anything else', () => {
    expect(toE164('(913) 777-4488')).toBe('+19137774488');
    expect(toE164('+19137774488')).toBe('+19137774488');
    expect(toE164('19137774488')).toBe('+19137774488');
    expect(toE164('777-4488')).toBeNull();
    expect(toE164(null)).toBeNull();
  });
});

describe('teamActions', () => {
  const base = { firstName: 'Dana', today: '2026-12-10', done: new Set<string>() };
  const keys = (a: ReturnType<typeof teamActions>) => a.map(x => x.key);

  it('raises the no-visit alert from day 21, not before', () => {
    expect(keys(teamActions({ ...base, day: 20, visits: [] }))).toEqual([]);
    const at21 = teamActions({ ...base, day: 21, visits: [] });
    expect(keys(at21)).toEqual(['no_visit_21']);
    expect(at21[0].tone).toBe('alert');
  });

  it('drops the no-visit alert once they have been in', () => {
    expect(keys(teamActions({ ...base, day: 25, visits: ['2026-12-10'] }))).toEqual([]);
  });

  it('asks for the first-visit note three days after visit 1', () => {
    expect(keys(teamActions({ ...base, day: 10, visits: ['2026-12-08'] }))).toEqual(['visit1_gift']);
    expect(keys(teamActions({ ...base, day: 10, visits: ['2026-12-07'] }))).toEqual(['visit1_gift', 'visit1_note']);
  });

  it('adds the referral ask after visit 2 and the gift after visit 3', () => {
    const a = teamActions({ ...base, day: 20, visits: ['2026-11-25', '2026-12-01', '2026-12-09'] });
    expect(keys(a)).toEqual(['visit1_gift', 'visit1_note', 'visit2_referral', 'visit3_gift']);
    expect(a.find(x => x.key === 'visit2_referral')!.script).toContain('Dana');
  });

  it('hides what has been marked done', () => {
    const done = new Set(['visit1_gift', 'visit1_note']);
    expect(keys(teamActions({ ...base, done, day: 10, visits: ['2026-12-01'] }))).toEqual([]);
  });

  it('shows the 30 and 90 day milestones for three days', () => {
    expect(keys(teamActions({ ...base, day: 29, visits: ['2026-12-10'] }))).toEqual([]);
    expect(keys(teamActions({ ...base, day: 30, visits: ['2026-12-10'] }))).toEqual(['day_30']);
    expect(keys(teamActions({ ...base, day: 33, visits: ['2026-12-10'] }))).toEqual([]);
    expect(keys(teamActions({ ...base, done: new Set(['visit1_gift', 'visit1_note']), day: 90, visits: ['2026-11-01'] })))
      .toEqual(['day_90']);
  });

  it('suggests an unexpected touch for regulars between days 60 and 75', () => {
    const visits = ['2026-10-20', '2026-11-01', '2026-11-15', '2026-12-01'];
    const done = new Set(['visit1_gift', 'visit1_note', 'visit2_referral', 'visit3_gift']);
    expect(keys(teamActions({ ...base, done, day: 65, visits }))).toEqual(['regular_touch']);
    expect(keys(teamActions({ ...base, done, day: 65, visits: visits.slice(0, 3) }))).toEqual([]);
    expect(keys(teamActions({ ...base, done, day: 80, visits }))).toEqual([]);
  });
});

describe('arrivalBrief', () => {
  it('tells the floor what to do on visits 1, 2 and 3', () => {
    expect(arrivalBrief(0, 5)).toMatchObject({ visitNumber: 1 });
    expect(arrivalBrief(0, 5).note).toContain('Welcome gift');
    expect(arrivalBrief(1, 12).note).toContain('usual');
    expect(arrivalBrief(2, 20).note).toContain('Thank-you gift');
  });

  it('says nothing for members past their first 90 days', () => {
    expect(arrivalBrief(0, 200)).toEqual({ visitNumber: 1, note: '' });
    expect(arrivalBrief(7, null)).toEqual({ visitNumber: 8, note: '' });
  });
});

describe('parseSettings', () => {
  it('is off unless explicitly on', () => {
    expect(parseSettings(null).enabled).toBe(false);
    expect(parseSettings({ enabled: 'true' }).enabled).toBe(false);
    expect(parseSettings({ enabled: true, start_date: '2026-11-11' })).toMatchObject({ enabled: true, start_date: '2026-11-11' });
    expect(parseSettings({ start_date: 'soon' }).start_date).toBeNull();
  });
});
