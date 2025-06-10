import { Box, Heading, Tabs, TabList, TabPanels, Tab, TabPanel, Divider, VStack, SimpleGrid } from "@chakra-ui/react";
import { useState } from "react";
import CalendarAvailabilityControl from "../../components/CalendarAvailabilityControl";

export default function Calendar() {
  const [reloadKey, setReloadKey] = useState(0);
  const [bookingStartDate, setBookingStartDate] = useState(new Date());
  const [bookingEndDate, setBookingEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 60);
    return d;
  });

  return (
    <Box p={4}>
      <Heading mb={8}>Calendar Management</Heading>
      <Tabs variant="enclosed">
        <TabList>
          <Tab>Availability</Tab>
          <Tab>Custom</Tab>
          <Tab>Private Events</Tab>
        </TabList>
        <TabPanels>
          <TabPanel>
            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={8} alignItems="stretch">
              <Box minH="420px" display="flex" flexDirection="column">
                <CalendarAvailabilityControl section="booking_window" />
              </Box>
              <Box minH="420px" display="flex" flexDirection="column">
                <CalendarAvailabilityControl section="base" />
              </Box>
            </SimpleGrid>
          </TabPanel>
          <TabPanel>
            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={8} alignItems="stretch">
              <Box minH="420px" display="flex" flexDirection="column">
                <CalendarAvailabilityControl section="custom_open" />
              </Box>
              <Box minH="420px" display="flex" flexDirection="column">
                <CalendarAvailabilityControl section="custom_closed" />
              </Box>
            </SimpleGrid>
          </TabPanel>
          <TabPanel>
            <VStack align="stretch" spacing={8}>
              <Box>
                <Heading size="md" mb={4}>Private Events Ledger</Heading>
                <CalendarAvailabilityControl section="private_events" />
              </Box>
            </VStack>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Box>
  );
} 