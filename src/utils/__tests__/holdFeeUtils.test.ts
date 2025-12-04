/**
 * Tests for holdFeeUtils
 * These tests cover the hold fee calculation logic
 */

import { getHoldAmount, HoldFeeConfig } from '../holdFeeUtils';

describe('holdFeeUtils', () => {
  describe('getHoldAmount', () => {
    it('should return 0 when hold fee is disabled', () => {
      const config: HoldFeeConfig = {
        enabled: false,
        amount: 50,
      };

      expect(getHoldAmount(4, config)).toBe(0);
      expect(getHoldAmount(2, config)).toBe(0);
    });

    it('should return the configured amount when hold fee is enabled', () => {
      const config: HoldFeeConfig = {
        enabled: true,
        amount: 50,
      };

      expect(getHoldAmount(4, config)).toBe(50);
      expect(getHoldAmount(2, config)).toBe(50);
    });

    it('should work with different hold fee amounts', () => {
      const config100: HoldFeeConfig = {
        enabled: true,
        amount: 100,
      };

      expect(getHoldAmount(6, config100)).toBe(100);

      const config25: HoldFeeConfig = {
        enabled: true,
        amount: 25,
      };

      expect(getHoldAmount(2, config25)).toBe(25);
    });

    it('should handle zero amount configuration', () => {
      const config: HoldFeeConfig = {
        enabled: true,
        amount: 0,
      };

      expect(getHoldAmount(4, config)).toBe(0);
    });

    it('should handle edge cases for party size', () => {
      const config: HoldFeeConfig = {
        enabled: true,
        amount: 50,
      };

      // Party size shouldn't affect amount (based on current implementation)
      expect(getHoldAmount(1, config)).toBe(50);
      expect(getHoldAmount(20, config)).toBe(50);
      expect(getHoldAmount(100, config)).toBe(50);
    });
  });
});
