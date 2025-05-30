import React, { useEffect, useState } from 'react';
import { supabase } from '../api/supabaseClient';

export default function PrivateEventBooking({ eventId, rsvpMode }) {
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    party_size: 1,
    preferred_time: '',
  });
  const [status, setStatus] = useState('');
  const [availableTimes, setAvailableTimes] = useState([]);

  useEffect(() => {
    async function fetchEvent() {
      setLoading(true);
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single();
      if (error || !data) {
        setError('Event not found.');
      } else {
        setEvent(data);
        if (data.start_time && data.end_time) {
          const times = generateTimeSlots(data.start_time, data.end_time);
          setAvailableTimes(times);
          setForm(f => ({ ...f, preferred_time: times[0] }));
        }
      }
      setLoading(false);
    }
    fetchEvent();
  }, [eventId]);

  const generateTimeSlots = (startTime, endTime) => {
    const slots = [];
    const start = new Date(startTime);
    const end = new Date(endTime);
    const current = new Date(start);

    while (current < end) {
      slots.push(current.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }));
      current.setMinutes(current.getMinutes() + 15);
    }

    return slots;
  };

  const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async e => {
    e.preventDefault();
    setStatus('');
    if (!form.name || !form.phone || !form.email || !form.party_size || !form.preferred_time) {
      setStatus('Please fill all fields.');
      return;
    }
    const res = await fetch('/api/reservations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        start_time: event.start_time,
        end_time: event.end_time,
        event_id: event.id,
        source: 'private_event_link',
      })
    });
    if (res.ok) {
      setStatus('Reservation confirmed!');
      setForm({ name: '', phone: '', email: '', party_size: 1, preferred_time: availableTimes[0] });
    } else {
      const data = await res.json();
      setStatus(data.error || 'Failed to reserve.');
    }
  };

  if (loading) return <div style={{ padding: 40, color: '#666' }}>Loading event...</div>;
  if (error) return <div style={{ padding: 40, color: '#e53e3e', fontWeight: 600 }}>{error}</div>;

  const modalContent = (
    <>
      <h2 style={{ marginBottom: 8, color: '#333', fontSize: '1.5rem' }}>{event?.title || 'Private Event'}</h2>
      <div style={{ color: '#666', marginBottom: 16, fontSize: '1rem' }}>
        {event?.event_type && <span style={{ marginRight: 8, color: '#a59480' }}>{event.event_type}</span>}
        {event?.start_time && new Date(event.start_time).toLocaleDateString()}<br />
        {event?.start_time && event?.end_time && (
          <>{new Date(event.start_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} - {new Date(event.end_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</>
        )}
      </div>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div className="form-group">
          <label style={{ display: 'block', marginBottom: '0.5rem', color: '#333', fontWeight: 500 }}>Full Name</label>
          <input
            name="name"
            placeholder="Full Name"
            value={form.name}
            onChange={handleChange}
            required
            className="form-control"
            style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #ccc', fontSize: '1rem' }}
          />
        </div>
        <div className="form-group">
          <label style={{ display: 'block', marginBottom: '0.5rem', color: '#333', fontWeight: 500 }}>Phone</label>
          <input
            name="phone"
            placeholder="Phone"
            value={form.phone}
            onChange={handleChange}
            required
            className="form-control"
            style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #ccc', fontSize: '1rem' }}
          />
        </div>
        <div className="form-group">
          <label style={{ display: 'block', marginBottom: '0.5rem', color: '#333', fontWeight: 500 }}>Email</label>
          <input
            name="email"
            placeholder="Email"
            value={form.email}
            onChange={handleChange}
            required
            className="form-control"
            style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #ccc', fontSize: '1rem' }}
          />
        </div>
        <div className="form-group">
          <label style={{ display: 'block', marginBottom: '0.5rem', color: '#333', fontWeight: 500 }}>Party Size</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, party_size: Math.max(1, Number(f.party_size) - 1) }))}
              style={{
                background: '#f0f0f0',
                border: '1px solid #ccc',
                color: '#333',
                width: '32px',
                height: '32px',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.2rem',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >-</button>
            <span style={{ fontSize: '1.1rem', color: '#333', minWidth: '60px', textAlign: 'center' }}>{form.party_size}</span>
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, party_size: Number(f.party_size) + 1 }))}
              style={{
                background: '#f0f0f0',
                border: '1px solid #ccc',
                color: '#333',
                width: '32px',
                height: '32px',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.2rem',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >+</button>
          </div>
        </div>
        <div className="form-group">
          <label style={{ display: 'block', marginBottom: '0.5rem', color: '#333', fontWeight: 500 }}>Preferred Arrival Time</label>
          <select
            name="preferred_time"
            value={form.preferred_time}
            onChange={handleChange}
            required
            className="form-control"
            style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #ccc', fontSize: '1rem' }}
          >
            {availableTimes.map(time => (
              <option key={time} value={time}>{time}</option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          style={{
            background: '#a59480',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            padding: '0.75rem',
            fontSize: '1rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'background 0.2s',
            marginTop: '0.5rem'
          }}
        >
          {rsvpMode ? 'RSVP' : 'Reserve Spot'}
        </button>
        {status && (
          <div
            style={{
              color: status.includes('confirmed') ? '#228B22' : '#e53e3e',
              fontWeight: 600,
              padding: '0.75rem',
              borderRadius: '6px',
              background: status.includes('confirmed') ? '#e7faec' : '#fde8e8',
              textAlign: 'center'
            }}
          >
            {status}
          </div>
        )}
      </form>
    </>
  );

  if (rsvpMode) {
    return (
      <div style={{ maxWidth: 420, margin: '0 auto', background: '#fff', borderRadius: 12, boxShadow: '0 2px 16px rgba(0,0,0,0.09)', padding: '2rem' }}>
        {modalContent}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 420, margin: '3rem auto', background: '#fff', borderRadius: 12, boxShadow: '0 2px 16px rgba(0,0,0,0.09)', padding: '2rem' }}>
      {modalContent}
    </div>
  );
} 