'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  VStack,
  HStack,
  Heading,
  Text,
  Button,
  Container,
  FormControl,
  FormLabel,
  Input,
  Checkbox,
  Card,
  CardBody,
  useToast,
  Icon,
  Divider,
  Badge
} from '@chakra-ui/react';
import { useRouter, useParams } from 'next/navigation';
import { Check, FileText } from 'lucide-react';
import SignatureCanvas from '@/components/SignatureCanvas';

interface Agreement {
  id: string;
  title: string;
  content: string;
}

interface WaitlistData {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  selected_membership?: string;
}

export default function AgreementPage() {
  const [agreement, setAgreement] = useState<Agreement | null>(null);
  const [waitlistData, setWaitlistData] = useState<WaitlistData | null>(null);
  const [signerName, setSignerName] = useState('');
  const [signerEmail, setSignerEmail] = useState('');
  const [signatureData, setSignatureData] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const router = useRouter();
  const params = useParams();
  const toast = useToast();
  const token = params?.token as string;

  useEffect(() => {
    loadAgreement();
  }, [token]);

  const loadAgreement = async () => {
    try {
      // Validate token and get waitlist data
      const response = await fetch(`/api/agreement/validate?token=${token}`);
      if (!response.ok) {
        throw new Error('Invalid or expired token');
      }

      const data = await response.json();
      setWaitlistData(data.waitlist);
      setAgreement(data.agreement);

      // Pre-fill signer info
      setSignerName(`${data.waitlist.first_name} ${data.waitlist.last_name}`);
      setSignerEmail(data.waitlist.email);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Invalid or expired agreement link',
        status: 'error',
        duration: 5000,
      });
      router.push('/');
    } finally {
      setLoading(false);
    }
  };

  const handleSignatureComplete = (dataUrl: string) => {
    setSignatureData(dataUrl);
  };

  const handleSubmit = async () => {
    // Validation
    if (!signerName || !signerEmail) {
      toast({
        title: 'Required Fields',
        description: 'Please provide your name and email',
        status: 'warning',
        duration: 3000,
      });
      return;
    }

    if (!signatureData) {
      toast({
        title: 'Signature Required',
        description: 'Please sign the agreement',
        status: 'warning',
        duration: 3000,
      });
      return;
    }

    if (!agreed) {
      toast({
        title: 'Agreement Required',
        description: 'Please agree to the terms',
        status: 'warning',
        duration: 3000,
      });
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch('/api/agreement/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          signer_name: signerName,
          signer_email: signerEmail,
          signature_data: signatureData,
          agreement_id: agreement?.id
        })
      });

      if (!response.ok) {
        throw new Error('Failed to submit signature');
      }

      const result = await response.json();

      toast({
        title: 'Agreement Signed! ✅',
        description: 'Your signature has been recorded',
        status: 'success',
        duration: 5000,
      });

      // Redirect to payment page
      router.push(`/payment/${token}`);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to submit signature. Please try again.',
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
        <Text color="white">Loading agreement...</Text>
      </Box>
    );
  }

  if (!agreement || !waitlistData) {
    return null;
  }

  // Replace placeholders in agreement content
  const today = new Date().toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });

  const agreementContent = agreement.content
    .replace(/{{name}}/g, signerName)
    .replace(/MEMBER_NAME/g, signerName)
    .replace(/{{email}}/g, signerEmail)
    .replace(/{{membership}}/g, waitlistData.selected_membership || 'Standard')
    .replace(/{{date}}/g, today);

  return (
    <Box minH="100vh" bg="#1F1F1F" py={8}>
      <Container maxW="container.md">
        {/* Header */}
        <VStack spacing={6} mb={8}>
          <Box
            bg="#A59480"
            borderRadius="full"
            p={4}
            boxShadow="0 4px 8px rgba(0,0,0,0.2), 0 8px 16px rgba(0,0,0,0.2)"
          >
            <Icon as={FileText} w={8} h={8} color="white" />
          </Box>
          <VStack spacing={2} textAlign="center">
            <Heading fontSize={{ base: '2xl', md: '4xl' }} color="white">
              {agreement.title}
            </Heading>
            <Text color="#ECEDE8">
              Please review and sign the membership agreement
            </Text>
          </VStack>
        </VStack>

        {/* Agreement Card */}
        <Card
          bg="#ECEDE8"
          boxShadow="0 2px 4px rgba(0,0,0,0.1), 0 4px 8px rgba(0,0,0,0.1), 0 8px 16px rgba(0,0,0,0.1)"
          mb={6}
        >
          <CardBody p={{ base: 6, md: 8 }}>
            <VStack spacing={6} align="stretch">
              {/* Member Info Badge */}
              <HStack justify="space-between" flexWrap="wrap" gap={2}>
                <Badge colorScheme="purple" fontSize="sm" px={3} py={1}>
                  Member: {waitlistData.first_name} {waitlistData.last_name}
                </Badge>
                {waitlistData.selected_membership && (
                  <Badge colorScheme="orange" fontSize="sm" px={3} py={1}>
                    {waitlistData.selected_membership} Membership
                  </Badge>
                )}
              </HStack>

              <Divider />

              {/* Scrollable Agreement Content */}
              <Box
                maxH="400px"
                overflowY="auto"
                p={4}
                bg="white"
                borderRadius="md"
                borderWidth="2px"
                borderColor="gray.300"
                sx={{
                  '&::-webkit-scrollbar': {
                    width: '8px',
                  },
                  '&::-webkit-scrollbar-track': {
                    background: '#f1f1f1',
                    borderRadius: '4px',
                  },
                  '&::-webkit-scrollbar-thumb': {
                    background: '#A59480',
                    borderRadius: '4px',
                  },
                }}
              >
                <Text whiteSpace="pre-wrap" fontSize="sm" lineHeight="tall" color="#353535">
                  {agreementContent}
                </Text>
              </Box>

              <Divider />

              {/* Signer Information */}
              <VStack spacing={4} align="stretch">
                <Heading size="sm" color="#353535">
                  Your Information
                </Heading>

                <FormControl isRequired>
                  <FormLabel>Full Name</FormLabel>
                  <Input
                    value={signerName}
                    onChange={(e) => setSignerName(e.target.value)}
                    placeholder="Enter your full name"
                    size="lg"
                    bg="white"
                    borderWidth="2px"
                    _focus={{ borderColor: '#A59480' }}
                  />
                </FormControl>

                <FormControl isRequired>
                  <FormLabel>Email Address</FormLabel>
                  <Input
                    type="email"
                    value={signerEmail}
                    onChange={(e) => setSignerEmail(e.target.value)}
                    placeholder="your@email.com"
                    size="lg"
                    bg="white"
                    borderWidth="2px"
                    _focus={{ borderColor: '#A59480' }}
                  />
                </FormControl>
              </VStack>

              <Divider />

              {/* Legal Notice */}
              <Box
                p={4}
                bg="#A5948010"
                borderRadius="md"
                borderLeftWidth="4px"
                borderLeftColor="#A59480"
              >
                <Text fontSize="sm" color="#353535" fontWeight="medium">
                  ⚖️ By signing, you agree that this electronic signature has the same legal effect as a handwritten signature
                </Text>
              </Box>

              {/* Signature Canvas */}
              <VStack spacing={3} align="stretch">
                <Heading size="sm" color="#353535">
                  Your Signature
                </Heading>
                <Text fontSize="sm" color="gray.600" mb={2}>
                  Desktop: Click to start, move to draw, click to finish
                  <br />
                  Mobile: Hold and drag to sign
                </Text>
                <SignatureCanvas
                  onSignatureComplete={handleSignatureComplete}
                  disabled={submitting}
                />
              </VStack>

              <Divider />

              {/* Agreement Checkbox */}
              <Checkbox
                isChecked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                colorScheme="orange"
                size="lg"
              >
                <Text fontSize="md" fontWeight="medium" color="#353535">
                  I have read, understood, and agree to the terms of this agreement
                </Text>
              </Checkbox>

              {/* Submit Button */}
              <Button
                size="lg"
                bg="#A59480"
                color="white"
                _hover={{ bg: '#8F7F6B' }}
                onClick={handleSubmit}
                isLoading={submitting}
                isDisabled={!signerName || !signerEmail || !signatureData || !agreed}
                leftIcon={<Icon as={Check} />}
                boxShadow="0 2px 4px rgba(0,0,0,0.1), 0 4px 8px rgba(0,0,0,0.1), 0 8px 16px rgba(0,0,0,0.1)"
                minH="56px"
              >
                Sign Agreement & Continue
              </Button>

              {/* Footer Info */}
              <Text fontSize="xs" color="gray.500" textAlign="center" pt={2}>
                Your IP address and timestamp will be recorded for legal compliance
              </Text>
            </VStack>
          </CardBody>
        </Card>
      </Container>
    </Box>
  );
}
