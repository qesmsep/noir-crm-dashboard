import React, { useState, useEffect } from 'react';
import {
  VStack,
  Text,
  Button,
  Heading,
  Alert,
  AlertIcon,
  Box,
  Checkbox,
  FormControl,
  FormErrorMessage,
  Divider
} from '@chakra-ui/react';

interface Agreement {
  id: string;
  title: string;
  content: string;
  version: number;
}

interface Application {
  id?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
}

interface Props {
  application: Application | null;
  onComplete: (data: any) => void;
  onError: (message: string) => void;
}

export default function AgreementForm({ application, onComplete, onError }: Props) {
  const [agreement, setAgreement] = useState<Agreement | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isAccepted, setIsAccepted] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadAgreement();
  }, []);

  const loadAgreement = async () => {
    try {
      const response = await fetch('/api/membership/agreements?current_only=true');
      if (response.ok) {
        const data = await response.json();
        if (data.length > 0) {
          setAgreement(data[0]);
        } else {
          onError('No active agreement found');
        }
      } else {
        onError('Failed to load agreement');
      }
    } catch (error) {
      onError('Error loading agreement');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!isAccepted) {
      setError('You must accept the agreement to continue');
      return;
    }

    if (!application?.id) {
      onError('Application not found');
      return;
    }

    setSubmitting(true);

    try {
      const signatureData = {
        agreement_accepted: true,
        signed_by: `${application.first_name} ${application.last_name}`,
        signature_method: 'digital_acceptance',
        user_agent: navigator.userAgent,
        timestamp: new Date().toISOString()
      };

      const response = await fetch('/api/membership/apply', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: application.id,
          step: 'agreement',
          agreement_signature: signatureData
        })
      });

      if (response.ok) {
        const data = await response.json();
        onComplete(data);
      } else {
        const errorData = await response.json();
        onError(errorData.error || 'Failed to submit agreement');
      }
    } catch (error) {
      onError('Error submitting agreement');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <Text>Loading agreement...</Text>;
  }

  if (!agreement) {
    return (
      <Alert status="error">
        <AlertIcon />
        No agreement available
      </Alert>
    );
  }

  return (
    <VStack spacing={6} align="stretch">
      <VStack spacing={2} align="start">
        <Heading size="md">{agreement.title}</Heading>
        <Text color="gray.600" fontSize="sm">
          Version {agreement.version} • Please read carefully and accept to continue
        </Text>
      </VStack>

      <Divider />

      {/* Agreement Content */}
      <Box
        maxH="400px"
        overflowY="auto"
        p={4}
        border="1px"
        borderColor="gray.200"
        borderRadius="md"
        bg="gray.50"
      >
        <div
          dangerouslySetInnerHTML={{ __html: agreement.content }}
          style={{
            lineHeight: '1.6',
            fontSize: '14px'
          }}
        />
      </Box>

      <Divider />

      {/* Acceptance */}
      <FormControl isInvalid={!!error && !isAccepted}>
        <Checkbox
          isChecked={isAccepted}
          onChange={(e) => {
            setIsAccepted(e.target.checked);
            if (e.target.checked) setError('');
          }}
          colorScheme="blue"
        >
          <Text fontSize="sm">
            I have read and agree to the terms and conditions outlined in the {agreement.title}.
            By checking this box, I acknowledge that I understand and accept all terms of membership.
          </Text>
        </Checkbox>
        <FormErrorMessage>{error}</FormErrorMessage>
      </FormControl>

      {/* Digital Signature Info */}
      <Box bg="blue.50" p={4} borderRadius="md">
        <Text fontSize="sm" color="blue.800">
          <strong>Digital Signature Notice:</strong> By checking the agreement box and clicking 
          "Accept Agreement" below, you are providing your digital signature and legal consent 
          to be bound by this agreement. This has the same legal effect as a handwritten signature.
        </Text>
      </Box>

      <Button
        colorScheme="blue"
        size="lg"
        onClick={handleSubmit}
        isLoading={submitting}
        loadingText="Processing Agreement..."
        isDisabled={!isAccepted}
      >
        Accept Agreement & Continue
      </Button>
    </VStack>
  );
}