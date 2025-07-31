import React, { useState, useEffect } from 'react';
import {
  Box,
  HStack,
  Button,
  IconButton,
  Text,
  VStack,
  Checkbox,
  CheckboxGroup,
  Badge,
  useToast,
  Spinner,
  Flex,
  Heading,
  Divider,
  useColorModeValue,
  FormControl,
  FormLabel,
  Input,
  Textarea,
  Select,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Image
} from '@chakra-ui/react';
import { ChevronLeftIcon, ChevronRightIcon, AddIcon, EditIcon, DeleteIcon, CheckIcon, CloseIcon, ExternalLinkIcon } from '@chakra-ui/icons';
import AdminLayout from '../../components/layouts/AdminLayout';
import { useSettings } from '../../context/SettingsContext';
import { fromUTC, isSameDay, localInputToUTC, utcToLocalInput, formatDateTime } from '../../utils/dateUtils';
import { supabase } from '../../lib/supabase';

interface EventFilter {
  privateEvents: boolean;
  noirMemberEvents: boolean;
  closedDays: boolean;
  openDays: boolean;
}

interface CalendarDay {
  date: Date;
  privateEvents: any[];
  noirMemberEvents: any[];
  isOpen: boolean;
  isCurrentMonth: boolean;
  totalEvents: number;
}

type ViewType = 'month' | 'private-events' | 'custom-days';

