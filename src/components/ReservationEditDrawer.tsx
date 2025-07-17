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
  Badge,
  IconButton,
  Grid,
  GridItem,
  Alert,
  AlertIcon,
} from '@chakra-ui/react';
import { CloseIcon, DeleteIcon } from '@chakra-ui/icons';
import { formatDateTime, utcToLocalInput, localInputToUTC } from '../utils/dateUtils';
import { supabase } from '../lib/supabase';
import { useSettings } from '../context/SettingsContext';

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
  const [tables, setTables] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [messageError, setMessageError] = useState('');
  const [messageSuccess, setMessageSuccess] = useState('');
  const cancelRef = useRef<HTMLButtonElement>(null);
  const toast = useToast();
  const { settings } = useSettings();
  const timezone = settings?.timezone || 'America/Chicago';

  useEffect(() => {
    console.log('useEffect triggered - isOpen:', isOpen, 'reservationId:', reservationId);
    if (isOpen && reservationId) {
      console.log('Calling fetchReservation and fetchTables');
      fetchReservation();
      fetchTables();
    }
  }, [isOpen, reservationId]);

  const fetchTables = async () => {
    try {
      console.log('Fetching tables...');
      const response = await fetch('/api/tables');
      console.log('Tables response status:', response.status);
      if (response.ok) {
        const result = await response.json();
        console.log('Tables API response:', result);
        console.log('Tables data:', result.data);
        setTables(result.data || []);
      } else {
        console.error('Failed to fetch tables:', response.status);
      }
    } catch (error) {
      console.error('Error fetching tables:', error);
    }
  };

  // Debug: Log tables when they change
  useEffect(() => {
    console.log('Tables state updated:', tables);
  }, [tables]);

  const fetchReservation = async () => {
    setIsLoading(true);
    try {
      console.log('Fetching reservation with ID:', reservationId);
      console.log('API URL:', `/api/reservations/${reservationId}`);
      
      const response = await fetch(`/api/reservations/${reservationId}`);
      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error response:', errorText);
        throw new Error('Failed to fetch reservation');
      }
      
      const data = await response.json();
      console.log('Reservation data received:', data);
      
      setReservation(data);
      setFormData({
        first_name: data.first_name || '',
        last_name: data.last_name || '',
        email: data.email || '',
        phone: data.phone || '',
        party_size: data.party_size || 2,
        event_type: data.event_type || '',
        notes: data.notes || '',
        table_id: data.table_id || '',
        start_time: data.start_time ? utcToLocalInput(data.start_time, timezone) : '',
        end_time: data.end_time ? utcToLocalInput(data.end_time, timezone) : '',
      });
    } catch (error) {
      console.error('Error in fetchReservation:', error);
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
      console.log('Original form data:', formData);
      
      // Convert both times using the new timezone-aware functions
      console.log('Original time values:', { 
        start_time: formData.start_time, 
        end_time: formData.end_time,
        timezone 
      });
      
      const startTimeUTC = formData.start_time ? localInputToUTC(formData.start_time, timezone) : undefined;
      const endTimeUTC = formData.end_time ? localInputToUTC(formData.end_time, timezone) : undefined;
      
      console.log('Converted times:', { startTimeUTC, endTimeUTC });
      
      // Clean phone number if it exists
      const cleanedPhone = formData.phone ? formData.phone.replace(/\D/g, '') : formData.phone;
      
      // Handle empty table_id (convert empty string to null)
      const tableId = formData.table_id === '' ? null : formData.table_id;
      
      // Only include time fields if they have valid values
      const updateData = {
        ...formData,
        phone: cleanedPhone,
        table_id: tableId,
      };
      
      // Only add time fields if they have valid values
      if (startTimeUTC) {
        updateData.start_time = startTimeUTC;
      }
      if (endTimeUTC) {
        updateData.end_time = endTimeUTC;
      }
      
      console.log('Update data being sent:', updateData);
      
      const response = await fetch(`/api/reservations/${reservationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error response:', errorText);
        throw new Error(`Failed to update reservation: ${response.status} ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log('Update successful:', result);
      
      toast({ title: 'Success', description: 'Reservation updated successfully', status: 'success', duration: 3000 });
      console.log('Calling onReservationUpdated callback');
      onReservationUpdated();
      console.log('Closing drawer');
      onClose();
    } catch (error) {
      console.error('Error in handleSave:', error);
      toast({ title: 'Error', description: `Failed to update reservation: ${error.message}`, status: 'error', duration: 5000 });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCheckInToggle = async () => {
    if (!reservation) return;
    
    setIsSaving(true);
    try {
      const newCheckedInStatus = !reservation.checked_in;
      
      const response = await fetch(`/api/reservations/${reservationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          checked_in: newCheckedInStatus
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update check-in status');
      }
      
      const result = await response.json();
      
      // Update local state
      setReservation(prev => ({
        ...prev,
        checked_in: newCheckedInStatus,
        checked_in_at: newCheckedInStatus ? new Date().toISOString() : null
      }));
      
      toast({
        title: 'Success',
        description: newCheckedInStatus ? 'Reservation checked in successfully' : 'Check-in status removed',
        status: 'success',
        duration: 3000,
      });
      
      // Refresh the reservation data
      onReservationUpdated();
      
    } catch (error) {
      console.error('Error toggling check-in status:', error);
      toast({
        title: 'Error',
        description: 'Failed to update check-in status',
        status: 'error',
        duration: 5000,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/reservations/${reservationId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Failed to delete reservation');
      }
      toast({
        title: 'Success',
        description: 'Reservation deleted successfully',
        status: 'success',
        duration: 3000,
      });
      onReservationUpdated();
      onClose();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete reservation',
        status: 'error',
        duration: 5000,
      });
    } finally {
      setIsSaving(false);
      setIsConfirmingDelete(false);
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

  const handleSendMessage = async () => {
    if (!messageText.trim()) {
      setMessageError('Please enter a message');
      return;
    }

    if (!reservation?.phone) {
      setMessageError('No phone number available for this reservation');
      return;
    }

    setIsSendingMessage(true);
    setMessageError('');
    setMessageSuccess('');

    try {
      // Get the current user's session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        throw new Error('Failed to get user session');
      }

      const userEmail = session?.user?.email;
      if (!userEmail) {
        throw new Error('User email not found in session');
      }

      // Check if this is a member reservation
      if (reservation.membership_type === 'member') {
        // Find the member associated with this reservation
        const { data: member, error: memberError } = await supabase
          .from('members')
          .select('member_id, account_id')
          .eq('phone', reservation.phone)
          .single();

        if (memberError || !member) {
          throw new Error('Member not found for this reservation');
        }

        const res = await fetch('/api/sendText', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'x-user-email': userEmail
          },
          body: JSON.stringify({
            member_ids: [String(member.member_id)],
            content: messageText,
            account_id: member.account_id
          })
        });

        const result = await res.json();

        if (res.ok && result.results && result.results.every((r: any) => r.status === 'sent')) {
          setMessageSuccess('Message sent successfully!');
          setMessageText('');
          toast({
            title: 'Success',
            description: 'Message sent successfully!',
            status: 'success',
            duration: 300,
          });
        } else {
          throw new Error(result.results?.[0]?.error || 'Failed to send message');
        }
      } else {
        // For non-members (guests), use the new guest messaging API
        const res = await fetch('/api/sendGuestMessage', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            phone: reservation.phone,
            content: messageText,
            reservation_id: reservationId,
            sent_by: userEmail
          })
        });

        const result = await res.json();

        if (res.ok && result.success) {
          setMessageSuccess('Message sent successfully!');
          setMessageText('');
          toast({
            title: 'Success',
            description: 'Message sent successfully!',
            status: 'success',
            
            duration: 3000,
          });
        } else {
          throw new Error(result.error || result.details || 'Failed to send message');
        }
      }
    } catch (err: any) {
      setMessageError(err.message);
      toast({
        title: 'Error',
        description: err.message,
        status: 'error',
        duration: 3000,
      });
    } finally {
      setIsSendingMessage(false);
    }
  };

  if (!reservationId) return null;

  const eventIcon = eventTypes.find(e => e.value === formData.event_type)?.label.split(' ')[0];

  return (
    <Drawer 
      isOpen={isOpen} 
      placement="right" 
      onClose={onClose} 
      size="sm"
      closeOnOverlayClick={true}
      closeOnEsc={true}
    >
      <Box zIndex="2000" position="relative">
        <DrawerOverlay bg="blackAlpha.600" onClick={onClose} />
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
            {isLoading ? (
              <VStack justify="center" align="center" h="100%">
                <Spinner size="xl" />
              </VStack>
            ) : reservation ? (
              <VStack spacing={1} align="stretch">
                <Box>
                  <HStack justify="space-between" align="flex-start">
                    <VStack align="start" spacing={0} borderRadius="10px" marginTop="0px">
                      <Text mb="0px" fontSize="24px" fontWeight="bold" fontFamily="IvyJournal, sans-serif">
                        {formData.first_name} {formData.last_name} <Badge margin="0px" colorScheme={reservation.membership_type === 'member' ? 'purple' : 'gray'} size="sm">
                          {reservation.membership_type === 'member' ? '🖤' : 'Guest'}
                        </Badge>
                      </Text>
                      <HStack>
                        <Text margin="0px" fontSize="sm" color="gray.600">
                          Table {reservation.tables?.table_number || 'N/A'} | Party Size {formData.party_size} {eventIcon && `| ${eventIcon}`}
                        </Text>
                      </HStack>
                    </VStack>
                    
                    {/* Check-in Button */}
                    <Button
                      size="sm"
                      colorScheme={reservation.checked_in ? 'green' : 'gray'}
                      variant={reservation.checked_in ? 'solid' : 'outline'}
                      onClick={() => handleCheckInToggle()}
                      fontFamily="Montserrat, sans-serif"
                      fontWeight="semibold"
                      borderRadius="10px"
                      marginTop="15px"
                      minW="80px"
                    >
                      {reservation.checked_in ? 'Checked In' : 'Check In'}
                    </Button>
                  </HStack>
                </Box>
              
                <VStack spacing={1} as="section" align="stretch">
                  <Text marginBottom="0px" alignSelf="start" fontSize="md" fontWeight="bold"></Text>
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
                        <Input fontFamily="Montserrat, sans-serif" value={formData.phone} onChange={(e) => handleInputChange('phone', e.target.value)} placeholder="+1 (555) 123-4567" size="sm" />
                      </FormControl>
                    </GridItem>
                  </Grid>
                </VStack>
              
                <Grid as="section" templateColumns="repeat(2, 1fr)" gap={2} alignItems="center">
                  <GridItem colSpan={2}>
                    <Text marginBottom="0px" alignSelf="start" fontSize="md" fontWeight="bold"></Text>
                  </GridItem>
                  <GridItem>
                    <FormControl>
                      <FormLabel  fontSize="sm" mb={1}>Party Size</FormLabel>
                      <Select icon={<></>} fontFamily="Montserrat, sans-serif" marginBottom="10px" value={formData.party_size} onChange={(e) => handleInputChange('party_size', parseInt(e.target.value))} size="sm">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map(size => (
                          <option key={size} value={size}>{size} {size === 1 ? 'person' : 'people'}</option>
                        ))}
                      </Select>
                    </FormControl>
                    <FormControl>
                      <FormLabel  fontSize="sm" mb={1}>Event Type</FormLabel>
                      <Select icon={<></>} fontFamily="Montserrat, sans-serif" marginBottom="10px"  value={formData.event_type} onChange={(e) => handleInputChange('event_type', e.target.value)} size="sm">
                        <option value="">Select an occasion</option>
                        {eventTypes.map(type => (<option key={type.value} value={type.value}>{type.label}</option>))}
                      </Select>
                    </FormControl>
                    <FormControl>
                      <FormLabel fontSize="sm" mb={1}>Table</FormLabel>
                      <Select icon={<></>}
                        fontFamily="Montserrat, sans-serif" 
                        marginBottom="10px" 
                        value={formData.table_id} 
                        onChange={(e) => handleInputChange('table_id', e.target.value)} 
                        size="sm"
                      >
                        <option value="">Select a table</option>
                        {tables && tables.length > 0 ? (
                          tables.map(table => (
                            <option key={table.id} value={table.id}>
                              Table {table.table_number} ({table.seats} seats)
                            </option>
                          ))
                        ) : (
                          <option value="" disabled>Loading tables...</option>
                        )}
                      </Select>
                    </FormControl>
                  </GridItem>
          
                  <GridItem colSpan={2}>
                    <FormControl>
                      <FormLabel fontSize="sm" mb={1}>Start Time</FormLabel>
                      <Input marginBottom="10px" fontFamily="Montserrat, sans-serif" type="datetime-local" value={formData.start_time} onChange={(e) => handleInputChange('start_time', e.target.value)} size="sm" />
                    </FormControl>
                    <FormControl>
                      <FormLabel fontSize="sm" mb={1}>End Time</FormLabel>
                      <Input marginBottom="10px" fontFamily="Montserrat, sans-serif" type="datetime-local" value={formData.end_time} onChange={(e) => handleInputChange('end_time', e.target.value)} size="sm" />
                    </FormControl>
                    <FormControl>
                      <FormLabel fontSize="sm" mb={1}>Notes</FormLabel>
                      <Textarea width="90%" fontFamily="Montserrat, sans-serif" value={formData.notes} onChange={(e) => handleInputChange('notes', e.target.value)} placeholder="Special requests..." size="sm" rows={3} />
                    </FormControl>
                  </GridItem>
                </Grid>

                {/* Text Message Section */}
                
                <VStack spacing={1} as="section" align="stretch">
                  <Text marginBottom="00px" alignSelf="start" fontSize="md" fontWeight="bold" m="0"></Text>
                  
                  {messageError && (
                    <Alert status="error" size="sm" borderRadius="md">
                      <AlertIcon />
                      {messageError}
                    </Alert>
                  )}
                  
                  {messageSuccess && (
                    <Alert status="success" size="sm" borderRadius="md">
                      <AlertIcon boxSize="25px" />
                      {messageSuccess}
                    </Alert>
                  )}
                  
                  <FormControl>
                    <FormLabel fontSize="sm" mb={1}>Message</FormLabel>
                    <Textarea
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      placeholder="Type your message here..."
                      size="sm"
                      rows={3}
                      width={"90%"}
                      fontFamily="Montserrat, sans-serif"
                      resize="vertical"
                      bg="white"
                      borderRadius="8px"
                      border="1px solid"
                      borderColor="gray.300"
                      _focus={{ borderColor: '#A59480', boxShadow: '0 0 0 1px #A59480' }}
                    />
                  </FormControl>
                  
                  <Button
                    onClick={handleSendMessage}
                    isLoading={isSendingMessage}
                    loadingText="Sending..."
                    isDisabled={!messageText.trim() || !reservation?.phone}
                    size="sm"
                    bg="#353535"
                    color="#ecede8"
                    width={"90%"}
                    _hover={{ bg: '#2a2a2a' }}
                    fontFamily="Montserrat, sans-serif"
                    fontWeight="semibold"
                  >
                    Send Message
                  </Button>
                </VStack>

               
                <Box bg="gray.50" p={3} borderRadius="md" borderWidth="1px" borderColor="gray.200">
                  
                  <VStack spacing={1} fontSize="xs">
                    <HStack justify="space-between">
                      <Text fontSize="12px" color="gray.600" fontWeight="medium">Created:</Text>
                      <Text fontSize="12px">{reservation.created_at ? formatDateTime(new Date(reservation.created_at), timezone, { dateStyle: 'medium', timeStyle: 'short' }) : 'N/A'}</Text>
                    </HStack>
                  
                  
                  </VStack>
                </Box>
              </VStack>
            ) : (
              <Text>Reservation not found</Text>
            )}
          </DrawerBody>
          <DrawerFooter borderTopWidth="1px" justifyContent="space-between">
            {isConfirmingDelete ? (
              <HStack w="100%" justifyContent="space-between">
                <Text fontWeight="bold" >Are you sure?</Text>
                <HStack>
                  <Button variant="outline" size="sm" onClick={() => setIsConfirmingDelete(false)}>
                    Cancel
                  </Button>
                  <Button
                    color="#ff0000"
                    size="sm"
                    borderColor="#ff0000"
                    onClick={handleDelete}
                    isLoading={isSaving}
                  >
                    Delete
                  </Button>
                </HStack>
              </HStack>
            ) : (
              <>
                <IconButton
                  aria-label="Delete reservation"
                  icon={<DeleteIcon />}
                  variant="ghost"
                  color="#ff0000"
                  border="none"
                  fontSize="18px"
                  onClick={() => setIsConfirmingDelete(true)}
                />
                <HStack spacing={3} mb={"10px"}>
                  <Button variant="outline" onClick={onClose}>Cancel</Button>
                  <Button colorScheme="blue" onClick={handleSave} isLoading={isSaving} loadingText="Saving...">Save</Button>
                </HStack>
              </>
            )}
          </DrawerFooter>
        </DrawerContent>
      </Box>
    </Drawer>
  );
};

export default ReservationEditDrawer; 