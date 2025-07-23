import React, { useEffect, useState, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import resourceTimelinePlugin from '@fullcalendar/resource-timeline';
import interactionPlugin from '@fullcalendar/interaction';
import '@fullcalendar/common/main.css';
import DayReservationsDrawer from './DayReservationsDrawer';
import NewReservationDrawer from './NewReservationDrawer';
import { fromUTC, toUTC, formatDateTime, formatTime, formatDate, isSameDay } from '../utils/dateUtils';
import { supabase } from '../lib/supabase';
import { useSettings } from '../context/SettingsContext';
import { DateTime } from 'luxon';
import styles from '../styles/MobileCalendar.module.css';
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
  currentDate?: Date;
  onDateChange?: (date: Date) => void;
}



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
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
};

// Detect if it's a phone (not iPad)
const isPhone = () => {
  const userAgent = navigator.userAgent;
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
  const isTablet = /iPad/i.test(userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  
  // Return true if it's mobile but not a tablet (iPad)
  return isMobile && !isTablet;
};

const FullCalendarTimeline: React.FC<FullCalendarTimelineProps> = ({ reloadKey, bookingStartDate, bookingEndDate, baseDays, viewOnly = false, onReservationClick, currentDate: propCurrentDate, onDateChange }) => {
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
  const [isNewReservationDrawerOpen, setIsNewReservationDrawerOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{date: Date, resourceId: string} | null>(null);
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

  // Scroll-sync: Make times header scroll with the grid
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const bodyEl = document.querySelector('.fc-timeline-body') as HTMLElement | null;
    const headerEl = document.querySelector('.fc-timeline-header') as HTMLElement | null;
    if (!bodyEl || !headerEl) return;
    const onScroll = () => { headerEl.scrollLeft = bodyEl.scrollLeft; };
    bodyEl.addEventListener('scroll', onScroll, { passive: true });
    return () => bodyEl.removeEventListener('scroll', onScroll);
  }, [reloadKey]);

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
            title: `${t.table_number}`,
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
        // Get date range for the next 6 months to ensure we have all relevant events
        const now = new Date();
        const startDate = now.toISOString();
        const endDate = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate()).toISOString();
        
        const res = await fetch(`/api/private-events?startDate=${startDate}&endDate=${endDate}`);
        if (!res.ok) throw new Error('Failed to fetch private events');
        const privateEventsData = await res.json();
        setPrivateEvents(privateEventsData.data || []);
      } catch (error) {
        console.error('Error fetching private events:', error);
      }
    };

    fetchPrivateEvents();
  }, [reloadKey, localReloadKey]);

  // Update calendar date when prop changes
  useEffect(() => {
    if (propCurrentDate) {
      setCurrentCalendarDate(propCurrentDate);
      if (calendarRef.current) {
        const calendarApi = calendarRef.current.getApi();
        calendarApi.gotoDate(propCurrentDate);
      }
    }
  }, [propCurrentDate]);

  useEffect(() => {
    console.log('FullCalendarTimeline: reloadKey changed to', reloadKey);
    const fetchReservations = async () => {
      try {
        console.log('Fetching reservations due to reloadKey change');
        const res = await fetch('/api/reservations');
        if (!res.ok) throw new Error('Failed to fetch reservations');
        const reservationsData = await res.json();
        console.log('Reservations fetched:', reservationsData);
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
          startTime = fromUTC(privateEvent.start_time, settings.timezone).toFormat("yyyy-MM-dd'T'HH:mm:ss");
          endTime = fromUTC(privateEvent.end_time, settings.timezone).toFormat("yyyy-MM-dd'T'HH:mm:ss");
        } else {
          // For private events that do require time selection, use the reservation's own time
          startTime = fromUTC(r.start_time, settings.timezone).toFormat("yyyy-MM-dd'T'HH:mm:ss");
          endTime = fromUTC(r.end_time, settings.timezone).toFormat("yyyy-MM-dd'T'HH:mm:ss");
        }
      } else {
        const tableResource = resources.find(res => res.id === String(r.table_id));
        resourceId = String(r.table_id);
        tableLabel = tableResource ? tableResource.title : '';
        startTime = fromUTC(r.start_time, settings.timezone).toFormat("yyyy-MM-dd'T'HH:mm:ss");
        endTime = fromUTC(r.end_time, settings.timezone).toFormat("yyyy-MM-dd'T'HH:mm:ss");
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

  // Get private events for the current calendar date
  const getCurrentDayPrivateEvents = () => {
    console.log('=== DEBUG: getCurrentDayPrivateEvents ===');
    console.log('Total private events:', privateEvents.length);
    console.log('Current calendar date:', currentCalendarDate);
    console.log('Settings timezone:', settings.timezone);
    
    const filtered = privateEvents.filter((pe: any) => {
      // Only show active events
      if (pe.status !== 'active') {
        console.log(`Skipping ${pe.title} - not active`);
        return false;
      }
      
      // Convert event start to configured timezone
      const eventDateLocal = fromUTC(pe.start_time, settings.timezone);
      
      // For calendar date, since it's already a Date object, we need to convert it properly
      // Create a date string in the format that fromUTC expects (YYYY-MM-DDTHH:mm:ss.sssZ)
      const calendarDateUTC = currentCalendarDate.toISOString();
      const calendarDateLocal = fromUTC(calendarDateUTC, settings.timezone);
      
      console.log(`Event: ${pe.title}`);
      console.log(`  Event start_time: ${pe.start_time}`);
      console.log(`  Event date local: ${eventDateLocal}`);
      console.log(`  Calendar date UTC: ${calendarDateUTC}`);
      console.log(`  Calendar date local: ${calendarDateLocal}`);
      
      // Compare by year, month, and day
      const isSame = isSameDay(eventDateLocal, calendarDateLocal, settings.timezone);
      console.log(`  Is same day: ${isSame}`);
      
      return isSame;
    });
    
    console.log('Filtered events:', filtered.length);
    return filtered;
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

      // Only convert times to UTC if the time actually changed
      let body: any = {
        table_id: newTableId,
      };

      if (hasTimeChanged) {
        // Use FullCalendar's string fields to ensure the intended local time is preserved before converting to UTC
        const startTimeUTC = DateTime.fromISO(info.event.startStr, { zone: settings.timezone })
          .toUTC()
          .toISO({ suppressMilliseconds: true });
        const endTimeUTC = DateTime.fromISO(info.event.endStr!, { zone: settings.timezone })
          .toUTC()
          .toISO({ suppressMilliseconds: true });

        console.log('[Drop] Converted to UTC:', {
          startTimeUTC,
          endTimeUTC
        });

        body.start_time = startTimeUTC;
        body.end_time = endTimeUTC;
      }
  
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
      // FullCalendar provides Date objects that are already in UTC but represent times in the business timezone
      // We need to convert them back to the business timezone first, then to UTC for database storage
      console.log('[Resize] Original times from FullCalendar:', {
        start: event.start.toISOString(),
        end: event.end.toISOString(),
        configuredTimezone: settings.timezone,
        localTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      });
      
      // Convert the Date objects using the business timezone, then to UTC
      const startTimeUTC = DateTime.fromJSDate(event.start, { zone: settings.timezone })
        .toUTC()
        .toISO({ suppressMilliseconds: true });
      const endTimeUTC = DateTime.fromJSDate(event.end, { zone: settings.timezone })
        .toUTC()
        .toISO({ suppressMilliseconds: true });
      
      console.log('[Resize] Converted to UTC:', {
        startTimeUTC,
        endTimeUTC
      });

      const response = await fetch(`/api/reservations/${event.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start_time: startTimeUTC,
          end_time: endTimeUTC,
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

  const handleSlotClick = (info: any) => {
    console.log('🎯 Slot clicked!', info);
    console.log('viewOnly:', viewOnly);
    
    if (viewOnly) {
      console.log('❌ Slot click blocked - viewOnly is true');
      return;
    }
    
    // Extract date and resource information
    // For resource timeline, the date might be in different properties
    let clickedDate = info.date;
    const resourceId = info.resource?.id;
    
    // If date is not directly available, try alternative properties
    if (!clickedDate) {
      clickedDate = info.start || info.startStr ? new Date(info.start || info.startStr) : null;
    }
    
    // If still no date, use the current calendar date
    if (!clickedDate) {
      clickedDate = currentCalendarDate;
    }
    
    console.log('📅 Clicked date:', clickedDate);
    console.log('🪑 Resource ID:', resourceId);
    console.log('📊 Full info object:', JSON.stringify(info, null, 2));
    
    if (clickedDate && resourceId) {
      console.log('✅ Opening new reservation drawer...');
      setSelectedSlot({
        date: clickedDate,
        resourceId: resourceId
      });
      setIsNewReservationDrawerOpen(true);
      
      // Clear the FullCalendar selection to remove the blue box
      if (calendarRef.current) {
        const calendarApi = calendarRef.current.getApi();
        calendarApi.unselect();
      }
    } else {
      console.log('❌ Missing date or resource ID');
    }
  };

  const handleNewReservationClose = () => {
    setIsNewReservationDrawerOpen(false);
    setSelectedSlot(null);
  };

  const handleNewReservationCreated = () => {
    setLocalReloadKey(prev => prev + 1);
    handleNewReservationClose();
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
  
  // Debug logging for date changes
  console.log('Current calendar date:', currentCalendarDate);
  console.log('Private events for this date:', currentDayPrivateEvents.length);
  if (currentDayPrivateEvents.length > 0) {
    console.log('Events found:', currentDayPrivateEvents.map(pe => pe.title));
  }
  
  // Manual test for July 12, 2025
  const testDate = new Date('2025-07-12T00:00:00.000Z');
  const testEvents = privateEvents.filter(pe => {
    if (pe.status !== 'active') return false;
    const eventDateLocal = fromUTC(pe.start_time, settings.timezone);
    const testDateLocal = fromUTC(testDate, settings.timezone);
    return isSameDay(eventDateLocal, testDateLocal, settings.timezone);
  });
  console.log('Manual test - Events for July 12, 2025:', testEvents.map(pe => pe.title));
  
  // Test all private events
  console.log('All private events:');
  privateEvents.forEach(pe => {
    console.log(`- ${pe.title}: ${pe.start_time} (status: ${pe.status})`);
  });

  return (
    <Box
      className={isMobile ? styles.mobileCalendarContainer : ''}
      style={{
        // Mobile-specific container styles with pinch zoom support
        touchAction: isMobile ? 'pan-x pan-y' : 'manipulation', // Allow scrolling on mobile
        WebkitOverflowScrolling: 'touch',
        overscrollBehavior: 'contain',
        // Enable pinch zoom
        ...(isMobile && {
          touchAction: 'pan-x pan-y', // Allow scrolling on mobile
          WebkitUserSelect: 'none',
          userSelect: 'none',
        }),
      }}
    >
      {/* Custom Header for Mobile */}
      {isMobile && (
        <Box 
          bg="#fff" 
          p={3} 
          borderBottom="0px solid #a59480"
          position="sticky"
          top="10px" // Adjusted top position to account for calendar page navigation header
          zIndex={5} // Decreased z-index to appear below navigation header
        >
          {/* Top Row: All Reservations Button, Nav Arrows, Today Button */}
          <HStack justify="space-between" align="center" mb={2}>
            {/* Left: All Reservations Button */}
            <Button
              onClick={() => {
                setSelectedDate(currentCalendarDate);
                setIsDayReservationsDrawerOpen(true);
              }}
              leftIcon={<CalendarIcon />}
              bg="#ecede8"
              color="#353535"
              marginLeft="10px"
              _hover={{ bg: '#4f4f4f' }}
              fontFamily="Montserrat, sans-serif"
              fontWeight="semibold"
              size="md"
              borderRadius="10px"
            >
              All Reservations
            </Button>

            {/* Center: Navigation Arrows */}
            <HStack spacing={10}>
              <IconButton
                aria-label="Previous day"
                icon={<ChevronLeftIcon />}
                fontSize="18px"
                variant="ghost"
                onClick={handlePrevDay}
                color="#353535"
                borderRadius="10px"
                paddingRight="10px"
                paddingLeft="10px"
                _hover={{ bg: '#a59480' }}
              />
              <IconButton
                aria-label="Next day"
                icon={<ChevronRightIcon />}
                fontSize="18px"
                variant="ghost"
                onClick={handleNextDay}
                color="#353535"
                borderRadius="10px"
                paddingRight="10px"
                paddingLeft="10px"
                _hover={{ bg: '#a59480' }}
              />
            </HStack>

            {/* Right: Today Button */}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                const today = new Date();
                setCurrentCalendarDate(today);
                if (onDateChange) onDateChange(today);
              }}
              color="#353535"
              _hover={{ bg: '#a59480' }}
              borderRadius="10px"
              marginRight="10px"
              fontFamily="Montserrat, sans-serif"
            >
              today
            </Button>
          </HStack>

          {/* Bottom Row: Centered Date */}
          <Box textAlign="center">
            <Text
              fontSize="lg"
              fontWeight="semibold"
              color="#353535"
              fontFamily="Montserrat, sans-serif"
            >
              {currentCalendarDate.toLocaleDateString('en-US', { 
                weekday: 'long', 
                month: 'long', 
                day: 'numeric' 
              })}
            </Text>
          </Box>
        </Box>
      )}

      {/* Desktop Button (unchanged) */}
      {!isMobile && (
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
            All Reservations
          </Button>
        </Box>
      )}

      <Box
        style={{
          // FullCalendar container optimizations with proper scrolling
          touchAction: isMobile ? 'pan-x pan-y' : 'manipulation',
          WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'auto',
          width: '100%',
          height: isMobile ? 'calc(100vh - 260px)' : 'auto',
          overflow: isMobile ? 'auto' : 'visible',
          // Mobile-specific adjustments
          ...(isMobile && {
            fontSize: '11px',
            lineHeight: '1',
            WebkitUserSelect: 'none',
            userSelect: 'none',
            paddingTop: '20px', // Add top padding for mobile header
          }),
        }}
        sx={{
          // FullCalendar mobile optimizations with proper scrolling
          '.fc': {
            touchAction: isMobile ? 'pan-x pan-y' : 'manipulation',
            WebkitOverflowScrolling: 'touch',
            overscrollBehavior: 'auto',
            ...(isMobile && {
              height: '100%',
              WebkitUserSelect: 'none',
              userSelect: 'none',
              overflow: 'auto',
            }),
          },
          '.fc-resource-area': {
            backgroundColor: '#ecede8',
            color: 'white',
            verticalAlign: 'middle',
            justifyContent: 'center',
            fontFamily: 'Montserrat, sans-serif',
            minWidth: isMobile ? '80px' : '100px',
            width: isMobile ? '80px' : '100px',
            flexShrink: 0,
          
            textAlign: 'center',
            
          },
          '.fc-resource-area .fc-resource-title': {
            color: 'white',
            verticalAlign: 'middle',
            justifyContent: 'center',
            fontFamily: 'Montserrat, sans-serif',
            fontSize: isMobile ? '12px' : '12px',
            padding: '8px 2px',
            textAlign: 'center',
          },
          // --- Unified grid lines ---
          '.fc-timeline, .fc-timeline-header, .fc-timeline-body': {
            width: '100%',
            tableLayout: 'fixed',
            // Add scrolling for timeline components
            ...(isMobile && {
              overflow: 'auto',
              WebkitOverflowScrolling: 'touch',
              touchAction: 'pan-x pan-y',
            }),
          },
          '.fc-timeline-header, .fc-timeline-body': {
            borderRight: '1px solid rgba(0,0,0,0.12)',
            borderBottom: '1px solid rgba(2, 1, 1, 0.08)',
            backgroundColor: '#ecede8',
            verticalAlign: 'middle',
            justifyContent: 'center',
            paddingTop: '0px',
            width: '100%',
            // Add scrolling for timeline areas
            ...(isMobile && {
              overflow: 'auto',
              WebkitOverflowScrolling: 'touch',
              touchAction: 'pan-x pan-y',
            }),
          },
          
          '.fc-timeline-body td': {
            borderBottom: '1px solid rgba(0,0,0,0.08)',
            // Add scrolling for timeline body cells
            ...(isMobile && {
              overflow: 'auto',
              WebkitOverflowScrolling: 'touch',
              touchAction: 'pan-x pan-y',
            }),
          },
          '.fc-timeline-body tr': {
            borderBottom: '1px solid rgba(0,0,0,0.08)',
            // Add scrolling for timeline body rows
            ...(isMobile && {
              overflow: 'auto',
              WebkitOverflowScrolling: 'touch',
              touchAction: 'pan-x pan-y',
            }),
          },
          '.fc-timeline-slot': {
            borderBottom: '1px solid rgba(0,0,0,0.08)',
            minwidth: '10px',
            // Add scrolling for timeline slots
            ...(isMobile && {
              overflow: 'auto',
              WebkitOverflowScrolling: 'touch',
              touchAction: 'pan-x pan-y',
            }),
          },
          '.fc-timeline-slot-lane': {
            margin: '0px',
            minwidth: '10px',
            // Add scrolling for timeline slot lanes
            ...(isMobile && {
              overflow: 'auto',
              WebkitOverflowScrolling: 'touch',
              touchAction: 'pan-x pan-y',
            }),
          },
          '.fc-resource-timeline-divider': {
            borderRight: '1px solidrgb(136, 136, 136)',
           
            
          },
          '.fc-resource-area, .fc-timeline-area': {
            verticalAlign: 'top',
            // Add scrolling for timeline area
            ...(isMobile && {
              overflow: 'auto',
              WebkitOverflowScrolling: 'touch',
              touchAction: 'pan-x pan-y',
            }),
          },
          '.fc-resource-area-header': {
            backgroundColor: '#ecede8',
            borderBottom: '1px solid rgba(0, 0, 0, 0.1)',
            textAlign: 'center',
            fontWeight: 'bold',
            color: '#353535'
          },
          '.fc-resource-area-header-cell': {
            textAlign: 'center',
            verticalAlign: 'middle'
          },
          '.fc-resource-area-header-content': {
            textAlign: 'center',
            fontWeight: 'bold'
          },
          '.fc-resource-area-header-title': {
            textAlign: 'center',
            fontWeight: 'bold'
          },
          '.fc-resource-area-header-cell-inner': {
            textAlign: 'center',
            fontWeight: 'bold'
            
          },
          '.fc-resource-area-header-cell-text': {
            textAlign: 'center',
            fontWeight: 'bold'
          },
          '.fc-header-toolbar .fc-prev-button': {
            marginRight: '0.5rem',
          },
          
          // Adjust the details of the reservations on the calendar
          'a.fc-event': {
            border: '0 !important',
            outline: '0 !important',
            padding: '0px !important',
            borderRadius: '5px !important',
            boxShadow: '5px 5px 15px .5px !important',
            backgroundColor: 'transparent !important',
            
            margin: '0px',
            // Touch optimizations
            touchAction: isMobile ? 'pan-x pan-y' : 'manipulation', // Allow scrolling on mobile
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
          '.fc-toolbar-chunk:last-child': {
            paddingRight: '10px',
          },
          '.fc-timeline-slot-label': {
            fontSize: '11px',
            fontWeight: 'bold',
          },
          '.fc-timeline-slot-label.fc-timeline-slot-label-major': {
            fontSize: '12px',
            fontWeight: 'bold',
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
              touchAction: isMobile ? 'pan-x pan-y' : 'manipulation', // Allow scrolling on mobile
            },
          }),
        }}
      >
        <FullCalendar
          ref={calendarRef}
          plugins={[resourceTimelinePlugin, interactionPlugin]}
          initialView="resourceTimelineDay"
          initialDate={propCurrentDate || new Date()}
          timeZone={settings.timezone}
          schedulerLicenseKey="CC-Attribution-NonCommercial-NoDerivatives"
          
          headerToolbar={isMobile ? false : {
            left: 'prev,next',
            center: 'title',
            right: 'today',
          }}
          titleFormat={{ weekday: 'long', month: 'long', day: 'numeric' }}
          resources={resources}
          events={events}
          editable={true}
          droppable={true}
          selectable={!viewOnly && !isPhone()}
          eventDrop={handleEventDrop}
          eventResize={handleEventResize}
          eventClick={handleEventClick}
          select={handleSlotClick}
          height={isMobile ? 'calc(100vh - 300px)' : 'auto'}
          
          // FullCalendar scrolling properties
          scrollTime={isMobile ? '01:00:00' : '08:00:00'}
          scrollTimeReset={false}
          handleWindowResize={true}
          
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
          slotDuration="00:15:00"
          slotLabelInterval="01:00:00"
          slotLabelFormat={[
            { hour: 'numeric', hour12: true },
          ]}
          nowIndicator
          resourceAreaWidth={isMobile ? "40px" : "80px"}
          
          resourceAreaHeaderContent=""
          
                   // Adjust the details of the reservations on the calendar
          eventContent={(arg) => {
            // Determine colors based on check-in status
            const isCheckedIn = arg.event.extendedProps.checked_in;
            const backgroundColor = isCheckedIn ? '#a59480' : '#353535';
            const textColor = isCheckedIn ? '#353535' : '#ecede8';
            
            return (
              <div
                style={{
                  fontFamily: 'Montserrat, sans-serif',
                  whiteSpace: 'normal',
                  margin: '0px',
                  display: 'center',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: isMobile ? '28px' : '24px',
                  fontSize: isMobile ? '12px' : '14px',
                  background: backgroundColor,
                  color: textColor,
                  borderRadius: '4px',
                  padding: isMobile ? '0 4px' : '0 2px',
                  border: '1px solid #353535',
                  cursor: isTouchDeviceState ? 'grab' : 'pointer',
                  userSelect: 'none',
                  touchAction: isMobile ? 'pan-x pan-y' : 'manipulation', // Allow scrolling on mobile
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
            );
          }}
          datesSet={handleDatesSet}
          eventDidMount={(info) => {
            console.log('Event mounted:', info.event.title);
          }}
        />
      </Box>
      
      {/* Event Type Legend */}
      <Box display={{ base: "none", sm: "block" }} width="50%" ml={10} p={0} borderWidth="1px" borderRadius="lg" padding="0px" >
        <Grid templateColumns="repeat(4, 1fr)" gap={0}>
          {Object.entries(eventTypeEmojis).map(([key, emoji]) => (
            <GridItem key={key}>
              <HStack width="25%">
                <Text fontSize="10px">{emoji}</Text>
                <Text fontSize="10px">{key.charAt(0).toUpperCase() + key.slice(1).replace('_', ' ')}</Text>
              </HStack>
            </GridItem>
          ))}
        </Grid>
      </Box>

      {/* Private Events Section - Hidden on mobile */}
      <Box
        display={{ base: "none", md: "block" }}
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
          🔒 Private Events for {formatDate(currentCalendarDate, settings.timezone, { 
            weekday: 'long', 
            month: 'long', 
            day: 'numeric' 
          })}
        </Heading>
        
        {currentDayPrivateEvents.length > 0 ? (
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
                        {formatTime(new Date(pe.start_time), settings.timezone)} - {formatTime(new Date(pe.end_time), settings.timezone)}
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
        ) : (
          <Text color="gray.500" textAlign="center" py={4}>
            No private events scheduled for this date.
          </Text>
        )}
      </Box>



      <DayReservationsDrawer
        isOpen={isDayReservationsDrawerOpen}
        onClose={handleDayReservationsClose}
        selectedDate={selectedDate}
        onReservationClick={onReservationClick || handleReservationFromListClick}
      />

      {/* New Reservation Drawer */}
      <NewReservationDrawer
        isOpen={isNewReservationDrawerOpen}
        onClose={handleNewReservationClose}
        initialDate={selectedSlot?.date}
        initialTableId={selectedSlot?.resourceId}
        onReservationCreated={handleNewReservationCreated}
      />
    </Box>
  );
};

export default FullCalendarTimeline; 