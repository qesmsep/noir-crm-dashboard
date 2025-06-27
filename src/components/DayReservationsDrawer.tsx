import React, { useState, useEffect } from 'react';
import {
  Drawer,
  DrawerBody,
  DrawerHeader,
  DrawerOverlay,
  DrawerContent,
  DrawerCloseButton,
  VStack,
  HStack,
  Text,
  Box,
  Divider,
  useToast,
  Spinner,
  Badge,
  IconButton,
  Button,
  DrawerFooter,
} from '@chakra-ui/react';
import { ChevronRightIcon, CalendarIcon } from '@chakra-ui/icons';
import { formatDateTime } from '../utils/dateUtils';
import { getSupabaseClient } from '../pages/api/supabaseClient';

interface DayReservationsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: Date | null;
  onReservationClick: (reservationId: string) => void;
}

const eventTypeEmojis: Record<string, string> = {
  birthday: '🎂',
  engagement: '💍',
  anniversary: '🥂',
  party: '🎉',
  graduation: '🎓',
  corporate: '🧑‍💼',
  holiday: '❄️',
  networking: '🤝',
  fundraiser: '🎗️',
  bachelor: '🥳',
  bachelorette: '🥳',
  private_event: '🔒',
  fun: '🍸',
  date: '💕',
};

