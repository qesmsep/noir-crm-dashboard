import { Box, Heading, Text } from '@chakra-ui/react';

export default function Home() {
  return (
    <Box p={10}>
      <Heading>Welcome to the Member Portal</Heading>
      <Text mt={4}>
        This is the boilerplate landing page. Authentication and secure routing
        will arrive in Phase 2.
      </Text>
    </Box>
  );
}