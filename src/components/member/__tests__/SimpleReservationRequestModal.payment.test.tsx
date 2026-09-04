/**
 * Regression test for the RooftopKC payment loop.
 *
 * The checkout hold counts down once a second, re-rendering the modal. When the
 * payment step was declared inside the modal component, each of those renders
 * produced a new component type and React remounted the Stripe PaymentElement,
 * wiping the card form while guests typed into it.
 *
 * These tests drive the real flow to the payment step and let the real countdown
 * tick, asserting the PaymentElement mounts exactly once.
 */

import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockToast = jest.fn();
jest.mock('@/hooks/useToast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

// src/utils/ carries both a stale dateUtils.js and the current dateUtils.ts.
// Next resolves .ts first, Jest resolves .js first, so point this suite at the
// same module the app actually runs.
jest.mock('@/utils/dateUtils', () => jest.requireActual('@/utils/dateUtils.ts'));

// Counts how many times Stripe's card form is mounted. A remount is the bug.
const paymentElementMounts = jest.fn();
// Counts renders. Mounts staying at 1 only proves the fix if the countdown is
// actually re-rendering the tree; without this the test could pass vacuously.
const paymentElementRenders = jest.fn();

jest.mock('@stripe/stripe-js', () => ({
  loadStripe: () => Promise.resolve({}),
}));

const mockConfirmPayment = jest.fn();

jest.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PaymentElement: () => {
    paymentElementRenders();
    React.useEffect(() => {
      paymentElementMounts();
    }, []);
    return <div data-testid="payment-element" />;
  },
  useStripe: () => ({ confirmPayment: mockConfirmPayment }),
  useElements: () => ({}),
}));

// The real date picker renders a calendar in a portal; a button that reports one
// fixed date keeps the test about the payment step.
jest.mock('react-datepicker', () => ({
  __esModule: true,
  default: ({ onChange }: { onChange: (d: Date) => void }) => (
    <button onClick={() => onChange(new Date('2026-09-10T12:00:00.000Z'))}>pick-date</button>
  ),
}));

const LOCATION = {
  id: 'loc-rooftop',
  cover_enabled: true,
  cover_price: 20,
  weekly_hours: {},
  timezone: 'America/Chicago',
  default_reservation_duration_hours: 2,
};

// Open 6pm-11pm every day, so the test does not depend on which weekday the
// fixed date falls on.
const BASE_HOURS = [0, 1, 2, 3, 4, 5, 6].map((day) => ({
  day_of_week: day,
  type: 'base',
  location_id: LOCATION.id,
  time_ranges: [{ start: '18:00', end: '23:00' }],
}));

jest.mock('@/lib/supabase', () => {
  const resultFor = (table: string, columns: string) => {
    if (table === 'locations') return { data: { name: 'RooftopKC' }, error: null };
    if (table === 'settings') {
      return { data: { booking_start_date: null, booking_end_date: null }, error: null };
    }
    if (table === 'venue_hours') return { data: BASE_HOURS_REF.current, error: null };
    if (table === 'public_locations') {
      if (columns.includes('booking_start_date')) {
        return {
          data: { booking_start_date: null, booking_end_date: null, timezone: 'America/Chicago' },
          error: null,
        };
      }
      return { data: LOCATION_REF.current, error: null };
    }
    return { data: null, error: null };
  };

  // Chainable, awaitable query stub: .select().eq().eq() resolves on its own,
  // and .single() resolves the same payload.
  const makeChain = (table: string, columns: string) => {
    const payload = () => resultFor(table, columns);
    const chain: any = {
      eq: () => chain,
      order: () => chain,
      single: () => Promise.resolve(payload()),
      then: (resolve: any, reject: any) => Promise.resolve(payload()).then(resolve, reject),
    };
    return chain;
  };

  return {
    supabase: {
      from: (table: string) => ({
        select: (columns = '') => makeChain(table, columns),
      }),
      auth: { getSession: () => Promise.resolve({ data: { session: null } }) },
    },
  };
});

// Referenced from inside the jest.mock factory, which is hoisted above the
// const declarations above it.
const LOCATION_REF = { current: LOCATION };
const BASE_HOURS_REF = { current: BASE_HOURS };

import SimpleReservationRequestModal from '@/components/member/SimpleReservationRequestModal';

// ── fetch routing ──────────────────────────────────────────────────────────

const jsonResponse = (body: any, status = 200) =>
  Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response);

let createPaymentCalls = 0;
let failReservation = false;
let cancelPaymentCalls = 0;

