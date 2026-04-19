import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  IconButton,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Grid,
  GridItem,
  Badge,
  Stat,
  StatLabel,
  StatNumber,
  StatGroup,
  SimpleGrid,
  useToast,
  Spinner,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  FormControl,
  FormLabel,
  Input,
  Textarea,
  Select,
  Checkbox,
  Link,
  Heading,
} from '@chakra-ui/react';
import { ChevronLeft, ChevronRight, Plus, Calendar, Settings, Download, X, Edit2 } from 'lucide-react';
import AdminLayout from '../../components/layouts/AdminLayout';
import PrivateEventsManager from '../../components/admin/PrivateEventsManager';
import { supabase, supabaseAdmin } from '../../lib/supabase';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, subMonths, isSameMonth, isSameDay, parseISO, isToday, startOfYear, endOfYear } from 'date-fns';
import { localInputToUTC } from '../../utils/dateUtils';
import { useSettings } from '../../context/SettingsContext';
import styles from '../../styles/EventCalendar.module.css';

interface PrivateEvent {
  id: string;
  name?: string; // Legacy field name
  title?: string; // Current field name
  start_time: string;
  end_time: string;
  description?: string;
  guest_count?: number;
  source?: 'minaka' | 'local';
  client_name?: string;
  client_email?: string;
  location?: string;
  minaka_url?: string;
  rsvp_enabled?: boolean;
  rsvp_url?: string;
  max_guests?: number;
  total_attendees_maximum?: number;
  background_image_url?: string;
  is_member_event?: boolean;
}

interface Reservation {
  id: string;
  start_time: string;
  end_time?: string;
  party_size?: number;
  phone?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  status?: string;
  membership_type?: string;
}

interface CustomDay {
  id: string;
  date: string;
  type: 'exceptional_open' | 'exceptional_closure';
}

interface DayData {
  date: Date;
  privateEvents: PrivateEvent[];
  reservations: Reservation[];
  isOpen: boolean;
  isCurrentMonth: boolean;
  covers: number;
  revenue: number;
}

