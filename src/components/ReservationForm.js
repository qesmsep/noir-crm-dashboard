import { useDisclosure, Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalFooter, ModalCloseButton, Input, Select, Button, HStack, Box, Text } from '@chakra-ui/react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import '../App.css';
import React, { useState, useEffect } from 'react';
import { createDateFromTimeString, toCSTISOString } from '../utils/dateUtils';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import CreditCardHoldModal from './CreditCardHoldModal';

// Only Thurs(4), Fri(5), Sat(6)
const OPEN_DAYS = [4, 5, 6];

// Generate time options for 6:00pm to midnight, every 15 min
const times = [];
const startHour = 18; // 6 PM
const endHour = 24;   // Midnight
for(let h = startHour; h < endHour; h++){
  for(let m = 0; m < 60; m += 15){
    const hh = String(h).padStart(2,'0');
    const mm = String(m).padStart(2,'0');
    times.push(`${hh}:${mm}`);
  }
}

export default function ReservationForm({ initialStart, initialEnd, onSave, table_id, bookingStartDate, bookingEndDate, onDelete, isEdit }) {
  // Booking window logic: today or bookingStartDate (if in future)
  const today = new Date();
  const effectiveStartDate = bookingStartDate > today ? bookingStartDate : today;
  const safeInitialStart = initialStart ? new Date(initialStart) : new Date();
  const safeInitialEnd = initialEnd ? new Date(initialEnd) : new Date();
  const [form, setForm] = useState({
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
    while (!OPEN_DAYS.includes(d.getDay())) d.setDate(d.getDate() + 1);
    return d;
  });
  const [time, setTime] = useState('');
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [showCreditCardModal, setShowCreditCardModal] = useState(false);
  const [isMember, setIsMember] = useState(null);
  const [holdId, setHoldId] = useState(null);
  const [nonMemberInfo, setNonMemberInfo] = useState(null);
  const [availableTimes, setAvailableTimes] = useState([]);

  useEffect(() => {
    if (!bookingStartDate) return;
    let d = new Date(effectiveStartDate);
    while (!OPEN_DAYS.includes(d.getDay())) {
      d.setDate(d.getDate() + 1);
    }
    setDate(d);
  }, [bookingStartDate]);

  // Fetch available times when date or party_size changes
  useEffect(() => {
    async function fetchAvailableTimes() {
      if (!date || !form.party_size) return;
      const duration = form.party_size <= 2 ? 90 : 120;
      const slots = [];
      for (const t of times) {
        const start = createDateFromTimeString(t, date);
        const end = new Date(start.getTime() + duration * 60000);
        const res = await fetch(
          `/api/availability?start_time=${start.toISOString()}&end_time=${end.toISOString()}&party_size=${form.party_size}`
        );
        const json = await res.json();
        console.log('Slot:', t, '→ API returned free tables:', json.free);
        if ((json.free || []).length > 0) {
          slots.push(t);
        }
      }
      console.log('Final computed slots:', slots);
      setAvailableTimes(slots);
      if (!slots.includes(time)) {
        setTime(slots[0] || '');
      }
    }
    fetchAvailableTimes();
  }, [date, form.party_size]);

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

  // Step 1: Inline fields
  const handleInlineChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const handleDateChange = (d) => setDate(d);
  const handleTimeChange = (e) => setTime(e.target.value);
  const handlePartySizeChange = (e) => setForm({ ...form, party_size: Number(e.target.value) });
  const handlePhoneChange = (e) => setForm({ ...form, phone: e.target.value });

  // Step 2: Modal fields
  const handleModalChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const handleSubmit = (e) => {
    e.preventDefault();
    // You can add validation here
    // Call onSave or your reservation logic here
    onClose();
  };

  const checkMembershipStatus = async (phone) => {
    try {
      const response = await fetch(`/api/check-membership?phone=${encodeURIComponent(phone)}`);
      const data = await response.json();
      return data.isMember;
    } catch (error) {
      console.error('Error checking membership status:', error);
      return false;
    }
  };

  const handleReservationSubmit = async (e) => {
    e.preventDefault();
    
    // Require phone number
    if (!form.phone) {
      alert('Please provide a phone number to proceed with the reservation.');
      return;
    }

    // Check membership status
    const memberStatus = await checkMembershipStatus(form.phone);
    setIsMember(memberStatus);
    
    if (!memberStatus) {
      setShowCreditCardModal(true);
      return;
    }

    await submitReservation();
  };

  const submitReservation = async () => {
    // Build start time in CST
    const start = createDateFromTimeString(time, date);
    // Determine duration...
    const durationMinutes = form.party_size <= 2 ? 90 : 120;
    const end = new Date(start.getTime() + durationMinutes * 60000);

    // Format phone
    const formattedPhone = form.phone.replace(/\D/g, '');

    // Check if phone is already a member
    let isMember = false;
    try {
      const resp = await fetch(`/api/check-membership?phone=${encodeURIComponent(form.phone)}`);
      const data = await resp.json();
      isMember = !!data.isMember;
    } catch (err) {
      // fallback: treat as not a member
    }

    // Upsert into potential_members if not a member
    if (!isMember) {
      await fetch('/api/upsertPotentialMember', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          member_id: formattedPhone,
          first_name: nonMemberInfo?.firstName || form.first_name || '',
          last_name: nonMemberInfo?.lastName || form.last_name || '',
          email: nonMemberInfo?.email || form.email || ''
        })
      });
    }

    // Send confirmation SMS to all reservations
    await fetch('/api/sendText', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        direct_phone: formattedPhone,
        content: `Thank you for your reservation. It's been confirmed for ${form.party_size} guests on ${start.toLocaleDateString()} at ${start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}. We look forward to seeing you soon.`
      })
    });
    
    await onSave({
      ...form,
      ...nonMemberInfo, // Include non-member info if available
      start_time: toCSTISOString(start),
      end_time: toCSTISOString(end),
      table_id: table_id,
      hold_id: holdId
    });
  };

  const handleHoldSuccess = (newHoldId, customerInfo) => {
    setHoldId(newHoldId);
    setNonMemberInfo(customerInfo);
    setShowCreditCardModal(false);
    submitReservation();
  };

  const handleHoldCancel = () => {
    setShowCreditCardModal(false);
  };

  const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY);

  // UI for Step 1 (inline)
  return (
    <Box display="flex" justifyContent="center" alignItems="center" py={6}>
      <HStack spacing={0} bg="white" borderRadius="full" boxShadow="md" overflow="hidden" align="center">
        <Box px={6} py={2} borderRight="1px solid #e2e2e2">
          <Select name="party_size" value={form.party_size} onChange={handlePartySizeChange} variant="unstyled" fontWeight="bold" fontSize="lg">
            {[...Array(12)].map((_, i) => (
              <option key={i+1} value={i+1}>{i+1} guests</option>
            ))}
          </Select>
        </Box>
        <Box px={6} py={2} borderRight="1px solid #e2e2e2">
          <DatePicker
            selected={date}
            onChange={d => setDate(d)}
            dateFormat="MMM d, yyyy"
            minDate={bookingStartDate}
            maxDate={bookingEndDate}
            filterDate={d =>
              bookingStartDate && bookingEndDate &&
              d >= bookingStartDate &&
              d <= bookingEndDate &&
              OPEN_DAYS.includes(d.getDay())
            }
            customInput={<Input variant="unstyled" fontWeight="bold" fontSize="lg" width="110px" />}
          />
        </Box>
        <Box px={6} py={2} borderRight="1px solid #e2e2e2">
          <Select value={time} onChange={handleTimeChange} variant="unstyled" fontWeight="bold" fontSize="lg">
            {availableTimes.length === 0 ? (
              <option value="" disabled>No times</option>
            ) : (
              availableTimes.map(t => (
                <option key={t} value={t}>{t.length === 5 ? new Date(`2000-01-01T${t}:00`).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : t}</option>
              ))
            )}
          </Select>
        </Box>
        <Box px={6} py={2} borderRight="1px solid #e2e2e2">
          <Input name="phone" value={form.phone} onChange={handlePhoneChange} variant="unstyled" fontWeight="bold" fontSize="lg" placeholder="Phone" width="120px" />
        </Box>
        <Button onClick={onOpen} bg="#35312b" color="#c2b5a3" borderRadius={0} px={10} py={6} fontWeight="bold" fontSize="lg" height="auto" _hover={{ bg: '#222' }} disabled={!time}>
          Book now
        </Button>
      </HStack>

      {/* Step 2: Modal for more info */}
      <Modal isOpen={isOpen} onClose={onClose} isCentered>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Complete Your Reservation</ModalHeader>
          <ModalCloseButton />
          <form onSubmit={handleReservationSubmit}>
            <ModalBody pb={6}>
              <Input name="email" value={form.email} onChange={handleModalChange} placeholder="Email" mb={4} />
              <Input name="first_name" value={form.first_name} onChange={handleModalChange} placeholder="First Name" mb={4} />
              <Input name="last_name" value={form.last_name} onChange={handleModalChange} placeholder="Last Name" mb={4} />
              {/* Add any other fields as needed */}
            </ModalBody>
            <ModalFooter>
              <Button colorScheme="blue" mr={3} type="submit">
                Submit
              </Button>
              <Button onClick={onClose}>Cancel</Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>

      {showCreditCardModal && (
        <Elements stripe={stripePromise}>
          <CreditCardHoldModal
            partySize={form.party_size}
            onSuccess={handleHoldSuccess}
            onCancel={handleHoldCancel}
          />
        </Elements>
      )}
    </Box>
  );
}