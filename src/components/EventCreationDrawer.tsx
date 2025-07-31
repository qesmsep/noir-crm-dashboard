import React, { useState, useEffect } from 'react';
import {
  Drawer,
  DrawerBody,
  DrawerFooter,
  DrawerHeader,
  DrawerOverlay,
  DrawerContent,
  Button,
  VStack,
  HStack,
  FormControl,
  FormLabel,
  Input,
  Select,
  Textarea,
  Text,
  Box,
  Divider,
  useToast,
  Spinner,
  Grid,
  GridItem,
  Alert,
  AlertIcon,
  Checkbox,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
  InputGroup,
  InputLeftAddon,
  Switch,
  FormHelperText,
  Badge,
  Flex,
  IconButton,
  Image,
  useColorModeValue
} from '@chakra-ui/react';
import { CloseIcon, AddIcon, EditIcon, DeleteIcon } from '@chakra-ui/icons';
import { localInputToUTC } from '../utils/dateUtils';
import { useSettings } from '../context/SettingsContext';
import { supabase } from '../lib/supabase';

interface EventCreationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  initialEventType?: string;
  onEventCreated: () => void;
}

interface EventFormData {
  title: string;
  event_type: string;
  start_time: string;
  end_time: string;
  max_guests: number;
  total_attendees_maximum: number;
  deposit_required: number;
  event_description: string;
  rsvp_enabled: boolean;
  require_time_selection: boolean;
  full_day: boolean;
  background_image_url: string | null;
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

const EventCreationDrawer: React.FC<EventCreationDrawerProps> = ({
  isOpen,
  onClose,
  initialEventType = '',
  onEventCreated,
}) => {
  const [formData, setFormData] = useState<EventFormData>({
    title: '',
    event_type: initialEventType || 'Birthday',
    start_time: '',
    end_time: '',
    max_guests: 10,
    total_attendees_maximum: 500,
    deposit_required: 0,
    event_description: '',
    rsvp_enabled: false,
    require_time_selection: false,
    full_day: true,
    background_image_url: null
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const { settings } = useSettings();
  const toast = useToast();

  useEffect(() => {
    if (isOpen) {
      resetForm();
    }
  }, [isOpen, initialEventType]);

  const resetForm = () => {
    setFormData({
      title: '',
      event_type: initialEventType || 'Birthday',
      start_time: '',
      end_time: '',
      max_guests: 10,
      total_attendees_maximum: 500,
      deposit_required: 0,
      event_description: '',
      rsvp_enabled: false,
      require_time_selection: false,
      full_day: true,
      background_image_url: null
    });
    setImageFile(null);
    setImagePreview(null);
  };

  const handleInputChange = (field: keyof EventFormData, value: any) => {
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
    setIsSaving(true);

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
      const startTimeUTC = localInputToUTC(formData.start_time, settings.timezone);
      const endTimeUTC = localInputToUTC(formData.end_time, settings.timezone);

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

      // Insert event
      const { data: event, error: insertError } = await supabase
        .from('private_events')
        .insert(eventData)
        .select()
        .single();

      if (insertError) throw insertError;

      // Upload image if provided
      if (imageFile && event) {
        const imageUrl = await uploadImage(event.id);
        if (imageUrl) {
          await supabase
            .from('private_events')
            .update({ background_image_url: imageUrl })
            .eq('id', event.id);
        }
      }

      toast({
        title: 'Success',
        description: 'Event created successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

      onEventCreated();
    } catch (error) {
      console.error('Error creating event:', error);
      toast({
        title: 'Error',
        description: 'Failed to create event',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Drawer 
      isOpen={isOpen} 
      placement="right" 
      onClose={handleClose} 
      size="md"
      closeOnOverlayClick={true}
      closeOnEsc={true}
    >
      <Box zIndex="2000" position="relative">
        <DrawerOverlay bg="blackAlpha.600" onClick={handleClose} />
        <DrawerContent 
          border="2px solid #353535" 
          borderRadius="10px"  
          fontFamily="Montserrat, sans-serif" 
          maxW="500px" 
          w="50vw" 
          boxShadow="xl" 
          mt="80px" 
          mb="25px" 
          paddingRight="40px" 
          paddingLeft="40px" 
          backgroundColor="#ecede8"
          position="fixed"
          top="0"
          right="0"
          style={{
            transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
            transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
            willChange: 'transform',
            transformStyle: 'preserve-3d',
            backfaceVisibility: 'hidden'
          }}
        >
          <DrawerHeader borderBottomWidth="1px" margin="0" fontWeight="bold" paddingTop="20px" fontSize="24px" fontFamily="IvyJournal, sans-serif" color="#353535">
            Create New Event
          </DrawerHeader>
          
          <DrawerBody p={4} overflowY="auto" className="drawer-body-content">
            <form onSubmit={handleSubmit}>
              <VStack spacing={4} align="stretch">
                {/* Event Type */}
                <FormControl isRequired>
                  <FormLabel fontWeight="600" color="#353535">Event Type</FormLabel>
                  <Select
                    value={formData.event_type}
                    onChange={(e) => handleInputChange('event_type', e.target.value)}
                    borderColor="#a59480"
                    _focus={{ borderColor: '#353535', boxShadow: '0 0 0 1px #353535' }}
                  >
                    {EVENT_TYPES.map(type => (
                      <option key={type} value={type}>
                        {EVENT_TYPE_ICONS[type]} {type}
                      </option>
                    ))}
                  </Select>
                </FormControl>

                {/* Event Title */}
                <FormControl isRequired>
                  <FormLabel fontWeight="600" color="#353535">Event Title</FormLabel>
                  <Input
                    value={formData.title}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    placeholder="Enter event title"
                    borderColor="#a59480"
                    _focus={{ borderColor: '#353535', boxShadow: '0 0 0 1px #353535' }}
                  />
                </FormControl>

                {/* Date and Time */}
                <Grid templateColumns="repeat(2, 1fr)" gap={4}>
                  <FormControl isRequired>
                    <FormLabel fontWeight="600" color="#353535">Start Date & Time</FormLabel>
                    <Input
                      type="datetime-local"
                      value={formData.start_time}
                      onChange={(e) => handleInputChange('start_time', e.target.value)}
                      borderColor="#a59480"
                      _focus={{ borderColor: '#353535', boxShadow: '0 0 0 1px #353535' }}
                    />
                  </FormControl>

                  <FormControl isRequired>
                    <FormLabel fontWeight="600" color="#353535">End Date & Time</FormLabel>
                    <Input
                      type="datetime-local"
                      value={formData.end_time}
                      onChange={(e) => handleInputChange('end_time', e.target.value)}
                      borderColor="#a59480"
                      _focus={{ borderColor: '#353535', boxShadow: '0 0 0 1px #353535' }}
                    />
                  </FormControl>
                </Grid>

                {/* Full Day Toggle */}
                <FormControl>
                  <Flex align="center" justify="space-between">
                    <FormLabel fontWeight="600" color="#353535" mb={0}>Full Day Event</FormLabel>
                    <Switch
                      isChecked={formData.full_day}
                      onChange={(e) => handleInputChange('full_day', e.target.checked)}
                      colorScheme="blue"
                    />
                  </Flex>
                </FormControl>

                {/* Guest Limits */}
                <Grid templateColumns="repeat(2, 1fr)" gap={4}>
                  <FormControl isRequired>
                    <FormLabel fontWeight="600" color="#353535">Max Guests per Reservation</FormLabel>
                    <NumberInput
                      value={formData.max_guests}
                      onChange={(_, value) => handleInputChange('max_guests', value)}
                      min={1}
                      max={100}
                      borderColor="#a59480"
                    >
                      <NumberInputField _focus={{ borderColor: '#353535', boxShadow: '0 0 0 1px #353535' }} />
                      <NumberInputStepper>
                        <NumberIncrementStepper />
                        <NumberDecrementStepper />
                      </NumberInputStepper>
                    </NumberInput>
                  </FormControl>

                  <FormControl isRequired>
                    <FormLabel fontWeight="600" color="#353535">Total Max Attendees</FormLabel>
                    <NumberInput
                      value={formData.total_attendees_maximum}
                      onChange={(_, value) => handleInputChange('total_attendees_maximum', value)}
                      min={1}
                      max={1000}
                      borderColor="#a59480"
                    >
                      <NumberInputField _focus={{ borderColor: '#353535', boxShadow: '0 0 0 1px #353535' }} />
                      <NumberInputStepper>
                        <NumberIncrementStepper />
                        <NumberDecrementStepper />
                      </NumberInputStepper>
                    </NumberInput>
                  </FormControl>
                </Grid>

                {/* Deposit */}
                <FormControl>
                  <FormLabel fontWeight="600" color="#353535">Deposit Required ($)</FormLabel>
                  <NumberInput
                    value={formData.deposit_required}
                    onChange={(_, value) => handleInputChange('deposit_required', value)}
                    min={0}
                    max={10000}
                    precision={2}
                    borderColor="#a59480"
                  >
                    <NumberInputField _focus={{ borderColor: '#353535', boxShadow: '0 0 0 1px #353535' }} />
                    <NumberInputStepper>
                      <NumberIncrementStepper />
                      <NumberDecrementStepper />
                    </NumberInputStepper>
                  </NumberInput>
                </FormControl>

                {/* Description */}
                <FormControl>
                  <FormLabel fontWeight="600" color="#353535">Event Description</FormLabel>
                  <Textarea
                    value={formData.event_description}
                    onChange={(e) => handleInputChange('event_description', e.target.value)}
                    placeholder="Enter event description..."
                    rows={4}
                    borderColor="#a59480"
                    _focus={{ borderColor: '#353535', boxShadow: '0 0 0 1px #353535' }}
                  />
                </FormControl>

                {/* RSVP Settings */}
                <FormControl>
                  <Flex align="center" justify="space-between">
                    <FormLabel fontWeight="600" color="#353535" mb={0}>Enable RSVP</FormLabel>
                    <Switch
                      isChecked={formData.rsvp_enabled}
                      onChange={(e) => handleInputChange('rsvp_enabled', e.target.checked)}
                      colorScheme="blue"
                    />
                  </Flex>
                </FormControl>

                {/* Time Selection */}
                <FormControl>
                  <Flex align="center" justify="space-between">
                    <FormLabel fontWeight="600" color="#353535" mb={0}>Require Time Selection</FormLabel>
                    <Switch
                      isChecked={formData.require_time_selection}
                      onChange={(e) => handleInputChange('require_time_selection', e.target.checked)}
                      colorScheme="blue"
                    />
                  </Flex>
                </FormControl>

                {/* Background Image */}
                <FormControl>
                  <FormLabel fontWeight="600" color="#353535">Background Image</FormLabel>
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    borderColor="#a59480"
                    _focus={{ borderColor: '#353535', boxShadow: '0 0 0 1px #353535' }}
                  />
                  {imagePreview && (
                    <Box mt={2}>
                      <Image src={imagePreview} alt="Preview" maxH="100px" borderRadius="md" />
                    </Box>
                  )}
                </FormControl>
              </VStack>
            </form>
          </DrawerBody>

          <DrawerFooter borderTopWidth="1px" paddingTop="20px">
            <HStack spacing={4} width="100%">
              <Button
                variant="outline"
                onClick={handleClose}
                flex={1}
                borderColor="#a59480"
                color="#353535"
                _hover={{ borderColor: '#353535', bg: 'gray.50' }}
              >
                Cancel
              </Button>
              <Button
                colorScheme="blue"
                onClick={handleSubmit}
                flex={1}
                isLoading={isSaving}
                loadingText="Creating..."
                bg="#353535"
                color="white"
                _hover={{ bg: '#2a2a2a' }}
              >
                Create Event
              </Button>
            </HStack>
          </DrawerFooter>
        </DrawerContent>
      </Box>
    </Drawer>
  );
};

export default EventCreationDrawer; 