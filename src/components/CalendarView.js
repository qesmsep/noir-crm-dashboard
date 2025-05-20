
import 'react-big-calendar/lib/css/react-big-calendar.css';
import React, { useEffect, useState } from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';

const localizer = momentLocalizer(moment);

export default function CalendarView({ onSelectSlot, onSelectEvent }) {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    async function fetchData() {
      const [evRes, resRes] = await Promise.all([
        fetch('/api/events').then(r => r.json()),
        fetch('/api/reservations').then(r => r.json())
      ]);
      const mapped = (evRes.data || []).map(e => ({
        id: e.id, title: e.title, start: new Date(e.start_time), end: new Date(e.end_time), allDay: false
      })).concat((resRes.data || []).map(r => ({
        id: r.id, title: `Res: ${r.name}`, start: new Date(r.start_time), end: new Date(r.end_time), allDay: false
      })));
      setEvents(mapped);
    }
    fetchData();
  }, []);

  return (
    <Calendar
      localizer={localizer}
      events={events}
      defaultView="week"
      selectable
      onSelectSlot={onSelectSlot}
      onSelectEvent={onSelectEvent}
      style={{ height: 600 }}
    />
  );
}