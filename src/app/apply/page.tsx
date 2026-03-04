'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  VStack,
  Heading,
  Text,
  Container,
  useToast
} from '@chakra-ui/react';
import AnimatedQuestionnaire from '@/components/AnimatedQuestionnaire';
import { useRouter } from 'next/navigation';

export default function ApplyPage() {
  const [mounted, setMounted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const toast = useToast();
  const router = useRouter();

  // Invitation Request questionnaire ID (from questionnaire_templates)
  const WAITLIST_QUESTIONNAIRE_ID = 'a201cee3-3e34-459d-83c8-25b073fd26f7';

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleComplete = async (responses: Record<string, any>) => {
    setSubmitting(true);

    try {
      // Submit to waitlist API
      const response = await fetch('/api/waitlist/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionnaire_id: WAITLIST_QUESTIONNAIRE_ID,
          responses
        })
      });

      if (!response.ok) {
        throw new Error('Failed to submit application');
      }

      const data = await response.json();

      toast({
        title: 'Application Submitted! 🎉',
        description: 'Thank you for your interest. We\'ll be in touch soon.',
        status: 'success',
        duration: 5000,
        isClosable: true,
      });

      // Redirect to success page
      router.push('/apply/success');
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to submit application. Please try again.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (!mounted) {
    return null;
  }

  return (
    <Box minH="100vh" bg="#1F1F1F" py={12} suppressHydrationWarning>
      <Container maxW="container.md">
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
          <Text fontSize="xl" color="#ECEDE8" maxW="500px">
            Join the waitlist for exclusive membership
          </Text>
        </VStack>

        {/* Questionnaire */}
        <AnimatedQuestionnaire
          questionnaireId={WAITLIST_QUESTIONNAIRE_ID}
          onComplete={handleComplete}
        />
      </Container>
    </Box>
  );
}
