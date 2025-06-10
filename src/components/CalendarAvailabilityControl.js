import React, { useState, useEffect } from 'react';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { supabase } from '../api/supabaseClient';
import PrivateEventBooking from './PrivateEventBooking';
import { Button } from '@chakra-ui/react';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Helper to format time in 12-hour am/pm
function formatTime12h(timeStr) {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':');
  const date = new Date(2000, 0, 1, Number(h), Number(m));
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

const CalendarAvailabilityControl = ({ section }) => {
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

  // Add state for private events ledger
  const [privateEvents, setPrivateEvents] = useState([]);

  // Add state for RSVP modal
  const [rsvpModalEventId, setRsvpModalEventId] = useState(null);

  // Add state for editing private event
  const [editingEvent, setEditingEvent] = useState(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editEventForm, setEditEventForm] = useState({ name: '', event_type: '', date: null, start: '', end: '' });

  // Add state for creating private event
  const [showCreatePrivateEventForm, setShowCreatePrivateEventForm] = useState(false);

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
    // Construct start/end datetime in local time and convert to UTC ISO string
    const date = privateEvent.date;
    const [startHour, startMinute] = privateEvent.start.split(':');
    const [endHour, endMinute] = privateEvent.end.split(':');
    const startDate = new Date(date);
    startDate.setHours(Number(startHour), Number(startMinute), 0, 0);
    const endDate = new Date(date);
    endDate.setHours(Number(endHour), Number(endMinute), 0, 0);
    const start = startDate.toISOString();
    const end = endDate.toISOString();
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

  // Fetch all private events on mount and after creating a new one
  useEffect(() => {
    async function fetchPrivateEvents() {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('private', true)
        .order('start_time', { ascending: false });
      if (!error && data) setPrivateEvents(data);
    }
    fetchPrivateEvents();
  }, [createdPrivateEvent]);

  // Handler to delete a private event
  async function handleDeletePrivateEvent(id) {
    if (!window.confirm('Are you sure you want to delete this private event?')) return;
    const res = await fetch(`/api/events?id=${id}`, { method: 'DELETE' });
    if (res.ok) {
      setPrivateEvents(events => events.filter(ev => ev.id !== id));
    } else {
      alert('Failed to delete event.');
    }
  }

  // Handler to open edit modal
  function handleOpenEditModal(event) {
    setEditingEvent(event);
    setEditEventForm({
      name: event.title,
      event_type: event.event_type,
      date: new Date(event.start_time),
      start: new Date(event.start_time).toLocaleTimeString('en-GB', { hour12: false, hour: '2-digit', minute: '2-digit' }),
      end: new Date(event.end_time).toLocaleTimeString('en-GB', { hour12: false, hour: '2-digit', minute: '2-digit' })
    });
    setEditModalOpen(true);
  }

  // Handler to close edit modal
  function handleCloseEditModal() {
    setEditModalOpen(false);
    setEditingEvent(null);
  }

  // Handler to save edits
  async function handleSaveEditEvent() {
    if (!editingEvent) return;
    const dateStr = editEventForm.date.toISOString().split('T')[0];
    const [startHour, startMinute] = editEventForm.start.split(':');
    const [endHour, endMinute] = editEventForm.end.split(':');
    const startDate = new Date(editEventForm.date);
    startDate.setHours(Number(startHour), Number(startMinute), 0, 0);
    const endDate = new Date(editEventForm.date);
    endDate.setHours(Number(endHour), Number(endMinute), 0, 0);
    const start = startDate.toISOString();
    const end = endDate.toISOString();
    const res = await fetch(`/api/events?id=${editingEvent.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: editEventForm.name,
        event_type: editEventForm.event_type,
        start_time: start,
        end_time: end,
        private: true
      })
    });
    if (res.ok) {
      setEditModalOpen(false);
      setEditingEvent(null);
      setEditEventForm({ name: '', event_type: '', date: null, start: '', end: '' });
      // Refresh events
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('private', true)
        .order('start_time', { ascending: false });
      if (!error && data) setPrivateEvents(data);
    }
  }

  // Handler to delete event from modal
  async function handleDeleteEditEvent() {
    if (!editingEvent) return;
    await handleDeletePrivateEvent(editingEvent.id);
    setEditModalOpen(false);
    setEditingEvent(null);
    setEditEventForm({ name: '', event_type: '', date: null, start: '', end: '' });
  }

  // Render different content based on section
  const renderContent = () => {
    switch (section) {
      case 'booking_window':
        return (
          <div style={{ background: '#faf9f7', padding: '1rem', borderRadius: '8px', border: '1px solid #ececec', maxWidth: 420 }}>
            <div style={{ borderBottom: '2px solid #b7a78b', fontWeight: 600, fontSize: '1.5rem', marginBottom: 16, paddingBottom: 4, color: '#222' }}>
              Booking Window
            </div>
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
            <Button
              colorScheme="blue"
              isLoading={bookingDatesSaving}
              onClick={() => handleBookingDatesChange(bookingStartDate, bookingEndDate)}
              mt={4}
            >
              Save Booking Window
            </Button>
            <span style={{ color: '#888', fontSize: '0.95em', marginLeft: 2 }}>
              (Users can book between these dates)
            </span>
          </div>
        );

      case 'base':
        return (
          <section className="availability-section">
            <h2>Base Hours</h2>
            <div className="base-hours">
              {WEEKDAYS.map((day, index) => (
                <div key={day} className="day-row">
                  <label>
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
              <button className="save-base-hours" onClick={saveBaseHours}>
                Save Base Hours
              </button>
            </div>
          </section>
        );

      case 'custom_open':
        return (
          <section className="availability-section">
            <div style={{ borderBottom: '2px solid #b7a78b', fontWeight: 600, fontSize: '1.5rem', marginBottom: 16, paddingBottom: 4, color: '#222' }}>
              Custom Open Days
            </div>
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
                Add Custom Open Day
              </button>
            </div>
            <div className="exceptions-list">
              {exceptionalOpens.map(open => (
                <div key={open.id} className="exception-item">
                  {editingOpenId === open.id ? (
                    <>
                      <DatePicker
                        selected={editingOpen.date ? new Date(editingOpen.date) : null}
                        onChange={date => setEditingOpen(e => ({ ...e, date }))}
                        className="date-picker"
                        minDate={new Date()}
                      />
                      <div className="time-ranges">
                        {editingOpen.time_ranges.map((range, index) => (
                          <div key={index} className="time-range">
                            <input
                              type="time"
                              value={range.start}
                              onChange={e => setEditingOpen(ed => ({
                                ...ed,
                                time_ranges: ed.time_ranges.map((r, i) => i === index ? { ...r, start: e.target.value } : r)
                              }))}
                            />
                            <span>to</span>
                            <input
                              type="time"
                              value={range.end}
                              onChange={e => setEditingOpen(ed => ({
                                ...ed,
                                time_ranges: ed.time_ranges.map((r, i) => i === index ? { ...r, end: e.target.value } : r)
                              }))}
                            />
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
        );

      case 'custom_closed':
        return (
          <section className="availability-section">
            <div style={{ borderBottom: '2px solid #b7a78b', fontWeight: 600, fontSize: '1.5rem', marginBottom: 16, paddingBottom: 4, color: '#222' }}>
              Custom Closed Days
            </div>
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
                        onChange={(e) => {
                          const newRanges = [...newClosureTimeRanges];
                          newRanges[index].start = e.target.value;
                          setNewClosureTimeRanges(newRanges);
                        }}
                      />
                      <span>to</span>
                      <input
                        type="time"
                        value={range.end}
                        onChange={(e) => {
                          const newRanges = [...newClosureTimeRanges];
                          newRanges[index].end = e.target.value;
                          setNewClosureTimeRanges(newRanges);
                        }}
                      />
                    </div>
                  ))}
                  <button
                    className="add-range"
                    onClick={() => setNewClosureTimeRanges([...newClosureTimeRanges, { start: '18:00', end: '23:00' }])}
                  >
                    + Add Time Range
                  </button>
                </div>
              )}
              <button className="add-exception-btn" onClick={addExceptionalClosure}>
                Add Custom Closed Day
              </button>
            </div>
            <div className="exceptions-list">
              {exceptionalClosures.map(closure => (
                <div key={closure.id} className="exception-item">
                  {editingClosureId === closure.id ? (
                    <>
                      <DatePicker
                        selected={editingClosure.date ? new Date(editingClosure.date) : null}
                        onChange={date => setEditingClosure(e => ({ ...e, date }))}
                        className="date-picker"
                        minDate={new Date()}
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
                          {editingClosure.time_ranges.map((range, index) => (
                            <div key={index} className="time-range">
                              <input
                                type="time"
                                value={range.start}
                                onChange={e => setEditingClosure(ed => ({
                                  ...ed,
                                  time_ranges: ed.time_ranges.map((r, i) => i === index ? { ...r, start: e.target.value } : r)
                                }))}
                              />
                              <span>to</span>
                              <input
                                type="time"
                                value={range.end}
                                onChange={e => setEditingClosure(ed => ({
                                  ...ed,
                                  time_ranges: ed.time_ranges.map((r, i) => i === index ? { ...r, end: e.target.value } : r)
                                }))}
                              />
                            </div>
                          ))}
                          <button
                            className="add-range"
                            onClick={() => setEditingClosure(e => ({ ...e, time_ranges: [...e.time_ranges, { start: '18:00', end: '23:00' }] }))}
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
                      {closure.reason && <span className="closure-reason">{closure.reason}</span>}
                      {closure.full_day ? (
                        <span>Full Day</span>
                      ) : (
                        <span>{closure.time_ranges.map(range => `${formatTime12h(range.start)} - ${formatTime12h(range.end)}`).join(', ')}</span>
                      )}
                      <button className="delete-exception" onClick={() => handleEditClosure(closure)}>Edit</button>
                      <button className="delete-exception" onClick={() => deleteExceptionalClosure(closure.id)}>Delete</button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </section>
        );

      case 'private_events':
        return (
          <div>
            {/* Create Private Event Button and Modal */}
            <div style={{ marginBottom: '1.5rem' }}>
              <button
                style={{
                  background: '#a59480',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  padding: '0.7rem 1.2rem',
                  fontSize: '1rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
                onClick={() => setShowCreatePrivateEventForm(true)}
              >
                Create Private Event
              </button>
              {showCreatePrivateEventForm && (
                <div style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  width: '100vw',
                  height: '100vh',
                  background: 'rgba(0,0,0,0.35)',
                  zIndex: 1000,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <div style={{ background: '#faf9f7', border: '1px solid #ececec', borderRadius: 8, padding: '2rem', minWidth: 340, maxWidth: 480, boxShadow: '0 2px 16px rgba(0,0,0,0.13)', position: 'relative' }}>
                    <button
                      onClick={() => setShowCreatePrivateEventForm(false)}
                      style={{ position: 'absolute', top: 12, right: 16, background: 'none', border: 'none', fontSize: 22, color: '#888', cursor: 'pointer' }}
                      aria-label="Close"
                    >×</button>
                    <h2 style={{ fontWeight: 600, color: '#333', fontSize: '1.3rem', marginBottom: 18 }}>Create Private Event</h2>
                    <form onSubmit={handleCreatePrivateEvent}>
                      <div style={{ marginBottom: 12 }}>
                        <label style={{ fontWeight: 500, color: '#333', display: 'block', marginBottom: 4 }}>Event Name</label>
                        <input
                          type="text"
                          value={privateEvent.name}
                          onChange={e => setPrivateEvent(ev => ({ ...ev, name: e.target.value }))}
                          required
                          style={{ width: '100%', padding: '0.6rem', borderRadius: 4, border: '1px solid #ccc' }}
                        />
                      </div>
                      <div style={{ marginBottom: 12 }}>
                        <label style={{ fontWeight: 500, color: '#333', display: 'block', marginBottom: 4 }}>Event Type</label>
                        <input
                          type="text"
                          value={privateEvent.event_type}
                          onChange={e => setPrivateEvent(ev => ({ ...ev, event_type: e.target.value }))}
                          required
                          style={{ width: '100%', padding: '0.6rem', borderRadius: 4, border: '1px solid #ccc' }}
                        />
                      </div>
                      <div style={{ marginBottom: 12 }}>
                        <label style={{ fontWeight: 500, color: '#333', display: 'block', marginBottom: 4 }}>Date</label>
                        <DatePicker
                          selected={privateEvent.date}
                          onChange={date => setPrivateEvent(ev => ({ ...ev, date }))}
                          required
                          className="date-picker"
                          minDate={new Date()}
                        />
                      </div>
                      <div style={{ marginBottom: 12, display: 'flex', gap: 12 }}>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontWeight: 500, color: '#333', display: 'block', marginBottom: 4 }}>Start Time</label>
                          <input
                            type="time"
                            value={privateEvent.start}
                            onChange={e => setPrivateEvent(ev => ({ ...ev, start: e.target.value }))}
                            required
                            style={{ width: '100%', padding: '0.6rem', borderRadius: 4, border: '1px solid #ccc' }}
                          />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontWeight: 500, color: '#333', display: 'block', marginBottom: 4 }}>End Time</label>
                          <input
                            type="time"
                            value={privateEvent.end}
                            onChange={e => setPrivateEvent(ev => ({ ...ev, end: e.target.value }))}
                            required
                            style={{ width: '100%', padding: '0.6rem', borderRadius: 4, border: '1px solid #ccc' }}
                          />
                        </div>
                      </div>
                      <button
                        type="submit"
                        style={{ background: '#7c6b58', color: '#fff', border: 'none', borderRadius: 4, padding: '0.7rem 1.2rem', fontWeight: 600, fontSize: '1rem', marginTop: 8 }}
                      >
                        Create Event
                      </button>
                      {privateEventStatus && (
                        <div style={{ color: privateEventStatus.includes('created') ? '#228B22' : '#e53e3e', fontWeight: 600, marginTop: 10 }}>
                          {privateEventStatus}
                        </div>
                      )}
                    </form>
                  </div>
                </div>
              )}
            </div>
            {/* Private Events Table */}
            <table style={{ width: '100%', borderCollapse: 'collapse', background: '#faf9f7', borderRadius: 8, overflow: 'hidden', fontSize: '1.05rem' }}>
              <thead>
                <tr style={{ background: '#ececec', color: '#444' }}>
                  <th style={{ padding: '0.7rem' }}>Event Name</th>
                  <th style={{ padding: '0.7rem' }}>Type</th>
                  <th style={{ padding: '0.7rem' }}>Date</th>
                  <th style={{ padding: '0.7rem' }}>Time</th>
                  <th style={{ padding: '0.7rem' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {privateEvents.length === 0 ? (
                  <tr><td colSpan={4} style={{ textAlign: 'center', color: '#888', padding: '1.2rem' }}>No private events found.</td></tr>
                ) : (
                  privateEvents.map(ev => (
                    <tr key={ev.id}>
                      <td style={{ padding: '0.7rem' }}>{ev.title}</td>
                      <td style={{ padding: '0.7rem' }}>{ev.event_type}</td>
                      <td style={{ padding: '0.7rem' }}>{new Date(ev.start_time).toLocaleDateString()}</td>
                      <td style={{ padding: '0.7rem' }}>{new Date(ev.start_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} - {new Date(ev.end_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</td>
                      <td style={{ padding: '0.7rem' }}>
                        <button style={{ background: '#7c6b58', color: '#fff', border: 'none', borderRadius: 4, padding: '0.3rem 0.7rem', fontWeight: 600, cursor: 'pointer' }} onClick={() => handleOpenEditModal(ev)}>Edit</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="calendar-availability-control">
      {renderContent()}
      {error && <div className="error-message">{error}</div>}
      {successMessage && <div className="success-message">{successMessage}</div>}
    </div>
  );
};

export default CalendarAvailabilityControl; 