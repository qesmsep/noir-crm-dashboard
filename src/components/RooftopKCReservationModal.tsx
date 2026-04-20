'use client';

import { useState, useEffect } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { DateTime } from 'luxon';
import { X } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onReservationCreated?: () => void;
}

// Generate time options
const generateTimeSlots = (startHour: number, endHour: number) => {
  const slots: string[] = [];
  for (let hour = startHour; hour <= endHour; hour++) {
    const maxMinute = hour === endHour ? 0 : 45;
    for (let minute = 0; minute <= maxMinute; minute += 15) {
      const h = hour > 12 ? hour - 12 : hour;
      const period = hour >= 12 ? 'PM' : 'AM';
      const m = minute.toString().padStart(2, '0');
      slots.push(`${h}:${m} ${period}`);
    }
  }
  return slots;
};

const thursdayTimeSlots = generateTimeSlots(16, 22); // 4:00 PM to 10:00 PM
const fridaySaturdayTimeSlots = generateTimeSlots(18, 23); // 6:00 PM to 11:00 PM

function PaymentForm({
  amount,
  onPaymentSuccess,
  reservationDetails
}: {
  amount: number;
  onPaymentSuccess: (paymentMethodId: string, customerId: string) => void;
  reservationDetails: string;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [processing, setProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    const cardElement = elements.getElement(CardElement);
    if (!cardElement) {
      return;
    }

    setProcessing(true);

    try {
      // Create payment intent
      const response = await fetch('/api/create-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amount * 100, // Convert to cents
          description: reservationDetails,
        }),
      });

      const { clientSecret, customerId } = await response.json();

      // Confirm the payment
      const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardElement,
        },
        setup_future_usage: 'off_session', // Save for future charges
      });

      if (error) {
        toast({
          title: 'Payment failed',
          description: error.message,
          variant: 'error',
        });
        setProcessing(false);
        return;
      }

      if (paymentIntent.status === 'succeeded') {
        onPaymentSuccess(paymentIntent.payment_method as string, customerId);
      }
    } catch (error: any) {
      toast({
        title: 'Payment error',
        description: error.message || 'Failed to process payment',
        variant: 'error',
      });
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div style={{
        padding: '1rem',
        border: '1px solid #D1D5DB',
        borderRadius: '10px',
        backgroundColor: 'white',
        marginBottom: '1rem',
      }}>
        <CardElement
          options={{
            style: {
              base: {
                fontSize: '16px',
                color: '#1F1F1F',
                '::placeholder': {
                  color: '#9CA3AF',
                },
              },
            },
          }}
        />
      </div>
      <button
        type="submit"
        disabled={!stripe || processing}
        style={{
          width: '100%',
          height: '48px',
          backgroundColor: processing ? '#D1D5DB' : '#A59480',
          color: 'white',
          fontSize: '1rem',
          fontWeight: '600',
          borderRadius: '10px',
          border: 'none',
          cursor: processing ? 'not-allowed' : 'pointer',
          boxShadow: '0 2px 8px rgba(165, 148, 128, 0.2)',
          transition: 'background-color 0.2s',
        }}
      >
        {processing ? 'Processing...' : `Pay $${amount} & Confirm Reservation`}
      </button>
    </form>
  );
}

