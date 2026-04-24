import React, { useState, useEffect, useRef, useCallback } from 'react';
import FullCalendar from '@fullcalendar/react';
import resourceTimelinePlugin from '@fullcalendar/resource-timeline';
import interactionPlugin from '@fullcalendar/interaction';
import '@fullcalendar/common/main.css';
import { fromUTC, toUTC, formatDateTime, formatTime, isSameDay } from '../utils/dateUtils';
import { supabase } from '../lib/supabase';
import { useSettings } from '../context/SettingsContext';
import { DateTime } from 'luxon';
import { Box, useToast } from '@chakra-ui/react';
import styles from '../styles/ReservationsTimeline.module.css';

interface Resource {
  id: string;
  title: string;
}

interface ReservationsTimelineProps {
  reloadKey?: number;
  currentDate?: Date;
  onDateChange?: (date: Date) => void;
  onReservationClick?: (reservationId: string) => void;
  onSlotClick?: (slotInfo: { date: Date; resourceId: string }) => void;
  onMakeReservationClick?: () => void;
  onPrivateEventRSVPClick?: () => void;
  onPrivateEventsCheck?: (hasEvents: boolean) => void;
  locationSlug?: string;
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

// Touch detection utility
const isTouchDevice = () => {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
};

const ReservationsTimeline: React.FC<ReservationsTimelineProps> = ({
  reloadKey = 0,
  currentDate: propCurrentDate,
  onDateChange,
  onReservationClick,
  onSlotClick,
  onMakeReservationClick,
  onPrivateEventRSVPClick,
  onPrivateEventsCheck,
  locationSlug,
}) => {
  const calendarRef = useRef<FullCalendar | null>(null);
  const [resources, setResources] = useState<Resource[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [localReloadKey, setLocalReloadKey] = useState(0);
  const [tableIds, setTableIds] = useState<string[]>([]);
  const [currentCalendarDate, setCurrentCalendarDate] = useState(
    propCurrentDate || new Date()
  );
  const [slotMinTime, setSlotMinTime] = useState<string>('18:00:00');
  const [slotMaxTime, setSlotMaxTime] = useState<string>('26:00:00');
  const [scrollTime, setScrollTime] = useState<string>('18:00:00');
  const [privateEvents, setPrivateEvents] = useState<any[]>([]);
  const [exceptionalClosures, setExceptionalClosures] = useState<any[]>([]);
  const { settings } = useSettings();
  const toast = useToast();
  
  // Touch and mobile detection
  const [isMobile, setIsMobile] = useState(false);
  const [isTouchDeviceState, setIsTouchDeviceState] = useState(false);
  
  useEffect(() => {
    setIsTouchDeviceState(isTouchDevice());
    const checkMobile = () => {
      if (typeof window !== 'undefined') {
        setIsMobile(window.innerWidth < 768);
      }
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Load tables as resources
  useEffect(() => {
    async function loadTables() {
      try {
        let query = supabase
          .from('tables')
          .select('id, table_number, location_id, seats');

        // Filter by location if provided
        if (locationSlug) {
          const { data: locationData, error: locationError } = await supabase
            .from('locations')
            .select('id')
            .eq('slug', locationSlug)
            .single();

          if (locationError) {
            console.error('Error fetching location:', locationError);
            throw locationError;
          }

          query = query.eq('location_id', locationData.id);
        }

        const { data: tables, error } = await query;
        if (error) throw error;

        const tableResources = tables
          .sort((a, b) => Number(a.table_number) - Number(b.table_number))
          .map(t => ({
            id: t.id,
            title: `${t.table_number} (${t.seats})`,
          }));

        setResources(tableResources);
        setTableIds(tables.map(t => t.id));
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
  }, [reloadKey, locationSlug, toast]);

  // Debug: Log what date FullCalendar is actually showing
  useEffect(() => {
    if (calendarRef.current) {
      const calendarApi = calendarRef.current.getApi();
      const currentDate = calendarApi.getDate();
      console.log('=== CALENDAR CURRENT DATE ===');
      console.log('FullCalendar is showing:', currentDate);
      console.log('As ISO:', currentDate.toISOString());
      console.log('============================');
    }
  }, [events, resources]); // Run after events/resources load

  // Load private events (including Minaka events)
  useEffect(() => {
    const fetchPrivateEvents = async () => {
      try {
        const now = DateTime.now().setZone('America/Chicago');
        const startDate = now.toISO();
        const endDate = now.plus({ years: 1 }).toISO();

        const locationParam = locationSlug ? `&location=${locationSlug}` : '';

        // Fetch local private events
        const res = await fetch(`/api/private-events?startDate=${startDate}&endDate=${endDate}${locationParam}`);
        if (!res.ok) throw new Error('Failed to fetch private events');
        const privateEventsData = await res.json();
        const localPrivateEvents = privateEventsData.data || [];

        // Fetch Minaka events
        let minakaEvents: any[] = [];
        try {
          const minakaLocationParam = locationSlug ? `?location=${locationSlug}` : '';
          const minakaRes = await fetch(`/api/minaka-events${minakaLocationParam}`);
          if (minakaRes.ok) {
            const minakaData = await minakaRes.json();
            // Filter out the specific recurring "Noir Cocktail Lounge - Cocktail Lounge" event
            minakaEvents = (minakaData.data || []).filter((event: any) => {
              const title = event.title || '';
              // Exclude only the exact "Noir Cocktail Lounge - Cocktail Lounge" event
              return title !== 'Noir Cocktail Lounge - Cocktail Lounge';
            });
          }
        } catch (error) {
          console.error('Error fetching Minaka events:', error);
          // Don't fail the whole load if Minaka fetch fails
        }

        // Combine both sources
        const allEvents = [...localPrivateEvents, ...minakaEvents];
        setPrivateEvents(allEvents);
      } catch (error) {
        console.error('Error fetching private events:', error);
      }
    };

    fetchPrivateEvents();
  }, [reloadKey, localReloadKey, locationSlug]);

  // Check for private events on current date
  useEffect(() => {
    if (!onPrivateEventsCheck || !locationSlug) return;

    const checkPrivateEventsOnDate = () => {
      const startOfDay = DateTime.fromJSDate(currentCalendarDate)
        .setZone('America/Chicago')
        .startOf('day');
      const endOfDay = startOfDay.endOf('day');

      const eventsOnDate = privateEvents.filter((event: any) => {
        const eventStart = DateTime.fromISO(event.start_time, { zone: 'utc' }).setZone('America/Chicago');
        return eventStart >= startOfDay && eventStart <= endOfDay && event.rsvp_enabled;
      });

      onPrivateEventsCheck(eventsOnDate.length > 0);
    };

    checkPrivateEventsOnDate();
  }, [privateEvents, currentCalendarDate, locationSlug, onPrivateEventsCheck]);

  // Load exceptional closures (custom closed days)
  useEffect(() => {
    const fetchExceptionalClosures = async () => {
      try {
        if (!locationSlug) {
          setExceptionalClosures([]);
          return;
        }

        // Get location ID first
        const { data: locationData, error: locationError } = await supabase
          .from('locations')
          .select('id')
          .eq('slug', locationSlug)
          .single();

        if (locationError) {
          console.error('Error fetching location:', locationError);
          setExceptionalClosures([]);
          return;
        }

        const { data, error } = await supabase
          .from('venue_hours')
          .select('*')
          .eq('type', 'exceptional_closure')
          .eq('location_id', locationData.id);

        if (error) throw error;
        setExceptionalClosures(data || []);
      } catch (error) {
        console.error('Error fetching exceptional closures:', error);
      }
    };

    fetchExceptionalClosures();
  }, [reloadKey, localReloadKey, locationSlug]);

  // Track if we're updating from props to prevent infinite loop
  const isUpdatingFromProps = useRef(false);
  const lastPropDateRef = useRef<Date | null>(null);

  // Update calendar date when prop changes - only if different to prevent infinite loops
  useEffect(() => {
    if (propCurrentDate) {
      const propTime = propCurrentDate.getTime();
      const lastPropTime = lastPropDateRef.current?.getTime();
      
      // Only update if propCurrentDate actually changed
      if (!lastPropTime || Math.abs(propTime - lastPropTime) > 1000) {
        lastPropDateRef.current = propCurrentDate;
        isUpdatingFromProps.current = true;
        setCurrentCalendarDate(propCurrentDate);
        if (calendarRef.current) {
          const calendarApi = calendarRef.current.getApi();
          calendarApi.gotoDate(propCurrentDate);
          // Scroll to correct time based on day of week
          const isThursday = propCurrentDate.getDay() === 4;
          const scrollToTime = isThursday ? '16:00:00' : (isMobile ? '18:00:00' : '18:00:00');
          // Use scrollToTime method if available, otherwise set scrollTime via options
          try {
            const calendarApi = calendarRef.current?.getApi();
            if (calendarApi && typeof calendarApi.scrollToTime === 'function') {
              calendarApi.scrollToTime(scrollToTime);
            } else {
              setScrollTime(scrollToTime);
            }
          } catch (e) {
            // Fallback: update scrollTime state
            setScrollTime(scrollToTime);
          }
        }
        // Reset flag after a short delay
        setTimeout(() => {
          isUpdatingFromProps.current = false;
        }, 100);
      }
    }
  }, [propCurrentDate, isMobile]);

  // Fetch reservations and set up real-time subscription
  useEffect(() => {
    const fetchReservations = async () => {
      try {
        console.log('🔍 fetchReservations called with locationSlug:', locationSlug);
        if (!locationSlug) {
          setEventData({ resRes: { data: [] } });
          return;
        }

        // Get location ID
        const { data: locationData, error: locationError } = await supabase
          .from('locations')
          .select('id')
          .eq('slug', locationSlug)
          .single();

        console.log('🔍 Location lookup result:', { locationSlug, locationData, locationError });

        if (locationError) {
          console.error('Error fetching location:', locationError);
          throw locationError;
        }

        let allReservations: any[] = [];

        // Part 1: Regular reservations with table_id - query by location
        const { data: tableReservations, error: tableError } = await supabase
          .from('reservations')
          .select('*, tables!inner(location_id)')
          .not('table_id', 'is', null)
          .eq('tables.location_id', locationData.id);

        if (tableError) {
          console.error('Error fetching table reservations:', tableError);
        } else {
          allReservations = allReservations.concat(tableReservations || []);
        }

        // Part 2: Private event RSVPs (null table_id)
        const { data: privateEventReservations, error: privateError } = await supabase
          .from('reservations')
          .select('*, private_events!inner(location_id)')
          .is('table_id', null)
          .eq('private_events.location_id', locationData.id);

        if (privateError) {
          console.error('Error fetching private event reservations:', privateError);
        } else {
          allReservations = allReservations.concat(privateEventReservations || []);
        }

        console.log('Reservations API response:', {
          locationSlug,
          locationId: locationData.id,
          tableReservationsCount: allReservations.filter(r => r.table_id).length,
          privateEventReservationsCount: allReservations.filter(r => !r.table_id).length,
          totalCount: allReservations.length,
          timWirick: allReservations.find(r => r.first_name === 'Tim' && r.last_name === 'Wirick')
        });

        setEventData({ resRes: { data: allReservations } });
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

    // Real-time subscription
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
  }, [reloadKey, localReloadKey, locationSlug, toast]);

  const [eventData, setEventData] = useState<{ resRes: any }>({ resRes: null });

  // Map reservations to FullCalendar events
  useEffect(() => {
    if (!resources.length || !eventData.resRes) {
      console.log('Skipping event mapping:', {
        hasResources: !!resources.length,
        hasEventData: !!eventData.resRes,
        resourcesCount: resources.length
      });
      return;
    }
    
    const rawReservations = Array.isArray(eventData.resRes)
      ? eventData.resRes
      : eventData.resRes.data || [];
    
    console.log('Mapping reservations to events:', {
      rawReservationsCount: rawReservations.length,
      firstReservation: rawReservations[0]
    });
    
    // Fetch member data for reservations missing names and then map to events
    const fetchMemberNamesAndMap = async () => {
      const reservationsNeedingNames = rawReservations.filter((r: any) => 
        !r.first_name && r.phone
      );
      
      if (reservationsNeedingNames.length > 0) {
        const phoneNumbers = reservationsNeedingNames.map((r: any) => r.phone);
        const { data: members } = await supabase
          .from('members')
          .select('phone, first_name, last_name, email')
          .in('phone', phoneNumbers);
        
        // Create a map of phone -> member data
        const memberMap = new Map();
        members?.forEach((m: any) => {
          // Try multiple phone formats
          const phoneDigits = m.phone?.replace(/\D/g, '') || '';
          memberMap.set(m.phone, m);
          memberMap.set(phoneDigits, m);
          if (phoneDigits.length === 10) {
            memberMap.set('+1' + phoneDigits, m);
          }
          if (phoneDigits.length === 11 && phoneDigits.startsWith('1')) {
            memberMap.set('+' + phoneDigits, m);
          }
        });
        
        // Update reservations with member data
        rawReservations.forEach((r: any) => {
          if (!r.first_name && r.phone) {
            const member = memberMap.get(r.phone) || 
                          memberMap.get(r.phone.replace(/\D/g, '')) ||
                          memberMap.get('+1' + r.phone.replace(/\D/g, '').slice(-10));
            if (member) {
              r.first_name = member.first_name;
              r.last_name = member.last_name;
              if (!r.email && member.email) {
                r.email = member.email;
              }
            }
          }
        });
      }
      
      // Map reservations to events
      const mapped = rawReservations.map((r: Record<string, any>) => {
        const heart = r.membership_type === 'member' ? '🖤 ' : '';
        let emoji = r.event_type ? eventTypeEmojis[r.event_type.toLowerCase()] || '' : '';

        // Get display name
        const displayName = r.first_name
          ? `${r.first_name}${r.last_name ? ' ' + r.last_name : ''}`
          : (r.phone ? `Guest (${r.phone.slice(-4)})` : 'Guest');

        // Debug logging for Tim Wirick
        if (r.first_name === 'Tim' && r.last_name === 'Wirick') {
          console.log('🔍 Mapping Tim Wirick reservation:', {
            id: r.id,
            start_time_utc: r.start_time,
            end_time_utc: r.end_time,
            table_id: r.table_id
          });
        }
        
        // Handle private event reservations
        let resourceId, startTime, endTime;
        if (r.table_id === null && r.private_event_id) {
          resourceId = 'private-events';
          emoji = '🔒';
          const privateEvent = privateEvents.find((pe: any) => pe.id === r.private_event_id);
          if (privateEvent && !privateEvent.require_time_selection) {
            startTime = fromUTC(privateEvent.start_time, settings.timezone).toFormat("yyyy-MM-dd'T'HH:mm:ss");
            endTime = fromUTC(privateEvent.end_time, settings.timezone).toFormat("yyyy-MM-dd'T'HH:mm:ss");
          } else {
            startTime = fromUTC(r.start_time, settings.timezone).toFormat("yyyy-MM-dd'T'HH:mm:ss");
            endTime = fromUTC(r.end_time, settings.timezone).toFormat("yyyy-MM-dd'T'HH:mm:ss");
          }
        } else {
          // Handle reservations with or without table_id
          if (r.table_id) {
            const tableResource = resources.find(res => res.id === String(r.table_id));
            resourceId = String(r.table_id);
          } else {
            // If no table_id, assign to first available table or a default
            resourceId = resources.length > 0 ? resources[0].id : 'unassigned';
          }
          startTime = fromUTC(r.start_time, settings.timezone).toFormat("yyyy-MM-dd'T'HH:mm:ss");
          endTime = fromUTC(r.end_time, settings.timezone).toFormat("yyyy-MM-dd'T'HH:mm:ss");
        }
        
        const event = {
          id: String(r.id),
          title: `${heart}${displayName} | Party Size: ${r.party_size}${emoji ? ' ' + emoji : ''}`,
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

        // Debug logging for Tim Wirick
        if (r.first_name === 'Tim' && r.last_name === 'Wirick') {
          console.log('🔍 Mapped Tim Wirick event:', event);
        }

        return event;
      });
      
      // Add blocking events for private events
      const blockingEvents: any[] = [];
      const currentDayPrivateEvents = getCurrentDayPrivateEvents();

      currentDayPrivateEvents.forEach((privateEvent: any) => {
        resources.forEach((resource: Resource) => {
          const startTime = fromUTC(privateEvent.start_time, settings.timezone).toFormat("yyyy-MM-dd'T'HH:mm:ss");
          const endTime = fromUTC(privateEvent.end_time, settings.timezone).toFormat("yyyy-MM-dd'T'HH:mm:ss");

          const blockingEvent = {
            id: `blocking-${privateEvent.id}-${resource.id}`,
            title: `🔒 ${privateEvent.title}`,
            extendedProps: {
              private_event_id: privateEvent.id,
              is_blocking: true,
              event_type: 'private_event',
              ...privateEvent
            },
            start: startTime,
            end: endTime,
            resourceId: resource.id,
            type: 'blocking',
            backgroundColor: '#6b7280',
            borderColor: '#6b7280',
            textColor: '#ffffff',
            classNames: ['private-event-blocking']
          };

          blockingEvents.push(blockingEvent);
        });
      });

      // Add blocking events for exceptional closures (custom closed days)
      const currentDateStr = DateTime.fromJSDate(currentCalendarDate).setZone(settings.timezone).toFormat('yyyy-MM-dd');
      const currentDayClosures = exceptionalClosures.filter((closure: any) => closure.date === currentDateStr);

      currentDayClosures.forEach((closure: any) => {
        resources.forEach((resource: Resource) => {
          let startTime, endTime;

          if (closure.full_day) {
            // Full day closure - block entire day
            startTime = `${currentDateStr}T00:00:00`;
            endTime = `${currentDateStr}T23:59:59`;
          } else if (closure.time_ranges && closure.time_ranges.length > 0) {
            // Partial day closure - create blocking events for each time range
            closure.time_ranges.forEach((range: any, idx: number) => {
              const closureEvent = {
                id: `closure-${closure.id}-${resource.id}-${idx}`,
                title: `🔒 ${closure.reason || 'Closed'}`,
                extendedProps: {
                  closure_id: closure.id,
                  is_blocking: true,
                  event_type: 'exceptional_closure',
                  reason: closure.reason,
                  ...closure
                },
                start: `${currentDateStr}T${range.start}:00`,
                end: `${currentDateStr}T${range.end}:00`,
                resourceId: resource.id,
                type: 'blocking',
                backgroundColor: '#6b7280',
                borderColor: '#6b7280',
                textColor: '#ffffff',
                classNames: ['exceptional-closure-blocking']
              };
              blockingEvents.push(closureEvent);
            });
            return; // Skip the default blocking event creation below
          } else {
            return; // No time ranges and not full day, skip
          }

          // Full day blocking event
          const closureEvent = {
            id: `closure-${closure.id}-${resource.id}`,
            title: `🔒 ${closure.reason || 'Closed'}`,
            extendedProps: {
              closure_id: closure.id,
              is_blocking: true,
              event_type: 'exceptional_closure',
              reason: closure.reason,
              ...closure
            },
            start: startTime,
            end: endTime,
            resourceId: resource.id,
            type: 'blocking',
            backgroundColor: '#6b7280',
            borderColor: '#6b7280',
            textColor: '#ffffff',
            classNames: ['exceptional-closure-blocking']
          };

          blockingEvents.push(closureEvent);
        });
      });

      const allEvents = [...mapped, ...blockingEvents];
      setEvents(allEvents);
    };
    
    fetchMemberNamesAndMap();

    const isThursday = currentCalendarDate.getDay() === 4;
    setSlotMinTime(isThursday ? '16:00:00' : '18:00:00');
    setSlotMaxTime(isThursday ? '24:00:00' : '26:00:00');
    // Scroll to 4pm on Thursdays, otherwise use default scroll time
    const newScrollTime = isThursday ? '16:00:00' : (isMobile ? '18:00:00' : '18:00:00');
    setScrollTime(newScrollTime);
    
    // Programmatically scroll to the correct time when date changes
    if (calendarRef.current) {
      try {
        const calendarApi = calendarRef.current.getApi();
        calendarApi.scrollToTime(newScrollTime);
      } catch (e) {
        // scrollToTime might not be available, that's okay
        console.debug('scrollToTime not available:', e);
      }
    }
  }, [resources, eventData, currentCalendarDate, privateEvents, exceptionalClosures, settings.timezone, isMobile]);

  // Get private events for the current calendar date
  const getCurrentDayPrivateEvents = () => {
    return privateEvents.filter((pe: any) => {
      // Minaka events don't have a status field, so only check status for local events
      if (pe.status && pe.status !== 'active') return false;
      const eventDateLocal = fromUTC(pe.start_time, settings.timezone);
      const calendarDateUTC = currentCalendarDate.toISOString();
      const calendarDateLocal = fromUTC(calendarDateUTC, settings.timezone);
      return isSameDay(eventDateLocal, calendarDateLocal, settings.timezone);
    });
  };

  // Handle drag and drop
  async function handleEventDrop(info: any) {
    try {
      if (info.event.extendedProps.is_blocking) {
        if (info.revert) info.revert();
        return;
      }

      if (!info.event || !info.event.id || !info.oldEvent) {
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
        return;
      }

      let body: any = {
        table_id: newTableId,
      };

      if (hasTimeChanged) {
        // Use FullCalendar's string fields which are in the configured timezone
        // Parse them explicitly in the business timezone, then convert to UTC
        // NOTE: Do NOT use Date objects - they are timezone-naive and cause the
        // "reservation disappears after drag" bug. Use startStr/endStr instead.
        const newStartUTC = DateTime.fromISO(info.event.startStr, { zone: settings.timezone })
          .toUTC()
          .toISO({ suppressMilliseconds: true });
        const newEndUTC = DateTime.fromISO(info.event.endStr, { zone: settings.timezone })
          .toUTC()
          .toISO({ suppressMilliseconds: true });

        body.start_time = newStartUTC;
        body.end_time = newEndUTC;
      }

      const response = await fetch(`/api/reservations/${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error('Failed to update reservation');
      }

      toast({
        title: 'Reservation updated',
        description: 'Saved new table and time',
        status: 'success',
        duration: 3000,
      });

      setLocalReloadKey(k => k + 1);

    } catch (error) {
      console.error('Error updating reservation:', error);
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

  // Handle event resize
  async function handleEventResize(info: any) {
    if (info.event.extendedProps.is_blocking) {
      if (info.revert) info.revert();
      return;
    }

    try {
      // Use FullCalendar's string fields for proper timezone handling
      // NOTE: Do NOT use Date objects - they are timezone-naive and cause the
      // "reservation disappears after drag" bug. Use startStr/endStr instead.
      const newStartUTC = DateTime.fromISO(info.event.startStr, { zone: settings.timezone })
        .toUTC()
        .toISO({ suppressMilliseconds: true });
      const newEndUTC = DateTime.fromISO(info.event.endStr, { zone: settings.timezone })
        .toUTC()
        .toISO({ suppressMilliseconds: true });

      const response = await fetch(`/api/reservations/${info.event.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start_time: newStartUTC,
          end_time: newEndUTC,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update reservation');
      }

      toast({
        title: 'Success',
        description: 'Reservation duration updated successfully.',
        status: 'success',
        duration: 3000,
      });
      
      setLocalReloadKey(prev => prev + 1);

    } catch (error) {
      console.error('Error updating reservation:', error);
      toast({
        title: 'Error updating reservation',
        description: (error as Error).message,
        status: 'error',
        duration: 9000,
        isClosable: true,
      });
      if (info.revert) info.revert();
    }
  }

  // Handle event click
  function handleEventClick(info: any) {
    if (info.event.extendedProps.is_blocking) {
      return;
    }
    
    if (onReservationClick) {
      onReservationClick(info.event.id);
    }
  }

  // Handle slot click
  const handleSlotClick = (info: any) => {
    let clickedDate = info.date;
    const resourceId = info.resource?.id;
    
    if (!clickedDate) {
      clickedDate = info.start || info.startStr ? new Date(info.start || info.startStr) : null;
    }
    
    if (!clickedDate) {
      clickedDate = currentCalendarDate;
    }
    
    // Check if blocked by private event
    if (clickedDate && resourceId) {
      const currentDayPrivateEvents = getCurrentDayPrivateEvents();
      const isBlocked = currentDayPrivateEvents.some((privateEvent: any) => {
        const eventStart = fromUTC(privateEvent.start_time, settings.timezone);
        const eventEnd = fromUTC(privateEvent.end_time, settings.timezone);
        const clickedTime = DateTime.fromJSDate(clickedDate, { zone: settings.timezone });
        const clickedTimeOnly = clickedTime.set({ year: eventStart.year, month: eventStart.month, day: eventStart.day });
        return clickedTimeOnly >= eventStart && clickedTimeOnly < eventEnd;
      });
      
      if (isBlocked) {
        toast({
          title: 'Private Event',
          description: 'This time slot is blocked due to a private event.',
          status: 'warning',
          duration: 3000,
        });
        return;
      }
    }
    
    if (clickedDate && resourceId) {
      if (calendarRef.current) {
        const calendarApi = calendarRef.current.getApi();
        calendarApi.unselect();
      }
      
      if (onSlotClick) {
        onSlotClick({
          date: clickedDate,
          resourceId: resourceId
        });
      }
    }
  };

  // Handle date changes
  const handleDatesSet = (info: any) => {
    // Don't call onDateChange if we're updating from props
    if (isUpdatingFromProps.current) {
      return;
    }
    
    const newDate = new Date(info.startStr);
    setCurrentCalendarDate(newDate);
    
    // Scroll to correct time based on day of week
    const isThursday = newDate.getDay() === 4;
    const scrollToTime = isThursday ? '16:00:00' : (isMobile ? '18:00:00' : '18:00:00');
    setScrollTime(scrollToTime);
    
    // Programmatically scroll after a short delay to ensure calendar is rendered
    if (calendarRef.current) {
      setTimeout(() => {
        try {
          const calendarApi = calendarRef.current?.getApi();
          if (calendarApi && typeof calendarApi.scrollToTime === 'function') {
            calendarApi.scrollToTime(scrollToTime);
          }
          // If scrollToTime is not available, the scrollTime prop will handle it
        } catch (e) {
          console.debug('Error scrolling to time:', e);
        }
      }, 100);
    }
    
    if (onDateChange) {
      onDateChange(newDate);
    }
  };

  // Touch drag handlers
  const handleEventDragStart = (info: any) => {
    if (isTouchDeviceState) {
      const eventEl = info.el;
      if (eventEl) {
        eventEl.style.opacity = '0.8';
        eventEl.style.transform = 'scale(1.05)';
        eventEl.style.zIndex = '999';
      }
    }
  };

  const handleEventDragStop = (info: any) => {
    if (isTouchDeviceState) {
      const eventEl = info.el;
      if (eventEl) {
        eventEl.style.opacity = '';
        eventEl.style.transform = '';
        eventEl.style.zIndex = '';
      }
    }
  };

  // Mobile navigation handlers
  const handlePrevDay = () => {
    if (calendarRef.current) {
      const calendarApi = calendarRef.current.getApi();
      const currentDate = calendarApi.getDate();
      const prevDate = new Date(currentDate);
      prevDate.setDate(prevDate.getDate() - 1);
      calendarApi.gotoDate(prevDate);
      setCurrentCalendarDate(prevDate);
      if (onDateChange) {
        onDateChange(prevDate);
      }
    }
  };

  const handleNextDay = () => {
    if (calendarRef.current) {
      const calendarApi = calendarRef.current.getApi();
      const currentDate = calendarApi.getDate();
      const nextDate = new Date(currentDate);
      nextDate.setDate(nextDate.getDate() + 1);
      calendarApi.gotoDate(nextDate);
      setCurrentCalendarDate(nextDate);
      if (onDateChange) {
        onDateChange(nextDate);
      }
    }
  };

  const handleToday = () => {
    if (calendarRef.current) {
      const calendarApi = calendarRef.current.getApi();
      const chicagoNow = DateTime.now().setZone('America/Chicago');
      const todayString = chicagoNow.toFormat('yyyy-MM-dd');
      console.log('=== TODAY BUTTON CLICKED ===');
      console.log('Current time Chicago:', chicagoNow.toISO());
      console.log('Going to date:', todayString);
      console.log('========================');
      calendarApi.gotoDate(todayString);
      setCurrentCalendarDate(new Date());
      if (onDateChange) {
        onDateChange(new Date());
      }
    }
  };

  const handleNewReservation = () => {
    if (onSlotClick) {
      onSlotClick({ date: currentCalendarDate, resourceId: '' });
    }
  };

  // Format date for mobile header
  const formatMobileDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <Box className={styles.timelineWrapper}>
      {isMobile && (
        <div className={styles.mobileNavBar}>
          <button 
            className={styles.mobileNavButton}
            onClick={handlePrevDay}
            aria-label="Previous day"
          >
            ‹
          </button>
          <div className={styles.mobileNavTitle}>
            {formatMobileDate(currentCalendarDate)}
          </div>
          <button 
            className={styles.mobileNavButton}
            onClick={handleNextDay}
            aria-label="Next day"
          >
            ›
          </button>
          <button
            className={styles.mobileNavToday}
            onClick={handleToday}
            aria-label="Today"
          >
            Today
          </button>
          {onMakeReservationClick && (
            <button
              className={styles.mobileNavNewRez}
              onClick={onMakeReservationClick}
              aria-label="Make Reservation"
            >
              Make Rez
            </button>
          )}
        </div>
      )}
      <Box className={styles.calendarContainer}>
        <FullCalendar
          ref={calendarRef}
          plugins={[resourceTimelinePlugin, interactionPlugin]}
          initialView="resourceTimelineDay"
          initialDate={(() => {
            const chicagoNow = DateTime.now().setZone('America/Chicago');
            const dateString = chicagoNow.toFormat('yyyy-MM-dd');
            console.log('=== FULLCALENDAR INIT ===');
            console.log('Current time UTC:', DateTime.now().toISO());
            console.log('Current time Chicago:', chicagoNow.toISO());
            console.log('Passing initialDate to FC (plain date):', dateString);
            console.log('========================');
            return propCurrentDate || dateString;
          })()}
          timeZone={settings.timezone}
          schedulerLicenseKey="CC-Attribution-NonCommercial-NoDerivatives"
          
          customButtons={{
            makeReservation: {
              text: 'Make Reservation',
              click: () => {
                if (onMakeReservationClick) {
                  onMakeReservationClick();
                }
              },
            },
            privateEventRSVPs: {
              text: 'Private Event RSVPs',
              click: () => {
                if (onPrivateEventRSVPClick) {
                  onPrivateEventRSVPClick();
                }
              },
            },
          }}

          headerToolbar={isMobile ? false : {
            left: 'prev,next',
            center: 'title',
            right: onPrivateEventRSVPClick ? 'privateEventRSVPs,makeReservation,today' : 'makeReservation,today',
          }}
          titleFormat={{ weekday: 'long', month: 'long', day: 'numeric' }}
          resources={resources}
          events={events}
          editable={true}
          droppable={true}
          selectable={!isTouchDevice()}
          eventDrop={handleEventDrop}
          eventResize={handleEventResize}
          eventClick={handleEventClick}
          select={handleSlotClick}
          height={isMobile ? 'auto' : 'auto'}
          
          scrollTime={scrollTime}
          scrollTimeReset={false}
          handleWindowResize={true}
          
          longPressDelay={isTouchDeviceState ? 300 : 1000}
          eventLongPressDelay={isTouchDeviceState ? 300 : 1000}
          selectLongPressDelay={isTouchDeviceState ? 300 : 1000}
          
          eventDragMinDistance={isTouchDeviceState ? 5 : 3}
          eventDragStart={handleEventDragStart}
          eventDragStop={handleEventDragStop}
          
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
          
          eventContent={(arg) => {
            if (arg.event.extendedProps.is_blocking) {
              return (
                <div className={styles.blockingEvent}>
                  {arg.event.title}
                </div>
              );
            }
            
            const isCheckedIn = arg.event.extendedProps.checked_in;
            const backgroundColor = isCheckedIn ? '#a59480' : '#353535';
            const textColor = isCheckedIn ? '#353535' : '#ecede8';
            
            return (
              <div
                className={styles.reservationEvent}
                style={{
                  background: backgroundColor,
                  color: textColor,
                }}
              >
                {arg.event.title}
              </div>
            );
          }}
          datesSet={handleDatesSet}
        />
      </Box>
    </Box>
  );
};

export default ReservationsTimeline;
