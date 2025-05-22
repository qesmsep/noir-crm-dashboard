import React, { useEffect, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import resourceTimelinePlugin from '@fullcalendar/resource-timeline';
import interactionPlugin from '@fullcalendar/interaction';
import '@fullcalendar/common/main.css';
import ReservationForm from './ReservationForm';

export default function FullCalendarTimeline({ reloadKey }) {
  const [resources, setResources] = useState([]);
  const [events, setEvents] = useState([]);
  const [localReloadKey, setLocalReloadKey] = useState(0);
  const [selectedReservation, setSelectedReservation] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [newReservation, setNewReservation] = useState(null);

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
        type: 'event',
      })).concat(
        (resRes.data || []).map(r => ({
          id: String(r.id),
          title: `${r.name} | Party Size: ${r.party_size}`,
          start: r.start_time,
          end: r.end_time,
          resourceId: String(r.table_id),
          ...r,
          type: 'reservation',
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

  // Handler for clicking a reservation
  function handleEventClick(info) {
    // Only allow editing reservations, not events
    if (info.event.extendedProps.type === 'reservation') {
      setSelectedReservation({ ...info.event.extendedProps, id: info.event.id });
      setShowModal(true);
    }
  }

  // Handler for saving reservation edits
  async function handleSaveEditReservation(updated) {
    const res = await fetch(`/api/reservations?id=${selectedReservation.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated)
    });
    setShowModal(false);
    setSelectedReservation(null);
    setLocalReloadKey(k => k + 1);
  }

  // Handler for slot selection to create a new reservation
  function handleSelectSlot(arg) {
    // arg.start, arg.end, arg.resource (table id)
    const start = arg.start;
    const end = new Date(start.getTime() + 90 * 60000); // 90 minutes later
    setNewReservation({
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      table_id: arg.resource?.id || arg.resourceId || arg.resource || '',
    });
    setShowModal(true);
    setSelectedReservation(null);
  }

  // Handler for saving a new reservation
  async function handleSaveNewReservation(form) {
    const payload = {
      ...form,
      start_time: form.start_time,
      end_time: form.end_time,
      table_id: newReservation.table_id,
    };
    const res = await fetch('/api/reservations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    setShowModal(false);
    setNewReservation(null);
    setLocalReloadKey(k => k + 1);
  }

  // Helper: get all 15-min slots between 6pm and 1am
  function getTimeSlots() {
    const slots = [];
    const start = new Date();
    start.setHours(18, 0, 0, 0); // 6pm
    for (let i = 0; i < 28; i++) { // 7 hours * 4 = 28 slots
      const slotStart = new Date(start.getTime() + i * 15 * 60000);
      slots.push(slotStart);
    }
    return slots;
  }

  // Helper: get total guests for each slot
  function getGuestTotals(events) {
    const slots = getTimeSlots();
    return slots.map(slotStart => {
      const slotEnd = new Date(slotStart.getTime() + 15 * 60000);
      // Sum party_size for all reservations overlapping this slot
      let total = 0;
      for (const ev of events) {
        if (ev.type === 'reservation' && ev.start && ev.end && ev.party_size) {
          const evStart = new Date(ev.start);
          const evEnd = new Date(ev.end);
          if (!(evEnd <= slotStart || evStart >= slotEnd)) {
            total += Number(ev.party_size);
          }
        }
      }
      return total;
    });
  }

  const slots = getTimeSlots();
  const guestTotals = getGuestTotals(events);

  return (
    <div style={{
      width: '100%',
      maxWidth: '100vw',
      height: '80vh',
      minHeight: 400,
      overflowY: 'auto',
      position: 'relative'
    }}>
      <div style={{ width: '100%', overflowX: 'auto', position: 'relative' }}>
        <FullCalendar
          plugins={[resourceTimelinePlugin, interactionPlugin]}
          initialView="resourceTimelineDay"
          resources={resources}
          events={events}
          height="100%"
          slotMinTime="18:00:00" // 6pm
          slotMaxTime="25:00:00" // 1am next day
          slotDuration="00:15:00" // 15-minute columns
          snapDuration="00:15:00" // allow 15-minute increments
          slotLabelInterval="00:30:00" // show half-hour marks
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
          eventClick={handleEventClick}
          selectable={true}
          select={handleSelectSlot}
          className="noir-fc-timeline"
        />
        {/* Total Guests Row */}
        <div style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          marginTop: 0,
          background: '#f3f2ef',
          borderRadius: 6,
          padding: '0.5rem 0.5rem',
          fontWeight: 600,
          fontSize: '1rem',
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          pointerEvents: 'none',
          zIndex: 2
        }}>
          <div style={{ minWidth: 90, textAlign: 'right', color: '#888', paddingRight: 8, background: '#f3f2ef', pointerEvents: 'auto' }}>Total Guests</div>
          {slots.map((slot, idx) => (
            <div key={slot.toISOString()} style={{ minWidth: 60, maxWidth: 60, textAlign: 'center', color: '#333', background: '#f3f2ef', pointerEvents: 'auto' }}>
              {guestTotals[idx]}
            </div>
          ))}
        </div>
      </div>
      {/* Reservation Edit/Create Modal */}
      {showModal && (selectedReservation || newReservation) && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0,0,0,0.5)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <div style={{
            background: '#fff',
            padding: '2rem',
            borderRadius: '8px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
            minWidth: '350px',
            maxWidth: '95vw',
            textAlign: 'left',
            position: 'relative',
          }}>
            <button onClick={() => { setShowModal(false); setSelectedReservation(null); setNewReservation(null); }} style={{ position: 'absolute', top: 10, right: 10, background: 'none', border: 'none', fontSize: 22, cursor: 'pointer' }}>&times;</button>
            <h3>{selectedReservation ? 'Edit Reservation' : 'Create Reservation'}</h3>
            {selectedReservation && (
              <div style={{ marginBottom: '1rem', color: '#555' }}>
                <div><strong>Name:</strong> {selectedReservation.name}</div>
                <div><strong>Phone:</strong> {selectedReservation.phone}</div>
                <div><strong>Email:</strong> {selectedReservation.email}</div>
                <div><strong>Notes:</strong> {selectedReservation.notes}</div>
                <div><strong>Table:</strong> {resources.find(r => r.id === String(selectedReservation.table_id))?.title || selectedReservation.table_id}</div>
              </div>
            )}
            <ReservationForm
              initialStart={(selectedReservation ? selectedReservation.start_time || selectedReservation.start : newReservation.start_time)}
              initialEnd={(selectedReservation ? selectedReservation.end_time || selectedReservation.end : newReservation.end_time)}
              table_id={selectedReservation ? selectedReservation.table_id : newReservation.table_id}
              onSave={async (form) => {
                if (selectedReservation) {
                  await handleSaveEditReservation({
                    start_time: form.start_time,
                    end_time: form.end_time,
                    party_size: form.party_size
                  });
                } else if (newReservation) {
                  await handleSaveNewReservation(form);
                }
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
