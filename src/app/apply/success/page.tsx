'use client';

import React from 'react';
import {
  Box,
  VStack,
  Heading,
  Text,
  Container,
  Icon
} from '@chakra-ui/react';
import { Check } from 'lucide-react';

export default function SuccessPage() {
  return (
    <Box minH="100vh" bg="#1F1F1F" display="flex" alignItems="center" justifyContent="center">
      <Container maxW="container.sm">
        <VStack spacing={8} textAlign="center">
          {/* Success Icon */}
          <Box
            bg="#A59480"
            borderRadius="full"
            p={8}
            boxShadow="0 4px 8px rgba(0,0,0,0.2), 0 8px 16px rgba(0,0,0,0.2), 0 16px 32px rgba(0,0,0,0.2)"
          >
            <Icon as={Check} w={16} h={16} color="white" />
          </Box>

          {/* Success Message */}
          <VStack spacing={4}>
            <Heading
              fontSize={{ base: '3xl', md: '5xl' }}
              fontWeight="bold"
              color="white"
            >
              You're on the list! 🖤
            </Heading>
            <Text fontSize="lg" color="#ECEDE8" maxW="500px">
              Thank you for your interest in joining Noir. We've received your application and will review it shortly.
            </Text>
            <Text fontSize="md" color="#A59480" maxW="500px" pt={4}>
              We typically respond within 24 hours. Keep an eye on your phone for a text from us!
            </Text>
          </VStack>
        </VStack>
      </Container>
    </Box>
  );
}