export default function EventCalendar() {
  const [currentView, setCurrentView] = useState<ViewType>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarData, setCalendarData] = useState<CalendarDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<EventFilter>({
    privateEvents: true,
    noirMemberEvents: true,
    closedDays: true,
    openDays: true
  });
  const [isEventDrawerOpen, setIsEventDrawerOpen] = useState(false);
  const [selectedEventType, setSelectedEventType] = useState<string>('');
  const [shouldOpenNewEventForm, setShouldOpenNewEventForm] = useState(false);
  const { settings } = useSettings();
  const toast = useToast();

  useEffect(() => {
    if (currentView === 'month') {
      fetchCalendarData();
    }
  }, [currentDate, filters, currentView]);

  const fetchCalendarData = async () => {
    setLoading(true);
    try {
      const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      
      // Get start of week for month start
      const calendarStart = new Date(monthStart);
      calendarStart.setDate(monthStart.getDate() - monthStart.getDay());
      
      // Get end of week for month end
      const calendarEnd = new Date(monthEnd);
      calendarEnd.setDate(monthEnd.getDate() + (6 - monthEnd.getDay()));

      // Fetch private events
      const { data: privateEvents } = await supabase
        .from('private_events')
        .select('*')
        .gte('start_time', calendarStart.toISOString())
        .lte('start_time', calendarEnd.toISOString())
        .eq('status', 'active');

      // Fetch venue hours for the entire month
      const { data: venueHoursData } = await supabase
        .from('venue_hours')
        .select('*')
        .eq('type', 'base');

      const { data: exceptionalClosuresData } = await supabase
        .from('venue_hours')
        .select('*')
        .eq('type', 'exceptional_closure')
        .gte('date', calendarStart.toISOString().split('T')[0])
        .lte('date', calendarEnd.toISOString().split('T')[0]);

      const { data: exceptionalOpenData } = await supabase
        .from('venue_hours')
        .select('*')
        .eq('type', 'exceptional_open')
        .gte('date', calendarStart.toISOString().split('T')[0])
        .lte('date', calendarEnd.toISOString().split('T')[0]);

      // Create calendar grid
      const calendarData: CalendarDay[] = [];
      const current = new Date(calendarStart);
      
      while (current <= calendarEnd) {
        const dayPrivateEvents = privateEvents?.filter((pe: any) => {
          const eventDate = fromUTC(pe.start_time, settings.timezone);
          return isSameDay(eventDate, current, settings.timezone);
        }) || [];

        // Check if the day is open for reservations
        const isOpen = isDayOpenOptimized(current, venueHoursData || [], [...(exceptionalClosuresData || []), ...(exceptionalOpenData || [])], privateEvents || []);

        // Mock Noir Member Events (placeholder for future implementation)
        const noirMemberEvents: any[] = [];

        calendarData.push({
          date: new Date(current),
          privateEvents: dayPrivateEvents,
          noirMemberEvents,
          isOpen,
          isCurrentMonth: current.getMonth() === currentDate.getMonth(),
          totalEvents: dayPrivateEvents.length + noirMemberEvents.length
        });
        
        current.setDate(current.getDate() + 1);
      }
      
      setCalendarData(calendarData);
    } catch (error) {
      console.error('Error fetching calendar data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load calendar data',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (filterKey: keyof EventFilter, value: boolean) => {
    setFilters(prev => ({
      ...prev,
      [filterKey]: value
    }));
  };

  const handleDateChange = (date: Date) => {
    setCurrentDate(date);
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    newDate.setMonth(currentDate.getMonth() + (direction === 'next' ? 1 : -1));
    setCurrentDate(newDate);
  };

  const handleCreateEvent = (eventType?: string) => {
    // Switch to private events view and trigger new event form
    setCurrentView('private-events');
    setSelectedEventType(eventType || '');
    setShouldOpenNewEventForm(true);
  };

  const handleEventCreated = () => {
    setIsEventDrawerOpen(false);
    setSelectedEventType('');
    if (currentView === 'month') {
      fetchCalendarData();
    }
    toast({
      title: 'Success',
      description: 'Event created successfully',
      status: 'success',
      duration: 3000,
      isClosable: true,
    });
  };

  const getFilteredCalendarData = () => {
    return calendarData.filter(day => {
      if (!filters.privateEvents && day.privateEvents.length > 0) return false;
      if (!filters.noirMemberEvents && day.noirMemberEvents.length > 0) return false;
      if (!filters.closedDays && !day.isOpen) return false;
      if (!filters.openDays && day.isOpen) return false;
      return true;
    });
  };

  const filteredData = getFilteredCalendarData();

  const renderView = () => {
    switch (currentView) {
      case 'month':
        return (
          <Box>
            {/* Filters */}
            <Box 
              bg="white" 
              borderRadius="10px" 
              p={6} 
              mb={6}
              border="2px solid"
              borderColor="gray.200"
              boxShadow="md"
            >
              <Text fontSize="lg" fontWeight="bold" mb={4} color="gray.700">Filters</Text>
              <CheckboxGroup>
                <HStack spacing={8} wrap="wrap">
                  <Checkbox
                    isChecked={filters.privateEvents}
                    onChange={(e) => handleFilterChange('privateEvents', e.target.checked)}
                    size="lg"
                    fontSize="md"
                    fontWeight="medium"
                  >
                    Private Events
                  </Checkbox>
                  <Checkbox
                    isChecked={filters.noirMemberEvents}
                    onChange={(e) => handleFilterChange('noirMemberEvents', e.target.checked)}
                    size="lg"
                    fontSize="md"
                    fontWeight="medium"
                  >
                    Noir Member Events
                  </Checkbox>
                  <Checkbox
                    isChecked={filters.closedDays}
                    onChange={(e) => handleFilterChange('closedDays', e.target.checked)}
                    size="lg"
                    fontSize="md"
                    fontWeight="medium"
                  >
                    Closed Days
                  </Checkbox>
                  <Checkbox
                    isChecked={filters.openDays}
                    onChange={(e) => handleFilterChange('openDays', e.target.checked)}
                    size="lg"
                    fontSize="md"
                    fontWeight="medium"
                  >
                    Open Days
                  </Checkbox>
                </HStack>
              </CheckboxGroup>
            </Box>

            {/* Month Navigation */}
            <Flex justify="space-between" align="center" mb={6}>
              <IconButton
                aria-label="Previous month"
                icon={<ChevronLeftIcon />}
                onClick={() => navigateMonth('prev')}
                variant="ghost"
                size="lg"
                borderRadius="10px"
                p={3}
                _hover={{ bg: 'gray.100' }}
              />
              <Text fontSize="3xl" fontWeight="bold" color="nightSky">
                {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </Text>
              <IconButton
                aria-label="Next month"
                icon={<ChevronRightIcon />}
                onClick={() => navigateMonth('next')}
                variant="ghost"
                size="lg"
                borderRadius="10px"
                p={3}
                _hover={{ bg: 'gray.100' }}
              />
            </Flex>

            {/* Calendar Grid */}
            {loading ? (
              <Box textAlign="center" py={8}>
                <Spinner size="lg" />
                <Text mt={4}>Loading calendar...</Text>
              </Box>
            ) : (
              <Box>
                {/* Day headers */}
                <Box display="grid" gridTemplateColumns="repeat(7, 1fr)" gap={2} mb={3}>
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <Box key={day} textAlign="center" p={3}>
                      <Text fontSize="md" fontWeight="bold" color="#353535">
                        {day}
                      </Text>
                    </Box>
                  ))}
                </Box>
                
                {/* Calendar grid */}
                <Box display="grid" gridTemplateColumns="repeat(7, 1fr)" gap={2}>
                  {filteredData.map((day, index) => (
                    <Box
                      key={index}
                      border="2px solid"
                      borderColor="#a59480"
                      borderRadius="10px"
                      p={3}
                      minH="140px"
                      bg={day.isCurrentMonth ? (day.isOpen ? 'white' : '#f0f0f0') : '#f5f5f5'}
                      opacity={day.isCurrentMonth && !day.isOpen ? 0.6 : 1}
                      cursor="pointer"
                      onClick={() => handleDateChange(day.date)}
                      _hover={{ bg: day.isCurrentMonth ? (day.isOpen ? '#f0f0f0' : '#e8e8e8') : '#e8e8e8' }}
                      transition="all 0.2s"
                    >
                      {/* Date number */}
                      <Text 
                        fontSize="sm" 
                        fontWeight="bold" 
                        color={day.isCurrentMonth ? (day.isOpen ? '#353535' : '#999') : '#999'}
                        mb={1}
                      >
                        {day.date.getDate()}
                      </Text>
                      
                      {/* Events */}
                      <VStack spacing={1} align="stretch" maxH="60px" overflow="hidden">
                        {day.privateEvents.slice(0, 2).map((event, eventIndex) => (
                          <Badge
                            key={eventIndex}
                            colorScheme="blue"
                            fontSize="10px"
                            p={1}
                            borderRadius="sm"
                            maxW="100%"
                            whiteSpace="normal"
                            textAlign="left"
                            lineHeight="1.2"
                            wordBreak="break-word"
                          >
                            {event.title.length > 15 ? `${event.title.substring(0, 15)}...` : event.title}
                          </Badge>
                        ))}
                        {day.noirMemberEvents.slice(0, 2).map((event, eventIndex) => (
                          <Badge
                            key={eventIndex}
                            colorScheme="green"
                            fontSize="10px"
                            p={1}
                            borderRadius="sm"
                            maxW="100%"
                            whiteSpace="normal"
                            textAlign="left"
                            lineHeight="1.2"
                            wordBreak="break-word"
                          >
                            {event.title.length > 15 ? `${event.title.substring(0, 15)}...` : event.title}
                          </Badge>
                        ))}
                        {day.totalEvents > 4 && (
                          <Text fontSize="10px" color="gray.500" textAlign="center">
                            +{day.totalEvents - 4} more
                          </Text>
                        )}
                      </VStack>
                    </Box>
                  ))}
                </Box>
              </Box>
            )}
          </Box>
        );
      case 'private-events':
        return <PrivateEventsView shouldOpenNewEventForm={shouldOpenNewEventForm} onFormOpened={() => setShouldOpenNewEventForm(false)} />;
      case 'custom-days':
        return <CustomDaysView />;
      default:
        return null;
    }
  };

  return (
    <AdminLayout>
      <Box p={6} maxW="1400px" mx="auto" bg="white" minH="100vh">
        {/* Header */}
        <Flex justify="space-between" align="center" mb={8}>
          <Heading size="2xl" color="nightSky" fontWeight="bold">Event Calendar</Heading>
          <HStack spacing={4}>
            <Button
              leftIcon={<AddIcon />}
              colorScheme="blue"
              size="lg"
              borderRadius="10px"
              px={8}
              py={4}
              fontSize="lg"
              fontWeight="semibold"
              onClick={() => handleCreateEvent()}
            >
              + Create Event
            </Button>
          </HStack>
        </Flex>

        {/* Top Navigation */}
        <Box 
          bg="white" 
          borderRadius="10px" 
          p={6} 
          mb={8}
          border="2px solid"
          borderColor="gray.200"
          boxShadow="md"
        >
          <HStack spacing={6} justify="center">
            <Button
              variant={currentView === 'month' ? 'solid' : 'outline'}
              colorScheme="blue"
              size="lg"
              borderRadius="10px"
              px={8}
              py={4}
              fontSize="lg"
              fontWeight="semibold"
              onClick={() => setCurrentView('month')}
            >
              Monthly Calendar
            </Button>
            <Button
              variant={currentView === 'private-events' ? 'solid' : 'outline'}
              colorScheme="blue"
              size="lg"
              borderRadius="10px"
              px={8}
              py={4}
              fontSize="lg"
              fontWeight="semibold"
              onClick={() => setCurrentView('private-events')}
            >
              Private Events
            </Button>
            <Button
              variant={currentView === 'custom-days' ? 'solid' : 'outline'}
              colorScheme="blue"
              size="lg"
              borderRadius="10px"
              px={8}
              py={4}
              fontSize="lg"
              fontWeight="semibold"
              onClick={() => setCurrentView('custom-days')}
            >
              Custom Days
            </Button>
          </HStack>
        </Box>

        {/* View Content */}
        {renderView()}
      </Box>
    </AdminLayout>
  );
}

