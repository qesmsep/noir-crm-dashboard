import { useDisclosure, Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalFooter, ModalCloseButton, Input, Select, Button, HStack, Box, Text, VStack, FormControl, FormLabel, useToast, Divider, Flex, useTheme } from '@chakra-ui/react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import React, { useState, useEffect } from 'react';
import { createDateTimeFromTimeString, toUTC } from '../utils/dateUtils';
import { DateTime } from 'luxon';
import { supabase } from '../lib/supabase';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import "./ReservationForm.css";
import { CalendarIcon } from '@chakra-ui/icons';
import { useSettings } from '../context/SettingsContext';

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
  party_size: number | undefined;
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
  let currentDate = DateTime.fromJSDate(startDate);
  let daysChecked = 0;
  const maxDaysToCheck = 365; // Prevent infinite loop
  
  while (daysChecked < maxDaysToCheck) {
    // Format date as YYYY-MM-DD using Luxon
    const dateStr = currentDate.toFormat('yyyy-MM-dd');
    
    const isExceptionalOpen = exceptionalOpens.includes(dateStr);
    const isBaseDay = baseDays.includes(currentDate.weekday % 7);
    const isClosed = exceptionalClosures.includes(dateStr);
    const isPrivateEvent = privateEventDates.includes(dateStr);
    
    if ((isExceptionalOpen || isBaseDay) && !isClosed && !isPrivateEvent) {
      return currentDate.toJSDate();
    }
    currentDate = currentDate.plus({ days: 1 });
    daysChecked++;
  }
  
  // If no available date found within a year, return the original start date
  console.warn('No available date found within 365 days, returning start date');
  return startDate;
}

