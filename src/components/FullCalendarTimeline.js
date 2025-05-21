import React, { useEffect, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import resourceTimelinePlugin from '@fullcalendar/resource-timeline';
import '@fullcalendar/common/main.css';


export default function FullCalendarTimeline({ reloadKey }) {
  const [resources, setResources] = useState([]);
  const [events, setEvents] = useState([]);

  useEffect(() => {
    // Fetch tables as resources, sorted by number
    fetch('/api/tables')
      .then(res => res.json())
      .then(data => {
        setResources((data.data || [])
          .sort((a, b) => a.number - b.number)
          .map(t => ({
            id: String(t.id),
            title: `Table ${t.number}`,
          }))
        );
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
      })).concat(
        (resRes.data || []).map(r => ({
          id: String(r.id),
          title: `${r.name} | Party Size: ${r.party_size}`,
          start: r.start_time,
          end: r.end_time,
          resourceId: String(r.table_id),
        }))
      );
      setEvents(mapped);
    });
  }, [reloadKey]);

  return (
    <div style={{
      width: '100%',
      maxWidth: '100vw',
      height: '80vh',
      minHeight: 400,
      overflowX: 'auto',
      overflowY: 'auto'
    }}>
      <FullCalendar
        plugins={[resourceTimelinePlugin]}
        initialView="resourceTimelineDay"
        resources={resources}
        events={events}
        height="100%"
        slotMinTime="18:00:00" // 6pm
        slotMaxTime="25:00:00" // 1am next day
        slotDuration="00:30:00" // 30-minute columns
        slotLabelInterval="00:30" // show half-hour marks
        resourceAreaHeaderContent="Tables"
        resourceAreaWidth="90px"
        headerToolbar={{
          left: 'today prev,next',
          center: 'title',
          right: 'resourceTimelineDay'
        }}
        schedulerLicenseKey="CC-Attribution-NonCommercial-NoDerivatives"
      />
    </div>
  );
}
