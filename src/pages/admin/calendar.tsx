import { Box, useColorModeValue } from "@chakra-ui/react";
import { useState } from "react";
import FullCalendarTimeline from "../../components/FullCalendarTimeline";
import ReservationEditDrawer from "../../components/ReservationEditDrawer";
import AdminLayout from '../../components/layouts/AdminLayout';

export default function Calendar() {
  const [reloadKey, setReloadKey] = useState(0);
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
    setReloadKey(prev => prev + 1);
  };

  return (
    <AdminLayout>
      {/* Drawer rendered at page level */}
      <ReservationEditDrawer
        isOpen={isDrawerOpen}
        onClose={handleCloseDrawer}
        reservationId={selectedReservationId}
        onReservationUpdated={handleReservationUpdated}
      />
      <Box p={{ base: 4, md: 8 }} zIndex={100}>
        <Box 
          bg={useColorModeValue('white', 'gray.800')} 
          borderRadius="24px" 
          boxShadow="0 4px 16px rgba(53,53,53,0.5)" 
          p={8}
          border="3px solid #a59480"
          className="calendar-container"
        >
          <FullCalendarTimeline
            reloadKey={reloadKey}
            bookingStartDate={bookingStartDate}
            bookingEndDate={bookingEndDate}
            viewOnly={true}
            onReservationClick={handleReservationClick}
          />
        </Box>
      </Box>
      
      
      
    </AdminLayout>
  );
} 