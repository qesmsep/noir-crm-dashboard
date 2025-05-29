import React, { useEffect, useState } from 'react';
import { supabase } from '../api/supabaseClient';
import { useNavigate } from 'react-router-dom';

export default function PrivateEventBooking({ eventId }) {
  const navigate = useNavigate();
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

  // Modal overlay and centered modal
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.55)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', padding: '2.5rem 2rem', borderRadius: 14, boxShadow: '0 4px 32px rgba(0,0,0,0.18)', minWidth: 340, maxWidth: 420, width: '100%', position: 'relative' }}>
        <button onClick={() => navigate('/')} style={{ position: 'absolute', top: 12, right: 16, background: 'none', border: 'none', fontSize: 28, color: '#888', cursor: 'pointer', fontWeight: 700, lineHeight: 1 }} aria-label="Close">&times;</button>
        <h2 style={{ marginBottom: 8 }}>{event.title}</h2>
        <div style={{ color: '#888', marginBottom: 16 }}>
          {event.event_type && <span style={{ marginRight: 8 }}>{event.event_type}</span>}
          {new Date(event.start_time).toLocaleDateString()}<br />
          {new Date(event.start_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} - {new Date(event.end_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Hidden/fixed event info */}
          <input type="hidden" name="event_name" value={event.title} readOnly />
          <input type="hidden" name="event_date" value={new Date(event.start_time).toLocaleDateString()} readOnly />
          <div style={{ color: '#444', fontWeight: 600, marginBottom: 2 }}>Event: <span style={{ color: '#222' }}>{event.title}</span></div>
          <div style={{ color: '#444', fontWeight: 600, marginBottom: 2 }}>Date: <span style={{ color: '#222' }}>{new Date(event.start_time).toLocaleDateString()}</span></div>
          <div style={{ color: '#444', fontWeight: 600, marginBottom: 2 }}>Time: <span style={{ color: '#222' }}>{new Date(event.start_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} - {new Date(event.end_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span></div>
          <input name="name" placeholder="Full Name" value={form.name} onChange={handleChange} required />
          <input name="phone" placeholder="Phone" value={form.phone} onChange={handleChange} required />
          <input name="email" placeholder="Email" value={form.email} onChange={handleChange} required />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label>Party Size</label>
            <button type="button" onClick={() => setForm(f => ({ ...f, party_size: Math.max(1, Number(f.party_size) - 1) }))}>-</button>
            <span>{form.party_size}</span>
            <button type="button" onClick={() => setForm(f => ({ ...f, party_size: Number(f.party_size) + 1 }))}>+</button>
          </div>
          <button type="submit" style={{ background: '#a59480', color: '#fff', border: 'none', borderRadius: 8, padding: '0.8rem 0', fontWeight: 700, fontSize: '1.1rem', marginTop: 8 }}>Reserve Spot</button>
          {status && <div style={{ color: status.includes('confirmed') ? 'green' : 'red', fontWeight: 600 }}>{status}</div>}
        </form>
      </div>
    </div>
  );
} 