import React, { useState, useEffect } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { supabase } from '../lib/supabase';
import PrivateEventBooking from './PrivateEventBooking';
import { DateTime } from 'luxon';
import { formatTime, formatDate, fromUTC, getMondayOfWeek } from '../utils/dateUtils';
import {
  Box,
  Button,
  Checkbox,
  Flex,
  Heading,
  HStack,
  Input,
  Select,
  Stack,
  Text,
  VStack,
  useToast,
  Divider,
  FormControl,
  FormLabel,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  Spinner,
  Badge,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  IconButton,
} from '@chakra-ui/react';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

type TimeRange = { start: string; end: string };
type BaseHour = { enabled: boolean; timeRanges: TimeRange[] };
type ExceptionalOpen = { id: number; date: string; time_ranges: TimeRange[]; label?: string };
type ExceptionalClosure = { id: number; date: string; reason?: string; full_day?: boolean; time_ranges?: TimeRange[]; sms_notification?: string };

type CalendarAvailabilityControlProps = {
  section: 'booking_window' | 'base' | 'weekly' | 'custom_open' | 'custom_closed' | 'private_events';
  locationSlug?: string;
};

function formatTime12h(timeStr: string) {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':');
  const dt = DateTime.fromObject({ hour: Number(h), minute: Number(m) }, { zone: 'America/Chicago' });
  return dt.toLocaleString({ hour: 'numeric', minute: '2-digit' });
}

