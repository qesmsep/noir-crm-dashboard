import React from 'react';
import { formatHoldCountdown } from '../lib/holds';

interface HoldCountdownProps {
  /** Seconds left on the hold, or null before one exists. */
  secondsLeft: number | null;
  /** Shown while the hold is being placed. */
  isCreating?: boolean;
  /** Problem placing the hold, if any. */
  error?: string | null;
  /** Extra styles for the container, so each flow can match its own layout. */
  style?: React.CSSProperties;
}

// Under a minute the notice turns urgent
const URGENT_THRESHOLD_SECONDS = 60;

const baseStyle: React.CSSProperties = {
  borderRadius: '10px',
  borderWidth: '1px',
  borderStyle: 'solid',
  padding: '10px 12px',
  marginBottom: '12px',
  fontSize: '14px',
  lineHeight: 1.4,
};

/**
 * Tells the guest how long their table and time are held for. Reassuring while
 * there is plenty of time, insistent once the last minute starts.
 *
 * Deliberately styled inline rather than with a UI kit, so the public booking
 * form and the member portal - which style themselves differently - can share it.
 */
const HoldCountdown: React.FC<HoldCountdownProps> = ({
  secondsLeft,
  isCreating,
  error,
  style,
}) => {
  if (error) {
    return (
      <div
        role="status"
        style={{ ...baseStyle, background: '#FEF2F2', borderColor: '#FECACA', color: '#B91C1C', ...style }}
      >
        {error}
      </div>
    );
  }

  if (isCreating || secondsLeft === null) {
    return (
      <div
        role="status"
        style={{ ...baseStyle, background: '#F9FAFB', borderColor: '#E5E7EB', color: '#6B7280', ...style }}
      >
        Holding your table&hellip;
      </div>
    );
  }

  const expired = secondsLeft <= 0;
  const urgent = !expired && secondsLeft <= URGENT_THRESHOLD_SECONDS;

  if (expired) {
    return (
      <div
        role="status"
        style={{ ...baseStyle, background: '#FEF2F2', borderColor: '#FECACA', color: '#B91C1C', fontWeight: 500, ...style }}
      >
        Your hold expired. Please choose a time again.
      </div>
    );
  }

  return (
    <div
      role="timer"
      // Announce the remaining time only once it becomes urgent, so screen
      // readers are not interrupted every second
      aria-live={urgent ? 'assertive' : 'polite'}
      style={{
        ...baseStyle,
        background: urgent ? '#FFF7ED' : '#F9FAFB',
        borderColor: urgent ? '#FED7AA' : '#E5E7EB',
        color: urgent ? '#9A3412' : '#374151',
        ...style,
      }}
    >
      Your reservation and this window are held for{' '}
      <strong>{formatHoldCountdown(secondsLeft)}</strong>
    </div>
  );
};

export default HoldCountdown;
