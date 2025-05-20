

import React, { useState, useEffect } from 'react';

export default function ReservationForm({ initialStart, initialEnd, onSave }) {
  const [form, setForm] = useState({
    name: '', phone: '', email: '', party_size: 1, notes: '',
    start_time: initialStart
  });

  useEffect(() => {
    // format initialStart to "YYYY-MM-DDTHH:MM"
    const formatLocal = dt => {
      const d = new Date(dt);
      return d.toISOString().slice(0,16);
    };
    setForm(f => ({
      ...f,
      start_time: formatLocal(initialStart),
    }));
  }, [initialStart]);

  const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async e => {
    e.preventDefault();
    // Determine duration: 90 min for party_size ≤ 2, 120 min otherwise
    const start = new Date(form.start_time);
    const durationMinutes = form.party_size <= 2 ? 90 : 120;
    const end = new Date(start.getTime() + durationMinutes * 60000);
    await onSave({
      ...form,
      end_time: end.toISOString()
    });
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <input name="name" placeholder="Name" value={form.name} onChange={handleChange} required />
      <input name="phone" placeholder="Phone" value={form.phone} onChange={handleChange} />
      <input name="email" placeholder="Email" value={form.email} onChange={handleChange} />
      <input type="number" name="party_size" min="1" placeholder="Party size" value={form.party_size} onChange={handleChange} required />
      <textarea name="notes" placeholder="Notes" value={form.notes} onChange={handleChange} />
      <label>
        Start:
        <input
          type="datetime-local"
          name="start_time"
          value={form.start_time}
          onChange={handleChange}
          required
        />
      </label>
      <button type="submit">Book</button>
    </form>
  );
}