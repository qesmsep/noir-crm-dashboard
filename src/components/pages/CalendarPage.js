import React from 'react';
import FullCalendarTimeline from '../FullCalendarTimeline';

const CalendarPage = ({ reloadKey, bookingStartDate, bookingEndDate, eventInfo }) => {
  return (
    <div style={{ padding: '2rem', maxWidth: '100vw', width: '90%' }}>
      <h2>Seating Calendar</h2>
      <FullCalendarTimeline reloadKey={reloadKey} bookingStartDate={bookingStartDate} bookingEndDate={bookingEndDate} />
      {eventInfo && (
        <div style={{ marginTop: '1rem' }}>
          <p>Event/Reservation ID: {eventInfo.id}</p>
        </div>
      )}
    </div>
  );
};

export default CalendarPage; 