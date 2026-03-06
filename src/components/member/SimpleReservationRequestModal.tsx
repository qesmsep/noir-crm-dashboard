import { useState } from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  FormControl,
  FormLabel,
  Select,
  Button,
  Textarea,
  useToast,
  Box,
  VStack,
  Input,
} from '@chakra-ui/react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { DateTime } from 'luxon';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  memberName?: string;
  memberPhone?: string;
  memberId?: string;
  accountId?: string;
  onReservationCreated?: () => void;
}

// Generate time options
const generateTimeSlots = (startHour: number, endHour: number) => {
  const slots: string[] = [];
  for (let hour = startHour; hour <= endHour; hour++) {
    const maxMinute = hour === endHour ? 0 : 45; // Last slot at end hour is :00
    for (let minute = 0; minute <= maxMinute; minute += 15) {
      const h = hour > 12 ? hour - 12 : hour;
      const period = hour >= 12 ? 'PM' : 'AM';
      const m = minute.toString().padStart(2, '0');
      slots.push(`${h}:${m} ${period}`);
    }
  }
  return slots;
};

const thursdayTimeSlots = generateTimeSlots(16, 22); // 4:00 PM to 10:00 PM for Thursday
const fridaySaturdayTimeSlots = generateTimeSlots(18, 23); // 6:00 PM to 11:00 PM for Fri/Sat

