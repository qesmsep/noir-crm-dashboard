import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import '../App.css';
import React, { useState } from 'react';
import { createDateFromTimeString, toCSTISOString } from '../utils/dateUtils';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import CreditCardHoldModal from './CreditCardHoldModal';

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

export default function ReservationForm({ initialStart, initialEnd, onSave, table_id, bookingStartDate, bookingEndDate }) {
  const [form, setForm] = useState({
    phone: '',
    party_size: 1,
    event_type: '',
    notes: ''
  });
  const [date, setDate] = useState(new Date(initialStart));
  const [time, setTime] = useState(
    new Date(initialStart).toTimeString().slice(0,5)
  );
  const [showCreditCardModal, setShowCreditCardModal] = useState(false);
  const [isMember, setIsMember] = useState(null);
  const [holdId, setHoldId] = useState(null);
  const [nonMemberInfo, setNonMemberInfo] = useState(null);

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

  const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value });

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

  const handleSubmit = async e => {
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

  return (
    <>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <input 
          name="phone" 
          placeholder="Phone Number *" 
          value={form.phone} 
          onChange={handleChange} 
          required 
        />
        <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
          <label>Party size</label>
          <button type="button" onClick={() => setForm(f => ({ ...f, party_size: Math.max(1, f.party_size - 1) }))}>-</button>
          <span>{form.party_size} guests</span>
          <button type="button" onClick={() => setForm(f => ({ ...f, party_size: f.party_size + 1 }))}>+</button>
        </div>
        <div>
          <label>Event Type</label>
          <select name="event_type" value={form.event_type} onChange={handleChange} style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #ccc' }}>
            <option value="">Select an event type...</option>
            {eventTypes.map(type => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>
        <textarea name="notes" placeholder="Notes" value={form.notes} onChange={handleChange} />
        <div>
          <label>Date</label>
          <DatePicker
            selected={date}
            onChange={d => setDate(d)}
            dateFormat="MMMM d, yyyy"
            minDate={bookingStartDate || new Date()}
            maxDate={bookingEndDate || null}
            className="datepicker-input"
          />
        </div>
        <div>
          <label>Time</label>
          <select value={time} onChange={e => setTime(e.target.value)}>
            {times.map(t => (
              <option key={t} value={t}>
                {createDateFromTimeString(t).toLocaleTimeString('en-US', { 
                  hour: 'numeric', 
                  minute: '2-digit',
                  timeZone: 'America/Chicago'
                })}
              </option>
            ))}
          </select>
        </div>
        <button type="submit">Reserve Now</button>
      </form>

      {showCreditCardModal && (
        <Elements stripe={stripePromise}>
          <CreditCardHoldModal
            partySize={form.party_size}
            onSuccess={handleHoldSuccess}
            onCancel={handleHoldCancel}
          />
        </Elements>
      )}
    </>
  );
}