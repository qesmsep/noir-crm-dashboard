"use client";

import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardBody,
  CardHeader,
  Container,
  Heading,
  Text,
  VStack,
  HStack,
  Badge,
  Spinner,
  Center,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Icon,
  Divider,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  FormControl,
  FormLabel,
  Input,
  Textarea,
  useToast,
  useDisclosure,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
} from '@chakra-ui/react';
import { CalendarIcon, TimeIcon } from '@chakra-ui/icons';
import { useRouter } from 'next/navigation';
import { useMemberAuth } from '@/context/MemberAuthContext';
import MemberNav from '@/components/member/MemberNav';

export default function MemberReservationsPage() {
  const router = useRouter();
  const toast = useToast();
  const { member, loading } = useMemberAuth();
  const [reservations, setReservations] = useState<any[]>([]);
  const [loadingReservations, setLoadingReservations] = useState(true);

  // Edit modal state
  const { isOpen: isEditOpen, onOpen: onEditOpen, onClose: onEditClose } = useDisclosure();
  const [selectedReservation, setSelectedReservation] = useState<any>(null);
  const [editFormData, setEditFormData] = useState({ party_size: 0, notes: '' });
  const [submitting, setSubmitting] = useState(false);

  // Cancel alert state
  const { isOpen: isCancelOpen, onOpen: onCancelOpen, onClose: onCancelClose } = useDisclosure();
  const [reservationToCancel, setReservationToCancel] = useState<any>(null);
  const [cancelling, setCancelling] = useState(false);
  const cancelRef = React.useRef(null);

  useEffect(() => {
    if (!loading && !member) {
      router.push('/member/login');
    } else if (member) {
      fetchReservations();
    }
  }, [member, loading, router]);

  const fetchReservations = async () => {
    try {
      const response = await fetch('/api/member/reservations', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setReservations(data.reservations || []);
      }
    } catch (error) {
      console.error('Error fetching reservations:', error);
    } finally {
      setLoadingReservations(false);
    }
  };

  const handleEditClick = (reservation: any) => {
    setSelectedReservation(reservation);
    setEditFormData({
      party_size: reservation.party_size,
      notes: reservation.notes || '',
    });
    onEditOpen();
  };

  const handleEditSubmit = async () => {
    if (!selectedReservation) return;

    setSubmitting(true);

    try {
      const response = await fetch('/api/member/reservations/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          reservation_id: selectedReservation.id,
          party_size: editFormData.party_size,
          notes: editFormData.notes,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update reservation');
      }

      toast({
        title: 'Success',
        description: 'Reservation updated successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

      onEditClose();
      fetchReservations();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update reservation',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelClick = (reservation: any) => {
    setReservationToCancel(reservation);
    onCancelOpen();
  };

  const handleCancelConfirm = async () => {
    if (!reservationToCancel) return;

    setCancelling(true);

    try {
      const response = await fetch('/api/member/reservations/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          reservation_id: reservationToCancel.id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to cancel reservation');
      }

      toast({
        title: 'Cancelled',
        description: 'Reservation cancelled successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

      onCancelClose();
      fetchReservations();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to cancel reservation',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setCancelling(false);
    }
  };

  if (loading || loadingReservations) {
    return (
      <Center minH="100vh" bg="#ECEDE8">
        <Spinner size="xl" color="#A59480" />
      </Center>
    );
  }

  if (!member) {
    return null;
  }

  const now = new Date();
  const upcomingReservations = reservations.filter(
    (r) => new Date(r.start_time) >= now
  ).sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

  const pastReservations = reservations.filter(
    (r) => new Date(r.start_time) < now
  ).sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());

  const ReservationCard = ({ reservation, isPast }: { reservation: any; isPast: boolean }) => (
    <Card
      bg="white"
      borderRadius="12px"
      border="1px solid"
      borderColor="#ECEAE5"
      boxShadow="sm"
      opacity={isPast ? 0.7 : 1}
    >
      <CardBody>
        <HStack justify="space-between" align="flex-start" mb={3}>
          <VStack align="flex-start" spacing={1}>
            <HStack spacing={2}>
              <Icon as={CalendarIcon} color="#A59480" boxSize={4} />
              <Text fontSize="lg" fontWeight="medium" color="#1F1F1F">
                {new Date(reservation.start_time).toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </Text>
            </HStack>
            <HStack spacing={2}>
              <Icon as={TimeIcon} color="#5A5A5A" boxSize={4} />
              <Text fontSize="md" color="#5A5A5A">
                {new Date(reservation.start_time).toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true,
                })}
              </Text>
            </HStack>
          </VStack>
          <Badge
            bg={reservation.status === 'confirmed' ? '#4CAF50' : '#A59480'}
            color="white"
            px={3}
            py={1}
            borderRadius="md"
            fontSize="xs"
            textTransform="capitalize"
          >
            {reservation.status}
          </Badge>
        </HStack>

        <Divider my={3} />

        <VStack align="flex-start" spacing={2}>
          <HStack spacing={6}>
            <Box>
              <Text fontSize="xs" color="#8C7C6D">
                Party Size
              </Text>
              <Text fontSize="md" fontWeight="medium" color="#1F1F1F">
                {reservation.party_size} {reservation.party_size === 1 ? 'guest' : 'guests'}
              </Text>
            </Box>
            {reservation.table_number && (
              <Box>
                <Text fontSize="xs" color="#8C7C6D">
                  Table
                </Text>
                <Text fontSize="md" fontWeight="medium" color="#1F1F1F">
                  #{reservation.table_number}
                </Text>
              </Box>
            )}
          </HStack>

          {reservation.notes && (
            <Box>
              <Text fontSize="xs" color="#8C7C6D" mb={1}>
                Notes
              </Text>
              <Text fontSize="sm" color="#5A5A5A">
                {reservation.notes}
              </Text>
            </Box>
          )}
        </VStack>

        {!isPast && reservation.status === 'confirmed' && (
          <HStack mt={4} spacing={2}>
            <Button
              size="sm"
              variant="outline"
              borderColor="#A59480"
              color="#A59480"
              _hover={{ bg: '#A59480', color: 'white' }}
              flex={1}
              onClick={() => handleEditClick(reservation)}
            >
              Edit
            </Button>
            <Button
              size="sm"
              variant="outline"
              borderColor="#F44336"
              color="#F44336"
              _hover={{ bg: '#F44336', color: 'white' }}
              flex={1}
              onClick={() => handleCancelClick(reservation)}
            >
              Cancel
            </Button>
          </HStack>
        )}
      </CardBody>
    </Card>
  );

  return (
    <Box minH="100vh" bg="#ECEDE8" pb="80px">
      {/* Header - Hidden on mobile */}
      <Box
        bg="white"
        borderBottom="1px solid"
        borderColor="#ECEAE5"
        position="sticky"
        top={0}
        zIndex={10}
        display={{ base: 'none', md: 'block' }}
      >
        <Container maxW="container.xl">
          <HStack justify="space-between" py={4}>
            <Box
              as="img"
              src="/images/noir-wedding-day.png"
              alt="Noir"
              h="32px"
              cursor="pointer"
              onClick={() => router.push('/member/dashboard')}
            />
            <Button
              size="sm"
              bg="#A59480"
              color="white"
              _hover={{ bg: '#8C7C6D' }}
              onClick={() => router.push('/member/book')}
            >
              Book Table
            </Button>
          </HStack>
        </Container>
      </Box>

      {/* Main Content */}
      <Container maxW="container.xl" py={{ base: 4, md: 6, lg: 8 }}>
        <VStack spacing={6} align="stretch">
          {/* Page Title */}
          <Box>
            <Heading size="xl" color="#1F1F1F" mb={2} fontFamily="CONEBARS">
              Welcome back, {member.first_name}
            </Heading>
          </Box>

          {/* Tabs */}
          <Tabs colorScheme="orange">
            <TabList>
              <Tab
                _selected={{ color: '#A59480', borderBottomColor: '#A59480' }}
                fontWeight="medium"
              >
                Upcoming ({upcomingReservations.length})
              </Tab>
              <Tab
                _selected={{ color: '#A59480', borderBottomColor: '#A59480' }}
                fontWeight="medium"
              >
                Past ({pastReservations.length})
              </Tab>
            </TabList>

            <TabPanels>
              <TabPanel px={0}>
                <VStack spacing={4} align="stretch" mt={4}>
                  {upcomingReservations.length > 0 ? (
                    upcomingReservations.map((reservation) => (
                      <ReservationCard
                        key={reservation.id}
                        reservation={reservation}
                        isPast={false}
                      />
                    ))
                  ) : (
                    <Card
                      bg="white"
                      borderRadius="16px"
                      border="1px solid"
                      borderColor="#ECEAE5"
                    >
                      <CardBody>
                        <Center py={8}>
                          <VStack spacing={4}>
                            <Icon as={CalendarIcon} boxSize={12} color="#DAD7D0" />
                            <Text color="#5A5A5A" textAlign="center">
                              No upcoming reservations
                            </Text>
                            <Button
                              bg="#A59480"
                              color="white"
                              _hover={{ bg: '#8C7C6D' }}
                              onClick={() => router.push('/member/book')}
                            >
                              Book a Table
                            </Button>
                          </VStack>
                        </Center>
                      </CardBody>
                    </Card>
                  )}
                </VStack>
              </TabPanel>

              <TabPanel px={0}>
                <VStack spacing={4} align="stretch" mt={4}>
                  {pastReservations.length > 0 ? (
                    pastReservations.map((reservation) => (
                      <ReservationCard
                        key={reservation.id}
                        reservation={reservation}
                        isPast={true}
                      />
                    ))
                  ) : (
                    <Card
                      bg="white"
                      borderRadius="16px"
                      border="1px solid"
                      borderColor="#ECEAE5"
                    >
                      <CardBody>
                        <Center py={8}>
                          <VStack spacing={4}>
                            <Icon as={CalendarIcon} boxSize={12} color="#DAD7D0" />
                            <Text color="#5A5A5A" textAlign="center">
                              No past reservations
                            </Text>
                          </VStack>
                        </Center>
                      </CardBody>
                    </Card>
                  )}
                </VStack>
              </TabPanel>
            </TabPanels>
          </Tabs>
        </VStack>
      </Container>

      {/* Bottom Navigation */}
      <MemberNav />

      {/* Edit Reservation Modal */}
      <Modal isOpen={isEditOpen} onClose={onEditClose} size="md" isCentered>
        <ModalOverlay bg="blackAlpha.700" />
        <ModalContent bg="white" borderRadius="16px" mx={4}>
          <ModalHeader color="#1F1F1F" borderBottom="1px solid" borderColor="#ECEAE5">
            Edit Reservation
          </ModalHeader>
          <ModalCloseButton color="#5A5A5A" />
          <ModalBody p={6}>
            {selectedReservation && (
              <VStack spacing={4} align="stretch">
                <Text fontSize="sm" color="#8C7C6D">
                  {new Date(selectedReservation.start_time).toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })} at {new Date(selectedReservation.start_time).toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true,
                  })}
                </Text>

                <FormControl>
                  <FormLabel color="#1F1F1F" fontSize="sm">Party Size</FormLabel>
                  <Input
                    type="number"
                    min={1}
                    value={editFormData.party_size}
                    onChange={(e) => setEditFormData({ ...editFormData, party_size: parseInt(e.target.value) })}
                    borderColor="#DAD7D0"
                    _focus={{ borderColor: '#A59480', boxShadow: '0 0 0 1px #A59480' }}
                  />
                </FormControl>

                <FormControl>
                  <FormLabel color="#1F1F1F" fontSize="sm">Special Requests / Notes</FormLabel>
                  <Textarea
                    value={editFormData.notes}
                    onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                    placeholder="Allergies, seating preferences, etc."
                    borderColor="#DAD7D0"
                    _focus={{ borderColor: '#A59480', boxShadow: '0 0 0 1px #A59480' }}
                    rows={3}
                  />
                </FormControl>
              </VStack>
            )}
          </ModalBody>
          <ModalFooter borderTop="1px solid" borderColor="#ECEAE5">
            <HStack spacing={3} width="full">
              <Button
                variant="outline"
                borderColor="#DAD7D0"
                color="#5A5A5A"
                _hover={{ borderColor: '#A59480', color: '#A59480' }}
                onClick={onEditClose}
                flex={1}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                bg="#A59480"
                color="white"
                _hover={{ bg: '#8C7C6D' }}
                onClick={handleEditSubmit}
                flex={1}
                isLoading={submitting}
                loadingText="Saving..."
              >
                Save Changes
              </Button>
            </HStack>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Cancel Reservation Alert */}
      <AlertDialog
        isOpen={isCancelOpen}
        leastDestructiveRef={cancelRef}
        onClose={onCancelClose}
        isCentered
      >
        <AlertDialogOverlay bg="blackAlpha.700">
          <AlertDialogContent bg="white" borderRadius="16px" mx={4}>
            <AlertDialogHeader fontSize="lg" fontWeight="bold" color="#1F1F1F">
              Cancel Reservation
            </AlertDialogHeader>

            <AlertDialogBody color="#5A5A5A">
              {reservationToCancel && (
                <>
                  Are you sure you want to cancel your reservation for{' '}
                  <strong>
                    {new Date(reservationToCancel.start_time).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })} at {new Date(reservationToCancel.start_time).toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                      hour12: true,
                    })}
                  </strong>? This action cannot be undone.
                </>
              )}
            </AlertDialogBody>

            <AlertDialogFooter>
              <Button
                ref={cancelRef}
                onClick={onCancelClose}
                variant="outline"
                borderColor="#DAD7D0"
                color="#5A5A5A"
                _hover={{ borderColor: '#A59480', color: '#A59480' }}
                disabled={cancelling}
              >
                Keep Reservation
              </Button>
              <Button
                bg="#F44336"
                color="white"
                _hover={{ bg: '#D32F2F' }}
                onClick={handleCancelConfirm}
                ml={3}
                isLoading={cancelling}
                loadingText="Cancelling..."
              >
                Cancel Reservation
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </Box>
  );
}
