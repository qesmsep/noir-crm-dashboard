import { Box, useColorModeValue } from "@chakra-ui/react";
import { useState } from "react";
import FullCalendarTimeline from "../../components/FullCalendarTimeline";
import AdminLayout from '../../components/layouts/AdminLayout';

export default function Calendar() {
  const [reloadKey, setReloadKey] = useState(0);
  const [bookingStartDate, setBookingStartDate] = useState<Date>(new Date());
  const [bookingEndDate, setBookingEndDate] = useState<Date>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 60);
    return d;
  });

  return (
    <AdminLayout>
      <Box p={{ base: 4, md: 8 }}>
        <Box bg={useColorModeValue('white', 'gray.800')} borderRadius="lg" boxShadow="md" p={6}>
          <FullCalendarTimeline
            reloadKey={reloadKey}
            bookingStartDate={bookingStartDate}
            bookingEndDate={bookingEndDate}
            viewOnly={true}
          />
        </Box>
      </Box>
    </AdminLayout>
  );
} 