export default function RooftopKCReservationModal({
  isOpen,
  onClose,
  onReservationCreated,
}: Props) {
  const { toast } = useToast();
  const [step, setStep] = useState<'phone' | 'details' | 'payment'>('phone');
  const [phone, setPhone] = useState('');
  const [isCheckingPhone, setIsCheckingPhone] = useState(false);
  const [isMember, setIsMember] = useState(false);
  const [memberId, setMemberId] = useState<string | undefined>();
  const [accountId, setAccountId] = useState<string | undefined>();

  // Form fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [date, setDate] = useState<Date | null>(null);
  const [time, setTime] = useState('');
  const [partySize, setPartySize] = useState('2');
  const [notes, setNotes] = useState('');

  const [blockedTimes, setBlockedTimes] = useState<any[]>([]);
  const [loadingTimes, setLoadingTimes] = useState(false);
  const [blockedDates, setBlockedDates] = useState<Set<string>>(new Set());
  const [bookingStartDate, setBookingStartDate] = useState<Date | null>(null);
  const [bookingEndDate, setBookingEndDate] = useState<Date | null>(null);

  // Fetch booking window for RooftopKC
  useEffect(() => {
    const fetchBookingWindow = async () => {
      if (!isOpen) return;

      try {
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

        const { data: locationData } = await supabase
          .from('locations')
          .select('booking_start_date, booking_end_date')
          .eq('slug', 'rooftopkc')
          .single();

        const { data: settingsData } = await supabase
          .from('settings')
          .select('booking_start_date, booking_end_date')
          .single();

        const effectiveStart = locationData?.booking_start_date || settingsData?.booking_start_date;
        const effectiveEnd = locationData?.booking_end_date || settingsData?.booking_end_date;

        setBookingStartDate(effectiveStart ? new Date(effectiveStart) : null);
        setBookingEndDate(effectiveEnd ? new Date(effectiveEnd) : null);
      } catch (error) {
        console.error('Error fetching booking window:', error);
      }
    };

    fetchBookingWindow();
  }, [isOpen]);

  // Fetch blocked dates
  useEffect(() => {
    const fetchBlockedDates = async () => {
      if (!isOpen) return;

      try {
        const blockedDatesSet = new Set<string>();
        const today = DateTime.now().setZone('America/Chicago');

        for (let i = 0; i <= 30; i++) {
          const checkDate = today.plus({ days: i });
          const dateStr = checkDate.toFormat('yyyy-MM-dd');

          const response = await fetch(`/api/check-date-availability?date=${dateStr}&location=rooftopkc`);

          if (response.ok) {
            const result = await response.json();

            if (result.blockedTimeRanges && result.blockedTimeRanges.length > 0) {
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
  }, [isOpen]);

  const handlePhoneSubmit = async () => {
    if (!phone.trim()) {
      toast({
        title: 'Phone Required',
        description: 'Please enter your phone number',
        variant: 'error',
      });
      return;
    }

    setIsCheckingPhone(true);

    try {
      const response = await fetch(`/api/members?phone=${encodeURIComponent(phone)}`);
      const data = await response.json();

      if (response.ok && data.members && data.members.length > 0) {
        // Member found
        const member = data.members[0];
        setIsMember(true);
        setMemberId(member.member_id);
        setAccountId(member.account_id);
        setFirstName(member.first_name || '');
        setLastName(member.last_name || '');
        setEmail(member.email || '');
      } else {
        // Not a member
        setIsMember(false);
      }

      setStep('details');
    } catch (error) {
      console.error('Error checking phone:', error);
      toast({
        title: 'Error',
        description: 'Failed to verify phone number',
        variant: 'error',
      });
    } finally {
      setIsCheckingPhone(false);
    }
  };

  const handleDateChange = async (newDate: Date) => {
    setDate(newDate);
    setTime('');
    setLoadingTimes(true);

    try {
      const dateStr = DateTime.fromJSDate(newDate).toFormat('yyyy-MM-dd');
      const response = await fetch(`/api/check-date-availability?date=${dateStr}&location=rooftopkc`);
      const result = await response.json();

      if (response.ok) {
        setBlockedTimes(result.blockedTimeRanges || []);
      } else {
        setBlockedTimes([]);
      }
    } catch (error) {
      console.error('Error fetching availability:', error);
      setBlockedTimes([]);
    } finally {
      setLoadingTimes(false);
    }
  };

  const getAvailableTimeSlots = () => {
    if (!date) return [];

    const baseSlots = date.getDay() === 4 ? thursdayTimeSlots : fridaySaturdayTimeSlots;

    return baseSlots.filter((slot) => {
      const [timeStr, period] = slot.split(' ');
      const [hourStr, minuteStr] = timeStr.split(':');
      let hour = parseInt(hourStr);
      const minute = parseInt(minuteStr);

      if (period === 'PM' && hour !== 12) {
        hour += 12;
      } else if (period === 'AM' && hour === 12) {
        hour = 0;
      }

      const isBlocked = blockedTimes.some((blocked) => {
        const slotMinutes = hour * 60 + minute;
        const blockStartMinutes = blocked.startHour * 60 + blocked.startMinute;
        const blockEndMinutes = blocked.endHour * 60 + blocked.endMinute;

        return slotMinutes >= blockStartMinutes && slotMinutes < blockEndMinutes;
      });

      return !isBlocked;
    });
  };

  const availableTimeSlots = getAvailableTimeSlots();

  const handleDetailsSubmit = () => {
    if (!date || !time) {
      toast({
        title: 'Missing Information',
        description: 'Please select a date and time',
        variant: 'error',
      });
      return;
    }

    if (!firstName.trim() || !lastName.trim()) {
      toast({
        title: 'Missing Information',
        description: 'Please enter your name',
        variant: 'error',
      });
      return;
    }

    if (!isMember) {
      // Non-members need to pay
      setStep('payment');
    } else {
      // Members can book without payment
      createReservation();
    }
  };

  const createReservation = async (paymentMethodId?: string, customerId?: string) => {
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

      const startDateTime = DateTime.fromJSDate(date!)
        .set({ hour, minute, second: 0, millisecond: 0 })
        .setZone('America/Chicago');

      const endDateTime = startDateTime.plus({ hours: 2 });

      const response = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start_time: startDateTime.toISO(),
          end_time: endDateTime.toISO(),
          party_size: parseInt(partySize),
          phone: phone,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: email || undefined,
          notes: notes || undefined,
          location_slug: 'rooftopkc',
          cover_charge_applied: !isMember,
          cover_price: isMember ? 0 : 20,
          source: 'rooftopkc_website',
          member_id: memberId,
          account_id: accountId,
          create_visitor: !memberId && !accountId,
          stripe_payment_method_id: paymentMethodId,
          stripe_customer_id: customerId,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create reservation');
      }

      toast({
        title: 'Reservation Confirmed!',
        description: isMember
          ? 'Your table has been reserved'
          : 'Payment successful! Your table has been reserved',
        variant: 'success',
      });

      if (onReservationCreated) {
        onReservationCreated();
      }

      // Reset and close
      resetForm();
      onClose();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create reservation',
        variant: 'error',
      });
    }
  };

  const resetForm = () => {
    setStep('phone');
    setPhone('');
    setFirstName('');
    setLastName('');
    setEmail('');
    setDate(null);
    setTime('');
    setPartySize('2');
    setNotes('');
    setIsMember(false);
    setMemberId(undefined);
    setAccountId(undefined);
  };

  const filterDate = (date: Date) => {
    if (bookingStartDate && date < bookingStartDate) {
      return false;
    }
    if (bookingEndDate && date > bookingEndDate) {
      return false;
    }

    const day = date.getDay();
    if (day !== 4 && day !== 5 && day !== 6) {
      return false;
    }

    const dateStr = DateTime.fromJSDate(date).toFormat('yyyy-MM-dd');
    if (blockedDates.has(dateStr)) {
      return false;
    }

    return true;
  };

  const minDate = bookingStartDate || new Date();
  const maxDate = bookingEndDate || (() => {
    const fallback = new Date();
    fallback.setDate(fallback.getDate() + 30);
    return fallback;
  })();

  const coverChargeAmount = parseInt(partySize) * 20;
  const reservationDate = date ? DateTime.fromJSDate(date).toFormat('MMMM dd, yyyy') : '';
  const reservationDescription = `RooftopKC Reservation - ${reservationDate}`;

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
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '600', color: '#1F1F1F', margin: 0 }}>
            Reserve at RooftopKC
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
          >
            <X size={24} />
          </button>
        </div>

        {/* Step 1: Phone Number */}
        {step === 'phone' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <p style={{ fontSize: '0.875rem', color: '#6B7280', margin: 0 }}>
              Enter your phone number to check if you're a member
            </p>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handlePhoneSubmit();
                }
              }}
              placeholder="Phone Number*"
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
            <button
              onClick={handlePhoneSubmit}
              disabled={isCheckingPhone}
              style={{
                width: '100%',
                height: '48px',
                backgroundColor: isCheckingPhone ? '#D1D5DB' : '#A59480',
                color: 'white',
                fontSize: '1rem',
                fontWeight: '600',
                borderRadius: '10px',
                border: 'none',
                cursor: isCheckingPhone ? 'not-allowed' : 'pointer',
                boxShadow: '0 2px 8px rgba(165, 148, 128, 0.2)',
                transition: 'background-color 0.2s',
              }}
            >
              {isCheckingPhone ? 'Checking...' : 'Continue'}
            </button>
          </div>
        )}

        {/* Step 2: Reservation Details */}
        {step === 'details' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {!isMember && (
              <div style={{
                padding: '1rem',
                backgroundColor: '#FEF3C7',
                borderRadius: '10px',
                border: '1px solid #FCD34D',
              }}>
                <p style={{ fontSize: '0.875rem', color: '#92400E', margin: 0, fontWeight: '600' }}>
                  $20 reservation fee per person includes your first drink. Fees are non-refundable unless RooftopKC cancels.
                </p>
                <p style={{ fontSize: '0.875rem', color: '#92400E', margin: '0.5rem 0 0 0' }}>
                  Total: ${coverChargeAmount} for {partySize} {parseInt(partySize) === 1 ? 'person' : 'people'}
                </p>
              </div>
            )}

            {isMember && (
              <div style={{
                padding: '1rem',
                backgroundColor: '#D1FAE5',
                borderRadius: '10px',
                border: '1px solid #6EE7B7',
              }}>
                <p style={{ fontSize: '0.875rem', color: '#065F46', margin: 0, fontWeight: '600' }}>
                  ✓ Member - No reservation fee required
                </p>
              </div>
            )}

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

            <div style={{ display: 'flex', gap: '1rem' }}>
              <div style={{ flex: '1 1 65%' }}>
                <DatePicker
                  selected={date}
                  onChange={handleDateChange}
                  minDate={minDate}
                  maxDate={maxDate}
                  filterDate={filterDate}
                  dateFormat="MMMM d, yyyy"
                  placeholderText="Date*"
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
                  withPortal={false}
                />
              </div>

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
                    {loadingTimes ? 'Loading...' : availableTimeSlots.length === 0 && date ? 'No times' : 'Time*'}
                  </option>
                  {availableTimeSlots.map((slot) => (
                    <option key={slot} value={slot}>
                      {slot}
                    </option>
                  ))}
                </select>
              </div>
            </div>

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

            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Special requests (optional)"
              style={{
                width: '100%',
                minHeight: '80px',
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

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={() => setStep('phone')}
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
                onClick={handleDetailsSubmit}
                style={{
                  flex: 2,
                  height: '48px',
                  backgroundColor: '#A59480',
                  color: 'white',
                  fontSize: '1rem',
                  fontWeight: '600',
                  borderRadius: '10px',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(165, 148, 128, 0.2)',
                }}
              >
                {isMember ? 'Confirm Reservation' : 'Continue to Payment'}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Payment (Non-members only) */}
        {step === 'payment' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{
              padding: '1rem',
              backgroundColor: '#F3F4F6',
              borderRadius: '10px',
            }}>
              <p style={{ fontSize: '0.875rem', color: '#1F1F1F', margin: '0 0 0.5rem 0', fontWeight: '600' }}>
                Reservation Summary
              </p>
              <p style={{ fontSize: '0.875rem', color: '#6B7280', margin: '0.25rem 0' }}>
                {firstName} {lastName} • {partySize} {parseInt(partySize) === 1 ? 'guest' : 'guests'}
              </p>
              <p style={{ fontSize: '0.875rem', color: '#6B7280', margin: '0.25rem 0' }}>
                {date && DateTime.fromJSDate(date).toFormat('MMMM dd, yyyy')} at {time}
              </p>
              <p style={{ fontSize: '0.875rem', color: '#1F1F1F', margin: '0.5rem 0 0 0', fontWeight: '600' }}>
                Total: ${coverChargeAmount}
              </p>
            </div>

            <Elements stripe={stripePromise}>
              <PaymentForm
                amount={coverChargeAmount}
                reservationDetails={reservationDescription}
                onPaymentSuccess={(paymentMethodId, customerId) => {
                  createReservation(paymentMethodId, customerId);
                }}
              />
            </Elements>

            <button
              onClick={() => setStep('details')}
              style={{
                width: '100%',
                height: '44px',
                backgroundColor: '#F3F4F6',
                color: '#1F1F1F',
                fontSize: '0.875rem',
                fontWeight: '600',
                borderRadius: '10px',
                border: '1px solid #D1D5DB',
                cursor: 'pointer',
              }}
            >
              Back to Details
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
