'use client';

import React from 'react';
import {
  Box,
  VStack,
  Heading,
  Text,
  Button,
  Container,
  Icon
} from '@chakra-ui/react';
import { useRouter } from 'next/navigation';
import { Check, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

const MotionBox = motion(Box);

export default function OnboardSuccessPage() {
  const router = useRouter();

  return (
    <Box minH="100vh" bg="#1F1F1F" display="flex" alignItems="center" justifyContent="center" py={12}>
      <Container maxW="container.sm">
        <MotionBox
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        >
          <VStack spacing={8} textAlign="center">
            {/* Logo */}
            <Box mb={4}>
              <img
                src="/images/noir-wedding-day.png"
                alt="Noir"
                style={{
                  height: '100px',
                  width: 'auto',
                  margin: '0 auto'
                }}
              />
            </Box>

            {/* Success Icon */}
            <MotionBox
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
            >
              <Box
                bg="#A59480"
                borderRadius="full"
                p={6}
                boxShadow="0 4px 8px rgba(0,0,0,0.2), 0 8px 16px rgba(0,0,0,0.2), 0 12px 24px rgba(0,0,0,0.2)"
              >
                <Icon as={Check} w={16} h={16} color="white" />
              </Box>
            </MotionBox>

            {/* Success Message */}
            <VStack spacing={4}>
              <Heading fontSize={{ base: '3xl', md: '4xl' }} color="white">
                Welcome to Noir! 🎉
              </Heading>
              <Text fontSize="lg" color="#ECEDE8" maxW="450px">
                Your membership is now active. We've sent login instructions to your phone.
              </Text>
            </VStack>

            {/* Features */}
            <VStack
              spacing={3}
              align="stretch"
              bg="#ECEDE8"
              p={6}
              borderRadius="xl"
              boxShadow="0 2px 4px rgba(0,0,0,0.1), 0 4px 8px rgba(0,0,0,0.1)"
              w="full"
            >
              <Text fontSize="md" fontWeight="bold" color="#353535" textAlign="center" mb={2}>
                What's Next?
              </Text>
              <HStack spacing={3}>
                <Icon as={Check} color="#A59480" />
                <Text fontSize="sm" color="#353535">
                  Check your phone for login code
                </Text>
              </HStack>
              <HStack spacing={3}>
                <Icon as={Check} color="#A59480" />
                <Text fontSize="sm" color="#353535">
                  Access your member portal
                </Text>
              </HStack>
              <HStack spacing={3}>
                <Icon as={Check} color="#A59480" />
                <Text fontSize="sm" color="#353535">
                  Book reservations and explore benefits
                </Text>
              </HStack>
            </VStack>

            {/* CTA Button */}
            <Button
              size="lg"
              bg="#A59480"
              color="white"
              _hover={{ bg: '#8F7F6B' }}
              onClick={() => router.push('/member/login')}
              rightIcon={<Icon as={ArrowRight} />}
              boxShadow="0 2px 4px rgba(0,0,0,0.1), 0 4px 8px rgba(0,0,0,0.1), 0 8px 16px rgba(0,0,0,0.1)"
              minH="56px"
              px={8}
            >
              Go to Member Portal
            </Button>

            <Text fontSize="sm" color="gray.500" mt={4}>
              Need help? Contact us at hello@noirsandiego.com
            </Text>
          </VStack>
        </MotionBox>
      </Container>
    </Box>
  );
}

function HStack({ children, spacing }: { children: React.ReactNode; spacing: number }) {
  return (
    <Box display="flex" alignItems="center" gap={spacing}>
      {children}
    </Box>
  );
}
