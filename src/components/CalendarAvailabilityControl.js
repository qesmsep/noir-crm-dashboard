import React, { useState, useEffect } from 'react';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { supabase } from '../api/supabaseClient';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

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

  // Error State
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

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
        date: newClosureDate,
        reason: newClosureReason,
        type: 'exceptional_closure'
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

  return (
    <div className="availability-control">
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
              <span>{new Date(open.date).toLocaleDateString()}</span>
              <span>{open.time_ranges.map(range => `${range.start}-${range.end}`).join(', ')}</span>
              {open.label && <span className="event-label">{open.label}</span>}
              <button 
                className="delete-exception"
                onClick={() => deleteExceptionalOpen(open.id)}
              >
                Delete
              </button>
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
          <button className="add-exception-btn" onClick={addExceptionalClosure}>
            Add Closure
          </button>
        </div>
        <div className="exceptions-list">
          {exceptionalClosures.map((closure) => (
            <div key={closure.id} className="exception-item">
              <span>{new Date(closure.date).toLocaleDateString()}</span>
              {closure.reason && <span className="closure-reason">{closure.reason}</span>}
              <button 
                className="delete-exception"
                onClick={() => deleteExceptionalClosure(closure.id)}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default CalendarAvailabilityControl; 