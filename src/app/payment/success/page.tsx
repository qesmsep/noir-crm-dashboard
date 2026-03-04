'use client';

import React, { useEffect, useState } from 'react';
import {
  Box,
  VStack,
  Heading,
  Text,
  Container,
  Icon,
  Button,
  List,
  ListItem,
  ListIcon
} from '@chakra-ui/react';
import { useSearchParams } from 'next/navigation';
import { Check, ArrowRight, Calendar, CreditCard, MessageCircle } from 'lucide-react';

export default function PaymentSuccessPage() {
  const [loading, setLoading] = useState(true);
  const searchParams = useSearchParams();
  const token = searchParams?.get('token');

  useEffect(() => {
    // Confirm payment status
    if (token) {
      confirmPayment();
    }
  }, [token]);

  const confirmPayment = async () => {
    try {
      await fetch('/api/payment/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });
    } catch (error) {
      console.error('Payment confirmation error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box minH="100vh" bg="#1F1F1F" display="flex" alignItems="center" justifyContent="center">
        <Text color="white">Confirming payment...</Text>
      </Box>
    );
  }

  return (
    <Box minH="100vh" bg="#1F1F1F" display="flex" alignItems="center" justifyContent="center" py={12}>
      <Container maxW="container.sm">
        <VStack spacing={8} textAlign="center">
          {/* Success Icon */}
          <Box
            bg="#A59480"
            borderRadius="full"
            p={8}
            boxShadow="0 4px 8px rgba(0,0,0,0.2), 0 8px 16px rgba(0,0,0,0.2), 0 16px 32px rgba(0,0,0,0.2)"
            animation="pulse 2s ease-in-out infinite"
            sx={{
              '@keyframes pulse': {
                '0%, 100%': { transform: 'scale(1)' },
                '50%': { transform: 'scale(1.05)' }
              }
            }}
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
              Welcome to Noir! 🖤
            </Heading>
            <Text fontSize="lg" color="#ECEDE8" maxW="500px">
              Your payment has been processed successfully. You are now an official Noir member.
            </Text>
          </VStack>

          {/* Next Steps */}
          <Box
            bg="#ECEDE8"
            borderRadius="xl"
            p={8}
            w="100%"
            boxShadow="0 2px 4px rgba(0,0,0,0.1), 0 4px 8px rgba(0,0,0,0.1), 0 8px 16px rgba(0,0,0,0.1)"
          >
            <VStack spacing={6} align="stretch">
              <Heading size="md" color="#353535">
                What's Next?
              </Heading>

              <List spacing={4}>
                <ListItem display="flex" alignItems="start">
                  <ListIcon as={MessageCircle} color="#A59480" mt={1} boxSize={5} />
                  <VStack align="start" spacing={1} flex={1}>
                    <Text fontWeight="bold" color="#353535">Check Your Phone</Text>
                    <Text fontSize="sm" color="gray.600">
                      You'll receive a welcome text with your member portal login
                    </Text>
                  </VStack>
                </ListItem>

                <ListItem display="flex" alignItems="start">
                  <ListIcon as={Calendar} color="#A59480" mt={1} boxSize={5} />
                  <VStack align="start" spacing={1} flex={1}>
                    <Text fontWeight="bold" color="#353535">Make Your First Reservation</Text>
                    <Text fontSize="sm" color="gray.600">
                      Text "RESERVATION" to get started or use your member portal
                    </Text>
                  </VStack>
                </ListItem>

                <ListItem display="flex" alignItems="start">
                  <ListIcon as={CreditCard} color="#A59480" mt={1} boxSize={5} />
                  <VStack align="start" spacing={1} flex={1}>
                    <Text fontWeight="bold" color="#353535">Set Up Payment Methods</Text>
                    <Text fontSize="sm" color="gray.600">
                      Add your payment method in the member portal for seamless transactions
                    </Text>
                  </VStack>
                </ListItem>
              </List>
            </VStack>
          </Box>

          {/* Contact Info */}
          <VStack spacing={2}>
            <Text fontSize="sm" color="#A59480" fontWeight="medium">
              Questions? Text us at (619) 971-3730
            </Text>
            <Text fontSize="xs" color="gray.500">
              We're here to help make your Noir experience exceptional
            </Text>
          </VStack>
        </VStack>
      </Container>
    </Box>
  );
}
