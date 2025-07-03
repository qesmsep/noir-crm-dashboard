import 'react-big-calendar/lib/css/react-big-calendar.css';
import React, { useEffect, useState } from 'react';
import { Calendar, momentLocalizer, Event as RBCEvent, SlotInfo } from 'react-big-calendar';
import moment from 'moment';
import { fromUTC } from '../utils/dateUtils';

const localizer = momentLocalizer(moment);

interface TableResource {
  resourceId: string;
  resourceTitle: string;
}

interface CalendarViewProps {
  onSelectSlot?: (slotInfo: SlotInfo) => void;
  onSelectEvent?: (event: RBCEvent) => void;
  reloadKey?: number;
}

interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  resourceId: string;
}

const CalendarView: React.FC<CalendarViewProps> = ({ onSelectSlot, onSelectEvent, reloadKey }) => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [tables, setTables] = useState<TableResource[]>([]);

  useEffect(() => {
    async function fetchData() {
      const tablesRes = await fetch('/api/tables');
      const tablesJson = await tablesRes.json();
      const tableResources = (tablesJson.data || [])
        .sort((a: any, b: any) => a.table_number.localeCompare(b.table_number))
        .map((t: any) => ({
          resourceId: t.id,
          resourceTitle: `Table ${t.table_number}`
        }));
      setTables(tableResources);
      const [evRes, resRes] = await Promise.all([
        fetch('/api/events').then(r => r.json()),
        fetch('/api/reservations').then(r => r.json())
      ]);
      const mapped: CalendarEvent[] = (evRes.data || []).map((e: any) => ({
        id: e.id,
        title: e.title,
        start: fromUTC(e.start_time, 'America/Chicago').toJSDate(),
        end: fromUTC(e.end_time, 'America/Chicago').toJSDate(),
        allDay: false,
        resourceId: e.table_id
      })).concat((resRes.data || []).map((r: any) => ({
        id: r.id,
        title: `Res: ${r.name}`,
        start: fromUTC(r.start_time, 'America/Chicago').toJSDate(),
        end: fromUTC(r.end_time, 'America/Chicago').toJSDate(),
        allDay: false,
        resourceId: r.table_id
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
};

export default CalendarView; 