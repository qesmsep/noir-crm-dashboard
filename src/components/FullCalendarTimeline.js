import React, { useEffect, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import resourceTimelinePlugin from '@fullcalendar/resource-timeline';
import '@fullcalendar/core/main.css';
import '@fullcalendar/resource-timeline/main.css';

export default function FullCalendarTimeline({ reloadKey }) {
  const [resources, setResources] = useState([]);
  const [events, setEvents] = useState([]);

  useEffect(() => {
    // Fetch tables as resources
    fetch('/api/tables')
      .then(res => res.json())
      .then(data => {
        setResources((data.data || []).map(t => ({
          id: String(t.id),
          title: `Table ${t.number}`,
        })));
      });

    // Fetch reservations/events
    Promise.all([
      fetch('/api/events').then(r => r.json()),
      fetch('/api/reservations').then(r => r.json())
    ]).then(([evRes, resRes]) => {
      const mapped = (evRes.data || []).map(e => ({
        id: String(e.id),
        title: e.title,
        start: e.start_time,
        end: e.end_time,
        resourceId: String(e.table_id),
      })).concat((resRes.data || []).map(r => ({
        id: String(r.id),
        title: `Res: ${r.name}`,
        start: r.start_time,
        end: r.end_time,
        resourceId: String(r.table_id),
      }))
      setEvents(mapped);
    });
  }, [reloadKey]);

  return (
    <FullCalendar
      plugins={[resourceTimelinePlugin]}
      initialView="resourceTimelineDay"
      resources={resources}
      events={events}
      height="auto"
      slotMinTime="12:00:00"
      slotMaxTime="01:00:00"
      resourceAreaHeaderContent="Tables"
      headerToolbar={{
        left: 'today prev,next',
        center: 'title',
        right: 'resourceTimelineDay,resourceTimelineWeek'
      }}
    />
  );
}
