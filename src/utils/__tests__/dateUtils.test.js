import { toUTC, fromUTC, formatDateTime, localInputToUTC } from '../dateUtils.ts';

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
