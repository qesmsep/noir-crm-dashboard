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
} from '@chakra-ui/react';
import { CalendarIcon, TimeIcon } from '@chakra-ui/icons';
import { useRouter } from 'next/navigation';
import { useMemberAuth } from '@/context/MemberAuthContext';
import MemberNav from '@/components/member/MemberNav';

export default function MemberReservationsPage() {
  const router = useRouter();
  const { member, loading } = useMemberAuth();
  const [reservations, setReservations] = useState<any[]>([]);
  const [loadingReservations, setLoadingReservations] = useState(true);

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
          <Button
            size="sm"
            variant="outline"
            borderColor="#A59480"
            color="#A59480"
            _hover={{ bg: '#A59480', color: 'white' }}
            mt={4}
            width="full"
          >
            Modify Reservation
          </Button>
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
    </Box>
  );
}
