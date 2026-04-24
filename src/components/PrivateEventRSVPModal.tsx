import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { DateTime } from 'luxon';
import styles from '../styles/PrivateEventRSVPModal.module.css';

interface PrivateEvent {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  location_id: string;
}

interface Table {
  id: string;
  table_number: number;
  seats: number;
}

interface TableAvailability extends Table {
  isAvailable: boolean;
  conflictingReservation?: {
    guest_name: string;
    start_time: string;
    end_time: string;
  };
}

interface RSVP {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  party_size: number;
  table_id: string | null;
  start_time: string;
  end_time: string;
  private_event_id: string;
  tables?: {
    id: string;
    table_number: number;
    seats: number;
  } | null;
}

interface RSVPRowState extends RSVP {
  isDirty: boolean;
  editingTableId?: string;
  editingStartTime?: string;
  editingEndTime?: string;
  isSaving?: boolean;
  error?: string;
}

interface PrivateEventRSVPModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentDate: Date;
  locationSlug: string;
  onAssignmentComplete: () => void;
}

const PrivateEventRSVPModal: React.FC<PrivateEventRSVPModalProps> = ({
  isOpen,
  onClose,
  currentDate,
  locationSlug,
  onAssignmentComplete,
}) => {
  const [events, setEvents] = useState<PrivateEvent[]>([]);
  const [rsvps, setRsvps] = useState<RSVPRowState[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const [locationId, setLocationId] = useState<string | null>(null);
  const [allReservations, setAllReservations] = useState<any[]>([]); // All reservations for conflict checking

  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen, currentDate, locationSlug]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Get location ID
      const { data: locationData, error: locationError } = await supabase
        .from('locations')
        .select('id')
        .eq('slug', locationSlug)
        .single();

      if (locationError || !locationData) {
        console.error('Error fetching location:', locationError);
        return;
      }

      setLocationId(locationData.id);

      // Get start and end of day in UTC
      const startOfDay = DateTime.fromJSDate(currentDate)
        .setZone('America/Chicago')
        .startOf('day')
        .toUTC()
        .toISO();

      const endOfDay = DateTime.fromJSDate(currentDate)
        .setZone('America/Chicago')
        .endOf('day')
        .toUTC()
        .toISO();

      // Fetch private events on this date at this location
      const { data: eventsData, error: eventsError } = await supabase
        .from('private_events')
        .select('id, title, start_time, end_time, location_id')
        .eq('status', 'active')
        .eq('location_id', locationData.id)
        .gte('start_time', startOfDay)
        .lte('start_time', endOfDay)
        .order('start_time', { ascending: true });

      if (eventsError) {
        console.error('Error fetching events:', eventsError);
        return;
      }

      setEvents(eventsData || []);

      if (!eventsData || eventsData.length === 0) {
        setRsvps([]);
        setLoading(false);
        return;
      }

      // Fetch RSVPs for these events
      const eventIds = eventsData.map(e => e.id);
      const { data: rsvpsData, error: rsvpsError } = await supabase
        .from('reservations')
        .select(`
          id,
          first_name,
          last_name,
          phone,
          party_size,
          table_id,
          start_time,
          end_time,
          private_event_id,
          tables (
            id,
            table_number,
            seats
          )
        `)
        .in('private_event_id', eventIds)
        .eq('source', 'rsvp_private_event')
        .order('created_at', { ascending: true });

      if (rsvpsError) {
        console.error('Error fetching RSVPs:', rsvpsError);
        return;
      }

      // Initialize row state
      const rsvpRows: RSVPRowState[] = (rsvpsData || []).map(rsvp => ({
        ...rsvp,
        tables: Array.isArray(rsvp.tables) ? rsvp.tables[0] : rsvp.tables,
        isDirty: false,
      }));

      setRsvps(rsvpRows);

      // Fetch available tables for this location
      console.log('Fetching tables for location:', locationData.id, locationSlug);
      const { data: tablesData, error: tablesError } = await supabase
        .from('tables')
        .select('id, table_number, seats')
        .eq('location_id', locationData.id)
        .order('table_number', { ascending: true });

      if (tablesError) {
        console.error('Error fetching tables:', tablesError);
        return;
      }

      console.log('Fetched tables:', tablesData);
      console.log('First table structure:', tablesData?.[0]);
      setTables(tablesData || []);

      // Fetch all reservations for the current date to check conflicts
      const reservationsStartOfDay = DateTime.fromJSDate(currentDate)
        .setZone('America/Chicago')
        .startOf('day')
        .toUTC()
        .toISO()!;

      const reservationsEndOfDay = DateTime.fromJSDate(currentDate)
        .setZone('America/Chicago')
        .endOf('day')
        .toUTC()
        .toISO()!;

      // Fetch reservations with table join to ensure location match
      const { data: allReservationsData, error: allReservationsError } = await supabase
        .from('reservations')
        .select(`
          id,
          table_id,
          start_time,
          end_time,
          first_name,
          last_name,
          status,
          private_event_id,
          tables!inner (
            location_id
          )
        `)
        .neq('status', 'cancelled')
        .eq('tables.location_id', locationData.id)
        .gte('end_time', reservationsStartOfDay)
        .lte('start_time', reservationsEndOfDay);

      if (allReservationsError) {
        console.error('Error fetching all reservations:', allReservationsError);
      } else {
        console.log('Fetched all reservations for conflict checking:', allReservationsData?.length);
        setAllReservations(allReservationsData || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTableChange = (rsvpId: string, tableId: string) => {
    setRsvps(prev =>
      prev.map(rsvp =>
        rsvp.id === rsvpId
          ? { ...rsvp, editingTableId: tableId, isDirty: true, error: undefined }
          : rsvp
      )
    );
  };

  const handleTimeChange = (rsvpId: string, startTime: string) => {
    setRsvps(prev =>
      prev.map(rsvp => {
        if (rsvp.id === rsvpId) {
          // Calculate end time based on party size
          const duration = rsvp.party_size <= 2 ? 90 : 120;
          const start = DateTime.fromISO(startTime, { zone: 'utc' });
          const end = start.plus({ minutes: duration });

          return {
            ...rsvp,
            editingStartTime: startTime,
            editingEndTime: end.toISO(),
            isDirty: true,
            error: undefined,
          };
        }
        return rsvp;
      })
    );
  };

  const handleSave = async (rsvp: RSVPRowState) => {
    const tableId = rsvp.editingTableId || rsvp.table_id;
    const startTime = rsvp.editingStartTime || rsvp.start_time;
    const endTime = rsvp.editingEndTime || rsvp.end_time;

    console.log('handleSave - tableId:', tableId, 'type:', typeof tableId);
    console.log('handleSave - startTime:', startTime);
    console.log('handleSave - endTime:', endTime);

    if (!tableId || !startTime || !endTime) {
      setRsvps(prev =>
        prev.map(r =>
          r.id === rsvp.id
            ? { ...r, error: 'Please select a table and time' }
            : r
        )
      );
      return;
    }

    // Set saving state
    setRsvps(prev =>
      prev.map(r => (r.id === rsvp.id ? { ...r, isSaving: true, error: undefined } : r))
    );

    try {
      // Get auth token for API request
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`/api/reservations/${rsvp.id}/assign-table`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          table_id: tableId,
          start_time: startTime,
          end_time: endTime,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to assign table');
      }

      // Update the RSVP with saved data
      setRsvps(prev =>
        prev.map(r =>
          r.id === rsvp.id
            ? {
                ...r,
                table_id: tableId,
                start_time: startTime,
                end_time: endTime,
                tables: data.reservation.tables,
                isDirty: false,
                isSaving: false,
                editingTableId: undefined,
                editingStartTime: undefined,
                editingEndTime: undefined,
                error: undefined,
              }
            : r
        )
      );

      // Notify parent to refresh calendar
      onAssignmentComplete();
    } catch (error) {
      console.error('Error saving assignment:', error);
      setRsvps(prev =>
        prev.map(r =>
          r.id === rsvp.id
            ? {
                ...r,
                isSaving: false,
                error: error instanceof Error ? error.message : 'Failed to save',
              }
            : r
        )
      );
    }
  };

  const formatTime = (isoTime: string) => {
    return DateTime.fromISO(isoTime, { zone: 'utc' })
      .setZone('America/Chicago')
      .toFormat('h:mm a');
  };

  const formatDateTimeLocal = (isoTime: string) => {
    // Format for datetime-local input (YYYY-MM-DDTHH:mm)
    return DateTime.fromISO(isoTime, { zone: 'utc' })
      .setZone('America/Chicago')
      .toFormat("yyyy-MM-dd'T'HH:mm");
  };

  const handleTimeInputChange = (rsvpId: string, localDateTime: string) => {
    // Convert local datetime to UTC ISO string
    const utcTime = DateTime.fromFormat(localDateTime, "yyyy-MM-dd'T'HH:mm", {
      zone: 'America/Chicago',
    })
      .toUTC()
      .toISO();

    handleTimeChange(rsvpId, utcTime);
  };

  const getAvailableTablesForRSVP = (rsvp: RSVPRowState): TableAvailability[] => {
    const startTime = rsvp.editingStartTime || rsvp.start_time;
    const endTime = rsvp.editingEndTime || rsvp.end_time;

    if (!startTime || !endTime) {
      return tables.map(t => ({ ...t, isAvailable: true }));
    }

    // Check each table for conflicts with ALL reservations (not just RSVPs in modal)
    return tables.map(table => {
      // Check conflicts in all existing reservations
      const conflict = allReservations.find(r => {
        // Skip the current RSVP
        if (r.id === rsvp.id) return false;

        // Skip reservations without table assignments
        if (!r.table_id) return false;

        // Check if it's the same table
        if (r.table_id !== table.id) return false;

        // Get the time for this reservation
        const otherStart = r.start_time;
        const otherEnd = r.end_time;

        // Skip if times are invalid
        if (!otherStart || !otherEnd) return false;

        // Check for time overlap
        return (
          (startTime < otherEnd && endTime > otherStart)
        );
      });

      // Also check conflicts with unsaved changes in the modal
      const modalConflict = !conflict && rsvps.find(r => {
        // Skip the current RSVP
        if (r.id === rsvp.id) return false;

        // Only check RSVPs with pending table selections
        const tableId = r.editingTableId || r.table_id;
        if (!tableId) return false;

        // Check if it's the same table
        if (tableId !== table.id) return false;

        // Get the time for this RSVP
        const otherStart = r.editingStartTime || r.start_time;
        const otherEnd = r.editingEndTime || r.end_time;

        // Check for time overlap
        return (
          (startTime < otherEnd && endTime > otherStart)
        );
      });

      const finalConflict = conflict || modalConflict;

      if (finalConflict) {
        return {
          ...table,
          isAvailable: false,
          conflictingReservation: {
            guest_name: `${finalConflict.first_name} ${finalConflict.last_name}`,
            start_time: finalConflict.editingStartTime || finalConflict.start_time,
            end_time: finalConflict.editingEndTime || finalConflict.end_time,
          },
        };
      }

      return { ...table, isAvailable: true };
    });
  };

  const groupRSVPsByEvent = () => {
    const grouped: { [eventId: string]: RSVPRowState[] } = {};
    rsvps.forEach(rsvp => {
      if (!grouped[rsvp.private_event_id]) {
        grouped[rsvp.private_event_id] = [];
      }
      grouped[rsvp.private_event_id].push(rsvp);
    });
    return grouped;
  };

  if (!isOpen) return null;

  const formattedDate = DateTime.fromJSDate(currentDate)
    .setZone('America/Chicago')
    .toFormat('MMMM d, yyyy');

  const groupedRSVPs = groupRSVPsByEvent();

  // Debug logging
  console.log('Modal render - Tables available:', tables.length);
  console.log('Modal render - Events:', events.length);
  console.log('Modal render - RSVPs:', rsvps.length);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Private Event RSVPs - {formattedDate}</h2>
          <button className={styles.closeButton} onClick={onClose}>
            ×
          </button>
        </div>

        <div className={styles.content}>
          {loading ? (
            <div className={styles.loading}>Loading RSVPs...</div>
          ) : events.length === 0 ? (
            <div className={styles.empty}>No private events on this date.</div>
          ) : (
            events.map(event => {
              const eventRSVPs = groupedRSVPs[event.id] || [];
              const unassignedCount = eventRSVPs.filter(r => !r.table_id).length;
              const assignedCount = eventRSVPs.filter(r => r.table_id).length;

              return (
                <div key={event.id} className={styles.eventSection}>
                  <div className={styles.eventHeader}>
                    <h3 className={styles.eventTitle}>
                      📅 {event.title} ({formatTime(event.start_time)} -{' '}
                      {formatTime(event.end_time)}) - {eventRSVPs.length} RSVPs
                    </h3>
                    <div className={styles.eventStats}>
                      <span className={styles.statBadge}>
                        ✓ {assignedCount} Assigned
                      </span>
                      <span className={styles.statBadge}>
                        ⏳ {unassignedCount} Unassigned
                      </span>
                    </div>
                  </div>

                  {eventRSVPs.length === 0 ? (
                    <div className={styles.empty}>No RSVPs for this event.</div>
                  ) : (
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Phone</th>
                          <th>Party</th>
                          <th>Table</th>
                          <th>Time</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {eventRSVPs.map(rsvp => {
                          const isAssigned = !!rsvp.table_id && !rsvp.isDirty;
                          const currentTableId = rsvp.editingTableId || rsvp.table_id;
                          const currentStartTime =
                            rsvp.editingStartTime || rsvp.start_time;

                          // Get available tables for this RSVP
                          const availableTables = getAvailableTablesForRSVP(rsvp);

                          return (
                            <tr key={rsvp.id} className={styles.tableRow}>
                              <td>
                                {rsvp.first_name} {rsvp.last_name}
                              </td>
                              <td>{rsvp.phone}</td>
                              <td>{rsvp.party_size}</td>
                              <td>
                                {isAssigned ? (
                                  <span className={styles.assignedText}>
                                    Table {rsvp.tables?.table_number} (
                                    {rsvp.tables?.seats})
                                  </span>
                                ) : (
                                  <select
                                    className={styles.select}
                                    value={currentTableId || ''}
                                    onChange={e =>
                                      handleTableChange(rsvp.id, e.target.value)
                                    }
                                  >
                                    <option value="">Select Table</option>
                                    {availableTables.map(table => (
                                      <option
                                        key={table.id}
                                        value={table.id}
                                        disabled={!table.isAvailable}
                                      >
                                        Table {table.table_number} ({table.seats} seats)
                                        {!table.isAvailable && ' - Unavailable'}
                                      </option>
                                    ))}
                                  </select>
                                )}
                              </td>
                              <td>
                                {isAssigned ? (
                                  <span className={styles.assignedText}>
                                    {formatTime(rsvp.start_time)}
                                  </span>
                                ) : (
                                  <input
                                    type="datetime-local"
                                    className={styles.timeInput}
                                    value={formatDateTimeLocal(currentStartTime)}
                                    onChange={e =>
                                      handleTimeInputChange(rsvp.id, e.target.value)
                                    }
                                  />
                                )}
                              </td>
                              <td>
                                {isAssigned ? (
                                  <span className={styles.checkmark}>✓</span>
                                ) : rsvp.isDirty ? (
                                  <button
                                    className={styles.saveButton}
                                    onClick={() => handleSave(rsvp)}
                                    disabled={rsvp.isSaving}
                                  >
                                    {rsvp.isSaving ? 'Saving...' : 'Save'}
                                  </button>
                                ) : null}
                                {rsvp.error && (
                                  <div className={styles.error} title={rsvp.error}>
                                    ⚠️
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className={styles.footer}>
          <button className={styles.closeFooterButton} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default PrivateEventRSVPModal;
