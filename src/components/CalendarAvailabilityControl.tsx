import React, { useState, useEffect } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { supabase } from '../lib/supabase';
import PrivateEventBooking from './PrivateEventBooking';
import { DateTime } from 'luxon';
import { formatTime, formatDate, fromUTC } from '../utils/dateUtils';
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
} from '@chakra-ui/react';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

type TimeRange = { start: string; end: string };
type BaseHour = { enabled: boolean; timeRanges: TimeRange[] };
type ExceptionalOpen = { id: number; date: string; time_ranges: TimeRange[]; label?: string };
type ExceptionalClosure = { id: number; date: string; reason?: string; full_day?: boolean; time_ranges?: TimeRange[]; sms_notification?: string };

type CalendarAvailabilityControlProps = { section: 'booking_window' | 'base' | 'custom_open' | 'custom_closed' | 'private_events' };

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

const CalendarAvailabilityControl: React.FC<CalendarAvailabilityControlProps> = ({ section }) => {
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
      const { data: settingsData } = await supabase
        .from('settings')
        .select('booking_start_date, booking_end_date')
        .single();
      if (settingsData) {
        if (settingsData.booking_start_date) setBookingStartDate(DateTime.fromISO(settingsData.booking_start_date, { zone: 'America/Chicago' }).toJSDate());
        if (settingsData.booking_end_date) setBookingEndDate(DateTime.fromISO(settingsData.booking_end_date, { zone: 'America/Chicago' }).toJSDate());
      }
      setBookingDatesLoading(false);
    }
    fetchBookingDates();
  }, []);

  async function handleBookingDatesChange(start: Date, end: Date) {
    setBookingStartDate(start);
    setBookingEndDate(end);
    setBookingDatesSaving(true);
    try {
      const response = await fetch('/api/booking-window', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start: formatDateToLocal(start), end: formatDateToLocal(end) })
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save booking window');
      }
      console.log('Booking window saved successfully');
    } catch (error) {
      console.error('Error saving booking window:', error);
    } finally {
      setBookingDatesSaving(false);
    }
  }

  // Base Hours State
  const [baseHours, setBaseHours] = useState<BaseHour[]>(Array(7).fill(null).map(() => ({ enabled: false, timeRanges: [{ start: '18:00', end: '23:00' }] })));

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
        const { data: baseHoursData } = await supabase
          .from('venue_hours')
          .select('*')
          .eq('type', 'base');
        const { data: opensData } = await supabase
          .from('venue_hours')
          .select('*')
          .eq('type', 'exceptional_open');
        const { data: closuresData } = await supabase
          .from('venue_hours')
          .select('*')
          .eq('type', 'exceptional_closure');
        if (baseHoursData) {
          const enabledDays = Array(7).fill(false);
          const timeRanges = Array(7).fill(null).map(() => [{ start: '18:00', end: '23:00' }]);
          baseHoursData.forEach((hour: any) => {
            enabledDays[hour.day_of_week] = true;
            timeRanges[hour.day_of_week] = hour.time_ranges;
          });
          setBaseHours(timeRanges.map((ranges, index) => ({ enabled: enabledDays[index], timeRanges: ranges })));
        }
        if (opensData) setExceptionalOpens(opensData);
        if (closuresData) setExceptionalClosures(closuresData);
      } catch (error: any) {
        setError('Failed to load availability data. Please try again.');
      }
    }
    loadAvailabilityData();
  }, []);

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
      await supabase.from('venue_hours').delete().eq('type', 'base');
      const baseHoursToSave = baseHours.map((day, index) => ({
        type: 'base',
        day_of_week: index,
        time_ranges: day.enabled ? day.timeRanges : []
      })).filter(day => day.time_ranges.length > 0);
      const { error: insertError } = await supabase.from('venue_hours').insert(baseHoursToSave);
      if (insertError) throw insertError;
      setSuccessMessage('Base hours updated successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err: any) {
      setError('Failed to save base hours: ' + err.message);
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
      const newOpen = {
        date: newOpenDateStr,
        time_ranges: newOpenTimeRanges,
        label: newOpenLabel,
        type: 'exceptional_open'
      };
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
      const { error } = await supabase.from('venue_hours').delete().eq('id', id);
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
      const newClosure = {
        date: newClosureDateStr,
        reason: newClosureReason,
        type: 'exceptional_closure',
        full_day: newClosureFullDay,
        time_ranges: newClosureFullDay ? null : newClosureTimeRanges,
        sms_notification: newClosureSmsNotification
      };
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
      const { error } = await supabase.from('venue_hours').delete().eq('id', id);
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
      const { data, error } = await supabase
        .from('venue_hours')
        .update({
          date: editingOpen.date,
          time_ranges: editingOpen.time_ranges,
          label: editingOpen.label,
        })
        .eq('id', editingOpen.id)
        .select()
        .single();
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
      const { data, error } = await supabase
        .from('venue_hours')
        .update({
          date: editingClosure.date,
          reason: editingClosure.reason,
          full_day: editingClosure.full_day,
          time_ranges: editingClosure.full_day ? null : editingClosure.time_ranges,
          sms_notification: editingClosure.sms_notification
        })
        .eq('id', editingClosure.id)
        .select()
        .single();
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
      
      const { data, error } = await supabase.from('private_events').insert([
        {
          title: privateEvent.name,
          event_type: privateEvent.event_type,
          start_time: start_time.toISOString(),
          end_time: end_time.toISOString(),
          full_day: privateEvent.full_day,
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
      
      const { data, error } = await supabase
        .from('private_events')
        .update({
          title: editEventForm.name,
          event_type: editEventForm.event_type,
          start_time: start_time.toISOString(),
          end_time: end_time.toISOString(),
          full_day: editEventForm.full_day,
        })
        .eq('id', editingEvent.id)
        .select()
        .single();
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
      const { error } = await supabase
        .from('private_events')
        .delete()
        .eq('id', editingEvent.id);
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
      const { error } = await supabase
        .from('private_events')
        .delete()
        .eq('id', id);
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
          <Box className="availability-section" p={4} borderRadius="8px" border="1px solid #ececec" maxW={"600px"}>
            <Heading size="md" mb={4}>Base Hours</Heading>
            <VStack align="stretch" spacing={4}>
              {WEEKDAYS.map((day, index) => (
                <Box key={day} display="flex" alignItems="center" gap={4}>
                  <Checkbox isChecked={baseHours[index].enabled} onChange={() => toggleDay(index)}>{day}</Checkbox>
                  {baseHours[index].enabled && (
                    <HStack spacing={2}>
                      {baseHours[index].timeRanges.map((range, rangeIndex) => (
                        <HStack key={rangeIndex} spacing={1}>
                          <Input type="time" value={range.start} onChange={e => updateTimeRange(index, rangeIndex, 'start', e.target.value)} w="110px" />
                          <Text>to</Text>
                          <Input type="time" value={range.end} onChange={e => updateTimeRange(index, rangeIndex, 'end', e.target.value)} w="110px" />
                          {baseHours[index].timeRanges.length > 1 && (
                            <Button size="xs" colorScheme="red" onClick={() => removeTimeRange(index, rangeIndex)}>Remove</Button>
                          )}
                        </HStack>
                      ))}
                      <Button size="xs" colorScheme="blue" onClick={() => addTimeRange(index)}>+ Add Time Range</Button>
                    </HStack>
                  )}
                </Box>
              ))}
              <Button colorScheme="blue" onClick={saveBaseHours}>Save Base Hours</Button>
              {successMessage && <Text color="green.500">{successMessage}</Text>}
              {error && <Text color="red.500">{error}</Text>}
            </VStack>
          </Box>
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
          <Box className="availability-section" p={4} borderRadius="8px" border="1px solid #ececec" maxW={"600px"}>
            <Heading size="md" mb={4}>Custom Closed Days</Heading>
            <VStack align="stretch" spacing={4}>
              <HStack>
                <DatePicker
                  selected={newClosureDate}
                  onChange={date => setNewClosureDate(date)}
                  placeholderText="Select date"
                  minDate={new Date()}
                  className="chakra-input"
                />
                <Input value={newClosureReason} onChange={e => setNewClosureReason(e.target.value)} placeholder="Reason for closure (optional)" w="200px" />
                <Input value={newClosureSmsNotification} onChange={e => setNewClosureSmsNotification(e.target.value)} placeholder="SMS message for reservations (optional)" w="250px" />
                <Checkbox isChecked={newClosureFullDay} onChange={e => setNewClosureFullDay(e.target.checked)}>Full Day</Checkbox>
                {!newClosureFullDay && (
                  <HStack>
                    {newClosureTimeRanges.map((range, index) => (
                      <HStack key={index} spacing={1}>
                        <Input type="time" value={range.start} onChange={e => {
                          const newRanges = [...newClosureTimeRanges];
                          newRanges[index].start = e.target.value;
                          setNewClosureTimeRanges(newRanges);
                        }} w="110px" />
                        <Text>to</Text>
                        <Input type="time" value={range.end} onChange={e => {
                          const newRanges = [...newClosureTimeRanges];
                          newRanges[index].end = e.target.value;
                          setNewClosureTimeRanges(newRanges);
                        }} w="110px" />
                      </HStack>
                    ))}
                    <Button size="xs" colorScheme="blue" onClick={() => setNewClosureTimeRanges([...newClosureTimeRanges, { start: '18:00', end: '23:00' }])}>+ Add Time Range</Button>
                  </HStack>
                )}
                <Button colorScheme="green" onClick={addExceptionalClosure}>Add Custom Closed Day</Button>
              </HStack>
              <VStack align="stretch" spacing={2}>
                {exceptionalClosures.map(closure => (
                  <Box key={closure.id} p={2} borderWidth={1} borderRadius={6} display="flex" alignItems="center" gap={2}>
                    {editingClosureId === closure.id ? (
                      <>
                        <DatePicker
                          selected={editingClosure?.date ? new Date(editingClosure.date) : null}
                          onChange={date => setEditingClosure((e: any) => ({ ...e, date }))}
                          minDate={new Date()}
                          className="chakra-input"
                        />
                        <Input value={editingClosure?.reason} onChange={e => setEditingClosure((ed: any) => ({ ...ed, reason: e.target.value }))} placeholder="Reason for closure (optional)" w="200px" />
                        <Input value={editingClosure?.sms_notification} onChange={e => setEditingClosure((ed: any) => ({ ...ed, sms_notification: e.target.value }))} placeholder="SMS message for reservations (optional)" w="250px" />
                        <Checkbox isChecked={editingClosure?.full_day} onChange={e => setEditingClosure((ed: any) => ({ ...ed, full_day: e.target.checked }))}>Full Day</Checkbox>
                        {!editingClosure?.full_day && (
                          <HStack>
                            {editingClosure?.time_ranges.map((range: TimeRange, index: number) => (
                              <HStack key={index} spacing={1}>
                                <Input type="time" value={range.start} onChange={e => setEditingClosure((ed: any) => ({ ...ed, time_ranges: ed.time_ranges.map((r: TimeRange, i: number) => i === index ? { ...r, start: e.target.value } : r) }))} w="110px" />
                                <Text>to</Text>
                                <Input type="time" value={range.end} onChange={e => setEditingClosure((ed: any) => ({ ...ed, time_ranges: ed.time_ranges.map((r: TimeRange, i: number) => i === index ? { ...r, end: e.target.value } : r) }))} w="110px" />
                              </HStack>
                            ))}
                            <Button size="xs" colorScheme="blue" onClick={() => setEditingClosure((e: any) => ({ ...e, time_ranges: [...e.time_ranges, { start: '18:00', end: '23:00' }] }))}>+ Add Time Range</Button>
                          </HStack>
                        )}
                        <Button colorScheme="blue" onClick={handleSaveEditClosure}>Save</Button>
                        <Button colorScheme="gray" onClick={handleCancelEditClosure}>Cancel</Button>
                      </>
                    ) : (
                      <>
                        <Text>{closure.date && /^\d{4}-\d{2}-\d{2}$/.test(closure.date) ? (() => { const [y, m, d] = closure.date.split('-'); return `${Number(m)}/${Number(d)}/${y}`; })() : formatDate(new Date(closure.date), 'America/Chicago')}</Text>
                        <Text>{closure.full_day ? 'Full Day' : closure.time_ranges?.map(range => `${formatTime12h(range.start)} - ${formatTime12h(range.end)}`).join(', ')}</Text>
                        {closure.reason && <Badge colorScheme="red">{closure.reason}</Badge>}
                        {closure.sms_notification && <Badge colorScheme="blue">SMS: {closure.sms_notification}</Badge>}
                        <Button size="xs" colorScheme="blue" onClick={() => handleEditClosure(closure)}>Edit</Button>
                        <Button size="xs" colorScheme="red" onClick={() => deleteExceptionalClosure(closure.id)}>Delete</Button>
                      </>
                    )}
                  </Box>
                ))}
              </VStack>
              {error && <Text color="red.500">{error}</Text>}
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