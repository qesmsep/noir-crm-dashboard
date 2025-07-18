import { Box, useColorModeValue, HStack, Button, IconButton, Text, useDisclosure } from "@chakra-ui/react";
import React, { useState, useEffect } from "react";
import FullCalendarTimeline from "../../components/FullCalendarTimeline";
import ReservationEditDrawer from "../../components/ReservationEditDrawer";
import AdminLayout from '../../components/layouts/AdminLayout';
import { ChevronLeftIcon, ChevronRightIcon, ViewIcon, CalendarIcon, RepeatIcon, ExternalLinkIcon } from '@chakra-ui/icons';
import { useSettings } from '../../context/SettingsContext';
import { fromUTC, isSameDay } from '../../utils/dateUtils';

type ViewType = 'day' | 'week' | 'month' | 'all';

export default function Calendar() {
  const [reloadKey, setReloadKey] = useState(0);
  const [currentView, setCurrentView] = useState<ViewType>('day');
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [bookingStartDate, setBookingStartDate] = useState<Date>(new Date());
  const [bookingEndDate, setBookingEndDate] = useState<Date>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 60);
    return d;
  });
  
  // Drawer state at page level
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedReservationId, setSelectedReservationId] = useState<string | null>(null);

  const handleReservationClick = (reservationId: string) => {
    setSelectedReservationId(reservationId);
    setIsDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
    setSelectedReservationId(null);
  };

  const handleReservationUpdated = () => {
    console.log('handleReservationUpdated called, incrementing reloadKey');
    setReloadKey(prev => prev + 1);
  };

  const toggleFullScreen = () => {
    setIsFullScreen(!isFullScreen);
  };

  const handleViewChange = (view: ViewType) => {
    setCurrentView(view);
  };

  const handleDateChange = (date: Date) => {
    setCurrentDate(date);
    // Switch to day view when a date is clicked from week or month view
    if (currentView !== 'day') {
      setCurrentView('day');
    }
  };

  const renderView = () => {
    switch (currentView) {
      case 'day':
        return (
          <FullCalendarTimeline
            reloadKey={reloadKey}
            bookingStartDate={bookingStartDate}
            bookingEndDate={bookingEndDate}
            viewOnly={false}
            onReservationClick={handleReservationClick}
            currentDate={currentDate}
            onDateChange={handleDateChange}
          />
        );
      case 'week':
        return (
          <Box p={8} textAlign="center">
            <Text fontSize="2xl" fontWeight="bold" color="#353535" mb={4}>
              Week View
            </Text>
            <Text fontSize="lg" color="#666">
              Coming Soon! We're working on an improved week view experience.
            </Text>
          </Box>
        );
      case 'month':
        return <MonthView currentDate={currentDate} onDateChange={handleDateChange} onReservationClick={handleReservationClick} />;
      case 'all':
        return <AllReservationsView onReservationClick={handleReservationClick} />;
      default:
        return null;
    }
  };

  const getViewTitle = () => {
    switch (currentView) {
      case 'day':
        return '';
      case 'week':
        const weekStart = new Date(currentDate);
        weekStart.setDate(currentDate.getDate() - currentDate.getDay());
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        return `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
      case 'month':
        return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      case 'all':
        return 'All Reservations';
      default:
        return '';
    }
  };

  const navigateDate = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    switch (currentView) {
      case 'week':
        newDate.setDate(currentDate.getDate() + (direction === 'next' ? 7 : -7));
        break;
      case 'month':
        newDate.setMonth(currentDate.getMonth() + (direction === 'next' ? 1 : -1));
        break;
      default:
        return; // Don't navigate for day view
    }
    setCurrentDate(newDate);
  };

  return (
    <AdminLayout isFullScreen={isFullScreen}>
      {/* Drawer rendered at page level */}
      <ReservationEditDrawer
        isOpen={isDrawerOpen}
        onClose={handleCloseDrawer}
        reservationId={selectedReservationId}
        onReservationUpdated={handleReservationUpdated}
      />
      
      {/* Mobile-optimized container that fills the screen */}
      <Box 
        p={0}
        zIndex={100}
        h={{ base: "100vh", md: isFullScreen ? "100vh" : "auto" }}
        w="100%"
        position={{ base: "fixed", md: isFullScreen ? "fixed" : "relative" }}
        top={{ base: "60px", md: isFullScreen ? 0 : "auto" }}
        left={{ base: 0, md: isFullScreen ? 0 : "auto" }}
        right={{ base: 0, md: isFullScreen ? 0 : "auto" }}
        bottom={{ base: 0, md: isFullScreen ? 0 : "auto" }}
        overflow={{ base: "hidden", md: isFullScreen ? "hidden" : "visible" }}
        
        paddingLeft={10}
        bg={useColorModeValue('white', '#cac2b9')}
      >
        {/* Navigation Header */}
        <Box 
          bg={useColorModeValue('white', '#353535')}
          borderBottom="0px solid"
          borderColor={useColorModeValue('gray.200', '#a59480')}
          p={{ base: 2, md: 4 }}
          paddingLeft={10}
          
          position="sticky"
          top={0}
          zIndex={10}
        >
          <HStack justify="space-between" align="center">
            {/* Left side - Navigation buttons */}
            <HStack spacing={{ base: 1, md: 2 }}>
              {currentView !== 'day' && (
                <>
                  <IconButton
                    aria-label="Previous"
                    icon={<ChevronLeftIcon />}
                    size={{ base: "sm", md: "md" }}
                    variant="ghost"
                    onClick={() => navigateDate('prev')}
                    color={useColorModeValue('gray.600', '#ECEDE8')}
                    _hover={{ bg: useColorModeValue('gray.100', '#a59480') }}
                  />
                  
                  <Text 
                    fontSize={{ base: "sm", md: "lg" }}
                    fontWeight="semibold"
                    color={useColorModeValue('gray.800', '#ECEDE8')}
                    minW={{ base: "120px", md: "200px" }}
                    textAlign="center"
                    padding={10}
                  >
                    {getViewTitle()}
                  </Text>
                  
                  <IconButton
                    aria-label="Next"
                    icon={<ChevronRightIcon />}
                    size={{ base: "sm", md: "md" }}
                    variant="ghost"
                    onClick={() => navigateDate('next')}
                    color={useColorModeValue('gray.600', '#ECEDE8')}
                    _hover={{ bg: useColorModeValue('gray.100', '#a59480') }}
                  />
                </>
              )}
              {currentView === 'day' && (
                <Text 
                  fontSize={{ base: "sm", md: "lg" }}
                  fontWeight="semibold"
                  color={useColorModeValue('gray.800', '#ECEDE8')}
                  minW={{ base: "120px", md: "200px" }}
                  textAlign="center"
                  
                >
                  {getViewTitle()}
                </Text>
              )}
            </HStack>

            {/* Center - View navigation */}
            <HStack spacing={{ base: 1, md: 2 }}>
              <Button
                size={{ base: "sm", md: "md" }}
                variant={currentView === 'day' ? 'solid' : 'ghost'}
                onClick={() => handleViewChange('day')}
                leftIcon={<CalendarIcon />}
                colorScheme="gray"
                bg={currentView === 'day' ? '#a59480' : 'transparent'}
                color={currentView === 'day' ? 'white' : useColorModeValue('gray.600', '#ECEDE8')}
                _hover={{ bg: currentView === 'day' ? '#a59480' : useColorModeValue('gray.100', '#a59480') }}
              >
                Day
              </Button>

              <Button
                size={{ base: "sm", md: "md" }}
                variant={currentView === 'month' ? 'solid' : 'ghost'}
                onClick={() => handleViewChange('month')}
                leftIcon={<ViewIcon />}
                colorScheme="gray"
                bg={currentView === 'month' ? '#a59480' : 'transparent'}
                color={currentView === 'month' ? 'white' : useColorModeValue('gray.600', '#ECEDE8')}
                _hover={{ bg: currentView === 'month' ? '#a59480' : useColorModeValue('gray.100', '#a59480') }}
              >
                Month
              </Button>
              <Button
                size={{ base: "sm", md: "md" }}
                variant={currentView === 'all' ? 'solid' : 'ghost'}
                onClick={() => handleViewChange('all')}
                colorScheme="gray"
                bg={currentView === 'all' ? '#a59480' : 'transparent'}
                color={currentView === 'all' ? 'white' : useColorModeValue('gray.600', '#ECEDE8')}
                _hover={{ bg: currentView === 'all' ? '#a59480' : useColorModeValue('gray.100', '#a59480') }}
              >
                📋 All
              </Button>
            </HStack>

            {/* Right side - Full screen toggle */}
            <IconButton
              aria-label={isFullScreen ? "Exit full screen" : "Enter full screen"}
              icon={<ExternalLinkIcon />}
              size={{ base: "sm", md: "md" }}
              variant="ghost"
              marginRight={20}
              onClick={toggleFullScreen}
              color={useColorModeValue('gray.600', '#ECEDE8')}
              _hover={{ bg: useColorModeValue('gray.100', '#a59480') }}
            />
          </HStack>
        </Box>

        {/* Calendar Content */}
        <Box 
          borderRadius={0}
          boxShadow="none"
          p={0}
          margin={0}
          border="none"
          className="calendar-container"
          h={{ base: "100%", md: isFullScreen ? "100%" : "auto" }}
          w="100%"
          overflow={{ base: "hidden", md: isFullScreen ? "hidden" : "visible" }}
        >
          {renderView()}
        </Box>
      </Box>
    </AdminLayout>
  );
}

// Week View Component
function WeekView({ currentDate, onDateChange, onReservationClick }: {
  currentDate: Date;
  onDateChange: (date: Date) => void;
  onReservationClick: (reservationId: string) => void;
}) {
  const { settings } = useSettings();
  const [weekData, setWeekData] = useState<Array<{
    date: Date;
    reservations: any[];
    totalGuests: number;
    opacity: number;
  }>>([]);
  const [privateEvents, setPrivateEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWeekData();
  }, [currentDate]);

  const fetchWeekData = async () => {
    setLoading(true);
    try {
      const weekStart = new Date(currentDate);
      weekStart.setDate(currentDate.getDate() - currentDate.getDay());
      weekStart.setHours(0, 0, 0, 0);
      
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);

      const [reservationsResponse, privateEventsResponse] = await Promise.all([
        fetch(`/api/reservations?startDate=${weekStart.toISOString()}&endDate=${weekEnd.toISOString()}`),
        fetch(`/api/private-events?startDate=${weekStart.toISOString()}&endDate=${weekEnd.toISOString()}`)
      ]);
      
      const reservationsData = await reservationsResponse.json();
      const privateEventsData = await privateEventsResponse.json();
      
      setPrivateEvents(privateEventsData.data || []);
      
             // Group reservations by day
       const groupedData: Array<{
         date: Date;
         reservations: any[];
         totalGuests: number;
         opacity: number;
       }> = [];
       for (let i = 0; i < 7; i++) {
         const dayDate = new Date(weekStart);
         dayDate.setDate(weekStart.getDate() + i);
         const dayReservations = reservationsData.data?.filter((r: any) => {
           const resDate = fromUTC(r.start_time, settings.timezone);
           return isSameDay(resDate, dayDate, settings.timezone);
         }) || [];
         
         const totalGuests = dayReservations.reduce((sum: number, r: any) => sum + (r.party_size || 0), 0);
         const opacity = Math.min(totalGuests / 10, 1); // 10% per 10 guests, max 100%
         
         groupedData.push({
           date: dayDate,
           reservations: dayReservations,
           totalGuests,
           opacity: Math.max(0.1, opacity)
         });
       }
      
      setWeekData(groupedData);
    } catch (error) {
      console.error('Error fetching week data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDayClick = (date: Date) => {
    onDateChange(date);
  };

  if (loading) {
    return <Box p={4} textAlign="center">Loading week data...</Box>;
  }

  return (
    <Box p={4}>
      {/* Date row */}
      <Box display="grid" gridTemplateColumns="80px repeat(7, 1fr)" gap={2} mb={2}>
        <Box></Box> {/* Empty cell for time column */}
        {weekData.map((day, index) => (
          <Box
            key={index}
            textAlign="center"
            p={2}
          >
            <Text fontSize="sm" fontWeight="bold" color="#353535">
              {day.date.toLocaleDateString('en-US', { weekday: 'short' })}
            </Text>
            <Text fontSize="xs" color="#353535">
              {day.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </Text>
          </Box>
        ))}
      </Box>
      
      {/* Time-based heatmap */}
      <Box display="grid" gridTemplateColumns="80px repeat(7, 1fr)" gap={2} h="calc(100vh - 280px)">
        {/* Generate hours from 12 PM to 2 AM */}
        {Array.from({ length: 15 }, (_, hourIndex) => {
          const hour = hourIndex === 0 ? 12 : hourIndex <= 12 ? hourIndex : hourIndex - 12;
          const timeLabel = hourIndex === 0 ? '12 PM' : hourIndex <= 12 ? `${hour} PM` : `${hour} AM`;
          
          return (
            <React.Fragment key={hour}>
              {/* Time label */}
              <Box
                display="flex"
                alignItems="center"
                justifyContent="center"
                p={2}
                borderRight="1px solid"
                borderColor="#a59480"
              >
                <Text fontSize="xs" color="#353535" fontWeight="bold">
                  {timeLabel}
                </Text>
              </Box>
              
              {/* Heatmap cells for each day */}
              {weekData.map((day, dayIndex) => {
                const hourReservations = day.reservations.filter((r: any) => {
                  const resDate = fromUTC(r.start_time, settings.timezone);
                  const reservationHour = resDate.hour;
                  // Handle 12 PM to 2 AM range
                  if (hourIndex === 0) return reservationHour === 12; // 12 PM
                  if (hourIndex <= 12) return reservationHour === hourIndex; // 1 PM to 12 AM
                  return reservationHour === hourIndex - 12; // 1 AM to 2 AM
                });
                
                // Check for private events at this time
                const privateEventAtTime = privateEvents.find((pe: any) => {
                  const eventStart = fromUTC(pe.start_time, settings.timezone);
                  const eventEnd = fromUTC(pe.end_time, settings.timezone);
                  const currentHour = hourIndex === 0 ? 12 : hourIndex <= 12 ? hourIndex : hourIndex - 12;
                  
                  return isSameDay(eventStart, day.date, settings.timezone) &&
                         eventStart.hour <= currentHour && eventEnd.hour >= currentHour;
                });
                
                const totalGuests = hourReservations.reduce((sum: number, r: any) => sum + (r.party_size || 0), 0);
                const maxGuests = Math.max(...weekData.map(d => d.totalGuests), 1);
                const opacity = totalGuests / maxGuests;
                
                // Use private event color if there's a private event at this time
                const bgColor = privateEventAtTime ? '#e74c3c' : '#a59480';
                const displayGuests = privateEventAtTime ? (privateEventAtTime.total_attendees_maximum || totalGuests) : totalGuests;
                
                return (
                  <Box
                    key={dayIndex}
                    border="1px solid"
                    borderColor={bgColor}
                    cursor="pointer"
                    onClick={() => handleDayClick(day.date)}
                    bg={`rgba(${bgColor === '#e74c3c' ? '231, 76, 60' : '165, 148, 128'}, ${Math.max(opacity, 0.05)})`}
                    _hover={{ bg: `rgba(${bgColor === '#e74c3c' ? '231, 76, 60' : '165, 148, 128'}, ${Math.min(opacity + 0.1, 1)})` }}
                    transition="all 0.2s"
                    display="flex"
                    flexDirection="column"
                    justifyContent="center"
                    alignItems="center"
                    position="relative"
                  >
                    {displayGuests > 0 && (
                      <Text fontSize="xs" color="white" fontWeight="bold">
                        {displayGuests}
                      </Text>
                    )}
                  </Box>
                );
              })}
            </React.Fragment>
          );
        })}
      </Box>
    </Box>
  );
}

// Month View Component
function MonthView({ currentDate, onDateChange, onReservationClick }: {
  currentDate: Date;
  onDateChange: (date: Date) => void;
  onReservationClick: (reservationId: string) => void;
}) {
  const { settings } = useSettings();
  const [monthData, setMonthData] = useState<Array<{
    date: Date;
    reservations: any[];
    privateEvents: any[];
    regularReservations: any[];
    totalReservations: number;
    isCurrentMonth: boolean;
  }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMonthData();
  }, [currentDate]);

  const fetchMonthData = async () => {
    setLoading(true);
    try {
      const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      
      // Get start of week for month start
      const calendarStart = new Date(monthStart);
      calendarStart.setDate(monthStart.getDate() - monthStart.getDay());
      
      // Get end of week for month end
      const calendarEnd = new Date(monthEnd);
      calendarEnd.setDate(monthEnd.getDate() + (6 - monthEnd.getDay()));

      const [reservationsResponse, privateEventsResponse] = await Promise.all([
        fetch(`/api/reservations?startDate=${calendarStart.toISOString()}&endDate=${calendarEnd.toISOString()}`),
        fetch(`/api/private-events?startDate=${calendarStart.toISOString()}&endDate=${calendarEnd.toISOString()}`)
      ]);
      
      const reservationsData = await reservationsResponse.json();
      const privateEventsData = await privateEventsResponse.json();
      
             // Create calendar grid
       const calendarData: Array<{
         date: Date;
         reservations: any[];
         privateEvents: any[];
         regularReservations: any[];
         totalReservations: number;
         isCurrentMonth: boolean;
       }> = [];
       const current = new Date(calendarStart);
       
       while (current <= calendarEnd) {
         const dayReservations = reservationsData.data?.filter((r: any) => {
           const resDate = fromUTC(r.start_time, settings.timezone);
           return isSameDay(resDate, current, settings.timezone);
         }) || [];
         
         const dayPrivateEvents = privateEventsData.data?.filter((pe: any) => {
           const eventDate = fromUTC(pe.start_time, settings.timezone);
           return isSameDay(eventDate, current, settings.timezone);
         }) || [];
         
         const privateEvents = dayReservations.filter((r: any) => r.private_event_id);
         const regularReservations = dayReservations.filter((r: any) => !r.private_event_id);
         
         calendarData.push({
           date: new Date(current),
           reservations: dayReservations,
           privateEvents: dayPrivateEvents,
           regularReservations,
           totalReservations: dayReservations.length + dayPrivateEvents.length,
           isCurrentMonth: current.getMonth() === currentDate.getMonth()
         });
         
         current.setDate(current.getDate() + 1);
       }
      
      setMonthData(calendarData);
    } catch (error) {
      console.error('Error fetching month data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDayClick = (date: Date) => {
    onDateChange(date);
  };

  if (loading) {
    return <Box p={4} textAlign="center">Loading month data...</Box>;
  }

  return (
    <Box p={4}>
      {/* Day headers */}
      <Box display="grid" gridTemplateColumns="repeat(7, 1fr)" gap={1} mb={2}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <Box key={day} textAlign="center" p={2}>
            <Text fontSize="sm" fontWeight="bold" color="#353535">
              {day}
            </Text>
          </Box>
        ))}
      </Box>
      
      {/* Calendar grid */}
      <Box display="grid" marginRight="10px" gridTemplateColumns="repeat(7, 1fr)" gap={1}>
        {monthData.map((day, index) => (
          <Box
            key={index}
            border="1px solid"
            borderColor="#a59480"
            borderRadius="md"
            marginTop="0px"
            p={20}
            cursor="pointer"
            onClick={() => handleDayClick(day.date)}
            bg={day.isCurrentMonth ? 'white' : '#f5f5f5'}
            minH="80px"
            position="relative"
            _hover={{ bg: day.isCurrentMonth ? '#f0f0f0' : '#e8e8e8' }}
            transition="all 0.2s"
          >
            {/* Date number */}
            <Text 
              fontSize="sm" 
              fontWeight="bold" 
              color={day.isCurrentMonth ? '#353535' : '#999'}
              position="absolute"
              top="0px"
              left="4px"
            >
              {day.date.getDate()}
            </Text>
            
            {/* Reservation count */}
            {day.totalReservations > 0 && (
              <Box 
                position="absolute"
                top="50%"
                left="50%"
                transform="translate(-50%, -50%)"
                textAlign="center"
                zIndex={2}
              >
                <Text fontSize="24px" fontWeight="bold" color="#353535" backgroundColor="#CAC2b9"  borderRadius="10px" padding="5px">
                  {day.totalReservations}
                </Text>
                <Text fontSize="xs" color="#666">
                  {day.privateEvents.length > 0 && (
                    <span style={{ color: '#e74c3c' }}>🔒</span>
                  )}
                  
                </Text>
              </Box>
            )}
          </Box>
        ))}
      </Box>
    </Box>
  );
}

// All Reservations View Component
function AllReservationsView({ onReservationClick }: {
  onReservationClick: (reservationId: string) => void;
}) {
  const [reservations, setReservations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAllReservations();
  }, []);

  const fetchAllReservations = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/reservations');
      const data = await response.json();
      setReservations(data.data || []);
    } catch (error) {
      console.error('Error fetching reservations:', error);
    } finally {
      setLoading(false);
    }
  };

  const getEventTypeIcon = (eventType: string) => {
    const icons: Record<string, string> = {
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
    return icons[eventType] || '📅';
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (loading) {
    return <Box p={4} textAlign="center">Loading reservations...</Box>;
  }

  return (
    <Box p={4} overflowX="auto">
      <Box 
        as="table" 
        w="100%" 
        fontSize="sm"
        sx={{ borderCollapse: 'collapse' }}
      >
        <Box as="thead">
          <Box as="tr" borderBottom="2px solid #a59480">
            <Box as="th" p={2} textAlign="left" color="#353535" fontWeight="bold">Name</Box>
            <Box as="th" p={2} textAlign="left" color="#353535" fontWeight="bold">Date</Box>
            <Box as="th" p={2} textAlign="left" color="#353535" fontWeight="bold">Time</Box>
            <Box as="th" p={2} textAlign="left" color="#353535" fontWeight="bold">Table</Box>
            <Box as="th" p={2} textAlign="left" color="#353535" fontWeight="bold">Party</Box>
            <Box as="th" p={2} textAlign="left" color="#353535" fontWeight="bold">Type</Box>
            <Box as="th" p={2} textAlign="left" color="#353535" fontWeight="bold">Source</Box>
          </Box>
        </Box>
        <Box as="tbody">
          {reservations.map((reservation) => (
            <Box 
              as="tr" 
              key={reservation.id}
              borderBottom="1px solid #e0e0e0"
              cursor="pointer"
              _hover={{ bg: '#f5f5f5' }}
              onClick={() => onReservationClick(reservation.id)}
            >
              <Box as="td" p={2} color="#353535">
                {reservation.first_name} {reservation.last_name}
              </Box>
              <Box as="td" p={2} color="#353535">
                {formatDate(reservation.start_time)}
              </Box>
              <Box as="td" p={2} color="#353535">
                {formatTime(reservation.start_time)}
              </Box>
              <Box as="td" p={2} color="#353535">
                {reservation.tables?.table_number || '-'}
              </Box>
              <Box as="td" p={2} color="#353535">
                {reservation.party_size}
              </Box>
              <Box as="td" p={2} color="#353535">
                <Text fontSize="lg">
                  {getEventTypeIcon(reservation.event_type || 'default')}
                </Text>
              </Box>
              <Box as="td" p={2} color="#353535">
                {(reservation.source && reservation.source !== '') ? reservation.source : 'unknown'}
              </Box>
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
} 