import React from 'react';

const ReservationPage = ({
  phone,
  setPhone,
  partySize,
  setPartySize,
  date,
  setDate,
  time,
  setTime,
  bookingStartDate,
  bookingEndDate,
  eventType,
  setEventType,
  getAvailableTimes,
  eventTypes,
  reserveStatus,
  handleReserveNow,
  nextAvailableTime,
  setNextAvailableTime,
  createDateFromTimeString
}) => {
  return (
    <div style={{ padding: '2rem' }}>
      <div className="reserve-form">
        <h2>Reserve On The Spot</h2>
        <div className="form-group">
          <label>Phone Number</label>
          <input
            type="text"
            placeholder="Enter phone"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            className="form-control"
          />
        </div>
        <div className="form-group">
          <label>Party Size</label>
          <div className="party-size-control">
            <button type="button" onClick={() => setPartySize(Math.max(1, partySize - 1))}>−</button>
            <span>{partySize} guests</span>
            <button type="button" onClick={() => setPartySize(partySize + 1)}>+</button>
          </div>
        </div>
        <div className="form-group">
          <label>Date</label>
          <input
            type="date"
            value={date ? date.toISOString().split('T')[0] : ''}
            onChange={e => setDate(new Date(e.target.value))}
            min={bookingStartDate ? bookingStartDate.toISOString().split('T')[0] : ''}
            max={bookingEndDate ? bookingEndDate.toISOString().split('T')[0] : ''}
            className="form-control"
          />
        </div>
        <div className="form-group">
          <label>Time</label>
          <select
            value={time}
            onChange={e => setTime(e.target.value)}
            className="form-control"
            disabled={getAvailableTimes(date).length === 0}
          >
            {getAvailableTimes(date).length === 0 ? (
              <option value="">No available times</option>
            ) : (
              getAvailableTimes(date).map(t => (
                <option key={t} value={t}>
                  {createDateFromTimeString(t).toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    timeZone: 'America/Chicago'
                  })}
                </option>
              ))
            )}
          </select>
        </div>
        <div className="form-group">
          <label>Event Type</label>
          <select
            value={eventType}
            onChange={e => setEventType(e.target.value)}
            className="form-control"
          >
            <option value="">Select an event type...</option>
            {eventTypes && eventTypes.map(type => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={handleReserveNow}
          className="reserve-button"
        >
          Reserve Now
        </button>
        {reserveStatus && (
          <div className={`reserve-status ${reserveStatus.includes('confirmed') ? 'success' : 'error'}`}>
            {reserveStatus}
          </div>
        )}
      </div>
      {nextAvailableTime && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', padding: '2rem', borderRadius: '12px', maxWidth: 400, textAlign: 'center' }}>
            <h3>No table available at your requested time</h3>
            <p>The next available time for your party size is:</p>
            <p style={{ fontWeight: 'bold', fontSize: '1.2rem' }}>{new Date(nextAvailableTime).toLocaleString([], { dateStyle: 'full', timeStyle: 'short' })}</p>
            <button onClick={() => setNextAvailableTime(null)} style={{ marginTop: '1.5rem', padding: '0.5rem 1.5rem', background: '#4a90e2', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '1rem' }}>OK</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReservationPage; 