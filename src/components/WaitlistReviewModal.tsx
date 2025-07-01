import React, { useState } from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  VStack,
  HStack,
  Text,
  Badge,
  Box,
  Textarea,
  useToast,
  Spinner,
  Divider,
  Grid,
  GridItem,
  Heading,
  Icon,
  Flex
} from '@chakra-ui/react';
import { CheckIcon, CloseIcon, EmailIcon, PhoneIcon, CalendarIcon } from '@chakra-ui/icons';

interface WaitlistEntry {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  company?: string;
  referral?: string;
  how_did_you_hear?: string;
  why_noir?: string;
  occupation?: string;
  industry?: string;
  status: 'review' | 'approved' | 'denied';
  submitted_at: string;
  reviewed_at?: string;
  review_notes?: string;
  typeform_response_id?: string;
}

interface WaitlistReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  entry: WaitlistEntry | null;
  onStatusUpdate: () => void;
}

const WaitlistReviewModal: React.FC<WaitlistReviewModalProps> = ({
  isOpen,
  onClose,
  entry,
  onStatusUpdate
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [reviewNotes, setReviewNotes] = useState('');
  const toast = useToast();

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatPhone = (phone: string) => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 11 && digits.startsWith('1')) {
      return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    }
    return phone;
  };

  const handleStatusUpdate = async (status: 'approved' | 'denied') => {
    if (!entry) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/waitlist', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: entry.id,
          status,
          review_notes: reviewNotes
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: 'Success',
          description: `Application ${status} successfully`,
          status: 'success',
          duration: 3000,
        });
        onStatusUpdate();
        onClose();
      } else {
        throw new Error(data.error || 'Failed to update status');
      }
    } catch (error) {
      console.error('Error updating waitlist status:', error);
      toast({
        title: 'Error',
        description: 'Failed to update application status',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!entry) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl" scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent bg="#353535" color="#ECEDE8" border="1px solid #a59480">
        <ModalHeader fontFamily="'Montserrat', sans-serif" borderBottom="1px solid #a59480">
          <Flex align="center" justify="space-between">
            <Text>Review Application</Text>
            <Badge 
              colorScheme={entry.status === 'review' ? 'yellow' : entry.status === 'approved' ? 'green' : 'red'}
              variant="subtle"
            >
              {entry.status.toUpperCase()}
            </Badge>
          </Flex>
        </ModalHeader>

        <ModalBody>
          <VStack spacing={6} align="stretch">
            {/* Applicant Information */}
            <Box>
              <Heading size="md" mb={4} fontFamily="'Montserrat', sans-serif" color="#a59480">
                Applicant Information
              </Heading>
              <Grid templateColumns="repeat(2, 1fr)" gap={4}>
                <GridItem>
                  <Text fontWeight="bold" color="#a59480">Name</Text>
                  <Text>{entry.first_name} {entry.last_name}</Text>
                </GridItem>
                <GridItem>
                  <Text fontWeight="bold" color="#a59480">Email</Text>
                  <HStack>
                    <Icon as={EmailIcon} color="#a59480" />
                    <Text>{entry.email}</Text>
                  </HStack>
                </GridItem>
                <GridItem>
                  <Text fontWeight="bold" color="#a59480">Phone</Text>
                  <HStack>
                    <Icon as={PhoneIcon} color="#a59480" />
                    <Text>{formatPhone(entry.phone)}</Text>
                  </HStack>
                </GridItem>
                <GridItem>
                  <Text fontWeight="bold" color="#a59480">Submitted</Text>
                  <HStack>
                    <Icon as={CalendarIcon} color="#a59480" />
                    <Text>{formatDate(entry.submitted_at)}</Text>
                  </HStack>
                </GridItem>
              </Grid>
            </Box>

            <Divider borderColor="#a59480" />

            {/* Professional Information */}
            <Box>
              <Heading size="md" mb={4} fontFamily="'Montserrat', sans-serif" color="#a59480">
                Professional Information
              </Heading>
              <Grid templateColumns="repeat(2, 1fr)" gap={4}>
                {entry.company && (
                  <GridItem>
                    <Text fontWeight="bold" color="#a59480">Company</Text>
                    <Text>{entry.company}</Text>
                  </GridItem>
                )}
                {entry.occupation && (
                  <GridItem>
                    <Text fontWeight="bold" color="#a59480">Occupation</Text>
                    <Text>{entry.occupation}</Text>
                  </GridItem>
                )}
                {entry.industry && (
                  <GridItem>
                    <Text fontWeight="bold" color="#a59480">Industry</Text>
                    <Text>{entry.industry}</Text>
                  </GridItem>
                )}
                {entry.referral && (
                  <GridItem>
                    <Text fontWeight="bold" color="#a59480">Referral</Text>
                    <Text>{entry.referral}</Text>
                  </GridItem>
                )}
              </Grid>
            </Box>

            <Divider borderColor="#a59480" />

            {/* Additional Information */}
            <Box>
              <Heading size="md" mb={4} fontFamily="'Montserrat', sans-serif" color="#a59480">
                Additional Information
              </Heading>
              <VStack spacing={4} align="stretch">
                {entry.how_did_you_hear && (
                  <Box>
                    <Text fontWeight="bold" color="#a59480">How did you hear about Noir?</Text>
                    <Text>{entry.how_did_you_hear}</Text>
                  </Box>
                )}
                {entry.why_noir && (
                  <Box>
                    <Text fontWeight="bold" color="#a59480">Why do you want to join Noir?</Text>
                    <Text>{entry.why_noir}</Text>
                  </Box>
                )}
              </VStack>
            </Box>

            <Divider borderColor="#a59480" />

            {/* Review Notes */}
            <Box>
              <Text fontWeight="bold" color="#a59480" mb={2}>
                Review Notes (Optional)
              </Text>
              <Textarea
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="Add any notes about this application..."
                bg="#2a2a2a"
                borderColor="#a59480"
                _focus={{ borderColor: "#a59480", boxShadow: "0 0 0 1px #a59480" }}
                color="#ECEDE8"
                fontFamily="'Montserrat', sans-serif"
              />
            </Box>
          </VStack>
        </ModalBody>

        <ModalFooter borderTop="1px solid #a59480">
          <HStack spacing={4}>
            <Button
              onClick={onClose}
              variant="outline"
              borderColor="#a59480"
              color="#a59480"
              _hover={{ bg: "#a59480", color: "#353535" }}
              fontFamily="'Montserrat', sans-serif"
            >
              Cancel
            </Button>
            <Button
              onClick={() => handleStatusUpdate('denied')}
              leftIcon={<CloseIcon />}
              colorScheme="red"
              variant="outline"
              isLoading={isLoading}
              fontFamily="'Montserrat', sans-serif"
            >
              Deny
            </Button>
            <Button
              onClick={() => handleStatusUpdate('approved')}
              leftIcon={<CheckIcon />}
              colorScheme="green"
              variant="outline"
              isLoading={isLoading}
              fontFamily="'Montserrat', sans-serif"
            >
              Approve
            </Button>
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default WaitlistReviewModal; 