import { toUTC, fromUTC, formatDateTime, localInputToUTC, createDateTimeFromTimeString } from '../dateUtils.ts';

describe('dateUtils', () => {
  describe('toUTC', () => {
    it('should convert Date object to UTC ISO string', () => {
      const localTime = new Date('2023-01-01T12:00:00');
      const result = toUTC(localTime);

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      // Accepts either Z format or offset format
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(Z|[+-]\d{2}:\d{2})$/);
    });

    it('should handle null input', () => {
      const result = toUTC(null);
      expect(result).toBeNull();
    });
  });

  describe('fromUTC', () => {
    it('should convert UTC ISO string to DateTime object', () => {
      const utcString = '2023-01-01T12:00:00Z';
      const result = fromUTC(utcString);

      expect(result).toBeDefined();
      expect(result.isValid).toBe(true);
    });

    it('should handle null input', () => {
      const result = fromUTC(null);
      expect(result).toBeNull();
    });
  });

  describe('formatDateTime', () => {
    it('should format date and time', () => {
      const date = new Date('2023-01-01T12:00:00');
      const result = formatDateTime(date, 'America/Chicago');

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('createDateTimeFromTimeString', () => {
    it('sets the time on the calendar day that was picked', () => {
      const picked = new Date(2026, 8, 25); // local midnight, September 25
      const start = createDateTimeFromTimeString('7:30pm', 'America/Chicago', picked);

      expect(start.toFormat('yyyy-MM-dd HH:mm')).toBe('2026-09-25 19:30');
      expect(start.zoneName).toBe('America/Chicago');
    });

    it('does not slip to the previous day for a guest east of the venue', () => {
      // Reprojecting the instant put a guest one hour east of Central onto the
      // venue's previous day, which the reservation past-date check then
      // refuses. 24-hour input takes the same path.
      const picked = new Date(2026, 8, 25);
      const start = createDateTimeFromTimeString('19:30', 'America/Chicago', picked);

      expect(start.toFormat('yyyy-MM-dd')).toBe('2026-09-25');
    });

    it('returns null without a time string', () => {
      expect(createDateTimeFromTimeString(null, 'America/Chicago', new Date())).toBeNull();
    });
  });

  describe('localInputToUTC', () => {
    it('should convert datetime-local input to UTC', () => {
      const localInput = '2023-01-01T12:00';
      const result = localInputToUTC(localInput);

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('should handle empty string', () => {
      const result = localInputToUTC('');
      expect(result).toBe('');
    });
  });
});
