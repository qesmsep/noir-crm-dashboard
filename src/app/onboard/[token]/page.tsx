'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  VStack,
  Container,
  useToast,
  Text
} from '@chakra-ui/react';
import { useRouter, useParams } from 'next/navigation';
import OnboardingWizard from '@/components/OnboardingWizard';

export default function OnboardPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const router = useRouter();
  const params = useParams();
  const toast = useToast();
  const token = params?.token as string;

  useEffect(() => {
    loadOnboardingData();
  }, [token]);

  const loadOnboardingData = async () => {
    try {
      // Validate token and get all necessary data
      const response = await fetch(`/api/onboard/validate?token=${token}`);
      if (!response.ok) {
        throw new Error('Invalid or expired token');
      }

      const result = await response.json();
      setData(result);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Invalid or expired onboarding link',
        status: 'error',
        duration: 5000,
      });
      router.push('/');
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = () => {
    toast({
      title: 'Welcome to Noir! 🎉',
      description: 'Check your phone for login instructions',
      status: 'success',
      duration: 5000,
    });
    router.push('/member/login');
  };

  if (loading) {
    return (
      <Box minH="100vh" bg="#1F1F1F" display="flex" alignItems="center" justifyContent="center">
        <Text color="white" fontSize="lg">Loading your onboarding...</Text>
      </Box>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <Box minH="100vh" bg="#1F1F1F" py={12}>
      <Container maxW="container.lg">
        {/* Header */}
        <VStack spacing={4} mb={12} textAlign="center">
          <Box mb={4}>
            <img
              src="/images/noir-wedding-day.png"
              alt="Noir"
              style={{
                height: '120px',
                width: 'auto',
                margin: '0 auto'
              }}
            />
          </Box>
          <Text fontSize="2xl" fontWeight="bold" color="#ECEDE8">
            Complete Your Onboarding
          </Text>
          <Text fontSize="md" color="gray.400" maxW="500px">
            Just a few steps to activate your Noir membership
          </Text>
        </VStack>

        {/* Wizard */}
        <OnboardingWizard
          token={token}
          waitlistData={data.waitlist}
          agreement={data.agreement}
          membershipPlans={data.membership_plans}
          onComplete={handleComplete}
        />
      </Container>
    </Box>
  );
}