// Helper to find first available date using only base days (fallback)
function findFirstAvailableDateBasic(startDate: Date, baseDays: number[]): Date {
  let currentDate = DateTime.fromJSDate(startDate);
  let daysChecked = 0;
  const maxDaysToCheck = 30; // Check up to 30 days ahead
  
  while (daysChecked < maxDaysToCheck) {
    const isBaseDay = baseDays.includes(currentDate.weekday % 7);
    
    if (isBaseDay) {
      return currentDate.toJSDate();
    }
    currentDate = currentDate.plus({ days: 1 });
    daysChecked++;
  }
  
  // If no base day found within 30 days, return the original start date
  console.warn('No base day found within 30 days, returning start date');
  return startDate;
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
  const { settings, refreshHoldFeeSettings } = useSettings();
  
  // Booking window logic: today or bookingStartDate (if in future)
  const today = DateTime.now();
  const effectiveStartDate = bookingStartDate && DateTime.fromJSDate(bookingStartDate) > today ? bookingStartDate : today.toJSDate();
  const safeInitialStart = initialStart ? DateTime.fromISO(initialStart).toJSDate() : DateTime.now().toJSDate();
  const safeInitialEnd = initialEnd ? DateTime.fromISO(initialEnd).toJSDate() : DateTime.now().toJSDate();
  const [form, setForm] = useState<FormData>({
    phone: '',
    party_size: 2,
    event_type: '',
    notes: '',
    email: '',
    first_name: '',
    last_name: ''
  });
  const [date, setDate] = useState<DateTime>(() => {
    // Start with today or booking start date, will be updated to first available date
    const today = DateTime.now();
    const effectiveStartDate = bookingStartDate && DateTime.fromJSDate(bookingStartDate) > today 
      ? DateTime.fromJSDate(bookingStartDate) 
      : today;
    
    return effectiveStartDate;
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
  const [isClient, setIsClient] = useState(false);
  const [stripe, setStripe] = useState<any>(null);
  const [elements, setElements] = useState<any>(null);
  const [exceptionalClosures, setExceptionalClosures] = useState<string[]>([]);
  const [exceptionalOpens, setExceptionalOpens] = useState<string[]>([]);
  const [privateEventDates, setPrivateEventDates] = useState<string[]>([]);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [internalBaseDays, setInternalBaseDays] = useState<number[]>([]);
  const [alternativeTimes, setAlternativeTimes] = useState<{
    before: string | null;
    after: string | null;
  } | null>(null);
  const [showAlternativeTimesModal, setShowAlternativeTimesModal] = useState(false);

  const cardElementRef = React.useRef<HTMLDivElement>(null);

  // Initialize Stripe on client side only
  useEffect(() => {
    setIsClient(true);
    const initStripe = async () => {
      const stripeInstance = await loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);
      setStripe(stripeInstance);
      if (stripeInstance) {
        const elementsInstance = stripeInstance.elements();
        setElements(elementsInstance);
      }
    };
    initStripe();
  }, []);

  // Refresh hold fee settings when component mounts to ensure we have latest values
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Only refresh on client side
      refreshHoldFeeSettings();
    }
  }, [refreshHoldFeeSettings]);

  // Mount card element when elements is available and hold fees are enabled
  useEffect(() => {
    if (isClient && elements && cardElementRef.current && !isMember && settings?.hold_fee_enabled) {
      const cardElement = elements.create('card', {
        style: { base: { fontSize: '16px' } }
      });
      cardElement.mount(cardElementRef.current);
      
      return () => {
        cardElement.unmount();
      };
    }
  }, [isClient, elements, isMember, settings?.hold_fee_enabled]);

  useEffect(() => {
    if (!bookingStartDate || !isClient) return;
    let d = DateTime.fromJSDate(bookingStartDate);
    // Wait for baseDays to be loaded
    if (baseDays.length > 0) {
      while (!baseDays.includes(d.weekday % 7)) {
        d = d.plus({ days: 1 });
      }
    }
    setDate(d);
  }, [bookingStartDate, baseDays, isClient]);

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
        const days = data.map(r => typeof r.day_of_week === 'string' ? Number(r.day_of_week) : r.day_of_week);
        console.log('Setting internalBaseDays to:', days);
        setInternalBaseDays(days);
      }
    }
    loadBaseDays();
  }, []);

  // Fetch available times when date or party_size changes
  useEffect(() => {
    // Check if the selected date is allowed (either base day or exceptional open)
    // Format date as YYYY-MM-DD using local timezone (consistent with fetchAvailableTimes)
    const dateStr = date ? (() => {
      const result = date.toFormat('yyyy-MM-dd');
      return result;
    })() : '';
    const effectiveBaseDays = baseDays.length > 0 ? baseDays : internalBaseDays;
    const isBaseDay = Array.isArray(effectiveBaseDays) && date && effectiveBaseDays.includes(date.weekday % 7);
    const isExceptionalOpen = exceptionalOpens.includes(dateStr);
    const isClosed = exceptionalClosures.includes(dateStr);
    const isPrivateEvent = privateEventDates.includes(dateStr);
    
    // Only fetch if the date is available (base day OR exceptional open) AND not closed/private event
    if (!date || (!isBaseDay && !isExceptionalOpen) || isClosed || isPrivateEvent) {
      setAvailableTimes([]);
      return;
    }
    
    async function fetchAvailableTimes() {
      if (!date || !form.party_size || form.party_size < 1) return;
      
      // Format date as YYYY-MM-DD using Luxon
      const dateStr = date.toFormat('yyyy-MM-dd');
      
      const res = await fetch('/api/available-slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: dateStr, party_size: form.party_size })
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
  }, [date, form.party_size, baseDays, internalBaseDays, exceptionalOpens, exceptionalClosures, privateEventDates]);

  // Set default time only when availableTimes changes and current time is not in slots
  useEffect(() => {
    if (availableTimes.length > 0) {
      if (!availableTimes.includes(time)) {
        setTime(availableTimes[0] || '');
      }
    } else {
      setTime(''); // Clear time if no available times
    }
  }, [availableTimes]);

  // Fetch exceptional closures, opens, and private events for the booking window
  useEffect(() => {
    async function fetchBlockedDates() {
      // Get booking window range
      const start = bookingStartDate ? DateTime.fromJSDate(bookingStartDate) : DateTime.now();
      const end = bookingEndDate ? DateTime.fromJSDate(bookingEndDate) : DateTime.now().plus({ days: 60 });
      
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
      // Get all active private events and filter them in JavaScript for better control
      const { data: allEvents } = await supabase
        .from('private_events')
        .select('start_time, end_time, full_day')
        .eq('status', 'active');
      
      // Filter events that overlap with our booking window
      const events = (allEvents || []).filter(ev => {
        const eventStart = DateTime.fromISO(ev.start_time);
        const eventEnd = DateTime.fromISO(ev.end_time);
        const bookingStart = start;
        const bookingEnd = end;
        
        // Check if events overlap with booking window
        return (eventStart <= bookingEnd && eventEnd >= bookingStart);
      });
      
      // Collect all dates covered by private events
      const eventDates = new Set<string>();
      (events || []).forEach((ev: any) => {
        if (ev.full_day) {
          // For full-day events, just add the date
          const date = DateTime.fromISO(ev.start_time);
          const eventDate = date.toFormat('yyyy-MM-dd');
          eventDates.add(eventDate);
        } else {
          // For partial day events, add all dates in the range
          const d0 = DateTime.fromISO(ev.start_time);
          const d1 = DateTime.fromISO(ev.end_time);
          let current = d0;
          while (current <= d1) {
            const dateStr = current.toFormat('yyyy-MM-dd');
            eventDates.add(dateStr);
            current = current.plus({ days: 1 });
          }
        }
      });
      
      setPrivateEventDates(Array.from(eventDates));
    }
    fetchBlockedDates();
  }, [bookingStartDate, bookingEndDate]);

  // Update date to first available date when data is loaded
  useEffect(() => {
    const effectiveBaseDays = baseDays.length > 0 ? baseDays : internalBaseDays;
    
    // If we have base days loaded, try to find the first available date
    if (effectiveBaseDays.length > 0) {
      let firstAvailable: Date;
      
      // If we have exceptional data, use the full function
      if (exceptionalClosures.length >= 0 && exceptionalOpens.length >= 0 && privateEventDates.length >= 0) {
        firstAvailable = findFirstAvailableDate(
          effectiveStartDate,
          effectiveBaseDays,
          exceptionalClosures,
          exceptionalOpens,
          privateEventDates
        );
        setIsInitialLoad(false);
      } else {
        // Otherwise, use the basic function that only checks base days
        firstAvailable = findFirstAvailableDateBasic(
          effectiveStartDate,
          effectiveBaseDays
        );
      }
      
      setDate(DateTime.fromJSDate(firstAvailable));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseDays, internalBaseDays, exceptionalClosures, exceptionalOpens, privateEventDates]);

  // Step 1: Inline fields
  const handleInlineChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => 
    setForm({ ...form, [e.target.name]: e.target.value });
  
  const handleDateChange = (date: Date | null) => {
    if (date) setDate(DateTime.fromJSDate(date));
  };
  
  const handleTimeChange = (e: React.ChangeEvent<HTMLSelectElement>) => setTime(e.target.value);
  
  const handlePartySizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setForm({ ...form, party_size: value ? Number(value) : undefined });
  };

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
    if (!date || !DateTime.isDateTime(date) || !date.isValid) {
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

    console.log('=== TIME VALIDATION DEBUG ===');
    console.log('time value:', time);
    console.log('time type:', typeof time);
    console.log('time length:', time?.length);
    console.log('=== END TIME VALIDATION DEBUG ===');

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

    // Validate party size
    if (!form.party_size || form.party_size < 1) {
      toast({
        title: 'Party size required',
        description: 'Please select a valid party size.',
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

    // For non-members with hold fees enabled, ensure Stripe is loaded
    if (!isMember && settings?.hold_fee_enabled && (!stripe || !elements)) {
      toast({
        title: 'Payment system loading',
        description: 'Please wait a moment for the payment system to load, then try again.',
        status: 'error',
        duration: 3000,
      });
      setIsSubmitting(false);
      return;
    }

    // Build start time in CST
    console.log('=== START TIME CREATION DEBUG ===');
    console.log('time parameter:', time);
    console.log('timezone:', settings?.timezone || 'America/Chicago');
    console.log('date parameter:', date);
    console.log('date type:', typeof date);
    console.log('date isValid:', date?.isValid);
    
    // Convert Luxon DateTime to JavaScript Date for the function
    const jsDate = date.toJSDate();
    console.log('jsDate:', jsDate);
    
    const start = createDateTimeFromTimeString(time, settings?.timezone || 'America/Chicago', jsDate);
    console.log('start result:', start);
    console.log('start isValid:', start?.isValid);
    console.log('=== END START TIME CREATION DEBUG ===');
    
    const durationMinutes = form.party_size <= 2 ? 90 : 120;
    const end = start.plus({ minutes: durationMinutes });

    // Prepare reservation data
    const reservationData = {
      start_time: start.toISO({ suppressMilliseconds: true }),
      end_time: end.toISO({ suppressMilliseconds: true }),
      party_size: form.party_size,
      event_type: form.event_type,
      notes: form.notes,
      phone: form.phone, // Already formatted as +1XXXXXXXXXX
      email: form.email,
      first_name: form.first_name,
      last_name: form.last_name,
      is_member: isMember,
      source: 'website' // Track that this reservation came from the website
    };

    console.log('=== RESERVATION DATA DEBUG ===');
    console.log('Full reservation data:', reservationData);
    console.log('start_time:', reservationData.start_time);
    console.log('end_time:', reservationData.end_time);
    console.log('party_size:', reservationData.party_size, typeof reservationData.party_size);
    console.log('phone:', reservationData.phone);
    console.log('email:', reservationData.email);
    console.log('first_name:', reservationData.first_name);
    console.log('last_name:', reservationData.last_name);
    console.log('is_member:', reservationData.is_member);
    console.log('=== END RESERVATION DATA DEBUG ===');

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
          const requestBody = {
            ...reservationData,
            member_id: member.member_id // Add member_id to the reservation data
          };
          
          console.log('Sending reservation request to API...');
          console.log('Request body:', requestBody);
          console.log('Request body JSON:', JSON.stringify(requestBody));
          
          const response = await fetch('/api/reservations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
          });
          
          console.log('API Response status:', response.status);
          const data = await response.json();
          console.log('API Response data:', data);

          if (!response.ok) {
            // Check if this is a 409 status with alternative times
            if (response.status === 409 && data.alternative_times) {
              setAlternativeTimes(data.alternative_times);
              setShowAlternativeTimesModal(true);
              setIsSubmitting(false);
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

      // For non-members, handle based on hold fee settings
      if (!isMember) {
        let requestBody: any = { ...reservationData };
        
        // Only create payment method if hold fees are enabled
        if (settings?.hold_fee_enabled) {
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
          const cardElement = elements.getElement('card');
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
          
          // Add payment method ID to request body
          requestBody.payment_method_id = paymentMethod.id;
        }
        
        console.log('Sending non-member reservation request to API...');
        console.log('Request body:', requestBody);
        console.log('Request body JSON:', JSON.stringify(requestBody));
        
        const response = await fetch('/api/reservations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });
        const data = await response.json();
        if (!response.ok) {
          // Check if this is a 409 status with alternative times
          if (response.status === 409 && data.alternative_times) {
            setAlternativeTimes(data.alternative_times);
            setShowAlternativeTimesModal(true);
            setIsSubmitting(false);
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
      {date ? formatDateMDY(date.toJSDate()) : 'Select Date'}
    </Button>
  ));

  const handleClose = () => {
    if (onClose) {
      onClose();
    }
  };

  return (
    <Box fontFamily="Montserrat, sans-serif" color="nightSky" w="full" minH="auto">
      <Box 
        bg="#fff" 
        borderRadius="2xl" 
        boxShadow="2xl" 
        p={{ base: 4, sm: 6, md: 8 }} 
        w="full" 
        maxW={{ base: "full", sm: "400px" }}
        mx="auto"
        minH="auto"
        overflow="visible"
        className="reservation-form-content"
      >
        <form onSubmit={handleReservationSubmit}>
          <VStack spacing={{ base: 4, sm: 5 }} align="stretch" w="100%" minH="auto">
            {/* Party Size */}
            <FormControl isRequired>
              <FormLabel fontSize={{ base: "sm", sm: "md" }} fontWeight="medium" color="gray.600" mb={{ base: 2, sm: 1 }}>
                Party Size
              </FormLabel>
              <Select
                value={form.party_size || ''}
                onChange={handlePartySizeChange}
                size={{ base: "md", sm: "lg" }}
                bg="white"
                borderColor="gray.200"
                _hover={{ borderColor: 'gray.300' }}
                _focus={{ borderColor: '#A59480', boxShadow: '0 0 0 1px #A59480' }}
                h={{ base: "44px", sm: "48px" }}
                display="flex"
                alignItems="center"
                borderRadius="lg"
                fontSize={{ base: "sm", sm: "md" }}
                isInvalid={!form.party_size && isSubmitting}
              >
                <option value="">Select party size</option>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((size) => (
                  <option key={size} value={size}>
                    {size} {size === 1 ? 'person' : 'people'}
                  </option>
                ))}
              </Select>
              {!form.party_size && isSubmitting && (
                <Text color="red.500" fontSize="xs" mt={1}>
                  Party size is required
                </Text>
              )}
            </FormControl>

            {/* Date */}
            <FormControl isRequired>
              <FormLabel fontSize={{ base: "sm", sm: "md" }} fontWeight="medium" color="gray.600" mb={{ base: 2, sm: 1 }}>
                Date
              </FormLabel>
              <Box position="relative" w="full">
                <DatePicker
                  selected={date.toJSDate()}
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
                    // Use Luxon for date formatting
                    const dateStr = DateTime.fromJSDate(d).toFormat('yyyy-MM-dd');
                    const effectiveBaseDays = baseDays.length > 0 ? baseDays : internalBaseDays;
                    const isExceptionalOpen = exceptionalOpens.includes(dateStr);
                    const isBaseDay = effectiveBaseDays.includes(d.getDay());
                    const isClosed = exceptionalClosures.includes(dateStr);
                    const isPrivateEvent = privateEventDates.includes(dateStr);
                    
                    return (isExceptionalOpen || isBaseDay) && !isClosed && !isPrivateEvent;
                  }}
                  customInput={
                    <Input
                      w="full"
                      h={{ base: "44px", sm: "48px" }}
                      borderColor="gray.200"
                      _hover={{ borderColor: 'gray.300' }}
                      _focus={{ borderColor: '#A59480', boxShadow: '0 0 0 1px #A59480' }}
                      fontSize={{ base: "sm", sm: "md" }}
                      borderRadius="lg"
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
            <FormControl isRequired isDisabled={availableTimes.length === 0}>
              <FormLabel fontSize={{ base: "sm", sm: "md" }} fontWeight="medium" color="gray.600" mb={{ base: 2, sm: 1 }}>
                Time
              </FormLabel>
              <Select
                value={time}
                onChange={handleTimeChange}
                size={{ base: "md", sm: "lg" }}
                bg="white"
                borderColor="gray.200"
                _hover={{ borderColor: 'gray.300' }}
                _focus={{ borderColor: '#A59480', boxShadow: '0 0 0 1px #A59480' }}
                h={{ base: "44px", sm: "48px" }}
                display="flex"
                alignItems="center"
                borderRadius="lg"
                fontSize={{ base: "sm", sm: "md" }}
                isInvalid={!time && isSubmitting}
                disabled={availableTimes.length === 0}
              >
                {availableTimes.length === 0 ? (
                  <option value="">No available times</option>
                ) : (
                  availableTimes.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))
                )}
              </Select>
              {availableTimes.length === 0 && (
                <Text color="red.500" fontSize="xs" mt={1}>
                  No available times for this party size on the selected date.
                </Text>
              )}
              {!time && isSubmitting && (
                <Text color="red.500" fontSize="xs" mt={1}>
                  Time is required
                </Text>
              )}
            </FormControl>

            {/* Phone */}
            <FormControl isRequired>
              <FormLabel fontSize={{ base: "sm", sm: "md" }} fontWeight="medium" color="gray.600" mb={{ base: 2, sm: 1 }}>
                Phone Number *
              </FormLabel>
              <Input
                name="phone"
                value={displayPhone}
                onChange={handlePhoneChange}
                placeholder="(555) 555-5555"
                size={{ base: "md", sm: "lg" }}
                h={{ base: "44px", sm: "48px" }}
                borderRadius="lg"
                borderColor="gray.200"
                _hover={{ borderColor: 'gray.300' }}
                _focus={{ borderColor: '#A59480', boxShadow: '0 0 0 1px #A59480' }}
                fontSize={{ base: "sm", sm: "md" }}
                isInvalid={!form.phone && isSubmitting}
              />
              {!form.phone && isSubmitting && (
                <Text color="red.500" fontSize="xs" mt={1}>
                  Phone number is required
                </Text>
              )}
            </FormControl>

            {/* Non-member fields */}
            {!isMember && (
              <>
                <FormControl isRequired>
                  <FormLabel fontSize={{ base: "sm", sm: "md" }} fontWeight="medium" color="gray.600" mb={{ base: 2, sm: 1 }}>
                    First Name *
                  </FormLabel>
                  <Input
                    name="first_name"
                    value={form.first_name}
                    onChange={handleInlineChange}
                    size={{ base: "md", sm: "lg" }}
                    h={{ base: "44px", sm: "48px" }}
                    borderRadius="lg"
                    borderColor="gray.200"
                    _hover={{ borderColor: 'gray.300' }}
                    _focus={{ borderColor: '#A59480', boxShadow: '0 0 0 1px #A59480' }}
                    fontSize={{ base: "sm", sm: "md" }}
                    isInvalid={!form.first_name && isSubmitting}
                  />
                  {!form.first_name && isSubmitting && (
                    <Text color="red.500" fontSize="xs" mt={1}>
                      First name is required
                    </Text>
                  )}
                </FormControl>
                <FormControl isRequired>
                  <FormLabel fontSize={{ base: "sm", sm: "md" }} fontWeight="medium" color="gray.600" mb={{ base: 2, sm: 1 }}>
                    Last Name *
                  </FormLabel>
                  <Input
                    name="last_name"
                    value={form.last_name}
                    onChange={handleInlineChange}
                    size={{ base: "md", sm: "lg" }}
                    h={{ base: "44px", sm: "48px" }}
                    borderRadius="lg"
                    borderColor="gray.200"
                    _hover={{ borderColor: 'gray.300' }}
                    _focus={{ borderColor: '#A59480', boxShadow: '0 0 0 1px #A59480' }}
                    fontSize={{ base: "sm", sm: "md" }}
                    isInvalid={!form.last_name && isSubmitting}
                  />
                  {!form.last_name && isSubmitting && (
                    <Text color="red.500" fontSize="xs" mt={1}>
                      Last name is required
                    </Text>
                  )}
                </FormControl>
                <FormControl isRequired>
                  <FormLabel fontSize={{ base: "sm", sm: "md" }} fontWeight="medium" color="gray.600" mb={{ base: 2, sm: 1 }}>
                    Email *
                  </FormLabel>
                  <Input
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={handleInlineChange}
                    size={{ base: "md", sm: "lg" }}
                    h={{ base: "44px", sm: "48px" }}
                    borderRadius="lg"
                    borderColor="gray.200"
                    _hover={{ borderColor: 'gray.300' }}
                    _focus={{ borderColor: '#A59480', boxShadow: '0 0 0 1px #A59480' }}
                    fontSize={{ base: "sm", sm: "md" }}
                    isInvalid={!form.email && isSubmitting}
                  />
                  {!form.email && isSubmitting && (
                    <Text color="red.500" fontSize="xs" mt={1}>
                      Email is required
                    </Text>
                  )}
                </FormControl>
              </>
            )}

            {/* Event Type */}
            <FormControl>
              <FormLabel fontSize={{ base: "sm", sm: "md" }} fontWeight="medium" color="gray.600" mb={{ base: 2, sm: 1 }}>
                Occasion (Optional)
              </FormLabel>
              <Select
                name="event_type"
                value={form.event_type}
                onChange={handleInlineChange}
                size={{ base: "md", sm: "lg" }}
                h={{ base: "44px", sm: "48px" }}
                borderRadius="lg"
                borderColor="gray.200"
                _hover={{ borderColor: 'gray.300' }}
                _focus={{ borderColor: '#A59480', boxShadow: '0 0 0 1px #A59480' }}
                fontSize={{ base: "sm", sm: "md" }}
              >
                <option value="">Select an occasion</option>
                {(eventTypes || []).map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </Select>
            </FormControl>

            {/* Notes */}
            <FormControl>
              <FormLabel fontSize={{ base: "sm", sm: "md" }} fontWeight="medium" color="gray.600" mb={{ base: 2, sm: 1 }}>
                Special Requests (Optional)
              </FormLabel>
              <Input
                name="notes"
                value={form.notes}
                onChange={handleInlineChange}
                placeholder="Any special requests or notes?"
                size={{ base: "md", sm: "lg" }}
                h={{ base: "44px", sm: "48px" }}
                borderRadius="lg"
                borderColor="gray.200"
                _hover={{ borderColor: 'gray.300' }}
                _focus={{ borderColor: '#A59480', boxShadow: '0 0 0 1px #A59480' }}
                fontSize={{ base: "sm", sm: "md" }}
              />
            </FormControl>

            {!isMember && isClient && stripe && settings.hold_fee_enabled && (
              <FormControl isRequired mt={{ base: 4, sm: 6 }}>
                <FormLabel fontSize={{ base: "sm", sm: "md" }} fontWeight="medium" color="gray.600" mb={{ base: 2, sm: 1 }}>
                  Credit Card
                </FormLabel>
                <Text fontSize={{ base: "xs", sm: "sm" }} color="gray.600" mb={3}>
                  Non-members are required to place a credit card hold of ${settings.hold_fee_amount.toFixed(2)} for your reservation. These funds will be released upon your arrival.
                </Text>
                <Box p={3} borderWidth={1} borderRadius="lg" bg="gray.50" borderColor="gray.200">
                  <div ref={cardElementRef} style={{ height: '44px' }} />
                </Box>
              </FormControl>
            )}

            {!isMember && !isClient && settings.hold_fee_enabled && (
              <FormControl isRequired mt={{ base: 4, sm: 6 }}>
                <FormLabel fontSize={{ base: "sm", sm: "md" }} fontWeight="medium" color="gray.600" mb={{ base: 2, sm: 1 }}>
                  Credit Card
                </FormLabel>
                <Text fontSize={{ base: "xs", sm: "sm" }} color="gray.600" mb={3}>
                  Non-members are required to place a credit card hold of ${settings.hold_fee_amount.toFixed(2)} for your reservation. These funds will be released upon your arrival.
                </Text>
                <Box p={3} borderWidth={1} borderRadius="lg" bg="gray.50" borderColor="gray.200" h="44px" display="flex" alignItems="center" justifyContent="center">
                  <Text fontSize={{ base: "xs", sm: "sm" }} color="gray.500">Loading payment form...</Text>
                </Box>
              </FormControl>
            )}

            <Button
              type="submit"
              colorScheme="black"
              size={{ base: "md", sm: "lg" }}
              h={{ base: "56px", sm: "60px" }}
              mt={{ base: 6, sm: 8 }}
              bg="black"
              color="#A59480"
              _hover={{ bg: 'gray.800' }}
              _active={{ transform: 'scale(0.98)' }}
              _disabled={{ 
                opacity: 0.6, 
                cursor: 'not-allowed',
                transform: 'none'
              }}
              transition="all 0.2s"
              boxShadow="md"
              borderRadius="xl"
              fontSize={{ base: "md", sm: "lg" }}
              fontWeight="bold"
              fontFamily="Montserrat, sans-serif"
              letterSpacing="0.05em"
              textTransform="uppercase"
              isLoading={isSubmitting}
              loadingText="Processing..."
              w="full"
              minH={{ base: "56px", sm: "60px" }}
              _focus={{
                boxShadow: "0 0 0 3px rgba(165, 148, 128, 0.3)",
                outline: "none"
              }}
            >
              {isEdit ? 'Update Reservation' : 'Make Reservation'}
            </Button>

            {error && (
              <Text color="red.500" fontSize={{ base: "sm", sm: "md" }} textAlign="center" mt={3}>
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
                        {confirmationData?.start_time
                          ? DateTime.fromISO(confirmationData.start_time).setZone(settings?.timezone || 'America/Chicago').toLocaleString(DateTime.DATETIME_FULL)
                          : ''}
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