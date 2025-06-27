import React, { useEffect, useState, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import resourceTimelinePlugin from '@fullcalendar/resource-timeline';
import interactionPlugin from '@fullcalendar/interaction';
import '@fullcalendar/common/main.css';
import ReservationForm from './ReservationForm';
import ReservationEditDrawer from './ReservationEditDrawer';
import { toCST, toCSTISOString, formatDateTime } from '../utils/dateUtils';
import { supabase } from '../pages/api/supabaseClient';
import {
  Box,
  Button,
  useDisclosure,
  Text,
  VStack,
  HStack,
  useToast,
  IconButton,
  Wrap,
  WrapItem,
  Grid,
  GridItem,
} from '@chakra-ui/react';
import { ChevronLeftIcon, ChevronRightIcon } from '@chakra-ui/icons';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';

interface Resource {
  id: string;
  title: string;
}

interface EventData {
  evRes: any;
  resRes: any;
}

interface FullCalendarTimelineProps {
  reloadKey?: number;
  bookingStartDate?: Date;
  bookingEndDate?: Date;
  baseDays?: number[];
  viewOnly?: boolean;
}

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || 'pk_test_12345');

const eventTypeEmojis: Record<string, string> = {
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
  bachelorette: '🥳',
  private_event: '🔒',
  fun: '🍸',
  date: '💕',
};

