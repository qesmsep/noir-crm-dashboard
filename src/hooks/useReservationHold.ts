import { useCallback, useEffect, useRef, useState } from 'react';
import { secondsRemaining } from '../lib/holds';

/**
 * Owns a checkout hold for the duration of a booking flow.
 *
 * Places the hold when checkout opens, counts down every second, re-syncs
 * against the server periodically so a wrong device clock cannot extend the
 * window, upgrades to the payment stage for the extension, and releases the
 * table if the guest walks away.
 */

export interface UseReservationHoldOptions {
  /** Place the hold while true; releasing when it goes false. */
  enabled: boolean;
  startTime: string | null;
  endTime: string | null;
  partySize: number | null;
  locationSlug?: string | null;
  /** Called once when the hold lapses, so the flow can send the guest back. */
  onExpired?: () => void;
}

export interface UseReservationHoldResult {
  holdToken: string | null;
  secondsLeft: number | null;
  isExpired: boolean;
  isCreating: boolean;
  error: string | null;
  /** Grants the payment-step extension. Safe to call more than once. */
  extendForPayment: () => Promise<void>;
  release: () => Promise<void>;
}

// How often to reconcile the local countdown with the server's expiry
const RESYNC_INTERVAL_MS = 30_000;

export function useReservationHold({
  enabled,
  startTime,
  endTime,
  partySize,
  locationSlug,
  onExpired,
}: UseReservationHoldOptions): UseReservationHoldResult {
  const [holdToken, setHoldToken] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs keep the unmount/unload cleanup honest without re-running effects
  const holdTokenRef = useRef<string | null>(null);
  // Identifies the selection the live hold was placed for, so a changed date,
  // time or party size replaces the hold instead of keeping a stale one
  const heldKeyRef = useRef<string | null>(null);
  const expiredFiredRef = useRef(false);
  const onExpiredRef = useRef(onExpired);
  onExpiredRef.current = onExpired;

  const setHold = useCallback((token: string | null, expiry: string | null) => {
    holdTokenRef.current = token;
    setHoldToken(token);
    setExpiresAt(expiry);
    setSecondsLeft(expiry ? secondsRemaining(expiry) : null);
  }, []);

  const releaseToken = useCallback(async (token: string | null) => {
    if (!token) return;
    try {
      await fetch(`/api/holds/${token}`, { method: 'DELETE' });
    } catch (err) {
      // The hold lapses on its own; a failed release is not worth surfacing
      console.error('Failed to release hold:', err);
    }
  }, []);

  const release = useCallback(async () => {
    const token = holdTokenRef.current;
    heldKeyRef.current = null;
    setHold(null, null);
    await releaseToken(token);
  }, [releaseToken, setHold]);

  // Place the hold when checkout opens; release it when it closes
  useEffect(() => {
    let cancelled = false;

    const clearHold = () => {
      const token = holdTokenRef.current;
      holdTokenRef.current = null;
      heldKeyRef.current = null;
      setHoldToken(null);
      setExpiresAt(null);
      setSecondsLeft(null);
      if (token) releaseToken(token);
    };

    if (!enabled || !startTime || !endTime || !partySize) {
      if (holdTokenRef.current) clearHold();
      return;
    }

    const selectionKey = `${startTime}|${endTime}|${partySize}|${locationSlug ?? ''}`;

    // Already holding exactly this selection
    if (holdTokenRef.current && heldKeyRef.current === selectionKey) return;

    // Holding a different selection: give that table back before taking another
    if (holdTokenRef.current) clearHold();

    async function createHold() {
      setIsCreating(true);
      setError(null);
      expiredFiredRef.current = false;
      try {
        const res = await fetch('/api/holds', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            start_time: startTime,
            end_time: endTime,
            party_size: partySize,
            location_slug: locationSlug,
          }),
        });
        const data = await res.json();
        if (cancelled) {
          // Checkout closed while the request was in flight
          if (res.ok && data?.hold_token) releaseToken(data.hold_token);
          return;
        }
        if (!res.ok) {
          setError(data?.error || 'Could not hold that table.');
          return;
        }
        heldKeyRef.current = selectionKey;
        setHold(data.hold_token, data.expires_at);
      } catch (err) {
        if (!cancelled) setError('Could not hold that table. Please try again.');
      } finally {
        if (!cancelled) setIsCreating(false);
      }
    }

    createHold();
    return () => {
      cancelled = true;
    };
  }, [enabled, startTime, endTime, partySize, locationSlug, releaseToken, setHold]);

  // Tick the visible countdown once a second
  useEffect(() => {
    if (!expiresAt) return;

    const tick = () => {
      const left = secondsRemaining(expiresAt);
      setSecondsLeft(left);
      if (left <= 0 && !expiredFiredRef.current) {
        expiredFiredRef.current = true;
        holdTokenRef.current = null;
        heldKeyRef.current = null;
        setHoldToken(null);
        onExpiredRef.current?.();
      }
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  // Reconcile with the server so the countdown cannot drift or be tampered with
  useEffect(() => {
    if (!holdToken) return;

    const id = setInterval(async () => {
      try {
        const res = await fetch(`/api/holds/${holdToken}`);
        if (res.status === 410) {
          setExpiresAt(null);
          setSecondsLeft(0);
          if (!expiredFiredRef.current) {
            expiredFiredRef.current = true;
            holdTokenRef.current = null;
            heldKeyRef.current = null;
            setHoldToken(null);
            onExpiredRef.current?.();
          }
          return;
        }
        if (res.ok) {
          const data = await res.json();
          if (data?.expires_at) setExpiresAt(data.expires_at);
        }
      } catch {
        // Offline or a blip: keep counting down locally
      }
    }, RESYNC_INTERVAL_MS);

    return () => clearInterval(id);
  }, [holdToken]);

  const extendForPayment = useCallback(async () => {
    const token = holdTokenRef.current;
    if (!token) return;
    try {
      const res = await fetch(`/api/holds/${token}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: 'payment' }),
      });
      if (res.status === 410) {
        if (!expiredFiredRef.current) {
          expiredFiredRef.current = true;
          holdTokenRef.current = null;
          heldKeyRef.current = null;
          setHoldToken(null);
          setSecondsLeft(0);
          onExpiredRef.current?.();
        }
        return;
      }
      if (res.ok) {
        const data = await res.json();
        if (data?.expires_at) setExpiresAt(data.expires_at);
      }
    } catch (err) {
      console.error('Failed to extend hold:', err);
    }
  }, []);

  // Give the table back if the guest closes the tab mid-checkout
  useEffect(() => {
    const handleUnload = () => {
      const token = holdTokenRef.current;
      if (!token) return;
      // keepalive lets the request outlive the page
      try {
        fetch(`/api/holds/${token}`, { method: 'DELETE', keepalive: true });
      } catch {
        // nothing more to do on the way out
      }
    };

    window.addEventListener('pagehide', handleUnload);
    return () => {
      window.removeEventListener('pagehide', handleUnload);
      handleUnload();
    };
  }, []);

  return {
    holdToken,
    secondsLeft,
    isExpired: secondsLeft !== null && secondsLeft <= 0,
    isCreating,
    error,
    extendForPayment,
    release,
  };
}
