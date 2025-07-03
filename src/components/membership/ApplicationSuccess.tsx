import React from 'react';
import {
  VStack,
  HStack,
  Text,
  Heading,
  Icon,
  Box,
  Button,
  Alert,
  AlertIcon,
  Card,
  CardBody,
  Divider
} from '@chakra-ui/react';
import { FiCheckCircle, FiMail, FiPhone, FiCalendar } from 'react-icons/fi';
import { useRouter } from 'next/router';

interface Application {
  id?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  status?: string;
  payment_completed_at?: string;
  payment_amount?: number;
}

interface Props {
  application: Application | null;
}

export default function ApplicationSuccess({ application }: Props) {
  const router = useRouter();

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount / 100);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <VStack spacing={8} align="stretch">
      {/* Success Header */}
      <VStack spacing={4} textAlign="center">
        <Icon as={FiCheckCircle} boxSize={16} color="green.500" />
        <Heading size="lg" color="green.600">
          Application Submitted Successfully!
        </Heading>
        <Text color="gray.600" fontSize="lg">
          Thank you for your membership application. We have received all your information
          and payment successfully.
        </Text>
      </VStack>

      {/* Application Details */}
      <Card>
        <CardBody>
          <VStack spacing={6} align="stretch">
            <Heading size="md">Application Summary</Heading>
            
            <VStack spacing={4} align="stretch">
              <HStack justify="space-between">
                <Text fontWeight="bold">Application ID:</Text>
                <Text fontFamily="mono" fontSize="sm">{application?.id}</Text>
              </HStack>
              
              <HStack justify="space-between">
                <Text fontWeight="bold">Applicant:</Text>
                <Text>{application?.first_name} {application?.last_name}</Text>
              </HStack>
              
              <HStack justify="space-between">
                <Text fontWeight="bold">Email:</Text>
                <HStack>
                  <Icon as={FiMail} color="gray.500" />
                  <Text>{application?.email}</Text>
                </HStack>
              </HStack>
              
              {application?.phone && (
                <HStack justify="space-between">
                  <Text fontWeight="bold">Phone:</Text>
                  <HStack>
                    <Icon as={FiPhone} color="gray.500" />
                    <Text>{application.phone}</Text>
                  </HStack>
                </HStack>
              )}
              
              {application?.payment_completed_at && (
                <HStack justify="space-between">
                  <Text fontWeight="bold">Payment Date:</Text>
                  <HStack>
                    <Icon as={FiCalendar} color="gray.500" />
                    <Text>{formatDate(application.payment_completed_at)}</Text>
                  </HStack>
                </HStack>
              )}
              
              {application?.payment_amount && (
                <HStack justify="space-between">
                  <Text fontWeight="bold">Amount Paid:</Text>
                  <Text fontWeight="bold" color="green.600">
                    {formatAmount(application.payment_amount)}
                  </Text>
                </HStack>
              )}
            </VStack>
          </VStack>
        </CardBody>
      </Card>

      <Divider />

      {/* Next Steps */}
      <Alert status="info">
        <AlertIcon />
        <VStack align="start" spacing={2}>
          <Text fontWeight="bold">What happens next?</Text>
          <Text fontSize="sm">
            1. Your application will be reviewed by our membership committee
            <br />
            2. We will contact you within 5-7 business days with a decision
            <br />
            3. If approved, you will receive welcome materials and membership details
            <br />
            4. You can check your application status anytime using your email
          </Text>
        </VStack>
      </Alert>

      {/* Action Buttons */}
      <VStack spacing={4}>
        <Button
          colorScheme="blue"
          size="lg"
          onClick={() => router.push('/membership/status?email=' + application?.email)}
        >
          Check Application Status
        </Button>
        
        <Button
          variant="outline"
          onClick={() => router.push('/')}
        >
          Return to Home
        </Button>
      </VStack>

      {/* Contact Information */}
      <Box bg="gray.50" p={6} borderRadius="md" textAlign="center">
        <Text fontSize="sm" color="gray.600">
          Have questions about your application? Contact us at{' '}
          <Text as="span" fontWeight="bold">membership@yourclub.com</Text> or{' '}
          <Text as="span" fontWeight="bold">(555) 123-4567</Text>
        </Text>
      </Box>

      {/* Receipt Notice */}
      <Box bg="blue.50" p={4} borderRadius="md">
        <Text fontSize="sm" color="blue.800">
          <strong>Receipt:</strong> A payment receipt has been sent to your email address.
          Please keep this for your records. Your membership application reference number is{' '}
          <Text as="span" fontFamily="mono" fontWeight="bold">{application?.id}</Text>
        </Text>
      </Box>
    </VStack>
  );
}