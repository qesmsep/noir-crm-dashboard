import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  FormControl,
  FormLabel,
  Input,
  Textarea,
  Select,
  Checkbox,
  VStack,
  HStack,
  Text,
  Image,
  useToast,
  Badge,
  IconButton,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Heading,
  Flex,
  Spinner,
  InputGroup,
  InputLeftAddon,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
  FormHelperText
} from '@chakra-ui/react';
import { 
  EditIcon, 
  DeleteIcon, 
  ExternalLinkIcon, 
  CheckIcon, 
  CloseIcon,
  CalendarIcon,
  TimeIcon,
  StarIcon,
  ViewIcon,
  InfoIcon,
  ChatIcon,
  TriangleDownIcon,
  SettingsIcon
} from '@chakra-ui/icons';
import { supabase } from '@/lib/supabase';
import { useSettings } from '@/context/SettingsContext';

interface PrivateEvent {
  id: string;
  title: string;
  event_type: string;
  start_time: string;
  end_time: string;
  max_guests: number;
  total_attendees_maximum: number;
  deposit_required: number;
  event_description: string;
  rsvp_enabled: boolean;
  rsvp_url: string | null;
  background_image_url: string | null;
  require_time_selection: boolean;
  status: 'active' | 'cancelled' | 'completed';
  created_at: string;
  created_by: string | null;
  full_day: boolean;
}

const EVENT_TYPES = [
  'Birthday',
  'Anniversary',
  'Corporate Event',
  'Wedding Reception',
  'Graduation',
  'Holiday Party',
  'Party',
  'Other'
];

const EVENT_TYPE_ICONS: { [key: string]: any } = {
  'Birthday': ViewIcon,
  'Anniversary': ChatIcon,
  'Corporate Event': InfoIcon,
  'Wedding Reception': StarIcon,
  'Graduation': TriangleDownIcon,
  'Holiday Party': SettingsIcon,
  'Party': SettingsIcon,
  'Other': SettingsIcon
};