export default function SimpleReservationRequestModal({
  isOpen,
  onClose,
  memberName = '',
  memberPhone = '',
  memberId,
  accountId,
  onReservationCreated,
}: Props) {
  const toast = useToast();
  const [date, setDate] = useState<Date | null>(null);
  const [time, setTime] = useState('');
  const [partySize, setPartySize] = useState('2');
  const [notes, setNotes] = useState('');
  const [isCreatingReservation, setIsCreatingReservation] = useState(false);
  const [blockedTimes, setBlockedTimes] = useState<any[]>([]);
  const [loadingTimes, setLoadingTimes] = useState(false);

  // Reset time when date changes if current time is not in new slots
  const handleDateChange = async (newDate: Date) => {
    setDate(newDate);
    setTime('');
    setLoadingTimes(true);

    const abortController = new AbortController();

    try {
      // Fetch blocked times for this date
      const dateStr = DateTime.fromJSDate(newDate).toFormat('yyyy-MM-dd');
      const response = await fetch(`/api/check-date-availability?date=${dateStr}`, {
        signal: abortController.signal,
      });
      const result = await response.json();

      if (response.ok) {
        setBlockedTimes(result.blockedTimeRanges || []);
      } else {
        console.error('Error fetching availability:', result.error);
        setBlockedTimes([]);
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('Error fetching availability:', error);
      }
      setBlockedTimes([]);
    } finally {
      setLoadingTimes(false);
    }

    return () => abortController.abort();
  };

  // Filter time slots based on selected date and blocked times
  const getAvailableTimeSlots = () => {
    if (!date) return [];

    const baseSlots = date.getDay() === 4 ? thursdayTimeSlots : fridaySaturdayTimeSlots;

    // Filter out blocked times
    return baseSlots.filter((slot) => {
      // Parse the slot time (e.g., "6:00 PM")
      const [timeStr, period] = slot.split(' ');
      const [hourStr, minuteStr] = timeStr.split(':');
      let hour = parseInt(hourStr);
      const minute = parseInt(minuteStr);

      // Convert to 24-hour format
      if (period === 'PM' && hour !== 12) {
        hour += 12;
      } else if (period === 'AM' && hour === 12) {
        hour = 0;
      }

      // Check if this time conflicts with any blocked time range
      const isBlocked = blockedTimes.some((blocked) => {
        // Check if the slot falls within a blocked range
        const slotMinutes = hour * 60 + minute;
        const blockStartMinutes = blocked.startHour * 60 + blocked.startMinute;
        const blockEndMinutes = blocked.endHour * 60 + blocked.endMinute;

        return slotMinutes >= blockStartMinutes && slotMinutes < blockEndMinutes;
      });

      return !isBlocked;
    });
  };

  const availableTimeSlots = getAvailableTimeSlots();

  const handleMakeReservation = async () => {
    if (!date || !time) {
      toast({
        title: 'Missing Information',
        description: 'Please select a date and time',
        status: 'error',
        duration: 3000,
      });
      return;
    }

    setIsCreatingReservation(true);

    try {
      // Parse time and create start/end datetime
      const [timeStr, period] = time.split(' ');
      const [hourStr, minuteStr] = timeStr.split(':');
      let hour = parseInt(hourStr);
      const minute = parseInt(minuteStr);

      if (period === 'PM' && hour !== 12) {
        hour += 12;
      } else if (period === 'AM' && hour === 12) {
        hour = 0;
      }

      const startDateTime = DateTime.fromJSDate(date)
        .set({ hour, minute, second: 0, millisecond: 0 })
        .setZone('America/Chicago');

      // End time is 2 hours after start
      const endDateTime = startDateTime.plus({ hours: 2 });

      const response = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start_time: startDateTime.toISO(),
          end_time: endDateTime.toISO(),
          party_size: parseInt(partySize),
          phone: memberPhone,
          first_name: memberName.split(' ')[0],
          last_name: memberName.split(' ').slice(1).join(' '),
          notes: notes || undefined,
          source: 'member_dashboard',
          member_id: memberId,
          account_id: accountId,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create reservation');
      }

      toast({
        title: 'Reservation Confirmed!',
        description: 'Your table has been reserved',
        status: 'success',
        duration: 5000,
      });

      // Call refresh callback if provided
      if (onReservationCreated) {
        onReservationCreated();
      }

      // Reset form
      setDate(null);
      setTime('');
      setPartySize('2');
      setNotes('');
      onClose();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create reservation',
        status: 'error',
        duration: 5000,
      });
    } finally {
      setIsCreatingReservation(false);
    }
  };

  const filterDate = (date: Date) => {
    // Only allow Thursday (4), Friday (5), Saturday (6)
    const day = date.getDay();
    return day === 4 || day === 5 || day === 6;
  };

  const minDate = new Date();
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + 30);

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md" isCentered>
      <ModalOverlay bg="blackAlpha.700" />
      <ModalContent
        bg="white"
        borderRadius="2xl"
        boxShadow="2xl"
        maxW="500px"
        mx={4}
      >
        <ModalHeader>Request a Reservation</ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={6}>
          <VStack spacing={4} align="stretch">
            {/* Date Picker */}
            <FormControl isRequired>
              <FormLabel>Date</FormLabel>
              <Box>
                <DatePicker
                  selected={date}
                  onChange={handleDateChange}
                  minDate={minDate}
                  maxDate={maxDate}
                  filterDate={filterDate}
                  dateFormat="MMMM d, yyyy"
                  placeholderText="Select a date"
                  openToDate={new Date()}
                  customInput={
                    <Input
                      w="full"
                      h="48px"
                      borderColor="gray.200"
                      _hover={{ borderColor: 'gray.300' }}
                      _focus={{ borderColor: '#A59480', boxShadow: '0 0 0 1px #A59480' }}
                      fontSize="md"
                      borderRadius="lg"
                      bg="white"
                      readOnly
                    />
                  }
                  popperPlacement="bottom-start"
                  withPortal={false}
                />
              </Box>
            </FormControl>

            {/* Time Select */}
            <FormControl isRequired>
              <FormLabel>Time</FormLabel>
              <Select
                value={time}
                onChange={(e) => setTime(e.target.value)}
                placeholder={loadingTimes ? 'Loading times...' : availableTimeSlots.length === 0 && date ? 'No times available' : 'Select a time'}
                h="48px"
                borderColor="gray.200"
                _hover={{ borderColor: 'gray.300' }}
                _focus={{ borderColor: '#A59480', boxShadow: '0 0 0 1px #A59480' }}
                fontSize="md"
                borderRadius="lg"
                isDisabled={!date || loadingTimes || availableTimeSlots.length === 0}
              >
                {availableTimeSlots.map((slot) => (
                  <option key={slot} value={slot}>
                    {slot}
                  </option>
                ))}
              </Select>
              {date && !loadingTimes && availableTimeSlots.length === 0 && (
                <Box mt={2} fontSize="sm" color="red.500">
                  No times available on this date. Please select another date.
                </Box>
              )}
            </FormControl>

            {/* Party Size */}
            <FormControl isRequired>
              <FormLabel>Number of Guests</FormLabel>
              <Select
                value={partySize}
                onChange={(e) => setPartySize(e.target.value)}
                h="48px"
                borderColor="gray.200"
                _hover={{ borderColor: 'gray.300' }}
                _focus={{ borderColor: '#A59480', boxShadow: '0 0 0 1px #A59480' }}
                fontSize="md"
                borderRadius="lg"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((num) => (
                  <option key={num} value={num}>
                    {num} {num === 1 ? 'guest' : 'guests'}
                  </option>
                ))}
              </Select>
            </FormControl>

            {/* Special Requests */}
            <FormControl>
              <FormLabel>Special Requests or Notes (Optional)</FormLabel>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any special requests or dietary restrictions..."
                minH="100px"
                borderColor="gray.200"
                _hover={{ borderColor: 'gray.300' }}
                _focus={{ borderColor: '#A59480', boxShadow: '0 0 0 1px #A59480' }}
                fontSize="md"
                borderRadius="lg"
              />
            </FormControl>

            {/* Make Reservation Button */}
            <Button
              onClick={handleMakeReservation}
              isLoading={isCreatingReservation}
              loadingText="Creating..."
              h="48px"
              bg="#2D3748"
              color="white"
              fontSize="md"
              fontWeight="600"
              borderRadius="lg"
              _hover={{ bg: '#1A202C' }}
              _active={{ bg: '#171923' }}
              mt={2}
            >
              Make Reservation
            </Button>
          </VStack>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