const FullCalendarTimeline: React.FC<FullCalendarTimelineProps> = ({ reloadKey, bookingStartDate, bookingEndDate, baseDays, viewOnly = false }) => {
  const calendarRef = useRef<FullCalendar | null>(null);
  const [resources, setResources] = useState<Resource[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [localReloadKey, setLocalReloadKey] = useState(0);
  const [newReservation, setNewReservation] = useState<any>(null);
  const [eventData, setEventData] = useState<EventData>({ evRes: null, resRes: null });
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedReservationId, setSelectedReservationId] = useState<string | null>(null);
  const toast = useToast();
  const [slotMaxTimeDynamic, setSlotMaxTimeDynamic] = useState<string>('26:00:00');

  useEffect(() => {
    async function loadTables() {
      try {
        const { data: tables, error } = await supabase
          .from('tables')
          .select('id, table_number');
        if (error) throw error;
        setResources(
          tables
            .sort((a, b) => Number(a.table_number) - Number(b.table_number))
            .map(t => ({
              id: t.id,
              title: `Table ${t.table_number}`,
            }))
        );
      } catch (err) {
        console.error('Error loading tables:', err);
        toast({
          title: 'Error loading tables',
          description: 'Failed to load table list.',
          status: 'error',
          duration: 5000,
        });
      }
    }
    loadTables();
  }, [reloadKey, toast]);

  useEffect(() => {
    const fetchReservations = async () => {
      try {
        const res = await fetch('/api/reservations');
        if (!res.ok) throw new Error('Failed to fetch reservations');
        const reservationsData = await res.json();
        setEventData({ evRes: null, resRes: reservationsData });
      } catch (error) {
        console.error('Error fetching reservations:', error);
        toast({
          title: 'Error loading data',
          description: 'Failed to load reservations. Please try refreshing the page.',
          status: 'error',
          duration: 5000,
        });
      }
    };

    fetchReservations();

    const subscription = supabase
      .channel('reservations')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'reservations'
      }, () => {
        fetchReservations();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [reloadKey, localReloadKey, toast]);


  useEffect(() => {
    if (!resources.length || !eventData.resRes) return;
    const rawReservations = Array.isArray(eventData.resRes)
      ? eventData.resRes
      : eventData.resRes.data || [];
    
    console.log('Raw reservations:', rawReservations);
    console.log('Resources:', resources);
    
    const mapped = rawReservations.map((r: Record<string, any>) => {
      const heart = r.membership_type === 'member' ? '🖤 ' : '';
      const emoji = r.event_type ? eventTypeEmojis[r.event_type.toLowerCase()] || '' : '';
      const tableResource = resources.find(res => res.id === String(r.table_id));
      const tableLabel = tableResource ? tableResource.title : '';
      return {
        id: String(r.id),
        title: `${heart}${r.first_name || ''} ${r.last_name || ''} | Party Size: ${r.party_size}${emoji ? ' ' + emoji : ''}`,
        extendedProps: {
          created_at: r.created_at ? formatDateTime(new Date(r.created_at), {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
          }) : null,
          ...r
        },
        start: r.start_time,
        end: r.end_time,
        resourceId: String(r.table_id),
        type: 'reservation',
      };
    });
    
    console.log('Mapped events:', mapped);
    setEvents(mapped);
    if (rawReservations.length) {
      const endDates = rawReservations.map((r: Record<string, any>) => toCST(new Date(r.end_time)));
      const maxDate = new Date(Math.max(...endDates.map((d: Date) => d.getTime())));
      let hr = maxDate.getHours();
      const min = maxDate.getMinutes();
      // Only extend beyond 25:00 if there are actual reservations that go later
      if (hr >= 24) {
        const pad = (n: number) => String(n).padStart(2, '0');
        setSlotMaxTimeDynamic(`${pad(hr)}:${pad(min)}:00`);
      } else {
        setSlotMaxTimeDynamic('26:00:00');
      }
    } else {
      // Default to 25:00 if no reservations
      setSlotMaxTimeDynamic('26:00:00');
    }
  }, [resources, eventData]);

  async function handleEventDrop(info: any) {
    try {
      console.log('[Drop Triggered] Raw info:', info);
  
      if (!info.event || !info.event.id || !info.oldEvent) {
        console.warn('Missing event, event.id, or oldEvent in drop info:', info);
        if (info.revert) info.revert();
        return;
      }
  
      const eventId = info.event.id;
      const newStart = info.event.start;
      const newEnd = info.event.end;
      
      const newResource = info.newResource;
      const oldResource = info.oldResource;
      const newTableId = newResource?.id;
  
      const hasTimeChanged = newStart.getTime() !== info.oldEvent.start.getTime() || newEnd.getTime() !== info.oldEvent.end.getTime();
      const hasTableChanged = newTableId !== oldResource?.id;
  
      if (!hasTimeChanged && !hasTableChanged) {
        console.log('No change detected. Skipping update.');
        // No need to revert, as the event is already in the correct visual spot
        return;
      }
  
      const body = {
        start_time: newStart.toISOString(),
        end_time: newEnd.toISOString(),
        table_id: newTableId,
      };
  
      console.log('[Sending PATCH]', eventId, body);
  
      const response = await fetch(`/api/reservations/${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
  
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`API Error: ${response.status} - ${text}`);
      }
  
      toast({
        title: 'Reservation updated',
        description: `Saved new table and time`,
        status: 'success',
        duration: 3000,
      });
  
      setLocalReloadKey(k => k + 1);
  
    } catch (error) {
      console.error('[Drop Handler Error]', error);
  
      toast({
        title: 'Error',
        description: 'Reservation update failed. Please try again.',
        status: 'error',
        duration: 6000,
      });
  
      if (info.revert && typeof info.revert === 'function') {
        info.revert();
      }
    }
  }

  async function handleEventResize(info: any) {
    if (viewOnly) return;
    const { event } = info;

    try {
      const response = await fetch(`/api/reservations/${event.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start_time: event.start.toISOString(),
          end_time: event.end.toISOString(),
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error Response:', errorText);
        throw new Error(`Failed to update reservation. Status: ${response.status}`);
      }

      const result = await response.json();
      console.log('Resize successful:', result);

      toast({
        title: 'Success',
        description: 'Reservation duration updated successfully.',
        status: 'success',
        duration: 3000,
      });
      setLocalReloadKey(prev => prev + 1);

    } catch (error) {
      console.error('Caught an error in handleEventResize:', error);
      toast({
        title: 'Error updating reservation',
        description: (error as Error).message,
        status: 'error',
        duration: 9000,
        isClosable: true,
      });
      info.revert();
    }
  }

  function handleEventClick(info: any) {
    setSelectedReservationId(info.event.id);
    setIsDrawerOpen(true);
  }

  function handleCloseDrawer() {
    setIsDrawerOpen(false);
    setSelectedReservationId(null);
  }

  function handleReservationUpdated() {
    setLocalReloadKey(k => k + 1);
  }

  const handlePrevDay = () => {
    calendarRef.current?.getApi().prev();
  };

  const handleNextDay = () => {
    calendarRef.current?.getApi().next();
  };

  return (
    <Box
      position="relative"
      sx={{
        '.fc-resource-area': {
          backgroundColor: '#ecede8',
          color: 'white',
          verticalAlign: 'middle',
          justifyContent: 'center',
          fontFamily: 'Montserrat, sans-serif',
          minWidth: '90px',
          width: '10%',
        },
        '.fc-resource-area .fc-resource-title': {
          color: 'white',
          verticalAlign: 'middle',
          justifyContent: 'center',
          fontFamily: 'Montserrat, sans-serif',
        },
        '.fc-timeline .fc-timeline-body td': {
          backgroundColor: '#ecede8',
          verticalAlign: 'middle',
          justifyContent: 'center',
          paddingtop: '10px',
        },
        '.fc-timeline': {
          maxWidth: 'fit-content',
        },
        '.fc-timeline-header': {
          maxWidth: 'fit-content',
        },
        '.fc-timeline-body': {
          maxWidth: 'fit-content',
        },
        '.fc-header-toolbar .fc-prev-button': {
          marginRight: '0.5rem',
        },
        'a.fc-event': {
          border: '0 !important',
          outline: '0 !important',
          padding: '0px !important',
          borderRadius: '5px !important',
          boxShadow: '5px 5px 15px .5px !important',
          backgroundColor: 'transparent !important',
          marginTop: '10px',
        },
      }}
    >
      <FullCalendar
        plugins={[resourceTimelinePlugin, interactionPlugin]}
        initialView="resourceTimelineDay"
        initialDate={new Date()}
        timeZone="America/Chicago"
        schedulerLicenseKey="CC-Attribution-NonCommercial-NoDerivatives"
        resources={resources}
        events={events}
        editable={true}
        droppable={true}
        selectable={!viewOnly}
        eventDrop={handleEventDrop}
        eventResize={handleEventResize}
        eventClick={handleEventClick}
        height="auto"
        slotMinTime="18:00:00"
        slotMaxTime={slotMaxTimeDynamic}
        slotDuration="00:30:00"
        slotLabelInterval="00:30:00"
        slotLabelFormat={[{ hour: 'numeric', minute: '2-digit', hour12: true }]}
        nowIndicator
        resourceAreaWidth={'6%'}
        resourceAreaHeaderContent={''}
        eventContent={(arg) => (
          <div
            style={{
              fontFamily: 'Montserrat, sans-serif',
              whiteSpace: 'normal',
              margin: '0px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '24px',
              fontSize: '14px',
              background: '#a59480',
              color: 'white',
              borderRadius: '4px',
              padding: '0 2px',
              border: '1px solid #353535',
            }}
          >
            {arg.event.title}
          </div>
        )}
      />
      
      <Box width="60%" ml={100} p={0} borderWidth="1px" borderRadius="lg">
        <Grid templateColumns="repeat(7, 1fr)" gap={0}>
          {Object.entries(eventTypeEmojis).map(([key, emoji]) => (
            <GridItem key={key}>
              <HStack>
                <Text fontSize="12px">{emoji}</Text>
                <Text fontSize="12px">{key.charAt(0).toUpperCase() + key.slice(1).replace('_', ' ')}</Text>
              </HStack>
            </GridItem>
          ))}
        </Grid>
      </Box>

      {!viewOnly && (
        <Elements stripe={stripePromise}>
          <ReservationForm
            bookingStartDate={bookingStartDate}
            bookingEndDate={bookingEndDate}
            baseDays={baseDays}
          />
        </Elements>
      )}

      <ReservationEditDrawer
        isOpen={isDrawerOpen}
        onClose={handleCloseDrawer}
        reservationId={selectedReservationId}
        onReservationUpdated={handleReservationUpdated}
      />
    </Box>
  );
};

export default FullCalendarTimeline; 