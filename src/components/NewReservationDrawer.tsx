import React, { useState, useEffect, useRef } from 'react';
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
} from '@chakra-ui/react';
import { CloseIcon } from '@chakra-ui/icons';
import { localInputToUTC } from '../utils/dateUtils';
import { useSettings } from '../context/SettingsContext';

interface NewReservationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  initialDate?: Date;
  initialTableId?: string;
  onReservationCreated: () => void;
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

const NewReservationDrawer: React.FC<NewReservationDrawerProps> = ({
  isOpen,
  onClose,
  initialDate,
  initialTableId,
  onReservationCreated,
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
      // Set initial times based on the clicked slot
      if (initialDate) {
        const startTime = new Date(initialDate);
        const endTime = new Date(initialDate.getTime() + 2 * 60 * 60 * 1000); // 2 hours later
        
        setFormData(prev => ({
          ...prev,
          table_id: initialTableId || '',
          start_time: startTime.toISOString().slice(0, 16), // Format for datetime-local input
          end_time: endTime.toISOString().slice(0, 16),
        }));
      }
    }
  }, [isOpen, initialDate, initialTableId]);

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
      console.log('Reservation created:', result);
      
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
    // Reset form data
    setFormData({
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
    });
    onClose();
  };

  return (
    <Drawer 
      isOpen={isOpen} 
      placement="right" 
      onClose={handleClose} 
      size="sm"
      closeOnOverlayClick={true}
      closeOnEsc={true}
    >
      <Box zIndex="2000" position="relative">
        <DrawerOverlay bg="blackAlpha.600" onClick={handleClose} />
        <DrawerContent 
          border="2px solid #353535" 
          borderRadius="10px"  
          fontFamily="Montserrat, sans-serif" 
          maxW="350px" 
          maxH="flex" 
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
          height="100vh"
          style={{
            transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
            transition: 'transform 0.3s ease-in-out'
          }}
        >
          <DrawerHeader borderBottomWidth="1px" margin="0" fontWeight="bold" paddingTop="0px" fontSize="0px" fontFamily="IvyJournal, sans-serif" color="#353535">
            
          </DrawerHeader>
          <DrawerBody p={4} overflowY="auto">
            <VStack spacing={1} align="stretch">
              <Box>
                <VStack align="start" spacing={0} borderRadius="10px" marginTop="0px">
                  <Text mb="0px" fontSize="24px" fontWeight="bold" fontFamily="IvyJournal, sans-serif">
                    New Reservation
                  </Text>
                  <Text margin="0px" fontSize="sm" color="gray.600">
                    Create a new reservation
                  </Text>
                </VStack>
              </Box>
              
              <VStack spacing={1} as="section" align="stretch">
                <Text marginBottom="0px" alignSelf="start" fontSize="md" fontWeight="bold"></Text>
                <Grid templateColumns="repeat(2, 1fr)" gap={2}>
                  <GridItem>
                    <FormControl isRequired>
                      <FormLabel fontSize="sm" mb={1}>First Name</FormLabel>
                      <Input 
                        fontFamily="Montserrat, sans-serif" 
                        value={formData.first_name} 
                        onChange={(e) => handleInputChange('first_name', e.target.value)} 
                        size="sm" 
                      />
                    </FormControl>
                  </GridItem>
                  <GridItem>
                    <FormControl isRequired>
                      <FormLabel fontSize="sm" mb={1}>Last Name</FormLabel>
                      <Input 
                        fontFamily="Montserrat, sans-serif" 
                        value={formData.last_name} 
                        onChange={(e) => handleInputChange('last_name', e.target.value)} 
                        size="sm" 
                      />
                    </FormControl>
                  </GridItem>
                  <GridItem>
                    <FormControl>
                      <FormLabel fontSize="sm" mb={1}>Email</FormLabel>
                      <Input 
                        fontFamily="Montserrat, sans-serif" 
                        type="email" 
                        value={formData.email} 
                        onChange={(e) => handleInputChange('email', e.target.value)} 
                        size="sm" 
                      />
                    </FormControl>
                  </GridItem>
                  <GridItem>
                    <FormControl isRequired>
                      <FormLabel fontSize="sm" mb={1}>Phone</FormLabel>
                      <Input 
                        fontFamily="Montserrat, sans-serif" 
                        value={formData.phone} 
                        onChange={(e) => handleInputChange('phone', e.target.value)} 
                        placeholder="+1 (555) 123-4567" 
                        size="sm" 
                      />
                    </FormControl>
                  </GridItem>
                </Grid>
              </VStack>

              <VStack spacing={1} as="section" align="stretch">
                <Text marginBottom="0px" alignSelf="start" fontSize="md" fontWeight="bold"></Text>
                <Grid templateColumns="repeat(2, 1fr)" gap={2}>
                  <GridItem>
                    <FormControl isRequired>
                      <FormLabel fontSize="sm" mb={1}>Party Size</FormLabel>
                      <Select 
                        fontFamily="Montserrat, sans-serif" 
                        value={formData.party_size} 
                        onChange={(e) => handleInputChange('party_size', parseInt(e.target.value))} 
                        size="sm"
                      >
                        {Array.from({ length: 15 }, (_, i) => i + 1).map(num => (
                          <option key={num} value={num}>{num}</option>
                        ))}
                      </Select>
                    </FormControl>
                  </GridItem>
                  <GridItem>
                    <FormControl>
                      <FormLabel fontSize="sm" mb={1}>Event Type</FormLabel>
                      <Select 
                        fontFamily="Montserrat, sans-serif" 
                        value={formData.event_type} 
                        onChange={(e) => handleInputChange('event_type', e.target.value)} 
                        size="sm"
                      >
                        <option value="">Select event type</option>
                        {eventTypes.map(type => (
                          <option key={type.value} value={type.value}>{type.label}</option>
                        ))}
                      </Select>
                    </FormControl>
                  </GridItem>
                </Grid>
              </VStack>

              <VStack spacing={1} as="section" align="stretch">
                <Text marginBottom="0px" alignSelf="start" fontSize="md" fontWeight="bold"></Text>
                <Grid templateColumns="repeat(2, 1fr)" gap={2}>
                  <GridItem>
                    <FormControl isRequired>
                      <FormLabel fontSize="sm" mb={1}>Start Time</FormLabel>
                      <Input 
                        fontFamily="Montserrat, sans-serif" 
                        type="datetime-local" 
                        value={formData.start_time} 
                        onChange={(e) => handleInputChange('start_time', e.target.value)} 
                        size="sm" 
                      />
                    </FormControl>
                  </GridItem>
                  <GridItem>
                    <FormControl isRequired>
                      <FormLabel fontSize="sm" mb={1}>End Time</FormLabel>
                      <Input 
                        fontFamily="Montserrat, sans-serif" 
                        type="datetime-local" 
                        value={formData.end_time} 
                        onChange={(e) => handleInputChange('end_time', e.target.value)} 
                        size="sm" 
                      />
                    </FormControl>
                  </GridItem>
                </Grid>
              </VStack>

              <VStack spacing={1} as="section" align="stretch">
                <Text marginBottom="0px" alignSelf="start" fontSize="md" fontWeight="bold"></Text>
                <FormControl>
                  <FormLabel fontSize="sm" mb={1}>Table</FormLabel>
                  <Select 
                    fontFamily="Montserrat, sans-serif" 
                    value={formData.table_id} 
                    onChange={(e) => handleInputChange('table_id', e.target.value)} 
                    size="sm"
                  >
                    <option value="">Select table</option>
                    {tables.map(table => (
                      <option key={table.id} value={table.id}>Table {table.table_number}</option>
                    ))}
                  </Select>
                </FormControl>
              </VStack>

              <VStack spacing={1} as="section" align="stretch">
                <Text marginBottom="0px" alignSelf="start" fontSize="md" fontWeight="bold"></Text>
                <FormControl>
                  <FormLabel fontSize="sm" mb={1}>Notes</FormLabel>
                  <Textarea 
                    fontFamily="Montserrat, sans-serif" 
                    value={formData.notes} 
                    onChange={(e) => handleInputChange('notes', e.target.value)} 
                    size="sm" 
                    rows={3}
                    placeholder="Special requests, dietary restrictions, etc."
                  />
                </FormControl>
              </VStack>
            </VStack>
          </DrawerBody>
          <DrawerFooter borderTopWidth="1px" justifyContent="space-between">
            <HStack spacing={3} mb={"10px"}>
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button 
                colorScheme="blue" 
                onClick={handleSave} 
                isLoading={isSaving} 
                loadingText="Creating..."
              >
                Create Reservation
              </Button>
            </HStack>
          </DrawerFooter>
        </DrawerContent>
      </Box>
    </Drawer>
  );
};

export default NewReservationDrawer; 