export default function EventCalendarNew() {
  const { settings } = useSettings();
  const timezone = settings?.timezone || 'America/Chicago';
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarDays, setCalendarDays] = useState<DayData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<DayData | null>(null);
  const [isDayModalOpen, setIsDayModalOpen] = useState(false);
  const [isEditEventModalOpen, setIsEditEventModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<PrivateEvent | null>(null);
  const [mounted, setMounted] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [activeLocation, setActiveLocation] = useState<string | 'all'>('all');
  const [eventFormData, setEventFormData] = useState({
    title: '',
    start_time: '',
    end_time: '',
    description: '',
    guest_count: '',
    client_name: '',
    client_email: '',
    location: '',
    rsvp_enabled: false,
    max_guests: 10,
    total_attendees_maximum: 100,
    is_member_event: false,
  });
  const [monthStats, setMonthStats] = useState({
    totalReservations: 0,
    totalCovers: 0,
    totalRevenue: 0,
    privateEvents: 0,
  });

  const toast = useToast();

  // Fetch calendar data
  const fetchCalendarData = async () => {
    setLoading(true);
    try {
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);
      const calendarStart = startOfWeek(monthStart);
      const calendarEnd = endOfWeek(monthEnd);

      // Fetch private events via API (supports location filtering)
      const locationParam = activeLocation !== 'all' ? `&location=${activeLocation}` : '';
      let privateEvents: PrivateEvent[] = [];
      try {
        const privateEventsResponse = await fetch(
          `/api/private-events?startDate=${calendarStart.toISOString()}&endDate=${calendarEnd.toISOString()}${locationParam}`
        );
        if (privateEventsResponse.ok) {
          const privateEventsData = await privateEventsResponse.json();
          privateEvents = privateEventsData.data || [];
        }
      } catch (error) {
        console.error('Error fetching private events:', error);
      }

      // Fetch Minaka events
      let minakaEvents: PrivateEvent[] = [];
      try {
        const minakaLocationParam = activeLocation !== 'all' ? `?location=${activeLocation}` : '';
        const minakaResponse = await fetch(`/api/minaka-events${minakaLocationParam}`);
        if (minakaResponse.ok) {
          const minakaData = await minakaResponse.json();
          // Filter Minaka events to the calendar date range AND exclude Cocktail Lounge events
          minakaEvents = (minakaData.data || []).filter((e: PrivateEvent) => {
            const eventDate = parseISO(e.start_time);
            const isInDateRange = eventDate >= calendarStart && eventDate <= calendarEnd;
            // Exclude the exact "Noir Cocktail Lounge - Cocktail Lounge" event
            const isNotCocktailLounge = e.title !== 'Noir Cocktail Lounge - Cocktail Lounge';
            return isInDateRange && isNotCocktailLounge;
          }).map((e: PrivateEvent) => ({
            ...e,
            source: 'minaka' as const,
          }));
        }
      } catch (error) {
        console.error('Error fetching Minaka events:', error);
        // Don't fail the whole calendar if Minaka fetch fails
      }

      // Combine private events and Minaka events
      const allEvents = [
        ...(privateEvents || []).map((e: any) => ({ ...e, source: 'local' as const })),
        ...minakaEvents,
      ];

      // Fetch reservations - use start_time instead of reservation_date
      // Use admin client to bypass RLS for admin calendar view
      const client = supabaseAdmin || supabase;
      console.log('Fetching reservations for calendar:', {
        start: calendarStart.toISOString(),
        end: calendarEnd.toISOString(),
        usingAdmin: !!supabaseAdmin,
        location: activeLocation
      });

      // Build reservations query with location filtering
      let reservationsQuery = client
        .from('reservations')
        .select('*, tables(location_id), private_events(location_id)')
        .gte('start_time', calendarStart.toISOString())
        .lte('start_time', calendarEnd.toISOString());

      const { data: allReservations, error: reservationsError } = await reservationsQuery;

      // Filter reservations by location if not 'all'
      let reservations = allReservations;
      if (activeLocation !== 'all' && allReservations) {
        // Get location ID from slug
        const { data: locationData } = await supabase
          .from('locations')
          .select('id')
          .eq('slug', activeLocation)
          .single();

        if (locationData) {
          reservations = allReservations.filter((r: any) => {
            // Check if reservation is linked to a table at this location
            if (r.tables && r.tables.location_id === locationData.id) return true;
            // Or if it's a private event reservation at this location
            if (r.private_events && r.private_events.location_id === locationData.id) return true;
            return false;
          });
        }
      }

      if (reservationsError) {
        console.error('Error fetching reservations for calendar:', reservationsError);
      } else {
        console.log(`Fetched ${reservations?.length || 0} reservations for calendar (filtered by location: ${activeLocation})`);
        if (reservations && reservations.length > 0) {
          console.log('Sample reservation:', {
            id: reservations[0].id,
            start_time: reservations[0].start_time,
            phone: reservations[0].phone,
            party_size: reservations[0].party_size
          });
        }
      }

      // Fetch venue hours - filter by location if not 'all'
      let baseHoursQuery = supabase
        .from('venue_hours')
        .select('*')
        .eq('type', 'base');

      if (activeLocation !== 'all') {
        // Get location ID for filtering
        const { data: locationData } = await supabase
          .from('locations')
          .select('id')
          .eq('slug', activeLocation)
          .single();

        if (locationData) {
          baseHoursQuery = baseHoursQuery.eq('location_id', locationData.id);
        }
      }

      const { data: baseHours } = await baseHoursQuery;

      let customDaysQuery = supabase
        .from('venue_hours')
        .select('*')
        .in('type', ['exceptional_open', 'exceptional_closure'])
        .gte('date', format(calendarStart, 'yyyy-MM-dd'))
        .lte('date', format(calendarEnd, 'yyyy-MM-dd'));

      if (activeLocation !== 'all') {
        // Get location ID for filtering
        const { data: locationData } = await supabase
          .from('locations')
          .select('id')
          .eq('slug', activeLocation)
          .single();

        if (locationData) {
          customDaysQuery = customDaysQuery.eq('location_id', locationData.id);
        }
      }

      const { data: customDays } = await customDaysQuery;

      // Build calendar grid
      const days: DayData[] = [];
      let currentDay = calendarStart;
      let stats = {
        totalReservations: 0,
        totalCovers: 0,
        totalRevenue: 0,
        privateEvents: 0,
      };

      while (currentDay <= calendarEnd) {
        const dateStr = format(currentDay, 'yyyy-MM-dd');

        // Get day's events and reservations, sorted by start time
        const dayPrivateEvents = (allEvents?.filter(e =>
          format(parseISO(e.start_time), 'yyyy-MM-dd') === dateStr
        ) || []).sort((a, b) => 
          new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
        );

        const dayReservations = (reservations?.filter(r => {
          // Filter by start_time instead of reservation_date
          if (!r.start_time) return false;
          const resDate = parseISO(r.start_time);
          return format(resDate, 'yyyy-MM-dd') === dateStr;
        }) || []).sort((a, b) => {
          // Sort reservations by start_time
          const timeA = a.start_time ? new Date(a.start_time).getTime() : 0;
          const timeB = b.start_time ? new Date(b.start_time).getTime() : 0;
          return timeA - timeB;
        });

        // Calculate covers and revenue
        const covers = dayReservations.reduce((sum, r) => sum + (r.party_size || 0), 0);
        const revenue = covers * 75; // Placeholder - adjust based on your pricing

        // Check if day is open
        const dayOfWeek = format(currentDay, 'EEEE').toLowerCase();
        const baseHour = baseHours?.find(h => h.day_of_week === dayOfWeek);
        const customDay = customDays?.find(d => d.date === dateStr);

        // Default: check if there's a base hour set for this day of week
        let isOpen = baseHour ? baseHour.is_open : false;

        // Custom days override base hours
        if (customDay) {
          isOpen = customDay.type === 'exceptional_open';
        }

        // Private events block the day
        if (dayPrivateEvents.length > 0) {
          isOpen = false;
        }

        days.push({
          date: new Date(currentDay),
          privateEvents: dayPrivateEvents,
          reservations: dayReservations,
          isOpen,
          isCurrentMonth: isSameMonth(currentDay, currentDate),
          covers,
          revenue,
        });

        // Update stats for current month only
        if (isSameMonth(currentDay, currentDate)) {
          stats.totalReservations += dayReservations.length;
          stats.totalCovers += covers;
          stats.totalRevenue += revenue;
          stats.privateEvents += dayPrivateEvents.length;
        }

        currentDay = addDays(currentDay, 1);
      }

      setCalendarDays(days);
      setMonthStats(stats);
    } catch (error) {
      console.error('Error fetching calendar data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load calendar data',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setMounted(true);
    return () => {
      if (typeof document !== 'undefined') {
        document.body.style.overflow = '';
      }
    };
  }, []);

  // Handle escape key and body scroll lock for edit modal
  useEffect(() => {
    if (!isEditEventModalOpen) {
      if (typeof document !== 'undefined') {
        document.body.style.overflow = '';
      }
      return;
    }
    
    if (typeof document !== 'undefined') {
      document.body.style.overflow = 'hidden';
    }
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCloseEventModal();
      }
    };

    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('keydown', handleEscape);
      if (typeof document !== 'undefined') {
        document.body.style.overflow = '';
      }
    };
  }, [isEditEventModalOpen]);

  useEffect(() => {
    fetchCalendarData();
  }, [currentDate, activeLocation]);

  const handlePrevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const handleNextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const handleToday = () => setCurrentDate(new Date());

  const handleDayClick = (day: DayData) => {
    setSelectedDay(day);
    setIsDayModalOpen(true);
  };

  const handleEventClick = (event: PrivateEvent, e: React.MouseEvent) => {
    e.stopPropagation();

    // Don't allow editing Minaka events
    if (event.source === 'minaka') {
      toast({
        title: 'Cannot edit Minaka event',
        description: 'Minaka events can only be edited in Minaka.',
        status: 'info',
        duration: 3000,
      });
      return;
    }

    setEditingEvent(event);

    // Convert ISO datetime strings to datetime-local format
    const formatForInput = (isoString: string) => {
      if (!isoString) return '';
      const date = new Date(isoString);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    };

    setEventFormData({
      title: event.title || event.name || '',
      start_time: formatForInput(event.start_time),
      end_time: formatForInput(event.end_time),
      description: event.description || '',
      guest_count: event.guest_count?.toString() || '',
      client_name: event.client_name || '',
      client_email: event.client_email || '',
      location: event.location || '',
      rsvp_enabled: event.rsvp_enabled || false,
      max_guests: event.max_guests || 10,
      total_attendees_maximum: event.total_attendees_maximum || 100,
      is_member_event: event.is_member_event || false,
    });

    setIsEditEventModalOpen(true);
    setIsDayModalOpen(false);
  };

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();

    console.log('handleSaveEvent called', { editingEvent, eventFormData });

    if (!editingEvent) {
      console.error('No editing event');
      toast({
        title: 'Error',
        description: 'No event selected for editing',
        status: 'error',
        duration: 3000,
      });
      return;
    }

    try {
      // Validate required fields
      if (!eventFormData.title || !eventFormData.title.trim()) {
        toast({
          title: 'Error',
          description: 'Event name is required',
          status: 'error',
          duration: 3000,
        });
        return;
      }

      if (!eventFormData.start_time || !eventFormData.end_time) {
        toast({
          title: 'Error',
          description: 'Start time and end time are required',
          status: 'error',
          duration: 3000,
        });
        return;
      }

      // Convert datetime-local inputs to UTC ISO strings
      let startTimeUTC: string;
      let endTimeUTC: string;
      
      try {
        startTimeUTC = localInputToUTC(eventFormData.start_time, timezone);
        endTimeUTC = localInputToUTC(eventFormData.end_time, timezone);
        console.log('Converted times:', { startTimeUTC, endTimeUTC });
      } catch (conversionError) {
        console.error('Error converting times:', conversionError);
        toast({
          title: 'Error',
          description: `Invalid date/time format: ${conversionError instanceof Error ? conversionError.message : 'Unknown error'}`,
          status: 'error',
          duration: 5000,
        });
        return;
      }

      if (!startTimeUTC || !endTimeUTC) {
        toast({
          title: 'Error',
          description: 'Failed to convert date/time values',
          status: 'error',
          duration: 3000,
        });
        return;
      }

      // Generate RSVP URL if enabling RSVP and no URL exists yet
      let rsvp_url = editingEvent.rsvp_url;
      if (eventFormData.rsvp_enabled && !rsvp_url) {
        const { data: urlData, error: urlError } = await supabase
          .rpc('generate_rsvp_url');

        if (urlError) {
          console.error('Error generating RSVP URL:', urlError);
          toast({
            title: 'Error',
            description: 'Failed to generate RSVP URL',
            status: 'error',
            duration: 3000,
          });
          return;
        }
        rsvp_url = urlData;
      }

      const eventData = {
        title: eventFormData.title,
        start_time: startTimeUTC,
        end_time: endTimeUTC,
        event_description: eventFormData.description || null,
        rsvp_enabled: eventFormData.rsvp_enabled,
        rsvp_url: eventFormData.rsvp_enabled ? rsvp_url : null,
        max_guests: eventFormData.max_guests,
        total_attendees_maximum: eventFormData.total_attendees_maximum,
        is_member_event: eventFormData.is_member_event,
      };

      console.log('Updating event with data:', eventData);

      const { error, data } = await supabase
        .from('private_events')
        .update(eventData)
        .eq('id', editingEvent.id)
        .select();

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      console.log('Update successful:', data);

      // Upload image if one was selected
      if (imageFile) {
        const backgroundImageUrl = await uploadImage(editingEvent.id);
        if (backgroundImageUrl) {
          await supabase
            .from('private_events')
            .update({ background_image_url: backgroundImageUrl })
            .eq('id', editingEvent.id);
        }
      }

      toast({
        title: 'Success',
        description: 'Event updated successfully',
        status: 'success',
        duration: 3000,
      });

      setIsEditEventModalOpen(false);
      setEditingEvent(null);
      setImageFile(null);
      setImagePreview(null);
      fetchCalendarData();
    } catch (error) {
      console.error('Error updating event:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update event',
        status: 'error',
        duration: 5000,
      });
    }
  };

  const handleDeleteEvent = async () => {
    if (!editingEvent) return;
    if (!confirm('Are you sure you want to delete this event?')) return;

    try {
      const { error } = await supabase
        .from('private_events')
        .delete()
        .eq('id', editingEvent.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Event deleted successfully',
        status: 'success',
        duration: 3000,
      });

      setIsEditEventModalOpen(false);
      setEditingEvent(null);
      fetchCalendarData();
    } catch (error) {
      console.error('Error deleting event:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete event',
        status: 'error',
        duration: 3000,
      });
    }
  };

  const uploadImage = async (eventId: string): Promise<string | null> => {
    if (!imageFile) return null;

    try {
      const fileExt = imageFile.name.split('.').pop();
      const fileName = `${eventId}-${Date.now()}.${fileExt}`;
      const filePath = `private-events/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('uploads')
        .upload(filePath, imageFile);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('uploads')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      console.error('Error uploading image:', error);
      toast({
        title: 'Error',
        description: 'Failed to upload image',
        status: 'error',
        duration: 3000,
      });
      return null;
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCloseEventModal = () => {
    setIsEditEventModalOpen(false);
    setEditingEvent(null);
    setImageFile(null);
    setImagePreview(null);
    setEventFormData({
      title: '',
      start_time: '',
      end_time: '',
      description: '',
      guest_count: '',
      client_name: '',
      client_email: '',
      location: '',
      rsvp_enabled: false,
      max_guests: 10,
      total_attendees_maximum: 100,
      is_member_event: false,
    });
  };

  const getDayColor = (day: DayData) => {
    if (!day.isCurrentMonth) return '#FAFAFA';
    return '#FFFFFF';
  };

  const handleExportForMembers = () => {
    const monthName = format(currentDate, 'MMMM yyyy');
    let exportText = `Noir KC - Available Dates for ${monthName}\n\n`;
    exportText += `This calendar shows when Noir is available for member reservations.\n\n`;

    // Filter to only available days (open, no private events)
    const availableDays = calendarDays.filter(
      day => day.isCurrentMonth && day.isOpen && day.privateEvents.length === 0
    );

    if (availableDays.length === 0) {
      toast({
        title: 'No available dates',
        description: 'There are no available dates for members this month.',
        status: 'warning',
        duration: 5000,
      });
      return;
    }

    exportText += `Available Dates:\n`;
    availableDays.forEach(day => {
      exportText += `• ${format(day.date, 'EEEE, MMMM d, yyyy')}\n`;
    });

    exportText += `\n\nTo make a reservation, please visit the Noir member portal.\n`;

    // Create and download text file
    const blob = new Blob([exportText], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `noir-available-dates-${format(currentDate, 'yyyy-MM')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    toast({
      title: 'Export successful',
      description: `Exported ${availableDays.length} available dates for members.`,
      status: 'success',
      duration: 5000,
    });
  };

  const [activeTab, setActiveTab] = useState(0);

  return (
    <AdminLayout>
      <div className={styles.container}>
        {/* Header */}
        <div className={styles.header}>
          <h1 className={styles.title}>Event Calendar</h1>
          <button className={styles.exportButton} onClick={handleExportForMembers}>
            <Download style={{ width: '16px', height: '16px' }} />
            Export for Members
          </button>
        </div>

        {/* Location Switcher */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', justifyContent: 'center' }}>
          <button
            onClick={() => setActiveLocation('all')}
            style={{
              padding: '0.5rem 1.5rem',
              borderRadius: '8px',
              border: '1px solid #D1D5DB',
              backgroundColor: activeLocation === 'all' ? '#A59480' : 'white',
              color: activeLocation === 'all' ? 'white' : '#1F1F1F',
              fontWeight: '600',
              cursor: 'pointer',
            }}
          >
            All Locations
          </button>
          <button
            onClick={() => setActiveLocation('noirkc')}
            style={{
              padding: '0.5rem 1.5rem',
              borderRadius: '8px',
              border: '1px solid #D1D5DB',
              backgroundColor: activeLocation === 'noirkc' ? '#A59480' : 'white',
              color: activeLocation === 'noirkc' ? 'white' : '#1F1F1F',
              fontWeight: '600',
              cursor: 'pointer',
            }}
          >
            Noir KC
          </button>
          <button
            onClick={() => setActiveLocation('rooftopkc')}
            style={{
              padding: '0.5rem 1.5rem',
              borderRadius: '8px',
              border: '1px solid #D1D5DB',
              backgroundColor: activeLocation === 'rooftopkc' ? '#A59480' : 'white',
              color: activeLocation === 'rooftopkc' ? 'white' : '#1F1F1F',
              fontWeight: '600',
              cursor: 'pointer',
            }}
          >
            RooftopKC
          </button>
        </div>

        {/* Month Stats */}
        <div className={styles.statsCard}>
          <div className={styles.statsGrid}>
            <div className={styles.statItem}>
              <div className={styles.statLabel}>Total Reservations</div>
              <div className={styles.statValue}>{monthStats.totalReservations}</div>
            </div>
            <div className={styles.statItem}>
              <div className={styles.statLabel}>Total Covers</div>
              <div className={styles.statValue}>{monthStats.totalCovers}</div>
            </div>
            <div className={styles.statItem}>
              <div className={styles.statLabel}>Revenue</div>
              <div className={styles.statValue}>${monthStats.totalRevenue.toLocaleString()}</div>
            </div>
            <div className={styles.statItem}>
              <div className={styles.statLabel}>Private Events</div>
              <div className={styles.statValue}>{monthStats.privateEvents}</div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className={styles.tabsContainer}>
          <div className={styles.tabList}>
            <button
              className={`${styles.tab} ${activeTab === 0 ? styles.tabActive : ''}`}
              onClick={() => setActiveTab(0)}
            >
              📅 Calendar
            </button>
            <button
              className={`${styles.tab} ${activeTab === 1 ? styles.tabActive : ''}`}
              onClick={() => setActiveTab(1)}
            >
              🎉 Private Events
            </button>
            <button
              className={`${styles.tab} ${activeTab === 2 ? styles.tabActive : ''}`}
              onClick={() => setActiveTab(2)}
            >
              📊 Analytics
            </button>
            <button
              className={`${styles.tab} ${activeTab === 3 ? styles.tabActive : ''}`}
              onClick={() => setActiveTab(3)}
            >
              📅 Custom Dates
            </button>
          </div>

          {activeTab === 0 && (
            <div>
              {/* Month Navigation */}
              <div className={styles.monthNav}>
                <button className={styles.iconButton} onClick={handlePrevMonth} aria-label="Previous month">
                  <ChevronLeft style={{ width: '20px', height: '20px' }} />
                </button>
                <div className={styles.monthTitle}>{format(currentDate, 'MMMM yyyy')}</div>
                <div className={styles.navButtons}>
                  <button className={styles.navButton} onClick={handleToday}>
                    Today
                  </button>
                  <button className={styles.iconButton} onClick={handleNextMonth} aria-label="Next month">
                    <ChevronRight style={{ width: '20px', height: '20px' }} />
                  </button>
                </div>
              </div>

              {/* Calendar Grid */}
              <div className={styles.calendarContainer}>
                {loading ? (
                  <div className={styles.loadingState}>
                    <Spinner size="xl" color="blue.500" />
                    <div className={styles.loadingText}>Loading calendar...</div>
                  </div>
                ) : (
                  <div className={styles.calendarGrid}>
                    {/* Day headers */}
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, idx) => (
                      <div key={idx} className={styles.dayHeader}>
                        {day}
                      </div>
                    ))}

                    {/* Calendar days */}
                    {calendarDays.map((day, index) => (
                      <div
                        key={index}
                        className={`${styles.dayCell} ${!day.isCurrentMonth ? styles.dayCellOtherMonth : ''}`}
                        onClick={() => handleDayClick(day)}
                      >
                        <div className={`${styles.dayNumber} ${!day.isCurrentMonth ? styles.dayNumberOtherMonth : ''} ${isToday(day.date) ? styles.dayNumberToday : ''}`}>
                          {format(day.date, 'd')}
                        </div>

                        {/* Events */}
                        <div className={styles.eventsContainer}>
                          {/* Private Events */}
                          {day.privateEvents.slice(0, 3).map((event, idx) => {
                            const startTime = format(parseISO(event.start_time), 'h:mm a');
                            const endTime = format(parseISO(event.end_time), 'h:mm a');
                            const eventName = event.title || event.name || 'Untitled Event';
                            const isMinaka = event.source === 'minaka';
                            return (
                              <div
                                key={`event-${event.id}-${idx}`}
                                className={`${styles.eventItem} ${styles.eventPrivate} ${isMinaka ? styles.eventMinaka : ''}`}
                                title={`${eventName} - ${startTime} - ${endTime}${isMinaka ? ' (Minaka)' : ''}`}
                              >
                                <div className={styles.eventNameText}>
                                  {eventName}
                                  {isMinaka && <span style={{ fontSize: '0.7em', opacity: 0.8, marginLeft: '4px' }}>📅</span>}
                                </div>
                                <div className={styles.eventTimeText}>{startTime} - {endTime}</div>
                              </div>
                            );
                          })}

                          {/* Reservations - Show individual times if 3 or fewer, otherwise summary */}
                          {day.reservations.length > 0 && (
                            <>
                              {day.reservations.length <= 3 ? (
                                day.reservations.map((res, idx) => {
                                  // Format time from start_time
                                  const resTime = res.start_time 
                                    ? format(parseISO(res.start_time), 'h:mm a')
                                    : 'Time TBD';
                                  return (
                                    <div
                                      key={`res-${res.id || idx}`}
                                      className={`${styles.eventItem} ${styles.eventReservation}`}
                                      title={`${resTime} - Party of ${res.party_size || 0}`}
                                    >
                                      <div className={styles.eventNameText}>{resTime}</div>
                                      <div className={styles.eventTimeText}>Party of {res.party_size || 0}</div>
                                    </div>
                                  );
                                })
                              ) : (
                                <div
                                  className={`${styles.eventItem} ${styles.eventReservation}`}
                                  title={`${day.reservations.length} reservation${day.reservations.length > 1 ? 's' : ''} - ${day.covers} covers`}
                                >
                                  <div className={styles.eventNameText}>{day.reservations.length} reservations</div>
                                  <div className={styles.eventTimeText}>{day.covers} covers</div>
                                </div>
                              )}
                            </>
                          )}

                          {/* More events indicator */}
                          {(day.privateEvents.length > 3) && (
                            <div className={styles.moreIndicator}>
                              +{day.privateEvents.length - 3} more event{day.privateEvents.length - 3 > 1 ? 's' : ''}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 1 && (
            <PrivateEventsManager onEventChange={fetchCalendarData} />
          )}

          {activeTab === 2 && (
            <AnalyticsView currentDate={currentDate} />
          )}

          {activeTab === 3 && (
            <CustomDaysManager onDaysChange={fetchCalendarData} activeLocation={activeLocation} />
          )}
        </div>

        {/* Day Details Modal - Custom Portal */}
        {mounted && isDayModalOpen && typeof document !== 'undefined' && createPortal(
          <Box
            position="fixed"
            top="0"
            left="0"
            width="100vw"
            height="100vh"
            zIndex={99999999}
            display="flex"
            alignItems="center"
            justifyContent="center"
            pointerEvents="none"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setIsDayModalOpen(false);
              }
            }}
          >
            {/* Overlay */}
            <Box
              position="fixed"
              top="0"
              left="0"
              width="100vw"
              height="100vh"
              bg="blackAlpha.700"
              zIndex={99999998}
              pointerEvents="auto"
              onClick={() => setIsDayModalOpen(false)}
              cursor="pointer"
            />
            
            {/* Modal Content */}
            <Box
              position="relative"
              zIndex={99999999}
              pointerEvents="auto"
              maxW="500px"
              w="90vw"
              maxH="85vh"
              bg="white"
              borderRadius="16px"
              boxShadow="xl"
              fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif"
              overflowY="auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <Box
                borderBottomWidth="1px"
                borderColor="gray.200"
                p={3}
                pb={2}
                pt={3}
                fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif"
                position="relative"
              >
                <Text fontSize="md" fontWeight="600" color="#1A1A1A">
                  {selectedDay && format(selectedDay.date, 'EEEE, MMMM d, yyyy')}
                </Text>
                <Button
                  position="absolute"
                  top={1}
                  right={1}
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsDayModalOpen(false)}
                  aria-label="Close"
                >
                  ×
                </Button>
              </Box>

              {/* Body */}
              <Box p={3}>
                {selectedDay && (
                  <VStack spacing={3} align="stretch">
                    {/* Day Stats - Compact */}
                    <SimpleGrid columns={3} spacing={2} pb={3} borderBottomWidth="1px" borderColor="gray.200">
                      <Box>
                        <Text fontSize="xs" color="gray.600" mb={0.5}>Covers</Text>
                        <Text fontSize="lg" fontWeight="600">{selectedDay.covers}</Text>
                      </Box>
                      <Box>
                        <Text fontSize="xs" color="gray.600" mb={0.5}>Revenue</Text>
                        <Text fontSize="lg" fontWeight="600">${selectedDay.revenue.toLocaleString()}</Text>
                      </Box>
                      <Box>
                        <Text fontSize="xs" color="gray.600" mb={0.5}>Status</Text>
                        <Badge colorScheme={selectedDay.isOpen ? 'green' : 'red'} fontSize="xs">
                          {selectedDay.isOpen ? 'Open' : 'Closed'}
                        </Badge>
                      </Box>
                    </SimpleGrid>

                    {/* Events List */}
                    <VStack spacing={2} align="stretch">
                      {/* Private Events */}
                      {selectedDay.privateEvents.length > 0 && (
                        <Box>
                          <Text fontSize="sm" fontWeight="600" color="#1A1A1A" mb={2}>
                            Private Events
                          </Text>
                          <VStack spacing={1.5} align="stretch">
                            {selectedDay.privateEvents.map(event => {
                              const eventName = event.title || event.name || 'Untitled Event';
                              const isMinaka = event.source === 'minaka';
                              return (
                                <Box
                                  key={event.id}
                                  bg={isMinaka ? "#F3E5F5" : "#E3F2FD"}
                                  p={2}
                                  borderRadius="8px"
                                  borderWidth="1px"
                                  borderColor={isMinaka ? "#7B1FA2" : "#1E88E5"}
                                  cursor="pointer"
                                  onClick={(e) => handleEventClick(event, e)}
                                >
                                  <HStack justify="space-between" mb={1}>
                                    <Text fontSize="sm" fontWeight="600" color="#1A1A1A">
                                      {eventName}
                                    </Text>
                                    {isMinaka && <Badge colorScheme="blue" fontSize="2xs">Minaka</Badge>}
                                  </HStack>
                                  <VStack spacing={0.5} align="start">
                                    <Text fontSize="xs" color="gray.600">
                                      {format(parseISO(event.start_time), 'h:mm a')} - {format(parseISO(event.end_time), 'h:mm a')}
                                    </Text>
                                    {event.guest_count && (
                                      <Text fontSize="xs" color="gray.600">Guests: {event.guest_count}</Text>
                                    )}
                                    {event.client_name && (
                                      <Text fontSize="xs" color="gray.600">Client: {event.client_name}</Text>
                                    )}
                                    {event.client_email && (
                                      <Text fontSize="xs" color="gray.600">Email: {event.client_email}</Text>
                                    )}
                                    {event.location && (
                                      <Text fontSize="xs" color="gray.600">Location: {event.location}</Text>
                                    )}
                                    {event.minaka_url && (
                                      <Text fontSize="xs">
                                        <a href={event.minaka_url} target="_blank" rel="noopener noreferrer" style={{ color: '#3182CE', textDecoration: 'underline' }}>
                                          View in Minaka
                                        </a>
                                      </Text>
                                    )}
                                  </VStack>
                                </Box>
                              );
                            })}
                          </VStack>
                        </Box>
                      )}

                      {/* Reservations */}
                      {selectedDay.reservations.length > 0 && (
                        <Box>
                          <Text fontSize="sm" fontWeight="600" color="#1A1A1A" mb={2}>
                            Reservations ({selectedDay.reservations.length})
                          </Text>
                          <VStack spacing={1.5} align="stretch">
                            {selectedDay.reservations.map(res => {
                              const resTime = res.start_time 
                                ? format(parseISO(res.start_time), 'h:mm a')
                                : 'Time TBD';
                              return (
                                <Box
                                  key={res.id}
                                  bg="#E8F5E9"
                                  p={2}
                                  borderRadius="8px"
                                  borderWidth="1px"
                                  borderColor="#43A047"
                                >
                                  <Text fontSize="sm" fontWeight="600" color="#1A1A1A" mb={1}>
                                    {resTime}
                                  </Text>
                                  <VStack spacing={0.5} align="start">
                                    <Text fontSize="xs" color="gray.600">Party of {res.party_size || 0}</Text>
                                    {res.first_name && (
                                      <Text fontSize="xs" color="gray.600">{res.first_name} {res.last_name || ''}</Text>
                                    )}
                                    {res.phone && (
                                      <Text fontSize="xs" color="gray.600">{res.phone}</Text>
                                    )}
                                  </VStack>
                                </Box>
                              );
                            })}
                          </VStack>
                        </Box>
                      )}

                      {selectedDay.privateEvents.length === 0 && selectedDay.reservations.length === 0 && (
                        <Text textAlign="center" py={4} color="gray.500" fontSize="sm">
                          No events or reservations for this day
                        </Text>
                      )}
                    </VStack>
                  </VStack>
                )}
              </Box>
            </Box>
          </Box>,
          document.body
        )}

        {/* Edit Event Modal - Custom Portal */}
        {mounted && isEditEventModalOpen && typeof document !== 'undefined' && createPortal(
          <Box
            position="fixed"
            top="0"
            left="0"
            width="100vw"
            height="100vh"
            zIndex={99999999}
            display="flex"
            alignItems="center"
            justifyContent="center"
            pointerEvents="none"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                handleCloseEventModal();
              }
            }}
          >
            {/* Overlay */}
            <Box
              position="fixed"
              top="0"
              left="0"
              width="100vw"
              height="100vh"
              bg="blackAlpha.700"
              zIndex={99999998}
              pointerEvents="auto"
              onClick={handleCloseEventModal}
              cursor="pointer"
            />
            
            {/* Modal Content */}
            <Box
              position="relative"
              zIndex={99999999}
              pointerEvents="auto"
              maxW="500px"
              w="90vw"
              maxH="90vh"
              bg="white"
              borderRadius="16px"
              boxShadow="xl"
              fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif"
              overflowY="auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <Box
                borderBottomWidth="1px"
                borderColor="gray.200"
                p={4}
                pb={3}
                pt={4}
                fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif"
                position="relative"
              >
                <Text fontSize="lg" fontWeight="bold" color="#1A1A1A">
                  Edit Event
                </Text>
                <Button
                  position="absolute"
                  top={2}
                  right={2}
                  variant="ghost"
                  size="sm"
                  onClick={handleCloseEventModal}
                  aria-label="Close"
                >
                  ×
                </Button>
              </Box>

              {/* Body */}
              <Box p={4}>
                <form onSubmit={handleSaveEvent} noValidate>
                  <VStack spacing={3}>
                    <FormControl isRequired>
                      <FormLabel fontSize="sm" mb={1}>Event Name</FormLabel>
                      <Input
                        size="sm"
                        value={eventFormData.title}
                        onChange={(e) => setEventFormData({ ...eventFormData, title: e.target.value })}
                        placeholder="e.g., Holiday Party"
                      />
                    </FormControl>

                    <FormControl isRequired>
                      <FormLabel fontSize="sm" mb={1}>Start Time</FormLabel>
                      <Input
                        size="sm"
                        type="datetime-local"
                        value={eventFormData.start_time}
                        onChange={(e) => setEventFormData({ ...eventFormData, start_time: e.target.value })}
                      />
                    </FormControl>

                    <FormControl isRequired>
                      <FormLabel fontSize="sm" mb={1}>End Time</FormLabel>
                      <Input
                        size="sm"
                        type="datetime-local"
                        value={eventFormData.end_time}
                        onChange={(e) => setEventFormData({ ...eventFormData, end_time: e.target.value })}
                      />
                    </FormControl>

                    <FormControl>
                      <FormLabel fontSize="sm" mb={1}>Guest Count</FormLabel>
                      <Input
                        size="sm"
                        type="number"
                        value={eventFormData.guest_count}
                        onChange={(e) => setEventFormData({ ...eventFormData, guest_count: e.target.value })}
                        placeholder="Number of guests"
                      />
                    </FormControl>

                    <FormControl>
                      <FormLabel fontSize="sm" mb={1}>Event Background Image (Optional)</FormLabel>
                      <Input
                        size="sm"
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                      />
                      {imagePreview && (
                        <Box mt={2}>
                          <img src={imagePreview} alt="Preview" style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: '8px' }} />
                        </Box>
                      )}
                      {!imagePreview && editingEvent?.background_image_url && (
                        <Box mt={2}>
                          <Text fontSize="xs" color="gray.600">Current image:</Text>
                          <img src={editingEvent.background_image_url} alt="Current" style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: '8px' }} />
                        </Box>
                      )}
                      <Text fontSize="xs" color="gray.600" mt={1}>
                        If no image is uploaded, the main landing page hero image will be used as fallback
                      </Text>
                    </FormControl>

                    {eventFormData.rsvp_enabled && (
                      <>
                        <FormControl>
                          <FormLabel fontSize="sm" mb={1}>Max Guests Per Reservation</FormLabel>
                          <Input
                            size="sm"
                            type="number"
                            value={eventFormData.max_guests}
                            onChange={(e) => setEventFormData({ ...eventFormData, max_guests: parseInt(e.target.value) || 10 })}
                            placeholder="Maximum guests per RSVP"
                            min={1}
                          />
                          <Text fontSize="xs" color="gray.600" mt={1}>
                            Maximum party size for each individual RSVP
                          </Text>
                        </FormControl>

                        <FormControl>
                          <FormLabel fontSize="sm" mb={1}>Total Event Capacity</FormLabel>
                          <Input
                            size="sm"
                            type="number"
                            value={eventFormData.total_attendees_maximum}
                            onChange={(e) => setEventFormData({ ...eventFormData, total_attendees_maximum: parseInt(e.target.value) || 100 })}
                            placeholder="Total attendees maximum"
                            min={1}
                          />
                          <Text fontSize="xs" color="gray.600" mt={1}>
                            Maximum total guests for the entire event
                          </Text>
                        </FormControl>
                      </>
                    )}

                    <FormControl>
                      <FormLabel fontSize="sm" mb={1}>Client Name</FormLabel>
                      <Input
                        size="sm"
                        value={eventFormData.client_name}
                        onChange={(e) => setEventFormData({ ...eventFormData, client_name: e.target.value })}
                        placeholder="Client name"
                      />
                    </FormControl>

                    <FormControl>
                      <FormLabel fontSize="sm" mb={1}>Client Email</FormLabel>
                      <Input
                        size="sm"
                        type="email"
                        value={eventFormData.client_email}
                        onChange={(e) => setEventFormData({ ...eventFormData, client_email: e.target.value })}
                        placeholder="client@example.com"
                      />
                    </FormControl>

                    <FormControl>
                      <FormLabel fontSize="sm" mb={1}>Location</FormLabel>
                      <Input
                        size="sm"
                        value={eventFormData.location}
                        onChange={(e) => setEventFormData({ ...eventFormData, location: e.target.value })}
                        placeholder="Event location"
                      />
                    </FormControl>

                    <FormControl>
                      <FormLabel fontSize="sm" mb={1}>Description</FormLabel>
                      <Textarea
                        size="sm"
                        value={eventFormData.description}
                        onChange={(e) => setEventFormData({ ...eventFormData, description: e.target.value })}
                        placeholder="Event details..."
                        rows={3}
                      />
                    </FormControl>

                    <FormControl>
                      <Checkbox
                        isChecked={eventFormData.is_member_event}
                        onChange={(e) => setEventFormData({ ...eventFormData, is_member_event: e.target.checked })}
                        size="sm"
                      >
                        Show in Member Portal Calendar
                      </Checkbox>
                      <Text fontSize="xs" color="gray.600" mt={1}>
                        When enabled, NOAA members will see this event in their calendar tab
                      </Text>
                    </FormControl>

                    <FormControl>
                      <Checkbox
                        isChecked={eventFormData.rsvp_enabled}
                        onChange={(e) => setEventFormData({ ...eventFormData, rsvp_enabled: e.target.checked })}
                        size="sm"
                      >
                        Enable RSVP
                      </Checkbox>
                      {eventFormData.rsvp_enabled && editingEvent?.rsvp_url && (
                        <Box mt={2} p={2} bg="blue.50" borderRadius="md" borderWidth="1px" borderColor="blue.200">
                          <Text fontSize="xs" color="gray.600" mb={1}>RSVP Link:</Text>
                          <HStack spacing={2}>
                            <Text
                              fontSize="sm"
                              color="blue.600"
                              fontWeight="medium"
                              wordBreak="break-all"
                            >
                              /rsvp/{editingEvent.rsvp_url}
                            </Text>
                            <Button
                              size="xs"
                              colorScheme="blue"
                              onClick={() => {
                                const url = `${window.location.origin}/rsvp/${editingEvent.rsvp_url}`;
                                navigator.clipboard.writeText(url);
                                toast({
                                  title: 'Copied!',
                                  description: 'RSVP link copied to clipboard',
                                  status: 'success',
                                  duration: 2000,
                                });
                              }}
                            >
                              Copy
                            </Button>
                          </HStack>
                        </Box>
                      )}
                      {eventFormData.rsvp_enabled && !editingEvent?.rsvp_url && (
                        <Text fontSize="xs" color="gray.600" mt={2}>
                          RSVP link will be generated when you update the event
                        </Text>
                      )}
                    </FormControl>

                    <HStack w="full" justify="space-between" pt={2}>
                      <Button
                        size="sm"
                        colorScheme="red"
                        variant="outline"
                        onClick={handleDeleteEvent}
                      >
                        Delete
                      </Button>
                      <HStack spacing={2}>
                        <Button 
                          size="sm"
                          type="button"
                          onClick={handleCloseEventModal}
                        >
                          Cancel
                        </Button>
                        <Button 
                          size="sm"
                          type="submit" 
                          colorScheme="blue"
                        >
                          Update
                        </Button>
                      </HStack>
                    </HStack>
                  </VStack>
                </form>
              </Box>
            </Box>
          </Box>,
          document.body
        )}
      </div>
    </AdminLayout>
  );
}


