import React from 'react';
import {
  Box,
  VStack,
  Heading,
  useColorModeValue,
} from '@chakra-ui/react';
import FullCalendarTimeline from '../FullCalendarTimeline';

const CalendarPage = ({ reloadKey, bookingStartDate, bookingEndDate, eventInfo }) => {
  const cardBg = 'nightSky';
  const cardBorder = 'daybreak';
  const cardShadow = 'lg';
  const cardRadius = 'md';
  const headingColor = 'weddingDay';
  const fontFamily = 'Montserrat, sans-serif';

  const baseDays = [1, 2, 3, 4, 5, 6, 0]; // Example: all days of the week (Sunday-Saturday)
  bookingEndDate.setDate(bookingStartDate.getDate() + 60); // 60 days from now

  return (
    <VStack fontFamily={fontFamily} spacing={6} align="stretch" p={4}>
      <Box
        bg={cardBg}
        p={6}
        borderRadius={cardRadius}
        boxShadow={cardShadow}
        border="1px solid"
        borderColor={cardBorder}
      >
        <Heading size="lg" mb={6} color={headingColor} fontFamily={fontFamily}>Seating Calendar</Heading>
        <FullCalendarTimeline
          reloadKey={reloadKey}
          bookingStartDate={bookingStartDate}
          bookingEndDate={bookingEndDate}
          baseDays={baseDays}
        />
        {eventInfo && (
          <div style={{ marginTop: '1rem' }}>
            <p style={{ color: '#F5F5F5', fontFamily }}>Event/Reservation ID: {eventInfo.id}</p>
          </div>
        )}
      </Box>
    </VStack>
  );
};

export default CalendarPage; 