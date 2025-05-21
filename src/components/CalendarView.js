import 'react-big-calendar/lib/css/react-big-calendar.css';
import React, { useEffect, useState } from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';

const localizer = momentLocalizer(moment);

export default function CalendarView({ onSelectSlot, onSelectEvent, reloadKey }) {
  const [events, setEvents] = useState([]);
  const [tables, setTables] = useState([]);

  useEffect(() => {
    async function fetchData() {
      // Fetch tables
      const tablesRes = await fetch('/api/tables');
      const tablesJson = await tablesRes.json();
      const tableResources = (tablesJson.data || []).map(t => ({
        resourceId: t.id,
        resourceTitle: `Table ${t.number}`
      }));
      setTables(tableResources);

      // Fetch events and reservations
      const [evRes, resRes] = await Promise.all([
        fetch('/api/events').then(r => r.json()),
        fetch('/api/reservations').then(r => r.json())
      ]);
      // Map events and reservations to include resourceId (table_id)
      const mapped = (evRes.data || []).map(e => ({
        id: e.id,
        title: e.title,
        start: new Date(e.start_time),
        end: new Date(e.end_time),
        allDay: false,
        resourceId: e.table_id // assumes your event has table_id
      })).concat((resRes.data || []).map(r => ({
        id: r.id,
        title: `Res: ${r.name}`,
        start: new Date(r.start_time),
        end: new Date(r.end_time),
        allDay: false,
        resourceId: r.table_id // assumes your reservation has table_id
      })));
      setEvents(mapped);
    }
    fetchData();
  }, [reloadKey]);

  return (
    <Calendar
      localizer={localizer}
      events={events}
      resources={tables}
      resourceIdAccessor="resourceId"
      resourceTitleAccessor="resourceTitle"
      defaultView="day"
      views={['day', 'week', 'month']}
      selectable
      onSelectSlot={onSelectSlot}
      onSelectEvent={onSelectEvent}
      style={{ height: 600 }}
    />
  );
}