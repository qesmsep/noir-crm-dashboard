import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import '../App.css';
import React, { useState } from 'react';
import { createDateFromTimeString, toCSTISOString } from '../utils/dateUtils';

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

export default function ReservationForm({ initialStart, initialEnd, onSave, table_id }) {
  const [form, setForm] = useState({
    name: '', phone: '', email: '', party_size: 1, notes: '', event_type: '',
  });
  const [date, setDate] = useState(new Date(initialStart));
  const [time, setTime] = useState(
    new Date(initialStart).toTimeString().slice(0,5)
  );

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

  const handleSubmit = async e => {
    e.preventDefault();
    // Build start time in CST
    const start = createDateFromTimeString(time, date);
    // Determine duration...
    const durationMinutes = form.party_size <= 2 ? 90 : 120;
    const end = new Date(start.getTime() + durationMinutes * 60000);
    
    await onSave({
      ...form,
      start_time: toCSTISOString(start),
      end_time: toCSTISOString(end),
      table_id: table_id
    });
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <input name="name" placeholder="Name" value={form.name} onChange={handleChange} required />
      <input name="phone" placeholder="Phone" value={form.phone} onChange={handleChange} />
      <input name="email" placeholder="Email" value={form.email} onChange={handleChange} />
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
          minDate={new Date()}
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
      <button type="submit">Book</button>
    </form>
  );
}