// Helper function to check if a day is open for reservations
function isDayOpenOptimized(date: Date, baseHours: any[], exceptionalClosures: any[], privateEvents: any[]): boolean {
  try {
    const dateStr = date.toISOString().split('T')[0];
    const dayOfWeek = date.getDay();
    
    // Check for exceptional closure
    const exceptionalClosure = exceptionalClosures.find(closure => closure.date === dateStr);
    if (exceptionalClosure) {
      if (exceptionalClosure.full_day || !exceptionalClosure.time_ranges) {
        return false;
      }
    }
    
    // Check for private events that block this date
    const dayPrivateEvents = privateEvents.filter(ev => {
      const eventDate = ev.start_time.split('T')[0];
      return eventDate === dateStr && ev.full_day;
    });
    
    if (dayPrivateEvents.length > 0) {
      return false;
    }
    
    // Check if it's a base day or exceptional open
    const baseHoursForDay = baseHours.filter(h => h.day_of_week === dayOfWeek);
    const exceptionalOpen = exceptionalClosures.find(open => open.date === dateStr && open.type === 'exceptional_open');
    
    if (baseHoursForDay.length === 0 && !exceptionalOpen) {
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error checking if day is open:', error);
    return false;
  }
}

// Private Events View Component
function PrivateEventsView({ 
  shouldOpenNewEventForm, 
  onFormOpened 
}: { 
  shouldOpenNewEventForm: boolean; 
  onFormOpened: () => void; 
}) {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [eventReservations, setEventReservations] = useState<{[key: string]: number}>({});
  const [linkedReservations, setLinkedReservations] = useState<any[]>([]);
  const toast = useToast();

  const [formData, setFormData] = useState({
    title: '',
    event_type: 'Birthday',
    start_time: '',
    end_time: '',
    max_guests: 10,
    deposit_required: 0,
    event_description: '',
    rsvp_enabled: false,
    require_time_selection: false,
    total_attendees_maximum: 500,
    full_day: true
  });

  // Get timezone from settings if available
  const { settings } = useSettings ? useSettings() : { settings: { timezone: 'America/Chicago' } };
  const timezone = settings?.timezone || 'America/Chicago';

  const resetForm = () => {
    setFormData({
      title: '',
      event_type: 'Birthday',
      start_time: '',
      end_time: '',
      max_guests: 10,
      deposit_required: 0,
      event_description: '',
      rsvp_enabled: false,
      require_time_selection: false,
      total_attendees_maximum: 500,
      full_day: true
    });
    setEditingId(null);
    setImageFile(null);
    setImagePreview(null);
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  useEffect(() => {
    if (shouldOpenNewEventForm) {
      openNewEvent();
      onFormOpened();
    }
  }, [shouldOpenNewEventForm, onFormOpened]);

  const fetchEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('private_events')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching events:', error);
        toast({
          title: 'Error',
          description: 'Failed to load private events',
          status: 'error',
          duration: 3000,
        });
        return;
      }
      
      setEvents(data || []);

      // Fetch reservation counts for each event
      if (data && data.length > 0) {
        const eventIds = data.map(event => event.id);
        const { data: reservationCounts, error: countError } = await supabase
          .from('reservations')
          .select('private_event_id')
          .in('private_event_id', eventIds);

        if (!countError && reservationCounts) {
          const counts: {[key: string]: number} = {};
          reservationCounts.forEach(reservation => {
            if (reservation.private_event_id) {
              counts[reservation.private_event_id] = (counts[reservation.private_event_id] || 0) + 1;
            }
          });
          setEventReservations(counts);
        }
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadImage = async (eventId: string): Promise<string | null> => {
    if (!imageFile) return null;

    setUploadingImage(true);
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
        isClosable: true,
      });
      return null;
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      let eventData: any = {
        ...formData,
        created_by: user.id
      };

      if (formData.full_day) {
        // For full-day events, convert date to UTC start/end of day
        const date = formData.start_time ? formData.start_time.slice(0, 10) : '';
        if (date) {
          eventData.start_time = localInputToUTC(`${date}T00:00`, timezone);
          eventData.end_time = localInputToUTC(`${date}T23:59`, timezone);
        }
      } else {
        // Convert local datetime inputs to UTC
        if (formData.start_time) {
          eventData.start_time = localInputToUTC(formData.start_time, timezone);
        }
        if (formData.end_time) {
          eventData.end_time = localInputToUTC(formData.end_time, timezone);
        }
      }

      let backgroundImageUrl: string | null = null;
      if (imageFile) {
        if (editingId === 'new' || !editingId) {
          // Create event via API route (which handles RSVP URL generation)
          const { data: { session } } = await supabase.auth.getSession();
          const createResponse = await fetch('/api/private-events', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(session?.access_token && {
                'Authorization': `Bearer ${session.access_token}`
              })
            },
            body: JSON.stringify(eventData),
          });

          if (!createResponse.ok) {
            const errorData = await createResponse.json();
            throw new Error(errorData.error || 'Failed to create event');
          }

          const newEvent = await createResponse.json();

          // Upload image and update event
          backgroundImageUrl = await uploadImage(newEvent.id);
          if (backgroundImageUrl) {
            await supabase
              .from('private_events')
              .update({ background_image_url: backgroundImageUrl })
              .eq('id', newEvent.id);
          }

          toast({
            title: 'Success',
            description: 'Private event created successfully',
            status: 'success',
            duration: 3000,
          });
        } else {
          // For editing, upload image first
          backgroundImageUrl = await uploadImage(editingId);
          if (backgroundImageUrl) {
            eventData.background_image_url = backgroundImageUrl;
          }

          const { error: updateError } = await supabase
            .from('private_events')
            .update(eventData)
            .eq('id', editingId);

          if (updateError) throw updateError;

          toast({
            title: 'Success',
            description: 'Private event updated successfully',
            status: 'success',
            duration: 3000,
          });
        }
      } else {
        // No image to upload
        if (editingId === 'new' || !editingId) {
          // Create event via API route (which handles RSVP URL generation)
          const { data: { session } } = await supabase.auth.getSession();
          const createResponse = await fetch('/api/private-events', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(session?.access_token && {
                'Authorization': `Bearer ${session.access_token}`
              })
            },
            body: JSON.stringify(eventData),
          });

          if (!createResponse.ok) {
            const errorData = await createResponse.json();
            throw new Error(errorData.error || 'Failed to create event');
          }

          toast({
            title: 'Success',
            description: 'Private event created successfully',
            status: 'success',
            duration: 3000,
          });
        } else {
          const { error: updateError } = await supabase
            .from('private_events')
            .update(eventData)
            .eq('id', editingId);

          if (updateError) throw updateError;

          toast({
            title: 'Success',
            description: 'Private event updated successfully',
            status: 'success',
            duration: 3000,
          });
        }
      }

      resetForm();
      fetchEvents();
    } catch (error) {
      console.error('Error saving event:', error);
      toast({
        title: 'Error',
        description: 'Failed to save private event',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (event: any) => {
    setEditingId(event.id);
    setFormData({
      title: event.title,
      event_type: event.event_type,
      start_time: utcToLocalInput(event.start_time, 'America/Chicago'),
      end_time: utcToLocalInput(event.end_time, 'America/Chicago'),
      max_guests: event.max_guests,
      total_attendees_maximum: event.total_attendees_maximum,
      deposit_required: event.deposit_required,
      event_description: event.event_description || '',
      rsvp_enabled: event.rsvp_enabled,
      require_time_selection: event.require_time_selection,
      full_day: event.full_day
    });
    setImagePreview(event.background_image_url);

    // Fetch linked reservations for this event
    try {
      console.log('Fetching reservations for event:', event.id);
      console.log('Event data:', event);
      console.log('Event ID type:', typeof event.id);
      console.log('Event ID length:', event.id?.length);
      
      // Test 1: Get all reservations with private_event_id
      const { data: allReservations, error: allError } = await supabase
        .from('reservations')
        .select('id, private_event_id')
        .not('private_event_id', 'is', null);
      
      console.log('All reservations with private_event_id:', allReservations);
      
      // Test 2: Direct query for this specific event
      const { data: directQuery, error: directError } = await supabase
        .from('reservations')
        .select('*')
        .eq('private_event_id', event.id);
      
      console.log('Direct query for event', event.id, ':', directQuery);
      
      // Test 3: The actual query we want
      const { data: reservations, error } = await supabase
        .from('reservations')
        .select(`
          id,
          first_name,
          last_name,
          email,
          phone,
          party_size,
          start_time,
          created_at,
          private_event_id
        `)
        .eq('private_event_id', event.id)
        .order('created_at', { ascending: false });

      console.log('Final query result:', { data: reservations, error });
      
      if (error) {
        console.error('Error fetching linked reservations:', error);
      } else {
        console.log('Found reservations:', reservations);
        console.log('Setting linkedReservations to:', reservations || []);
        setLinkedReservations(reservations || []);
      }
    } catch (error) {
      console.error('Error fetching linked reservations:', error);
    }
  };

  const handleCancelEdit = () => {
    resetForm();
    setLinkedReservations([]);
  };

  const handleDelete = async (eventId: string) => {
    if (!confirm('Are you sure you want to delete this event?')) return;

    try {
      // First check if there are any reservations linked to this event
      const { data: reservations, error: checkError } = await supabase
        .from('reservations')
        .select('id')
        .eq('private_event_id', eventId);

      if (checkError) throw checkError;

      if (reservations && reservations.length > 0) {
        toast({
          title: 'Cannot Delete Event',
          description: `This event has ${reservations.length} linked reservation(s). Please cancel or reassign the reservations first.`,
          status: 'warning',
          duration: 5000,
          isClosable: true,
        });
        return;
      }

      // If no reservations are linked, proceed with deletion
      const { error } = await supabase
        .from('private_events')
        .delete()
        .eq('id', eventId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Event deleted successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

      fetchEvents();
    } catch (error) {
      console.error('Error deleting event:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete event',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const handleCancelEvent = async (eventId: string) => {
    if (!confirm('Are you sure you want to cancel this event? This will mark it as cancelled but keep it in the system.')) return;

    try {
      const { error } = await supabase
        .from('private_events')
        .update({ status: 'cancelled' })
        .eq('id', eventId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Event cancelled successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

      fetchEvents();
    } catch (error) {
      console.error('Error cancelling event:', error);
      toast({
        title: 'Error',
        description: 'Failed to cancel event',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const handleEditReservation = (reservation: any) => {
    // For now, just show an alert with reservation details
    // In the future, this could open a modal for editing
    alert(`Edit reservation for ${reservation.first_name} ${reservation.last_name}\nEmail: ${reservation.email}\nPhone: ${reservation.phone}\nParty Size: ${reservation.party_size}`);
  };

  const handleDeleteReservation = async (reservationId: string) => {
    if (!confirm('Are you sure you want to delete this reservation?')) return;

    try {
      const { error } = await supabase
        .from('reservations')
        .delete()
        .eq('id', reservationId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Reservation deleted successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

      // Refresh the linked reservations
      if (editingId) {
        const { data: reservations, error: fetchError } = await supabase
          .from('reservations')
          .select(`
            id,
            first_name,
            last_name,
            email,
            phone,
            party_size,
            start_time,
            created_at,
            private_event_id
          `)
          .eq('private_event_id', editingId)
          .order('created_at', { ascending: false });

        if (!fetchError) {
          setLinkedReservations(reservations || []);
        }
      }
    } catch (error) {
      console.error('Error deleting reservation:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete reservation',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const openNewEvent = () => {
    resetForm();
    setEditingId('new');
  };

  // Debug logging
  console.log('PrivateEventsView render:', { 
    editingId, 
    linkedReservationsLength: linkedReservations.length,
    linkedReservations: linkedReservations
  });

  // Debug RSVPs section rendering
  if (editingId) {
    console.log('About to render RSVPs section:', { 
      editingId, 
      linkedReservationsLength: linkedReservations.length,
      willShow: editingId && linkedReservations.length > 0
    });
  }

  const formatDate = (dateTime: string) => {
    try {
      const date = new Date(dateTime);
      if (isNaN(date.getTime())) {
        return 'Invalid Date';
      }
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      });
    } catch (error) {
      return 'Invalid Date';
    }
  };

  const formatTime = (dateTime: string) => {
    try {
      const date = new Date(dateTime);
      if (isNaN(date.getTime())) {
        return 'Invalid Time';
      }
      return date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
      });
    } catch (error) {
      return 'Invalid Time';
    }
  };

  const getEventTypeIcon = (eventType: string) => {
    const EVENT_TYPE_ICONS: { [key: string]: any } = {
      'Birthday': '🎂',
      'Anniversary': '💍',
      'Corporate Event': '🧑‍💼',
      'Wedding Reception': '💒',
      'Graduation': '🎓',
      'Holiday Party': '❄️',
      'Party': '🎉',
      'Wind Down Party': '🍸',
      'After Party': '🥳',
      'Rehearsal Dinner': '🍽️',
      'Noir Member Event': '⭐',
      'Other': '📅'
    };
    return EVENT_TYPE_ICONS[eventType] || '📅';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'green';
      case 'cancelled': return 'red';
      case 'completed': return 'blue';
      default: return 'gray';
    }
  };

  return (
    <Box>
      {/* Event Form */}
      {(editingId === 'new' || editingId || !events.length) && (
        <Box 
          bg="white" 
          borderRadius="10px" 
          p={6} 
          mb={6}
          border="2px solid"
          borderColor="gray.200"
          boxShadow="md"
        >
          <Heading size="lg" mb={6} color="nightSky" fontWeight="bold">
            {editingId === 'new' ? 'Create New Event' : editingId ? 'Edit Event' : 'Create New Event'}
          </Heading>
          <form onSubmit={handleSubmit}>
            <VStack spacing={4} align="stretch">
              <HStack spacing={4}>
                <FormControl isRequired>
                  <FormLabel>Event Title</FormLabel>
                  <Input
                    value={formData.title}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    placeholder="Enter event title"
                  />
                </FormControl>

                <FormControl isRequired>
                  <FormLabel>Event Type</FormLabel>
                  <Select
                    value={formData.event_type}
                    onChange={(e) => handleInputChange('event_type', e.target.value)}
                  >
                    <option value="Birthday">Birthday</option>
                    <option value="Anniversary">Anniversary</option>
                    <option value="Corporate Event">Corporate Event</option>
                    <option value="Wedding Reception">Wedding Reception</option>
                    <option value="Graduation">Graduation</option>
                    <option value="Holiday Party">Holiday Party</option>
                    <option value="Party">Party</option>
                    <option value="Wind Down Party">Wind Down Party</option>
                    <option value="After Party">After Party</option>
                    <option value="Rehearsal Dinner">Rehearsal Dinner</option>
                    <option value="Noir Member Event">Noir Member Event</option>
                    <option value="Other">Other</option>
                  </Select>
                </FormControl>
              </HStack>

              <HStack spacing={4}>
                <FormControl isRequired>
                  <FormLabel>Start Date & Time</FormLabel>
                  <Input
                    type="datetime-local"
                    value={formData.start_time}
                    onChange={(e) => handleInputChange('start_time', e.target.value)}
                  />
                </FormControl>

                <FormControl isRequired>
                  <FormLabel>End Date & Time</FormLabel>
                  <Input
                    type="datetime-local"
                    value={formData.end_time}
                    onChange={(e) => handleInputChange('end_time', e.target.value)}
                  />
                </FormControl>
              </HStack>

              <HStack spacing={4}>
                <FormControl isRequired>
                  <FormLabel>Max Guests per Reservation</FormLabel>
                  <NumberInput
                    value={formData.max_guests}
                    onChange={(_, value) => handleInputChange('max_guests', value)}
                    min={1}
                    max={100}
                  >
                    <NumberInputField />
                    <NumberInputStepper>
                      <NumberIncrementStepper />
                      <NumberDecrementStepper />
                    </NumberInputStepper>
                  </NumberInput>
                </FormControl>

                <FormControl isRequired>
                  <FormLabel>Total Max Attendees</FormLabel>
                  <NumberInput
                    value={formData.total_attendees_maximum}
                    onChange={(_, value) => handleInputChange('total_attendees_maximum', value)}
                    min={1}
                    max={1000}
                  >
                    <NumberInputField />
                    <NumberInputStepper>
                      <NumberIncrementStepper />
                      <NumberDecrementStepper />
                    </NumberInputStepper>
                  </NumberInput>
                </FormControl>

                <FormControl>
                  <FormLabel>Deposit Required ($)</FormLabel>
                  <NumberInput
                    value={formData.deposit_required}
                    onChange={(_, value) => handleInputChange('deposit_required', value)}
                    min={0}
                    max={10000}
                    precision={2}
                  >
                    <NumberInputField />
                    <NumberInputStepper>
                      <NumberIncrementStepper />
                      <NumberDecrementStepper />
                    </NumberInputStepper>
                  </NumberInput>
                </FormControl>
              </HStack>

              <FormControl>
                <FormLabel>Event Description</FormLabel>
                <Textarea
                  value={formData.event_description}
                  onChange={(e) => handleInputChange('event_description', e.target.value)}
                  placeholder="Enter event description..."
                  rows={3}
                />
              </FormControl>

              <HStack spacing={6}>
                <Checkbox
                  isChecked={formData.rsvp_enabled}
                  onChange={(e) => handleInputChange('rsvp_enabled', e.target.checked)}
                >
                  Enable RSVP
                </Checkbox>
                <Checkbox
                  isChecked={formData.require_time_selection}
                  onChange={(e) => handleInputChange('require_time_selection', e.target.checked)}
                >
                  Require Time Selection
                </Checkbox>
                <Checkbox
                  isChecked={formData.full_day}
                  onChange={(e) => handleInputChange('full_day', e.target.checked)}
                >
                  Full Day Event
                </Checkbox>
              </HStack>

              <FormControl>
                <FormLabel>Background Image</FormLabel>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                />
                {imagePreview && (
                  <Box mt={2}>
                    <Image src={imagePreview} alt="Preview" maxH="100px" borderRadius="md" />
                  </Box>
                )}
              </FormControl>

              <HStack spacing={4}>
                <Button
                  type="submit"
                  colorScheme="blue"
                  size="lg"
                  borderRadius="10px"
                  px={8}
                  py={4}
                  fontSize="lg"
                  fontWeight="semibold"
                  isLoading={saving}
                  loadingText="Saving..."
                >
                  {editingId ? 'Update Event' : 'Create Event'}
                </Button>
                {editingId && (
                  <Button
                    variant="outline"
                    size="lg"
                    borderRadius="10px"
                    px={8}
                    py={4}
                    fontSize="lg"
                    fontWeight="semibold"
                    onClick={handleCancelEdit}
                  >
                    Cancel
                  </Button>
                )}
              </HStack>
            </VStack>
          </form>

          {/* Linked Reservations Section - Only show when editing */}
          {editingId && (
            <Box mt={6} p={4} bg="gray.50" borderRadius="md" width="80%" mx="auto">
              <Heading size="sm" mb={3} color="nightSky">
                Linked Reservations ({linkedReservations.length})
                {linkedReservations.length === 0 && ' - No reservations found'}
              </Heading>
              <Table variant="simple" size="sm" width="100%">
                <Thead>
                  <Tr>
                    <Th fontSize="xs" py={1}>Guest</Th>
                    <Th fontSize="xs" py={1}>Email</Th>
                    <Th fontSize="xs" py={1}>Phone</Th>
                    <Th fontSize="xs" py={1}>Party Size</Th>
                    <Th fontSize="xs" py={1}>Reservation Time</Th>
                    <Th fontSize="xs" py={1}>Created</Th>
                    <Th fontSize="xs" py={1} width="80px">Actions</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {linkedReservations.length > 0 ? (
                    linkedReservations.map((reservation) => (
                      <Tr key={reservation.id}>
                        <Td py={1}>
                          <Text fontSize="xs" fontWeight="500">
                            {reservation.first_name} {reservation.last_name}
                          </Text>
                        </Td>
                        <Td py={1}>
                          <Text fontSize="xs">{reservation.email}</Text>
                        </Td>
                        <Td py={1}>
                          <Text fontSize="xs">{reservation.phone}</Text>
                        </Td>
                        <Td py={1}>
                          <Text fontSize="xs">{reservation.party_size}</Text>
                        </Td>
                        <Td py={1}>
                          <Text fontSize="xs">{formatTime(reservation.start_time)}</Text>
                        </Td>
                        <Td py={1}>
                          <Text fontSize="xs">{formatDate(reservation.created_at)}</Text>
                        </Td>
                        <Td py={1}>
                          <HStack spacing={1}>
                            <IconButton
                              aria-label="Edit reservation"
                              icon={<EditIcon />}
                              size="xs"
                              variant="ghost"
                              onClick={() => handleEditReservation(reservation)}
                            />
                            <IconButton
                              aria-label="Delete reservation"
                              icon={<DeleteIcon />}
                              size="xs"
                              variant="ghost"
                              colorScheme="red"
                              onClick={() => handleDeleteReservation(reservation.id)}
                            />
                          </HStack>
                        </Td>
                      </Tr>
                    ))
                  ) : (
                    <Tr>
                      <Td colSpan={7} py={4} textAlign="center">
                        <Text fontSize="xs" color="gray.500">No reservations found for this event</Text>
                      </Td>
                    </Tr>
                  )}
                </Tbody>
              </Table>
            </Box>
          )}
        </Box>
      )}

      {/* Events List */}
      {loading ? (
        <Box textAlign="center" py={8}>
          <Spinner size="lg" />
          <Text mt={4}>Loading events...</Text>
        </Box>
      ) : (
        <Box 
          bg="white" 
          borderRadius="10px" 
          p={6}
          border="2px solid"
          borderColor="gray.200"
          boxShadow="md"
          width="90%"
          mx="auto"
        >
          <Flex justify="space-between" align="center" mb={4}>
            <Heading size="md" color="nightSky">All Events</Heading>
            <Button
              leftIcon={<AddIcon />}
              colorScheme="blue"
              size="lg"
              borderRadius="10px"
              px={6}
              py={3}
              fontSize="md"
              fontWeight="semibold"
              onClick={openNewEvent}
            >
              + Create Private Event
            </Button>
          </Flex>
          {events.length === 0 ? (
            <Text color="gray.500" textAlign="center" py={8}>
              No events found. Create your first event above.
            </Text>
          ) : (
            <Table variant="simple" size="sm" width="100%">
              <Thead>
                <Tr>
                  <Th fontSize="sm" py={2} width="15%">Date</Th>
                  <Th fontSize="sm" py={2} width="18%">Time</Th>
                  <Th fontSize="sm" py={2} width="25%">Event</Th>
                  <Th fontSize="sm" py={2} width="20%">Type</Th>
                  <Th fontSize="sm" py={2} width="12%">Count</Th>
                  <Th fontSize="sm" py={2} width="10%">Actions</Th>
                </Tr>
              </Thead>
              <Tbody>
                {events
                  .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
                  .map((event) => (
                  <Tr key={event.id} _hover={{ bg: 'gray.50' }}>
                    <Td py={2}>
                      <Text fontSize="sm" fontWeight="500">{formatDate(event.start_time)}</Text>
                    </Td>
                    <Td py={2}>
                      <Text fontSize="sm" whiteSpace="nowrap">{formatTime(event.start_time)} - {formatTime(event.end_time)}</Text>
                    </Td>
                    <Td py={2}>
                      <Box>
                        <Text fontWeight="600" fontSize="sm">{event.title}</Text>
                        {event.event_description && (
                          <Text fontSize="xs" color="gray.600" noOfLines={1}>
                            {event.event_description}
                          </Text>
                        )}
                      </Box>
                    </Td>
                    <Td py={2}>
                      <HStack spacing={1}>
                        <Text fontSize="sm">{getEventTypeIcon(event.event_type)}</Text>
                        <Text fontSize="sm">{event.event_type}</Text>
                      </HStack>
                    </Td>
                    <Td py={2}>
                      <Text fontSize="sm" color={eventReservations[event.id] ? 'orange.600' : 'gray.500'}>
                        {eventReservations[event.id] || 0}
                      </Text>
                    </Td>
                    <Td py={2}>
                      <HStack spacing={2}>
                        {event.rsvp_enabled && event.rsvp_url && (
                          <IconButton
                            aria-label="View RSVP"
                            icon={<ExternalLinkIcon />}
                            size="sm"
                            variant="ghost"
                            colorScheme="blue"
                            onClick={() => window.open(`/rsvp/${event.rsvp_url}`, '_blank')}
                            title="View RSVP Link"
                          />
                        )}
                        <IconButton
                          aria-label="Edit event"
                          icon={<EditIcon />}
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEdit(event)}
                        />
                        {eventReservations[event.id] ? (
                          <IconButton
                            aria-label="Cancel event"
                            icon={<CloseIcon />}
                            size="sm"
                            variant="ghost"
                            colorScheme="orange"
                            onClick={() => handleCancelEvent(event.id)}
                            title="Cancel event (has reservations)"
                          />
                        ) : (
                          <IconButton
                            aria-label="Delete event"
                            icon={<DeleteIcon />}
                            size="sm"
                            variant="ghost"
                            colorScheme="red"
                            onClick={() => handleDelete(event.id)}
                          />
                        )}
                      </HStack>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          )}
        </Box>
      )}
    </Box>
  );
}

// Custom Days View Component
function CustomDaysView() {
  const [customDays, setCustomDays] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const toast = useToast();

  const [formData, setFormData] = useState({
    date: '',
    type: 'exceptional_open' as 'exceptional_open' | 'exceptional_closure',
    full_day: true,
    time_ranges: [{ start_time: '09:00', end_time: '17:00' }]
  });

  useEffect(() => {
    fetchCustomDays();
  }, []);

  const fetchCustomDays = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('venue_hours')
        .select('*')
        .in('type', ['exceptional_open', 'exceptional_closure'])
        .order('date', { ascending: false });

      if (error) throw error;
      setCustomDays(data || []);
    } catch (error) {
      console.error('Error fetching custom days:', error);
      toast({
        title: 'Error',
        description: 'Failed to load custom days',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleTimeRangeChange = (index: number, field: 'start_time' | 'end_time', value: string) => {
    const newTimeRanges = [...formData.time_ranges];
    newTimeRanges[index] = {
      ...newTimeRanges[index],
      [field]: value
    };
    handleInputChange('time_ranges', newTimeRanges);
  };

  const addTimeRange = () => {
    setFormData(prev => ({
      ...prev,
      time_ranges: [...prev.time_ranges, { start_time: '09:00', end_time: '17:00' }]
    }));
  };

  const removeTimeRange = (index: number) => {
    if (formData.time_ranges.length > 1) {
      const newTimeRanges = formData.time_ranges.filter((_, i) => i !== index);
      handleInputChange('time_ranges', newTimeRanges);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      // Validate required fields
      if (!formData.date) {
        toast({
          title: 'Validation Error',
          description: 'Please select a date',
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
        return;
      }

      if (!formData.full_day && formData.time_ranges.length === 0) {
        toast({
          title: 'Validation Error',
          description: 'Please add at least one time range',
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
        return;
      }

      // Create custom day data
      const customDayData = {
        date: formData.date,
        type: formData.type,
        full_day: formData.full_day,
        time_ranges: formData.full_day ? null : formData.time_ranges
      };

      if (editingId) {
        // Update existing custom day
        const { error: updateError } = await supabase
          .from('venue_hours')
          .update(customDayData)
          .eq('id', editingId);

        if (updateError) throw updateError;
      } else {
        // Create new custom day
        const { error: insertError } = await supabase
          .from('venue_hours')
          .insert(customDayData);

        if (insertError) throw insertError;
      }

      toast({
        title: 'Success',
        description: editingId ? 'Custom day updated successfully' : 'Custom day created successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

      resetForm();
      fetchCustomDays();
    } catch (error) {
      console.error('Error saving custom day:', error);
      toast({
        title: 'Error',
        description: 'Failed to save custom day',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (customDay: any) => {
    setEditingId(customDay.id);
    setFormData({
      date: customDay.date,
      type: customDay.type,
      full_day: customDay.full_day,
      time_ranges: customDay.time_ranges || [{ start_time: '09:00', end_time: '17:00' }]
    });
  };

  const handleCancelEdit = () => {
    resetForm();
  };

  const handleDelete = async (customDayId: string) => {
    if (!confirm('Are you sure you want to delete this custom day?')) return;

    try {
      const { error } = await supabase
        .from('venue_hours')
        .delete()
        .eq('id', customDayId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Custom day deleted successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

      fetchCustomDays();
    } catch (error) {
      console.error('Error deleting custom day:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete custom day',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const resetForm = () => {
    setFormData({
      date: '',
      type: 'exceptional_open',
      full_day: true,
      time_ranges: [{ start_time: '09:00', end_time: '17:00' }]
    });
    setEditingId(null);
  };

  const openNewCustomDay = () => {
    resetForm();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getTypeColor = (type: string) => {
    return type === 'exceptional_open' ? 'green' : 'red';
  };

  const getTypeLabel = (type: string) => {
    return type === 'exceptional_open' ? 'Open Day' : 'Closed Day';
  };

  const getTypeIcon = (type: string) => {
    return type === 'exceptional_open' ? <CheckIcon /> : <CloseIcon />;
  };

  return (
    <Box>
      {/* Custom Day Form */}
      {(editingId || !customDays.length) && (
        <Box 
          bg="white" 
          borderRadius="10px" 
          p={6} 
          mb={6}
          border="2px solid"
          borderColor="gray.200"
          boxShadow="md"
        >
          <Heading size="lg" mb={6} color="nightSky" fontWeight="bold">
            {editingId ? 'Edit Custom Day' : 'Add Custom Day'}
          </Heading>
          <form onSubmit={handleSubmit}>
            <VStack spacing={4} align="stretch">
              <HStack spacing={4}>
                <FormControl isRequired>
                  <FormLabel>Date</FormLabel>
                  <Input
                    type="date"
                    value={formData.date}
                    onChange={(e) => handleInputChange('date', e.target.value)}
                  />
                </FormControl>

                <FormControl isRequired>
                  <FormLabel>Type</FormLabel>
                  <Select
                    value={formData.type}
                    onChange={(e) => handleInputChange('type', e.target.value)}
                  >
                    <option value="exceptional_open">Open Day</option>
                    <option value="exceptional_closure">Closed Day</option>
                  </Select>
                </FormControl>
              </HStack>

              <FormControl>
                <Checkbox
                  isChecked={formData.full_day}
                  onChange={(e) => handleInputChange('full_day', e.target.checked)}
                >
                  Full Day
                </Checkbox>
              </FormControl>

              {!formData.full_day && (
                <Box>
                  <Text fontWeight="600" mb={3}>Time Ranges</Text>
                  <VStack spacing={3} align="stretch">
                    {formData.time_ranges.map((range, index) => (
                      <HStack key={index} spacing={3}>
                        <FormControl>
                          <FormLabel>Start Time</FormLabel>
                          <Input
                            type="time"
                            value={range.start_time}
                            onChange={(e) => handleTimeRangeChange(index, 'start_time', e.target.value)}
                          />
                        </FormControl>
                        <FormControl>
                          <FormLabel>End Time</FormLabel>
                          <Input
                            type="time"
                            value={range.end_time}
                            onChange={(e) => handleTimeRangeChange(index, 'end_time', e.target.value)}
                          />
                        </FormControl>
                        {formData.time_ranges.length > 1 && (
                          <IconButton
                            aria-label="Remove time range"
                            icon={<DeleteIcon />}
                            size="sm"
                            variant="ghost"
                            colorScheme="red"
                            onClick={() => removeTimeRange(index)}
                          />
                        )}
                      </HStack>
                    ))}
                    <Button
                      size="md"
                      variant="outline"
                      borderRadius="10px"
                      px={6}
                      py={3}
                      fontSize="md"
                      fontWeight="semibold"
                      onClick={addTimeRange}
                      leftIcon={<AddIcon />}
                    >
                      Add Time Range
                    </Button>
                  </VStack>
                </Box>
              )}

              <HStack spacing={4}>
                <Button
                  type="submit"
                  colorScheme="blue"
                  size="lg"
                  borderRadius="10px"
                  px={8}
                  py={4}
                  fontSize="lg"
                  fontWeight="semibold"
                  isLoading={saving}
                  loadingText="Saving..."
                >
                  {editingId ? 'Update Custom Day' : 'Add Custom Day'}
                </Button>
                {editingId && (
                  <Button
                    variant="outline"
                    size="lg"
                    borderRadius="10px"
                    px={8}
                    py={4}
                    fontSize="lg"
                    fontWeight="semibold"
                    onClick={handleCancelEdit}
                  >
                    Cancel
                  </Button>
                )}
              </HStack>
            </VStack>
          </form>
        </Box>
      )}

      {/* Custom Days List */}
      {loading ? (
        <Box textAlign="center" py={8}>
          <Spinner size="lg" />
          <Text mt={4}>Loading custom days...</Text>
        </Box>
      ) : (
        <Box 
          bg="white" 
          borderRadius="10px" 
          p={6}
          border="2px solid"
          borderColor="gray.200"
          boxShadow="md"
        >
          <Heading size="lg" mb={6} color="nightSky" fontWeight="bold">All Custom Days</Heading>
          {customDays.length === 0 ? (
            <Text color="gray.500" textAlign="center" py={8}>
              No custom days found. Add your first custom day above.
            </Text>
          ) : (
            <Table variant="simple">
              <Thead>
                <Tr>
                  <Th>Date</Th>
                  <Th>Type</Th>
                  <Th>Schedule</Th>
                  <Th>Actions</Th>
                </Tr>
              </Thead>
              <Tbody>
                {customDays.map((customDay) => (
                  <Tr key={customDay.id}>
                    <Td>
                      <Text fontWeight="600">{formatDate(customDay.date)}</Text>
                    </Td>
                    <Td>
                      <HStack>
                        {getTypeIcon(customDay.type)}
                        <Badge colorScheme={getTypeColor(customDay.type)}>
                          {getTypeLabel(customDay.type)}
                        </Badge>
                      </HStack>
                    </Td>
                    <Td>
                      {customDay.full_day ? (
                        <Text color="gray.600">Full Day</Text>
                      ) : (
                        <VStack align="start" spacing={1}>
                          {customDay.time_ranges?.map((range: any, index: number) => (
                            <Text key={index} fontSize="sm">
                              {range.start_time} - {range.end_time}
                            </Text>
                          ))}
                        </VStack>
                      )}
                    </Td>
                    <Td>
                      <HStack spacing={2}>
                        <IconButton
                          aria-label="Edit custom day"
                          icon={<EditIcon />}
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEdit(customDay)}
                        />
                        <IconButton
                          aria-label="Delete custom day"
                          icon={<DeleteIcon />}
                          size="sm"
                          variant="ghost"
                          colorScheme="red"
                          onClick={() => handleDelete(customDay.id)}
                        />
                      </HStack>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          )}
        </Box>
      )}
    </Box>
  );
} 