// Analytics View Component
function AnalyticsView({ currentDate }: { currentDate: Date }) {
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<'week' | 'month' | 'year'>('month');
  const [analyticsData, setAnalyticsData] = useState<{
    daily: Array<{
      date: string;
      covers: number;
      revenue: number;
      reservations: number;
    }>;
    totals: {
      covers: number;
      revenue: number;
      reservations: number;
      avgCoversPerDay: number;
      avgRevenuePerDay: number;
    };
  }>({
    daily: [],
    totals: {
      covers: 0,
      revenue: 0,
      reservations: 0,
      avgCoversPerDay: 0,
      avgRevenuePerDay: 0,
    },
  });

  useEffect(() => {
    fetchAnalytics();
  }, [currentDate, dateRange]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      let startDate: Date;
      let endDate: Date;

      if (dateRange === 'week') {
        startDate = startOfWeek(currentDate);
        endDate = endOfWeek(currentDate);
      } else if (dateRange === 'month') {
        startDate = startOfMonth(currentDate);
        endDate = endOfMonth(currentDate);
      } else {
        startDate = startOfYear(currentDate);
        endDate = endOfYear(currentDate);
      }

      // Filter to only past dates
      const today = new Date();
      if (endDate > today) {
        endDate = today;
      }

      const { data: reservations } = await supabase
        .from('reservations')
        .select('*')
        .gte('start_time', startDate.toISOString())
        .lte('start_time', endDate.toISOString())
        .order('start_time');

      // Group by date
      const dailyMap = new Map<string, { covers: number; revenue: number; reservations: number }>();

      reservations?.forEach((res: any) => {
        // Extract date from start_time instead of reservation_date
        const dateKey = format(parseISO(res.start_time), 'yyyy-MM-dd');
        const existing = dailyMap.get(dateKey) || { covers: 0, revenue: 0, reservations: 0 };
        dailyMap.set(dateKey, {
          covers: existing.covers + (res.party_size || 0),
          revenue: existing.revenue + (res.revenue || 0),
          reservations: existing.reservations + 1,
        });
      });

      const daily = Array.from(dailyMap.entries()).map(([date, data]) => ({
        date,
        ...data,
      }));

      const totals = daily.reduce(
        (acc, day) => ({
          covers: acc.covers + day.covers,
          revenue: acc.revenue + day.revenue,
          reservations: acc.reservations + day.reservations,
          avgCoversPerDay: 0,
          avgRevenuePerDay: 0,
        }),
        { covers: 0, revenue: 0, reservations: 0, avgCoversPerDay: 0, avgRevenuePerDay: 0 }
      );

      const daysWithData = daily.length || 1;
      totals.avgCoversPerDay = totals.covers / daysWithData;
      totals.avgRevenuePerDay = totals.revenue / daysWithData;

      setAnalyticsData({ daily, totals });
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box bg="white" p={6} borderRadius="xl" shadow="sm" minH="400px" display="flex" alignItems="center" justifyContent="center">
        <Spinner size="xl" color="blue.500" />
      </Box>
    );
  }

  return (
    <VStack spacing={4} align="stretch">
      {/* Header */}
      <HStack justify="space-between" align="center" bg="white" p={6} borderRadius="xl" shadow="sm">
        <Text fontSize="xl" fontWeight="bold">Revenue & Analytics</Text>
        <HStack spacing={2}>
          <Button
            size="sm"
            colorScheme={dateRange === 'week' ? 'blue' : 'gray'}
            onClick={() => setDateRange('week')}
          >
            Week
          </Button>
          <Button
            size="sm"
            colorScheme={dateRange === 'month' ? 'blue' : 'gray'}
            onClick={() => setDateRange('month')}
          >
            Month
          </Button>
          <Button
            size="sm"
            colorScheme={dateRange === 'year' ? 'blue' : 'gray'}
            onClick={() => setDateRange('year')}
          >
            Year
          </Button>
        </HStack>
      </HStack>

      {/* Summary Stats */}
      <Box bg="white" p={6} borderRadius="xl" shadow="sm">
        <Text fontSize="lg" fontWeight="semibold" mb={4}>Summary</Text>
        <SimpleGrid columns={{ base: 2, md: 5 }} spacing={4}>
          <Box>
            <Text fontSize="sm" color="gray.600">Total Reservations</Text>
            <Text fontSize="2xl" fontWeight="bold" color="blue.600">
              {analyticsData.totals.reservations}
            </Text>
          </Box>
          <Box>
            <Text fontSize="sm" color="gray.600">Total Covers</Text>
            <Text fontSize="2xl" fontWeight="bold" color="green.600">
              {analyticsData.totals.covers}
            </Text>
          </Box>
          <Box>
            <Text fontSize="sm" color="gray.600">Total Revenue</Text>
            <Text fontSize="2xl" fontWeight="bold" color="purple.600">
              ${analyticsData.totals.revenue.toFixed(2)}
            </Text>
          </Box>
          <Box>
            <Text fontSize="sm" color="gray.600">Avg Covers/Day</Text>
            <Text fontSize="2xl" fontWeight="bold" color="teal.600">
              {analyticsData.totals.avgCoversPerDay.toFixed(1)}
            </Text>
          </Box>
          <Box>
            <Text fontSize="sm" color="gray.600">Avg Revenue/Day</Text>
            <Text fontSize="2xl" fontWeight="bold" color="orange.600">
              ${analyticsData.totals.avgRevenuePerDay.toFixed(2)}
            </Text>
          </Box>
        </SimpleGrid>
      </Box>

      {/* Daily Breakdown Table */}
      <Box bg="white" p={6} borderRadius="xl" shadow="sm">
        <Text fontSize="lg" fontWeight="semibold" mb={4}>Daily Breakdown</Text>
        {analyticsData.daily.length === 0 ? (
          <Text color="gray.500" textAlign="center" py={8}>
            No reservation data available for this period
          </Text>
        ) : (
          <Box overflowX="auto">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #E2E8F0' }}>
                  <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600, color: '#4A5568' }}>Date</th>
                  <th style={{ padding: '12px', textAlign: 'right', fontWeight: 600, color: '#4A5568' }}>Reservations</th>
                  <th style={{ padding: '12px', textAlign: 'right', fontWeight: 600, color: '#4A5568' }}>Covers</th>
                  <th style={{ padding: '12px', textAlign: 'right', fontWeight: 600, color: '#4A5568' }}>Revenue</th>
                </tr>
              </thead>
              <tbody>
                {analyticsData.daily.map((day) => (
                  <tr key={day.date} style={{ borderBottom: '1px solid #E2E8F0' }}>
                    <td style={{ padding: '12px', color: '#2D3748' }}>
                      {format(new Date(day.date), 'EEE, MMM d, yyyy')}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right', color: '#2D3748' }}>
                      {day.reservations}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right', color: '#2D3748' }}>
                      {day.covers}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right', fontWeight: 600, color: '#2D3748' }}>
                      ${day.revenue.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Box>
        )}
      </Box>
    </VStack>
  );
}

// Custom Days Manager Component
function CustomDaysManager({ onDaysChange, activeLocation }: { onDaysChange: () => void; activeLocation: string | 'all' }) {
  const [customOpenDays, setCustomOpenDays] = useState<any[]>([]);
  const [customClosedDays, setCustomClosedDays] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddOpenModalOpen, setIsAddOpenModalOpen] = useState(false);
  const [isAddClosedModalOpen, setIsAddClosedModalOpen] = useState(false);
  const [newOpenDate, setNewOpenDate] = useState('');
  const [newClosedDate, setNewClosedDate] = useState('');
  const toast = useToast();

  useEffect(() => {
    fetchCustomDays();
  }, [activeLocation]);

  const fetchCustomDays = async () => {
    setLoading(true);
    try {
      if (activeLocation === 'all') {
        // Show message that user needs to select a specific location
        setCustomOpenDays([]);
        setCustomClosedDays([]);
        setLoading(false);
        return;
      }

      // Get location ID from slug
      const { data: locationData, error: locationError } = await supabase
        .from('locations')
        .select('id')
        .eq('slug', activeLocation)
        .single();

      if (locationError || !locationData) {
        console.error('Error fetching location:', locationError);
        setLoading(false);
        return;
      }

      // Fetch exceptional open days
      const { data: openDays, error: openError } = await supabase
        .from('venue_hours')
        .select('*')
        .eq('type', 'exceptional_open')
        .eq('location_id', locationData.id)
        .order('date', { ascending: true });

      if (openError) {
        console.error('Error fetching open days:', openError);
      }

      // Fetch exceptional closure days
      const { data: closedDays, error: closedError } = await supabase
        .from('venue_hours')
        .select('*')
        .eq('type', 'exceptional_closure')
        .eq('location_id', locationData.id)
        .order('date', { ascending: true });

      if (closedError) {
        console.error('Error fetching closed days:', closedError);
      }

      setCustomOpenDays(openDays || []);
      setCustomClosedDays(closedDays || []);
    } catch (error) {
      console.error('Error fetching custom days:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddOpenDay = async () => {
    if (!newOpenDate || activeLocation === 'all') return;

    try {
      // Get location ID from slug
      const { data: locationData, error: locationError } = await supabase
        .from('locations')
        .select('id')
        .eq('slug', activeLocation)
        .single();

      if (locationError || !locationData) {
        throw new Error('Location not found');
      }

      const { error } = await supabase
        .from('venue_hours')
        .insert([{
          location_id: locationData.id,
          type: 'exceptional_open',
          date: newOpenDate,
          full_day: true,
        }]);

      if (error) throw error;

      toast({
        title: 'Custom open day added',
        status: 'success',
        duration: 3000,
      });

      setNewOpenDate('');
      setIsAddOpenModalOpen(false);
      fetchCustomDays();
      onDaysChange();
    } catch (error) {
      toast({
        title: 'Error adding open day',
        status: 'error',
        duration: 3000,
      });
    }
  };

  const handleAddClosedDay = async () => {
    if (!newClosedDate || activeLocation === 'all') return;

    try {
      // Get location ID from slug
      const { data: locationData, error: locationError } = await supabase
        .from('locations')
        .select('id')
        .eq('slug', activeLocation)
        .single();

      if (locationError || !locationData) {
        throw new Error('Location not found');
      }

      const { error } = await supabase
        .from('venue_hours')
        .insert([{
          location_id: locationData.id,
          type: 'exceptional_closure',
          date: newClosedDate,
          full_day: true,
        }]);

      if (error) throw error;

      toast({
        title: 'Custom closed day added',
        status: 'success',
        duration: 3000,
      });

      setNewClosedDate('');
      setIsAddClosedModalOpen(false);
      fetchCustomDays();
      onDaysChange();
    } catch (error) {
      toast({
        title: 'Error adding closed day',
        status: 'error',
        duration: 3000,
      });
    }
  };

  const handleRemoveOpenDay = async (idToRemove: string) => {
    if (!confirm('Remove this custom open day?')) return;

    try {
      const { error } = await supabase
        .from('venue_hours')
        .delete()
        .eq('id', idToRemove);

      if (error) throw error;

      toast({
        title: 'Custom open day removed',
        status: 'success',
        duration: 3000,
      });

      fetchCustomDays();
      onDaysChange();
    } catch (error) {
      toast({
        title: 'Error removing open day',
        status: 'error',
        duration: 3000,
      });
    }
  };

  const handleRemoveClosedDay = async (idToRemove: string) => {
    if (!confirm('Remove this custom closed day?')) return;

    try {
      const { error } = await supabase
        .from('venue_hours')
        .delete()
        .eq('id', idToRemove);

      if (error) throw error;

      toast({
        title: 'Custom closed day removed',
        status: 'success',
        duration: 3000,
      });

      fetchCustomDays();
      onDaysChange();
    } catch (error) {
      toast({
        title: 'Error removing closed day',
        status: 'error',
        duration: 3000,
      });
    }
  };

  if (loading) {
    return (
      <div style={{
        background: 'white',
        padding: '1.5rem',
        borderRadius: '16px',
        boxShadow: '0 4px 12px rgba(165, 148, 128, 0.08)',
        minHeight: '400px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ color: '#A59480', fontSize: '1.5rem' }}>Loading...</div>
      </div>
    );
  }

  if (activeLocation === 'all') {
    return (
      <div style={{
        background: 'white',
        padding: '1.5rem',
        borderRadius: '16px',
        boxShadow: '0 4px 12px rgba(165, 148, 128, 0.08)',
        minHeight: '400px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '1.125rem', color: '#5A5A5A', marginBottom: '0.5rem', fontFamily: 'Montserrat, sans-serif' }}>
            Please select a specific location to manage custom dates
          </p>
          <p style={{ fontSize: '0.875rem', color: '#868686', fontFamily: 'Montserrat, sans-serif' }}>
            Custom open/closed days are location-specific
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Custom Open Days */}
      <div style={{
        background: 'white',
        padding: '1.5rem',
        borderRadius: '16px',
        boxShadow: '0 4px 12px rgba(165, 148, 128, 0.08)',
        fontFamily: 'Montserrat, sans-serif'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.5rem',
          paddingBottom: '1rem',
          borderBottom: '2px solid #ECEDE8'
        }}>
          <div>
            <h3 style={{
              fontSize: '1.125rem',
              fontWeight: '700',
              color: '#1F1F1F',
              marginBottom: '0.25rem',
              letterSpacing: '-0.02em'
            }}>
              Custom Open Days
            </h3>
            <p style={{
              fontSize: '0.8125rem',
              color: '#868686',
              margin: 0
            }}>
              Override normally closed days to allow reservations
            </p>
          </div>
          <button
            onClick={() => setIsAddOpenModalOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: '#34C759',
              color: 'white',
              border: '1px solid #34C759',
              padding: '0.5rem 1rem',
              borderRadius: '10px',
              fontSize: '0.875rem',
              fontWeight: '600',
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(52, 199, 89, 0.15), 0 4px 8px rgba(52, 199, 89, 0.25), 0 8px 16px rgba(52, 199, 89, 0.18)',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              minHeight: '44px'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = '#28A745';
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 2px 4px rgba(52, 199, 89, 0.2), 0 8px 16px rgba(52, 199, 89, 0.3), 0 16px 32px rgba(52, 199, 89, 0.22)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = '#34C759';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 1px 2px rgba(52, 199, 89, 0.15), 0 4px 8px rgba(52, 199, 89, 0.25), 0 8px 16px rgba(52, 199, 89, 0.18)';
            }}
          >
            <Plus size={16} />
            Add Open Day
          </button>
        </div>

        {/* List */}
        {customOpenDays.length === 0 ? (
          <p style={{
            textAlign: 'center',
            color: '#ABA8A1',
            padding: '3rem 0',
            fontSize: '0.875rem'
          }}>
            No custom open days configured
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {customOpenDays.map((day) => (
              <div
                key={day.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '1rem 1.25rem',
                  background: '#F0FDF4',
                  border: '1px solid #BBF7D0',
                  borderRadius: '10px',
                  transition: 'all 0.2s',
                  minHeight: '44px'
                }}
              >
                <div style={{ flex: 1 }}>
                  <p style={{
                    fontWeight: '600',
                    color: '#1F1F1F',
                    marginBottom: '0.25rem',
                    fontSize: '0.9375rem'
                  }}>
                    {format(new Date(day.date), 'EEEE, MMMM d, yyyy')}
                  </p>
                  {day.time_ranges && day.time_ranges.length > 0 ? (
                    <p style={{
                      fontSize: '0.8125rem',
                      color: '#16A34A',
                      margin: 0
                    }}>
                      {day.time_ranges.map((range: any) => `${range.start} - ${range.end}`).join(', ')}
                    </p>
                  ) : (
                    <p style={{
                      fontSize: '0.8125rem',
                      color: '#16A34A',
                      margin: 0
                    }}>
                      All day
                    </p>
                  )}
                </div>
                <button
                  onClick={() => handleRemoveOpenDay(day.id)}
                  aria-label="Remove"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#EF4444',
                    cursor: 'pointer',
                    padding: '0.5rem',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s',
                    minWidth: '44px',
                    minHeight: '44px'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.background = '#FEE2E2';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <X size={18} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Custom Closed Days */}
      <div style={{
        background: 'white',
        padding: '1.5rem',
        borderRadius: '16px',
        boxShadow: '0 4px 12px rgba(165, 148, 128, 0.08)',
        fontFamily: 'Montserrat, sans-serif'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.5rem',
          paddingBottom: '1rem',
          borderBottom: '2px solid #ECEDE8'
        }}>
          <div>
            <h3 style={{
              fontSize: '1.125rem',
              fontWeight: '700',
              color: '#1F1F1F',
              marginBottom: '0.25rem',
              letterSpacing: '-0.02em'
            }}>
              Custom Closed Days
            </h3>
            <p style={{
              fontSize: '0.8125rem',
              color: '#868686',
              margin: 0
            }}>
              Override normally open days to block reservations
            </p>
          </div>
          <button
            onClick={() => setIsAddClosedModalOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: '#EF4444',
              color: 'white',
              border: '1px solid #EF4444',
              padding: '0.5rem 1rem',
              borderRadius: '10px',
              fontSize: '0.875rem',
              fontWeight: '600',
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(239, 68, 68, 0.15), 0 4px 8px rgba(239, 68, 68, 0.25), 0 8px 16px rgba(239, 68, 68, 0.18)',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              minHeight: '44px'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = '#DC2626';
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 2px 4px rgba(239, 68, 68, 0.2), 0 8px 16px rgba(239, 68, 68, 0.3), 0 16px 32px rgba(239, 68, 68, 0.22)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = '#EF4444';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 1px 2px rgba(239, 68, 68, 0.15), 0 4px 8px rgba(239, 68, 68, 0.25), 0 8px 16px rgba(239, 68, 68, 0.18)';
            }}
          >
            <Plus size={16} />
            Add Closed Day
          </button>
        </div>

        {/* List */}
        {customClosedDays.length === 0 ? (
          <p style={{
            textAlign: 'center',
            color: '#ABA8A1',
            padding: '3rem 0',
            fontSize: '0.875rem'
          }}>
            No custom closed days configured
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {customClosedDays.map((day) => (
              <div
                key={day.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '1rem 1.25rem',
                  background: '#FEF2F2',
                  border: '1px solid #FECACA',
                  borderRadius: '10px',
                  transition: 'all 0.2s',
                  minHeight: '44px'
                }}
              >
                <div style={{ flex: 1 }}>
                  <p style={{
                    fontWeight: '600',
                    color: '#1F1F1F',
                    marginBottom: '0.25rem',
                    fontSize: '0.9375rem'
                  }}>
                    {format(new Date(day.date), 'EEEE, MMMM d, yyyy')}
                  </p>
                  {day.reason && (
                    <p style={{
                      fontSize: '0.8125rem',
                      color: '#DC2626',
                      margin: 0,
                      marginBottom: '0.25rem'
                    }}>
                      {day.reason}
                    </p>
                  )}
                  {day.time_ranges && day.time_ranges.length > 0 ? (
                    <p style={{
                      fontSize: '0.8125rem',
                      color: '#EF4444',
                      margin: 0
                    }}>
                      {day.time_ranges.map((range: any) => `${range.start} - ${range.end}`).join(', ')}
                    </p>
                  ) : (
                    <p style={{
                      fontSize: '0.8125rem',
                      color: '#EF4444',
                      margin: 0
                    }}>
                      All day
                    </p>
                  )}
                </div>
                <button
                  onClick={() => handleRemoveClosedDay(day.id)}
                  aria-label="Remove"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#EF4444',
                    cursor: 'pointer',
                    padding: '0.5rem',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s',
                    minWidth: '44px',
                    minHeight: '44px'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.background = '#FEE2E2';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <X size={18} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Open Day Modal */}
      <Modal isOpen={isAddOpenModalOpen} onClose={() => setIsAddOpenModalOpen(false)} isCentered>
        <ModalOverlay 
          bg="blackAlpha.600" 
          backdropFilter="blur(4px)"
        />
        <ModalContent 
          bg="white" 
          borderRadius="16px" 
          boxShadow="xl"
          maxW="500px"
          w="90%"
          fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif"
        >
          <ModalHeader fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif">Add Custom Open Day</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <FormControl>
              <FormLabel fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif">Date</FormLabel>
              <Input
                type="date"
                value={newOpenDate}
                onChange={(e) => setNewOpenDate(e.target.value)}
                fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif"
              />
            </FormControl>
            <HStack spacing={3} mt={6}>
              <Button 
                colorScheme="green" 
                onClick={handleAddOpenDay} 
                isDisabled={!newOpenDate}
                fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif"
              >
                Add Open Day
              </Button>
              <Button 
                variant="ghost" 
                onClick={() => setIsAddOpenModalOpen(false)}
                fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif"
              >
                Cancel
              </Button>
            </HStack>
          </ModalBody>
        </ModalContent>
      </Modal>

      {/* Add Closed Day Modal */}
      <Modal isOpen={isAddClosedModalOpen} onClose={() => setIsAddClosedModalOpen(false)} isCentered>
        <ModalOverlay 
          bg="blackAlpha.600" 
          backdropFilter="blur(4px)"
        />
        <ModalContent 
          bg="white" 
          borderRadius="16px" 
          boxShadow="xl"
          maxW="500px"
          w="90%"
          fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif"
        >
          <ModalHeader fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif">Add Custom Closed Day</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <FormControl>
              <FormLabel fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif">Date</FormLabel>
              <Input
                type="date"
                value={newClosedDate}
                onChange={(e) => setNewClosedDate(e.target.value)}
                fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif"
              />
            </FormControl>
            <HStack spacing={3} mt={6}>
              <Button 
                colorScheme="red" 
                onClick={handleAddClosedDay} 
                isDisabled={!newClosedDate}
                fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif"
              >
                Add Closed Day
              </Button>
              <Button 
                variant="ghost" 
                onClick={() => setIsAddClosedModalOpen(false)}
                fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif"
              >
                Cancel
              </Button>
            </HStack>
          </ModalBody>
        </ModalContent>
      </Modal>
    </div>
  );
}