const routeFetch = (input: RequestInfo | URL) => {
  const url = typeof input === 'string' ? input : String(input);

  if (url.includes('/api/tables')) return jsonResponse({ data: [] });
  if (url.includes('/api/check-date-availability')) return jsonResponse({ blockedTimeRanges: [] });
  if (url.includes('/api/cancel-payment')) {
    cancelPaymentCalls += 1;
    return jsonResponse({ cancelled: true });
  }
  if (url.includes('/api/capture-payment')) return jsonResponse({ captured: true });
  if (url.includes('/api/reservations')) {
    if (failReservation) return jsonResponse({ error: 'No tables available at that time' }, 409);
    return jsonResponse({ data: { id: 'res-1' } });
  }
  if (url.includes('/api/holds')) {
    return jsonResponse({
      hold_token: 'hold-123',
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });
  }
  if (url.includes('/api/create-cover-charge-payment')) {
    createPaymentCalls += 1;
    return jsonResponse({
      clientSecret: `cs_test_${createPaymentCalls}`,
      paymentIntentId: `pi_test_${createPaymentCalls}`,
    });
  }
  return jsonResponse({});
};

// ── helpers ────────────────────────────────────────────────────────────────

const flush = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

/** Fills the form and submits it, leaving the modal on the payment step. */
const reachPaymentStep = async () => {
  render(
    <SimpleReservationRequestModal
      isOpen
      onClose={jest.fn()}
      memberPhone="(913)555-0100"
      locationSlug="rooftopkc"
      hideTableSelection
    />
  );

  // Location, hours and the 30-day blocked-date sweep
  await flush();

  fireEvent.change(screen.getByPlaceholderText('First Name*'), { target: { value: 'Ada' } });
  fireEvent.change(screen.getByPlaceholderText('Last Name*'), { target: { value: 'Lovelace' } });

  fireEvent.click(screen.getByText('pick-date'));
  await flush();

  fireEvent.click(screen.getByPlaceholderText('Time*'));
  const slot = screen
    .getAllByRole('button')
    .find((button) => button.textContent === '7:00PM');
  fireEvent.click(slot!);
  await flush();

  fireEvent.click(screen.getByText('Make Reservation'));
  await flush();

  await waitFor(() => expect(screen.getByTestId('payment-element')).toBeInTheDocument());
};

// ── tests ──────────────────────────────────────────────────────────────────

describe('SimpleReservationRequestModal payment step', () => {
  beforeEach(() => {
    createPaymentCalls = 0;
    cancelPaymentCalls = 0;
    failReservation = false;
    paymentElementMounts.mockClear();
    paymentElementRenders.mockClear();
    mockConfirmPayment.mockResolvedValue({
      paymentIntent: { id: 'pi_authorized', status: 'requires_capture' },
    });
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-04T18:00:00.000Z'));
    global.fetch = jest.fn(routeFetch) as unknown as typeof fetch;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('mounts the Stripe card form once, not on every hold-countdown tick', async () => {
    await reachPaymentStep();
    expect(paymentElementMounts).toHaveBeenCalledTimes(1);
    const rendersBefore = paymentElementRenders.mock.calls.length;

    // Five seconds of the checkout countdown, which re-renders the modal each tick
    for (let i = 0; i < 5; i += 1) {
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });
    }

    // The ticks really did re-render the tree, so the mount count below is
    // meaningful rather than a countdown that quietly stopped
    expect(paymentElementRenders.mock.calls.length).toBeGreaterThan(rendersBefore);

    // The card form survived those re-renders instead of being torn down and rebuilt
    expect(screen.getByTestId('payment-element')).toBeInTheDocument();
    expect(paymentElementMounts).toHaveBeenCalledTimes(1);
  });

  it('creates exactly one PaymentIntent for one trip through checkout', async () => {
    await reachPaymentStep();

    for (let i = 0; i < 5; i += 1) {
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });
    }

    expect(createPaymentCalls).toBe(1);
  });

  it('returns to the form and mints a fresh PaymentIntent when the booking fails after authorization', async () => {
    await reachPaymentStep();
    expect(createPaymentCalls).toBe(1);

    // Stripe authorizes, then the reservation cannot be created
    failReservation = true;
    fireEvent.click(screen.getByText(/^Authorize \$/));
    await flush();

    // The spent authorization is cancelled and the payment step is torn down
    await waitFor(() => expect(screen.queryByTestId('payment-element')).not.toBeInTheDocument());
    expect(cancelPaymentCalls).toBe(1);
    expect(screen.getByText('Make Reservation')).toBeInTheDocument();

    // The guest's details survived, so submitting again goes straight back to
    // payment - on a new PaymentIntent, not the dead one
    failReservation = false;
    fireEvent.click(screen.getByText('Make Reservation'));
    await flush();

    await waitFor(() => expect(screen.getByTestId('payment-element')).toBeInTheDocument());
    expect(createPaymentCalls).toBe(2);
  });
});
