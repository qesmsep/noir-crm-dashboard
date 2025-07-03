import React, { useState, useEffect } from 'react';
import {
  Box,
  VStack,
  HStack,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Text,
  Button,
  Badge,
  Select,
  Input,
  InputGroup,
  InputLeftElement,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
  useToast,
  Textarea,
  FormControl,
  FormLabel,
  Alert,
  AlertIcon,
  Spinner,
  Icon,
  Tooltip
} from '@chakra-ui/react';
import { FiSearch, FiSend, FiExternalLink, FiClock, FiCheck, FiX } from 'react-icons/fi';

interface WaitlistEntry {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  company?: string;
  occupation?: string;
  industry?: string;
  referral?: string;
  how_did_you_hear?: string;
  why_noir?: string;
  status: 'review' | 'approved' | 'denied' | 'waitlisted' | 'link_sent';
  submitted_at: string;
  reviewed_at?: string;
  review_notes?: string;
  application_token?: string;
  application_link_sent_at?: string;
  application_expires_at?: string;
  application_link_opened_at?: string;
}

export default function WaitlistManager() {
  const [waitlistEntries, setWaitlistEntries] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEntry, setSelectedEntry] = useState<WaitlistEntry | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [sendingSMS, setSendingSMS] = useState(false);
  
  const { isOpen: isReviewOpen, onOpen: onReviewOpen, onClose: onReviewClose } = useDisclosure();
  const { isOpen: isLinkOpen, onOpen: onLinkOpen, onClose: onLinkClose } = useDisclosure();
  const toast = useToast();

  useEffect(() => {
    loadWaitlistEntries();
  }, [statusFilter]);

  const loadWaitlistEntries = async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }

      const response = await fetch(`/api/waitlist/manage?${params}`);
      if (response.ok) {
        const data = await response.json();
        setWaitlistEntries(data.data);
      } else {
        toast({
          title: 'Error',
          description: 'Failed to load waitlist entries',
          status: 'error',
          duration: 3000,
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load waitlist entries',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReview = (entry: WaitlistEntry) => {
    setSelectedEntry(entry);
    setReviewNotes(entry.review_notes || '');
    onReviewOpen();
  };

  const handleGenerateLink = (entry: WaitlistEntry) => {
    setSelectedEntry(entry);
    onLinkOpen();
  };

  const submitReview = async (status: 'approved' | 'denied' | 'waitlisted') => {
    if (!selectedEntry) return;

    try {
      const response = await fetch('/api/waitlist/manage', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedEntry.id,
          status,
          review_notes: reviewNotes
        })
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: `Entry ${status} successfully`,
          status: 'success',
          duration: 3000,
        });
        onReviewClose();
        loadWaitlistEntries();
      } else {
        throw new Error('Failed to update entry');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update entry',
        status: 'error',
        duration: 3000,
      });
    }
  };

  const generateAndSendLink = async () => {
    if (!selectedEntry) return;

    setSendingSMS(true);
    try {
      const response = await fetch('/api/waitlist/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          waitlist_id: selectedEntry.id,
          send_sms: true,
          expires_in_hours: 168 // 7 days
        })
      });

      if (response.ok) {
        const data = await response.json();
        toast({
          title: 'Success',
          description: `Application link sent to ${selectedEntry.first_name}!`,
          status: 'success',
          duration: 5000,
        });
        onLinkClose();
        loadWaitlistEntries();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send application link');
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to send application link',
        status: 'error',
        duration: 5000,
      });
    } finally {
      setSendingSMS(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'review': return 'yellow';
      case 'approved': return 'green';
      case 'denied': return 'red';
      case 'waitlisted': return 'blue';
      case 'link_sent': return 'purple';
      default: return 'gray';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const filteredEntries = waitlistEntries.filter(entry => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      entry.first_name.toLowerCase().includes(searchLower) ||
      entry.last_name.toLowerCase().includes(searchLower) ||
      entry.email.toLowerCase().includes(searchLower) ||
      entry.phone.includes(searchTerm)
    );
  });

  if (loading) {
    return (
      <VStack spacing={4} py={8}>
        <Spinner size="lg" />
        <Text>Loading waitlist entries...</Text>
      </VStack>
    );
  }

  return (
    <VStack spacing={6} align="stretch">
      {/* Header and Filters */}
      <HStack justify="space-between" wrap="wrap">
        <VStack align="start" spacing={1}>
          <Text fontSize="lg" fontWeight="bold">
            Waitlist Management
          </Text>
          <Text fontSize="sm" color="gray.600">
            Review and approve waitlist entries to send application links
          </Text>
        </VStack>

        <HStack spacing={4}>
          <InputGroup maxW="300px">
            <InputLeftElement>
              <Icon as={FiSearch} color="gray.400" />
            </InputLeftElement>
            <Input
              placeholder="Search entries..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </InputGroup>

          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            maxW="200px"
          >
            <option value="all">All Statuses</option>
            <option value="review">Pending Review</option>
            <option value="approved">Approved</option>
            <option value="link_sent">Link Sent</option>
            <option value="waitlisted">Waitlisted</option>
            <option value="denied">Denied</option>
          </Select>
        </HStack>
      </HStack>

      {/* Waitlist Table */}
      <Box overflowX="auto">
        <Table variant="simple">
          <Thead>
            <Tr>
              <Th>Name</Th>
              <Th>Contact</Th>
              <Th>Details</Th>
              <Th>Status</Th>
              <Th>Submitted</Th>
              <Th>Link Status</Th>
              <Th>Actions</Th>
            </Tr>
          </Thead>
          <Tbody>
            {filteredEntries.map((entry) => (
              <Tr key={entry.id}>
                <Td>
                  <VStack align="start" spacing={1}>
                    <Text fontWeight="bold">
                      {entry.first_name} {entry.last_name}
                    </Text>
                    {entry.company && (
                      <Text fontSize="xs" color="gray.500">{entry.company}</Text>
                    )}
                  </VStack>
                </Td>
                
                <Td>
                  <VStack align="start" spacing={1}>
                    <Text fontSize="sm">{entry.email}</Text>
                    <Text fontSize="sm" color="gray.500">{entry.phone}</Text>
                  </VStack>
                </Td>
                
                <Td>
                  <VStack align="start" spacing={1}>
                    {entry.occupation && (
                      <Text fontSize="xs">{entry.occupation}</Text>
                    )}
                    {entry.referral && (
                      <Text fontSize="xs" color="blue.500">Ref: {entry.referral}</Text>
                    )}
                  </VStack>
                </Td>
                
                <Td>
                  <Badge colorScheme={getStatusColor(entry.status)} variant="subtle">
                    {entry.status.replace('_', ' ')}
                  </Badge>
                </Td>
                
                <Td>
                  <Text fontSize="sm">{formatDate(entry.submitted_at)}</Text>
                </Td>
                
                <Td>
                  <VStack align="start" spacing={1}>
                    {entry.application_link_sent_at && (
                      <HStack spacing={1}>
                        <Icon as={FiSend} size="xs" color="green.500" />
                        <Text fontSize="xs" color="green.600">
                          Sent {formatDate(entry.application_link_sent_at)}
                        </Text>
                      </HStack>
                    )}
                    {entry.application_link_opened_at && (
                      <HStack spacing={1}>
                        <Icon as={FiExternalLink} size="xs" color="blue.500" />
                        <Text fontSize="xs" color="blue.600">
                          Opened {formatDate(entry.application_link_opened_at)}
                        </Text>
                      </HStack>
                    )}
                    {entry.application_expires_at && (
                      <HStack spacing={1}>
                        <Icon as={FiClock} size="xs" color="orange.500" />
                        <Text fontSize="xs" color="orange.600">
                          Expires {formatDate(entry.application_expires_at)}
                        </Text>
                      </HStack>
                    )}
                  </VStack>
                </Td>
                
                <Td>
                  <HStack spacing={2}>
                    {entry.status === 'review' && (
                      <Button
                        size="xs"
                        colorScheme="blue"
                        onClick={() => handleReview(entry)}
                      >
                        Review
                      </Button>
                    )}
                    
                    {(entry.status === 'approved' || entry.status === 'link_sent') && (
                      <Tooltip label="Generate and send application link">
                        <Button
                          size="xs"
                          colorScheme="green"
                          variant={entry.status === 'link_sent' ? 'outline' : 'solid'}
                          onClick={() => handleGenerateLink(entry)}
                          leftIcon={<Icon as={FiSend} />}
                        >
                          {entry.status === 'link_sent' ? 'Resend' : 'Send Link'}
                        </Button>
                      </Tooltip>
                    )}
                  </HStack>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
        
        {filteredEntries.length === 0 && (
          <Box py={8} textAlign="center">
            <Text color="gray.500">No waitlist entries found</Text>
          </Box>
        )}
      </Box>

      {/* Review Modal */}
      <Modal isOpen={isReviewOpen} onClose={onReviewClose} size="md">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            Review Waitlist Entry: {selectedEntry?.first_name} {selectedEntry?.last_name}
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4} align="stretch">
              {selectedEntry && (
                <Box bg="gray.50" p={4} borderRadius="md">
                  <VStack align="start" spacing={2}>
                    <Text><strong>Email:</strong> {selectedEntry.email}</Text>
                    <Text><strong>Phone:</strong> {selectedEntry.phone}</Text>
                    {selectedEntry.company && (
                      <Text><strong>Company:</strong> {selectedEntry.company}</Text>
                    )}
                    {selectedEntry.occupation && (
                      <Text><strong>Occupation:</strong> {selectedEntry.occupation}</Text>
                    )}
                    {selectedEntry.why_noir && (
                      <Text><strong>Why Noir:</strong> {selectedEntry.why_noir}</Text>
                    )}
                  </VStack>
                </Box>
              )}

              <FormControl>
                <FormLabel>Review Notes</FormLabel>
                <Textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Add notes about this review..."
                  rows={3}
                />
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <HStack spacing={3}>
              <Button
                colorScheme="red"
                onClick={() => submitReview('denied')}
                leftIcon={<Icon as={FiX} />}
              >
                Deny
              </Button>
              <Button
                colorScheme="blue"
                onClick={() => submitReview('waitlisted')}
              >
                Waitlist
              </Button>
              <Button
                colorScheme="green"
                onClick={() => submitReview('approved')}
                leftIcon={<Icon as={FiCheck} />}
              >
                Approve
              </Button>
            </HStack>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Application Link Modal */}
      <Modal isOpen={isLinkOpen} onClose={onLinkClose} size="md">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            Send Application Link: {selectedEntry?.first_name} {selectedEntry?.last_name}
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4} align="stretch">
              <Alert status="info">
                <AlertIcon />
                <VStack align="start" spacing={1}>
                  <Text fontWeight="bold">
                    Generate and send application link via SMS
                  </Text>
                  <Text fontSize="sm">
                    This will create a unique application link that expires in 7 days and send it to {selectedEntry?.phone}
                  </Text>
                </VStack>
              </Alert>

              {selectedEntry?.application_link_sent_at && (
                <Alert status="warning">
                  <AlertIcon />
                  <Text fontSize="sm">
                    A link was previously sent on {formatDate(selectedEntry.application_link_sent_at)}. 
                    Sending a new link will invalidate the previous one.
                  </Text>
                </Alert>
              )}
            </VStack>
          </ModalBody>
          <ModalFooter>
            <HStack spacing={3}>
              <Button onClick={onLinkClose}>Cancel</Button>
              <Button
                colorScheme="green"
                onClick={generateAndSendLink}
                isLoading={sendingSMS}
                loadingText="Sending..."
                leftIcon={<Icon as={FiSend} />}
              >
                Generate & Send Link
              </Button>
            </HStack>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </VStack>
  );
}