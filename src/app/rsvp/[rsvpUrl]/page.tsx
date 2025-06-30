'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Input,
  Textarea,
  Button,
  FormControl,
  FormLabel,
  Select,
  useToast,
  Image,
  Heading,
  Container,
  Spinner,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure
} from '@chakra-ui/react';

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
  background_image_url: string | null;
  require_time_selection: boolean;
}

interface RSVPForm {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  party_size: number;
  time_selected: string;
  special_requests: string;
}

export default function RSVPPage({ params }: { params: Promise<{ rsvpUrl: string }> }) {
  const [event, setEvent] = useState<PrivateEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rsvpUrl, setRsvpUrl] = useState<string>('');
  const [remainingSpots, setRemainingSpots] = useState<number | null>(null);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();

  const [formData, setFormData] = useState<RSVPForm>({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    party_size: 1,
    time_selected: '',
    special_requests: ''
  });

  useEffect(() => {
    const initPage = async () => {
      const resolvedParams = await params;
      setRsvpUrl(resolvedParams.rsvpUrl);
      await fetchEvent(resolvedParams.rsvpUrl);
    };
    
    initPage();
  }, [params]);

  const fetchEvent = async (url: string) => {
    try {
      const response = await fetch(`/api/rsvp/${url}`);
      if (!response.ok) {
        throw new Error('Event not found');
      }
      const eventData = await response.json();
      setEvent(eventData);
      
      // Fetch current attendee count to calculate remaining spots
      if (eventData.id) {
        const attendeeResponse = await fetch(`/api/rsvp/attendee-count?event_id=${eventData.id}`);
        if (attendeeResponse.ok) {
          const { currentAttendees } = await attendeeResponse.json();
          setRemainingSpots(eventData.total_attendees_maximum - currentAttendees);
        }
      }
    } catch (error) {
      console.error('Error fetching event:', error);
      setError('This RSVP link is invalid or the event has been cancelled.');
    } finally {
      setLoading(false);
    }
  };

  const generateTimeOptions = () => {
    if (!event) return [];

    const startTime = new Date(event!.start_time);
    const endTime = new Date(event!.end_time);
    const options: { value: string; label: string }[] = [];

    let currentTime = new Date(startTime);
    while (currentTime <= endTime) {
      options.push({
        value: currentTime.toISOString(),
        label: currentTime.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        })
      });
      currentTime.setMinutes(currentTime.getMinutes() + 15);
    }

    return options;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const response = await fetch('/api/rsvp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          private_event_id: event?.id,
          ...formData
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to submit RSVP');
      }

      onOpen();
    } catch (error) {
      console.error('Error submitting RSVP:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to submit RSVP',
        status: 'error',
        duration: 5000,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleInputChange = (field: keyof RSVPForm, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const formatDateTime = (dateTime: string) => {
    return new Date(dateTime).toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  if (loading) {
    return (
      <Box
        minH="100vh"
        display="flex"
        alignItems="center"
        justifyContent="center"
        bg="gray.50"
      >
        <VStack spacing={4}>
          <Spinner size="xl" />
          <Text>Loading event details...</Text>
        </VStack>
      </Box>
    );
  }

  if (error || !event) {
    return (
      <Box
        minH="100vh"
        display="flex"
        alignItems="center"
        justifyContent="center"
        bg="gray.50"
      >
        <Alert status="error" maxW="md">
          <AlertIcon />
          <Box>
            <AlertTitle>Event Not Found</AlertTitle>
            <AlertDescription>
              {error || 'This RSVP link is invalid or the event has been cancelled.'}
            </AlertDescription>
          </Box>
        </Alert>
      </Box>
    );
  }

  const timeOptions = generateTimeOptions();

  return (
    <Box
      minH="100vh"
      bg={event.background_image_url ? 'transparent' : 'gray.50'}
      position="relative"
    >
      {event.background_image_url && (
        <Box
          position="absolute"
          top={0}
          left={0}
          right={0}
          bottom={0}
          zIndex={0}
        >
          <Image
            src={event.background_image_url}
            alt="Event background"
            w="full"
            h="full"
            objectFit="cover"
            filter="brightness(0.3)"
          />
        </Box>
      )}

      <Container maxW="md" py={8} position="relative" zIndex={1}>
        <VStack spacing={8} align="stretch">
          <Box textAlign="center" color={event.background_image_url ? 'white' : 'gray.800'}>
            <Heading size="lg" mb={2}>
              {event.title}
            </Heading>
            <Text fontSize="lg" mb={4}>
              {event.event_type}
            </Text>
            <Text fontSize="md" mb={2}>
              {formatDateTime(event.start_time)}
            </Text>
            <Text fontSize="sm" opacity={0.8}>
              {event.max_guests} guests maximum per reservation
              {event.deposit_required > 0 && ` • $${event.deposit_required} deposit required`}
            </Text>
            <Text fontSize="sm" opacity={0.8} mt={1}>
              Total Event Capacity: {event.total_attendees_maximum} guests
              {remainingSpots !== null && (
                <span style={{ color: remainingSpots <= 5 ? '#e53e3e' : '#38a169' }}>
                  {' '}• {remainingSpots} spots remaining
                </span>
              )}
            </Text>
            {event.event_description && (
              <Text fontSize="sm" mt={4} opacity={0.9}>
                {event.event_description}
              </Text>
            )}
          </Box>

          <Box
            bg="white"
            p={6}
            borderRadius="lg"
            boxShadow="lg"
          >
            <form onSubmit={handleSubmit}>
              <VStack spacing={4}>
                <Heading size="md" mb={4}>
                  RSVP Form
                </Heading>

                <HStack spacing={4} w="full">
                  <FormControl isRequired>
                    <FormLabel>First Name</FormLabel>
                    <Input
                      value={formData.first_name}
                      onChange={(e) => handleInputChange('first_name', e.target.value)}
                      placeholder="First name"
                    />
                  </FormControl>

                  <FormControl isRequired>
                    <FormLabel>Last Name</FormLabel>
                    <Input
                      value={formData.last_name}
                      onChange={(e) => handleInputChange('last_name', e.target.value)}
                      placeholder="Last name"
                    />
                  </FormControl>
                </HStack>

                <FormControl isRequired>
                  <FormLabel>Email</FormLabel>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    placeholder="your@email.com"
                  />
                </FormControl>

                <FormControl isRequired>
                  <FormLabel>Phone Number</FormLabel>
                  <Input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    placeholder="(555) 123-4567"
                  />
                </FormControl>

                <FormControl isRequired>
                  <FormLabel>Party Size</FormLabel>
                  <Select
                    value={formData.party_size}
                    onChange={(e) => handleInputChange('party_size', parseInt(e.target.value))}
                  >
                    {Array.from({ length: Math.min(event.max_guests, remainingSpots || event.max_guests) }, (_, i) => i + 1).map(num => (
                      <option key={num} value={num}>{num} {num === 1 ? 'guest' : 'guests'}</option>
                    ))}
                  </Select>
                  {remainingSpots !== null && remainingSpots < event.max_guests && (
                    <Text fontSize="xs" color="red.500" mt={1}>
                      Limited by remaining spots ({remainingSpots} available)
                    </Text>
                  )}
                </FormControl>

                {event.require_time_selection && (
                  <FormControl isRequired>
                    <FormLabel>Preferred Time</FormLabel>
                    <Select
                      value={formData.time_selected}
                      onChange={(e) => handleInputChange('time_selected', e.target.value)}
                      placeholder="Select a time"
                    >
                      {timeOptions.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                  </FormControl>
                )}

                <FormControl>
                  <FormLabel>Special Requests</FormLabel>
                  <Textarea
                    value={formData.special_requests}
                    onChange={(e) => handleInputChange('special_requests', e.target.value)}
                    placeholder="Any special requests or dietary restrictions..."
                    rows={3}
                  />
                </FormControl>

                <Button
                  type="submit"
                  colorScheme="blue"
                  size="lg"
                  w="full"
                  isLoading={submitting}
                  loadingText="Submitting RSVP..."
                >
                  Submit RSVP
                </Button>
              </VStack>
            </form>
          </Box>
        </VStack>
      </Container>

      <Modal isOpen={isOpen} onClose={onClose} isCentered>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>RSVP Confirmed!</ModalHeader>
          <ModalBody>
            <VStack spacing={4} textAlign="center">
              <Text fontSize="lg">
                Thank you for your RSVP!
              </Text>
              <Text>
                We've sent a confirmation message to your phone number. 
                Please respond directly to that message if you need to make any changes.
              </Text>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button colorScheme="blue" onClick={onClose}>
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
} 