// Utility function to format date in local timezone to avoid UTC conversion issues
function formatDateToLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const CalendarAvailabilityControl: React.FC<CalendarAvailabilityControlProps> = ({ section, locationSlug }) => {
  const [locationId, setLocationId] = useState<string | null>(null);

  // Fetch location ID based on locationSlug
  useEffect(() => {
    if (!locationSlug) {
      setLocationId(null);
      return;
    }

    async function fetchLocationId() {
      console.log('🔍 [CalendarAvailabilityControl] Fetching location ID for slug:', locationSlug);
      const { data, error } = await supabase
        .from('locations')
        .select('id')
        .eq('slug', locationSlug)
        .single();

      if (!error && data) {
        console.log('🔍 [CalendarAvailabilityControl] Found location ID:', data.id, 'for slug:', locationSlug);
        setLocationId(data.id);
      } else {
        console.error('🔍 [CalendarAvailabilityControl] Error fetching location:', error);
      }
    }
    fetchLocationId();
  }, [locationSlug]);
  // Booking window state
  const [bookingStartDate, setBookingStartDate] = useState<Date>(() => {
    return DateTime.now().setZone('America/Chicago').toJSDate();
  });
  const [bookingEndDate, setBookingEndDate] = useState<Date>(() => {
    return DateTime.now().setZone('America/Chicago').plus({ days: 60 }).toJSDate();
  });
  const [bookingDatesLoading, setBookingDatesLoading] = useState<boolean>(true);
  const [bookingDatesSaving, setBookingDatesSaving] = useState<boolean>(false);

  useEffect(() => {
    async function fetchBookingDates() {
      setBookingDatesLoading(true);

      // If locationSlug provided, fetch location-specific booking window with global fallback
      if (locationSlug) {
        const { data: locationData } = await supabase
          .from('locations')
          .select('booking_start_date, booking_end_date')
          .eq('slug', locationSlug)
          .single();

        // Also fetch global settings for fallback
        const { data: settingsData } = await supabase
          .from('settings')
          .select('booking_start_date, booking_end_date')
          .single();

        // Use COALESCE logic: location-specific first, then global
        const effectiveStart = locationData?.booking_start_date || settingsData?.booking_start_date;
        const effectiveEnd = locationData?.booking_end_date || settingsData?.booking_end_date;

        if (effectiveStart) setBookingStartDate(DateTime.fromISO(effectiveStart, { zone: 'America/Chicago' }).toJSDate());
        if (effectiveEnd) setBookingEndDate(DateTime.fromISO(effectiveEnd, { zone: 'America/Chicago' }).toJSDate());
      } else {
        // No locationSlug: fetch global settings only
        const { data: settingsData } = await supabase
          .from('settings')
          .select('booking_start_date, booking_end_date')
          .single();
        if (settingsData) {
          if (settingsData.booking_start_date) setBookingStartDate(DateTime.fromISO(settingsData.booking_start_date, { zone: 'America/Chicago' }).toJSDate());
          if (settingsData.booking_end_date) setBookingEndDate(DateTime.fromISO(settingsData.booking_end_date, { zone: 'America/Chicago' }).toJSDate());
        }
      }
      setBookingDatesLoading(false);
    }
    fetchBookingDates();
  }, [locationSlug]);

  async function handleBookingDatesChange(start: Date, end: Date) {
    setBookingStartDate(start);
    setBookingEndDate(end);
    setBookingDatesSaving(true);
    try {
      console.log('🔍 [handleBookingDatesChange] locationSlug:', locationSlug, 'locationId (from state):', locationId);

      // Get the current locationId - if locationSlug provided, fetch it fresh to avoid race conditions
      let currentLocationId = locationId;
      if (locationSlug && !currentLocationId) {
        console.warn('⚠️ [handleBookingDatesChange] locationSlug provided but locationId not in state. Fetching now...');
        const { data, error } = await supabase
          .from('locations')
          .select('id')
          .eq('slug', locationSlug)
          .single();

        if (!error && data) {
          currentLocationId = data.id;
          console.log('🔍 [handleBookingDatesChange] Fetched locationId:', currentLocationId);
        } else {
          console.error('🔍 [handleBookingDatesChange] Error fetching location:', error);
        }
      }

      console.log('🔍 [handleBookingDatesChange] Using locationId:', currentLocationId);

      const response = await fetch('/api/booking-window', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start: formatDateToLocal(start),
          end: formatDateToLocal(end),
          locationId: currentLocationId || null
        })
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save booking window');
      }
      console.log(`Booking window saved successfully${currentLocationId ? ` for location ${locationSlug}` : ' (global)'}`);
    } catch (error) {
      console.error('Error saving booking window:', error);
    } finally {
      setBookingDatesSaving(false);
    }
  }

  // Base Hours State
  const [baseHours, setBaseHours] = useState<BaseHour[]>(Array(7).fill(null).map(() => ({ enabled: false, timeRanges: [{ start: '18:00', end: '23:00' }] })));

  // Weekly Hours State (for current week)
  const [weeklyHours, setWeeklyHours] = useState<BaseHour[]>(Array(7).fill(null).map(() => ({ enabled: false, timeRanges: [{ start: '18:00', end: '23:00' }] })));
  const currentWeekMonday = getMondayOfWeek(new Date(), 'America/Chicago');

  // Exceptional Opens State
  const [exceptionalOpens, setExceptionalOpens] = useState<ExceptionalOpen[]>([]);
  const [newOpenDate, setNewOpenDate] = useState<Date | null>(null);
  const [newOpenTimeRanges, setNewOpenTimeRanges] = useState<TimeRange[]>([{ start: '18:00', end: '23:00' }]);
  const [newOpenLabel, setNewOpenLabel] = useState<string>('');

  // Exceptional Closures State
  const [exceptionalClosures, setExceptionalClosures] = useState<ExceptionalClosure[]>([]);
  const [newClosureDate, setNewClosureDate] = useState<Date | null>(null);
  const [newClosureReason, setNewClosureReason] = useState<string>('');
  const [newClosureSmsNotification, setNewClosureSmsNotification] = useState<string>('');
  const [newClosureTimeRanges, setNewClosureTimeRanges] = useState<TimeRange[]>([{ start: '18:00', end: '23:00' }]);
  const [newClosureFullDay, setNewClosureFullDay] = useState<boolean>(true);

  // Error and Success State
  const [error, setError] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');

  // Editing State
  const [editingOpenId, setEditingOpenId] = useState<number | null>(null);
  const [editingOpen, setEditingOpen] = useState<any>(null);
  const [editingClosureId, setEditingClosureId] = useState<number | null>(null);
  const [editingClosure, setEditingClosure] = useState<any>(null);

  // Private Events State
  const [privateEvent, setPrivateEvent] = useState<any>({ name: '', event_type: '', date: null, start: '18:00', end: '20:00', full_day: true });
  const [privateEventStatus, setPrivateEventStatus] = useState<string>('');
  const [createdPrivateEvent, setCreatedPrivateEvent] = useState<any>(null);
  const [privateEvents, setPrivateEvents] = useState<any[]>([]);
  const [editingEvent, setEditingEvent] = useState<any>(null);
  const [editModalOpen, setEditModalOpen] = useState<boolean>(false);
  const [editEventForm, setEditEventForm] = useState<any>({ name: '', event_type: '', date: null, start: '', end: '', full_day: true });

  // Load base/exceptional hours from Supabase
  useEffect(() => {
    async function loadAvailabilityData() {
      try {
        setError('');

        console.log('🔍 [CalendarAvailabilityControl] Loading data with locationId:', locationId, 'locationSlug:', locationSlug, 'section:', section);

        // CRITICAL FIX: If locationSlug is provided but locationId hasn't been fetched yet, wait
        if (locationSlug && !locationId) {
          console.log('⏳ [CalendarAvailabilityControl] Waiting for locationId to be fetched...');
          return;
        }

        let baseQuery = supabase.from('venue_hours').select('*').eq('type', 'base');
        let opensQuery = supabase.from('venue_hours').select('*').eq('type', 'exceptional_open');
        let closuresQuery = supabase.from('venue_hours').select('*').eq('type', 'exceptional_closure');
        let eventsQuery = supabase.from('private_events').select('*');

        // Filter by location if locationId is available
        if (locationId) {
          console.log('🔍 [CalendarAvailabilityControl] Filtering queries by location_id:', locationId);
          baseQuery = baseQuery.eq('location_id', locationId);
          opensQuery = opensQuery.eq('location_id', locationId);
          closuresQuery = closuresQuery.eq('location_id', locationId);
          eventsQuery = eventsQuery.eq('location_id', locationId);
        } else {
          console.log('⚠️ [CalendarAvailabilityControl] No locationId set - loading global venue_hours');
          baseQuery = baseQuery.is('location_id', null);
          opensQuery = opensQuery.is('location_id', null);
          closuresQuery = closuresQuery.is('location_id', null);
          eventsQuery = eventsQuery.is('location_id', null);
        }

        const { data: baseHoursData } = await baseQuery;
        const { data: opensData } = await opensQuery;
        const { data: closuresData } = await closuresQuery;
        const { data: eventsData } = await eventsQuery;

        console.log('🔍 [CalendarAvailabilityControl] Loaded data:', {
          baseHours: baseHoursData?.length,
          opensData: opensData?.length,
          closuresData: closuresData?.length,
          closures: closuresData,
          privateEvents: eventsData?.length
        });
        if (baseHoursData && baseHoursData.length > 0) {
          const enabledDays = Array(7).fill(false);
          const timeRanges = Array(7).fill(null).map(() => [{ start: '18:00', end: '23:00' }]);
          baseHoursData.forEach((hour: any) => {
            enabledDays[hour.day_of_week] = true;
            timeRanges[hour.day_of_week] = hour.time_ranges;
          });
          setBaseHours(timeRanges.map((ranges, index) => ({ enabled: enabledDays[index], timeRanges: ranges })));
        } else {
          // Reset to default empty state if no base hours configured for this location
          setBaseHours(Array(7).fill(null).map(() => ({ enabled: false, timeRanges: [{ start: '18:00', end: '23:00' }] })));
        }

        // Load weekly hours from locations table if locationId is available
        if (locationId && section === 'weekly') {
          const { data: locationData } = await supabase
            .from('locations')
            .select('weekly_hours')
            .eq('id', locationId)
            .single();

          if (locationData?.weekly_hours) {
            const weeklyHoursData = locationData.weekly_hours as Record<string, any>;
            const currentWeekData = weeklyHoursData[currentWeekMonday];

            if (currentWeekData) {
              const enabledDays = Array(7).fill(false);
              const timeRanges = Array(7).fill(null).map(() => [{ start: '18:00', end: '23:00' }]);

              WEEKDAYS.forEach((day, index) => {
                const dayKey = day.toLowerCase() as 'sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday';
                const dayData = currentWeekData[dayKey];

                if (dayData && dayData.open && dayData.close) {
                  enabledDays[index] = true;
                  timeRanges[index] = [{ start: dayData.open, end: dayData.close }];
                }
              });

              setWeeklyHours(timeRanges.map((ranges, index) => ({ enabled: enabledDays[index], timeRanges: ranges })));
            } else {
              // Reset to default if no data for current week
              setWeeklyHours(Array(7).fill(null).map(() => ({ enabled: false, timeRanges: [{ start: '18:00', end: '23:00' }] })));
            }
          }
        }

        // Always set the data arrays, even if empty, to prevent stale data from previous location
        setExceptionalOpens(opensData || []);
        setExceptionalClosures(closuresData || []);
        setPrivateEvents(eventsData || []);
      } catch (error: any) {
        setError('Failed to load availability data. Please try again.');
      }
    }
    loadAvailabilityData();
  }, [locationId, section]);

  // Base Hours Handlers
  const toggleDay = (dayIndex: number) => {
    const newBaseHours = [...baseHours];
    newBaseHours[dayIndex].enabled = !newBaseHours[dayIndex].enabled;
    setBaseHours(newBaseHours);
  };
  const updateTimeRange = (dayIndex: number, rangeIndex: number, field: 'start' | 'end', value: string) => {
    const newTimeRanges = [...baseHours[dayIndex].timeRanges];
    newTimeRanges[rangeIndex][field] = value;
    const newBaseHours = [...baseHours];
    newBaseHours[dayIndex].timeRanges = newTimeRanges;
    setBaseHours(newBaseHours);
  };
  const addTimeRange = (dayIndex: number) => {
    const newTimeRanges = [...baseHours[dayIndex].timeRanges];
    newTimeRanges.push({ start: '18:00', end: '23:00' });
    const newBaseHours = [...baseHours];
    newBaseHours[dayIndex].timeRanges = newTimeRanges;
    setBaseHours(newBaseHours);
  };
  const removeTimeRange = (dayIndex: number, rangeIndex: number) => {
    const newTimeRanges = [...baseHours[dayIndex].timeRanges];
    newTimeRanges.splice(rangeIndex, 1);
    const newBaseHours = [...baseHours];
    newBaseHours[dayIndex].timeRanges = newTimeRanges;
    setBaseHours(newBaseHours);
  };
  const saveBaseHours = async () => {
    setError('');
    setSuccessMessage('');
    try {
      // Delete only base hours for this specific location
      let deleteQuery = supabase.from('venue_hours').delete().eq('type', 'base');
      if (locationId) {
        deleteQuery = deleteQuery.eq('location_id', locationId);
      } else {
        deleteQuery = deleteQuery.is('location_id', null);
      }
      await deleteQuery;

      const baseHoursToSave = baseHours.map((day, index) => ({
        type: 'base',
        day_of_week: index,
        time_ranges: day.enabled ? day.timeRanges : [],
        location_id: locationId // Include location_id in the saved records
      })).filter(day => day.time_ranges.length > 0);
      const { error: insertError } = await supabase.from('venue_hours').insert(baseHoursToSave);
      if (insertError) throw insertError;
      setSuccessMessage('Base hours updated successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err: any) {
      setError('Failed to save base hours: ' + err.message);
    }
  };

  // Weekly Hours Handlers
  const toggleWeeklyDay = (dayIndex: number) => {
    const newWeeklyHours = [...weeklyHours];
    newWeeklyHours[dayIndex].enabled = !newWeeklyHours[dayIndex].enabled;
    setWeeklyHours(newWeeklyHours);
  };
  const updateWeeklyTimeRange = (dayIndex: number, rangeIndex: number, field: 'start' | 'end', value: string) => {
    const newTimeRanges = [...weeklyHours[dayIndex].timeRanges];
    newTimeRanges[rangeIndex][field] = value;
    const newWeeklyHours = [...weeklyHours];
    newWeeklyHours[dayIndex].timeRanges = newTimeRanges;
    setWeeklyHours(newWeeklyHours);
  };
  const addWeeklyTimeRange = (dayIndex: number) => {
    const newTimeRanges = [...weeklyHours[dayIndex].timeRanges];
    newTimeRanges.push({ start: '18:00', end: '23:00' });
    const newWeeklyHours = [...weeklyHours];
    newWeeklyHours[dayIndex].timeRanges = newTimeRanges;
    setWeeklyHours(newWeeklyHours);
  };
  const removeWeeklyTimeRange = (dayIndex: number, rangeIndex: number) => {
    const newTimeRanges = [...weeklyHours[dayIndex].timeRanges];
    newTimeRanges.splice(rangeIndex, 1);
    const newWeeklyHours = [...weeklyHours];
    newWeeklyHours[dayIndex].timeRanges = newTimeRanges;
    setWeeklyHours(newWeeklyHours);
  };
  const saveWeeklyHours = async () => {
    setError('');
    setSuccessMessage('');
    try {
      if (!locationId) {
        setError('Location is required for weekly hours');
        return;
      }

      // Fetch current weekly_hours from the location
      const { data: locationData } = await supabase
        .from('locations')
        .select('weekly_hours')
        .eq('id', locationId)
        .single();

      const existingWeeklyHours = (locationData?.weekly_hours as Record<string, any>) || {};

      // Convert weekly hours to the format expected for storage
      const weekHoursData: Record<string, any> = {};
      WEEKDAYS.forEach((day, index) => {
        const dayKey = day.toLowerCase() as 'sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday';
        if (weeklyHours[index].enabled && weeklyHours[index].timeRanges.length > 0) {
          // For now, we only support one time range per day in the weekly_hours structure
          // If there are multiple, we'll use the first one
          weekHoursData[dayKey] = {
            open: weeklyHours[index].timeRanges[0].start,
            close: weeklyHours[index].timeRanges[0].end
          };
        } else {
          weekHoursData[dayKey] = null;
        }
      });

      // Update the current week's hours
      const updatedWeeklyHours = {
        ...existingWeeklyHours,
        [currentWeekMonday]: weekHoursData
      };

      const { error: updateError } = await supabase
        .from('locations')
        .update({ weekly_hours: updatedWeeklyHours })
        .eq('id', locationId);

      if (updateError) throw updateError;

      setSuccessMessage(`Weekly hours for week of ${currentWeekMonday} updated successfully!`);
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err: any) {
      setError('Failed to save weekly hours: ' + err.message);
    }
  };

  // Exceptional Opens Handlers
  const addExceptionalOpen = async () => {
    if (!newOpenDate) return;
    try {
      setError('');
      // Format the new open date as YYYY-MM-DD in local timezone to avoid UTC conversion issues
      const newOpenDateStr = formatDateToLocal(newOpenDate);
      
      const isOverlapping = exceptionalClosures.some(closure => closure.date === newOpenDateStr);
      if (isOverlapping) {
        setError('Cannot add exceptional open on a closure date.');
        return;
      }
      const newOpen: any = {
        date: newOpenDateStr,
        time_ranges: newOpenTimeRanges,
        label: newOpenLabel,
        type: 'exceptional_open'
      };

      // Add location_id if available
      if (locationId) {
        newOpen.location_id = locationId;
      }
      const { data, error } = await supabase.from('venue_hours').insert([newOpen]).select();
      if (error) throw error;
      if (data) {
        setExceptionalOpens([...exceptionalOpens, data[0]]);
        setNewOpenDate(null);
        setNewOpenTimeRanges([{ start: '18:00', end: '23:00' }]);
        setNewOpenLabel('');
      }
    } catch (error: any) {
      setError('Failed to add exceptional open. Please try again.');
    }
  };
  const deleteExceptionalOpen = async (id: number) => {
    try {
      setError('');
      let deleteQuery = supabase.from('venue_hours').delete().eq('id', id);

      // Only delete if it belongs to this location (if locationId is set)
      if (locationId) {
        deleteQuery = deleteQuery.eq('location_id', locationId);
      }

      const { error } = await deleteQuery;
      if (error) throw error;
      setExceptionalOpens(exceptionalOpens.filter(open => open.id !== id));
    } catch (error: any) {
      setError('Failed to delete exceptional open. Please try again.');
    }
  };

  // Exceptional Closures Handlers
  const addExceptionalClosure = async () => {
    if (!newClosureDate) return;
    try {
      setError('');
      // Format the new closure date as YYYY-MM-DD in local timezone to avoid UTC conversion issues
      const newClosureDateStr = formatDateToLocal(newClosureDate);
      
      const isOverlapping = exceptionalOpens.some(open => open.date === newClosureDateStr);
      if (isOverlapping) {
        setError('Cannot add closure on an exceptional open date.');
        return;
      }
      const newClosure: any = {
        date: newClosureDateStr,
        reason: newClosureReason,
        type: 'exceptional_closure',
        full_day: newClosureFullDay,
        time_ranges: newClosureFullDay ? null : newClosureTimeRanges,
        sms_notification: newClosureSmsNotification
      };

      // Add location_id if available
      if (locationId) {
        newClosure.location_id = locationId;
      }
      const { data, error } = await supabase.from('venue_hours').insert([newClosure]).select();
      if (error) throw error;
      if (data) {
        setExceptionalClosures([...exceptionalClosures, data[0]]);
        setNewClosureDate(null);
        setNewClosureReason('');
        setNewClosureTimeRanges([{ start: '18:00', end: '23:00' }]);
        setNewClosureFullDay(true);
        setNewClosureSmsNotification('');
      }
    } catch (error: any) {
      setError('Failed to add exceptional closure. Please try again.');
    }
  };
  const deleteExceptionalClosure = async (id: number) => {
    try {
      setError('');
      let deleteQuery = supabase.from('venue_hours').delete().eq('id', id);

      // Only delete if it belongs to this location (if locationId is set)
      if (locationId) {
        deleteQuery = deleteQuery.eq('location_id', locationId);
      }

      const { error } = await deleteQuery;
      if (error) throw error;
      setExceptionalClosures(exceptionalClosures.filter(closure => closure.id !== id));
    } catch (error: any) {
      setError('Failed to delete exceptional closure. Please try again.');
    }
  };

  // Edit Custom Open Day Handlers
  const handleEditOpen = (open: any) => {
    setEditingOpenId(open.id);
    setEditingOpen({ ...open });
  };
  const handleSaveEditOpen = async () => {
    if (!editingOpen) return;
    try {
      // Add location filter to prevent cross-location updates
      let updateQuery = supabase
        .from('venue_hours')
        .update({
          date: editingOpen.date,
          time_ranges: editingOpen.time_ranges,
          label: editingOpen.label,
        })
        .eq('id', editingOpen.id);

      if (locationId) {
        updateQuery = updateQuery.eq('location_id', locationId);
      } else {
        updateQuery = updateQuery.is('location_id', null);
      }

      const { data, error } = await updateQuery.select().single();
      if (error) throw error;
      setExceptionalOpens(exceptionalOpens.map(open => open.id === editingOpen.id ? data : open));
      setEditingOpenId(null);
      setEditingOpen(null);
    } catch (err: any) {
      setError(err.message || 'Failed to update custom open day.');
    }
  };
  const handleCancelEditOpen = () => {
    setEditingOpenId(null);
    setEditingOpen(null);
  };

  // Edit Custom Closed Day Handlers
  const handleEditClosure = (closure: any) => {
    setEditingClosureId(closure.id);
    setEditingClosure({ ...closure });
  };
  const handleSaveEditClosure = async () => {
    if (!editingClosure) return;
    try {
      // Add location filter to prevent cross-location updates
      let updateQuery = supabase
        .from('venue_hours')
        .update({
          date: editingClosure.date,
          reason: editingClosure.reason,
          full_day: editingClosure.full_day,
          time_ranges: editingClosure.full_day ? null : editingClosure.time_ranges,
          sms_notification: editingClosure.sms_notification
        })
        .eq('id', editingClosure.id);

      if (locationId) {
        updateQuery = updateQuery.eq('location_id', locationId);
      } else {
        updateQuery = updateQuery.is('location_id', null);
      }

      const { data, error } = await updateQuery.select().single();
      if (error) throw error;
      setExceptionalClosures(exceptionalClosures.map(cl => cl.id === editingClosure.id ? data : cl));
      setEditingClosureId(null);
      setEditingClosure(null);
    } catch (err: any) {
      setError(err.message || 'Failed to update custom closed day.');
    }
  };
  const handleCancelEditClosure = () => {
    setEditingClosureId(null);
    setEditingClosure(null);
  };

  // ... private event handlers ...

  const handleCreatePrivateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setPrivateEventStatus('');
    try {
      if (!privateEvent.name || !privateEvent.event_type || !privateEvent.date) {
        setPrivateEventStatus('Please fill all required fields.');
        return;
      }
      
      let start_time, end_time;
      
      if (privateEvent.full_day) {
        // For full day events, set start to 00:00 and end to 23:59
        const eventDate = DateTime.fromJSDate(privateEvent.date).setZone('America/Chicago');
        start_time = eventDate.startOf('day').toUTC().toISO({ suppressMilliseconds: true });
        end_time = eventDate.endOf('day').toUTC().toISO({ suppressMilliseconds: true });
      } else {
        // For time-specific events, validate time fields
        if (!privateEvent.start || !privateEvent.end) {
          setPrivateEventStatus('Please fill all fields.');
          return;
        }
        const eventDate = DateTime.fromJSDate(privateEvent.date).setZone('America/Chicago');
        const [startHour, startMinute] = privateEvent.start.split(':');
        start_time = eventDate.set({ hour: Number(startHour), minute: Number(startMinute) }).toUTC().toISO({ suppressMilliseconds: true });
        const [endHour, endMinute] = privateEvent.end.split(':');
        end_time = eventDate.set({ hour: Number(endHour), minute: Number(endMinute) }).toUTC().toISO({ suppressMilliseconds: true });
      }
      
      // Validate location_id is available
      if (!locationId) {
        setPrivateEventStatus('Location is required to create a private event.');
        return;
      }

      const { data, error } = await supabase.from('private_events').insert([
        {
          title: privateEvent.name,
          event_type: privateEvent.event_type,
          start_time: start_time.toISOString(),
          end_time: end_time.toISOString(),
          full_day: privateEvent.full_day,
          location_id: locationId,
        }
      ]).select().single();
      if (error) throw error;
      setPrivateEvents([...privateEvents, data]);
      setPrivateEvent({ name: '', event_type: '', date: null, start: '18:00', end: '20:00', full_day: true });
      setPrivateEventStatus('Private event created!');
    } catch (err: any) {
      setPrivateEventStatus(err.message || 'Failed to create private event.');
    }
  };

  const handleCloseEditModal = () => {
    setEditModalOpen(false);
  };

  // Handler to open the edit modal and set the event to edit
  const handleOpenEditModal = (event: any) => {
    const startTime = event.start_time ? fromUTC(event.start_time, 'America/Chicago') : null;
    const endTime = event.end_time ? fromUTC(event.end_time, 'America/Chicago') : null;
    
    setEditEventForm({
      name: event.title,
      event_type: event.event_type,
      date: startTime ? startTime.toJSDate() : null,
      start: startTime ? startTime.toFormat('HH:mm') : '18:00',
      end: endTime ? endTime.toFormat('HH:mm') : '20:00',
      full_day: event.full_day || false,
    });
    setEditingEvent(event);
    setEditModalOpen(true);
  };

  // Handler to save edits to a private event
  const handleSaveEditEvent = async () => {
    if (!editingEvent) return;
    try {
      let start_time, end_time;

      if (editEventForm.full_day) {
        // For full day events, set start to 00:00 and end to 23:59
        const eventDate = DateTime.fromJSDate(editEventForm.date).setZone('America/Chicago');
        start_time = eventDate.startOf('day').toUTC().toISO({ suppressMilliseconds: true });
        end_time = eventDate.endOf('day').toUTC().toISO({ suppressMilliseconds: true });
      } else {
        // For time-specific events, validate time fields
        if (!editEventForm.start || !editEventForm.end) {
          setPrivateEventStatus('Please fill all fields.');
          return;
        }
        const eventDate = DateTime.fromJSDate(editEventForm.date).setZone('America/Chicago');
        const [startHour, startMinute] = editEventForm.start.split(':');
        start_time = eventDate.set({ hour: Number(startHour), minute: Number(startMinute) }).toUTC().toISO({ suppressMilliseconds: true });
        const [endHour, endMinute] = editEventForm.end.split(':');
        end_time = eventDate.set({ hour: Number(endHour), minute: Number(endMinute) }).toUTC().toISO({ suppressMilliseconds: true });
      }

      // Add location filter to prevent cross-location updates
      let updateQuery = supabase
        .from('private_events')
        .update({
          title: editEventForm.name,
          event_type: editEventForm.event_type,
          start_time: start_time.toISOString(),
          end_time: end_time.toISOString(),
          full_day: editEventForm.full_day,
        })
        .eq('id', editingEvent.id);

      if (locationId) {
        updateQuery = updateQuery.eq('location_id', locationId);
      }

      const { data, error } = await updateQuery.select().single();
      if (error) throw error;
      setPrivateEvents(privateEvents.map(ev => ev.id === editingEvent.id ? data : ev));
      setEditModalOpen(false);
      setEditingEvent(null);
    } catch (err: any) {
      setPrivateEventStatus(err.message || 'Failed to update private event.');
    }
  };

  // Handler to delete a private event from the edit modal
  const handleDeleteEditEvent = async () => {
    if (!editingEvent) return;
    try {
      // Add location filter to prevent cross-location deletions
      let deleteQuery = supabase
        .from('private_events')
        .delete()
        .eq('id', editingEvent.id);

      if (locationId) {
        deleteQuery = deleteQuery.eq('location_id', locationId);
      } else {
        deleteQuery = deleteQuery.is('location_id', null);
      }

      const { error } = await deleteQuery;
      if (error) throw error;
      setPrivateEvents(privateEvents.filter(ev => ev.id !== editingEvent.id));
      setEditModalOpen(false);
      setEditingEvent(null);
    } catch (err: any) {
      setPrivateEventStatus(err.message || 'Failed to delete private event.');
    }
  };

  // Handler to delete a private event from the list
  const handleDeletePrivateEvent = async (id: number) => {
    try {
      // Add location filter to prevent cross-location deletions
      let deleteQuery = supabase
        .from('private_events')
        .delete()
        .eq('id', id);

      if (locationId) {
        deleteQuery = deleteQuery.eq('location_id', locationId);
      } else {
        deleteQuery = deleteQuery.is('location_id', null);
      }

      const { error } = await deleteQuery;
      if (error) throw error;
      setPrivateEvents(privateEvents.filter(ev => ev.id !== id));
    } catch (err: any) {
      setPrivateEventStatus(err.message || 'Failed to delete private event.');
    }
  };

  const renderContent = () => {
    switch (section) {
      case 'booking_window':
        return (
          <Box bg="#faf9f7" p={4} borderRadius="8px" border="1px solid #ececec" maxW={"420px"}>
            <Box borderBottom="2px solid #b7a78b" fontWeight={600} fontSize="1.5rem" mb={4} pb={1} color="#222">
              Booking Window
            </Box>
            <Flex align="center" gap={4}>
              <Box>
                <Text color="#555" fontSize="0.98em">Start Date:</Text>
                <DatePicker
                  selected={bookingStartDate}
                  onChange={date => { if (date) handleBookingDatesChange(date, bookingEndDate); }}
                  dateFormat="MMMM d, yyyy"
                  disabled={bookingDatesLoading || bookingDatesSaving}
                  className="chakra-input"
                />
              </Box>
              <Box>
                <Text color="#555" fontSize="0.98em">End Date:</Text>
                <DatePicker
                  selected={bookingEndDate}
                  onChange={date => { if (date) handleBookingDatesChange(bookingStartDate, date); }}
                  dateFormat="MMMM d, yyyy"
                  disabled={bookingDatesLoading || bookingDatesSaving}
                  className="chakra-input"
                />
              </Box>
              {bookingDatesLoading && <Spinner color="gray.400" />}
              {bookingDatesSaving && <Spinner color="blue.400" />}
            </Flex>
            <Button
              colorScheme="blue"
              isLoading={bookingDatesSaving}
              onClick={() => handleBookingDatesChange(bookingStartDate, bookingEndDate)}
              mt={4}
            >
              Save Booking Window
            </Button>
            <Text color="#888" fontSize="0.95em" ml={1}>
              (Users can book between these dates)
            </Text>
          </Box>
        );
      case 'base':
        return (
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            padding: '1.5rem',
            border: '1px solid #ECEAE5',
            boxShadow: '0 4px 12px rgba(165, 148, 128, 0.08)',
            maxWidth: '800px',
            fontFamily: 'Montserrat, sans-serif'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {WEEKDAYS.map((day, index) => (
                <div key={day} style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    cursor: 'pointer',
                    minWidth: '150px',
                    fontSize: '0.9375rem',
                    fontWeight: '500',
                    color: '#1F1F1F'
                  }}>
                    <input
                      type="checkbox"
                      checked={baseHours[index].enabled}
                      onChange={() => toggleDay(index)}
                      style={{
                        width: '18px',
                        height: '18px',
                        cursor: 'pointer',
                        accentColor: '#A59480'
                      }}
                    />
                    {day}
                  </label>
                  {baseHours[index].enabled && (
                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                      {baseHours[index].timeRanges.map((range, rangeIndex) => (
                        <div key={rangeIndex} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <input
                            type="time"
                            value={range.start}
                            onChange={e => updateTimeRange(index, rangeIndex, 'start', e.target.value)}
                            style={{
                              width: '110px',
                              height: '36px',
                              padding: '0 0.75rem',
                              border: '1px solid rgba(0, 0, 0, 0.12)',
                              borderRadius: '6px',
                              fontSize: '0.875rem',
                              fontFamily: 'inherit'
                            }}
                          />
                          <span style={{ fontSize: '0.875rem', color: '#6e6e73' }}>to</span>
                          <input
                            type="time"
                            value={range.end}
                            onChange={e => updateTimeRange(index, rangeIndex, 'end', e.target.value)}
                            style={{
                              width: '110px',
                              height: '36px',
                              padding: '0 0.75rem',
                              border: '1px solid rgba(0, 0, 0, 0.12)',
                              borderRadius: '6px',
                              fontSize: '0.875rem',
                              fontFamily: 'inherit'
                            }}
                          />
                          {baseHours[index].timeRanges.length > 1 && (
                            <button
                              onClick={() => removeTimeRange(index, rangeIndex)}
                              style={{
                                height: '32px',
                                padding: '0 1rem',
                                background: 'transparent',
                                color: '#c41e3a',
                                border: '1px solid rgba(196, 30, 58, 0.3)',
                                borderRadius: '6px',
                                fontSize: '0.8125rem',
                                fontWeight: '500',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                fontFamily: 'inherit'
                              }}
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        onClick={() => addTimeRange(index)}
                        style={{
                          height: '32px',
                          padding: '0 1rem',
                          background: 'transparent',
                          color: '#6e6e73',
                          border: '1px solid rgba(0, 0, 0, 0.12)',
                          borderRadius: '6px',
                          fontSize: '0.8125rem',
                          fontWeight: '500',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          fontFamily: 'inherit'
                        }}
                      >
                        + Add Time Range
                      </button>
                    </div>
                  )}
                </div>
              ))}
              <div style={{ marginTop: '1rem' }}>
                <button
                  onClick={saveBaseHours}
                  style={{
                    height: '40px',
                    padding: '0.5rem 1.5rem',
                    background: '#A59480',
                    color: '#ffffff',
                    border: '1px solid #A59480',
                    borderRadius: '10px',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    fontFamily: 'Montserrat, sans-serif',
                    boxShadow: '0 1px 2px rgba(165, 148, 128, 0.15), 0 4px 8px rgba(165, 148, 128, 0.25), 0 8px 16px rgba(165, 148, 128, 0.18)'
                  }}
                >
                  Save Base Hours
                </button>
              </div>
              {successMessage && (
                <div style={{
                  padding: '0.75rem 1rem',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  background: 'rgba(52, 199, 89, 0.1)',
                  color: '#0d6832',
                  border: '1px solid #34c759'
                }}>
                  {successMessage}
                </div>
              )}
              {error && (
                <div style={{
                  padding: '0.75rem 1rem',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  background: 'rgba(255, 59, 48, 0.1)',
                  color: '#c41e3a',
                  border: '1px solid #ff3b30'
                }}>
                  {error}
                </div>
              )}
            </div>
          </div>
        );
      case 'weekly':
        const mondayDate = DateTime.fromISO(currentWeekMonday, { zone: 'America/Chicago' });
        const sundayDate = mondayDate.plus({ days: 6 });
        const dateRangeLabel = `${mondayDate.toFormat('EEE MMM d')} - ${sundayDate.toFormat('EEE MMM d, yyyy')}`;

        return (
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            padding: '1.5rem',
            border: '1px solid #ECEAE5',
            boxShadow: '0 4px 12px rgba(165, 148, 128, 0.08)',
            maxWidth: '800px',
            fontFamily: 'Montserrat, sans-serif'
          }}>
            <div style={{
              fontSize: '0.8125rem',
              color: '#6e6e73',
              marginBottom: '1rem',
              fontWeight: '500'
            }}>
              {dateRangeLabel}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {WEEKDAYS.map((day, index) => {
                const dayDate = mondayDate.plus({ days: index });
                const dateLabel = dayDate.toFormat('M/d');

                return (
                  <div key={day} style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
                    <label style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      cursor: 'pointer',
                      minWidth: '150px',
                      fontSize: '0.9375rem',
                      fontWeight: '500',
                      color: '#1F1F1F'
                    }}>
                      <input
                        type="checkbox"
                        checked={weeklyHours[index].enabled}
                        onChange={() => toggleWeeklyDay(index)}
                        style={{
                          width: '18px',
                          height: '18px',
                          cursor: 'pointer',
                          accentColor: '#A59480'
                        }}
                      />
                      {day} <span style={{ color: '#6e6e73', fontWeight: '400' }}>{dateLabel}</span>
                    </label>
                  {weeklyHours[index].enabled && (
                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                      {weeklyHours[index].timeRanges.map((range, rangeIndex) => (
                        <div key={rangeIndex} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <input
                            type="time"
                            value={range.start}
                            onChange={e => updateWeeklyTimeRange(index, rangeIndex, 'start', e.target.value)}
                            style={{
                              width: '110px',
                              height: '36px',
                              padding: '0 0.75rem',
                              border: '1px solid rgba(0, 0, 0, 0.12)',
                              borderRadius: '6px',
                              fontSize: '0.875rem',
                              fontFamily: 'inherit'
                            }}
                          />
                          <span style={{ fontSize: '0.875rem', color: '#6e6e73' }}>to</span>
                          <input
                            type="time"
                            value={range.end}
                            onChange={e => updateWeeklyTimeRange(index, rangeIndex, 'end', e.target.value)}
                            style={{
                              width: '110px',
                              height: '36px',
                              padding: '0 0.75rem',
                              border: '1px solid rgba(0, 0, 0, 0.12)',
                              borderRadius: '6px',
                              fontSize: '0.875rem',
                              fontFamily: 'inherit'
                            }}
                          />
                          {weeklyHours[index].timeRanges.length > 1 && (
                            <button
                              onClick={() => removeWeeklyTimeRange(index, rangeIndex)}
                              style={{
                                height: '32px',
                                padding: '0 1rem',
                                background: 'transparent',
                                color: '#c41e3a',
                                border: '1px solid rgba(196, 30, 58, 0.3)',
                                borderRadius: '6px',
                                fontSize: '0.8125rem',
                                fontWeight: '500',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                fontFamily: 'inherit'
                              }}
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        onClick={() => addWeeklyTimeRange(index)}
                        style={{
                          height: '32px',
                          padding: '0 1rem',
                          background: 'transparent',
                          color: '#6e6e73',
                          border: '1px solid rgba(0, 0, 0, 0.12)',
                          borderRadius: '6px',
                          fontSize: '0.8125rem',
                          fontWeight: '500',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          fontFamily: 'inherit'
                        }}
                      >
                        + Add Time Range
                      </button>
                    </div>
                  )}
                  </div>
                );
              })}
              <div style={{ marginTop: '1rem' }}>
                <button
                  onClick={saveWeeklyHours}
                  style={{
                    height: '40px',
                    padding: '0.5rem 1.5rem',
                    background: '#A59480',
                    color: '#ffffff',
                    border: '1px solid #A59480',
                    borderRadius: '10px',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    fontFamily: 'Montserrat, sans-serif',
                    boxShadow: '0 1px 2px rgba(165, 148, 128, 0.15), 0 4px 8px rgba(165, 148, 128, 0.25), 0 8px 16px rgba(165, 148, 128, 0.18)'
                  }}
                >
                  Save Weekly Hours
                </button>
              </div>
              {successMessage && (
                <div style={{
                  padding: '0.75rem 1rem',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  background: 'rgba(52, 199, 89, 0.1)',
                  color: '#0d6832',
                  border: '1px solid #34c759'
                }}>
                  {successMessage}
                </div>
              )}
              {error && (
                <div style={{
                  padding: '0.75rem 1rem',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  background: 'rgba(255, 59, 48, 0.1)',
                  color: '#c41e3a',
                  border: '1px solid #ff3b30'
                }}>
                  {error}
                </div>
              )}
            </div>
          </div>
        );
      case 'custom_open':
        return (
          <Box className="availability-section" p={4} borderRadius="8px" border="1px solid #ececec" maxW={"600px"}>
            <Heading size="md" mb={4}>Custom Open Days</Heading>
            <VStack align="stretch" spacing={4}>
              <HStack>
                <DatePicker
                  selected={newOpenDate}
                  onChange={date => setNewOpenDate(date)}
                  placeholderText="Select date"
                  minDate={new Date()}
                  className="chakra-input"
                />
                <HStack>
                  {newOpenTimeRanges.map((range, index) => (
                    <HStack key={index} spacing={1}>
                      <Input type="time" value={range.start} onChange={e => {
                        const newRanges = [...newOpenTimeRanges];
                        newRanges[index].start = e.target.value;
                        setNewOpenTimeRanges(newRanges);
                      }} w="110px" />
                      <Text>to</Text>
                      <Input type="time" value={range.end} onChange={e => {
                        const newRanges = [...newOpenTimeRanges];
                        newRanges[index].end = e.target.value;
                        setNewOpenTimeRanges(newRanges);
                      }} w="110px" />
                    </HStack>
                  ))}
                  <Button size="xs" colorScheme="blue" onClick={() => setNewOpenTimeRanges([...newOpenTimeRanges, { start: '18:00', end: '23:00' }])}>+ Add Time Range</Button>
                </HStack>
                <Input value={newOpenLabel} onChange={e => setNewOpenLabel(e.target.value)} placeholder="Event label (optional)" w="200px" />
                <Button colorScheme="green" onClick={addExceptionalOpen}>Add Custom Open Day</Button>
              </HStack>
              <VStack align="stretch" spacing={2}>
                {exceptionalOpens.map(open => (
                  <Box key={open.id} p={2} borderWidth={1} borderRadius={6} display="flex" alignItems="center" gap={2}>
                    {editingOpenId === open.id ? (
                      <>
                        <DatePicker
                          selected={editingOpen?.date ? new Date(editingOpen.date) : null}
                          onChange={date => setEditingOpen((e: any) => ({ ...e, date }))}
                          minDate={new Date()}
                          className="chakra-input"
                        />
                        <HStack>
                          {editingOpen?.time_ranges.map((range: TimeRange, index: number) => (
                            <HStack key={index} spacing={1}>
                              <Input type="time" value={range.start} onChange={e => setEditingOpen((ed: any) => ({ ...ed, time_ranges: ed.time_ranges.map((r: TimeRange, i: number) => i === index ? { ...r, start: e.target.value } : r) }))} w="110px" />
                              <Text>to</Text>
                              <Input type="time" value={range.end} onChange={e => setEditingOpen((ed: any) => ({ ...ed, time_ranges: ed.time_ranges.map((r: TimeRange, i: number) => i === index ? { ...r, end: e.target.value } : r) }))} w="110px" />
                            </HStack>
                          ))}
                          <Button size="xs" colorScheme="blue" onClick={() => setEditingOpen((e: any) => ({ ...e, time_ranges: [...e.time_ranges, { start: '18:00', end: '23:00' }] }))}>+ Add Time Range</Button>
                        </HStack>
                        <Input value={editingOpen.label} onChange={e => setEditingOpen((ed: any) => ({ ...ed, label: e.target.value }))} placeholder="Event label (optional)" w="200px" />
                        <Button colorScheme="blue" onClick={handleSaveEditOpen}>Save</Button>
                        <Button colorScheme="gray" onClick={handleCancelEditOpen}>Cancel</Button>
                      </>
                    ) : (
                      <>
                        <Text>{open.date && /^\d{4}-\d{2}-\d{2}$/.test(open.date) ? (() => { const [y, m, d] = open.date.split('-'); return `${Number(m)}/${Number(d)}/${y}`; })() : formatDate(new Date(open.date), 'America/Chicago')}</Text>
                        <Text>{open.time_ranges.map(range => `${formatTime12h(range.start)} - ${formatTime12h(range.end)}`).join(', ')}</Text>
                        {open.label && <Badge colorScheme="purple">{open.label}</Badge>}
                        <Button size="xs" colorScheme="blue" onClick={() => handleEditOpen(open)}>Edit</Button>
                        <Button size="xs" colorScheme="red" onClick={() => deleteExceptionalOpen(open.id)}>Delete</Button>
                      </>
                    )}
                  </Box>
                ))}
              </VStack>
              {error && <Text color="red.500">{error}</Text>}
            </VStack>
          </Box>
        );
      case 'custom_closed':
        return (
          <Box className="availability-section" p={0} borderRadius="12px" border="none" maxW="100%">
            <VStack align="stretch" spacing={4}>
              {/* Add Form */}
              <Box p={4} bg="#ffffff" borderRadius="12px" boxShadow="0 1px 3px rgba(0, 0, 0, 0.04), 0 2px 8px rgba(0, 0, 0, 0.06)">
                <Heading size="sm" mb={4} fontSize="1.25rem" fontWeight={600} letterSpacing="-0.02em" fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif">Add Custom Closed Day</Heading>
                <VStack align="stretch" spacing={4}>
                  {/* All Fields in One Row */}
                  <HStack spacing={3} align="flex-end" flexWrap="wrap">
                    <Box flex="0 0 180px">
                      <Text fontSize="0.875rem" fontWeight={600} color="#1d1d1f" mb={2} fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif">Date *</Text>
                      <Box width="100%">
                        <DatePicker
                          selected={newClosureDate}
                          onChange={date => setNewClosureDate(date)}
                          placeholderText="Select date"
                          minDate={new Date()}
                          className="chakra-input"
                          wrapperClassName="closure-datepicker-wrapper"
                        />
                      </Box>
                    </Box>
                    <Box flex="1" minW="200px">
                      <Text fontSize="0.875rem" fontWeight={600} color="#1d1d1f" mb={2} fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif">Reason (optional)</Text>
                      <Input 
                        value={newClosureReason} 
                        onChange={e => setNewClosureReason(e.target.value)} 
                        placeholder="Reason for closure" 
                        h="44px"
                        bg="#f5f5f7"
                        borderColor="rgba(0, 0, 0, 0.08)"
                        borderRadius="10px"
                        fontSize="1rem"
                        _focus={{ bg: '#ffffff', borderColor: '#007aff', boxShadow: '0 0 0 3px rgba(0, 122, 255, 0.1)' }}
                      />
                    </Box>
                    <Box flex="1" minW="200px">
                      <Text fontSize="0.875rem" fontWeight={600} color="#1d1d1f" mb={2} fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif">SMS Message (optional)</Text>
                      <Input 
                        value={newClosureSmsNotification} 
                        onChange={e => setNewClosureSmsNotification(e.target.value)} 
                        placeholder="SMS message for reservations" 
                        h="44px"
                        bg="#f5f5f7"
                        borderColor="rgba(0, 0, 0, 0.08)"
                        borderRadius="10px"
                        fontSize="1rem"
                        _focus={{ bg: '#ffffff', borderColor: '#007aff', boxShadow: '0 0 0 3px rgba(0, 122, 255, 0.1)' }}
                      />
                    </Box>
                    <Box flex="0 0 140px">
                      <Text fontSize="0.875rem" fontWeight={600} color="#1d1d1f" mb={2} fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif">Type</Text>
                      <Checkbox 
                        isChecked={newClosureFullDay} 
                        onChange={e => setNewClosureFullDay(e.target.checked)}
                        fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
                        fontSize="0.9375rem"
                        pt={1}
                      >
                        Full Day
                      </Checkbox>
                    </Box>
                    <Box flex="0 0 auto" pb={0}>
                      <Text fontSize="0.875rem" fontWeight={600} color="transparent" mb={2} fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif">Action</Text>
                      <Button 
                        onClick={addExceptionalClosure}
                        h="44px"
                        px="1rem"
                        fontSize="0.8125rem"
                        fontWeight={500}
                        bg="transparent"
                        color="#6e6e73"
                        border="1px solid rgba(0, 0, 0, 0.12)"
                        borderRadius="6px"
                        fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
                        _hover={{ bg: 'rgba(0, 0, 0, 0.04)', borderColor: 'rgba(0, 0, 0, 0.16)', color: '#1d1d1f' }}
                      >
                        Add
                      </Button>
                    </Box>
                  </HStack>

                  {/* Time Ranges (only shown when not full day) */}
                  {!newClosureFullDay && (
                    <Box>
                      <Text fontSize="0.875rem" fontWeight={600} color="#1d1d1f" mb={2} fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif">Time Ranges</Text>
                      <VStack align="stretch" spacing={2}>
                        {newClosureTimeRanges.map((range, index) => (
                          <HStack key={index} spacing={2}>
                            <Input 
                              type="time" 
                              value={range.start} 
                              onChange={e => {
                                const newRanges = [...newClosureTimeRanges];
                                newRanges[index].start = e.target.value;
                                setNewClosureTimeRanges(newRanges);
                              }} 
                              flex="0 0 140px"
                              h="44px"
                              bg="#f5f5f7"
                              borderColor="rgba(0, 0, 0, 0.08)"
                              borderRadius="10px"
                              fontSize="1rem"
                              _focus={{ bg: '#ffffff', borderColor: '#007aff', boxShadow: '0 0 0 3px rgba(0, 122, 255, 0.1)' }}
                            />
                            <Text fontSize="0.875rem" color="#6e6e73" alignSelf="center">to</Text>
                            <Input 
                              type="time" 
                              value={range.end} 
                              onChange={e => {
                                const newRanges = [...newClosureTimeRanges];
                                newRanges[index].end = e.target.value;
                                setNewClosureTimeRanges(newRanges);
                              }} 
                              flex="0 0 140px"
                              h="44px"
                              bg="#f5f5f7"
                              borderColor="rgba(0, 0, 0, 0.08)"
                              borderRadius="10px"
                              fontSize="1rem"
                              _focus={{ bg: '#ffffff', borderColor: '#007aff', boxShadow: '0 0 0 3px rgba(0, 122, 255, 0.1)' }}
                            />
                            {newClosureTimeRanges.length > 1 && (
                              <Button 
                                size="sm" 
                                onClick={() => {
                                  const newRanges = newClosureTimeRanges.filter((_, i) => i !== index);
                                  setNewClosureTimeRanges(newRanges);
                                }}
                                h="32px"
                                w="32px"
                                fontSize="0.875rem"
                                bg="transparent"
                                color="#6e6e73"
                                border="1px solid rgba(0, 0, 0, 0.12)"
                                borderRadius="6px"
                                _hover={{ bg: 'rgba(0, 0, 0, 0.04)', borderColor: 'rgba(0, 0, 0, 0.16)', color: '#1d1d1f' }}
                              >
                                ×
                              </Button>
                            )}
                          </HStack>
                        ))}
                        <Button 
                          size="sm" 
                          onClick={() => setNewClosureTimeRanges([...newClosureTimeRanges, { start: '18:00', end: '23:00' }])}
                          h="32px"
                          px="0.75rem"
                          fontSize="0.8125rem"
                          bg="transparent"
                          color="#6e6e73"
                          border="1px solid rgba(0, 0, 0, 0.12)"
                          borderRadius="6px"
                          alignSelf="flex-start"
                          _hover={{ bg: 'rgba(0, 0, 0, 0.04)', borderColor: 'rgba(0, 0, 0, 0.16)', color: '#1d1d1f' }}
                        >
                          + Add Time Range
                        </Button>
                      </VStack>
                    </Box>
                  )}
                </VStack>
              </Box>

              {/* Table */}
              <Box p={4} bg="#ffffff" borderRadius="12px" boxShadow="0 1px 3px rgba(0, 0, 0, 0.04), 0 2px 8px rgba(0, 0, 0, 0.06)" overflowX="auto" w="100%">
                {exceptionalClosures.length === 0 ? (
                  <Text textAlign="center" py={8} color="#6e6e73" fontSize="0.875rem" fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif">No custom closed days</Text>
                ) : (
                  <Table variant="simple" size="sm" w="100%">
                    <Thead>
                      <Tr>
                        <Th fontSize="0.8125rem" fontWeight={600} color="#1d1d1f" fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" py={3} borderBottom="1px solid rgba(0, 0, 0, 0.08)" w="12%">Date</Th>
                        <Th fontSize="0.8125rem" fontWeight={600} color="#1d1d1f" fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" py={3} borderBottom="1px solid rgba(0, 0, 0, 0.08)" w="12%">Type</Th>
                        <Th fontSize="0.8125rem" fontWeight={600} color="#1d1d1f" fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" py={3} borderBottom="1px solid rgba(0, 0, 0, 0.08)">Description</Th>
                        <Th fontSize="0.8125rem" fontWeight={600} color="#1d1d1f" fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" py={3} borderBottom="1px solid rgba(0, 0, 0, 0.08)" textAlign="right" w="10%">Actions</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {exceptionalClosures.map(closure => (
                        <Tr key={closure.id} _hover={{ bg: 'rgba(0, 0, 0, 0.02)' }}>
                          {editingClosureId === closure.id ? (
                            <>
                              <Td py={2}>
                                <Box width="100%">
                                  <DatePicker
                                    selected={editingClosure?.date ? new Date(editingClosure.date) : null}
                                    onChange={date => setEditingClosure((e: any) => ({ ...e, date }))}
                                    minDate={new Date()}
                                    className="chakra-input"
                                    wrapperClassName="closure-datepicker-wrapper-edit"
                                  />
                                </Box>
                              </Td>
                              <Td py={2}>
                                <Checkbox 
                                  isChecked={editingClosure?.full_day} 
                                  onChange={e => setEditingClosure((ed: any) => ({ ...ed, full_day: e.target.checked }))}
                                  fontSize="0.875rem"
                                  fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
                                >
                                  Full Day
                                </Checkbox>
                              </Td>
                              <Td py={2}>
                                <VStack align="stretch" spacing={2}>
                                  <Input 
                                    value={editingClosure?.reason || ''} 
                                    onChange={e => setEditingClosure((ed: any) => ({ ...ed, reason: e.target.value }))} 
                                    placeholder="Reason" 
                                    size="sm"
                                    h="36px"
                                    bg="#f5f5f7"
                                    borderColor="rgba(0, 0, 0, 0.08)"
                                    borderRadius="8px"
                                    fontSize="0.875rem"
                                    _focus={{ bg: '#ffffff', borderColor: '#007aff', boxShadow: '0 0 0 3px rgba(0, 122, 255, 0.1)' }}
                                  />
                                  <Input 
                                    value={editingClosure?.sms_notification || ''} 
                                    onChange={e => setEditingClosure((ed: any) => ({ ...ed, sms_notification: e.target.value }))} 
                                    placeholder="SMS message" 
                                    size="sm"
                                    h="36px"
                                    bg="#f5f5f7"
                                    borderColor="rgba(0, 0, 0, 0.08)"
                                    borderRadius="8px"
                                    fontSize="0.875rem"
                                    _focus={{ bg: '#ffffff', borderColor: '#007aff', boxShadow: '0 0 0 3px rgba(0, 122, 255, 0.1)' }}
                                  />
                                </VStack>
                              </Td>
                              <Td py={2} textAlign="right">
                                <HStack spacing={2} justify="flex-end">
                                  <Button 
                                    size="sm"
                                    onClick={handleSaveEditClosure}
                                    h="28px"
                                    px="0.75rem"
                                    fontSize="0.75rem"
                                    bg="transparent"
                                    color="#6e6e73"
                                    border="1px solid rgba(0, 0, 0, 0.12)"
                                    borderRadius="6px"
                                    _hover={{ bg: 'rgba(0, 0, 0, 0.04)', borderColor: 'rgba(0, 0, 0, 0.16)', color: '#1d1d1f' }}
                                  >
                                    Save
                                  </Button>
                                  <Button 
                                    size="sm"
                                    onClick={handleCancelEditClosure}
                                    h="28px"
                                    px="0.75rem"
                                    fontSize="0.75rem"
                                    bg="transparent"
                                    color="#6e6e73"
                                    border="1px solid rgba(0, 0, 0, 0.12)"
                                    borderRadius="6px"
                                    _hover={{ bg: 'rgba(0, 0, 0, 0.04)', borderColor: 'rgba(0, 0, 0, 0.16)', color: '#1d1d1f' }}
                                  >
                                    Cancel
                                  </Button>
                                </HStack>
                              </Td>
                            </>
                          ) : (
                            <>
                              <Td py={3} fontSize="0.875rem" color="#1d1d1f" fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif">
                                {closure.date && /^\d{4}-\d{2}-\d{2}$/.test(closure.date) 
                                  ? (() => { 
                                      const [y, m, d] = closure.date.split('-'); 
                                      return `${Number(m)}/${Number(d)}/${y}`; 
                                    })() 
                                  : formatDate(new Date(closure.date), 'America/Chicago')
                                }
                              </Td>
                              <Td py={3} fontSize="0.875rem" color="#6e6e73" fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif">
                                {closure.full_day ? 'Full Day' : closure.time_ranges?.map(range => `${formatTime12h(range.start)} - ${formatTime12h(range.end)}`).join(', ') || '—'}
                              </Td>
                              <Td py={3} fontSize="0.875rem" color="#1d1d1f" fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif">
                                <VStack align="stretch" spacing={1}>
                                  {closure.reason && (
                                    <Text fontSize="0.8125rem" color="#1d1d1f" noOfLines={2}>{closure.reason}</Text>
                                  )}
                                  {closure.sms_notification && (
                                    <Text fontSize="0.75rem" color="#6e6e73" noOfLines={3}>{closure.sms_notification}</Text>
                                  )}
                                  {!closure.reason && !closure.sms_notification && (
                                    <Text fontSize="0.8125rem" color="#6e6e73">—</Text>
                                  )}
                                </VStack>
                              </Td>
                              <Td py={3} textAlign="right">
                                <HStack spacing={1} justify="flex-end">
                                  <IconButton
                                    aria-label="Edit"
                                    icon={<Text>✎</Text>}
                                    size="sm"
                                    h="28px"
                                    w="28px"
                                    bg="transparent"
                                    color="#6e6e73"
                                    border="1px solid rgba(0, 0, 0, 0.08)"
                                    borderRadius="6px"
                                    fontSize="0.875rem"
                                    onClick={() => handleEditClosure(closure)}
                                    _hover={{ bg: 'rgba(0, 0, 0, 0.04)', borderColor: 'rgba(0, 0, 0, 0.16)', color: '#1d1d1f' }}
                                  />
                                  <IconButton
                                    aria-label="Delete"
                                    icon={<Text>🗑</Text>}
                                    size="sm"
                                    h="28px"
                                    w="28px"
                                    bg="transparent"
                                    color="#6e6e73"
                                    border="1px solid rgba(0, 0, 0, 0.08)"
                                    borderRadius="6px"
                                    fontSize="0.875rem"
                                    onClick={() => deleteExceptionalClosure(closure.id)}
                                    _hover={{ bg: 'rgba(0, 0, 0, 0.04)', borderColor: 'rgba(0, 0, 0, 0.16)', color: '#1d1d1f' }}
                                  />
                                </HStack>
                              </Td>
                            </>
                          )}
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                )}
                {error && (
                  <Text color="#ff3b30" fontSize="0.875rem" mt={3} fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif">{error}</Text>
                )}
              </Box>
            </VStack>
          </Box>
        );
      case 'private_events':
        return (
          <Box className="availability-section" p={4} borderRadius="8px" border="1px solid #ececec" maxW={"600px"}>
            <Heading size="md" mb={4}>Private Events</Heading>
            <VStack align="stretch" spacing={4}>
              <form onSubmit={handleCreatePrivateEvent}>
                <HStack>
                  <Input value={privateEvent.name} onChange={e => setPrivateEvent((ev: any) => ({ ...ev, name: e.target.value }))} placeholder="Event Name" w="200px" required />
                  <Input value={privateEvent.event_type} onChange={e => setPrivateEvent((ev: any) => ({ ...ev, event_type: e.target.value }))} placeholder="Event Type" w="150px" required />
                  <DatePicker
                    selected={privateEvent.date}
                    onChange={date => setPrivateEvent((ev: any) => ({ ...ev, date }))}
                    placeholderText="Select date"
                    className="chakra-input"
                  />
                  <Checkbox isChecked={privateEvent.full_day} onChange={e => setPrivateEvent((ev: any) => ({ ...ev, full_day: e.target.checked }))}>Full Day</Checkbox>
                  {!privateEvent.full_day && (
                    <>
                      <Input type="time" value={privateEvent.start} onChange={e => setPrivateEvent((ev: any) => ({ ...ev, start: e.target.value }))} w="110px" required />
                      <Input type="time" value={privateEvent.end} onChange={e => setPrivateEvent((ev: any) => ({ ...ev, end: e.target.value }))} w="110px" required />
                    </>
                  )}
                  <Button colorScheme="green" type="submit">Create Private Event</Button>
                </HStack>
                {privateEventStatus && <Text color={privateEventStatus.includes('created') ? 'green.500' : 'red.500'}>{privateEventStatus}</Text>}
              </form>
              <Divider />
              <VStack align="stretch" spacing={2}>
                {privateEvents.map(event => (
                  <Box key={event.id} p={2} borderWidth={1} borderRadius={6} display="flex" alignItems="center" gap={2}>
                    <Text fontWeight={600}>{event.title}</Text>
                    <Text>{event.event_type}</Text>
                    <Text>
                      {event.full_day ? 'Full Day' : `${event.start_time && formatTime(new Date(event.start_time), 'America/Chicago')} - ${event.end_time && formatTime(new Date(event.end_time), 'America/Chicago')}`}
                      {' '}
                      {event.start_time && formatDate(new Date(event.start_time), 'America/Chicago')}
                    </Text>
                    {event.full_day && <Badge colorScheme="purple">Full Day</Badge>}
                    <Button size="xs" colorScheme="blue" onClick={() => handleOpenEditModal(event)}>Edit</Button>
                    <Button size="xs" colorScheme="red" onClick={() => handleDeletePrivateEvent(event.id)}>Delete</Button>
                  </Box>
                ))}
              </VStack>
            </VStack>
            <Modal isOpen={editModalOpen} onClose={handleCloseEditModal} size="lg">
              <ModalOverlay />
              <ModalContent>
                <ModalHeader>Edit Private Event</ModalHeader>
                <ModalCloseButton />
                <ModalBody>
                  <VStack spacing={4}>
                    <Input value={editEventForm.name} onChange={e => setEditEventForm((f: any) => ({ ...f, name: e.target.value }))} placeholder="Event Name" w="200px" required />
                    <Input value={editEventForm.event_type} onChange={e => setEditEventForm((f: any) => ({ ...f, event_type: e.target.value }))} placeholder="Event Type" w="150px" required />
                    <DatePicker
                      selected={editEventForm.date}
                      onChange={date => setEditEventForm((f: any) => ({ ...f, date }))}
                      placeholderText="Select date"
                      className="chakra-input"
                    />
                    <Checkbox isChecked={editEventForm.full_day} onChange={e => setEditEventForm((f: any) => ({ ...f, full_day: e.target.checked }))}>Full Day</Checkbox>
                    {!editEventForm.full_day && (
                      <HStack>
                        <Input type="time" value={editEventForm.start} onChange={e => setEditEventForm((f: any) => ({ ...f, start: e.target.value }))} w="110px" required />
                        <Input type="time" value={editEventForm.end} onChange={e => setEditEventForm((f: any) => ({ ...f, end: e.target.value }))} w="110px" required />
                      </HStack>
                    )}
                  </VStack>
                </ModalBody>
                <ModalFooter>
                  <Button colorScheme="blue" mr={3} onClick={handleSaveEditEvent}>Save</Button>
                  <Button colorScheme="red" mr={3} onClick={handleDeleteEditEvent}>Delete</Button>
                  <Button variant="ghost" onClick={handleCloseEditModal}>Cancel</Button>
                </ModalFooter>
              </ModalContent>
            </Modal>
          </Box>
        );
      default:
        return null;
    }
  };

  return (
    <Box>
      {renderContent()}
    </Box>
  );
};

export default CalendarAvailabilityControl; 