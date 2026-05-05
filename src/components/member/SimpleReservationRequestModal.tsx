import { useState, useEffect } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { DateTime } from 'luxon';
import { X } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { getSupabaseClient } from '@/pages/api/supabaseClient';
import { getMondayOfWeek } from '@/utils/dateUtils';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '');

interface Props {
  isOpen: boolean;
  onClose: () => void;
  memberName?: string;
  memberPhone?: string;
  memberId?: string;
  accountId?: string;
  onReservationCreated?: () => void;
  locationSlug?: string;
  hideTableSelection?: boolean;
  /**
   * When true, allows booking during private events.
   * SECURITY: Only set to true in admin-authenticated pages.
   * Server-side verification ensures only admins can use this.
   * @default false
   */
  adminOverride?: boolean;
}

// Generate time options
const generateTimeSlots = (startHour: number, endHour: number) => {
  const slots: string[] = [];
  for (let hour = startHour; hour <= endHour; hour++) {
    const maxMinute = hour === endHour ? 0 : 30; // Last slot at end hour is :00
    for (let minute = 0; minute <= maxMinute; minute += 30) {
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

// Format phone number as (XXX)XXX-XXXX
const formatPhoneNumber = (value: string) => {
  if (!value) return '';
  const digits = value.replace(/\D/g, '');
  if (digits.length <= 3) {
    return digits;
  } else if (digits.length <= 6) {
    return `(${digits.slice(0, 3)})${digits.slice(3)}`;
  } else {
    return `(${digits.slice(0, 3)})${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
  }
};

/**
 * Get operating hours for a specific date.
 * Checks weekly hours first, then falls back to base hours.
 * @param date - The date to check
 * @param locationHours - Object containing weeklyHours, weeklyHoursWeekStart, and baseHours
 * @returns Time ranges for the date, or null if not open
 */
const getHoursForDate = (date: Date, locationHours: any): Array<{ start: string; end: string }> | null => {
  if (!locationHours) return null;

  const timezone = locationHours.timezone || 'America/Chicago';
  const dt = DateTime.fromJSDate(date, { zone: timezone });
  const dayOfWeek = dt.weekday % 7; // Luxon: 1=Monday, 7=Sunday -> convert to 0=Sunday, 6=Saturday
  const dayName = dt.toFormat('EEEE').toLowerCase(); // "thursday", "friday", etc.

  // Check weekly hours first
  if (locationHours.weeklyHours) {
    // Weekly hours are set for a specific week
    // Check if the date is in the same week as the weekly hours
    const dateWeekMonday = getMondayOfWeek(date, timezone);

    // Only use weekly hours if the date is in the same week
    if (dateWeekMonday === locationHours.weeklyHoursWeekStart) {
      const dayData = locationHours.weeklyHours[dayName];
      if (dayData && dayData.open && dayData.close) {
        return [{ start: dayData.open, end: dayData.close }];
      }
      // If weekly hours exist but this day is null/undefined, it means closed for this week
      return null;
    }

    // Date is in a different week - weekly hours don't apply, return null
    // (Don't fall back to base hours when weekly hours are set for the current week)
    return null;
  }

  // Fall back to base hours (only when no weekly hours are set at all)
  if (locationHours.baseHours && locationHours.baseHours.length > 0) {
    const baseHoursForDay = locationHours.baseHours.filter((h: any) => h.day_of_week === dayOfWeek);
    if (baseHoursForDay.length > 0 && baseHoursForDay[0].time_ranges) {
      return baseHoursForDay[0].time_ranges;
    }
  }

  return null;
};

export default function SimpleReservationRequestModal({
  isOpen,
  onClose,
  memberName = '',
  memberPhone = '',
  memberId,
  accountId,
  onReservationCreated,
  locationSlug,
  hideTableSelection = false,
  adminOverride = false,
}: Props) {
  const { toast } = useToast();
  const [date, setDate] = useState<Date | null>(null);
  const [time, setTime] = useState('');
  const [partySize, setPartySize] = useState('2');
  const [notes, setNotes] = useState('');
  const [isCreatingReservation, setIsCreatingReservation] = useState(false);
  const [blockedTimes, setBlockedTimes] = useState<any[]>([]);
  const [loadingTimes, setLoadingTimes] = useState(false);
  const [blockedDates, setBlockedDates] = useState<Set<string>>(new Set());

  // Manual entry fields (always editable, pre-filled if member found)
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [tableId, setTableId] = useState('');
  const [tables, setTables] = useState<any[]>([]);

  // Location state - defaults to prop, but user can change
  const [selectedLocation, setSelectedLocation] = useState(locationSlug || 'noirkc');

  // Cover charge state
  const [coverEnabled, setCoverEnabled] = useState(false);
  const [coverPrice, setCoverPrice] = useState(0);

  // Booking window state
  const [bookingStartDate, setBookingStartDate] = useState<Date | null>(null);
  const [bookingEndDate, setBookingEndDate] = useState<Date | null>(null);

  // Payment state for non-members
  const [showPayment, setShowPayment] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);

  // Location hours state (weekly_hours with fallback to base_hours)
  const [locationHours, setLocationHours] = useState<any>(null);
  const [loadingHours, setLoadingHours] = useState(true);
  const [locationTimezone, setLocationTimezone] = useState<string>('America/Chicago');

  // Initialize fields when memberName changes
  useEffect(() => {
    if (memberName) {
      const parts = memberName.split(' ');
      setFirstName(parts[0] || '');
      setLastName(parts.slice(1).join(' ') || '');
    } else {
      setFirstName('');
      setLastName('');
      setEmail('');
    }
  }, [memberName]);

  // Update selected location when prop changes
  useEffect(() => {
    if (locationSlug) {
      setSelectedLocation(locationSlug);
    }
  }, [locationSlug]);

  // Fetch booking window for selected location
  useEffect(() => {
    const fetchBookingWindow = async () => {
      if (!isOpen || !selectedLocation) return;

      try {
        // Import supabase client
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

        // Fetch location-specific booking window and timezone
        // Use public_locations view to avoid exposing minaka_ical_url tokens
        const { data: locationData } = await supabase
          .from('public_locations')
          .select('booking_start_date, booking_end_date, timezone')
          .eq('slug', selectedLocation)
          .single();

        // Fetch global settings as fallback
        const { data: settingsData } = await supabase
          .from('settings')
          .select('booking_start_date, booking_end_date')
          .single();

        // Use COALESCE logic: location-specific first, then global
        const effectiveStart = locationData?.booking_start_date || settingsData?.booking_start_date;
        const effectiveEnd = locationData?.booking_end_date || settingsData?.booking_end_date;
        const effectiveTimezone = locationData?.timezone || 'America/Chicago';

        setBookingStartDate(effectiveStart ? new Date(effectiveStart) : null);
        setBookingEndDate(effectiveEnd ? new Date(effectiveEnd) : null);
        setLocationTimezone(effectiveTimezone);

        console.log('📅 [SimpleReservationModal] Booking window:', {
          location: selectedLocation,
          effectiveStart,
          effectiveEnd
        });
      } catch (error) {
        console.error('Error fetching booking window:', error);
      }
    };

    fetchBookingWindow();
  }, [isOpen, selectedLocation]);

  // Fetch blocked dates for the next 30 days
  useEffect(() => {
    const fetchBlockedDates = async () => {
      if (!isOpen) return;

      console.log('[SimpleReservationRequestModal] Fetching blocked dates with adminOverride:', adminOverride);

      try {
        const blockedDatesSet = new Set<string>();
        const today = DateTime.now().setZone(locationTimezone);

        // Check next 30 days
        for (let i = 0; i <= 30; i++) {
          const checkDate = today.plus({ days: i });
          const dateStr = checkDate.toFormat('yyyy-MM-dd');

          const locationParam = selectedLocation ? `&location=${selectedLocation}` : '';
          const overrideParam = adminOverride ? '&adminOverride=true' : '';
          const response = await fetch(`/api/check-date-availability?date=${dateStr}${locationParam}${overrideParam}`);

          if (response.ok) {
            const result = await response.json();

            // Debug logging for April 24
            if (dateStr === '2026-04-24') {
              console.log('[April 24 Check] blockedTimeRanges:', result.blockedTimeRanges);
              console.log('[April 24 Check] adminOverride:', adminOverride);
            }

            // If there are blocked time ranges that cover the full day, mark as blocked
            if (result.blockedTimeRanges && result.blockedTimeRanges.length > 0) {
              // Check if any blocking is for the full day (starts at midnight or early, ends late)
              const hasFullDayBlock = result.blockedTimeRanges.some((range: any) => {
                return (range.startHour === 0 && range.endHour === 23) ||
                       (range.startHour <= 16 && range.endHour >= 23);
              });

              if (dateStr === '2026-04-24') {
                console.log('[April 24 Check] hasFullDayBlock:', hasFullDayBlock);
              }

              if (hasFullDayBlock) {
                blockedDatesSet.add(dateStr);
              }
            }
          }
        }

        setBlockedDates(blockedDatesSet);
      } catch (error) {
        console.error('Error fetching blocked dates:', error);
      }
    };

    fetchBlockedDates();
  }, [isOpen, selectedLocation, adminOverride, locationTimezone]);

  // Fetch tables and cover charge info based on selected location
  useEffect(() => {
    const fetchTablesAndCoverCharge = async () => {
      try {
        const url = selectedLocation ? `/api/tables?location=${selectedLocation}` : '/api/tables';
        const response = await fetch(url);
        const result = await response.json();
        if (response.ok && result.data) {
          setTables(result.data.sort((a: any, b: any) => Number(a.table_number) - Number(b.table_number)));
          // Reset table selection when location changes
          setTableId('');
        }
      } catch (error) {
        console.error('Error fetching tables:', error);
      }

      // Fetch cover charge info for selected location
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

        // Use public_locations view to avoid exposing minaka_ical_url tokens
        const { data: locationData } = await supabase
          .from('public_locations')
          .select('cover_enabled, cover_price, weekly_hours, id, timezone')
          .eq('slug', selectedLocation)
          .single();

        if (locationData) {
          setCoverEnabled(locationData.cover_enabled || false);
          setCoverPrice(locationData.cover_price || 0);

          // Get location timezone (fallback to Chicago if not set)
          const timezone = locationData.timezone || 'America/Chicago';

          // Fetch weekly hours + base hours for this location
          const currentWeekMonday = getMondayOfWeek(new Date(), timezone);
          const weeklyHoursForWeek = locationData.weekly_hours?.[currentWeekMonday] || null;

          // Fetch base hours from venue_hours table
          const { data: baseHoursData } = await supabase
            .from('venue_hours')
            .select('*')
            .eq('type', 'base')
            .eq('location_id', locationData.id);

          setLocationHours({
            weeklyHours: weeklyHoursForWeek,
            weeklyHoursWeekStart: weeklyHoursForWeek ? currentWeekMonday : null,
            baseHours: baseHoursData || [],
            timezone: timezone
          });
          setLoadingHours(false);
        } else {
          setCoverEnabled(false);
          setCoverPrice(0);
          setLocationHours(null);
          setLoadingHours(false);
        }
      } catch (error) {
        console.error('Error fetching cover charge info:', error);
        setCoverEnabled(false);
        setCoverPrice(0);
      }
    };
    fetchTablesAndCoverCharge();
  }, [selectedLocation]);

  // Reset time when date changes if current time is not in new slots
  const handleDateChange = async (newDate: Date) => {
    setDate(newDate);
    setTime('');
    setLoadingTimes(true);

    const abortController = new AbortController();

    try {
      // Fetch blocked times for this date
      const dateStr = DateTime.fromJSDate(newDate, { zone: locationTimezone }).toFormat('yyyy-MM-dd');
      const locationParam = selectedLocation ? `&location=${selectedLocation}` : '';
      const overrideParam = adminOverride ? '&adminOverride=true' : '';
      const response = await fetch(`/api/check-date-availability?date=${dateStr}${locationParam}${overrideParam}`, {
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
    if (!date || !locationHours) return [];

    // Get hours for the selected date (weekly hours or base hours)
    const hoursForDate = getHoursForDate(date, locationHours);
    if (!hoursForDate || hoursForDate.length === 0) return [];

    // Generate time slots based on the actual operating hours
    const allSlots: string[] = [];
    hoursForDate.forEach((timeRange) => {
      // Parse start and end times (format: "HH:MM" in 24-hour)
      const [startHour, startMinute] = timeRange.start.split(':').map(Number);
      let [endHour, endMinute] = timeRange.end.split(':').map(Number);

      // Handle midnight crossing (e.g., "00:00" means end of day)
      if (endHour === 0 && endMinute === 0) {
        endHour = 24;
      }

      // Generate 15-minute slots
      const slots = generateTimeSlots(startHour, endHour);
      allSlots.push(...slots);
    });

    // Filter out blocked times
    return allSlots.filter((slot) => {
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

  // Payment Step Component for non-members
  function PaymentStep() {
    const stripe = useStripe();
    const elements = useElements();
    const [paymentProcessing, setPaymentProcessing] = useState(false);
    const [paymentError, setPaymentError] = useState<string | null>(null);

    const handlePaymentSubmit = async (event: React.FormEvent) => {
      event.preventDefault();

      if (!stripe || !elements) {
        setPaymentError('Stripe is not loaded. Please try again in a moment.');
        return;
      }

      setPaymentProcessing(true);
      setPaymentError(null);

      try {
        const { error: stripeError, paymentIntent } = await stripe.confirmPayment({
          elements,
          confirmParams: {
            payment_method_data: {
              billing_details: {
                name: `${firstName} ${lastName}`.trim(),
                email: email || undefined,
              },
            },
          },
          redirect: 'if_required',
        });

        if (stripeError) {
          setPaymentError(stripeError.message || 'Payment failed');
          setPaymentProcessing(false);
          return;
        }

        if (paymentIntent && paymentIntent.status === 'succeeded') {
          // Payment successful, now create reservation
          await createReservationAfterPayment(paymentIntent.id);
        }
      } catch (error: any) {
        setPaymentError(error.message);
        setPaymentProcessing(false);
      }
    };

    return (
      <form onSubmit={handlePaymentSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Cover charge notice with membership link */}
        <div style={{
          padding: '1.25rem',
          backgroundColor: '#F9FAFB',
          borderLeft: '4px solid #A59480',
          borderRadius: '8px',
          fontSize: '0.875rem',
        }}>
          <p style={{ margin: '0 0 0.75rem 0', color: '#6B7280', lineHeight: '1.5' }}>
            ${coverPrice} cover charge per person applies (includes first drink)
          </p>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              const message = "MEMBERSHIP";
              const phoneNumber = "9137774488";
              const url = `sms:${phoneNumber}?body=${encodeURIComponent(message)}`;
              window.open(url, '_blank');
            }}
            style={{
              background: 'none',
              border: 'none',
              color: '#A59480',
              cursor: 'pointer',
              padding: 0,
              font: 'inherit',
              fontWeight: '600',
              fontSize: '0.875rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.375rem',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#8C7C6D';
              e.currentTarget.style.textDecoration = 'underline';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#A59480';
              e.currentTarget.style.textDecoration = 'none';
            }}
          >
            <span>→</span> Become a member and avoid the reservation fee
          </button>
        </div>

        <div>
          <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '1rem', color: '#1F1F1F' }}>
            Payment Details
          </h3>
          <div style={{
            padding: '1rem',
            backgroundColor: '#F9FAFB',
            borderRadius: '10px',
            marginBottom: '1rem',
          }}>
            <p style={{ fontSize: '0.875rem', color: '#6B7280', margin: '0 0 0.5rem 0' }}>
              Reservation for {partySize} {parseInt(partySize) === 1 ? 'guest' : 'guests'}
            </p>
            <p style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1F1F1F', margin: 0 }}>
              Total: ${parseInt(partySize) * coverPrice}
            </p>
          </div>
          {clientSecret && <PaymentElement />}
        </div>

        {paymentError && (
          <div style={{
            padding: '0.75rem',
            backgroundColor: '#FEE2E2',
            border: '1px solid #FCA5A5',
            borderRadius: '8px',
            color: '#991B1B',
            fontSize: '0.875rem',
          }}>
            {paymentError}
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            type="button"
            onClick={() => {
              setShowPayment(false);
              setClientSecret(null);
            }}
            style={{
              flex: 1,
              height: '48px',
              backgroundColor: '#F3F4F6',
              color: '#1F1F1F',
              fontSize: '1rem',
              fontWeight: '600',
              borderRadius: '10px',
              border: '1px solid #D1D5DB',
              cursor: 'pointer',
            }}
          >
            Back
          </button>
          <button
            type="submit"
            disabled={!stripe || paymentProcessing}
            style={{
              flex: 2,
              height: '48px',
              backgroundColor: paymentProcessing ? '#D1D5DB' : '#A59480',
              color: 'white',
              fontSize: '1rem',
              fontWeight: '600',
              borderRadius: '10px',
              border: 'none',
              cursor: paymentProcessing ? 'not-allowed' : 'pointer',
              boxShadow: '0 2px 8px rgba(165, 148, 128, 0.2)',
            }}
          >
            {paymentProcessing ? 'Processing...' : `Pay $${parseInt(partySize) * coverPrice}`}
          </button>
        </div>
      </form>
    );
  }

  // Create reservation after successful payment
  const createReservationAfterPayment = async (paymentId: string) => {
    setIsCreatingReservation(true);

    try {
      const [timeStr, period] = time.split(' ');
      const [hourStr, minuteStr] = timeStr.split(':');
      let hour = parseInt(hourStr);
      const minute = parseInt(minuteStr);

      if (period === 'PM' && hour !== 12) {
        hour += 12;
      } else if (period === 'AM' && hour === 12) {
        hour = 0;
      }

      const startDateTime = DateTime.fromJSDate(date!, { zone: locationTimezone })
        .set({ hour, minute, second: 0, millisecond: 0 });

      const endDateTime = startDateTime.plus({ hours: 2 });

      const response = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start_time: startDateTime.toISO(),
          end_time: endDateTime.toISO(),
          party_size: parseInt(partySize),
          phone: memberPhone,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: email || undefined,
          notes: notes || undefined,
          table_id: tableId || undefined,
          location_slug: selectedLocation,
          cover_charge_applied: true,
          cover_price: coverPrice,
          source: 'public_booking',
          create_visitor: true,
          stripe_payment_intent_id: paymentId,
          admin_override: adminOverride,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create reservation');
      }

      toast({
        title: 'Reservation Confirmed!',
        description: 'Payment successful. Your table has been reserved.',
        variant: 'success',
      });

      if (onReservationCreated) {
        onReservationCreated();
      }

      // Reset and close
      setDate(null);
      setTime('');
      setPartySize('2');
      setNotes('');
      setShowPayment(false);
      setClientSecret(null);
      onClose();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Payment succeeded but reservation failed. Please contact us.',
        variant: 'error',
      });
    } finally {
      setIsCreatingReservation(false);
    }
  };

  const handleMakeReservation = async () => {
    if (!date || !time) {
      toast({
        title: 'Missing Information',
        description: 'Please select a date and time',
        variant: 'error',
      });
      return;
    }

    // Validate name fields
    if (!firstName.trim() || !lastName.trim()) {
      toast({
        title: 'Missing Information',
        description: 'Please enter first name and last name',
        variant: 'error',
      });
      return;
    }

    // Determine if cover charge applies (enabled AND not a member)
    const coverChargeApplies = coverEnabled && !memberId;

    // If non-member with cover charge, create PaymentIntent and show payment step
    if (coverChargeApplies) {
      setShowPayment(true);

      // Create PaymentIntent for cover charge
      const createPaymentIntent = async () => {
        try {
          const [timeStr, period] = time.split(' ');
          const [hourStr, minuteStr] = timeStr.split(':');
          let hour = parseInt(hourStr);
          const minute = parseInt(minuteStr);

          if (period === 'PM' && hour !== 12) {
            hour += 12;
          } else if (period === 'AM' && hour === 12) {
            hour = 0;
          }

          const startDateTime = DateTime.fromJSDate(date, { zone: locationTimezone })
            .set({ hour, minute, second: 0, millisecond: 0 });

          const reservationDate = startDateTime.toFormat('MMMM d, yyyy');
          const locationName = selectedLocation === 'rooftopkc' ? 'RooftopKC' : 'Noir KC';

          const response = await fetch('/api/create-cover-charge-payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              amount: parseInt(partySize) * coverPrice,
              partySize: parseInt(partySize),
              firstName,
              lastName,
              email: email || undefined,
              reservationDate,
              location: locationName,
            }),
          });

          const data = await response.json();
          if (!response.ok) {
            throw new Error(data.error || 'Failed to create payment');
          }

          setClientSecret(data.clientSecret);
          setPaymentIntentId(data.paymentIntentId);
        } catch (error: any) {
          toast({
            title: 'Error',
            description: error.message || 'Failed to initialize payment',
            variant: 'error',
          });
          setShowPayment(false);
        }
      };

      createPaymentIntent();
      return;
    }

    // Members proceed directly to reservation creation
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

      const startDateTime = DateTime.fromJSDate(date, { zone: locationTimezone })
        .set({ hour, minute, second: 0, millisecond: 0 });

      // End time is 2 hours after start
      const endDateTime = startDateTime.plus({ hours: 2 });

      // Determine if cover charge applies (enabled AND not a member)
      const coverChargeApplies = coverEnabled && !memberId;

      // Get auth headers if admin override is enabled
      let headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (adminOverride) {
        const supabase = getSupabaseClient();
        const { data: { session } } = await supabase.auth.getSession();
        console.log('[ADMIN AUTH] Session:', session ? 'Found' : 'Not found');
        console.log('[ADMIN AUTH] Access token:', session?.access_token ? 'Present' : 'Missing');
        if (session?.access_token) {
          headers['Authorization'] = `Bearer ${session.access_token}`;
          console.log('[ADMIN AUTH] Authorization header added');
        } else {
          console.warn('[ADMIN AUTH] No access token available - request will fail auth check');
        }
      }

      const response = await fetch('/api/reservations', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          start_time: startDateTime.toISO(),
          end_time: endDateTime.toISO(),
          party_size: parseInt(partySize),
          phone: memberPhone,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: email || undefined,
          notes: notes || undefined,
          table_id: tableId || undefined,
          location_slug: selectedLocation, // Pass selected location for availability check
          cover_charge_applied: coverChargeApplies,
          cover_price: coverChargeApplies ? coverPrice : 0,
          source: memberId ? 'member_dashboard' : 'admin_portal',
          member_id: memberId,
          account_id: accountId,
          create_visitor: !memberId && !accountId, // Create visitor if no member/account found
          admin_override: adminOverride,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create reservation');
      }

      toast({
        title: 'Reservation Confirmed!',
        description: 'Your table has been reserved',
        variant: 'success',
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
        variant: 'error',
      });
    } finally {
      setIsCreatingReservation(false);
    }
  };

  const filterDate = (date: Date) => {
    // Check if date is within booking window (skip for admin override)
    if (!adminOverride) {
      if (bookingStartDate && date < bookingStartDate) {
        return false;
      }
      if (bookingEndDate && date > bookingEndDate) {
        return false;
      }
    }

    // Check if date has operating hours (weekly or base)
    // Skip if hours are still loading
    if (!loadingHours) {
      const hours = getHoursForDate(date, locationHours);
      if (!hours || hours.length === 0) {
        return false;
      }
    }

    // Check if date is blocked (closure or private event)
    const dateStr = DateTime.fromJSDate(date, { zone: locationTimezone }).toFormat('yyyy-MM-dd');
    if (blockedDates.has(dateStr)) {
      return false;
    }

    return true;
  };

  // Use booking window dates if available, otherwise fall back to defaults
  // Ensure minDate is never in the past (use location's timezone for consistency)
  const today = DateTime.now().setZone(locationTimezone).startOf('day').toJSDate();
  const minDate = bookingStartDate
    ? new Date(Math.max(bookingStartDate.getTime(), today.getTime()))
    : today;
  const maxDate = bookingEndDate || (() => {
    const fallback = new Date();
    fallback.setDate(fallback.getDate() + 30);
    return fallback;
  })();

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#ECEDE8',
          borderRadius: '16px',
          boxShadow: '0 4px 24px rgba(0, 0, 0, 0.15)',
          maxWidth: '600px',
          width: '100%',
          maxHeight: 'calc(100vh - 2rem)',
          overflowY: 'auto',
          padding: '2rem',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '600', color: '#1F1F1F', margin: 0 }}>
            {showPayment ? 'Complete Payment' : 'Request a Reservation'}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '0.625rem',
              minWidth: '44px',
              minHeight: '44px',
              borderRadius: '0.375rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#6B7280',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.05)';
              e.currentTarget.style.color = '#1F1F1F';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = '#6B7280';
            }}
          >
            <X size={24} />
          </button>
        </div>

        {/* Show payment step or reservation form */}
        {showPayment ? (
          clientSecret ? (
            <Elements stripe={stripePromise} options={{ clientSecret }}>
              <PaymentStep />
            </Elements>
          ) : (
            <div style={{ padding: '2rem', textAlign: 'center' }}>
              <p>Loading payment form...</p>
            </div>
          )
        ) : (
          /* Form */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
          {/* Guest Information - Always shown, editable (pre-filled if member found) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="First Name*"
              style={{
                width: '100%',
                height: '44px',
                padding: '0 1rem',
                border: '1px solid #D1D5DB',
                borderRadius: '10px',
                fontSize: '0.875rem',
                backgroundColor: 'white',
                outline: 'none',
              }}
            />
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Last Name*"
              style={{
                width: '100%',
                height: '44px',
                padding: '0 1rem',
                border: '1px solid #D1D5DB',
                borderRadius: '10px',
                fontSize: '0.875rem',
                backgroundColor: 'white',
                outline: 'none',
              }}
            />
          </div>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email (Optional)"
            style={{
              width: '100%',
              height: '44px',
              padding: '0 1rem',
              border: '1px solid #D1D5DB',
              borderRadius: '10px',
              fontSize: '0.875rem',
              backgroundColor: 'white',
              outline: 'none',
            }}
          />
          <div>
            <input
              type="tel"
              value={formatPhoneNumber(memberPhone)}
              readOnly
              placeholder="Phone Number*"
              style={{
                width: '100%',
                height: '44px',
                padding: '0 1rem',
                border: '1px solid #D1D5DB',
                borderRadius: '10px',
                fontSize: '0.875rem',
                backgroundColor: '#F3F4F6',
                outline: 'none',
                cursor: 'not-allowed',
              }}
            />
          </div>

          {/* Location Picker - Only show for members */}
          {memberId ? (
            <div>
              <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                style={{
                  width: '100%',
                  height: '44px',
                  padding: '0 1rem',
                  border: '1px solid #D1D5DB',
                  borderRadius: '10px',
                  fontSize: '0.875rem',
                  backgroundColor: 'white',
                  outline: 'none',
                  cursor: 'pointer',
                }}
              >
                <option value="noirkc">Noir KC</option>
                <option value="rooftopkc">RooftopKC</option>
              </select>
            </div>
          ) : (
            /* Location display for non-members */
            <div style={{
              width: '100%',
              padding: '0.75rem 1rem',
              border: '1px solid #D1D5DB',
              borderRadius: '10px',
              backgroundColor: '#F9FAFB',
            }}>
              <p style={{
                fontSize: '0.75rem',
                color: '#6B7280',
                margin: '0 0 0.25rem 0',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}>
                Reservation Location
              </p>
              <p style={{
                fontSize: '0.875rem',
                color: '#1F1F1F',
                fontWeight: '600',
                margin: 0,
              }}>
                {selectedLocation === 'rooftopkc' ? 'RooftopKC' : 'Noir KC'}
              </p>
            </div>
          )}

          {/* Date and Time Row */}
          <div style={{ display: 'flex', gap: '1rem' }}>
            {/* Date Picker */}
            <div style={{ flex: '1 1 65%' }}>
              <DatePicker
                selected={date}
                onChange={handleDateChange}
                minDate={minDate}
                maxDate={maxDate}
                filterDate={filterDate}
                dateFormat="MMMM d, yyyy"
                placeholderText="Date*"
                openToDate={new Date()}
                customInput={
                  <input
                    style={{
                      width: '100%',
                      height: '44px',
                      padding: '0 1rem',
                      border: '1px solid #D1D5DB',
                      borderRadius: '10px',
                      fontSize: '0.875rem',
                      backgroundColor: 'white',
                      outline: 'none',
                      cursor: 'pointer',
                    }}
                    readOnly
                    inputMode="none"
                    onFocus={(e) => e.target.blur()}
                  />
                }
                popperPlacement="bottom-start"
                withPortal={false}
              />
            </div>

            {/* Time Select */}
            <div style={{ flex: '0 0 35%' }}>
              <select
                value={time}
                onChange={(e) => setTime(e.target.value)}
                disabled={!date || loadingTimes || availableTimeSlots.length === 0}
                style={{
                  width: '100%',
                  height: '44px',
                  padding: '0 1rem',
                  border: '1px solid #D1D5DB',
                  borderRadius: '10px',
                  fontSize: '0.875rem',
                  backgroundColor: 'white',
                  outline: 'none',
                  cursor: !date || loadingTimes || availableTimeSlots.length === 0 ? 'not-allowed' : 'pointer',
                  opacity: !date || loadingTimes || availableTimeSlots.length === 0 ? 0.6 : 1,
                }}
              >
                <option value="">
                  {loadingTimes ? 'Loading times...' : availableTimeSlots.length === 0 && date ? 'No times available' : 'Time*'}
                </option>
                {availableTimeSlots.map((slot) => (
                  <option key={slot} value={slot}>
                    {slot}
                  </option>
                ))}
              </select>
              {date && !loadingTimes && availableTimeSlots.length === 0 && (
                <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#EF4444' }}>
                  No times available on this date. Please select another date.
                </div>
              )}
            </div>
          </div>

          {/* Party Size and Table */}
          <div style={{ display: 'grid', gridTemplateColumns: hideTableSelection ? '1fr' : '1fr 1fr', gap: '1rem' }}>
            <select
              value={partySize}
              onChange={(e) => setPartySize(e.target.value)}
              style={{
                width: '100%',
                height: '44px',
                padding: '0 1rem',
                border: '1px solid #D1D5DB',
                borderRadius: '10px',
                fontSize: '0.875rem',
                backgroundColor: 'white',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((num) => (
                <option key={num} value={num}>
                  {num} {num === 1 ? 'guest' : 'guests'}
                </option>
              ))}
            </select>

            {!hideTableSelection && (
              <select
                value={tableId}
                onChange={(e) => setTableId(e.target.value)}
                style={{
                  width: '100%',
                  height: '44px',
                  padding: '0 1rem',
                  border: '1px solid #D1D5DB',
                  borderRadius: '10px',
                  fontSize: '0.875rem',
                  backgroundColor: 'white',
                  outline: 'none',
                  cursor: 'pointer',
                }}
              >
                <option value="">Table (Optional)</option>
                {tables.map((table) => (
                  <option key={table.id} value={table.id}>
                    Table {table.table_number}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Special Requests */}
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Special requests or dietary restrictions (optional)"
            style={{
              width: '100%',
              minHeight: '100px',
              padding: '0.75rem 1rem',
              border: '1px solid #D1D5DB',
              borderRadius: '10px',
              fontSize: '0.875rem',
              backgroundColor: 'white',
              outline: 'none',
              resize: 'vertical',
              fontFamily: 'inherit',
            }}
          />

          {/* Make Reservation Button */}
          <button
            onClick={handleMakeReservation}
            disabled={isCreatingReservation}
            style={{
              width: '100%',
              height: '48px',
              backgroundColor: isCreatingReservation ? '#D1D5DB' : '#A59480',
              color: 'white',
              fontSize: '1rem',
              fontWeight: '600',
              borderRadius: '10px',
              border: 'none',
              cursor: isCreatingReservation ? 'not-allowed' : 'pointer',
              marginTop: '0.5rem',
              boxShadow: '0 2px 8px rgba(165, 148, 128, 0.2)',
              transition: 'background-color 0.2s',
            }}
            onMouseEnter={(e) => {
              if (!isCreatingReservation) e.currentTarget.style.backgroundColor = '#8C7C6D';
            }}
            onMouseLeave={(e) => {
              if (!isCreatingReservation) e.currentTarget.style.backgroundColor = '#A59480';
            }}
          >
            {isCreatingReservation ? 'Creating...' : 'Make Reservation'}
          </button>
        </div>
        )}
      </div>
    </div>
  );
}
