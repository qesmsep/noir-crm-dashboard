import { useState, useEffect } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { DateTime } from 'luxon';
import { X } from 'lucide-react';
import { useToast } from '@/hooks/useToast';

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
  locationSlug,
  hideTableSelection = false,
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

        // Fetch location-specific booking window
        const { data: locationData } = await supabase
          .from('locations')
          .select('booking_start_date, booking_end_date')
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

        setBookingStartDate(effectiveStart ? new Date(effectiveStart) : null);
        setBookingEndDate(effectiveEnd ? new Date(effectiveEnd) : null);

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

      try {
        const blockedDatesSet = new Set<string>();
        const today = DateTime.now().setZone('America/Chicago');

        // Check next 30 days
        for (let i = 0; i <= 30; i++) {
          const checkDate = today.plus({ days: i });
          const dateStr = checkDate.toFormat('yyyy-MM-dd');

          const locationParam = selectedLocation ? `&location=${selectedLocation}` : '';
          const response = await fetch(`/api/check-date-availability?date=${dateStr}${locationParam}`);

          if (response.ok) {
            const result = await response.json();

            // If there are blocked time ranges that cover the full day, mark as blocked
            if (result.blockedTimeRanges && result.blockedTimeRanges.length > 0) {
              // Check if any blocking is for the full day (starts at midnight or early, ends late)
              const hasFullDayBlock = result.blockedTimeRanges.some((range: any) => {
                return (range.startHour === 0 && range.endHour === 23) ||
                       (range.startHour <= 16 && range.endHour >= 23);
              });

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
  }, [isOpen, selectedLocation]);

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

        const { data: locationData } = await supabase
          .from('locations')
          .select('cover_enabled, cover_price')
          .eq('slug', selectedLocation)
          .single();

        if (locationData) {
          setCoverEnabled(locationData.cover_enabled || false);
          setCoverPrice(locationData.cover_price || 0);
        } else {
          setCoverEnabled(false);
          setCoverPrice(0);
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
      const dateStr = DateTime.fromJSDate(newDate).toFormat('yyyy-MM-dd');
      const locationParam = selectedLocation ? `&location=${selectedLocation}` : '';
      const response = await fetch(`/api/check-date-availability?date=${dateStr}${locationParam}`, {
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

      // Determine if cover charge applies (enabled AND not a member)
      const coverChargeApplies = coverEnabled && !memberId;

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
          location_slug: selectedLocation, // Pass selected location for availability check
          cover_charge_applied: coverChargeApplies,
          cover_price: coverChargeApplies ? coverPrice : 0,
          source: memberId ? 'member_dashboard' : 'admin_portal',
          member_id: memberId,
          account_id: accountId,
          create_visitor: !memberId && !accountId, // Create visitor if no member/account found
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
    // Check if date is within booking window
    if (bookingStartDate && date < bookingStartDate) {
      return false;
    }
    if (bookingEndDate && date > bookingEndDate) {
      return false;
    }

    // Only allow Thursday (4), Friday (5), Saturday (6)
    const day = date.getDay();
    if (day !== 4 && day !== 5 && day !== 6) {
      return false;
    }

    // Check if date is blocked (closure or private event)
    const dateStr = DateTime.fromJSDate(date).toFormat('yyyy-MM-dd');
    if (blockedDates.has(dateStr)) {
      return false;
    }

    return true;
  };

  // Use booking window dates if available, otherwise fall back to defaults
  const minDate = bookingStartDate || new Date();
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
          padding: '2rem',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '600', color: '#1F1F1F', margin: 0 }}>
            Request a Reservation
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '0.5rem',
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

        {/* Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
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
              value={memberPhone}
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

          {/* Location Picker */}
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
            {/* Cover charge notice for non-members */}
            {coverEnabled && !memberId && (
              <p style={{
                marginTop: '0.5rem',
                fontSize: '0.875rem',
                color: '#A59480',
                fontWeight: '600'
              }}>
                ${coverPrice} cover charge applies for this location
              </p>
            )}
          </div>

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
      </div>
    </div>
  );
}
