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
  FormHelperText,
  Alert,
  AlertIcon,
  useColorModeValue
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
  SettingsIcon,
  AddIcon
} from '@chakra-ui/icons';
import { supabase } from '../../lib/supabase';
import { useSettings } from '../../context/SettingsContext';
import { utcToLocalInput, localInputToUTC, formatDateTime } from '../../utils/dateUtils';
import AdminLayout from '../../components/layouts/AdminLayout';

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
  'Wind Down Party',
  'After Party',
  'Rehearsal Dinner',
  'Noir Member Event',
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
  'Wind Down Party': SettingsIcon,
  'After Party': SettingsIcon,
  'Rehearsal Dinner': SettingsIcon,
  'Noir Member Event': StarIcon,
  'Other': SettingsIcon
};

const VENUE_TIMEZONE = 'America/Chicago';

export default function PrivateEvents() {
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

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('private_events')
        .select('*')
        .order('start_time', { ascending: false });

      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      console.error('Error fetching events:', error);
      toast({
        title: 'Error',
        description: 'Failed to load events',
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
      // Validate required fields
      if (!formData.title || !formData.start_time || !formData.end_time) {
        toast({
          title: 'Validation Error',
          description: 'Please fill in all required fields',
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
        return;
      }

      // Convert times to UTC
      const startTimeUTC = localInputToUTC(formData.start_time, VENUE_TIMEZONE);
      const endTimeUTC = localInputToUTC(formData.end_time, VENUE_TIMEZONE);

      // Create event data
      const eventData = {
        title: formData.title,
        event_type: formData.event_type,
        start_time: startTimeUTC,
        end_time: endTimeUTC,
        max_guests: formData.max_guests,
        total_attendees_maximum: formData.total_attendees_maximum,
        deposit_required: formData.deposit_required,
        event_description: formData.event_description,
        rsvp_enabled: formData.rsvp_enabled,
        require_time_selection: formData.require_time_selection,
        full_day: formData.full_day,
        status: 'active' as const,
        created_by: (await supabase.auth.getUser()).data.user?.id
      };

      let eventId: string;

      if (editingId) {
        // Update existing event
        const { data: event, error: updateError } = await supabase
          .from('private_events')
          .update(eventData)
          .eq('id', editingId)
          .select()
          .single();

        if (updateError) throw updateError;
        eventId = event.id;
      } else {
        // Create new event
        const { data: event, error: insertError } = await supabase
          .from('private_events')
          .insert(eventData)
          .select()
          .single();

        if (insertError) throw insertError;
        eventId = event.id;
      }

      // Upload image if provided
      if (imageFile && eventId) {
        const imageUrl = await uploadImage(eventId);
        if (imageUrl) {
          await supabase
            .from('private_events')
            .update({ background_image_url: imageUrl })
            .eq('id', eventId);
        }
      }

      toast({
        title: 'Success',
        description: editingId ? 'Event updated successfully' : 'Event created successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

      resetForm();
      fetchEvents();
    } catch (error) {
      console.error('Error saving event:', error);
      toast({
        title: 'Error',
        description: 'Failed to save event',
        status: 'error',
        duration: 3000,
        isClosable: true,
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
      start_time: utcToLocalInput(event.start_time, VENUE_TIMEZONE),
      end_time: utcToLocalInput(event.end_time, VENUE_TIMEZONE),
      max_guests: event.max_guests,
      total_attendees_maximum: event.total_attendees_maximum,
      deposit_required: event.deposit_required,
      event_description: event.event_description || '',
      rsvp_enabled: event.rsvp_enabled,
      require_time_selection: event.require_time_selection,
      full_day: event.full_day
    });
    setImagePreview(event.background_image_url);
  };

  const handleCancelEdit = () => {
    resetForm();
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

  const openNewEvent = () => {
    resetForm();
  };

  const formatDate = (dateTime: string) => {
    return formatDateTime(dateTime, VENUE_TIMEZONE, 'MMM dd, yyyy');
  };

  const formatTime = (dateTime: string) => {
    return formatDateTime(dateTime, VENUE_TIMEZONE, 'HH:mm');
  };

  const getEventTypeIcon = (eventType: string) => {
    const IconComponent = EVENT_TYPE_ICONS[eventType] || SettingsIcon;
    return <IconComponent />;
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
    <AdminLayout>
      <Box p={6} maxW="1400px" mx="auto">
        {/* Header */}
        <Flex justify="space-between" align="center" mb={6}>
          <Heading size="lg" color="nightSky">Private Events</Heading>
          <Button
            leftIcon={<AddIcon />}
            colorScheme="blue"
            onClick={openNewEvent}
          >
            Create New Event
          </Button>
        </Flex>

        {/* Event Form */}
        {(editingId || !events.length) && (
          <Box 
            bg="white" 
            borderRadius="lg" 
            p={6} 
            mb={6}
            border="1px solid"
            borderColor="gray.200"
            boxShadow="sm"
          >
            <Heading size="md" mb={4} color="nightSky">
              {editingId ? 'Edit Event' : 'Create New Event'}
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
                      {EVENT_TYPES.map(type => (
                        <option key={type} value={type}>{type}</option>
                      ))}
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
                    isLoading={saving}
                    loadingText="Saving..."
                  >
                    {editingId ? 'Update Event' : 'Create Event'}
                  </Button>
                  {editingId && (
                    <Button
                      variant="outline"
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

        {/* Events List */}
        {loading ? (
          <Box textAlign="center" py={8}>
            <Spinner size="lg" />
            <Text mt={4}>Loading events...</Text>
          </Box>
        ) : (
          <Box 
            bg="white" 
            borderRadius="lg" 
            p={6}
            border="1px solid"
            borderColor="gray.200"
            boxShadow="sm"
          >
            <Heading size="md" mb={4} color="nightSky">All Events</Heading>
            {events.length === 0 ? (
              <Text color="gray.500" textAlign="center" py={8}>
                No events found. Create your first event above.
              </Text>
            ) : (
              <Table variant="simple">
                <Thead>
                  <Tr>
                    <Th>Event</Th>
                    <Th>Type</Th>
                    <Th>Date & Time</Th>
                    <Th>Guests</Th>
                    <Th>Status</Th>
                    <Th>Actions</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {events.map((event) => (
                    <Tr key={event.id}>
                      <Td>
                        <VStack align="start" spacing={1}>
                          <Text fontWeight="600">{event.title}</Text>
                          {event.event_description && (
                            <Text fontSize="sm" color="gray.600" noOfLines={2}>
                              {event.event_description}
                            </Text>
                          )}
                        </VStack>
                      </Td>
                      <Td>
                        <HStack>
                          {getEventTypeIcon(event.event_type)}
                          <Text>{event.event_type}</Text>
                        </HStack>
                      </Td>
                      <Td>
                        <VStack align="start" spacing={1}>
                          <Text>{formatDate(event.start_time)}</Text>
                          <Text fontSize="sm" color="gray.600">
                            {formatTime(event.start_time)} - {formatTime(event.end_time)}
                          </Text>
                        </VStack>
                      </Td>
                      <Td>
                        <Text>{event.max_guests} per reservation</Text>
                        <Text fontSize="sm" color="gray.600">
                          Max {event.total_attendees_maximum} total
                        </Text>
                      </Td>
                      <Td>
                        <Badge colorScheme={getStatusColor(event.status)}>
                          {event.status}
                        </Badge>
                      </Td>
                      <Td>
                        <HStack spacing={2}>
                          <IconButton
                            aria-label="Edit event"
                            icon={<EditIcon />}
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEdit(event)}
                          />
                          <IconButton
                            aria-label="Delete event"
                            icon={<DeleteIcon />}
                            size="sm"
                            variant="ghost"
                            colorScheme="red"
                            onClick={() => handleDelete(event.id)}
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
    </AdminLayout>
  );
} 