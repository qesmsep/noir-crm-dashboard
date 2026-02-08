import React, { useState, useEffect } from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Button,
  VStack,
  HStack,
  FormControl,
  FormLabel,
  Input,
  Select,
  Textarea,
  Text,
  useToast,
  Grid,
  GridItem,
  Checkbox,
} from '@chakra-ui/react';
import { localInputToUTC } from '../utils/dateUtils';
import { useSettings } from '../context/SettingsContext';

interface NewReservationModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialDate?: Date;
  initialTableId?: string;
  onReservationCreated: () => void;
  initialMemberData?: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
  };
}

const eventTypes = [
  { value: 'birthday', label: '🎂 Birthday' },
  { value: 'engagement', label: '💍 Engagement' },
  { value: 'anniversary', label: '🥂 Anniversary' },
  { value: 'party', label: '🎉 Party / Celebration' },
  { value: 'graduation', label: '🎓 Graduation' },
  { value: 'corporate', label: '🧑‍💼 Corporate Event' },
  { value: 'holiday', label: '❄️ Holiday Gathering' },
  { value: 'networking', label: '🤝 Networking' },
  { value: 'fundraiser', label: '🎗️ Fundraiser / Charity' },
  { value: 'bachelor', label: '🥳 Bachelor / Bachelorette Party' },
  { value: 'fun', label: '🍸 Fun Night Out' },
  { value: 'date', label: '💕 Date Night' },
];

