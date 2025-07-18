import React, { useState } from 'react';
import {
  Drawer,
  DrawerBody,
  DrawerFooter,
  DrawerHeader,
  DrawerOverlay,
  DrawerContent,
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
  Flex,
  IconButton,
  Alert,
  AlertIcon,
} from '@chakra-ui/react';
import { CheckIcon, CloseIcon, EmailIcon, PhoneIcon, CalendarIcon, DeleteIcon } from '@chakra-ui/icons';

interface WaitlistEntry {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  company?: string;
  city_state?: string;
  referral?: string;
  visit_frequency?: string;
  go_to_drink?: string;
  status: 'review' | 'approved' | 'denied' | 'waitlisted';
  submitted_at: string;
  reviewed_at?: string;
  review_notes?: string;
  typeform_response_id?: string;
}

interface WaitlistReviewDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  entry: WaitlistEntry | null;
  onStatusUpdate: () => void;
}

const WaitlistReviewDrawer: React.FC<WaitlistReviewDrawerProps> = ({
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

  const handleStatusUpdate = async (status: 'approved' | 'waitlisted') => {
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
          description: `Application ${status === 'waitlisted' ? 'denied and waitlisted' : status} successfully`,
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
    <Drawer 
      isOpen={isOpen} 
      placement="right" 
      onClose={onClose} 
      size="sm"
    >
      <Box zIndex="2000" position="relative">
        <DrawerOverlay bg="blackAlpha.600" />
        <DrawerContent 
          border="2px solid #353535" 
          borderRadius="10px"  
          fontFamily="Montserrat, sans-serif" 
          maxW="400px" 
          w="50vw" 
          boxShadow="xl" 
          mt="80px" 
          mb="25px" 
          paddingRight="40px" 
          paddingLeft="40px" 
          backgroundColor="#ecede8"
          position="fixed"
          top="0"
          right="0"
          style={{
            transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
            transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
          }}
        >
          <DrawerHeader borderBottomWidth="1px" margin="0" fontWeight="bold" paddingTop="20px" fontSize="24px" fontFamily="IvyJournal, sans-serif" color="#353535">
            <Flex align="center" justify="space-between">
              <Text>Review Application</Text>
              <Badge 
                colorScheme={entry.status === 'review' ? 'yellow' : entry.status === 'approved' ? 'green' : entry.status === 'denied' ? 'red' : 'purple'}
                variant="subtle"
                size="sm"
              >
                {entry.status.toUpperCase()}
              </Badge>
            </Flex>
          </DrawerHeader>

          <DrawerBody p={4} overflowY="auto" className="drawer-body-content">
            <VStack spacing={4} align="stretch">
              {/* Applicant Information */}
              <Box>
                <Text mb="0px" fontSize="20px" fontWeight="bold" fontFamily="IvyJournal, sans-serif" color="#353535">
                  {entry.first_name} {entry.last_name}
                </Text>
                <HStack>
                  <Text margin="0px" fontSize="sm" color="gray.600">
                    Submitted {formatDate(entry.submitted_at)}
                  </Text>
                </HStack>
              </Box>

              <VStack spacing={3} as="section" align="stretch">
                <Grid templateColumns="repeat(2, 1fr)" gap={3}>
                  <GridItem>
                    <Text fontSize="sm" fontWeight="bold" color="#353535" mb={1}>Email</Text>
                    <HStack>
                      <Icon as={EmailIcon} color="#a59480" boxSize="14px" />
                      <Text fontSize="sm" color="#353535">{entry.email}</Text>
                    </HStack>
                  </GridItem>
                  <GridItem>
                    <Text fontSize="sm" fontWeight="bold" color="#353535" mb={1}>Phone</Text>
                    <HStack>
                      <Icon as={PhoneIcon} color="#a59480" boxSize="14px" />
                      <Text fontSize="sm" color="#353535">{formatPhone(entry.phone)}</Text>
                    </HStack>
                  </GridItem>
                </Grid>
              </VStack>

              {/* Professional Information */}
              {(entry.company || entry.city_state || entry.referral) && (
                <>
                  <Divider borderColor="#a59480" />
                  <Box>
                    <Text fontSize="md" fontWeight="bold" color="#353535" mb={3}>Additional Information</Text>
                    <VStack spacing={2} align="stretch">
                      {entry.company && (
                        <Box>
                          <Text fontSize="sm" fontWeight="bold" color="#a59480">Company</Text>
                          <Text fontSize="sm" color="#353535">{entry.company}</Text>
                        </Box>
                      )}
                      {entry.city_state && (
                        <Box>
                          <Text fontSize="sm" fontWeight="bold" color="#a59480">Location</Text>
                          <Text fontSize="sm" color="#353535">{entry.city_state}</Text>
                        </Box>
                      )}
                      {entry.referral && (
                        <Box>
                          <Text fontSize="sm" fontWeight="bold" color="#a59480">Referral</Text>
                          <Text fontSize="sm" color="#353535">{entry.referral}</Text>
                        </Box>
                      )}
                      {entry.visit_frequency && (
                        <Box>
                          <Text fontSize="sm" fontWeight="bold" color="#a59480">Visit Frequency</Text>
                          <Text fontSize="sm" color="#353535">{entry.visit_frequency}</Text>
                        </Box>
                      )}
                      {entry.go_to_drink && (
                        <Box>
                          <Text fontSize="sm" fontWeight="bold" color="#a59480">Go-to Drink</Text>
                          <Text fontSize="sm" color="#353535">{entry.go_to_drink}</Text>
                        </Box>
                      )}
                    </VStack>
                  </Box>
                </>
              )}

              <Divider borderColor="#a59480" />

              {/* Review Notes */}
              <Box>
                <Text fontSize="sm" fontWeight="bold" color="#353535" mb={2}>
                  Review Notes (Optional)
                </Text>
                <Textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Add any notes about this application..."
                  size="sm"
                  rows={3}
                  width="90%"
                  fontFamily="Montserrat, sans-serif"
                  resize="vertical"
                  bg="white"
                  borderRadius="8px"
                  border="1px solid"
                  borderColor="gray.300"
                  _focus={{ borderColor: '#A59480', boxShadow: '0 0 0 1px #A59480' }}
                />
              </Box>

              {/* Application Details */}
              <Box bg="gray.50" p={3} borderRadius="md" borderWidth="1px" borderColor="gray.200">
                <VStack spacing={1} fontSize="xs">
                  <HStack justify="space-between">
                    <Text fontSize="12px" color="gray.600" fontWeight="medium">Submitted:</Text>
                    <Text fontSize="12px">{formatDate(entry.submitted_at)}</Text>
                  </HStack>
                  {entry.typeform_response_id && (
                    <HStack justify="space-between">
                      <Text fontSize="12px" color="gray.600" fontWeight="medium">Response ID:</Text>
                      <Text fontSize="12px" fontFamily="monospace">{entry.typeform_response_id.slice(0, 8)}...</Text>
                    </HStack>
                  )}
                </VStack>
              </Box>
            </VStack>
          </DrawerBody>

          <DrawerFooter borderTopWidth="1px" justifyContent="space-between" className="drawer-footer-content">
            <HStack spacing={3} mb="10px">
              <Button 
                variant="outline" 
                onClick={onClose}
                borderColor="#a59480"
                color="#a59480"
                _hover={{ bg: "#a59480", color: "#353535" }}
                fontFamily="Montserrat, sans-serif"
                size="sm"
              >
                Cancel
              </Button>
              <Button
                onClick={() => handleStatusUpdate('waitlisted')}
                leftIcon={<CloseIcon />}
                colorScheme="red"
                variant="outline"
                isLoading={isLoading}
                fontFamily="Montserrat, sans-serif"
                size="sm"
              >
                Deny & Waitlist
              </Button>
              <Button
                onClick={() => handleStatusUpdate('approved')}
                leftIcon={<CheckIcon />}
                colorScheme="green"
                variant="outline"
                isLoading={isLoading}
                fontFamily="Montserrat, sans-serif"
                size="sm"
              >
                Approve
              </Button>
            </HStack>
          </DrawerFooter>
        </DrawerContent>
      </Box>
    </Drawer>
  );
};

export default WaitlistReviewDrawer; 