import React, { useEffect, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import resourceTimelinePlugin from '@fullcalendar/resource-timeline';
import interactionPlugin from '@fullcalendar/interaction';
import '@fullcalendar/common/main.css';
import ReservationForm from './ReservationForm';
import { toCST, toCSTISOString, formatDateTime } from '../utils/dateUtils';
import { supabase } from '../api/supabaseClient';

export default function FullCalendarTimeline({ reloadKey, bookingStartDate, bookingEndDate }) {
  const [resources, setResources] = useState([]);
  const [events, setEvents] = useState([]);
  const [localReloadKey, setLocalReloadKey] = useState(0);
  const [selectedReservation, setSelectedReservation] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [newReservation, setNewReservation] = useState(null);
  const [eventData, setEventData] = useState({ evRes: null, resRes: null });
  const [currentDate, setCurrentDate] = useState(new Date());

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
      // Debug log: show all reservations fetched for date range
      if (resRes && resRes.data) {
        console.log('[FullCalendarTimeline] Reservations fetched:', resRes.data.map(r => ({
          id: r.id,
          name: r.name,
          party_size: r.party_size,
          start_time: r.start_time,
          end_time: r.end_time,
          status: r.status,
          event_type: r.event_type
        })));
      }
      setEventData({ evRes, resRes });
    });

    // Subscribe to real-time updates for reservations
    const subscription = supabase
      .channel('reservations')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'reservations' 
      }, (payload) => {
        console.log('Real-time update received:', payload);
        // Fetch fresh data when any change occurs
        Promise.all([
          fetch('/api/events').then(r => r.json()),
          fetch('/api/reservations').then(r => r.json())
        ]).then(([evRes, resRes]) => {
          setEventData({ evRes, resRes });
        });
      })
      .subscribe();

    // Cleanup subscription on unmount
    return () => {
      subscription.unsubscribe();
    };
  }, [reloadKey, localReloadKey]);

  useEffect(() => {
    if (!resources.length || !eventData.evRes || !eventData.resRes) return;
    const eventTypeEmojis = {
      birthday: '🎂',
      engagement: '💍',
      anniversary: '🥂',
      party: '🎉',
      graduation: '🎓',
      corporate: '🧑‍💼',
      holiday: '❄️',
      networking: '🤝',
      fundraiser: '🎗️',
      bachelor: '🥳',
      fun: '🍸',
      date: '💕',
    };
    const mapped = (eventData.evRes.data || []).map(e => {
      const isPrivate = e.private === true;
      const event = {
        id: String(e.id),
        title: isPrivate ? 'Private Event: ' + e.title : e.title,
        start: toCST(new Date(e.start_time)).toISOString(),
        end: toCST(new Date(e.end_time)).toISOString(),
        resourceId: String(e.table_id),
        type: 'event',
        backgroundColor: isPrivate ? '#e0e0e0' : undefined,
        textColor: isPrivate ? '#333' : undefined
      };
      if (isPrivate) {
        // Block off the whole venue by creating an event for each resource
        return resources.map(r => ({
          ...event,
          resourceId: r.id
        }));
      }
      return event;
    }).flat().concat(
      // Only include reservations with relevant statuses and in the visible date range
      (eventData.resRes.data || [])
        .filter(r => {
          // Show all reservations except those explicitly marked as cancelled
          return r.status !== 'cancelled';
        })
        .map(r => {
          // Debug log before rendering each reservation
          console.log('[FullCalendarTimeline] Rendering reservation:', {
            id: r.id,
            name: r.name,
            party_size: r.party_size,
            start_time: r.start_time,
            end_time: r.end_time,
            status: r.status,
            event_type: r.event_type
          });
          return {
            id: String(r.id),
            title: `${r.source === 'member' ? '🖤 ' : ''}${r.name}${r.tables?.number ? ' | Table ' + r.tables.number : ''} | Party Size: ${r.party_size}${r.event_type ? ' ' + eventTypeEmojis[r.event_type] : ''}`,
            extendedProps: {
              created_at: r.created_at ? formatDateTime(new Date(r.created_at), { 
                month: 'short', 
                day: 'numeric', 
                hour: 'numeric', 
                minute: '2-digit'
              }) : null
            },
            start: toCST(new Date(r.start_time)).toISOString(),
            end: toCST(new Date(r.end_time)).toISOString(),
            resourceId: String(r.table_id),
            ...r,
            type: 'reservation',
          };
        })
    );
    setEvents(mapped);
  }, [resources, eventData]);

  // Handler for drag-and-drop or resize
  async function handleEventDrop(info) {
    const event = info.event;
    const id = event.id;
    const newStart = toCSTISOString(event.start);
    const newEnd = toCSTISOString(event.end);
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
    const newStart = toCSTISOString(event.start);
    const newEnd = toCSTISOString(event.end);
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
    const start = toCST(arg.start);
    const end = new Date(start.getTime() + 90 * 60000); // 90 minutes later
    setNewReservation({
      start_time: toCSTISOString(start),
      end_time: toCSTISOString(end),
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
    const start = toCST(new Date());
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
          const evStart = toCST(new Date(ev.start));
          const evEnd = toCST(new Date(ev.end));
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
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Day of the week heading */}
      <div style={{ fontSize: '1.3em', fontWeight: 600, marginBottom: '0.5em', color: '#3a2c1a' }}>
        {currentDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
      </div>
      {/* Calendar in its own scrollable container, fills available space */}
      <div style={{ width: '100%', overflowX: 'auto', flex: '1 1 auto', minHeight: 0 }}>
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
          center: '',
          right: '' // removed next day label
        }}
        schedulerLicenseKey="CC-Attribution-NonCommercial-NoDerivatives"
        editable={true}
        eventDrop={handleEventDrop}
        eventResize={handleEventResize}
        eventClick={handleEventClick}
        selectable={true}
        select={handleSelectSlot}
        className="noir-fc-timeline"
        eventContent={(eventInfo) => {
          const isPrivate = eventInfo.event.title && eventInfo.event.title.startsWith('Private Event:');
          if (isPrivate) {
            return {
              html: `
                <div class="fc-event-main-frame" style="display: flex; align-items: center; gap: 0.5em;">
                  <span style="font-size: 1.2em; color: #b07d2c;">&#128274;</span>
                  <span style="font-weight: bold; color: white;">${eventInfo.event.title.replace('Private Event: ', '')}</span>
                </div>
              `
            };
          }
          return {
            html: `
              <div class="fc-event-main-frame">
                <div class="fc-event-title-container">
                  <div class="fc-event-title">${eventInfo.event.title}</div>
                  ${eventInfo.event.extendedProps.created_at ? 
                    (() => {
                      const d = new Date(eventInfo.event.extendedProps.created_at);
                      const formatted = `${(d.getMonth()+1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}-${d.getFullYear()} ${d.toLocaleString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true })}`;
                      return `<div class=\"fc-event-subtitle\" style=\"font-size: 0.8em; color: #666; margin-top: 2px;\">Created: ${formatted}</div>`;
                    })()
                  : ''}
                </div>
              </div>
            `
          };
        }}
        datesSet={(arg) => {
          // arg.start is the first visible date, arg.end is exclusive
          // For day view, use arg.start
          setCurrentDate(new Date(arg.start));
        }}
      />
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
              bookingStartDate={bookingStartDate}
              bookingEndDate={bookingEndDate}
              onDelete={selectedReservation ? async () => {
                if (window.confirm('Are you sure you want to delete this reservation? This will also release any credit card hold.')) {
                  await fetch(`/api/reservations?id=${selectedReservation.id}`, { method: 'DELETE' });
                  setShowModal(false);
                  setSelectedReservation(null);
                  setLocalReloadKey(k => k + 1);
                }
              } : undefined}
              isEdit={!!selectedReservation}
            />
          </div>
        </div>
      )}
      {/* Calendar Legend */}
      <div style={{
        marginTop: '1.5rem',
        padding: '1rem',
        background: '#f7f6f3',
        borderRadius: '8px',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '1.5rem',
        alignItems: 'center',
        fontSize: '1.05em',
        color: '#3a2c1a',
      }}>
        <span><span style={{fontSize: '1.2em'}}>🖤</span> Member Reservation</span>
        <span><span style={{fontSize: '1.2em'}}>🎉</span> Party</span>
        <span><span style={{fontSize: '1.2em'}}>🥳</span> Bachelor/Bachelorette</span>
        <span><span style={{fontSize: '1.2em'}}>🎂</span> Birthday</span>
        <span><span style={{fontSize: '1.2em'}}>💍</span> Engagement</span>
        <span><span style={{fontSize: '1.2em'}}>🥂</span> Anniversary</span>
        <span><span style={{fontSize: '1.2em'}}>🎓</span> Graduation</span>
        <span><span style={{fontSize: '1.2em'}}>🧑‍💼</span> Corporate</span>
        <span><span style={{fontSize: '1.2em'}}>❄️</span> Holiday</span>
        <span><span style={{fontSize: '1.2em'}}>🤝</span> Networking</span>
        <span><span style={{fontSize: '1.2em'}}>🎗️</span> Fundraiser</span>
        <span><span style={{fontSize: '1.2em'}}>🍸</span> Fun Night Out</span>
        <span><span style={{fontSize: '1.2em'}}>💕</span> Date Night</span>
        <span><span style={{fontSize: '1.2em', color: '#b07d2c'}}>&#128274;</span> Private Event (Venue Blocked)</span>
      </div>
    </div>
  );
}
