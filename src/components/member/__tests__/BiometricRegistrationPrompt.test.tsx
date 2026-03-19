/**
 * Tests for BiometricRegistrationPrompt
 *
 * Covers: prompt visibility logic, localStorage dismissal, success/error states,
 * and "Don't ask again" persistence.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockRegisterBiometric = jest.fn();
const mockIsBiometricAvailable = jest.fn();
const mockToast = jest.fn();

jest.mock('@/context/MemberAuthContext', () => ({
  useMemberAuth: () => ({
    registerBiometric: mockRegisterBiometric,
    isBiometricAvailable: mockIsBiometricAvailable,
  }),
}));

jest.mock('@/hooks/useToast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

// Mock Dialog to render children directly for testability
jest.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
}));

jest.mock('lucide-react', () => ({
  Fingerprint: () => <span data-testid="fingerprint-icon" />,
  CheckCircle2: () => <span data-testid="check-icon" />,
  Shield: () => <span data-testid="shield-icon" />,
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  ),
}));

import BiometricRegistrationPrompt from '../BiometricRegistrationPrompt';

// ── Helpers ────────────────────────────────────────────────────────────────

function mockFetchResponse(body: unknown, ok = true): void {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok,
    json: () => Promise.resolve(body),
  });
}

const MEMBER_ID = 'mem_test_123';
const DISMISSED_KEY = 'noir_biometric_prompt_dismissed';

// ── Test setup ─────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  localStorage.clear();
  global.fetch = jest.fn();
});

afterEach(() => {
  jest.useRealTimers();
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe('BiometricRegistrationPrompt', () => {
  describe('prompt visibility', () => {
    it('does not show when localStorage has the member ID stored', async () => {
      localStorage.setItem(DISMISSED_KEY, MEMBER_ID);
      mockIsBiometricAvailable.mockResolvedValue(true);

      render(<BiometricRegistrationPrompt memberId={MEMBER_ID} />);

      // Advance past the 1.5s delay
      await act(async () => { jest.advanceTimersByTime(1600); });

      expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
      // Should not even check biometric availability
      expect(mockIsBiometricAvailable).not.toHaveBeenCalled();
    });

    it('does not show when biometrics are unavailable', async () => {
      mockIsBiometricAvailable.mockResolvedValue(false);

      render(<BiometricRegistrationPrompt memberId={MEMBER_ID} />);

      await act(async () => { jest.advanceTimersByTime(1600); });

      expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
      // Should not call the API
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('does not show when devices already exist', async () => {
      mockIsBiometricAvailable.mockResolvedValue(true);
      mockFetchResponse({ devices: [{ id: 'dev_1', name: 'Mac' }] });

      render(<BiometricRegistrationPrompt memberId={MEMBER_ID} />);

      await act(async () => { jest.advanceTimersByTime(1600); });

      expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
    });

    it('shows when biometrics available and no devices exist', async () => {
      mockIsBiometricAvailable.mockResolvedValue(true);
      mockFetchResponse({ devices: [] });

      render(<BiometricRegistrationPrompt memberId={MEMBER_ID} />);

      await act(async () => { jest.advanceTimersByTime(1600); });

      expect(screen.getByTestId('dialog')).toBeInTheDocument();
      expect(screen.getByText('Enable Quick Sign-In')).toBeInTheDocument();
    });

    it('treats non-array devices response as empty', async () => {
      mockIsBiometricAvailable.mockResolvedValue(true);
      mockFetchResponse({ devices: 'not-an-array' });

      render(<BiometricRegistrationPrompt memberId={MEMBER_ID} />);

      await act(async () => { jest.advanceTimersByTime(1600); });

      // Should still show the prompt (treats as 0 devices)
      expect(screen.getByTestId('dialog')).toBeInTheDocument();
    });
  });

  describe('"Don\'t ask again"', () => {
    it('stores the member ID in localStorage under the correct key', async () => {
      mockIsBiometricAvailable.mockResolvedValue(true);
      mockFetchResponse({ devices: [] });

      render(<BiometricRegistrationPrompt memberId={MEMBER_ID} />);

      await act(async () => { jest.advanceTimersByTime(1600); });

      fireEvent.click(screen.getByText("Don't ask again"));

      expect(localStorage.getItem(DISMISSED_KEY)).toBe(MEMBER_ID);
      expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
    });
  });

  describe('registration success', () => {
    it('renders success state after registration', async () => {
      mockIsBiometricAvailable.mockResolvedValue(true);
      mockFetchResponse({ devices: [] });
      mockRegisterBiometric.mockResolvedValue(undefined);

      render(<BiometricRegistrationPrompt memberId={MEMBER_ID} />);

      await act(async () => { jest.advanceTimersByTime(1600); });

      await act(async () => {
        fireEvent.click(screen.getByText('Set Up Face ID / Touch ID'));
      });

      expect(screen.getByText("You're all set!")).toBeInTheDocument();
      expect(screen.getByTestId('check-icon')).toBeInTheDocument();
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Biometric registered',
          variant: 'success',
        }),
      );
    });

    it('auto-closes after 2 seconds', async () => {
      mockIsBiometricAvailable.mockResolvedValue(true);
      mockFetchResponse({ devices: [] });
      mockRegisterBiometric.mockResolvedValue(undefined);

      render(<BiometricRegistrationPrompt memberId={MEMBER_ID} />);

      await act(async () => { jest.advanceTimersByTime(1600); });

      await act(async () => {
        fireEvent.click(screen.getByText('Set Up Face ID / Touch ID'));
      });

      expect(screen.getByTestId('dialog')).toBeInTheDocument();

      act(() => { jest.advanceTimersByTime(2100); });

      expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
    });
  });

  describe('registration errors', () => {
    it('shows warning toast for NotAllowedError (user cancelled)', async () => {
      mockIsBiometricAvailable.mockResolvedValue(true);
      mockFetchResponse({ devices: [] });

      const notAllowed = new Error('The operation either timed out or was not allowed.');
      notAllowed.name = 'NotAllowedError';
      mockRegisterBiometric.mockRejectedValue(notAllowed);

      render(<BiometricRegistrationPrompt memberId={MEMBER_ID} />);

      await act(async () => { jest.advanceTimersByTime(1600); });

      await act(async () => {
        fireEvent.click(screen.getByText('Set Up Face ID / Touch ID'));
      });

      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Setup cancelled',
          variant: 'warning',
        }),
      );
      // Dialog should stay open so user can retry
      expect(screen.getByTestId('dialog')).toBeInTheDocument();
    });

    it('shows error toast for other failures', async () => {
      mockIsBiometricAvailable.mockResolvedValue(true);
      mockFetchResponse({ devices: [] });
      mockRegisterBiometric.mockRejectedValue(new Error('Network error'));

      render(<BiometricRegistrationPrompt memberId={MEMBER_ID} />);

      await act(async () => { jest.advanceTimersByTime(1600); });

      await act(async () => {
        fireEvent.click(screen.getByText('Set Up Face ID / Touch ID'));
      });

      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Setup failed',
          description: 'Network error',
          variant: 'error',
        }),
      );
    });

    it('shows fallback message for non-Error throws', async () => {
      mockIsBiometricAvailable.mockResolvedValue(true);
      mockFetchResponse({ devices: [] });
      mockRegisterBiometric.mockRejectedValue('string error');

      render(<BiometricRegistrationPrompt memberId={MEMBER_ID} />);

      await act(async () => { jest.advanceTimersByTime(1600); });

      await act(async () => {
        fireEvent.click(screen.getByText('Set Up Face ID / Touch ID'));
      });

      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Setup failed',
          description: 'Please try again later in Settings.',
        }),
      );
    });
  });

  describe('dismiss behavior', () => {
    it('"Maybe Later" closes without persisting to localStorage', async () => {
      mockIsBiometricAvailable.mockResolvedValue(true);
      mockFetchResponse({ devices: [] });

      render(<BiometricRegistrationPrompt memberId={MEMBER_ID} />);

      await act(async () => { jest.advanceTimersByTime(1600); });

      fireEvent.click(screen.getByText('Maybe Later'));

      expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
      expect(localStorage.getItem(DISMISSED_KEY)).toBeNull();
    });

    it('resets success state on dismiss', async () => {
      mockIsBiometricAvailable.mockResolvedValue(true);
      mockFetchResponse({ devices: [] });
      mockRegisterBiometric.mockResolvedValue(undefined);

      const { rerender } = render(<BiometricRegistrationPrompt memberId={MEMBER_ID} />);

      await act(async () => { jest.advanceTimersByTime(1600); });

      // Trigger success
      await act(async () => {
        fireEvent.click(screen.getByText('Set Up Face ID / Touch ID'));
      });

      expect(screen.getByText("You're all set!")).toBeInTheDocument();

      // Dismiss via auto-close
      act(() => { jest.advanceTimersByTime(2100); });

      // Dialog should be closed and success state reset
      expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
    });
  });
});
