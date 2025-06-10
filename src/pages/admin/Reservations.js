import { Box, Heading, Spinner } from "@chakra-ui/react";
import { useState } from "react";
import FullCalendarTimeline from "../../components/FullCalendarTimeline";

export default function Reservations() {
  const [reloadKey, setReloadKey] = useState(0);
  const [bookingStartDate, setBookingStartDate] = useState(new Date());
  const [bookingEndDate, setBookingEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 60);
    return d;
  });

  return (
    <Box p={4}>
      <Heading mb={8}>Reservations Management</Heading>
      <FullCalendarTimeline
        reloadKey={reloadKey}
        bookingStartDate={bookingStartDate}
        bookingEndDate={bookingEndDate}
      />
    </Box>
  );
} 