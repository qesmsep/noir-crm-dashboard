import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
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
  useToast,
  Spinner,
  Badge,
  IconButton,
  Grid,
  GridItem,
  Alert,
  AlertIcon,
  Checkbox,
} from '@chakra-ui/react';
import { DeleteIcon } from '@chakra-ui/icons';
import { formatDateTime, utcToLocalInput, localInputToUTC } from '../utils/dateUtils';
import { supabase } from '../lib/supabase';
import { useSettings } from '../context/SettingsContext';

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

interface ReservationEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  reservationId: string | null;
  onReservationUpdated: () => void;
}

/**
 * ReservationEditModal - Centered popup modal for editing reservations
 * Uses portal to document.body to avoid z-index issues
 */
const ReservationEditModal: React.FC<ReservationEditModalProps> = ({
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
  const [mounted, setMounted] = useState(false);
  const toast = useToast();
  const { settings } = useSettings();
  const timezone = settings?.timezone || 'America/Chicago';

  useEffect(() => {
    setMounted(true);
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  // Handle escape key and body scroll lock
  useEffect(() => {
    if (!isOpen) {
      document.body.style.overflow = '';
      return;
    }
    
    document.body.style.overflow = 'hidden';
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isConfirmingDelete) {
        handleClose();
      }
    };

    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, isConfirmingDelete]);

  useEffect(() => {
    if (isOpen && reservationId) {
      fetchReservation();
      fetchTables();
    }
  }, [isOpen, reservationId]);

  const fetchTables = async () => {
    try {
      const response = await fetch('/api/tables');
      if (response.ok) {
        const result = await response.json();
        setTables(result.data || []);
      }
    } catch (error) {
      console.error('Error fetching tables:', error);
    }
  };

  const fetchReservation = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/reservations/${reservationId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch reservation');
      }
      
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
      const startTimeUTC = formData.start_time ? localInputToUTC(formData.start_time, timezone) : undefined;
      const endTimeUTC = formData.end_time ? localInputToUTC(formData.end_time, timezone) : undefined;
      const cleanedPhone = formData.phone ? formData.phone.replace(/\D/g, '') : formData.phone;
      const tableId = formData.table_id === '' ? null : formData.table_id;
      
      const updateData: any = {
        ...formData,
        phone: cleanedPhone,
        table_id: tableId,
      };
      
      if (startTimeUTC) updateData.start_time = startTimeUTC;
      if (endTimeUTC) updateData.end_time = endTimeUTC;
      
      const response = await fetch(`/api/reservations/${reservationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to update reservation`);
      }
      
      toast({ title: 'Success', description: 'Reservation updated successfully', status: 'success', duration: 3000 });
      onReservationUpdated();
      onClose();
    } catch (error: any) {
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
        body: JSON.stringify({ checked_in: newCheckedInStatus }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update check-in status');
      }
      
      setReservation((prev: any) => ({
        ...prev,
        checked_in: newCheckedInStatus,
        checked_in_at: newCheckedInStatus ? new Date().toISOString() : null
      }));
      
      if (newCheckedInStatus && reservation.payment_intent_id && reservation.hold_status === 'confirmed') {
        try {
          const holdResponse = await fetch('/api/release-holds', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reservation_id: reservationId }),
          });
          
          if (holdResponse.ok) {
            setReservation((prev: any) => ({
              ...prev,
              hold_status: 'released',
              hold_released_at: new Date().toISOString()
            }));
            
            toast({
              title: 'Success',
              description: 'Reservation checked in and credit card hold released',
              status: 'success',
              duration: 3000,
            });
          } else {
            toast({
              title: 'Warning',
              description: 'Reservation checked in but failed to release credit card hold. Please release manually.',
              status: 'warning',
              duration: 5000,
            });
          }
        } catch (holdError) {
          console.error('Error releasing hold:', holdError);
          toast({
            title: 'Warning',
            description: 'Reservation checked in but failed to release credit card hold. Please release manually.',
            status: 'warning',
            duration: 5000,
          });
        }
      } else {
        toast({
          title: 'Success',
          description: newCheckedInStatus ? 'Reservation checked in successfully' : 'Check-in status removed',
          status: 'success',
          duration: 3000,
        });
      }
      
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
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        throw new Error('Failed to get user session');
      }

      const userEmail = session?.user?.email;
      if (!userEmail) {
        throw new Error('User email not found in session');
      }

      if (reservation.membership_type === 'member') {
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
            duration: 3000,
          });
        } else {
          throw new Error(result.results?.[0]?.error || 'Failed to send message');
        }
      } else {
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

  const handleClose = useCallback(() => {
    document.body.style.overflow = '';
    setMessageText('');
    setMessageError('');
    setMessageSuccess('');
    setIsConfirmingDelete(false);
    onClose();
  }, [onClose]);

  if (!mounted || !isOpen || !reservationId) return null;

  const eventIcon = eventTypes.find(e => e.value === formData.event_type)?.label.split(' ')[0];

  const portalContent = (
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
        if (e.target === e.currentTarget && !isConfirmingDelete) {
          handleClose();
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
        onClick={handleClose}
        cursor="pointer"
      />
      
      {/* Modal Content */}
      <Box
        position="relative"
        zIndex={99999999}
        pointerEvents="auto"
        maxW="600px"
        w="90vw"
        maxH="90vh"
        bg="#ecede8"
        borderRadius="10px"
        border="2px solid #353535"
        fontFamily="Montserrat, sans-serif"
        overflowY="auto"
        boxShadow="2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <Box
          borderBottomWidth="1px"
          p={4}
          pb={2}
          pt={3}
          fontFamily="IvyJournal, sans-serif"
          position="relative"
        >
          {isLoading ? (
            <Text fontSize="20px" fontWeight="bold" color="#353535">Loading...</Text>
          ) : reservation ? (
            <VStack align="start" spacing={1}>
              <HStack justify="space-between" width="100%">
                <Text fontSize="20px" fontWeight="bold" color="#353535">
                  {formData.first_name} {formData.last_name}
                </Text>
                <HStack>
                  <Badge colorScheme={reservation.membership_type === 'member' ? 'purple' : 'gray'} size="sm">
                    {reservation.membership_type === 'member' ? '🖤' : 'Guest'}
                  </Badge>
                  <Button
                    size="sm"
                    colorScheme={reservation.checked_in ? 'green' : 'gray'}
                    variant={reservation.checked_in ? 'solid' : 'outline'}
                    onClick={handleCheckInToggle}
                    fontFamily="Montserrat, sans-serif"
                  >
                    {reservation.checked_in ? 'Checked In' : 'Check In'}
                  </Button>
                </HStack>
              </HStack>
              <Text fontSize="sm" color="gray.600">
                Table {reservation.tables?.table_number || 'N/A'} | Party Size {formData.party_size} {eventIcon && `| ${eventIcon}`}
              </Text>
            </VStack>
          ) : (
            <Text fontSize="20px" fontWeight="bold" color="#353535">Edit Reservation</Text>
          )}
          <Button
            position="absolute"
            top={2}
            right={2}
            variant="ghost"
            size="sm"
            onClick={handleClose}
            aria-label="Close"
          >
            ×
          </Button>
        </Box>

        {/* Body */}
        <Box p={4} overflowY="auto" maxH="calc(90vh - 160px)">
          {isLoading ? (
            <VStack justify="center" align="center" h="200px">
              <Spinner size="xl" />
            </VStack>
          ) : reservation ? (
            <VStack spacing={4} align="stretch">
              {/* Contact Information */}
              <Box>
                <Grid templateColumns="repeat(2, 1fr)" gap={3}>
                  <GridItem>
                    <FormControl>
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
                    <FormControl>
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
                    <FormControl>
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
              </Box>

              {/* Reservation Details */}
              <Box>
                <Grid templateColumns="repeat(2, 1fr)" gap={3}>
                  <GridItem>
                    <FormControl>
                      <FormLabel fontSize="xs" mb={0.5} fontWeight="600">Party Size</FormLabel>
                      <Select 
                        fontFamily="Montserrat, sans-serif" 
                        value={formData.party_size} 
                        onChange={(e) => handleInputChange('party_size', parseInt(e.target.value))} 
                        size="sm"
                        h="32px"
                      >
                        {Array.from({ length: 15 }, (_, i) => i + 1).map(num => (
                          <option key={num} value={num}>{num} {num === 1 ? 'person' : 'people'}</option>
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
                        <option value="">Select an occasion</option>
                        {eventTypes.map(type => (
                          <option key={type.value} value={type.value}>{type.label}</option>
                        ))}
                      </Select>
                    </FormControl>
                  </GridItem>
                  <GridItem>
                    <FormControl>
                      <FormLabel fontSize="xs" mb={0.5} fontWeight="600">Table</FormLabel>
                      <Select 
                        fontFamily="Montserrat, sans-serif" 
                        value={formData.table_id} 
                        onChange={(e) => handleInputChange('table_id', e.target.value)} 
                        size="sm"
                        h="32px"
                      >
                        <option value="">Select a table</option>
                        {tables.map(table => (
                          <option key={table.id} value={table.id}>
                            Table {table.table_number} ({table.seats} seats)
                          </option>
                        ))}
                      </Select>
                    </FormControl>
                  </GridItem>
                  <GridItem>
                    <FormControl>
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
                    <FormControl>
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
              </Box>

              <FormControl>
                <FormLabel fontSize="xs" mb={0.5} fontWeight="600">Notes</FormLabel>
                <Textarea 
                  fontFamily="Montserrat, sans-serif" 
                  value={formData.notes} 
                  onChange={(e) => handleInputChange('notes', e.target.value)} 
                  placeholder="Special requests..." 
                  size="sm" 
                  rows={3}
                />
              </FormControl>

              {/* Send Message Section */}
              <Box>
                <Text fontSize="sm" fontWeight="bold" mb={2}>Send Message</Text>
                
                {messageError && (
                  <Alert status="error" size="sm" borderRadius="md" mb={2}>
                    <AlertIcon />
                    {messageError}
                  </Alert>
                )}
                
                {messageSuccess && (
                  <Alert status="success" size="sm" borderRadius="md" mb={2}>
                    <AlertIcon />
                    {messageSuccess}
                  </Alert>
                )}
                
                <Textarea
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Type your message here..."
                  size="sm"
                  rows={3}
                  fontFamily="Montserrat, sans-serif"
                  mb={2}
                />
                
                <Button
                  onClick={handleSendMessage}
                  isLoading={isSendingMessage}
                  loadingText="Sending..."
                  isDisabled={!messageText.trim() || !reservation?.phone}
                  size="sm"
                  bg="#353535"
                  color="#ecede8"
                  _hover={{ bg: '#2a2a2a' }}
                  fontFamily="Montserrat, sans-serif"
                >
                  Send Message
                </Button>
              </Box>

              {/* System Info */}
              <Box bg="gray.50" p={3} borderRadius="md" borderWidth="1px" borderColor="gray.200">
                <Text fontSize="xs" color="gray.600">
                  Created {reservation.created_at ? formatDateTime(new Date(reservation.created_at), timezone, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }) : ''}
                </Text>
                <Badge colorScheme="blue" fontFamily="Montserrat, sans-serif" mt={1}>
                  {(reservation.source && reservation.source !== '') ? reservation.source : 'unknown'}
                </Badge>
              </Box>
            </VStack>
          ) : (
            <Text>Reservation not found</Text>
          )}
        </Box>

        {/* Footer */}
        <Box
          borderTopWidth="1px"
          p={3}
          display="flex"
          justifyContent="space-between"
          alignItems="center"
        >
          {isConfirmingDelete ? (
            <HStack w="100%" justifyContent="space-between">
              <Text fontWeight="bold">Are you sure?</Text>
              <HStack>
                <Button variant="outline" size="sm" onClick={() => setIsConfirmingDelete(false)}>
                  Cancel
                </Button>
                <Button
                  colorScheme="red"
                  size="sm"
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
                color="red"
                onClick={() => setIsConfirmingDelete(true)}
              />
              <HStack spacing={2}>
                <Button variant="outline" onClick={handleClose} size="sm" h="32px">Cancel</Button>
                <Button 
                  colorScheme="blue" 
                  onClick={handleSave} 
                  isLoading={isSaving} 
                  loadingText="Saving..."
                  size="sm"
                  h="32px"
                >
                  Save
                </Button>
              </HStack>
            </>
          )}
        </Box>
      </Box>
    </Box>
  );

  return typeof document !== 'undefined'
    ? createPortal(portalContent, document.body)
    : null;
};

export default ReservationEditModal;

