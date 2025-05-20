

import React, { useState } from 'react';

export default function ReservationForm({ initialStart, initialEnd, onSave }) {
  const [form, setForm] = useState({
    name: '', phone: '', email: '', party_size: 1, notes: '',
    start_time: initialStart, end_time: initialEnd
  });

  const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async e => {
    e.preventDefault();
    await onSave(form);
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <input name="name" placeholder="Name" value={form.name} onChange={handleChange} required />
      <input name="phone" placeholder="Phone" value={form.phone} onChange={handleChange} />
      <input name="email" placeholder="Email" value={form.email} onChange={handleChange} />
      <input type="number" name="party_size" min="1" placeholder="Party size" value={form.party_size} onChange={handleChange} required />
      <textarea name="notes" placeholder="Notes" value={form.notes} onChange={handleChange} />
      {/* Optionally date/time pickers for start_time/end_time */}
      <button type="submit">Book</button>
    </form>
  );
}