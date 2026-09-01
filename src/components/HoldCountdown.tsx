import React from 'react';
import { Box, Text } from '@chakra-ui/react';
import { formatHoldCountdown } from '../lib/holds';

interface HoldCountdownProps {
  /** Seconds left on the hold, or null before one exists. */
  secondsLeft: number | null;
  /** Shown while the hold is being placed. */
  isCreating?: boolean;
  /** Problem placing the hold, if any. */
  error?: string | null;
}

// Under a minute the bar turns urgent
const URGENT_THRESHOLD_SECONDS = 60;

/**
 * Tells the guest how long their table and time are held for. Reassuring while
 * there is plenty of time, insistent once the last minute starts.
 */
const HoldCountdown: React.FC<HoldCountdownProps> = ({
  secondsLeft,
  isCreating,
  error,
}) => {
  if (error) {
    return (
      <Box
        role="status"
        bg="red.50"
        borderWidth="1px"
        borderColor="red.200"
        borderRadius="md"
        px={3}
        py={2}
        mb={3}
      >
        <Text fontSize="sm" color="red.700">
          {error}
        </Text>
      </Box>
    );
  }

  if (isCreating || secondsLeft === null) {
    return (
      <Box
        role="status"
        bg="gray.50"
        borderWidth="1px"
        borderColor="gray.200"
        borderRadius="md"
        px={3}
        py={2}
        mb={3}
      >
        <Text fontSize="sm" color="gray.600">
          Holding your table…
        </Text>
      </Box>
    );
  }

  const expired = secondsLeft <= 0;
  const urgent = !expired && secondsLeft <= URGENT_THRESHOLD_SECONDS;

  return (
    <Box
      role="timer"
      // Announce the remaining time only as it becomes urgent, so screen
      // readers are not interrupted every second
      aria-live={urgent ? 'assertive' : 'polite'}
      bg={expired ? 'red.50' : urgent ? 'orange.50' : 'gray.50'}
      borderWidth="1px"
      borderColor={expired ? 'red.200' : urgent ? 'orange.200' : 'gray.200'}
      borderRadius="md"
      px={3}
      py={2}
      mb={3}
    >
      {expired ? (
        <Text fontSize="sm" color="red.700" fontWeight="medium">
          Your hold expired. Please choose a time again.
        </Text>
      ) : (
        <Text fontSize="sm" color={urgent ? 'orange.800' : 'gray.700'}>
          Your reservation and this window are held for{' '}
          <Text as="span" fontWeight="bold">
            {formatHoldCountdown(secondsLeft)}
          </Text>
        </Text>
      )}
    </Box>
  );
};

export default HoldCountdown;
