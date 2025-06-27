import { useDisclosure, Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalFooter, ModalCloseButton, Input, Select, Button, HStack, Box, Text, VStack, FormControl, FormLabel, useToast, Divider, Flex, useTheme } from '@chakra-ui/react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import React, { useState, useEffect } from 'react';
import { createDateFromTimeString, toCSTISOString } from '../utils/dateUtils';
import { supabase } from '../pages/api/supabaseClient';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import "./ReservationForm.css";
import { CalendarIcon } from '@chakra-ui/icons';

interface ReservationFormProps {
  initialStart?: string;
  initialEnd?: string;
  onSave?: (data: any) => void;
  table_id?: string;
  bookingStartDate?: Date;
  bookingEndDate?: Date;
  onDelete?: () => void;
  isEdit?: boolean;
  isMember?: boolean;
  onClose?: () => void;
  baseDays?: number[];
}

interface FormData {
  phone: string;
  party_size: number;
  event_type: string;
  notes: string;
  email: string;
  first_name: string;
  last_name: string;
}

// Generate time options for 6:00pm to midnight, every 15 min
const times: string[] = [];
const startHour = 18; // 6 PM
const endHour = 24;   // Midnight
for(let h = startHour; h < endHour; h++){
  for(let m = 0; m < 60; m += 15){
    const hh = String(h).padStart(2,'0');
    const mm = String(m).padStart(2,'0');
    times.push(`${hh}:${mm}`);
  }
}

const eventTypes = [
  { value: 'birthday', label: '🎂 Birthday' },
  { value: 'engagement', label: '💍 Engagement' },
  { value: 'anniversary', label: '🥂 Anniversary' },
  { value: 'party', label: '🎉 Party / Celebration' },
  { value: 'graduation', label: '🎓 Graduation' },
  { value: 'corporate', label: '🧑‍💼 Corporate Event' },
  { value: 'holiday', label: '❄️ Holiday Gathering' },
  { value: 'networking', label: '🤝 Networking' },
  { value: 'fundraiser', label: '🎗️ Fundraiser / Charity' },
  { value: 'bachelor', label: '🥳 Bachelor / Bachelorette Party' },
  { value: 'fun', label: '🍸 Fun Night Out' },
  { value: 'date', label: '💕 Date Night' },
];

// Helper to format date as M/D/YYYY
function formatDateMDY(date: Date) {
  if (!date) return '';
  return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
}