const NewReservationModal: React.FC<NewReservationModalProps> = ({
  isOpen,
  onClose,
  initialDate,
  initialTableId,
  onReservationCreated,
  initialMemberData,
}) => {
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    party_size: 2,
    event_type: '',
    notes: '',
    table_id: initialTableId || '',
    start_time: '',
    end_time: '',
    is_checked_in: false,
    send_access_instructions: false,
    send_reminder: false,
    send_confirmation: false,
  });
  const [tables, setTables] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const toast = useToast();
  const { settings } = useSettings();
  const timezone = settings?.timezone || 'America/Chicago';

  useEffect(() => {
    if (isOpen) {
      fetchTables();
      // Clear form data and set initial values based on the clicked slot
      const startTime = initialDate ? new Date(initialDate) : new Date();
      const endTime = new Date(startTime.getTime() + 2 * 60 * 60 * 1000); // 2 hours later

      console.log('NewReservationModal - initialDate:', initialDate);
      console.log('NewReservationModal - startTime:', startTime);
      console.log('NewReservationModal - endTime:', endTime);
      console.log('NewReservationModal - startTime ISO:', startTime.toISOString().slice(0, 16));
      console.log('NewReservationModal - endTime ISO:', endTime.toISOString().slice(0, 16));

      setFormData({
        first_name: initialMemberData?.first_name || '',
        last_name: initialMemberData?.last_name || '',
        email: initialMemberData?.email || '',
        phone: initialMemberData?.phone || '',
        party_size: 2,
        event_type: '',
        notes: '',
        table_id: initialTableId || '',
        start_time: startTime.toISOString().slice(0, 16), // Format for datetime-local input
        end_time: endTime.toISOString().slice(0, 16),
        is_checked_in: false,
        send_access_instructions: false,
        send_reminder: false,
        send_confirmation: false,
      });
    }
  }, [isOpen, initialDate, initialMemberData]);

  // Ensure table ID is set when modal opens
  useEffect(() => {
    if (isOpen && initialTableId) {
      setFormData(prev => ({
        ...prev,
        table_id: initialTableId
      }));
    }
  }, [isOpen, initialTableId]);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setFormData({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        party_size: 2,
        event_type: '',
        notes: '',
        table_id: '',
        start_time: '',
        end_time: '',
        is_checked_in: false,
        send_access_instructions: false,
        send_reminder: false,
        send_confirmation: false,
      });
    }
  }, [isOpen]);

  const fetchTables = async () => {
    try {
      const response = await fetch('/api/tables');
      if (response.ok) {
        const result = await response.json();
        setTables(result.data || []);
      } else {
        console.error('Failed to fetch tables:', response.status);
      }
    } catch (error) {
      console.error('Error fetching tables:', error);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Validate required fields
      if (!formData.first_name || !formData.last_name || !formData.phone) {
        toast({
          title: 'Required fields missing',
          description: 'Please fill in first name, last name, and phone number.',
          status: 'error',
          duration: 3000,
        });
        return;
      }

      if (!formData.start_time || !formData.end_time) {
        toast({
          title: 'Time required',
          description: 'Please select start and end times.',
          status: 'error',
          duration: 3000,
        });
        return;
      }

      // Convert times to UTC
      const startTimeUTC = localInputToUTC(formData.start_time, timezone);
      const endTimeUTC = localInputToUTC(formData.end_time, timezone);
      
      // Clean phone number
      const cleanedPhone = formData.phone.replace(/\D/g, '');
      
      // Handle empty table_id (convert empty string to null)
      const tableId = formData.table_id === '' ? null : formData.table_id;

      const reservationData = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email,
        phone: cleanedPhone,
        party_size: formData.party_size,
        event_type: formData.event_type,
        notes: formData.notes,
        table_id: tableId,
        start_time: startTimeUTC,
        end_time: endTimeUTC,
        is_checked_in: formData.is_checked_in,
        send_access_instructions: formData.send_access_instructions,
        send_reminder: formData.send_reminder,
        send_confirmation: formData.send_confirmation,
        source: 'manual' // Track that this reservation was made manually in the admin interface
      };

      const response = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reservationData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create reservation');
      }

      const result = await response.json();

      toast({
        title: 'Success',
        description: 'Reservation created successfully!',
        status: 'success',
        duration: 3000,
      });

      onReservationCreated();
      onClose();
      
    } catch (error: any) {
      console.error('Error creating reservation:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create reservation',
        status: 'error',
        duration: 5000,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    // Reset form data completely
    setFormData({
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      party_size: 2,
      event_type: '',
      notes: '',
      table_id: '',
      start_time: '',
      end_time: '',
      is_checked_in: false,
      send_access_instructions: false,
      send_reminder: false,
      send_confirmation: false,
    });
    onClose();
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={handleClose}
      size="md"
      isCentered
      closeOnOverlayClick={true}
      closeOnEsc={true}
      blockScrollOnMount={true}
      motionPreset="scale"
      portalProps={{ appendToParentPortal: false }}
    >
      <ModalOverlay 
        bg="blackAlpha.700"
        style={{
          zIndex: 999998,
        }}
      />
      <ModalContent 
        border="2px solid #353535" 
        borderRadius="10px"  
        fontFamily="Montserrat, sans-serif" 
        backgroundColor="#ecede8"
        maxH="85vh"
        maxW="500px"
        w="90vw"
        overflowY="auto"
        style={{
          zIndex: 999999,
          margin: 'auto',
        }}
      >
        <ModalHeader 
          borderBottomWidth="1px" 
          fontWeight="bold" 
          fontFamily="IvyJournal, sans-serif" 
          color="#353535"
          pb={2}
          pt={3}
          px={4}
        >
          <Text fontSize="20px" fontWeight="bold" fontFamily="IvyJournal, sans-serif">
            New Reservation
          </Text>
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody p={3} overflowY="auto">
          <VStack spacing={2} align="stretch">
            <Grid templateColumns="repeat(2, 1fr)" gap={2}>
              <GridItem>
                <FormControl isRequired>
                  <FormLabel fontSize="xs" mb={0.5} fontWeight="600">First Name</FormLabel>
                  <Input 
                    fontFamily="Montserrat, sans-serif" 
                    value={formData.first_name} 
                    onChange={(e) => handleInputChange('first_name', e.target.value)} 
                    size="sm" 
                    h="32px"
                  />
                </FormControl>
              </GridItem>
              <GridItem>
                <FormControl isRequired>
                  <FormLabel fontSize="xs" mb={0.5} fontWeight="600">Last Name</FormLabel>
                  <Input 
                    fontFamily="Montserrat, sans-serif" 
                    value={formData.last_name} 
                    onChange={(e) => handleInputChange('last_name', e.target.value)} 
                    size="sm"
                    h="32px"
                  />
                </FormControl>
              </GridItem>
              <GridItem>
                <FormControl>
                  <FormLabel fontSize="xs" mb={0.5} fontWeight="600">Email</FormLabel>
                  <Input 
                    fontFamily="Montserrat, sans-serif" 
                    type="email" 
                    value={formData.email} 
                    onChange={(e) => handleInputChange('email', e.target.value)} 
                    size="sm"
                    h="32px"
                  />
                </FormControl>
              </GridItem>
              <GridItem>
                <FormControl isRequired>
                  <FormLabel fontSize="xs" mb={0.5} fontWeight="600">Phone</FormLabel>
                  <Input 
                    fontFamily="Montserrat, sans-serif" 
                    value={formData.phone} 
                    onChange={(e) => handleInputChange('phone', e.target.value)} 
                    placeholder="+1 (555) 123-4567" 
                    size="sm"
                    h="32px"
                  />
                </FormControl>
              </GridItem>
            </Grid>

            <Grid templateColumns="repeat(2, 1fr)" gap={2}>
              <GridItem>
                <FormControl isRequired>
                  <FormLabel fontSize="xs" mb={0.5} fontWeight="600">Party Size</FormLabel>
                  <Select 
                    fontFamily="Montserrat, sans-serif" 
                    value={formData.party_size} 
                    onChange={(e) => handleInputChange('party_size', parseInt(e.target.value))} 
                    size="sm"
                    h="32px"
                  >
                    {Array.from({ length: 15 }, (_, i) => i + 1).map(num => (
                      <option key={num} value={num}>{num}</option>
                    ))}
                  </Select>
                </FormControl>
              </GridItem>
              <GridItem>
                <FormControl>
                  <FormLabel fontSize="xs" mb={0.5} fontWeight="600">Event Type</FormLabel>
                  <Select 
                    fontFamily="Montserrat, sans-serif" 
                    value={formData.event_type} 
                    onChange={(e) => handleInputChange('event_type', e.target.value)} 
                    size="sm"
                    h="32px"
                  >
                    <option value="">Select</option>
                    {eventTypes.map(type => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </Select>
                </FormControl>
              </GridItem>
            </Grid>

            <Grid templateColumns="repeat(2, 1fr)" gap={2}>
              <GridItem>
                <FormControl isRequired>
                  <FormLabel fontSize="xs" mb={0.5} fontWeight="600">Start Time</FormLabel>
                  <Input 
                    fontFamily="Montserrat, sans-serif" 
                    type="datetime-local" 
                    value={formData.start_time} 
                    onChange={(e) => handleInputChange('start_time', e.target.value)} 
                    size="sm"
                    h="32px"
                  />
                </FormControl>
              </GridItem>
              <GridItem>
                <FormControl isRequired>
                  <FormLabel fontSize="xs" mb={0.5} fontWeight="600">End Time</FormLabel>
                  <Input 
                    fontFamily="Montserrat, sans-serif" 
                    type="datetime-local" 
                    value={formData.end_time} 
                    onChange={(e) => handleInputChange('end_time', e.target.value)} 
                    size="sm"
                    h="32px"
                  />
                </FormControl>
              </GridItem>
            </Grid>

            <FormControl>
              <FormLabel fontSize="xs" mb={0.5} fontWeight="600">Table</FormLabel>
              <Select 
                fontFamily="Montserrat, sans-serif" 
                value={formData.table_id} 
                onChange={(e) => handleInputChange('table_id', e.target.value)} 
                size="sm"
                h="32px"
              >
                <option value="">Select table</option>
                {tables.map(table => (
                  <option key={table.id} value={table.id}>Table {table.table_number}</option>
                ))}
              </Select>
            </FormControl>

            <FormControl>
              <FormLabel fontSize="xs" mb={0.5} fontWeight="600">Notes</FormLabel>
              <Textarea 
                fontFamily="Montserrat, sans-serif" 
                value={formData.notes} 
                onChange={(e) => handleInputChange('notes', e.target.value)} 
                size="sm" 
                rows={2}
                placeholder="Special requests..."
              />
            </FormControl>

            <Grid templateColumns="repeat(2, 1fr)" gap={1}>
              <GridItem>
                <Checkbox 
                  fontFamily="Montserrat, sans-serif"
                  isChecked={formData.is_checked_in}
                  onChange={(e) => handleInputChange('is_checked_in', e.target.checked)}
                  size="sm"
                >
                  <Text fontSize="xs">Check in</Text>
                </Checkbox>
              </GridItem>
              <GridItem>
                <Checkbox 
                  fontFamily="Montserrat, sans-serif"
                  isChecked={formData.send_confirmation}
                  onChange={(e) => handleInputChange('send_confirmation', e.target.checked)}
                  size="sm"
                >
                  <Text fontSize="xs">Send confirmation</Text>
                </Checkbox>
              </GridItem>
              <GridItem>
                <Checkbox 
                  fontFamily="Montserrat, sans-serif"
                  isChecked={formData.send_access_instructions}
                  onChange={(e) => handleInputChange('send_access_instructions', e.target.checked)}
                  size="sm"
                >
                  <Text fontSize="xs">Send access instructions</Text>
                </Checkbox>
              </GridItem>
              <GridItem>
                <Checkbox 
                  fontFamily="Montserrat, sans-serif"
                  isChecked={formData.send_reminder}
                  onChange={(e) => handleInputChange('send_reminder', e.target.checked)}
                  size="sm"
                >
                  <Text fontSize="xs">Send reminder</Text>
                </Checkbox>
              </GridItem>
            </Grid>
          </VStack>
        </ModalBody>
        <ModalFooter borderTopWidth="1px" justifyContent="flex-end" px={3} py={2}>
          <HStack spacing={2}>
            <Button variant="outline" onClick={handleClose} size="sm" h="32px">Cancel</Button>
            <Button 
              colorScheme="blue" 
              onClick={handleSave} 
              isLoading={isSaving} 
              loadingText="Creating..."
              size="sm"
              h="32px"
            >
              Create
            </Button>
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default NewReservationModal;

