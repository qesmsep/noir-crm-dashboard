import React, { useState, useEffect, useRef, useCallback } from 'react';
import FullCalendar from '@fullcalendar/react';
import resourceTimelinePlugin from '@fullcalendar/resource-timeline';
import interactionPlugin from '@fullcalendar/interaction';
import '@fullcalendar/common/main.css';
import { fromUTC, toUTC, formatDateTime, formatTime, getSundayOfWeek } from '../utils/dateUtils';
import { supabase } from '../lib/supabase';
import { useSettings } from '../context/SettingsContext';
import { useAsyncEffect } from '../hooks/useAsyncEffect';
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
  onAssignTableClick?: () => void;
  onPrivateEventsCheck?: (hasRsvpEvents: boolean, hasAnyPrivateEvent: boolean) => void;
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
  onAssignTableClick,
  onPrivateEventsCheck,
  locationSlug,
}) => {
  const calendarRef = useRef<FullCalendar | null>(null);
  const [tableResources, setTableResources] = useState<Resource[]>([]);
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
  const [blockedTimeRanges, setBlockedTimeRanges] = useState<{start: string, end: string}[]>([]);
  const [hasPrivateEventToday, setHasPrivateEventToday] = useState(false);
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
  useAsyncEffect(async (isActive) => {
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

        if (!isActive()) return;
        query = query.eq('location_id', locationData.id);
      }

      const { data: tables, error } = await query;
      if (error) throw error;

      if (!isActive()) return;

      const tableResourcesList = tables
        .sort((a, b) => Number(a.table_number) - Number(b.table_number))
        .map(t => ({
          id: t.id,
          title: `${t.table_number} (${t.seats})`,
        }));

      setTableResources(tableResourcesList);
      setTableIds(tables.map(t => t.id));
    } catch (err) {
      if (isActive()) {
        console.error('Error loading tables:', err);
        toast({
          title: 'Error loading tables',
          description: 'Failed to load table list.',
          status: 'error',
          duration: 5000,
        });
      }
    }
  }, [reloadKey, locationSlug, toast]);

  // Combine table resources with private event row when there's a private event
  useEffect(() => {
    if (hasPrivateEventToday && tableResources.length > 0) {
      // Add private event row at the beginning
      const privateEventResource = {
        id: '00-private-event',
        title: '\u00A0',  // Non-breaking space to render as blank
        orderIndex: -1  // Use negative order to ensure it appears first
      };
      // Add order to table resources as well
      const orderedTableResources = tableResources.map((resource, index) => ({
        ...resource,
        orderIndex: index  // Tables start from order 0
      }));
      setResources([privateEventResource, ...orderedTableResources]);
    } else {
      // Just use table resources without private event row. Set unconditionally
      // (even when empty) so switching to a location with no tables clears the
      // previous location's rows instead of leaving them stale.
      setResources(tableResources);
    }
  }, [hasPrivateEventToday, tableResources]);

  // Fetch and set operating hours based on weekly_hours + base_hours
  useAsyncEffect(async (isActive) => {
    try {
      if (!locationSlug) return;

      // Fetch location with weekly_hours and timezone
      const { data: locationData, error: locationError } = await supabase
        .from('locations')
        .select('id, weekly_hours, timezone')
        .eq('slug', locationSlug)
        .single();

      if (!isActive()) return;

      if (locationError) {
        if (isActive()) {
          console.error('Error fetching location:', locationError);
        }
        return;
      }

      const timezone = locationData.timezone || 'America/Chicago';
      const currentWeekSunday = getSundayOfWeek(currentCalendarDate, timezone);

      // Check if there are weekly hours for the current week
      const weeklyHoursForWeek = locationData.weekly_hours?.[currentWeekSunday] || null;

      // Get day of week for the current calendar date
      const dt = DateTime.fromJSDate(currentCalendarDate, { zone: timezone });
      const dayName = dt.toFormat('EEEE').toLowerCase(); // "saturday", "friday", etc.
      const dayOfWeek = dt.weekday % 7; // 0=Sunday, 6=Saturday

      let operatingHours: { start: string; end: string } | null = null;

      // Check weekly hours first
      if (weeklyHoursForWeek) {
        const dayData = weeklyHoursForWeek[dayName];
        if (dayData && dayData.open && dayData.close) {
          operatingHours = { start: dayData.open, end: dayData.close };
        }
        // If weekly hours exist for this week but this day is null, it means closed
        // Don't fall back to base hours
      } else {
        // Fall back to base hours (only when no weekly hours are set at all)
        const { data: baseHoursData } = await supabase
          .from('venue_hours')
          .select('*')
          .eq('type', 'base')
          .eq('location_id', locationData.id)
          .eq('day_of_week', dayOfWeek);

        if (!isActive()) return;

        if (baseHoursData && baseHoursData.length > 0 && baseHoursData[0].time_ranges) {
          const firstRange = baseHoursData[0].time_ranges[0];
          if (firstRange) {
            operatingHours = { start: firstRange.start, end: firstRange.end };
          }
        }
      }

      if (!isActive()) return;

      // Update calendar hours
      if (operatingHours) {
        // Convert time strings to calendar format (HH:MM:SS)
        const startTime = operatingHours.start + ':00';

        // Handle end times past midnight (e.g., 23:59 or 00:00)
        let endTime = operatingHours.end;
        if (endTime === '00:00' || endTime === '23:59') {
          // If close time is midnight, show until 2 AM next day
          endTime = '26:00:00';
        } else {
          endTime = endTime + ':00';
        }

        setSlotMinTime(startTime);
        setSlotMaxTime(endTime);
        setScrollTime(startTime);
      } else {
        // No hours found - venue closed or no data
        // Use default hours
        setSlotMinTime('18:00:00');
        setSlotMaxTime('26:00:00');
        setScrollTime('18:00:00');
      }
    } catch (err) {
      if (isActive()) {
        console.error('Error loading operating hours:', err);
        // Fall back to defaults
        setSlotMinTime('18:00:00');
        setSlotMaxTime('26:00:00');
        setScrollTime('18:00:00');
      }
    }
  }, [currentCalendarDate, locationSlug]);

  // Debug: Log what date FullCalendar is actually showing
  useEffect(() => {
    if (calendarRef.current) {
      const calendarApi = calendarRef.current.getApi();
      const currentDate = calendarApi.getDate();
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

  // Check for private events on current date and update blocked ranges
  useEffect(() => {
    // Build blocked time ranges for header styling
    const blockedRanges: {start: string, end: string}[] = [];
    const currentDateStr = DateTime.fromJSDate(currentCalendarDate).setZone(settings.timezone).toFormat('yyyy-MM-dd');

    // Get all private events for the current date (not just RSVP-enabled ones)
    const currentDayPrivateEvents = privateEvents.filter((pe: any) => {
      if (pe.status && pe.status !== 'active') return false;
      const eventStartTime = fromUTC(pe.start_time, settings.timezone);
      const eventEndTime = fromUTC(pe.end_time, settings.timezone);
      const calendarDateLocal = DateTime.fromJSDate(currentCalendarDate).setZone(settings.timezone);

      // Check if event overlaps with current calendar date at all
      const eventStartDate = eventStartTime.toFormat('yyyy-MM-dd');
      const eventEndDate = eventEndTime.toFormat('yyyy-MM-dd');
      const currentDate = calendarDateLocal.toFormat('yyyy-MM-dd');

      // Include event if it starts on current date, ends on current date, or spans across current date
      return eventStartDate === currentDate || eventEndDate === currentDate ||
             (eventStartDate < currentDate && eventEndDate > currentDate);
    });

    // Track if we have private events
    setHasPrivateEventToday(currentDayPrivateEvents.length > 0);

    // Add private event time ranges to blocked list
    const addedRanges = new Set<string>(); // Track unique ranges
    currentDayPrivateEvents.forEach((privateEvent: any) => {
      const startTime = fromUTC(privateEvent.start_time, settings.timezone);
      const endTime = fromUTC(privateEvent.end_time, settings.timezone);

      // Check if the event spans into the next day
      const eventStartDate = startTime.toFormat('yyyy-MM-dd');
      const eventEndDate = endTime.toFormat('yyyy-MM-dd');

      // Handle events that span to next day (e.g., 19:00 to 00:00 next day)
      let rangeToAdd: { start: string; end: string } | null = null;
      if (eventStartDate === currentDateStr) {
        // Event starts on current date
        if (eventEndDate > currentDateStr) {
          // Event spans to next day - handle the 26-hour time format
          const endHour = endTime.hour;
          const endMinute = endTime.minute;

          // If event ends at midnight or later on next day, convert to 26-hour format
          if (endHour === 0 && endMinute === 0) {
            rangeToAdd = {
              start: startTime.toFormat('HH:mm:ss'),
              end: '24:00:00' // Use 24:00 for midnight exactly
            };
          } else if (endHour === 0 || endHour < 3) {
            // For times like 1am, 2am on next day, use 25:00, 26:00 format
            const adjustedHour = 24 + endHour;
            rangeToAdd = {
              start: startTime.toFormat('HH:mm:ss'),
              end: `${adjustedHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}:00`
            };
          } else {
            // Normal case - event ends before 3am, just go to end of day
            rangeToAdd = {
              start: startTime.toFormat('HH:mm:ss'),
              end: '23:59:59'
            };
          }
        } else {
          // Event ends on same day
          rangeToAdd = {
            start: startTime.toFormat('HH:mm:ss'),
            end: endTime.toFormat('HH:mm:ss')
          };
        }
      } else if (eventEndDate === currentDateStr) {
        // Event ends on current date (started previous day)
        rangeToAdd = {
          start: '00:00:00',
          end: endTime.toFormat('HH:mm:ss')
        };
      } else if (eventStartDate < currentDateStr && eventEndDate > currentDateStr) {
        // Event spans entire day
        rangeToAdd = {
          start: '00:00:00',
          end: '23:59:59'
        };
      }

      // Only add unique ranges
      if (rangeToAdd) {
        const rangeKey = `${rangeToAdd.start}-${rangeToAdd.end}`;
        if (!addedRanges.has(rangeKey)) {
          addedRanges.add(rangeKey);
          blockedRanges.push(rangeToAdd);
        }
      }
    });

    // Add exceptional closure time ranges to blocked list
    const currentDayClosures = exceptionalClosures.filter((closure: any) => closure.date === currentDateStr);
    let hasFullDayClosure = false;
    currentDayClosures.forEach((closure: any) => {
      if (closure.full_day) {
        hasFullDayClosure = true;
        // For full day closures, block all 26 hours (to handle times past midnight)
        blockedRanges.push({
          start: '00:00:00',
          end: '26:00:00' // Use 26:00 to cover any past-midnight times
        });
      } else if (closure.time_ranges && closure.time_ranges.length > 0) {
        closure.time_ranges.forEach((range: any) => {
          blockedRanges.push({
            start: range.start + ':00',
            end: range.end + ':00'
          });
        });
      }
    });

    // Days with no operating hours are handled by the slotMinTime/slotMaxTime
    // logic, so nothing extra is needed here.

    setBlockedTimeRanges(blockedRanges);

    // Check for RSVP-enabled private events specifically for the button visibility
    if (onPrivateEventsCheck && locationSlug) {
      const startOfDay = DateTime.fromJSDate(currentCalendarDate)
        .setZone('America/Chicago')
        .startOf('day');
      const endOfDay = startOfDay.endOf('day');

      const rsvpEventsOnDate = privateEvents.filter((event: any) => {
        const eventStart = DateTime.fromISO(event.start_time, { zone: 'utc' }).setZone('America/Chicago');
        return eventStart >= startOfDay && eventStart <= endOfDay && event.rsvp_enabled;
      });

      // The RSVP button only applies to RSVP-enabled events, but the table
      // override (Assign Table) must be reachable for ANY active private event
      // that blocks the day - otherwise admins are stuck on non-RSVP buyouts.
      // Match the "occurs on this date" logic used for blocking (start on, end
      // on, or span across the date) so it also covers midnight-spanning events.
      // Reuses currentDateStr computed at the top of this effect.
      const hasAnyPrivateEvent = privateEvents.some((event: any) => {
        if (event.status && event.status !== 'active') return false;
        const eventStartDate = fromUTC(event.start_time, settings.timezone).toFormat('yyyy-MM-dd');
        const eventEndDate = fromUTC(event.end_time, settings.timezone).toFormat('yyyy-MM-dd');
        return eventStartDate === currentDateStr || eventEndDate === currentDateStr ||
               (eventStartDate < currentDateStr && eventEndDate > currentDateStr);
      });

      onPrivateEventsCheck(rsvpEventsOnDate.length > 0, hasAnyPrivateEvent);
    }
  }, [privateEvents, currentCalendarDate, locationSlug, onPrivateEventsCheck, exceptionalClosures, settings.timezone]);

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
          // Scroll to correct time based on day of week - but only on desktop
          const isThursday = propCurrentDate.getDay() === 4;
          const scrollToTime = isThursday ? '16:00:00' : '18:00:00';
          // Only auto-scroll on desktop, let mobile users control their scroll position
          if (!isMobile) {
            try {
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
      return;
    }

    // Prevent running if we're still loading other dependencies
    if (!privateEvents || exceptionalClosures == null) {
      return;
    }
    
    const rawReservations = Array.isArray(eventData.resRes)
      ? eventData.resRes
      : eventData.resRes.data || [];

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

      // Map reservations to events. Exclude untabled private-event RSVPs: they
      // are represented by the summary bar on the private-event row, and drawing
      // them as normal reservations would stack them onto whichever table sorts
      // first and mislead staff about what is actually booked there.
      const mapped = rawReservations
        .filter((r: Record<string, any>) => !(!r.table_id && r.private_event_id))
        .map((r: Record<string, any>) => {
        const heart = r.membership_type === 'member' ? '🖤 ' : '';
        let emoji = r.event_type ? eventTypeEmojis[r.event_type.toLowerCase()] || '' : '';

        // Get display name
        const displayName = r.first_name
          ? `${r.first_name}${r.last_name ? ' ' + r.last_name : ''}`
          : (r.phone ? `Guest (${r.phone.slice(-4)})` : 'Guest');

        // Handle table reservations
        let resourceId, startTime, endTime;
        // After filter, we only have regular reservations with table_id
        if (r.table_id) {
          const tableResource = resources.find(res => res.id === String(r.table_id));
          resourceId = String(r.table_id);
        } else {
          // If no table_id, find the first actual table resource (skip private event row)
          const firstTableResource = resources.find(res => res.id !== '00-private-event');
          resourceId = firstTableResource ? firstTableResource.id : 'unassigned';
        }
        startTime = fromUTC(r.start_time, settings.timezone).toFormat("yyyy-MM-dd'T'HH:mm:ss");
        endTime = fromUTC(r.end_time, settings.timezone).toFormat("yyyy-MM-dd'T'HH:mm:ss");
        
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

        return event;
      });
      
      // Add private event visualization to the private event row
      let privateEventBlocks: any[] = [];
      if (hasPrivateEventToday) {
        const currentDayPrivateEvents = getCurrentDayPrivateEvents();
        privateEventBlocks = currentDayPrivateEvents.map((pe: any) => {
          const startTime = fromUTC(pe.start_time, settings.timezone);
          const endTime = fromUTC(pe.end_time, settings.timezone);

          return {
            id: `private-event-${pe.id}`,
            title: pe.title || 'Private Event',
            start: startTime.toFormat("yyyy-MM-dd'T'HH:mm:ss"),
            end: endTime.toFormat("yyyy-MM-dd'T'HH:mm:ss"),
            resourceId: '00-private-event',
            backgroundColor: '#353535',
            borderColor: '#353535',
            textColor: '#ecede8',
            display: 'block',
            extendedProps: {
              is_private_event: true,
              type: 'private_event'
            }
          };
        });
      }

      // Combine regular events with private event blocks
      const allEvents = [...mapped, ...privateEventBlocks];
      setEvents(allEvents);
    };

    fetchMemberNamesAndMap();

    const isThursday = currentCalendarDate.getDay() === 4;
    setSlotMinTime(isThursday ? '16:00:00' : '18:00:00');
    setSlotMaxTime(isThursday ? '24:00:00' : '26:00:00');
    // Set scroll time but don't auto-scroll here - preserve user's scroll position
    // Auto-scroll only happens on date changes (in propCurrentDate effect and handleDatesSet)
    const newScrollTime = isThursday ? '16:00:00' : '18:00:00';
    setScrollTime(newScrollTime);
  }, [resources, eventData, currentCalendarDate, privateEvents, exceptionalClosures, settings.timezone, isMobile, hasPrivateEventToday]);

  // Get private events for the current calendar date
  const getCurrentDayPrivateEvents = () => {
    const calendarDateLocal = fromUTC(currentCalendarDate.toISOString(), settings.timezone);
    const currentDate = calendarDateLocal.toFormat('yyyy-MM-dd');
    return privateEvents.filter((pe: any) => {
      // Minaka events don't have a status field, so only check status for local events
      if (pe.status && pe.status !== 'active') return false;
      const eventStartDate = fromUTC(pe.start_time, settings.timezone).toFormat('yyyy-MM-dd');
      const eventEndDate = fromUTC(pe.end_time, settings.timezone).toFormat('yyyy-MM-dd');
      // Include events that start on, end on, or span across the current date so
      // that private events crossing midnight still render and block the next day.
      return eventStartDate === currentDate || eventEndDate === currentDate ||
             (eventStartDate < currentDate && eventEndDate > currentDate);
    });
  };

  // Shared helpers for slot background styling (used by slotLabelDidMount and
  // slotLaneDidMount) so the two callbacks stay consistent.
  const getSlotTimeStr = (slotTime: Date): string => {
    const tz = settings.timezone || 'America/Chicago';
    const slotDateTime = DateTime.fromJSDate(slotTime).setZone(tz);
    const slotHour = slotDateTime.hour;
    // Compare full dates (not just day-of-month) so month boundaries work.
    const currentDateStr = DateTime.fromJSDate(currentCalendarDate).setZone(tz).toFormat('yyyy-MM-dd');
    const slotDateStr = slotDateTime.toFormat('yyyy-MM-dd');
    if (slotHour < 3 && slotDateStr > currentDateStr) {
      // This is a time after midnight, use 24+ hour format
      const adjustedHour = 24 + slotHour;
      return `${adjustedHour.toString().padStart(2, '0')}:${slotDateTime.minute.toString().padStart(2, '0')}:${slotDateTime.second.toString().padStart(2, '0')}`;
    }
    return slotDateTime.toFormat('HH:mm:ss');
  };

  const isSlotBlocked = (slotTimeStr: string): boolean => {
    for (const range of blockedTimeRanges) {
      const rangeEndStr = range.end;
      // For ranges that end at or after midnight (24:00:00 or later)
      if (rangeEndStr >= '24:00:00') {
        if ((slotTimeStr >= range.start && slotTimeStr <= '23:59:59') ||
            (slotTimeStr >= '24:00:00' && slotTimeStr < rangeEndStr)) {
          return true;
        }
      } else {
        // Exclusive end so a slot on the boundary renders open (consistent
        // between the slot label and the slot lane).
        if (slotTimeStr >= range.start && slotTimeStr < range.end) {
          return true;
        }
      }
    }
    return false;
  };

  // Handle drag and drop
  async function handleEventDrop(info: any) {
    try {
      if (info.event.extendedProps.is_blocking || info.event.extendedProps.is_private_event) {
        if (info.revert) info.revert();
        return;
      }

      // Don't allow dropping onto the private event row
      if (info.newResource?.id === '00-private-event') {
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
    if (info.event.extendedProps.is_blocking || info.event.extendedProps.is_private_event) {
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
    // Don't handle clicks for blocking events or private events
    if (info.event.extendedProps.is_blocking || info.event.extendedProps.is_private_event) {
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

    // Don't allow creating reservations in the private event row
    if (resourceId === '00-private-event') {
      return;
    }

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
        // Compare the actual clicked instant against the event window. Re-dating
        // the click onto the event's start day would misjudge slots after
        // midnight (viewed on the following day) for events that span midnight.
        return clickedTime >= eventStart && clickedTime < eventEnd;
      });
      
      if (isBlocked) {
        toast({
          title: 'Private Event - Use Override Button',
          description: 'This time slot is blocked. To create a reservation anyway, use the "⚠️ Assign Table (Override)" button in the top toolbar.',
          status: 'warning',
          duration: 6000,
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

    // Only auto-scroll if the date actually changed (not just a re-render)
    // Compare date strings to avoid time-of-day differences
    const dateChanged = currentCalendarDate.toDateString() !== newDate.toDateString();

    if (dateChanged) {
      setCurrentCalendarDate(newDate);

      // Scroll to correct time based on day of week
      const isThursday = newDate.getDay() === 4;
      const scrollToTime = isThursday ? '16:00:00' : '18:00:00';
      setScrollTime(scrollToTime);

      // Only programmatically scroll on desktop when date changes
      if (calendarRef.current && !isMobile) {
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
          {onPrivateEventRSVPClick && (
            <button
              className={styles.mobileNavNewRez}
              onClick={onPrivateEventRSVPClick}
              aria-label="Event RSVPs"
            >
              Event RSVPs
            </button>
          )}
          {onAssignTableClick && (
            <button
              className={styles.mobileNavNewRez}
              onClick={onAssignTableClick}
              aria-label="Assign Table (Override Private Event)"
              style={{ backgroundColor: '#d97706', fontWeight: 'bold' }}
            >
              ⚠️ Override
            </button>
          )}
          {onMakeReservationClick && (
            <button
              className={styles.mobileNavNewRez}
              onClick={onMakeReservationClick}
              aria-label="+Reservation"
            >
              +Reservation
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
            return propCurrentDate || dateString;
          })()}
          timeZone={settings.timezone}
          schedulerLicenseKey="CC-Attribution-NonCommercial-NoDerivatives"
          
          customButtons={{
            makeReservation: {
              text: '+Reservation',
              click: () => {
                if (onMakeReservationClick) {
                  onMakeReservationClick();
                }
              },
            },
            privateEventRSVPs: {
              text: 'Event RSVPs',
              click: () => {
                if (onPrivateEventRSVPClick) {
                  onPrivateEventRSVPClick();
                }
              },
            },
            assignTable: {
              text: '⚠️ Assign Table (Override)',
              click: () => {
                if (onAssignTableClick) {
                  onAssignTableClick();
                }
              },
            },
          }}

          headerToolbar={isMobile ? false : {
            left: 'prev,next',
            center: 'title',
            right: (() => {
              let buttons: string[] = [];
              if (onPrivateEventRSVPClick) buttons.push('privateEventRSVPs');
              if (onAssignTableClick) buttons.push('assignTable');
              buttons.push('makeReservation', 'today');
              return buttons.join(',');
            })(),
          }}
          titleFormat={(date) => {
            // Use the current calendar date for the title, not the timeline start
            // The timeline starts in the evening of the previous day, but we want to show
            // the main date being viewed
            const chicagoDate = DateTime.fromJSDate(currentCalendarDate)
              .setZone(settings.timezone || 'America/Chicago');

            return chicagoDate.toFormat('EEEE, MMMM d');
          }}
          resources={resources}
          resourceOrder="orderIndex"  // Order resources by orderIndex property
          events={events}
          editable={true}
          droppable={true}
          selectable={!isTouchDevice()}
          eventDrop={handleEventDrop}
          eventResize={handleEventResize}
          eventClick={handleEventClick}
          select={handleSlotClick}
          height={isMobile ? "100%" : "auto"}

          scrollTime={scrollTime}
          scrollTimeReset={false}
          handleWindowResize={true}
          slotMinWidth={isMobile ? 50 : 60}
          
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
          aspectRatio={isMobile ? undefined : 1.5}
          
          slotLabelDidMount={(arg) => {
            // Check if this time slot falls within a blocked range
            const slotTime = arg.date;
            if (!slotTime) return;

            const slotTimeStr = getSlotTimeStr(slotTime);
            const isBlocked = isSlotBlocked(slotTimeStr);

            // Apply dark background to blocked time slots, light background to open times
            const applyStyle = () => {
              if (isBlocked) {
                arg.el.style.setProperty('background-color', '#353535', 'important');
                arg.el.style.setProperty('color', '#ecede8', 'important');
                arg.el.style.setProperty('font-weight', '500', 'important');
                // Also style parent element to ensure full coverage
                if (arg.el.parentElement) {
                  arg.el.parentElement.style.setProperty('background-color', '#353535', 'important');
                }
              } else {
                // Ensure open times have standard light background
                arg.el.style.setProperty('background-color', '#ecede8', 'important');
                arg.el.style.setProperty('color', '#353535', 'important');
              }
            };

            // Apply immediately and after a short delay to ensure it sticks
            applyStyle();
            setTimeout(applyStyle, 100);
          }}
          slotLaneDidMount={(arg) => {
            // Check if this time slot falls within a blocked range
            const slotTime = arg.date;
            if (!slotTime) return;

            const slotTimeStr = getSlotTimeStr(slotTime);
            const isBlocked = isSlotBlocked(slotTimeStr);

            // Apply subtle dark tint to blocked lanes, keep light for open lanes
            const applyLaneStyle = () => {
              if (isBlocked) {
                arg.el.style.setProperty('background-color', 'rgba(53, 53, 53, 0.08)', 'important');
              } else {
                // Keep standard light background for open lanes
                arg.el.style.setProperty('background-color', 'rgba(236, 237, 232, 0.3)', 'important');
              }
            };

            // Apply immediately and after a short delay to ensure it sticks
            applyLaneStyle();
            setTimeout(applyLaneStyle, 100);
          }}
          eventContent={(arg) => {
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
