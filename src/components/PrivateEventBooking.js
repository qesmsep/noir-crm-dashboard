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
  });
  const [status, setStatus] = useState('');

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
      }
      setLoading(false);
    }
    fetchEvent();
  }, [eventId]);

  const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async e => {
    e.preventDefault();
    setStatus('');
    if (!form.name || !form.phone || !form.email || !form.party_size) {
      setStatus('Please fill all fields.');
      return;
    }
    // Create reservation for this event's time slot
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
      setForm({ name: '', phone: '', email: '', party_size: 1 });
    } else {
      const data = await res.json();
      setStatus(data.error || 'Failed to reserve.');
    }
  };

  if (loading) return <div style={{ padding: 40 }}>Loading event...</div>;
  if (error) return <div style={{ padding: 40, color: 'red' }}>{error}</div>;

  if (rsvpMode) {
    // RSVP mode: show event details and RSVP form
    return (
      <div style={{ maxWidth: 420, margin: '3rem auto', background: '#fff', borderRadius: 12, boxShadow: '0 2px 16px rgba(0,0,0,0.09)', padding: '2rem' }}>
        <h2 style={{ marginBottom: 8 }}>{event?.title || 'Private Event'}</h2>
        <div style={{ color: '#888', marginBottom: 16 }}>
          {event?.event_type && <span style={{ marginRight: 8 }}>{event.event_type}</span>}
          {event?.start_time && new Date(event.start_time).toLocaleDateString()}<br />
          {event?.start_time && event?.end_time && (
            <>{new Date(event.start_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} - {new Date(event.end_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</>
          )}
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <input name="name" placeholder="Full Name" value={form.name} onChange={handleChange} required />
          <input name="phone" placeholder="Phone" value={form.phone} onChange={handleChange} required />
          <input name="email" placeholder="Email" value={form.email} onChange={handleChange} required />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label>Party Size</label>
            <button type="button" onClick={() => setForm(f => ({ ...f, party_size: Math.max(1, Number(f.party_size) - 1) }))}>-</button>
            <span>{form.party_size}</span>
            <button type="button" onClick={() => setForm(f => ({ ...f, party_size: Number(f.party_size) + 1 }))}>+</button>
          </div>
          <button type="submit">RSVP</button>
          {status && <div style={{ color: status.includes('confirmed') ? 'green' : 'red' }}>{status}</div>}
        </form>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 420, margin: '3rem auto', background: '#fff', borderRadius: 12, boxShadow: '0 2px 16px rgba(0,0,0,0.09)', padding: '2rem' }}>
      <h2 style={{ marginBottom: 8 }}>{event.title}</h2>
      <div style={{ color: '#888', marginBottom: 16 }}>
        {event.event_type && <span style={{ marginRight: 8 }}>{event.event_type}</span>}
        {new Date(event.start_time).toLocaleDateString()}<br />
        {new Date(event.start_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} - {new Date(event.end_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
      </div>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <input name="name" placeholder="Full Name" value={form.name} onChange={handleChange} required />
        <input name="phone" placeholder="Phone" value={form.phone} onChange={handleChange} required />
        <input name="email" placeholder="Email" value={form.email} onChange={handleChange} required />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label>Party Size</label>
          <button type="button" onClick={() => setForm(f => ({ ...f, party_size: Math.max(1, Number(f.party_size) - 1) }))}>-</button>
          <span>{form.party_size}</span>
          <button type="button" onClick={() => setForm(f => ({ ...f, party_size: Number(f.party_size) + 1 }))}>+</button>
        </div>
        <button type="submit">Reserve Spot</button>
        {status && <div style={{ color: status.includes('confirmed') ? 'green' : 'red' }}>{status}</div>}
      </form>
    </div>
  );
} 