const DayReservationsDrawer: React.FC<DayReservationsDrawerProps> = ({
  isOpen,
  onClose,
  selectedDate,
  onReservationClick,
}) => {
  const [reservations, setReservations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const toast = useToast();
  const supabase = getSupabaseClient();

  useEffect(() => {
    if (isOpen && selectedDate) {
      fetchDayReservations();
    }
  }, [isOpen, selectedDate]);

  const fetchDayReservations = async () => {
    if (!selectedDate) return;
    
    setIsLoading(true);
    try {
      // Create start and end of day in CST
      const startOfDay = new Date(selectedDate);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(selectedDate);
      endOfDay.setHours(23, 59, 59, 999);

      const { data, error } = await supabase
        .from('reservations')
        .select(`
          *,
          tables (
            id,
            table_number,
            seats
          )
        `)
        .gte('start_time', startOfDay.toISOString())
        .lte('start_time', endOfDay.toISOString())
        .order('start_time', { ascending: true });

      if (error) {
        throw error;
      }

      setReservations(data || []);
    } catch (error) {
      console.error('Error fetching day reservations:', error);
      toast({
        title: 'Error',
        description: 'Failed to load reservations for this day',
        status: 'error',
        duration: 5000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (timeString: string) => {
    const date = new Date(timeString);
    return formatDateTime(date, undefined, { 
      hour: 'numeric', 
      minute: '2-digit', 
      hour12: true 
    });
  };

  const formatDate = (date: Date) => {
    return formatDateTime(date, undefined, { 
      weekday: 'long', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const getEventTypeEmoji = (eventType: string) => {
    return eventTypeEmojis[eventType?.toLowerCase()] || '';
  };

  return (
    <Drawer
      isOpen={isOpen}
      placement="left"
      onClose={onClose}
      size="sm"
    >
      <Box zIndex="2000" position="relative">
        <DrawerOverlay bg="blackAlpha.600" />
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
        >
          <DrawerHeader 
            borderBottomWidth="1px" 
            borderColor="#A59480"
            margin="0" 
            fontWeight="bold" 
            paddingTop="0px" 
            fontSize="24px" 
            fontFamily="IvyJournal, sans-serif" 
            color="#353535"
          >
            <HStack spacing={1}>
              
              <VStack align="start" spacing={0}>
                <Text fontSize="lg" fontFamily="IvyJournal, sans-serif">
                  {selectedDate ? formatDate(selectedDate) : 'Select a Date'}
                </Text>
                <Text fontSize="18px" color="#A59480" fontFamily="Montserrat, sans-serif">
                  {reservations.length} reservation{reservations.length !== 1 ? 's' : ''}
                </Text>
              </VStack>
            </HStack>
          </DrawerHeader>

          <DrawerBody p={4} overflowY="auto">
            {isLoading ? (
              <VStack justify="center" align="center" h="100%">
                <Spinner size="xl" color="#353535" />
              </VStack>
            ) : reservations.length === 0 ? (
              <Box 
                display="flex" 
                flexDirection="column" 
                justifyContent="center" 
                alignItems="center" 
                width="100%"
                h="200px"
                textAlign="center"
                p={6}
              >
                <Text fontSize="lg" color="#353535" fontFamily="Montserrat, sans-serif">
                  No reservations for this day
                </Text>
                <Text fontSize="sm" color="#666" mt={2} fontFamily="Montserrat, sans-serif">
                  Select a different date or create a new reservation
                </Text>
              </Box>
            ) : (
              <VStack spacing={0} align="stretch">
                {reservations.map((reservation, index) => {
                  const heart = reservation.membership_type === 'member' ? '🖤 ' : '';
                  const emoji = getEventTypeEmoji(reservation.event_type);
                  const tableNumber = reservation.tables?.table_number || 'N/A';
                  
                  return (
                    <Box key={reservation.id}>
                      <Button
                        
                        h="auto"
                        width="100%"
                        p={4}
                        bg="transparent"
                        _hover={{ bg: 'rgba(165, 148, 128, 0.1)' }}
                        _active={{ bg: 'rgba(165, 148, 128, 0.2)' }}
                        borderRadius={0}
                        borderBottom="1px solid rgba(165, 148, 128, 0.2)"
                        onClick={() => onReservationClick(reservation.id)}
                        display="flex"
                        flexDirection="column"
                        alignItems="stretch"
                        textAlign="left"
                        fontFamily="Montserrat, sans-serif"
                      >
                        <HStack justify="space-between" align="start" w="full">
                          <VStack align="start" spacing={1} flex={1}>
                            <HStack margin="0" spacing={2} align="center">
                              <Text 
                                fontSize="sm" 
                                fontWeight="bold" 
                                color="#353535"
                                fontFamily="Montserrat, sans-serif"
                              >
                                {formatTime(reservation.start_time)}
                              </Text>
                              <Badge 
                                size="sm" 
                                colorScheme={reservation.membership_type === 'member' ? 'purple' : 'gray'}
                                fontFamily="Montserrat, sans-serif"
                              >
                                {reservation.membership_type === 'member' ? '🖤' : 'Guest'}
                              </Badge>
                              <Text 
                              fontSize="md" 
                              fontWeight="semibold" 
                              color="#353535"
                              fontFamily="Montserrat, sans-serif"
                              lineHeight="1.2"
                            >
                              {reservation.first_name} {reservation.last_name}
                            </Text>
                            <Text 
                                fontSize="sm" 
                                color="#666"
                                fontFamily="Montserrat, sans-serif"
                              >
                                Party of {reservation.party_size}
                              </Text>
                              <Text 
                                fontSize="sm" 
                                color="#666"
                                fontFamily="Montserrat, sans-serif"
                              >
                                Table {tableNumber}
                              </Text>
                              {emoji && (
                                <Text fontSize="sm">{emoji}</Text>
                              )}
                            </HStack>
                            
                          
                            
                             
                            
                            {reservation.event_type && (
                              <Text 
                                fontSize="xs" 
                                color="#A59480"
                                fontFamily="Montserrat, sans-serif"
                                textTransform="capitalize"
                              >
                                {reservation.event_type.replace('_', ' ')}
                              </Text>
                            )}
                          </VStack>
                          
                          <ChevronRightIcon color="#A59480" />
                        </HStack>
                      </Button>
                    </Box>
                  );
                })}
              </VStack>
            )}
          </DrawerBody>

          <DrawerFooter borderTopWidth="1px" borderColor="#A59480" justifyContent="center">
            <Button
              onClick={onClose}
              variant="outline"
              size="md"
              fontFamily="Montserrat, sans-serif"
              fontWeight="semibold"
              color="#353535"
              borderColor="#353535"
              _hover={{ bg: 'rgba(53, 53, 53, 0.1)' }}
            >
              Close
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Box>
    </Drawer>
  );
};

export default DayReservationsDrawer; 