export default function PrivateEventsManager() {
  const [events, setEvents] = useState<PrivateEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
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

  // Move resetForm here so it can access the state setters
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
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadImage = async (eventId: string): Promise<string | null> => {
    if (!imageFile) return null;

    try {
      setUploadingImage(true);
      const formData = new FormData();
      formData.append('file', imageFile);
      formData.append('eventId', eventId);

      const response = await fetch('/api/upload-image', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error);

      return result.url;
    } catch (error) {
      console.error('Error uploading image:', error);
      toast({
        title: 'Error',
        description: 'Failed to upload image',
        status: 'error',
        duration: 3000,
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
        // Ensure start_time and end_time are set to 00:00 and 23:59 for the selected date
        const date = formData.start_time ? formData.start_time.slice(0, 10) : '';
        eventData.start_time = `${date}T00:00`;
        eventData.end_time = `${date}T23:59`;
      }

      let backgroundImageUrl = null;
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

  const handleEdit = (event: PrivateEvent) => {
    setEditingId(event.id);
    setFormData({
      title: event.title,
      event_type: event.event_type,
      start_time: new Date(event.start_time).toISOString().slice(0, 16),
      end_time: new Date(event.end_time).toISOString().slice(0, 16),
      max_guests: event.max_guests,
      deposit_required: event.deposit_required,
      event_description: event.event_description || '',
      rsvp_enabled: event.rsvp_enabled,
      require_time_selection: event.require_time_selection,
      total_attendees_maximum: event.total_attendees_maximum,
      full_day: event.full_day || false
    });
    setImagePreview(event.background_image_url);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    resetForm();
  };

  const handleDelete = async (eventId: string) => {
    if (!confirm('Are you sure you want to delete this private event? This will also delete all reservations associated with this event.')) return;

    try {
      // First, delete all reservations linked to this private event
      const { error: reservationsError } = await supabase
        .from('reservations')
        .delete()
        .eq('private_event_id', eventId);

      if (reservationsError) {
        console.error('Error deleting linked reservations:', reservationsError);
        toast({
          title: 'Error',
          description: 'Failed to delete linked reservations',
          status: 'error',
          duration: 3000,
        });
        return;
      }

      // Then delete the private event
      const { error: eventError } = await supabase
        .from('private_events')
        .delete()
        .eq('id', eventId);

      if (eventError) throw eventError;

      toast({
        title: 'Success',
        description: 'Private event and all associated reservations deleted successfully',
        status: 'success',
        duration: 3000,
      });

      fetchEvents();
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

  const openNewEvent = () => {
    resetForm();
    setEditingId('new');
  };

  const formatDate = (dateTime: string, timezone?: string) => {
    const date = timezone ? new Date(new Date(dateTime).toLocaleString('en-US', { timeZone: timezone })) : new Date(dateTime);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatTime = (dateTime: string, timezone?: string) => {
    const date = timezone ? new Date(new Date(dateTime).toLocaleString('en-US', { timeZone: timezone })) : new Date(dateTime);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const getEventTypeIcon = (eventType: string) => {
    const IconComponent = EVENT_TYPE_ICONS[eventType] || SettingsIcon;
    return <IconComponent />;
  };

  // Get timezone from settings if available
  const { settings } = useSettings ? useSettings() : { settings: { timezone: undefined } };
  const timezone = settings?.timezone;

  if (loading) {
    return (
      <Box textAlign="center" py={8}>
        <Spinner size="lg" />
        <Text mt={4}>Loading private events...</Text>
      </Box>
    );
  }

  return (
    <Box>
      <Flex justify="space-between" align="center" mb={6}>
        <Heading size="md" color="nightSky" fontWeight="600">
          Private Events
        </Heading>
        <Button
          colorScheme="blue"
          onClick={openNewEvent}
          leftIcon={<EditIcon />}
        >
          Create Private Event
        </Button>
      </Flex>

      {/* New Event Form */}
      {editingId === 'new' && (
        <Box 
          bg="white" 
          borderRadius="lg" 
          p={6} 
          mb={6}
          border="1px solid"
          borderColor="gray.200"
          boxShadow="sm"
        >
          <Heading size="sm" mb={4} color="nightSky">Create New Private Event</Heading>
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
                    {EVENT_TYPES.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </Select>
                </FormControl>
              </HStack>

              <FormControl>
                <FormLabel>Full Day</FormLabel>
                <Checkbox
                  isChecked={formData.full_day}
                  onChange={e => {
                    const checked = e.target.checked;
                    handleInputChange('full_day', checked);
                    if (checked) {
                      // Set start/end times to full day defaults if checked
                      const today = formData.start_time ? new Date(formData.start_time) : new Date();
                      const yyyy = today.getFullYear();
                      const mm = String(today.getMonth() + 1).padStart(2, '0');
                      const dd = String(today.getDate()).padStart(2, '0');
                      handleInputChange('start_time', `${yyyy}-${mm}-${dd}T00:00`);
                      handleInputChange('end_time', `${yyyy}-${mm}-${dd}T23:59`);
                    }
                  }}
                >
                  Full Day
                </Checkbox>
              </FormControl>

              {!formData.full_day && (
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
              )}
              {formData.full_day && (
                <HStack spacing={4}>
                  <FormControl isRequired>
                    <FormLabel>Start Date</FormLabel>
                    <Input
                      type="date"
                      value={formData.start_time ? formData.start_time.slice(0, 10) : ''}
                      onChange={(e) => {
                        const date = e.target.value;
                        handleInputChange('start_time', `${date}T00:00`);
                        handleInputChange('end_time', `${date}T23:59`);
                      }}
                    />
                  </FormControl>
                </HStack>
              )}

              <HStack spacing={4}>
                <FormControl isRequired>
                  <FormLabel>Maximum Guests per Reservation</FormLabel>
                  <NumberInput
                    min={1}
                    max={50}
                    value={formData.max_guests}
                    onChange={(valueString) => setFormData(prev => ({ ...prev, max_guests: parseInt(valueString) || 1 }))}
                  >
                    <NumberInputField />
                    <NumberInputStepper>
                      <NumberIncrementStepper />
                      <NumberDecrementStepper />
                    </NumberInputStepper>
                  </NumberInput>
                  <FormHelperText>Maximum number of guests one person can reserve for</FormHelperText>
                </FormControl>

                <FormControl isRequired>
                  <FormLabel>Total Event Capacity</FormLabel>
                  <NumberInput
                    min={1}
                    max={500}
                    value={formData.total_attendees_maximum}
                    onChange={(valueString) => setFormData(prev => ({ ...prev, total_attendees_maximum: parseInt(valueString) || 1 }))}
                  >
                    <NumberInputField />
                    <NumberInputStepper>
                      <NumberIncrementStepper />
                      <NumberDecrementStepper />
                    </NumberInputStepper>
                  </NumberInput>
                  <FormHelperText>Total maximum number of attendees for the entire event</FormHelperText>
                </FormControl>

                <FormControl>
                  <FormLabel>Deposit Required ($)</FormLabel>
                  <NumberInput
                    value={formData.deposit_required}
                    onChange={(value) => handleInputChange('deposit_required', parseFloat(value) || 0)}
                    min={0}
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
                  placeholder="Enter event description"
                  rows={3}
                />
              </FormControl>

              <FormControl>
                <Checkbox
                  isChecked={formData.rsvp_enabled}
                  onChange={(e) => handleInputChange('rsvp_enabled', e.target.checked)}
                >
                  Enable unique RSVP modal and link for this event
                </Checkbox>
              </FormControl>

              {formData.rsvp_enabled && (
                <>
                  <FormControl>
                    <FormLabel>RSVP Modal Background Image</FormLabel>
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                    />
                    {imagePreview && (
                      <Box mt={2}>
                        <Image
                          src={imagePreview}
                          alt="Background preview"
                          maxH="200px"
                          borderRadius="md"
                        />
                      </Box>
                    )}
                  </FormControl>

                  <FormControl>
                    <Checkbox
                      isChecked={formData.require_time_selection}
                      onChange={(e) => handleInputChange('require_time_selection', e.target.checked)}
                    >
                      Require RSVP guests to select a specific time within the event window
                    </Checkbox>
                  </FormControl>
                </>
              )}

              <HStack spacing={4} justify="flex-end">
                <Button variant="ghost" onClick={handleCancelEdit}>
                  Cancel
                </Button>
                <Button
                  colorScheme="blue"
                  type="submit"
                  isLoading={saving || uploadingImage}
                  loadingText="Saving..."
                >
                  Create Event
                </Button>
              </HStack>
            </VStack>
          </form>
        </Box>
      )}

      {/* Events Table */}
      <Box overflowX="auto" width="90%" bg="white" borderRadius="lg" boxShadow="lg" border="1px solid" marginBottom="50px" borderColor="gray.200">
        <Table variant="simple" border="1px solid" borderColor="gray.200">
          <Thead bg="gray.50">
            <Tr borderBottom="1px solid" borderColor="gray.200">
              <Th borderRight="1px solid" margin="0" width="15%" borderColor="gray.200" py={4} px={4} fontWeight="600" color="gray.700">Event Type</Th>
              <Th borderRight="1px solid" margin="0" width="20%" borderColor="gray.200" py={4} px={4} fontWeight="600" color="gray.700">Event Name</Th>
              <Th borderRight="1px solid" margin="0" width="12%" borderColor="gray.200" py={4} px={4} fontWeight="600" color="gray.700">Date</Th>
              <Th borderRight="1px solid" margin="0" width="18%" borderColor="gray.200" py={4} px={4} fontWeight="600" color="gray.700">Time</Th>
              <Th borderRight="1px solid" margin="0" width="8%" borderColor="gray.200" py={4} px={4} fontWeight="600" color="gray.700">Max Guests</Th>
              <Th borderRight="1px solid" margin="0" width="8%" borderColor="gray.200" py={4} px={4} fontWeight="600" color="gray.700">Capacity</Th>
              <Th borderRight="1px solid" margin="0" width="8%" borderColor="gray.200" py={4} px={4} fontWeight="600" color="gray.700">RSVP</Th> 
              <Th borderRight="1px solid" margin="0" width="8%" borderColor="gray.200" py={4} px={4} fontWeight="600" color="gray.700">Status</Th>
              <Th width="17%" margin="0" py={4} px={4} fontWeight="600" color="gray.700">Actions</Th>
            </Tr>
          </Thead>
          <Tbody>
            {events.map((event) => (
              <React.Fragment key={event.id}>
                {/* Normal Row */}
                {editingId !== event.id && (
                  <Tr margin="0" borderBottom="1px solid" borderColor="gray.200" _hover={{ bg: "gray.50" }} transition="background-color 0.2s">
                    <Td margin="0" borderRight="1px solid" borderColor="gray.200" py={4} px={4}>
                      <HStack spacing={2} align="center">
                        <Box color="purple.500" fontSize="lg">
                          {getEventTypeIcon(event.event_type)}
                        </Box>
                        <Text fontSize="sm" color="gray.600" fontWeight="500">
                          {event.event_type}
                        </Text>
                      </HStack>
                    </Td>
                    <Td borderRight="1px solid" borderColor="gray.200" py={4} px={4}>
                      <Text fontWeight="600" margin="0" fontSize="md" color="gray.800">{event.title}</Text>
                    </Td>
                    <Td borderRight="1px solid" borderColor="gray.200" py={4} px={4}>
                      <HStack spacing={1} align="center">
                        <Text fontSize="sm" fontWeight="500" color="gray.800">
                          {formatDate(event.start_time, timezone)}
                        </Text>
                      </HStack>
                    </Td>
                    <Td borderRight="1px solid" borderColor="gray.200" py={4} px={4}>
                      <HStack spacing={1} align="center">
                        <Text fontSize="sm" fontWeight="500" color="gray.800">
                          {event.full_day
                            ? 'Full Day'
                            : `${formatTime(event.start_time, timezone)} - ${formatTime(event.end_time, timezone)}`}
                        </Text>
                      </HStack>
                    </Td>
                    <Td borderRight="1px solid" borderColor="gray.200" py={4} px={4}>
                      <Text fontWeight="500" color="gray.800">{event.max_guests}</Text>
                    </Td>
                    <Td borderRight="1px solid" borderColor="gray.200" py={4} px={4}>
                      <Text fontWeight="500" color="gray.800">{event.total_attendees_maximum}</Text>
                    </Td>
                    <Td borderRight="1px solid" borderColor="gray.200" py={4} px={4}>
                      {event.rsvp_enabled ? (
                        <Badge colorScheme="green" size="sm" borderRadius="full" px={3} py={1}>Enabled</Badge>
                      ) : (
                        <Badge colorScheme="gray" size="sm" borderRadius="full" px={3} py={1}>Disabled</Badge>
                      )}
                    </Td>
                    <Td borderRight="1px solid" borderColor="gray.200" py={4} px={4}>
                      <Badge
                        colorScheme={
                          event.status === 'active' ? 'green' :
                          event.status === 'cancelled' ? 'red' : 'blue'
                        }
                        size="sm"
                        borderRadius="full"
                        px={3}
                        py={1}
                        textTransform="capitalize"
                      >
                        {event.status}
                      </Badge>
                    </Td>
                    <Td py={8} px={8}>
                      <HStack spacing={2}>
                        {event.rsvp_enabled && event.rsvp_url && (
                          <IconButton
                            size="20px"
                            icon={<ExternalLinkIcon />}
                            aria-label="View RSVP"
                            onClick={() => window.open(`/rsvp/${event.rsvp_url}`, '_blank')}
                            colorScheme="blue"
                            variant="outline"
                            borderRadius="md"
                          />
                        )}
                        <IconButton
                          size="20px"
                          icon={<EditIcon />}
                          aria-label="Edit event"
                          onClick={() => handleEdit(event)}
                          colorScheme="blue"
                          variant="ghost"
                          borderRadius="md"
                          _hover={{ bg: "blue.50" }}
                        />
                        <IconButton
                          size="20px"
                          icon={<DeleteIcon />}
                          aria-label="Delete event"
                          colorScheme="red"
                          variant="ghost"
                          onClick={() => handleDelete(event.id)}
                          borderRadius="md"
                          _hover={{ bg: "red.50" }}
                        />
                      </HStack>
                    </Td>
                  </Tr>
                )}

                {/* Edit Row */}
                {editingId === event.id && (
                  <Tr bg="blue.50" borderBottom="1px solid" borderColor="gray.200">
                    <Td colSpan={8} border="1px solid" borderColor="gray.200" p={0}>
                      <Box p={6} bg="white" m={2} borderRadius="lg" border="1px solid" borderColor="blue.200">
                        <Heading size="sm" mb={4} color="nightSky">Edit Private Event</Heading>
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
                                  {EVENT_TYPES.map(type => (
                                    <option key={type} value={type}>{type}</option>
                                  ))}
                                </Select>
                              </FormControl>
                            </HStack>

                            <FormControl>
                              <FormLabel>Full Day</FormLabel>
                              <Checkbox
                                isChecked={formData.full_day}
                                onChange={e => {
                                  const checked = e.target.checked;
                                  handleInputChange('full_day', checked);
                                  if (checked) {
                                    // Set start/end times to full day defaults if checked
                                    const today = formData.start_time ? new Date(formData.start_time) : new Date();
                                    const yyyy = today.getFullYear();
                                    const mm = String(today.getMonth() + 1).padStart(2, '0');
                                    const dd = String(today.getDate()).padStart(2, '0');
                                    handleInputChange('start_time', `${yyyy}-${mm}-${dd}T00:00`);
                                    handleInputChange('end_time', `${yyyy}-${mm}-${dd}T23:59`);
                                  }
                                }}
                              >
                                Full Day
                              </Checkbox>
                            </FormControl>

                            {!formData.full_day && (
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
                            )}
                            {formData.full_day && (
                              <HStack spacing={4}>
                                <FormControl isRequired>
                                  <FormLabel>Start Date</FormLabel>
                                  <Input
                                    type="date"
                                    value={formData.start_time ? formData.start_time.slice(0, 10) : ''}
                                    onChange={(e) => {
                                      const date = e.target.value;
                                      handleInputChange('start_time', `${date}T00:00`);
                                      handleInputChange('end_time', `${date}T23:59`);
                                    }}
                                  />
                                </FormControl>
                              </HStack>
                            )}

                            <HStack spacing={4}>
                              <FormControl isRequired>
                                <FormLabel>Maximum Guests per Reservation</FormLabel>
                                <NumberInput
                                  min={1}
                                  max={50}
                                  value={formData.max_guests}
                                  onChange={(valueString) => setFormData(prev => ({ ...prev, max_guests: parseInt(valueString) || 1 }))}
                                >
                                  <NumberInputField />
                                  <NumberInputStepper>
                                    <NumberIncrementStepper />
                                    <NumberDecrementStepper />
                                  </NumberInputStepper>
                                </NumberInput>
                                <FormHelperText>Maximum number of guests one person can reserve for</FormHelperText>
                              </FormControl>

                              <FormControl isRequired>
                                <FormLabel>Total Event Capacity</FormLabel>
                                <NumberInput
                                  min={1}
                                  max={500}
                                  value={formData.total_attendees_maximum}
                                  onChange={(valueString) => setFormData(prev => ({ ...prev, total_attendees_maximum: parseInt(valueString) || 1 }))}
                                >
                                  <NumberInputField />
                                  <NumberInputStepper>
                                    <NumberIncrementStepper />
                                    <NumberDecrementStepper />
                                  </NumberInputStepper>
                                </NumberInput>
                                <FormHelperText>Total maximum number of attendees for the entire event</FormHelperText>
                              </FormControl>

                              <FormControl>
                                <FormLabel>Deposit Required ($)</FormLabel>
                                <NumberInput
                                  value={formData.deposit_required}
                                  onChange={(value) => handleInputChange('deposit_required', parseFloat(value) || 0)}
                                  min={0}
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
                                placeholder="Enter event description"
                                rows={3}
                              />
                            </FormControl>

                            <FormControl>
                              <Checkbox
                                isChecked={formData.rsvp_enabled}
                                onChange={(e) => handleInputChange('rsvp_enabled', e.target.checked)}
                              >
                                Enable unique RSVP modal and link for this event
                              </Checkbox>
                            </FormControl>

                            {formData.rsvp_enabled && (
                              <>
                                <FormControl>
                                  <FormLabel>RSVP Modal Background Image</FormLabel>
                                  <Input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleImageChange}
                                  />
                                  {imagePreview && (
                                    <Box mt={2}>
                                      <Image
                                        src={imagePreview}
                                        alt="Background preview"
                                        maxH="200px"
                                        borderRadius="md"
                                      />
                                    </Box>
                                  )}
                                </FormControl>

                                <FormControl>
                                  <Checkbox
                                    isChecked={formData.require_time_selection}
                                    onChange={(e) => handleInputChange('require_time_selection', e.target.checked)}
                                  >
                                    Require RSVP guests to select a specific time within the event window
                                  </Checkbox>
                                </FormControl>
                              </>
                            )}

                            <HStack spacing={4} justify="flex-end">
                              <Button variant="ghost" onClick={handleCancelEdit}>
                                Cancel
                              </Button>
                              <Button
                                colorScheme="blue"
                                type="submit"
                                isLoading={saving || uploadingImage}
                                loadingText="Saving..."
                                leftIcon={<CheckIcon />}
                              >
                                Update Event
                              </Button>
                            </HStack>
                          </VStack>
                        </form>
                      </Box>
                    </Td>
                  </Tr>
                )}
              </React.Fragment>
            ))}
          </Tbody>
        </Table>
      </Box>

      {events.length === 0 && editingId !== 'new' && (
        <Box textAlign="center" py={8} bg="gray.50" borderRadius="lg">
          <Text color="gray.500">No private events created yet.</Text>
          <Text color="gray.400" fontSize="sm" mt={2}>
            Create your first private event to get started.
          </Text>
        </Box>
      )}
    </Box>
  );
} 