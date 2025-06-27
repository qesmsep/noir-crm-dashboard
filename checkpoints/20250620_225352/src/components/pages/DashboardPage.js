import React from 'react';
import {
  Box,
  Grid,
  GridItem,
  Heading,
  Text,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  StatArrow,
  SimpleGrid,
  VStack,
  HStack,
  Icon,
  useColorModeValue,
} from '@chakra-ui/react';
import { FiUsers, FiCalendar, FiDollarSign, FiTrendingUp } from 'react-icons/fi';

const DashboardPage = ({ stats }) => {
  const cardBg = 'nightSky';
  const cardBorder = 'daybreak';
  const cardShadow = 'lg';
  const cardRadius = 'md';
  const headingColor = 'weddingDay';
  const textColor = 'weddingDay';
  const fontFamily = 'Montserrat, sans-serif';

  return (
    <VStack fontFamily={fontFamily} spacing={6} align="stretch" p={4}>
      <Box>
        <Heading size="lg" mb={6} color={headingColor} fontFamily={fontFamily}>Dashboard</Heading>
        <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={6}>
          <Box
            bg={cardBg}
            p={6}
            borderRadius={cardRadius}
            boxShadow={cardShadow}
            border="1px solid"
            borderColor={cardBorder}
          >
            <HStack spacing={4}>
              <Icon as={FiUsers} boxSize={6} color="brand.500" />
              <Stat>
                <StatLabel color={textColor} fontFamily={fontFamily}>Total Members</StatLabel>
                <StatNumber color={textColor} fontFamily={fontFamily}>{stats.totalMembers}</StatNumber>
                <StatHelpText color={textColor} fontFamily={fontFamily}>
                  <StatArrow type="increase" />
                  {stats.memberGrowth}% this month
                </StatHelpText>
              </Stat>
            </HStack>
          </Box>

          <Box
            bg={cardBg}
            p={6}
            borderRadius={cardRadius}
            boxShadow={cardShadow}
            border="1px solid"
            borderColor={cardBorder}
          >
            <HStack spacing={4}>
              <Icon as={FiCalendar} boxSize={6} color="brand.500" />
              <Stat>
                <StatLabel color={textColor} fontFamily={fontFamily}>Reservations Today</StatLabel>
                <StatNumber color={textColor} fontFamily={fontFamily}>{stats.todayReservations}</StatNumber>
                <StatHelpText color={textColor} fontFamily={fontFamily}>
                  {stats.pendingReservations} pending
                </StatHelpText>
              </Stat>
            </HStack>
          </Box>

          <Box
            bg={cardBg}
            p={6}
            borderRadius={cardRadius}
            boxShadow={cardShadow}
            border="1px solid"
            borderColor={cardBorder}
          >
            <HStack spacing={4}>
              <Icon as={FiDollarSign} boxSize={6} color="brand.500" />
              <Stat>
                <StatLabel color={textColor} fontFamily={fontFamily}>Monthly Revenue</StatLabel>
                <StatNumber color={textColor} fontFamily={fontFamily}>${stats.monthlyRevenue}</StatNumber>
                <StatHelpText color={textColor} fontFamily={fontFamily}>
                  <StatArrow type="increase" />
                  {stats.revenueGrowth}% vs last month
                </StatHelpText>
              </Stat>
            </HStack>
          </Box>

          <Box
            bg={cardBg}
            p={6}
            borderRadius={cardRadius}
            boxShadow={cardShadow}
            border="1px solid"
            borderColor={cardBorder}
          >
            <HStack spacing={4}>
              <Icon as={FiTrendingUp} boxSize={6} color="brand.500" />
              <Stat>
                <StatLabel color={textColor} fontFamily={fontFamily}>Occupancy Rate</StatLabel>
                <StatNumber color={textColor} fontFamily={fontFamily}>{stats.occupancyRate}%</StatNumber>
                <StatHelpText color={textColor} fontFamily={fontFamily}>
                  <StatArrow type="increase" />
                  {stats.occupancyGrowth}% vs last month
                </StatHelpText>
              </Stat>
            </HStack>
          </Box>
        </SimpleGrid>
      </Box>

      <Grid templateColumns={{ base: '1fr', lg: 'repeat(2, 1fr)' }} gap={6}>
        <GridItem>
          <Box
            bg={cardBg}
            p={6}
            borderRadius={cardRadius}
            boxShadow={cardShadow}
            border="1px solid"
            borderColor={cardBorder}
          >
            <Heading size="md" mb={4} color={headingColor} fontFamily={fontFamily}>Recent Activity</Heading>
            {/* Add your activity feed component here */}
          </Box>
        </GridItem>

        <GridItem>
          <Box
            bg={cardBg}
            p={6}
            borderRadius={cardRadius}
            boxShadow={cardShadow}
            border="1px solid"
            borderColor={cardBorder}
          >
            <Heading size="md" mb={4} color={headingColor} fontFamily={fontFamily}>Upcoming Reservations</Heading>
            {/* Add your upcoming reservations component here */}
          </Box>
        </GridItem>
      </Grid>
    </VStack>
  );
};

export default DashboardPage; 