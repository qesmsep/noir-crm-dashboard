import { formatHoldCountdown, secondsRemaining } from '../holds';

describe('formatHoldCountdown', () => {
  it('renders minutes and zero-padded seconds', () => {
    expect(formatHoldCountdown(289)).toBe('4min 49sec');
    expect(formatHoldCountdown(300)).toBe('5min 00sec');
    expect(formatHoldCountdown(65)).toBe('1min 05sec');
  });

  it('drops the minutes segment under a minute', () => {
    expect(formatHoldCountdown(59)).toBe('59sec');
    expect(formatHoldCountdown(1)).toBe('1sec');
  });

  it('floors at zero rather than showing negative time', () => {
    expect(formatHoldCountdown(0)).toBe('0sec');
    expect(formatHoldCountdown(-30)).toBe('0sec');
  });
});

describe('secondsRemaining', () => {
  const now = new Date('2026-09-01T20:00:00.000Z');

  it('counts down to a future expiry', () => {
    expect(secondsRemaining('2026-09-01T20:05:00.000Z', now)).toBe(300);
  });

  it('returns 0 once the expiry has passed', () => {
    expect(secondsRemaining('2026-09-01T19:59:00.000Z', now)).toBe(0);
  });

  it('returns 0 exactly at expiry', () => {
    expect(secondsRemaining('2026-09-01T20:00:00.000Z', now)).toBe(0);
  });
});
