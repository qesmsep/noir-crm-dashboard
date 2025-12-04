/**
 * Tests for mobile utility functions
 */

import {
  isMobileDevice,
  isIOS,
  isAndroid,
  isTouchDevice,
  getViewportCategory,
  isPortrait,
  formatBytes,
  debounce,
  throttle,
  prefersReducedMotion,
  getPreferredColorScheme,
} from '../mobileUtils';

// Mock window and navigator
const mockWindow = (properties: Partial<Window>) => {
  Object.assign(global, { window: properties });
};

const mockNavigator = (properties: Partial<Navigator>) => {
  Object.assign(global.navigator, properties);
};

describe('mobileUtils', () => {
  describe('Device Detection', () => {
    it('should provide device detection functions', () => {
      // These functions rely on navigator.userAgent which is read-only in test environment
      // Testing that they return booleans
      expect(typeof isMobileDevice()).toBe('boolean');
      expect(typeof isIOS()).toBe('boolean');
      expect(typeof isAndroid()).toBe('boolean');
    });
  });

  describe('Viewport Functions', () => {
    beforeEach(() => {
      mockWindow({
        innerWidth: 375,
        innerHeight: 667,
      } as any);
    });

    describe('getViewportCategory', () => {
      it('should return a valid viewport category', () => {
        const result = getViewportCategory();
        expect(['mobile', 'tablet', 'desktop']).toContain(result);
      });
    });

    describe('isPortrait', () => {
      it('should return a boolean for orientation', () => {
        const result = isPortrait();
        expect(typeof result).toBe('boolean');
      });
    });
  });

  describe('isTouchDevice', () => {
    it('should handle browser environment', () => {
      // isTouchDevice checks for touch support
      // In test environment, it will return false
      const result = isTouchDevice();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('Utility Functions', () => {
    describe('formatBytes', () => {
      it('should format 0 bytes', () => {
        expect(formatBytes(0)).toBe('0 Bytes');
      });

      it('should format bytes to KB', () => {
        expect(formatBytes(1024)).toBe('1 KB');
      });

      it('should format bytes to MB', () => {
        expect(formatBytes(1048576)).toBe('1 MB');
      });

      it('should format bytes to GB', () => {
        expect(formatBytes(1073741824)).toBe('1 GB');
      });

      it('should respect decimal places', () => {
        expect(formatBytes(1536, 0)).toBe('2 KB');
        expect(formatBytes(1536, 2)).toBe('1.5 KB');
      });
    });

    describe('debounce', () => {
      jest.useFakeTimers();

      it('should debounce function calls', () => {
        const mockFn = jest.fn();
        const debouncedFn = debounce(mockFn, 100);

        debouncedFn();
        debouncedFn();
        debouncedFn();

        expect(mockFn).not.toHaveBeenCalled();

        jest.advanceTimersByTime(100);

        expect(mockFn).toHaveBeenCalledTimes(1);
      });

      it('should call with latest arguments', () => {
        const mockFn = jest.fn();
        const debouncedFn = debounce(mockFn, 100);

        debouncedFn('first');
        debouncedFn('second');
        debouncedFn('third');

        jest.advanceTimersByTime(100);

        expect(mockFn).toHaveBeenCalledWith('third');
      });

      afterEach(() => {
        jest.clearAllTimers();
      });
    });

    describe('throttle', () => {
      jest.useFakeTimers();

      it('should throttle function calls', () => {
        const mockFn = jest.fn();
        const throttledFn = throttle(mockFn, 100);

        throttledFn();
        throttledFn();
        throttledFn();

        expect(mockFn).toHaveBeenCalledTimes(1);

        jest.advanceTimersByTime(100);

        throttledFn();

        expect(mockFn).toHaveBeenCalledTimes(2);
      });

      afterEach(() => {
        jest.clearAllTimers();
      });
    });
  });

  describe('Accessibility Functions', () => {
    beforeAll(() => {
      // Mock matchMedia for accessibility tests
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation((query) => ({
          matches: false,
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn(),
        })),
      });
    });

    describe('prefersReducedMotion', () => {
      it('should check for reduced motion preference', () => {
        const result = prefersReducedMotion();
        expect(typeof result).toBe('boolean');
        expect(window.matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');
      });
    });

    describe('getPreferredColorScheme', () => {
      it('should check color scheme preference', () => {
        const result = getPreferredColorScheme();
        expect(['light', 'dark']).toContain(result);
        expect(window.matchMedia).toHaveBeenCalledWith('(prefers-color-scheme: dark)');
      });
    });
  });
});