// Helper to find first available date
function findFirstAvailableDate(startDate: Date, baseDays: number[], exceptionalClosures: string[], exceptionalOpens: string[], privateEventDates: string[]): Date {
  let currentDate = new Date(startDate);
  while (true) {
    const iso = currentDate.toISOString().slice(0, 10);
    const isExceptionalOpen = exceptionalOpens.includes(iso);
    const isBaseDay = baseDays.includes(currentDate.getDay());
    const isClosed = exceptionalClosures.includes(iso);
    const isPrivateEvent = privateEventDates.includes(iso);
    
    if ((isExceptionalOpen || isBaseDay) && !isClosed && !isPrivateEvent) {
      return currentDate;
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }
}

// Add this helper function near the top of the component
function getHoldAmount(partySize: number): number {
  return 1;
}

const ReservationForm: React.FC<ReservationFormProps> = ({
  initialStart,
  initialEnd,
  onSave,
  table_id,
  bookingStartDate,
  bookingEndDate,
  onDelete,
  isEdit,
  isMember = false,
  onClose,
  baseDays = []
}) => {
  const toast = useToast();
  const { colors } = useTheme();
  // Booking window logic: today or bookingStartDate (if in future)
  const today = new Date();
  const effectiveStartDate = bookingStartDate && bookingStartDate > today ? bookingStartDate : today;
  const safeInitialStart = initialStart ? new Date(initialStart) : new Date();
  const safeInitialEnd = initialEnd ? new Date(initialEnd) : new Date();
  const [form, setForm] = useState<FormData>({
    phone: '',
    party_size: 2,
    event_type: '',
    notes: '',
    email: '',
    first_name: '',
    last_name: ''
  });
  const [date, setDate] = useState(() => {
    let d = new Date(effectiveStartDate);
    return d;
  });
  const [time, setTime] = useState('');
  const { isOpen, onOpen, onClose: disclosureOnClose } = useDisclosure();
  const [showCreditCardModal, setShowCreditCardModal] = useState(false);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [confirmationData, setConfirmationData] = useState<any>(null);
  const [pendingReservation, setPendingReservation] = useState<any>(null);
  const [availableTimes, setAvailableTimes] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [displayPhone, setDisplayPhone] = useState('');
  const [currentReservationData, setCurrentReservationData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const stripe = useStripe();
  const elements = useElements();
  const [exceptionalClosures, setExceptionalClosures] = useState<string[]>([]); // ISO date strings
  const [exceptionalOpens, setExceptionalOpens] = useState<string[]>([]);
  const [privateEventDates, setPrivateEventDates] = useState<string[]>([]);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [alternativeTimes, setAlternativeTimes] = useState<{
    before: string | null;
    after: string | null;
  } | null>(null);
  const [showAlternativeTimesModal, setShowAlternativeTimesModal] = useState(false);

  useEffect(() => {
    if (!bookingStartDate) return;
    let d = new Date(effectiveStartDate);
    // Wait for baseDays to be loaded
    if (baseDays.length > 0) {
      while (!baseDays.includes(d.getDay())) {
        d.setDate(d.getDate() + 1);
      }
    }
    setDate(d);
  }, [bookingStartDate, baseDays]);

  // Fetch baseDays from supabase on mount
  useEffect(() => {
    async function loadBaseDays() {
      // fetch enabled weekdays from Supabase
      const { data } = await supabase
        .from('venue_hours')
        .select('day_of_week')
        .eq('type', 'base')
        .gte('time_ranges', '[]');
      if (data) {
        console.log('Loaded baseDays from Supabase:', data);
        // setBaseDays(data.map(r => typeof r.day_of_week === 'string' ? Number(r.day_of_week) : r.day_of_week));
      }
    }
    loadBaseDays();
  }, []);

  // Fetch available times when date or party_size changes
  useEffect(() => {
    // Only fetch if the selected date is allowed
    if (!date || !Array.isArray(baseDays) || !baseDays.includes(date.getDay())) {
      setAvailableTimes([]);
      return;
    }
    async function fetchAvailableTimes() {
      if (!date || !form.party_size) return;
      const res = await fetch('/api/available-slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, party_size: form.party_size })
      });

      if (!res.ok) {
        console.error('Error fetching available slots:', await res.text());
        setAvailableTimes([]);
        return;
      }

      const { slots } = await res.json();
      setAvailableTimes(Array.isArray(slots) ? slots : []);
    }
    fetchAvailableTimes();
  }, [date, form.party_size, baseDays]);

  // Set default time only when availableTimes changes and current time is not in slots
  useEffect(() => {
    if (availableTimes.length > 0 && !availableTimes.includes(time)) {
      setTime(availableTimes[0] || '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableTimes]);

  // Fetch exceptional closures, opens, and private events for the booking window
  useEffect(() => {
    async function fetchBlockedDates() {
      // Get booking window range
      const start = bookingStartDate ? new Date(bookingStartDate) : new Date();
      const end = bookingEndDate ? new Date(bookingEndDate) : new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
      // Exceptional Closures (full day)
      const { data: closures } = await supabase
        .from('venue_hours')
        .select('date, full_day')
        .eq('type', 'exceptional_closure');
      setExceptionalClosures(
        (closures || [])
          .filter((c: any) => c.full_day !== false)
          .map((c: any) => c.date)
      );
      // Exceptional Opens
      const { data: opens } = await supabase
        .from('venue_hours')
        .select('date')
        .eq('type', 'exceptional_open');
      setExceptionalOpens((opens || []).map((o: any) => o.date));
      // Private Events (any event that blocks the whole day)
      const { data: events } = await supabase
        .from('private_events')
        .select('start_time, end_time')
        .gte('start_time', start.toISOString())
        .lte('end_time', end.toISOString());
      // Collect all dates covered by private events
      const eventDates = new Set<string>();
      (events || []).forEach((ev: any) => {
        const d0 = new Date(ev.start_time);
        const d1 = new Date(ev.end_time);
        for (let d = new Date(d0); d <= d1; d.setDate(d.getDate() + 1)) {
          eventDates.add(d.toISOString().slice(0, 10));
        }
      });
      setPrivateEventDates(Array.from(eventDates));
    }
    fetchBlockedDates();
  }, [bookingStartDate, bookingEndDate]);

  // Update date when all required data is loaded
  useEffect(() => {
    if (
      isInitialLoad &&
      baseDays.length > 0 &&
      exceptionalClosures.length >= 0 &&
      exceptionalOpens.length >= 0 &&
      privateEventDates.length >= 0
    ) {
      const firstAvailable = findFirstAvailableDate(
        effectiveStartDate,
        baseDays,
        exceptionalClosures,
        exceptionalOpens,
        privateEventDates
      );
      setDate(firstAvailable);
      setIsInitialLoad(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseDays, exceptionalClosures, exceptionalOpens, privateEventDates]);

  // Step 1: Inline fields
  const handleInlineChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => 
    setForm({ ...form, [e.target.name]: e.target.value });
  
  const handleDateChange = (date: Date | null) => {
    if (date) setDate(date);
  };
  
  const handleTimeChange = (e: React.ChangeEvent<HTMLSelectElement>) => setTime(e.target.value);
  
  const handlePartySizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => 
    setForm({ ...form, party_size: Number(e.target.value) });

  // Format phone number for display: (XXX) XXX-XXXX
  function formatPhoneDisplay(value: string): string {
    const digits = value.replace(/\D/g, '');
    if (digits.length === 0) return '';
    if (digits.length <= 3) return `(${digits}`;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
  }

  // Format phone number for storage: +1XXXXXXXXXX
  function formatPhoneStorage(value: string): string {
    const digits = value.replace(/\D/g, '');
    if (digits.length === 0) return '';
    return `+1${digits.slice(0, 10)}`;
  }

  // Handle phone input change
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const digits = raw.replace(/\D/g, '');
    setDisplayPhone(formatPhoneDisplay(digits));
    setForm({ ...form, phone: digits.length > 0 ? formatPhoneStorage(digits) : '' });
  };

  // Sync displayPhone if form.phone is set programmatically
  useEffect(() => {
    if (!form.phone) {
      setDisplayPhone('');
    } else {
      const digits = form.phone.replace(/\D/g, '').slice(1); // remove leading 1
      setDisplayPhone(formatPhoneDisplay(digits));
    }
  }, [form.phone]);

  // Step 2: Modal fields
  const handleModalChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => 
    setForm({ ...form, [e.target.name]: e.target.value });
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onClose?.();
    setShowCreditCardModal(true);
  };

  const handleReservationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    // Validate date
    if (!date || isNaN(date.getTime())) {
      toast({
        title: 'Invalid date',
        description: 'Please select a valid reservation date.',
        status: 'error',
        duration: 3000,
      });
      setIsSubmitting(false);
      return;
    }
    // Validate time
    if (!time) {
      toast({
        title: 'Time required',
        description: 'Please select a reservation time.',
        status: 'error',
        duration: 3000,
      });
      setIsSubmitting(false);
      return;
    }

    // Validate required fields
    if (!form.phone) {
      toast({
        title: 'Phone number required',
        description: 'Please provide a phone number to proceed with the reservation.',
        status: 'error',
        duration: 3000,
      });
      setIsSubmitting(false);
      return;
    }

    // For non-members, validate additional required fields
    if (!isMember && (!form.email || !form.first_name || !form.last_name)) {
      toast({
        title: 'Missing information',
        description: 'Please provide your email, first name, and last name.',
        status: 'error',
        duration: 3000,
      });
      setIsSubmitting(false);
      return;
    }

    // Build start time in CST
    const start = createDateFromTimeString(time, 'America/Chicago', date);
    const durationMinutes = form.party_size <= 2 ? 90 : 120;
    const end = new Date(start.getTime() + durationMinutes * 60000);

    // Prepare reservation data
    const reservationData = {
      start_time: toCSTISOString(start),
      end_time: toCSTISOString(end),
      party_size: form.party_size,
      event_type: form.event_type,
      notes: form.notes,
      phone: form.phone, // Already formatted as +1XXXXXXXXXX
      email: form.email,
      first_name: form.first_name,
      last_name: form.last_name,
      is_member: isMember,
      status: 'confirmed'
    };

    setCurrentReservationData(reservationData);

    try {
      // For members, verify membership status
      if (isMember) {
        console.log('Verifying member with phone:', form.phone);
        console.log('Form data:', form);
        
        const { data: member, error: memberError } = await supabase
          .from('members')
          .select('member_id, first_name, last_name, phone')
          .eq('phone', form.phone)
          .single();

        console.log('Member verification response:', { member, memberError });

        if (memberError) {
          console.error('Member verification error:', memberError);
          toast({
            title: 'Invalid member',
            description: 'The provided phone number is not associated with a member account.',
            status: 'error',
            duration: 3000,
          });
          setIsSubmitting(false);
          return;
        }

        if (!member) {
          console.log('No member found with phone:', form.phone);
          toast({
            title: 'Invalid member',
            description: 'The provided phone number is not associated with a member account.',
            status: 'error',
            duration: 3000,
          });
          setIsSubmitting(false);
          return;
        }

        console.log('Member found:', member);
        console.log('Preparing reservation data:', reservationData);

        // Send reservation data to backend for members
        try {
          console.log('Sending reservation request to API...');
          const response = await fetch('/api/reservations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...reservationData,
              member_id: member.member_id // Add member_id to the reservation data
            }),
          });
          
          console.log('API Response status:', response.status);
          const data = await response.json();
          console.log('API Response data:', data);

          if (!response.ok) {
            // Check if this is a 409 status with alternative times
            if (response.status === 409 && data.alternative_times) {
              setAlternativeTimes(data.alternative_times);
              setShowAlternativeTimesModal(true);
              return;
            }
            throw new Error(data.error || 'Failed to create reservation');
          }
          
          const confirmedReservation = data;
          console.log('Reservation confirmed:', confirmedReservation);
          
          setConfirmationData(confirmedReservation);
          setShowConfirmationModal(true);
          if (onSave) {
            onSave(confirmedReservation);
          }
          if (onClose) {
            onClose();
          }
        } catch (error) {
          console.error('Error creating reservation:', error);
          throw error;
        } finally {
          setIsSubmitting(false);
        }
        return;
      }

      // For non-members, use Stripe.js to create a PaymentMethod with the card details, then send only the paymentMethod.id and reservation data to the backend
      if (!isMember) {
        if (!stripe || !elements) {
          toast({
            title: 'Stripe not loaded',
            description: 'Please try again in a moment.',
            status: 'error',
            duration: 3000,
          });
          setIsSubmitting(false);
          return;
        }
        // Create payment method
        const cardElement = elements.getElement(CardElement);
        if (!cardElement) {
          toast({
            title: 'Card error',
            description: 'Card input not found. Please try again.',
            status: 'error',
            duration: 3000,
          });
          setIsSubmitting(false);
          return;
        }
        const { error: pmError, paymentMethod } = await stripe.createPaymentMethod({
          type: 'card',
          card: cardElement,
          billing_details: {
            name: `${form.first_name} ${form.last_name}`.trim(),
            email: form.email,
          },
        });
        if (pmError || !paymentMethod) {
          toast({
            title: 'Card error',
            description: pmError?.message || 'Failed to create payment method',
            status: 'error',
            duration: 3000,
          });
          setIsSubmitting(false);
          return;
        }
        // Send reservation data and paymentMethod.id to backend
        const response = await fetch('/api/reservations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...reservationData,
            payment_method_id: paymentMethod.id,
          }),
        });
        const data = await response.json();
        if (!response.ok) {
          // Check if this is a 409 status with alternative times
          if (response.status === 409 && data.alternative_times) {
            setAlternativeTimes(data.alternative_times);
            setShowAlternativeTimesModal(true);
            return;
          }
          throw new Error(data.error || 'Failed to create reservation');
        }
        const confirmedReservation = data;
        setConfirmationData(confirmedReservation);
        setShowConfirmationModal(true);
        if (onSave) {
          onSave(confirmedReservation);
        }
        if (onClose) {
          onClose();
        }
        setIsSubmitting(false);
        return;
      }
    } catch (error: any) {
      toast({
        title: 'Error creating reservation',
        description: error.message || 'There was an error creating your reservation. Please try again.',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Custom input for DatePicker
  const CustomDateInput = React.forwardRef<HTMLButtonElement, any>(({ value, onClick }, ref) => (
    <Button
      onClick={onClick}
      ref={ref}
      variant="ghost"
      w="full"
      h="48px"
      fontWeight="bold"
      fontSize="xl"
      color="nightSky"
      bg="weddingDay"
      borderRadius="lg"
      border="1px solid"
      borderColor="daybreak"
      leftIcon={<CalendarIcon />}
      _hover={{ bg: 'daybreak' }}
      _focus={{ bg: 'weddingDay', boxShadow: 'outline' }}
      textAlign="center"
      justifyContent="center"
      px={4}
    >
      {date ? formatDateMDY(date) : 'Select Date'}
    </Button>
  ));

  const handleClose = () => {
    if (onClose) {
      onClose();
    }
  };

  return (
    <Box fontFamily="Montserrat, sans-serif" color="nightSky">
      <Box bg="#fff" borderRadius="2xl" boxShadow="2xl" p={8} width="400px" maxW="95vw">
        <form onSubmit={handleReservationSubmit}>
          <VStack spacing={4} align="center" maxW="400px" mx="auto" w="100%">
            {/* Party Size */}
            <FormControl isRequired>
              <FormLabel>Party Size</FormLabel>
              <Select
                value={form.party_size}
                onChange={handlePartySizeChange}
                size="md"
                bg="white"
                borderColor="gray.200"
                _hover={{ borderColor: 'gray.300' }}
                _focus={{ borderColor: '#A59480', boxShadow: '0 0 0 1px #A59480' }}
                h="40px"
                display="flex"
                alignItems="center"
              >
                <option value="">Select party size</option>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((size) => (
                  <option key={size} value={size}>
                    {size} {size === 1 ? 'person' : 'people'}
                  </option>
                ))}
              </Select>
            </FormControl>

            {/* Date */}
            <FormControl isRequired>
              <FormLabel>Date</FormLabel>
              <Box position="relative" w="full">
                <DatePicker
                  selected={date}
                  onChange={handleDateChange}
                  minDate={effectiveStartDate}
                  maxDate={bookingEndDate}
                  dateFormat="MMMM d, yyyy"
                  filterDate={d => {
                    // Only allow dates that are:
                    // - within booking window (handled by minDate/maxDate)
                    // - on a base open day or exceptional open
                    // - not in exceptional closures (full day)
                    // - not in private event dates
                    const iso = d.toISOString().slice(0, 10);
                    const isExceptionalOpen = exceptionalOpens.includes(iso);
                    const isBaseDay = baseDays.includes(d.getDay());
                    const isClosed = exceptionalClosures.includes(iso);
                    const isPrivateEvent = privateEventDates.includes(iso);
                    return (isExceptionalOpen || isBaseDay) && !isClosed && !isPrivateEvent;
                  }}
                  customInput={
                    <Input
                      w="full"
                      h="40px"
                      borderColor="gray.200"
                      _hover={{ borderColor: 'gray.300' }}
                      _focus={{ borderColor: '#A59480', boxShadow: '0 0 0 1px #A59480' }}
                      fontSize="md"
                      borderRadius="md"
                      bg="white"
                      placeholder="Select date"
                      readOnly
                    />
                  }
                  wrapperClassName="datepicker-wrapper"
                  popperClassName="datepicker-popper"
                  popperPlacement="bottom-start"
                />
              </Box>
            </FormControl>

            {/* Time */}
            <FormControl>
              <FormLabel fontSize="sm" fontWeight="medium" color="gray.600">Time</FormLabel>
              <Select
                name="time"
                value={time}
                onChange={handleTimeChange}
                size="md"
                h="40px"
                borderRadius="md"
                borderColor="gray.200"
                _hover={{ borderColor: 'gray.300' }}
                _focus={{ borderColor: '#A59480', boxShadow: '0 0 0 1px #A59480' }}
              >
                {(availableTimes || []).map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </Select>
            </FormControl>

            {/* Phone */}
            <FormControl>
              <FormLabel fontSize="sm" fontWeight="medium" color="gray.600">Phone Number</FormLabel>
              <Input
                name="phone"
                value={displayPhone}
                onChange={handlePhoneChange}
                placeholder="(555) 555-5555"
                size="md"
                h="40px"
                borderRadius="md"
                borderColor="gray.200"
                _hover={{ borderColor: 'gray.300' }}
                _focus={{ borderColor: '#A59480', boxShadow: '0 0 0 1px #A59480' }}
              />
            </FormControl>

            {/* Non-member fields */}
            {!isMember && (
              <>
                <FormControl>
                  <FormLabel fontSize="sm" fontWeight="medium" color="gray.600">First Name</FormLabel>
                  <Input
                    name="first_name"
                    value={form.first_name}
                    onChange={handleInlineChange}
                    size="md"
                    h="40px"
                    borderRadius="md"
                    borderColor="gray.200"
                    _hover={{ borderColor: 'gray.300' }}
                    _focus={{ borderColor: '#A59480', boxShadow: '0 0 0 1px #A59480' }}
                  />
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="sm" fontWeight="medium" color="gray.600">Last Name</FormLabel>
                  <Input
                    name="last_name"
                    value={form.last_name}
                    onChange={handleInlineChange}
                    size="md"
                    h="40px"
                    borderRadius="md"
                    borderColor="gray.200"
                    _hover={{ borderColor: 'gray.300' }}
                    _focus={{ borderColor: '#A59480', boxShadow: '0 0 0 1px #A59480' }}
                  />
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="sm" fontWeight="medium" color="gray.600">Email</FormLabel>
                  <Input
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={handleInlineChange}
                    size="md"
                    h="40px"
                    borderRadius="md"
                    borderColor="gray.200"
                    _hover={{ borderColor: 'gray.300' }}
                    _focus={{ borderColor: '#A59480', boxShadow: '0 0 0 1px #A59480' }}
                  />
                </FormControl>
              </>
            )}

            {/* Event Type */}
            <FormControl>
              <FormLabel fontSize="sm" fontWeight="medium" color="gray.600">Occasion (Optional)</FormLabel>
              <Select
                name="event_type"
                value={form.event_type}
                onChange={handleInlineChange}
                size="md"
                h="40px"
                borderRadius="md"
                borderColor="gray.200"
                _hover={{ borderColor: 'gray.300' }}
                _focus={{ borderColor: '#A59480', boxShadow: '0 0 0 1px #A59480' }}
              >
                <option value="">Select an occasion</option>
                {(eventTypes || []).map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </Select>
            </FormControl>

            {/* Notes */}
            <FormControl>
              <FormLabel fontSize="sm" fontWeight="medium" color="gray.600">Special Requests (Optional)</FormLabel>
              <Input
                name="notes"
                value={form.notes}
                onChange={handleInlineChange}
                placeholder="Any special requests or notes?"
                size="md"
                h="40px"
                borderRadius="md"
                borderColor="gray.200"
                _hover={{ borderColor: 'gray.300' }}
                _focus={{ borderColor: '#A59480', boxShadow: '0 0 0 1px #A59480' }}
              />
            </FormControl>

            {!isMember && (
              <FormControl isRequired mt={4}>
                <FormLabel>Credit Card</FormLabel>
                <Text fontSize="sm" color="gray.600" mb={2}>
                  Non-members are required to place a credit card hold of ${getHoldAmount(Number(form.party_size))} for your reservation. These funds will be released upon your arrival.
                </Text>
                <Box p={2} borderWidth={1} borderRadius="md" bg="gray.50">
                  <CardElement options={{ style: { base: { fontSize: '16px' } } }} />
                </Box>
              </FormControl>
            )}

            <Button
              type="submit"
              colorScheme="black"
              size="lg"
              h="48px"
              mt={6}
              bg="black"
              color="#A59480"
              _hover={{ bg: 'gray.800' }}
              _active={{ transform: 'scale(0.98)' }}
              transition="all 0.2s"
              boxShadow="md"
            >
              {isEdit ? 'Update Reservation' : 'Make Reservation'}
            </Button>

            {error && (
              <Text color="red.500" fontSize="sm" textAlign="center" mt={2}>
                {error}
              </Text>
            )}
          </VStack>
        </form>

        <Modal isOpen={isOpen} onClose={handleClose}>
          <ModalOverlay />
          <ModalContent>
            <ModalHeader>Additional Information</ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              <VStack spacing={4}>
                <FormControl>
                  <Input
                    name="first_name"
                    value={form.first_name}
                    onChange={handleModalChange}
                    placeholder="First Name"
                  />
                </FormControl>
                <FormControl>
                  <Input
                    name="last_name"
                    value={form.last_name}
                    onChange={handleModalChange}
                    placeholder="Last Name"
                  />
                </FormControl>
                <FormControl>
                  <Input
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={handleModalChange}
                    placeholder="Email"
                  />
                </FormControl>
              </VStack>
            </ModalBody>
            <ModalFooter>
              <Button colorScheme="blue" mr={3} onClick={handleSubmit}>
                Save
              </Button>
              <Button variant="ghost" onClick={handleClose}>
                Cancel
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>

        <Modal isOpen={showConfirmationModal} onClose={() => setShowConfirmationModal(false)}>
          <ModalOverlay />
          <ModalContent bg="white" borderRadius="xl" p={6}>
            <ModalHeader textAlign="center" color="nightSky" fontSize="2xl" fontWeight="bold">
              Reservation Confirmed!
            </ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              <VStack spacing={6} align="stretch">
                <Box textAlign="center" bg="weddingDay" p={6} borderRadius="lg">
                  <Text fontSize="xl" fontWeight="medium" color="nightSky" mb={4}>
                    Thank you, {confirmationData?.first_name}!
                  </Text>
                  <Text fontSize="lg" color="nightSky">
                    Your reservation has been confirmed for:
                  </Text>
                </Box>
                
                <Box bg="gray.50" p={4} borderRadius="md">
                  <VStack spacing={3} align="stretch">
                    <Box>
                      <Text fontWeight="bold" color="nightSky">Date & Time</Text>
                      <Text>
                        {date.toLocaleDateString('en-US', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                        {' at '}
                        {time}
                      </Text>
                    </Box>
                    
                    <Box>
                      <Text fontWeight="bold" color="nightSky">Party Size</Text>
                      <Text>{form.party_size} {form.party_size === 1 ? 'person' : 'people'}</Text>
                    </Box>
                    
                    {form.event_type && (
                      <Box>
                        <Text fontWeight="bold" color="nightSky">Occasion</Text>
                        <Text>{form.event_type}</Text>
                      </Box>
                    )}
                    
                    <Box>
                      <Text fontWeight="bold" color="nightSky">Contact Information</Text>
                      <Text>Phone: {displayPhone}</Text>
                      {form.email && <Text>Email: {form.email}</Text>}
                    </Box>
                  </VStack>
                </Box>
                
                <Text fontSize="sm" color="gray.600" textAlign="center">
                  A confirmation message has been sent to your phone number.
                  Please respond directly to that message if you need to make any changes.
                </Text>
              </VStack>
            </ModalBody>
            <ModalFooter>
              <Button 
                colorScheme="black" 
                bg="black" 
                color="#A59480" 
                _hover={{ bg: 'gray.800' }}
                onClick={() => setShowConfirmationModal(false)}
                w="full"
              >
                Close
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>

        <Modal isOpen={showAlternativeTimesModal} onClose={() => setShowAlternativeTimesModal(false)}>
          <ModalOverlay />
          <ModalContent bg="white" borderRadius="xl" p={6}>
            <ModalHeader textAlign="center" color="nightSky" fontSize="2xl" fontWeight="bold">
              Time Not Available
            </ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              <VStack spacing={6} align="stretch">
                <Box textAlign="center" bg="gray.50" p={6} borderRadius="lg">
                  <Text fontSize="lg" color="nightSky" mb={4}>
                    Sorry, {time} is not available for your party size.
                  </Text>
                  <Text fontSize="md" color="gray.600">
                    Here are the nearest available times:
                  </Text>
                </Box>
                
                <VStack spacing={4} align="stretch">
                  {alternativeTimes?.before && (
                    <Button
                      onClick={() => {
                        setTime(alternativeTimes.before!);
                        setShowAlternativeTimesModal(false);
                      }}
                      colorScheme="black"
                      bg="black"
                      color="#A59480"
                      _hover={{ bg: 'gray.800' }}
                      size="lg"
                      h="48px"
                    >
                      {alternativeTimes.before} (Earlier)
                    </Button>
                  )}
                  
                  {alternativeTimes?.after && (
                    <Button
                      onClick={() => {
                        setTime(alternativeTimes.after!);
                        setShowAlternativeTimesModal(false);
                      }}
                      colorScheme="black"
                      bg="black"
                      color="#A59480"
                      _hover={{ bg: 'gray.800' }}
                      size="lg"
                      h="48px"
                    >
                      {alternativeTimes.after} (Later)
                    </Button>
                  )}
                  
                  {!alternativeTimes?.before && !alternativeTimes?.after && (
                    <Text fontSize="md" color="gray.600" textAlign="center">
                      No alternative times available for this date. Please try a different date.
                    </Text>
                  )}
                </VStack>
                
                <Text fontSize="sm" color="gray.600" textAlign="center">
                  Select one of the available times above to continue with your reservation.
                </Text>
              </VStack>
            </ModalBody>
            <ModalFooter>
              <Button 
                variant="outline"
                onClick={() => setShowAlternativeTimesModal(false)}
                w="full"
              >
                Cancel
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      </Box>
    </Box>
  );
};

export default ReservationForm; 