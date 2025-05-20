

import React, { useState, useEffect } from 'react';

export default function ReservationForm({ initialStart, initialEnd, onSave }) {
  const [form, setForm] = useState({
    name: '', phone: '', email: '', party_size: 1, notes: '',
    start_time: initialStart, end_time: initialEnd
  });

  useEffect(() => {
    // format initialStart/initialEnd to "YYYY-MM-DDTHH:MM"
    const formatLocal = dt => {
      const d = new Date(dt);
      return d.toISOString().slice(0,16);
    };
    setForm(f => ({
      ...f,
      start_time: formatLocal(initialStart),
      end_time: formatLocal(initialEnd),
    }));
  }, [initialStart, initialEnd]);

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
      <label>
        End:
        <input
          type="datetime-local"
          name="end_time"
          value={form.end_time}
          onChange={handleChange}
          required
        />
      </label>
      <button type="submit">Book</button>
    </form>
  );
}