'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  VStack,
  Container,
  useToast,
  Text,
  Progress,
  Image
} from '@chakra-ui/react';
import { useRouter, useParams } from 'next/navigation';
import AnimatedQuestionnaire from '@/components/AnimatedQuestionnaire';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    db: { schema: 'public' },
    global: { headers: { 'x-client-info': 'supabase-js-web' } }
  }
);

const INVITATION_QUESTIONNAIRE_ID = '11111111-1111-1111-1111-111111111111';

export default function SignupPage() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [validToken, setValidToken] = useState(false);
  const [waitlistId, setWaitlistId] = useState<string>('');
  const router = useRouter();
  const params = useParams();
  const toast = useToast();
  const token = params?.token as string;

  useEffect(() => {
    validateToken();
  }, [token]);

  const validateToken = async () => {
    try {
      // Validate that token exists in waitlist
      const { data, error } = await supabase
        .from('waitlist')
        .select('id, questionnaire_completed_at')
        .eq('agreement_token', token)
        .maybeSingle();

      if (error || !data) {
        console.error('Validation error:', error);
        throw new Error('Invalid or expired token');
      }

      // Check if already completed
      if (data.questionnaire_completed_at) {
        // Already filled out, redirect to onboard
        router.push(`/onboard/${token}`);
        return;
      }

      setWaitlistId(data.id);
      setValidToken(true);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Invalid or expired signup link',
        status: 'error',
        duration: 5000,
      });
      router.push('/');
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async (responses: Record<string, any>) => {
    setSubmitting(true);

    try {
      // Extract data from responses
      const questionData: Record<string, any> = {};
      let photoUrl = '';

      for (const [questionId, value] of Object.entries(responses)) {
        // Check if it's a file URL
        if (typeof value === 'string' && value.startsWith('http')) {
          photoUrl = value;
          continue;
        }

        // Map question IDs to field names (q1, q2, etc.)
        const questionOrder = parseInt(questionId.replace('q', ''));
        switch (questionOrder) {
          case 1:
            questionData.first_name = value;
            break;
          case 2:
            questionData.last_name = value;
            break;
          case 3:
            questionData.email = value;
            break;
          case 4:
            questionData.phone = value;
            break;
          case 5:
            questionData.company = value;
            break;
          case 6:
            questionData.occupation = value;
            break;
          case 7:
            questionData.city_state = value;
            break;
          case 8:
            questionData.how_did_you_hear = value;
            break;
          case 9:
            questionData.why_noir = value;
            break;
        }
      }

      // Update waitlist with intake data
      const { error: updateError } = await supabase
        .from('waitlist')
        .update({
          ...questionData,
          photo_url: photoUrl || undefined,
          questionnaire_completed_at: new Date().toISOString()
        })
        .eq('id', waitlistId);

      if (updateError) {
        throw updateError;
      }

      toast({
        title: 'Success!',
        description: 'Moving to next step...',
        status: 'success',
        duration: 2000,
      });

      // Redirect to onboarding wizard
      setTimeout(() => {
        router.push(`/onboard/${token}`);
      }, 1000);

    } catch (error: any) {
      console.error('Signup submission error:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to submit. Please try again.',
        status: 'error',
        duration: 5000,
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Box minH="100vh" bg="#1F1F1F" display="flex" alignItems="center" justifyContent="center">
        <Text color="white" fontSize="lg">Validating your invitation...</Text>
      </Box>
    );
  }

  if (!validToken) {
    return null;
  }

  return (
    <Box minH="100vh" bg="#1F1F1F" py={12}>
      <Container maxW="container.md">
        {/* Header */}
        <VStack spacing={4} mb={12} textAlign="center">
          <Box mb={4}>
            <Image
              src="/images/noir-wedding-day.png"
              alt="Noir"
              h="120px"
              w="auto"
              mx="auto"
            />
          </Box>
          <Text fontSize="2xl" fontWeight="bold" color="#ECEDE8">
            Welcome to Noir
          </Text>
          <Text fontSize="md" color="gray.400" maxW="500px">
            Complete your membership application
          </Text>
          <Progress
            value={33}
            size="sm"
            colorScheme="orange"
            bg="#2D2D2D"
            w="full"
            borderRadius="full"
            mt={4}
          />
          <Text fontSize="sm" color="gray.500">
            Step 1 of 3: Application
          </Text>
        </VStack>

        {/* Animated Questionnaire */}
        <AnimatedQuestionnaire
          questionnaireId={INVITATION_QUESTIONNAIRE_ID}
          onComplete={handleComplete}
        />
      </Container>
    </Box>
  );
}
