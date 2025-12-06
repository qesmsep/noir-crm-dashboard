import React, { useState, useEffect } from 'react';
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
} from '@chakra-ui/react';
import { ChevronLeftIcon, ChevronRightIcon, AddIcon, CalendarIcon, SettingsIcon, DownloadIcon, CloseIcon } from '@chakra-ui/icons';
import AdminLayout from '../../components/layouts/AdminLayout';
import { supabase, supabaseAdmin } from '../../lib/supabase';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, subMonths, isSameMonth, isSameDay, parseISO, isToday, startOfYear, endOfYear } from 'date-fns';
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
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarDays, setCalendarDays] = useState<DayData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<DayData | null>(null);
  const [isDayModalOpen, setIsDayModalOpen] = useState(false);
  const [isEditEventModalOpen, setIsEditEventModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<PrivateEvent | null>(null);
  const [eventFormData, setEventFormData] = useState({
    title: '',
    start_time: '',
    end_time: '',
    description: '',
    guest_count: '',
    client_name: '',
    client_email: '',
    location: '',
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

      // Fetch private events
      const { data: privateEvents } = await supabase
        .from('private_events')
        .select('*')
        .gte('start_time', calendarStart.toISOString())
        .lte('start_time', calendarEnd.toISOString());

      // Fetch Minaka events
      let minakaEvents: PrivateEvent[] = [];
      try {
        const minakaResponse = await fetch('/api/minaka-events');
        if (minakaResponse.ok) {
          const minakaData = await minakaResponse.json();
          // Filter Minaka events to the calendar date range
          minakaEvents = (minakaData.data || []).filter((e: PrivateEvent) => {
            const eventDate = parseISO(e.start_time);
            return eventDate >= calendarStart && eventDate <= calendarEnd;
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
        usingAdmin: !!supabaseAdmin
      });
      
      const { data: reservations, error: reservationsError } = await client
        .from('reservations')
        .select('*')
        .gte('start_time', calendarStart.toISOString())
        .lte('start_time', calendarEnd.toISOString());
      
      if (reservationsError) {
        console.error('Error fetching reservations for calendar:', reservationsError);
      } else {
        console.log(`Fetched ${reservations?.length || 0} reservations for calendar`);
        if (reservations && reservations.length > 0) {
          console.log('Sample reservation:', {
            id: reservations[0].id,
            start_time: reservations[0].start_time,
            phone: reservations[0].phone,
            party_size: reservations[0].party_size
          });
        }
      }

      // Fetch venue hours
      const { data: baseHours } = await supabase
        .from('venue_hours')
        .select('*')
        .eq('type', 'base');

      const { data: customDays } = await supabase
        .from('venue_hours')
        .select('*')
        .in('type', ['exceptional_open', 'exceptional_closure'])
        .gte('date', format(calendarStart, 'yyyy-MM-dd'))
        .lte('date', format(calendarEnd, 'yyyy-MM-dd'));

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
    fetchCalendarData();
  }, [currentDate]);

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
    });

    setIsEditEventModalOpen(true);
    setIsDayModalOpen(false);
  };

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingEvent) return;

    try {
      const eventData = {
        title: eventFormData.title,
        start_time: eventFormData.start_time,
        end_time: eventFormData.end_time,
        event_description: eventFormData.description || null,
        guest_count: eventFormData.guest_count ? parseInt(eventFormData.guest_count) : null,
        client_name: eventFormData.client_name || null,
        client_email: eventFormData.client_email || null,
        location: eventFormData.location || null,
      };

      const { error } = await supabase
        .from('private_events')
        .update(eventData)
        .eq('id', editingEvent.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Event updated successfully',
        status: 'success',
        duration: 3000,
      });

      setIsEditEventModalOpen(false);
      setEditingEvent(null);
      fetchCalendarData();
    } catch (error) {
      console.error('Error updating event:', error);
      toast({
        title: 'Error',
        description: 'Failed to update event',
        status: 'error',
        duration: 3000,
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

  const handleCloseEventModal = () => {
    setIsEditEventModalOpen(false);
    setEditingEvent(null);
    setEventFormData({
      title: '',
      start_time: '',
      end_time: '',
      description: '',
      guest_count: '',
      client_name: '',
      client_email: '',
      location: '',
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
            <DownloadIcon style={{ width: '16px', height: '16px' }} />
            Export for Members
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
              ⚙️ Settings
            </button>
          </div>

          {activeTab === 0 && (
            <div>
              {/* Month Navigation */}
              <div className={styles.monthNav}>
                <button className={styles.iconButton} onClick={handlePrevMonth} aria-label="Previous month">
                  <ChevronLeftIcon style={{ width: '20px', height: '20px' }} />
                </button>
                <div className={styles.monthTitle}>{format(currentDate, 'MMMM yyyy')}</div>
                <div className={styles.navButtons}>
                  <button className={styles.navButton} onClick={handleToday}>
                    Today
                  </button>
                  <button className={styles.iconButton} onClick={handleNextMonth} aria-label="Next month">
                    <ChevronRightIcon style={{ width: '20px', height: '20px' }} />
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
            <CustomDaysManager onDaysChange={fetchCalendarData} />
          )}
        </div>

        {/* Day Details Modal */}
        <Modal isOpen={isDayModalOpen} onClose={() => setIsDayModalOpen(false)} isCentered useInert={false}>
          <ModalOverlay 
            bg="blackAlpha.600" 
            backdropFilter="blur(4px)"
          />
          <ModalContent 
            className={styles.modalContent} 
            bg="white" 
            borderRadius="16px" 
            boxShadow="xl"
            maxW="700px"
            w="90%"
            fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif"
          >
            <ModalHeader className={styles.modalHeader}>
              {selectedDay && format(selectedDay.date, 'EEEE, MMMM d, yyyy')}
            </ModalHeader>
            <ModalCloseButton />
            <ModalBody className={styles.modalBody}>
              {selectedDay && (
                <div>
                  {/* Day Stats */}
                  <div className={styles.modalStats}>
                    <div className={styles.modalStat}>
                      <div className={styles.modalStatLabel}>Covers</div>
                      <div className={styles.modalStatValue}>{selectedDay.covers}</div>
                    </div>
                    <div className={styles.modalStat}>
                      <div className={styles.modalStatLabel}>Revenue</div>
                      <div className={styles.modalStatValue}>${selectedDay.revenue.toLocaleString()}</div>
                    </div>
                    <div className={styles.modalStat}>
                      <div className={styles.modalStatLabel}>Status</div>
                      <div className={styles.modalStatValue}>
                        <Badge colorScheme={selectedDay.isOpen ? 'green' : 'red'}>
                          {selectedDay.isOpen ? 'Open' : 'Closed'}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* Events List */}
                  <div className={styles.eventsList}>
                    {/* Private Events */}
                    {selectedDay.privateEvents.length > 0 && (
                      <div className={styles.eventsSection}>
                        <div className={styles.sectionTitle}>Private Events</div>
                        {selectedDay.privateEvents.map(event => {
                          const eventName = event.title || event.name || 'Untitled Event';
                          const isMinaka = event.source === 'minaka';
                          return (
                            <div
                              key={event.id}
                              className={`${styles.eventCard} ${styles.eventCardPrivate} ${isMinaka ? styles.eventCardMinaka : ''}`}
                              onClick={(e) => handleEventClick(event, e)}
                              style={{ cursor: 'pointer' }}
                            >
                              <div className={styles.eventName}>
                                {eventName}
                                {isMinaka && <Badge colorScheme="blue" ml={2} fontSize="xs">Minaka</Badge>}
                              </div>
                              <div className={styles.eventDetails}>
                                <div>{format(parseISO(event.start_time), 'h:mm a')} - {format(parseISO(event.end_time), 'h:mm a')}</div>
                                {event.guest_count && (
                                  <div>Guests: {event.guest_count}</div>
                                )}
                                {event.client_name && (
                                  <div>Client: {event.client_name}</div>
                                )}
                                {event.client_email && (
                                  <div>Email: {event.client_email}</div>
                                )}
                                {event.location && (
                                  <div>Location: {event.location}</div>
                                )}
                                {event.minaka_url && (
                                  <div>
                                    <a href={event.minaka_url} target="_blank" rel="noopener noreferrer" style={{ color: '#3182CE', textDecoration: 'underline' }}>
                                      View in Minaka
                                    </a>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Reservations */}
                    {selectedDay.reservations.length > 0 && (
                      <div className={styles.eventsSection}>
                        <div className={styles.sectionTitle}>Reservations ({selectedDay.reservations.length})</div>
                        {selectedDay.reservations.map(res => {
                          const resTime = res.start_time 
                            ? format(parseISO(res.start_time), 'h:mm a')
                            : 'Time TBD';
                          return (
                            <div key={res.id} className={`${styles.eventCard} ${styles.eventCardReservation}`}>
                              <div className={styles.eventName}>{resTime}</div>
                              <div className={styles.eventDetails}>
                                <div>Party of {res.party_size || 0}</div>
                                {res.first_name && (
                                  <div>{res.first_name} {res.last_name || ''}</div>
                                )}
                                {res.phone && (
                                  <div>{res.phone}</div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {selectedDay.privateEvents.length === 0 && selectedDay.reservations.length === 0 && (
                      <div className={styles.emptyState}>
                        No events or reservations for this day
                      </div>
                    )}
                  </div>
                </div>
              )}
            </ModalBody>
          </ModalContent>
        </Modal>

        {/* Edit Event Modal */}
        <Modal isOpen={isEditEventModalOpen} onClose={handleCloseEventModal} isCentered useInert={false}>
          <ModalOverlay
            bg="blackAlpha.600"
            backdropFilter="blur(4px)"
            className="event-edit-modal-overlay"
          />
          <ModalContent
            bg="white"
            borderRadius="16px"
            boxShadow="xl"
            maxW="600px"
            w="90%"
            fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif"
            className="event-edit-modal-content"
          >
            <ModalHeader fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif">
              Edit Event
            </ModalHeader>
            <ModalCloseButton />
            <ModalBody pb={6}>
              <form onSubmit={handleSaveEvent}>
                <VStack spacing={4}>
                  <FormControl isRequired>
                    <FormLabel>Event Name</FormLabel>
                    <Input
                      value={eventFormData.title}
                      onChange={(e) => setEventFormData({ ...eventFormData, title: e.target.value })}
                      placeholder="e.g., Holiday Party"
                    />
                  </FormControl>

                  <FormControl isRequired>
                    <FormLabel>Start Time</FormLabel>
                    <Input
                      type="datetime-local"
                      value={eventFormData.start_time}
                      onChange={(e) => setEventFormData({ ...eventFormData, start_time: e.target.value })}
                    />
                  </FormControl>

                  <FormControl isRequired>
                    <FormLabel>End Time</FormLabel>
                    <Input
                      type="datetime-local"
                      value={eventFormData.end_time}
                      onChange={(e) => setEventFormData({ ...eventFormData, end_time: e.target.value })}
                    />
                  </FormControl>

                  <FormControl>
                    <FormLabel>Guest Count</FormLabel>
                    <Input
                      type="number"
                      value={eventFormData.guest_count}
                      onChange={(e) => setEventFormData({ ...eventFormData, guest_count: e.target.value })}
                      placeholder="Number of guests"
                    />
                  </FormControl>

                  <FormControl>
                    <FormLabel>Client Name</FormLabel>
                    <Input
                      value={eventFormData.client_name}
                      onChange={(e) => setEventFormData({ ...eventFormData, client_name: e.target.value })}
                      placeholder="Client name"
                    />
                  </FormControl>

                  <FormControl>
                    <FormLabel>Client Email</FormLabel>
                    <Input
                      type="email"
                      value={eventFormData.client_email}
                      onChange={(e) => setEventFormData({ ...eventFormData, client_email: e.target.value })}
                      placeholder="client@example.com"
                    />
                  </FormControl>

                  <FormControl>
                    <FormLabel>Location</FormLabel>
                    <Input
                      value={eventFormData.location}
                      onChange={(e) => setEventFormData({ ...eventFormData, location: e.target.value })}
                      placeholder="Event location"
                    />
                  </FormControl>

                  <FormControl>
                    <FormLabel>Description</FormLabel>
                    <Textarea
                      value={eventFormData.description}
                      onChange={(e) => setEventFormData({ ...eventFormData, description: e.target.value })}
                      placeholder="Event details..."
                      rows={4}
                    />
                  </FormControl>

                  <HStack w="full" justify="space-between" pt={4}>
                    <Button
                      colorScheme="red"
                      variant="outline"
                      onClick={handleDeleteEvent}
                    >
                      Delete Event
                    </Button>
                    <HStack spacing={3}>
                      <Button onClick={handleCloseEventModal}>
                        Cancel
                      </Button>
                      <Button type="submit" colorScheme="blue">
                        Save Changes
                      </Button>
                    </HStack>
                  </HStack>
                </VStack>
              </form>
            </ModalBody>
          </ModalContent>
        </Modal>
      </div>
    </AdminLayout>
  );
}

// Private Events Manager Component
function PrivateEventsManager({ onEventChange }: { onEventChange: () => void }) {
  const [events, setEvents] = useState<PrivateEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<PrivateEvent | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    title: '',
    start_time: '',
    end_time: '',
    description: '',
    guest_count: '',
  });
  const toast = useToast();

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('private_events')
        .select('*')
        .order('start_time', { ascending: true });

      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      console.error('Error fetching events:', error);
      toast({
        title: 'Error',
        description: 'Failed to load private events',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const eventData = {
        title: formData.title || formData.name,
        start_time: formData.start_time,
        end_time: formData.end_time,
        event_description: formData.description || null,
        guest_count: formData.guest_count ? parseInt(formData.guest_count) : null,
      };

      if (editingEvent) {
        const { error } = await supabase
          .from('private_events')
          .update(eventData)
          .eq('id', editingEvent.id);

        if (error) throw error;
        toast({
          title: 'Success',
          description: 'Private event updated successfully',
          status: 'success',
          duration: 3000,
        });
      } else {
        const { error } = await supabase
          .from('private_events')
          .insert([eventData]);

        if (error) throw error;
        toast({
          title: 'Success',
          description: 'Private event created successfully',
          status: 'success',
          duration: 3000,
        });
      }

      fetchEvents();
      onEventChange();
      handleCloseModal();
    } catch (error) {
      console.error('Error saving event:', error);
      toast({
        title: 'Error',
        description: 'Failed to save private event',
        status: 'error',
        duration: 3000,
      });
    }
  };

  const handleDelete = async (eventId: string) => {
    if (!confirm('Are you sure you want to delete this event?')) return;

    try {
      const { error } = await supabase
        .from('private_events')
        .delete()
        .eq('id', eventId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Private event deleted successfully',
        status: 'success',
        duration: 3000,
      });

      fetchEvents();
      onEventChange();
    } catch (error) {
      console.error('Error deleting event:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete private event',
        status: 'error',
        duration: 3000,
      });
    }
  };

  const handleEdit = (event: PrivateEvent) => {
    setEditingEvent(event);
    
    // Convert ISO datetime strings to datetime-local format (YYYY-MM-DDTHH:mm)
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
    
    setFormData({
      name: event.name || '',
      title: event.title || event.name || '',
      start_time: formatForInput(event.start_time),
      end_time: formatForInput(event.end_time),
      description: event.description || '',
      guest_count: event.guest_count?.toString() || '',
    });
    setIsCreateModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsCreateModalOpen(false);
    setEditingEvent(null);
    setFormData({
      name: '',
      title: '',
      start_time: '',
      end_time: '',
      description: '',
      guest_count: '',
    });
  };

  return (
    <Box>
      <HStack justify="space-between" mb={6}>
        <Text fontSize="2xl" fontWeight="bold">Private Events</Text>
        <Button
          leftIcon={<AddIcon />}
          colorScheme="blue"
          onClick={() => setIsCreateModalOpen(true)}
        >
          Create Event
        </Button>
      </HStack>

      {loading ? (
        <Box bg="white" p={6} borderRadius="xl" shadow="sm" textAlign="center" py={20}>
          <Spinner size="xl" color="blue.500" />
          <Text mt={4} color="gray.600">Loading events...</Text>
        </Box>
      ) : events.length === 0 ? (
        <Box bg="white" p={6} borderRadius="xl" shadow="sm" textAlign="center" py={20}>
          <Text fontSize="4xl" mb={2}>🎉</Text>
          <Text fontSize="lg" fontWeight="600" color="gray.700" mb={2}>No Private Events</Text>
          <Text color="gray.500" mb={4}>Create your first private event to get started</Text>
          <Button leftIcon={<AddIcon />} colorScheme="blue" onClick={() => setIsCreateModalOpen(true)}>
            Create Event
          </Button>
        </Box>
      ) : (
        <VStack spacing={4} align="stretch">
          {events.map(event => (
            <Box key={event.id} bg="white" p={6} borderRadius="xl" shadow="sm" border="1px" borderColor="gray.200">
              <HStack justify="space-between" align="start" mb={3}>
                <VStack align="start" spacing={1} flex={1}>
                  <Text fontSize="xl" fontWeight="bold" color="gray.800">{event.title || event.name || 'Untitled Event'}</Text>
                  <HStack spacing={4}>
                    <Badge colorScheme="blue" fontSize="sm">
                      📅 {format(parseISO(event.start_time), 'MMM d, yyyy')}
                    </Badge>
                    <Badge colorScheme="purple" fontSize="sm">
                      🕐 {format(parseISO(event.start_time), 'h:mm a')} - {format(parseISO(event.end_time), 'h:mm a')}
                    </Badge>
                    {event.guest_count && (
                      <Badge colorScheme="green" fontSize="sm">
                        👥 {event.guest_count} guests
                      </Badge>
                    )}
                  </HStack>
                </VStack>
                <HStack>
                  <IconButton
                    icon={<AddIcon />}
                    aria-label="Edit event"
                    size="sm"
                    colorScheme="blue"
                    variant="ghost"
                    onClick={() => handleEdit(event)}
                  />
                  <IconButton
                    icon={<CloseIcon />}
                    aria-label="Delete event"
                    size="sm"
                    colorScheme="red"
                    variant="ghost"
                    onClick={() => handleDelete(event.id)}
                  />
                </HStack>
              </HStack>

              {event.description && (
                <Text color="gray.600" mt={2}>{event.description}</Text>
              )}
            </Box>
          ))}
        </VStack>
      )}

      {/* Create/Edit Modal */}
      <Modal isOpen={isCreateModalOpen} onClose={handleCloseModal} isCentered>
        <ModalOverlay 
          bg="blackAlpha.600" 
          backdropFilter="blur(4px)"
        />
        <ModalContent 
          bg="white" 
          borderRadius="16px" 
          boxShadow="xl"
          maxW="600px"
          w="90%"
          fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif"
          sx={{
            '& input, & textarea, & select': {
              fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif !important",
            },
            '& input::placeholder, & textarea::placeholder': {
              fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif !important",
            },
            '& label': {
              fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif !important",
            },
            '& button': {
              fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif !important",
            }
          }}
        >
          <ModalHeader fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif">
            {editingEvent ? 'Edit Private Event' : 'Create Private Event'}
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <form onSubmit={handleSubmit}>
              <VStack spacing={4}>
                <FormControl isRequired>
                  <FormLabel fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif">Event Name</FormLabel>
                  <Input
                    value={formData.title || formData.name}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value, name: e.target.value })}
                    placeholder="e.g., Holiday Party"
                    fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif"
                    _placeholder={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}
                  />
                </FormControl>

                <FormControl isRequired>
                  <FormLabel fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif">Start Time</FormLabel>
                  <Input
                    type="datetime-local"
                    value={formData.start_time}
                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                    fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif"
                  />
                </FormControl>

                <FormControl isRequired>
                  <FormLabel fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif">End Time</FormLabel>
                  <Input
                    type="datetime-local"
                    value={formData.end_time}
                    onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                    fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif"
                  />
                </FormControl>

                <FormControl>
                  <FormLabel fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif">Guest Count</FormLabel>
                  <Input
                    type="number"
                    value={formData.guest_count}
                    onChange={(e) => setFormData({ ...formData, guest_count: e.target.value })}
                    placeholder="Number of guests"
                    fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif"
                    _placeholder={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}
                  />
                </FormControl>

                <FormControl>
                  <FormLabel fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif">Description</FormLabel>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Event details..."
                    rows={4}
                    fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif"
                    _placeholder={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}
                  />
                </FormControl>

                <HStack w="full" justify="flex-end" spacing={3} pt={4}>
                  <Button 
                    onClick={handleCloseModal}
                    fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif"
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    colorScheme="blue"
                    fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif"
                  >
                    {editingEvent ? 'Update Event' : 'Create Event'}
                  </Button>
                </HStack>
              </VStack>
            </form>
          </ModalBody>
        </ModalContent>
      </Modal>
    </Box>
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
function CustomDaysManager({ onDaysChange }: { onDaysChange: () => void }) {
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
  }, []);

  const fetchCustomDays = async () => {
    setLoading(true);
    try {
      const { data: settings } = await supabase
        .from('settings')
        .select('custom_open_dates, custom_closed_dates')
        .single();

      if (settings) {
        setCustomOpenDays(settings.custom_open_dates || []);
        setCustomClosedDays(settings.custom_closed_dates || []);
      }
    } catch (error) {
      console.error('Error fetching custom days:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddOpenDay = async () => {
    if (!newOpenDate) return;

    try {
      const updatedOpenDays = [...customOpenDays, { date: newOpenDate }];

      const { error } = await supabase
        .from('settings')
        .update({ custom_open_dates: updatedOpenDays })
        .eq('id', (await supabase.from('settings').select('id').single()).data?.id);

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
    if (!newClosedDate) return;

    try {
      const updatedClosedDays = [...customClosedDays, { date: newClosedDate }];

      const { error } = await supabase
        .from('settings')
        .update({ custom_closed_dates: updatedClosedDays })
        .eq('id', (await supabase.from('settings').select('id').single()).data?.id);

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

  const handleRemoveOpenDay = async (dateToRemove: string) => {
    if (!confirm('Remove this custom open day?')) return;

    try {
      const updatedOpenDays = customOpenDays.filter(day => day.date !== dateToRemove);

      const { error } = await supabase
        .from('settings')
        .update({ custom_open_dates: updatedOpenDays })
        .eq('id', (await supabase.from('settings').select('id').single()).data?.id);

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

  const handleRemoveClosedDay = async (dateToRemove: string) => {
    if (!confirm('Remove this custom closed day?')) return;

    try {
      const updatedClosedDays = customClosedDays.filter(day => day.date !== dateToRemove);

      const { error } = await supabase
        .from('settings')
        .update({ custom_closed_dates: updatedClosedDays })
        .eq('id', (await supabase.from('settings').select('id').single()).data?.id);

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
      <Box bg="white" p={6} borderRadius="xl" shadow="sm" minH="400px" display="flex" alignItems="center" justifyContent="center">
        <Spinner size="xl" color="blue.500" />
      </Box>
    );
  }

  return (
    <VStack spacing={4} align="stretch">
      {/* Custom Open Days */}
      <Box bg="white" p={6} borderRadius="xl" shadow="sm">
        <HStack justify="space-between" mb={4}>
          <Text fontSize="lg" fontWeight="semibold">Custom Open Days</Text>
          <Button
            leftIcon={<AddIcon />}
            colorScheme="green"
            size="sm"
            onClick={() => setIsAddOpenModalOpen(true)}
          >
            Add Open Day
          </Button>
        </HStack>
        <Text fontSize="sm" color="gray.600" mb={4}>
          Override normally closed days to allow reservations
        </Text>
        {customOpenDays.length === 0 ? (
          <Text color="gray.500" textAlign="center" py={8}>
            No custom open days configured
          </Text>
        ) : (
          <VStack spacing={2} align="stretch">
            {customOpenDays.map((day, index) => (
              <HStack
                key={index}
                p={4}
                bg="green.50"
                borderRadius="lg"
                justify="space-between"
                border="1px"
                borderColor="green.200"
              >
                <Text fontWeight="medium">
                  {format(new Date(day.date), 'EEEE, MMMM d, yyyy')}
                </Text>
                <IconButton
                  aria-label="Remove"
                  icon={<CloseIcon />}
                  size="sm"
                  colorScheme="red"
                  variant="ghost"
                  onClick={() => handleRemoveOpenDay(day.date)}
                />
              </HStack>
            ))}
          </VStack>
        )}
      </Box>

      {/* Custom Closed Days */}
      <Box bg="white" p={6} borderRadius="xl" shadow="sm">
        <HStack justify="space-between" mb={4}>
          <Text fontSize="lg" fontWeight="semibold">Custom Closed Days</Text>
          <Button
            leftIcon={<AddIcon />}
            colorScheme="red"
            size="sm"
            onClick={() => setIsAddClosedModalOpen(true)}
          >
            Add Closed Day
          </Button>
        </HStack>
        <Text fontSize="sm" color="gray.600" mb={4}>
          Override normally open days to block reservations
        </Text>
        {customClosedDays.length === 0 ? (
          <Text color="gray.500" textAlign="center" py={8}>
            No custom closed days configured
          </Text>
        ) : (
          <VStack spacing={2} align="stretch">
            {customClosedDays.map((day, index) => (
              <HStack
                key={index}
                p={4}
                bg="red.50"
                borderRadius="lg"
                justify="space-between"
                border="1px"
                borderColor="red.200"
              >
                <Text fontWeight="medium">
                  {format(new Date(day.date), 'EEEE, MMMM d, yyyy')}
                </Text>
                <IconButton
                  aria-label="Remove"
                  icon={<CloseIcon />}
                  size="sm"
                  colorScheme="red"
                  variant="ghost"
                  onClick={() => handleRemoveClosedDay(day.date)}
                />
              </HStack>
            ))}
          </VStack>
        )}
      </Box>

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
    </VStack>
  );
}
