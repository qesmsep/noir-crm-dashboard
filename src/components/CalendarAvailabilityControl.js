import React, { useState, useEffect } from 'react';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { supabase } from '../api/supabaseClient';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Helper to format time in 12-hour am/pm
function formatTime12h(timeStr) {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':');
  const date = new Date(2000, 0, 1, Number(h), Number(m));
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

const CalendarAvailabilityControl = () => {
  // Base Hours State
  const [baseHours, setBaseHours] = useState(Array(7).fill().map(() => ({ enabled: false, timeRanges: [{ start: '18:00', end: '23:00' }] })));

  // Exceptional Opens State
  const [exceptionalOpens, setExceptionalOpens] = useState([]);
  const [newOpenDate, setNewOpenDate] = useState(null);
  const [newOpenTimeRanges, setNewOpenTimeRanges] = useState([{ start: '18:00', end: '23:00' }]);
  const [newOpenLabel, setNewOpenLabel] = useState('');

  // Exceptional Closures State
  const [exceptionalClosures, setExceptionalClosures] = useState([]);
  const [newClosureDate, setNewClosureDate] = useState(null);
  const [newClosureReason, setNewClosureReason] = useState('');
  const [newClosureTimeRanges, setNewClosureTimeRanges] = useState([{ start: '18:00', end: '23:00' }]);
  const [newClosureFullDay, setNewClosureFullDay] = useState(true);

  // Error State
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Add state for editing exceptional opens/closures
  const [editingOpenId, setEditingOpenId] = useState(null);
  const [editingOpen, setEditingOpen] = useState(null);
  const [editingClosureId, setEditingClosureId] = useState(null);
  const [editingClosure, setEditingClosure] = useState(null);

  // Add state for booking dates
  const [bookingStartDate, setBookingStartDate] = useState(new Date());
  const [bookingEndDate, setBookingEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 60);
    return d;
  });
  const [bookingDatesLoading, setBookingDatesLoading] = useState(true);
  const [bookingDatesSaving, setBookingDatesSaving] = useState(false);

  // Add state for private event creation
  const [privateEvent, setPrivateEvent] = useState({
    name: '',
    event_type: '',
    date: null,
    start: '18:00',
    end: '20:00',
  });
  const [privateEventStatus, setPrivateEventStatus] = useState('');
  const [createdPrivateEvent, setCreatedPrivateEvent] = useState(null);

  // Load from Supabase on mount
  useEffect(() => {
    async function fetchBookingDates() {
      setBookingDatesLoading(true);
      const { data: startData } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'booking_start_date')
        .single();
      const { data: endData } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'booking_end_date')
        .single();
      if (startData && startData.value) setBookingStartDate(new Date(startData.value));
      if (endData && endData.value) setBookingEndDate(new Date(endData.value));
      setBookingDatesLoading(false);
    }
    fetchBookingDates();
  }, []);

  // Save to Supabase when changed
  async function handleBookingDatesChange(start, end) {
    setBookingStartDate(start);
    setBookingEndDate(end);
    setBookingDatesSaving(true);
    await supabase.from('settings').upsert({ key: 'booking_start_date', value: start.toISOString().split('T')[0] });
    await supabase.from('settings').upsert({ key: 'booking_end_date', value: end.toISOString().split('T')[0] });
    setBookingDatesSaving(false);
  }

  // Load existing data
  useEffect(() => {
    loadAvailabilityData();
  }, []);

  const loadAvailabilityData = async () => {
    try {
      setError(null);
      const { data: baseHoursData, error: baseHoursError } = await supabase
        .from('venue_hours')
        .select('*')
        .eq('type', 'base');

      if (baseHoursError) throw baseHoursError;

      const { data: opensData, error: opensError } = await supabase
        .from('venue_hours')
        .select('*')
        .eq('type', 'exceptional_open');

      if (opensError) throw opensError;

      const { data: closuresData, error: closuresError } = await supabase
        .from('venue_hours')
        .select('*')
        .eq('type', 'exceptional_closure');

      if (closuresError) throw closuresError;

      if (baseHoursData) {
        // Process base hours data
        const enabledDays = Array(7).fill(false);
        const timeRanges = Array(7).fill().map(() => [{ start: '18:00', end: '23:00' }]);
        
        baseHoursData.forEach(hour => {
          enabledDays[hour.day_of_week] = true;
          timeRanges[hour.day_of_week] = hour.time_ranges;
        });

        setBaseHours(timeRanges.map((ranges, index) => ({
          enabled: enabledDays[index],
          timeRanges: ranges
        })));
      }

      if (opensData) setExceptionalOpens(opensData);
      if (closuresData) setExceptionalClosures(closuresData);
    } catch (error) {
      console.error('Error loading availability data:', error);
      setError('Failed to load availability data. Please try again.');
    }
  };

  // Base Hours Handlers
  const toggleDay = (dayIndex) => {
    const newBaseHours = [...baseHours];
    newBaseHours[dayIndex].enabled = !newBaseHours[dayIndex].enabled;
    setBaseHours(newBaseHours);
  };

  const updateTimeRange = (dayIndex, rangeIndex, field, value) => {
    const newTimeRanges = [...baseHours[dayIndex].timeRanges];
    newTimeRanges[rangeIndex][field] = value;
    const newBaseHours = [...baseHours];
    newBaseHours[dayIndex].timeRanges = newTimeRanges;
    setBaseHours(newBaseHours);
  };

  const addTimeRange = (dayIndex) => {
    const newTimeRanges = [...baseHours[dayIndex].timeRanges];
    newTimeRanges.push({ start: '18:00', end: '23:00' });
    const newBaseHours = [...baseHours];
    newBaseHours[dayIndex].timeRanges = newTimeRanges;
    setBaseHours(newBaseHours);
  };

  const removeTimeRange = (dayIndex, rangeIndex) => {
    const newTimeRanges = [...baseHours[dayIndex].timeRanges];
    newTimeRanges.splice(rangeIndex, 1);
    const newBaseHours = [...baseHours];
    newBaseHours[dayIndex].timeRanges = newTimeRanges;
    setBaseHours(newBaseHours);
  };

  const saveBaseHours = async () => {
    setError('');
    setSuccessMessage('');
    try {
      // Delete existing base hours
      await supabase.from('venue_hours').delete().eq('type', 'base');
      
      // Insert new base hours
      const baseHoursToSave = baseHours.map((day, index) => ({
        type: 'base',
        day_of_week: index,
        time_ranges: day.enabled ? day.timeRanges : []
      })).filter(day => day.time_ranges.length > 0);

      const { error: insertError } = await supabase.from('venue_hours').insert(baseHoursToSave);
      
      if (insertError) throw insertError;
      
      setSuccessMessage('Base hours updated successfully!');
      setTimeout(() => setSuccessMessage(''), 3000); // Clear message after 3 seconds
    } catch (err) {
      setError('Failed to save base hours: ' + err.message);
    }
  };

  // Exceptional Opens Handlers
  const addExceptionalOpen = async () => {
    if (!newOpenDate) return;

    try {
      setError(null);
      // Check for overlapping dates
      const isOverlapping = exceptionalClosures.some(closure => 
        new Date(closure.date).toDateString() === newOpenDate.toDateString()
      );

      if (isOverlapping) {
        setError('Cannot add exceptional open on a closure date.');
        return;
      }

      const newOpen = {
        date: newOpenDate.toISOString().split('T')[0],
        time_ranges: newOpenTimeRanges,
        label: newOpenLabel,
        type: 'exceptional_open'
      };

      const { data, error } = await supabase
        .from('venue_hours')
        .insert([newOpen])
        .select();

      if (error) throw error;

      if (data) {
        setExceptionalOpens([...exceptionalOpens, data[0]]);
        setNewOpenDate(null);
        setNewOpenTimeRanges([{ start: '18:00', end: '23:00' }]);
        setNewOpenLabel('');
      }
    } catch (error) {
      console.error('Error adding exceptional open:', error);
      setError('Failed to add exceptional open. Please try again.');
    }
  };

  const deleteExceptionalOpen = async (id) => {
    try {
      setError(null);
      const { error } = await supabase
        .from('venue_hours')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setExceptionalOpens(exceptionalOpens.filter(open => open.id !== id));
    } catch (error) {
      console.error('Error deleting exceptional open:', error);
      setError('Failed to delete exceptional open. Please try again.');
    }
  };

  // Exceptional Closures Handlers
  const addExceptionalClosure = async () => {
    if (!newClosureDate) return;
    try {
      setError(null);
      // Check for overlapping dates
      const isOverlapping = exceptionalOpens.some(open => 
        new Date(open.date).toDateString() === newClosureDate.toDateString()
      );
      if (isOverlapping) {
        setError('Cannot add closure on an exceptional open date.');
        return;
      }
      const newClosure = {
        date: newClosureDate.toISOString().split('T')[0],
        reason: newClosureReason,
        type: 'exceptional_closure',
        full_day: newClosureFullDay,
        time_ranges: newClosureFullDay ? null : newClosureTimeRanges
      };
      const { data, error } = await supabase
        .from('venue_hours')
        .insert([newClosure])
        .select();
      if (error) throw error;
      if (data) {
        setExceptionalClosures([...exceptionalClosures, data[0]]);
        setNewClosureDate(null);
        setNewClosureReason('');
        setNewClosureTimeRanges([{ start: '18:00', end: '23:00' }]);
        setNewClosureFullDay(true);
      }
    } catch (error) {
      console.error('Error adding exceptional closure:', error);
      setError('Failed to add exceptional closure. Please try again.');
    }
  };

  const deleteExceptionalClosure = async (id) => {
    try {
      setError(null);
      const { error } = await supabase
        .from('venue_hours')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setExceptionalClosures(exceptionalClosures.filter(closure => closure.id !== id));
    } catch (error) {
      console.error('Error deleting exceptional closure:', error);
      setError('Failed to delete exceptional closure. Please try again.');
    }
  };

  // Add update handlers for opens/closures
  const handleEditOpen = (open) => {
    setEditingOpenId(open.id);
    setEditingOpen({
      ...open,
      date: open.date ? new Date(open.date) : null,
      time_ranges: open.time_ranges || [{ start: '18:00', end: '23:00' }],
      label: open.label || ''
    });
  };

  const handleEditClosure = (closure) => {
    setEditingClosureId(closure.id);
    setEditingClosure({
      ...closure,
      date: closure.date ? new Date(closure.date) : null,
      time_ranges: closure.time_ranges || [{ start: '18:00', end: '23:00' }],
      full_day: closure.full_day !== false,
      reason: closure.reason || ''
    });
  };

  const handleCancelEditOpen = () => {
    setEditingOpenId(null);
    setEditingOpen(null);
  };

  const handleCancelEditClosure = () => {
    setEditingClosureId(null);
    setEditingClosure(null);
  };

  const handleSaveEditOpen = async () => {
    if (!editingOpen) return;
    try {
      setError(null);
      const updated = {
        date: editingOpen.date ? editingOpen.date.toISOString().split('T')[0] : null,
        time_ranges: editingOpen.time_ranges,
        label: editingOpen.label,
        type: 'exceptional_open'
      };
      const { data, error } = await supabase
        .from('venue_hours')
        .update(updated)
        .eq('id', editingOpenId)
        .select();
      if (error) throw error;
      setExceptionalOpens(opens => opens.map(o => o.id === editingOpenId ? { ...o, ...updated } : o));
      setEditingOpenId(null);
      setEditingOpen(null);
    } catch (err) {
      setError('Failed to update exceptional open: ' + err.message);
    }
  };

  const handleSaveEditClosure = async () => {
    if (!editingClosure) return;
    try {
      setError(null);
      const updated = {
        date: editingClosure.date ? editingClosure.date.toISOString().split('T')[0] : null,
        time_ranges: editingClosure.full_day ? null : editingClosure.time_ranges,
        full_day: editingClosure.full_day,
        reason: editingClosure.reason,
        type: 'exceptional_closure'
      };
      const { data, error } = await supabase
        .from('venue_hours')
        .update(updated)
        .eq('id', editingClosureId)
        .select();
      if (error) throw error;
      setExceptionalClosures(closures => closures.map(c => c.id === editingClosureId ? { ...c, ...updated } : c));
      setEditingClosureId(null);
      setEditingClosure(null);
    } catch (err) {
      setError('Failed to update exceptional closure: ' + err.message);
    }
  };

  // Handler to create private event
  async function handleCreatePrivateEvent(e) {
    e.preventDefault();
    setPrivateEventStatus('');
    if (!privateEvent.name || !privateEvent.event_type || !privateEvent.date || !privateEvent.start || !privateEvent.end) {
      setPrivateEventStatus('Please fill all fields.');
      return;
    }
    // Compose start/end datetime in CST
    const dateStr = privateEvent.date.toISOString().split('T')[0];
    const start = `${dateStr}T${privateEvent.start}:00-06:00`;
    const end = `${dateStr}T${privateEvent.end}:00-06:00`;
    const res = await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: privateEvent.name,
        event_type: privateEvent.event_type,
        start_time: start,
        end_time: end,
        private: true
      })
    });
    if (res.ok) {
      const data = await res.json();
      setCreatedPrivateEvent(data.data);
      setPrivateEventStatus('Private event created!');
      setPrivateEvent({ name: '', event_type: '', date: null, start: '18:00', end: '20:00' });
    } else {
      setPrivateEventStatus('Failed to create event.');
    }
  }

  return (
    <div className="availability-control">
      {/* Add Create Private Event form at the top of the admin panel */}
      <div style={{ marginBottom: '2rem', background: '#faf9f7', padding: '1.5rem', borderRadius: '8px', border: '1px solid #ececec', maxWidth: 480 }}>
        <h3>Create Private Event</h3>
        <form onSubmit={handleCreatePrivateEvent} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <input
            type="text"
            placeholder="Event Name"
            value={privateEvent.name}
            onChange={e => setPrivateEvent(ev => ({ ...ev, name: e.target.value }))}
            required
          />
          <select
            value={privateEvent.event_type}
            onChange={e => setPrivateEvent(ev => ({ ...ev, event_type: e.target.value }))}
            required
          >
            <option value="">Select event type...</option>
            <option value="private">Private Event</option>
            <option value="birthday">Birthday</option>
            <option value="engagement">Engagement</option>
            <option value="anniversary">Anniversary</option>
            <option value="party">Party</option>
            <option value="graduation">Graduation</option>
            <option value="corporate">Corporate Event</option>
            <option value="holiday">Holiday Gathering</option>
            <option value="networking">Networking</option>
            <option value="fundraiser">Fundraiser</option>
            <option value="bachelor">Bachelor/Bachelorette</option>
            <option value="fun">Fun Night Out</option>
            <option value="date">Date Night</option>
          </select>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <div>
              <label>Date</label>
              <DatePicker
                selected={privateEvent.date}
                onChange={d => setPrivateEvent(ev => ({ ...ev, date: d }))}
                dateFormat="MMMM d, yyyy"
                minDate={new Date()}
                required
              />
            </div>
            <div>
              <label>Start</label>
              <input
                type="time"
                value={privateEvent.start}
                onChange={e => setPrivateEvent(ev => ({ ...ev, start: e.target.value }))}
                required
              />
            </div>
            <div>
              <label>End</label>
              <input
                type="time"
                value={privateEvent.end}
                onChange={e => setPrivateEvent(ev => ({ ...ev, end: e.target.value }))}
                required
              />
            </div>
          </div>
          <button type="submit">Create Private Event</button>
          {privateEventStatus && <div style={{ color: privateEventStatus.includes('created') ? 'green' : 'red' }}>{privateEventStatus}</div>}
        </form>
        {createdPrivateEvent && (
          <div style={{ marginTop: '1rem' }}>
            <strong>Shareable Link:</strong>
            <input
              type="text"
              value={window.location.origin + `/private-event/${createdPrivateEvent.id}`}
              readOnly
              style={{ width: '100%', marginTop: '0.5rem' }}
              onFocus={e => e.target.select()}
            />
            <button
              style={{ marginTop: '0.5rem' }}
              onClick={() => {
                navigator.clipboard.writeText(window.location.origin + `/private-event/${createdPrivateEvent.id}`);
              }}
            >Copy Link</button>
          </div>
        )}
      </div>
      {/* Booking Window Setting */}
      <div style={{ marginBottom: '1.5rem', background: '#faf9f7', padding: '1rem', borderRadius: '8px', border: '1px solid #ececec', maxWidth: 420 }}>
        <label style={{ fontWeight: 600, color: '#333', marginRight: 10, display: 'block', marginBottom: 8 }}>
          Booking Window:
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div>
            <span style={{ color: '#555', fontSize: '0.98em' }}>Start Date:</span>
            <DatePicker
              selected={bookingStartDate}
              onChange={date => handleBookingDatesChange(date, bookingEndDate)}
              dateFormat="yyyy-MM-dd"
              className="date-picker"
              disabled={bookingDatesLoading || bookingDatesSaving}
            />
          </div>
          <div>
            <span style={{ color: '#555', fontSize: '0.98em' }}>End Date:</span>
            <DatePicker
              selected={bookingEndDate}
              onChange={date => handleBookingDatesChange(bookingStartDate, date)}
              dateFormat="yyyy-MM-dd"
              className="date-picker"
              disabled={bookingDatesLoading || bookingDatesSaving}
            />
          </div>
          {bookingDatesLoading && <span style={{ color: '#888' }}>Loading...</span>}
          {bookingDatesSaving && <span style={{ color: '#888' }}>Saving...</span>}
        </div>
        <span style={{ color: '#888', fontSize: '0.95em', marginLeft: 2 }}>
          (Users can book between these dates)
        </span>
      </div>
      {error && <div className="error-message">{error}</div>}
      {successMessage && <div className="success-message">{successMessage}</div>}
      
      {/* Base Hours Section */}
      <section className="availability-section">
        <h2>Base Hours</h2>
        <div className="weekday-controls">
          {WEEKDAYS.map((day, index) => (
            <div key={day} className="weekday-group">
              <label className="weekday-label">
                <input
                  type="checkbox"
                  checked={baseHours[index].enabled}
                  onChange={() => toggleDay(index)}
                />
                {day}
              </label>
              {baseHours[index].enabled && (
                <div className="time-ranges">
                  {baseHours[index].timeRanges.map((range, rangeIndex) => (
                    <div key={rangeIndex} className="time-range">
                      <input
                        type="time"
                        value={range.start}
                        onChange={(e) => updateTimeRange(index, rangeIndex, 'start', e.target.value)}
                      />
                      <span>to</span>
                      <input
                        type="time"
                        value={range.end}
                        onChange={(e) => updateTimeRange(index, rangeIndex, 'end', e.target.value)}
                      />
                      <button
                        className="remove-range"
                        onClick={() => removeTimeRange(index, rangeIndex)}
                        disabled={baseHours[index].timeRanges.length === 1}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <button
                    className="add-range"
                    onClick={() => addTimeRange(index)}
                  >
                    + Add Time Range
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
        <button className="save-base-hours" onClick={saveBaseHours}>
          Save Base Hours
        </button>
      </section>

      {/* Exceptional Opens Section */}
      <section className="availability-section">
        <h2>Exceptional Opens</h2>
        <div className="add-exception">
          <DatePicker
            selected={newOpenDate}
            onChange={setNewOpenDate}
            placeholderText="Select date"
            className="date-picker"
            minDate={new Date()}
          />
          <div className="time-ranges">
            {newOpenTimeRanges.map((range, index) => (
              <div key={index} className="time-range">
                <input
                  type="time"
                  value={range.start}
                  onChange={(e) => {
                    const newRanges = [...newOpenTimeRanges];
                    newRanges[index].start = e.target.value;
                    setNewOpenTimeRanges(newRanges);
                  }}
                />
                <span>to</span>
                <input
                  type="time"
                  value={range.end}
                  onChange={(e) => {
                    const newRanges = [...newOpenTimeRanges];
                    newRanges[index].end = e.target.value;
                    setNewOpenTimeRanges(newRanges);
                  }}
                />
              </div>
            ))}
            <button
              className="add-range"
              onClick={() => setNewOpenTimeRanges([...newOpenTimeRanges, { start: '18:00', end: '23:00' }])}
            >
              + Add Time Range
            </button>
          </div>
          <input
            type="text"
            value={newOpenLabel}
            onChange={(e) => setNewOpenLabel(e.target.value)}
            placeholder="Event label (optional)"
            className="event-label"
          />
          <button className="add-exception-btn" onClick={addExceptionalOpen}>
            Add Exceptional Open
          </button>
        </div>
        <div className="exceptions-list">
          {exceptionalOpens.map((open) => (
            <div key={open.id} className="exception-item">
              {editingOpenId === open.id ? (
                <>
                  <DatePicker
                    selected={editingOpen.date}
                    onChange={date => setEditingOpen(e => ({ ...e, date }))}
                    className="date-picker"
                  />
                  <div className="time-ranges">
                    {editingOpen.time_ranges.map((range, idx) => (
                      <div key={idx} className="time-range">
                        <input
                          type="time"
                          value={range.start}
                          onChange={e => {
                            const trs = [...editingOpen.time_ranges];
                            trs[idx].start = e.target.value;
                            setEditingOpen(e => ({ ...e, time_ranges: trs }));
                          }}
                        />
                        <span>to</span>
                        <input
                          type="time"
                          value={range.end}
                          onChange={e => {
                            const trs = [...editingOpen.time_ranges];
                            trs[idx].end = e.target.value;
                            setEditingOpen(e => ({ ...e, time_ranges: trs }));
                          }}
                        />
                        <button
                          className="remove-range"
                          onClick={() => {
                            const trs = [...editingOpen.time_ranges];
                            trs.splice(idx, 1);
                            setEditingOpen(e => ({ ...e, time_ranges: trs }));
                          }}
                          disabled={editingOpen.time_ranges.length === 1}
                        >×</button>
                      </div>
                    ))}
                    <button
                      className="add-range"
                      onClick={() => setEditingOpen(e => ({ ...e, time_ranges: [...e.time_ranges, { start: '18:00', end: '23:00' }] }))}
                    >+ Add Time Range</button>
                  </div>
                  <input
                    type="text"
                    value={editingOpen.label}
                    onChange={e => setEditingOpen(ed => ({ ...ed, label: e.target.value }))}
                    className="event-label"
                    placeholder="Event label (optional)"
                  />
                  <button className="add-exception-btn" onClick={handleSaveEditOpen}>Save</button>
                  <button className="delete-exception" onClick={handleCancelEditOpen}>Cancel</button>
                </>
              ) : (
                <>
                  <span>{
                    open.date && /^\d{4}-\d{2}-\d{2}$/.test(open.date)
                      ? (() => { const [y, m, d] = open.date.split('-'); return `${Number(m)}/${Number(d)}/${y}`; })()
                      : new Date(open.date).toLocaleDateString()
                  }</span>
                  <span>{open.time_ranges.map(range => `${formatTime12h(range.start)} - ${formatTime12h(range.end)}`).join(', ')}</span>
                  {open.label && <span className="event-label">{open.label}</span>}
                  <button className="delete-exception" onClick={() => handleEditOpen(open)}>Edit</button>
                  <button className="delete-exception" onClick={() => deleteExceptionalOpen(open.id)}>Delete</button>
                </>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Exceptional Closures Section */}
      <section className="availability-section">
        <h2>Exceptional Closures</h2>
        <div className="add-exception">
          <DatePicker
            selected={newClosureDate}
            onChange={setNewClosureDate}
            placeholderText="Select date"
            className="date-picker"
            minDate={new Date()}
          />
          <input
            type="text"
            value={newClosureReason}
            onChange={(e) => setNewClosureReason(e.target.value)}
            placeholder="Reason for closure (optional)"
            className="closure-reason"
          />
          <label style={{ margin: '0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              type="checkbox"
              checked={newClosureFullDay}
              onChange={e => setNewClosureFullDay(e.target.checked)}
            />
            Full Day
          </label>
          {!newClosureFullDay && (
            <div className="time-ranges">
              {newClosureTimeRanges.map((range, index) => (
                <div key={index} className="time-range">
                  <input
                    type="time"
                    value={range.start}
                    onChange={e => {
                      const newRanges = [...newClosureTimeRanges];
                      newRanges[index].start = e.target.value;
                      setNewClosureTimeRanges(newRanges);
                    }}
                  />
                  <span>to</span>
                  <input
                    type="time"
                    value={range.end}
                    onChange={e => {
                      const newRanges = [...newClosureTimeRanges];
                      newRanges[index].end = e.target.value;
                      setNewClosureTimeRanges(newRanges);
                    }}
                  />
                  <button
                    className="remove-range"
                    onClick={() => {
                      const newRanges = [...newClosureTimeRanges];
                      newRanges.splice(index, 1);
                      setNewClosureTimeRanges(newRanges);
                    }}
                    disabled={newClosureTimeRanges.length === 1}
                  >×</button>
                </div>
              ))}
              <button
                className="add-range"
                onClick={() => setNewClosureTimeRanges([...newClosureTimeRanges, { start: '18:00', end: '23:00' }])}
              >+ Add Time Range</button>
            </div>
          )}
          <button className="add-exception-btn" onClick={addExceptionalClosure}>
            Add Closure
          </button>
        </div>
        <div className="exceptions-list">
          {exceptionalClosures.map((closure) => (
            <div key={closure.id} className="exception-item">
              {editingClosureId === closure.id ? (
                <>
                  <DatePicker
                    selected={editingClosure.date}
                    onChange={date => setEditingClosure(e => ({ ...e, date }))}
                    className="date-picker"
                  />
                  <input
                    type="text"
                    value={editingClosure.reason}
                    onChange={e => setEditingClosure(ed => ({ ...ed, reason: e.target.value }))}
                    className="closure-reason"
                    placeholder="Reason for closure (optional)"
                  />
                  <label style={{ margin: '0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input
                      type="checkbox"
                      checked={editingClosure.full_day}
                      onChange={e => setEditingClosure(ed => ({ ...ed, full_day: e.target.checked }))}
                    />
                    Full Day
                  </label>
                  {!editingClosure.full_day && (
                    <div className="time-ranges">
                      {editingClosure.time_ranges.map((range, idx) => (
                        <div key={idx} className="time-range">
                          <input
                            type="time"
                            value={range.start}
                            onChange={e => {
                              const trs = [...editingClosure.time_ranges];
                              trs[idx].start = e.target.value;
                              setEditingClosure(ed => ({ ...ed, time_ranges: trs }));
                            }}
                          />
                          <span>to</span>
                          <input
                            type="time"
                            value={range.end}
                            onChange={e => {
                              const trs = [...editingClosure.time_ranges];
                              trs[idx].end = e.target.value;
                              setEditingClosure(ed => ({ ...ed, time_ranges: trs }));
                            }}
                          />
                          <button
                            className="remove-range"
                            onClick={() => {
                              const trs = [...editingClosure.time_ranges];
                              trs.splice(idx, 1);
                              setEditingClosure(ed => ({ ...ed, time_ranges: trs }));
                            }}
                            disabled={editingClosure.time_ranges.length === 1}
                          >×</button>
                        </div>
                      ))}
                      <button
                        className="add-range"
                        onClick={() => setEditingClosure(ed => ({ ...ed, time_ranges: [...ed.time_ranges, { start: '18:00', end: '23:00' }] }))}
                      >+ Add Time Range</button>
                    </div>
                  )}
                  <button className="add-exception-btn" onClick={handleSaveEditClosure}>Save</button>
                  <button className="delete-exception" onClick={handleCancelEditClosure}>Cancel</button>
                </>
              ) : (
                <>
                  <span>{
                    closure.date && /^\d{4}-\d{2}-\d{2}$/.test(closure.date)
                      ? (() => { const [y, m, d] = closure.date.split('-'); return `${Number(m)}/${Number(d)}/${y}`; })()
                      : new Date(closure.date).toLocaleDateString()
                  }</span>
                  {closure.full_day ? (
                    <span style={{ color: '#a59480', fontStyle: 'italic' }}>Full Day</span>
                  ) : (
                    <span>{closure.time_ranges && closure.time_ranges.map(range => `${formatTime12h(range.start)} - ${formatTime12h(range.end)}`).join(', ')}</span>
                  )}
                  {closure.reason && <span className="closure-reason">{closure.reason}</span>}
                  <button className="delete-exception" onClick={() => handleEditClosure(closure)}>Edit</button>
                  <button className="delete-exception" onClick={() => deleteExceptionalClosure(closure.id)}>Delete</button>
                </>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default CalendarAvailabilityControl; 