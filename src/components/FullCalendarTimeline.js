import React, { useEffect, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import resourceTimelinePlugin from '@fullcalendar/resource-timeline';
import interactionPlugin from '@fullcalendar/interaction';
import '@fullcalendar/common/main.css';

export default function FullCalendarTimeline({ reloadKey }) {
  const [resources, setResources] = useState([]);
  const [events, setEvents] = useState([]);
  const [localReloadKey, setLocalReloadKey] = useState(0);

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
  }, [reloadKey, localReloadKey]);

  // Handler for drag-and-drop or resize
  async function handleEventDrop(info) {
    const event = info.event;
    const id = event.id;
    const newStart = event.start.toISOString();
    const newEnd = event.end.toISOString();
    // FullCalendar v6: event.getResources() returns an array
    const newTableId = event.getResources && event.getResources().length > 0
      ? event.getResources()[0].id
      : event.extendedProps.resourceId;

    const res = await fetch(`/api/reservations?id=${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        start_time: newStart,
        end_time: newEnd,
        table_id: newTableId
      })
    });
    if (!res.ok) {
      alert('Failed to update reservation!');
      info.revert();
    } else {
      setLocalReloadKey(k => k + 1);
    }
  }

  async function handleEventResize(info) {
    const event = info.event;
    const id = event.id;
    const newStart = event.start.toISOString();
    const newEnd = event.end.toISOString();
    const res = await fetch(`/api/reservations?id=${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        start_time: newStart,
        end_time: newEnd
      })
    });
    if (!res.ok) {
      alert('Failed to update reservation!');
      info.revert();
    } else {
      setLocalReloadKey(k => k + 1);
    }
  }

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
        plugins={[resourceTimelinePlugin, interactionPlugin]}
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
          right: '' // no day/week buttons
        }}
        schedulerLicenseKey="CC-Attribution-NonCommercial-NoDerivatives"
        editable={true}
        eventDrop={handleEventDrop}
        eventResize={handleEventResize}
      />
    </div>
  );
}
