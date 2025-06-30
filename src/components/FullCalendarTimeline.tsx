import React, { useEffect, useState, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import resourceTimelinePlugin from '@fullcalendar/resource-timeline';
import interactionPlugin from '@fullcalendar/interaction';
import '@fullcalendar/common/main.css';
import ReservationForm from './ReservationForm';
import DayReservationsDrawer from './DayReservationsDrawer';
import { toZone, toCSTISOString, formatDateTime } from '../utils/dateUtils';
import { supabase } from '../lib/supabase';
import { useSettings } from '../context/SettingsContext';
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
  Heading,
  List,
  ListItem,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Link,
} from '@chakra-ui/react';
import { ChevronLeftIcon, ChevronRightIcon, CalendarIcon, CheckCircleIcon, TimeIcon, ChevronDownIcon } from '@chakra-ui/icons';
import { ExternalLinkIcon } from '@chakra-ui/icons';
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
  onReservationClick?: (reservationId: string) => void;
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

// Helper to compare two dates by year, month, and day (local time)
function isSameDayLocal(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// Touch detection utility
const isTouchDevice = () => {
  if (typeof window === 'undefined') return false;
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
};

const FullCalendarTimeline: React.FC<FullCalendarTimelineProps> = ({ reloadKey, bookingStartDate, bookingEndDate, baseDays, viewOnly = false, onReservationClick }) => {
  // Private Event Table expand/collapse state
  const [expandedId, setExpandedId] = useState<string | null>(null);
  function toggleExpand(id: string) {
    setExpandedId(prev => (prev === id ? null : id));
  }
  const calendarRef = useRef<FullCalendar | null>(null);
  const [resources, setResources] = useState<Resource[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [localReloadKey, setLocalReloadKey] = useState(0);
  const [newReservation, setNewReservation] = useState<any>(null);
  const [eventData, setEventData] = useState<EventData>({ evRes: null, resRes: null });
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedReservationId, setSelectedReservationId] = useState<string | null>(null);
  const [isDayReservationsDrawerOpen, setIsDayReservationsDrawerOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [currentCalendarDate, setCurrentCalendarDate] = useState<Date>(new Date());
  const toast = useToast();
  const [slotMinTime, setSlotMinTime] = useState<string>('18:00:00');
  const [slotMaxTime, setSlotMaxTime] = useState<string>('26:00:00');
  const [privateEvents, setPrivateEvents] = useState<any[]>([]);
  const { settings } = useSettings();
  
  // Touch and mobile detection
  const [isMobile, setIsMobile] = useState(false);
  const [isTouchDeviceState, setIsTouchDeviceState] = useState(false);
  
  // Initialize touch detection and mobile detection
  useEffect(() => {
    setIsTouchDeviceState(isTouchDevice());
    
    // Mobile detection
    const checkMobile = () => {
      if (typeof window !== 'undefined') {
        setIsMobile(window.innerWidth < 768);
      }
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    async function loadTables() {
      try {
        const { data: tables, error } = await supabase
          .from('tables')
          .select('id, table_number');
        if (error) throw error;
        const tableResources = tables
          .sort((a, b) => Number(a.table_number) - Number(b.table_number))
          .map(t => ({
            id: t.id,
            title: `Table ${t.table_number}`,
          }));
        
        setResources(tableResources);
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
    const fetchPrivateEvents = async () => {
      try {
        const res = await fetch('/api/private-events');
        if (!res.ok) throw new Error('Failed to fetch private events');
        const privateEventsData = await res.json();
        setPrivateEvents(privateEventsData.data || []);
      } catch (error) {
        console.error('Error fetching private events:', error);
      }
    };

    fetchPrivateEvents();
  }, [reloadKey, localReloadKey]);

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
    
    console.log('Raw reservations data:', rawReservations);
    
    const mapped = rawReservations.map((r: Record<string, any>) => {
      console.log('Processing reservation:', r);
      console.log('Reservation ID:', r.id, 'Type:', typeof r.id);
      
      const heart = r.membership_type === 'member' ? '🖤 ' : '';
      let emoji = r.event_type ? eventTypeEmojis[r.event_type.toLowerCase()] || '' : '';
      
      // Handle private event reservations (table_id is null)
      let resourceId, tableLabel, startTime, endTime;
      if (r.table_id === null && r.private_event_id) {
        // For private events, assign to a special "Private Events" resource
        resourceId = 'private-events';
        tableLabel = 'Private Event';
        emoji = '🔒';
        
        // Find the corresponding private event
        const privateEvent = privateEvents.find((pe: any) => pe.id === r.private_event_id);
        
        if (privateEvent && !privateEvent.require_time_selection) {
          // For private events that don't require time selection, use the event start time
          startTime = new Date(privateEvent.start_time);
          endTime = new Date(privateEvent.end_time);
        } else {
          // For private events that do require time selection, use the reservation's own time
          startTime = new Date(r.start_time);
          endTime = new Date(r.end_time);
        }
      } else {
        const tableResource = resources.find(res => res.id === String(r.table_id));
        resourceId = String(r.table_id);
        tableLabel = tableResource ? tableResource.title : '';
        startTime = new Date(r.start_time);
        endTime = new Date(r.end_time);
      }
      
      const event = {
        id: String(r.id),
        title: `${heart}${r.first_name || ''} ${r.last_name || ''} | Party Size: ${r.party_size}${emoji ? ' ' + emoji : ''}`,
        extendedProps: {
          created_at: r.created_at ? formatDateTime(new Date(r.created_at), settings.timezone, {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
          }) : null,
          ...r
        },
        start: startTime,
        end: endTime,
        resourceId: resourceId,
        type: 'reservation',
      };
      
      console.log('Created event:', event);
      return event;
    });
    
    console.log('Final mapped events:', mapped);
    setEvents(mapped);
    setSlotMinTime('18:00:00');
    setSlotMaxTime('26:00:00');
  }, [resources, eventData, currentCalendarDate, privateEvents]);

  // Get private events for the current day
  const getCurrentDayPrivateEvents = () => {
    return privateEvents.filter((pe: any) => {
      // Convert both event start and calendar date to configured timezone
      const eventDateLocal = toZone(new Date(pe.start_time), settings.timezone);
      const calendarDateLocal = toZone(currentCalendarDate, settings.timezone);
      // Compare by year, month, and day
      return isSameDayLocal(eventDateLocal, calendarDateLocal);
    });
  };

  // Get reservations for a specific private event
  const getReservationsForPrivateEvent = (privateEventId: string) => {
    if (!eventData.resRes) {
      return [];
    }
    
    const rawReservations = Array.isArray(eventData.resRes)
      ? eventData.resRes
      : eventData.resRes.data || [];
    
    return rawReservations.filter((r: Record<string, any>) => 
      r.private_event_id === privateEventId
    );
  };

  async function handleEventDrop(info: any) {
    try {
      console.log('[Drop Triggered] Raw info:', info);
      console.log('[Touch Device]', isTouchDeviceState);
      console.log('[Mobile]', isMobile);
  
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
        description: isTouchDeviceState ? 'Touch drag successful!' : 'Saved new table and time',
        status: 'success',
        duration: 3000,
      });
  
      setLocalReloadKey(k => k + 1);
  
    } catch (error) {
      console.error('[Drop Handler Error]', error);
  
      toast({
        title: 'Error',
        description: isTouchDeviceState ? 'Touch drag failed. Please try again.' : 'Reservation update failed. Please try again.',
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
    console.log('Event clicked:', info);
    console.log('Event ID:', info.event.id);
    console.log('Event title:', info.event.title);
    console.log('Event extendedProps:', info.event.extendedProps);
    
    if (onReservationClick) {
      onReservationClick(info.event.id);
    } else {
      // Fallback to internal state management
      setSelectedReservationId(info.event.id);
    }
  }

  const handleDayClick = (info: any) => {
    setSelectedDate(info.date);
    setCurrentCalendarDate(info.date);
    setIsDayReservationsDrawerOpen(true);
  };

  const handleDayReservationsClose = () => {
    setIsDayReservationsDrawerOpen(false);
    setSelectedDate(null);
  };

  const handleReservationFromListClick = (reservationId: string) => {
    if (onReservationClick) {
      onReservationClick(reservationId);
    } else {
      // Fallback to internal state management
      setSelectedReservationId(reservationId);
    }
    setIsDayReservationsDrawerOpen(false);
  };

  const handlePrevDay = () => {
    calendarRef.current?.getApi().prev();
  };

  const handleNextDay = () => {
    calendarRef.current?.getApi().next();
  };

  // Handle calendar date changes
  const handleDatesSet = (info: any) => {
    console.log('=== DEBUG: handleDatesSet ===');
    console.log('FullCalendar info:', info);
    console.log('info.start:', info.start);
    console.log('info.startStr:', info.startStr);
    console.log('info.end:', info.end);
    console.log('info.endStr:', info.endStr);
    
    // Use startStr to get the correct date in the configured timezone
    const newDate = new Date(info.startStr);
    console.log('New date created from startStr:', newDate);
    console.log('New date in local timezone:', newDate.toLocaleDateString('en-US', { timeZone: settings.timezone }));
    
    setCurrentCalendarDate(newDate);
    
    // If the drawer is open, update the selected date to match the current calendar view
    if (isDayReservationsDrawerOpen) {
      setSelectedDate(newDate);
    }
  };

  // Touch drag event handlers
  const handleEventDragStart = (info: any) => {
    console.log('[Drag Start]', info);
    if (isTouchDeviceState) {
      // Add visual feedback for touch devices
      const eventEl = info.el;
      if (eventEl) {
        eventEl.style.opacity = '0.8';
        eventEl.style.transform = 'scale(1.05)';
        eventEl.style.zIndex = '1000';
      }
    }
  };

  const handleEventDragStop = (info: any) => {
    console.log('[Drag Stop]', info);
    if (isTouchDeviceState) {
      // Remove visual feedback for touch devices
      const eventEl = info.el;
      if (eventEl) {
        eventEl.style.opacity = '';
        eventEl.style.transform = '';
        eventEl.style.zIndex = '';
      }
    }
  };

  const currentDayPrivateEvents = getCurrentDayPrivateEvents();

  return (
    <Box
      style={{
        // Mobile-specific container styles
        touchAction: 'manipulation',
        WebkitOverflowScrolling: 'touch',
        overscrollBehavior: 'contain',
      }}
    >
      <Box mb={4} display="flex" justifyContent="flex-end">
        <Button
          onClick={() => {
            setSelectedDate(currentCalendarDate);
            setIsDayReservationsDrawerOpen(true);
          }}
          leftIcon={<CalendarIcon />}
          bg="#353535"
          color="#ecede8"
          _hover={{ bg: '#4f4f4f' }}
          fontFamily="Montserrat, sans-serif"
          fontWeight="semibold"
          size="md"
          borderRadius="md"
        >
          View {currentCalendarDate.toDateString() === new Date().toDateString() ? "Today's" : "Date's"} Reservations
        </Button>
      </Box>

      <Box
        style={{
          // FullCalendar container optimizations
          touchAction: 'manipulation',
          WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'contain',
          // Mobile-specific adjustments
          ...(isMobile && {
            fontSize: '14px',
            lineHeight: '1.4',
          }),
        }}
        sx={{
          // FullCalendar mobile optimizations
          '.fc': {
            touchAction: 'manipulation',
            WebkitOverflowScrolling: 'touch',
            overscrollBehavior: 'contain',
          },
          '.fc-resource-area': {
            backgroundColor: '#ecede8',
            color: 'white',
            verticalAlign: 'middle',
            justifyContent: 'center',
            fontFamily: 'Montserrat, sans-serif',
            minWidth: isMobile ? '120px' : '90px',
            width: isMobile ? '15%' : '10%',
          },
          '.fc-resource-area .fc-resource-title': {
            color: 'white',
            verticalAlign: 'middle',
            justifyContent: 'center',
            fontFamily: 'Montserrat, sans-serif',
            fontSize: isMobile ? '12px' : '14px',
          },
          '.fc-timeline .fc-timeline-body td': {
            backgroundColor: '#ecede8',
            verticalAlign: 'middle',
            justifyContent: 'center',
            paddingTop: '10px',
            borderBottom: '1px solid rgba(0, 0, 0, 0.05)',
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
            // Touch optimizations
            touchAction: 'manipulation',
            WebkitUserSelect: 'none',
            WebkitTouchCallout: 'none',
            WebkitTapHighlightColor: 'transparent',
            cursor: isTouchDeviceState ? 'grab' : 'pointer',
            userSelect: 'none',
            // Mobile-specific adjustments
            ...(isMobile && {
              minHeight: '28px',
              fontSize: '12px',
            }),
          },
          '.fc .fc-button-primary': {
            backgroundColor: '#353535',
            borderColor: '#353535',
            '&:hover': {
              backgroundColor: '#4f4f4f',
            },
            // Mobile button optimizations
            ...(isMobile && {
              padding: '8px 12px',
              fontSize: '14px',
            }),
          },
          // Touch-specific styles
          ...(isTouchDeviceState && {
            '.fc-event': {
              transition: 'all 0.2s ease',
              '&:active': {
                transform: 'scale(0.95)',
                opacity: 0.8,
              },
            },
            '.fc-event-main': {
              touchAction: 'manipulation',
            },
          }),
        }}
      >
        <FullCalendar
          ref={calendarRef}
          plugins={[resourceTimelinePlugin, interactionPlugin]}
          initialView="resourceTimelineDay"
          initialDate={new Date()}
          timeZone={settings.timezone}
          schedulerLicenseKey="CC-Attribution-NonCommercial-NoDerivatives"
          headerToolbar={{
            left: 'prev,next',
            center: 'title',
            right: 'today',
          }}
          titleFormat={{ weekday: 'long', month: 'long', day: 'numeric' }}
          resources={resources}
          events={events}
          editable={true}
          droppable={true}
          selectable={!viewOnly}
          eventDrop={handleEventDrop}
          eventResize={handleEventResize}
          eventClick={handleEventClick}
          dateClick={handleDayClick}
          height="auto"
          
          // Touch and mobile optimizations
          longPressDelay={isTouchDeviceState ? 300 : 1000}
          eventLongPressDelay={isTouchDeviceState ? 300 : 1000}
          selectLongPressDelay={isTouchDeviceState ? 300 : 1000}
          
          // Improved touch interaction settings
          eventDragMinDistance={isTouchDeviceState ? 5 : 3}
          eventDragStart={handleEventDragStart}
          eventDragStop={handleEventDragStop}
          
          // Mobile-specific configurations
          dayMaxEvents={isMobile ? 3 : false}
          moreLinkClick="popover"
          
          slotMinTime={slotMinTime}
          slotMaxTime={slotMaxTime}
          slotDuration="00:30:00"
          slotLabelInterval="00:30:00"
          slotLabelFormat={[{ hour: 'numeric', minute: '2-digit', hour12: true }]}
          nowIndicator
          resourceAreaWidth={isMobile ? '15%' : '6%'}
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
                height: isMobile ? '28px' : '24px',
                fontSize: isMobile ? '12px' : '14px',
                background: '#a59480',
                color: 'white',
                borderRadius: '4px',
                padding: isMobile ? '0 4px' : '0 2px',
                border: '1px solid #353535',
                cursor: isTouchDeviceState ? 'grab' : 'pointer',
                userSelect: 'none',
                touchAction: 'manipulation',
                // Additional touch optimizations
                WebkitUserSelect: 'none',
                WebkitTouchCallout: 'none',
                WebkitTapHighlightColor: 'transparent',
                // Hover effects for touch devices
                ...(isTouchDeviceState && {
                  transition: 'all 0.2s ease',
                  '&:active': {
                    transform: 'scale(0.95)',
                    opacity: 0.8,
                  },
                }),
              }}
            >
              {arg.event.title}
            </div>
          )}
          datesSet={handleDatesSet}
        />
      </Box>
      
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

      {/* Private Events Section */}
      {currentDayPrivateEvents.length > 0 && eventData.resRes && (
        <Box
          bg="white"
          p={6}
          borderRadius="2xl"
          boxShadow="0 2px 8px rgba(0,0,0,0.07)"
          border="1px solid"
          borderColor="gray.100"
          mx="auto"
          maxW="80%"
          mt={8}
        >
          <Heading size="md" mb={4} color="nightSky" fontWeight="600">
            🔒 Private Events for {currentCalendarDate.toLocaleDateString('en-US', { 
              weekday: 'long', 
              month: 'long', 
              day: 'numeric' 
            })}
          </Heading>
          <Table variant="simple" size="sm">
            <Thead>
              <Tr>
                <Th>Title</Th>
                <Th>Type</Th>
                <Th>Time</Th>
                <Th>Capacity</Th>
                <Th>RSVPs</Th>
                <Th>Link</Th>
                <Th></Th>
              </Tr>
            </Thead>
            <Tbody>
              {currentDayPrivateEvents.map(pe => {
                const reservations = getReservationsForPrivateEvent(pe.id);
                return (
                  <React.Fragment key={pe.id}>
                    <Tr>
                      <Td>{pe.title}</Td>
                      <Td>{pe.event_type}</Td>
                      <Td>
                        {new Date(pe.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })} - {new Date(pe.end_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                      </Td>
                      <Td>
                        {reservations.reduce((sum: number, r: any) => sum + (r.party_size || 0), 0)}/{pe.total_attendees_maximum}
                      </Td>
                      <Td>{reservations.length}</Td>
                      <Td>
                        {pe.rsvp_url ? (
                          <Link href={`/rsvp/${pe.rsvp_url}`} isExternal fontSize="sm" color="blue.500">
                            View
                          </Link>
                        ) : (
                          '-'
                        )}
                      </Td>
                      <Td>
                        <IconButton
                          size="xs"
                          variant="ghost"
                          aria-label="Expand RSVPs"
                          icon={<ChevronDownIcon />}
                          onClick={() => toggleExpand(pe.id)}
                        />
                      </Td>
                    </Tr>
                    {expandedId === pe.id && (
                      <Tr>
                        <Td colSpan={7}>
                          <Box p={2} bg="gray.50" borderRadius="md">
                            {pe.event_description && (
                              <Text fontSize="sm" mb={2}>{pe.event_description}</Text>
                            )}
                            <List spacing={2}>
                              {reservations.map((r: any) => (
                                <ListItem key={r.id}>
                                  <Text fontSize="sm">{r.first_name} {r.last_name} — {r.party_size} guests — {r.email}</Text>
                                </ListItem>
                              ))}
                            </List>
                          </Box>
                        </Td>
                      </Tr>
                    )}
                  </React.Fragment>
                );
              })}
            </Tbody>
          </Table>
        </Box>
      )}

      {!viewOnly && (
        <Elements stripe={stripePromise}>
          <ReservationForm
            bookingStartDate={bookingStartDate}
            bookingEndDate={bookingEndDate}
            baseDays={baseDays}
          />
        </Elements>
      )}

      <DayReservationsDrawer
        isOpen={isDayReservationsDrawerOpen}
        onClose={handleDayReservationsClose}
        selectedDate={selectedDate}
        onReservationClick={onReservationClick || handleReservationFromListClick}
      />
    </Box>
  );
};

export default FullCalendarTimeline; 