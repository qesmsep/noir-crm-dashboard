import React, { useState } from "react";
import { Box, Heading, Text } from "@chakra-ui/react";
import ReservationForm from "../components/ReservationForm";

export default function Reserve() {
  const [bookingStartDate] = useState<Date>(new Date());
  const [bookingEndDate] = useState<Date>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 60);
    return d;
  });

  return (
    <Box p={8} maxW="800px" mx="auto">
      <Heading mb={4}>Reserve a Table</Heading>
      <Text mb={8} fontSize="lg">
        Book your table at Noir. Please fill out the form below to reserve your spot.
      </Text>
      <ReservationForm
        initialStart={undefined}
        initialEnd={undefined}
        onSave={undefined}
        table_id={undefined}
        bookingStartDate={bookingStartDate}
        bookingEndDate={bookingEndDate}
        onDelete={undefined}
        isEdit={false}
      />
    </Box>
  );
} 