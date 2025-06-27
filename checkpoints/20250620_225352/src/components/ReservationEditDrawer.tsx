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
  Badge,
  IconButton,
  Grid,
  GridItem,
} from '@chakra-ui/react';
import { CloseIcon } from '@chakra-ui/icons';
import { formatDateTime } from '../utils/dateUtils';

// Helper: Format a local datetime string with timezone offset
function toOffsetISOString(dateString: string) {
  const d = new Date(dateString);
  const pad = (n: number) => String(n).padStart(2, '0');
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  const offsetMin = -d.getTimezoneOffset();
  const sign = offsetMin >= 0 ? '+' : '-';
  const absOffset = Math.abs(offsetMin);
  const offsetHours = pad(Math.floor(absOffset / 60));
  const offsetMinutes = pad(absOffset % 60);
  return `${year}-${month}-${day}T${hours}:${minutes}:00${sign}${offsetHours}:${offsetMinutes}`;
}

interface ReservationEditDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  reservationId: string | null;
  onReservationUpdated: () => void;
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

const ReservationEditDrawer: React.FC<ReservationEditDrawerProps> = ({
  isOpen,
  onClose,
  reservationId,
  onReservationUpdated,
}) => {
  const [reservation, setReservation] = useState<any>(null);
  const [formData, setFormData] = useState<any>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (isOpen && reservationId) {
      fetchReservation();
    }
  }, [isOpen, reservationId]);

  const fetchReservation = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/reservations/${reservationId}`);
      if (!response.ok) throw new Error('Failed to fetch reservation');
      const data = await response.json();
      setReservation(data);
      setFormData({
        first_name: data.first_name || '',
        last_name: data.last_name || '',
        email: data.email || '',
        phone: data.phone || '',
        party_size: data.party_size || 2,
        event_type: data.event_type || '',
        notes: data.notes || '',
        start_time: data.start_time
          ? new Date(data.start_time)
              .toLocaleString('sv-SE', { timeZone: 'America/Chicago' })
              .slice(0, 16)
          : '',
        end_time: data.end_time
          ? new Date(data.end_time)
              .toLocaleString('sv-SE', { timeZone: 'America/Chicago' })
              .slice(0, 16)
          : '',
      });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to load reservation details', status: 'error', duration: 5000 });
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updateData = {
        ...formData,
        start_time: formData.start_time ? toOffsetISOString(formData.start_time) : undefined,
        end_time: formData.end_time ? toOffsetISOString(formData.end_time) : undefined,
      };
      const response = await fetch(`/api/reservations/${reservationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });
      if (!response.ok) throw new Error('Failed to update reservation');
      toast({ title: 'Success', description: 'Reservation updated successfully', status: 'success', duration: 3000 });
      onReservationUpdated();
      onClose();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to update reservation', status: 'error', duration: 5000 });
    } finally {
      setIsSaving(false);
    }
  };

  const formatPhoneDisplay = (phone: string) => {
    if (!phone) return '';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return `+${cleaned.slice(0,1)} (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
    }
    if (cleaned.length === 10) {
      return `+1 (${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
  };

  if (!reservationId) return null;

  const eventIcon = eventTypes.find(e => e.value === formData.event_type)?.label.split(' ')[0];

  return (
    <Drawer isOpen={isOpen} placement="right" onClose={onClose} size="sm" >
      <Box zIndex="2000" position="relative">
        <DrawerOverlay bg="blackAlpha.600" />
        <DrawerContent border="2px solid #353535" borderRadius="10px"  fontFamily="Montserrat, sans-serif" maxW="350px" maxH="flex" w="50vw" boxShadow="xl" mt="100px" mb="100px"paddingRight="40px" paddingLeft="40px" backgroundColor="#ecede8">
          <DrawerHeader borderBottomWidth="1px" fontWeight="bold" paddingTop="10px" fontSize="20px" fontFamily="IvyJournal, sans-serif" color="#353535">
            Edit Reservation
          </DrawerHeader>
          <DrawerBody p={4} overflowY="auto">
            {isLoading ? (
              <VStack justify="center" align="center" h="100%">
                <Spinner size="xl" />
              </VStack>
            ) : reservation ? (
              <VStack spacing={1} align="stretch">
                <Box>
                  <Text mb="0px" fontSize="24px" fontWeight="bold">
                    {formData.first_name} {formData.last_name} <Badge margin="0px" colorScheme={reservation.membership_type === 'member' ? 'purple' : 'gray'} size="sm">
                      {reservation.membership_type === 'member' ? '🖤' : 'Guest'}
                    </Badge>
                  </Text>
                  <HStack>
                    <Text margin="0px" fontSize="sm" color="gray.600">
                      Table {reservation.tables?.table_number || 'N/A'} | Party Size {formData.party_size} {eventIcon && `| ${eventIcon}`}
                    </Text>
                  </HStack>
                </Box>
              
                <VStack spacing={1} as="section" align="stretch">
                  <Text marginBottom="10px" alignSelf="start" fontSize="md" fontWeight="bold">Contact</Text>
                  <Grid templateColumns="repeat(2, 1fr)" gap={2}>
                    <GridItem>
                      <FormControl>
                        <FormLabel fontSize="sm" mb={1}>First Name</FormLabel>
                        <Input fontFamily="Montserrat, sans-serif" value={formData.first_name} onChange={(e) => handleInputChange('first_name', e.target.value)} size="sm" />
                      </FormControl>
                    </GridItem>
                    <GridItem>
                      <FormControl>
                        <FormLabel fontSize="sm" mb={1}>Last Name</FormLabel>
                        <Input fontFamily="Montserrat, sans-serif" value={formData.last_name} onChange={(e) => handleInputChange('last_name', e.target.value)} size="sm" />
                      </FormControl>
                    </GridItem>
                    <GridItem>
                      <FormControl>
                        <FormLabel fontSize="sm" mb={1}>Email</FormLabel>
                        <Input fontFamily="Montserrat, sans-serif" type="email" value={formData.email} onChange={(e) => handleInputChange('email', e.target.value)} size="sm" />
                      </FormControl>
                    </GridItem>
                    <GridItem>
                      <FormControl>
                        <FormLabel fontSize="sm" mb={1}>Phone</FormLabel>
                        <Input fontFamily="Montserrat, sans-serif" value={formatPhoneDisplay(formData.phone)} onChange={(e) => handleInputChange('phone', e.target.value)} placeholder="+1 (555) 123-4567" size="sm" />
                      </FormControl>
                    </GridItem>
                  </Grid>
                </VStack>
                <Divider />
                <Grid as="section" templateColumns="repeat(2, 1fr)" gap={2} alignItems="center">
                  <GridItem colSpan={2}>
                    <Text marginBottom="10px" alignSelf="start" fontSize="md" fontWeight="bold">Details</Text>
                  </GridItem>
                  <GridItem>
                    <FormControl>
                      <FormLabel  fontSize="sm" mb={1}>Party Size</FormLabel>
                      <Select fontFamily="Montserrat, sans-serif" marginBottom="10px" value={formData.party_size} onChange={(e) => handleInputChange('party_size', parseInt(e.target.value))} size="sm">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map(size => (
                          <option key={size} value={size}>{size} {size === 1 ? 'person' : 'people'}</option>
                        ))}
                      </Select>
                    </FormControl>
                    <FormControl>
                      <FormLabel  fontSize="sm" mb={1}>Event Type</FormLabel>
                      <Select fontFamily="Montserrat, sans-serif" marginBottom="10px"  value={formData.event_type} onChange={(e) => handleInputChange('event_type', e.target.value)} size="sm">
                        <option value="">Select an occasion</option>
                        {eventTypes.map(type => (<option key={type.value} value={type.value}>{type.label}</option>))}
                      </Select>
                    </FormControl>
                  </GridItem>
                  <GridItem>
                    
                  </GridItem>
                  <GridItem>
                  
                  </GridItem>
                  <GridItem>
                    
                  </GridItem>
                  <GridItem>
                  <FormControl>
                      <FormLabel fontSize="sm" mb={1}>Start Time</FormLabel>
                      <Input marginBottom="10px" fontFamily="Montserrat, sans-serif" type="datetime-local" value={formData.start_time} onChange={(e) => handleInputChange('start_time', e.target.value)} size="sm" />
                    </FormControl>
                    <FormControl>
                      <FormLabel fontSize="sm" mb={1}>End Time</FormLabel>
                      <Input marginBottom="10px" fontFamily="Montserrat, sans-serif" type="datetime-local" value={formData.end_time} onChange={(e) => handleInputChange('end_time', e.target.value)} size="sm" />
                    </FormControl>
                  </GridItem>
                  <GridItem colSpan={2}>
                    <FormControl>
                      <FormLabel fontSize="sm" mb={1}>Notes</FormLabel>
                      <Textarea width="90%" fontFamily="Montserrat, sans-serif" value={formData.notes} onChange={(e) => handleInputChange('notes', e.target.value)} placeholder="Special requests..." size="sm" rows={3} />
                    </FormControl>
                  </GridItem>
                </Grid>
                <Divider />
                <Box bg="gray.50" p={3} borderRadius="md" borderWidth="1px" borderColor="gray.200">
                  
                  <VStack spacing={1} align="stretch" fontSize="xs">
                    <HStack justify="space-between">
                      <Text color="gray.600" fontWeight="medium">Created:</Text>
                      <Text>{reservation.created_at ? formatDateTime(new Date(reservation.created_at), { dateStyle: 'medium', timeStyle: 'short' }) : 'N/A'}</Text>
                    </HStack>
                  
                  
                  </VStack>
                </Box>
              </VStack>
            ) : (
              <Text>Reservation not found</Text>
            )}
          </DrawerBody>
          <DrawerFooter borderTopWidth="1px" justifyContent="space-between">
            <IconButton aria-label="Close" icon={<CloseIcon />} size="sm" variant="ghost" onClick={onClose} />
            <HStack spacing={3}>
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button colorScheme="blue" onClick={handleSave} isLoading={isSaving} loadingText="Saving...">Save</Button>
            </HStack>
          </DrawerFooter>
        </DrawerContent>
      </Box>
    </Drawer>
  );
};

export default ReservationEditDrawer; 