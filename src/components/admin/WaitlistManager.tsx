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
  Drawer,
  DrawerBody,
  DrawerFooter,
  DrawerHeader,
  DrawerOverlay,
  DrawerContent,
  DrawerCloseButton,
  useDisclosure,
  useToast,
  Textarea,
  FormControl,
  FormLabel,
  Alert,
  AlertIcon,
  Spinner,
  Icon,
  Tooltip,
  IconButton
} from '@chakra-ui/react';
import { FiSearch, FiSend, FiExternalLink, FiClock, FiCheck, FiX, FiEye } from 'react-icons/fi';

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
  const { isOpen: isViewOpen, onOpen: onViewOpen, onClose: onViewClose } = useDisclosure();
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

  const handleViewEntry = (entry: WaitlistEntry) => {
    setSelectedEntry(entry);
    onViewOpen();
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
          id: selectedEntry.id,
          action: 'generate_link'
        })
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Application link generated and sent successfully',
          status: 'success',
          duration: 3000,
        });
        onLinkClose();
        loadWaitlistEntries();
      } else {
        throw new Error('Failed to generate link');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to generate and send link',
        status: 'error',
        duration: 3000,
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
      entry.phone.includes(searchTerm) ||
      (entry.company && entry.company.toLowerCase().includes(searchLower))
    );
  });

  if (loading) {
    return (
      <VStack spacing={4} align="center" py={8}>
        <Spinner size="lg" />
        <Text>Loading waitlist entries...</Text>
      </VStack>
    );
  }

  return (
    <VStack spacing={6} align="stretch">
      {/* Filters */}
      <HStack spacing={2} w="full">
        <InputGroup flex="1">
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
          flex="1"
        >
          <option value="all">All Statuses</option>
          <option value="review">Review</option>
          <option value="approved">Approved</option>
          <option value="denied">Denied</option>
          <option value="waitlisted">Waitlisted</option>
          <option value="link_sent">Link Sent</option>
        </Select>
      </HStack>

      {/* Desktop Table View */}
      <Box overflowX="auto" display={{ base: 'none', md: 'block' }}>
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
                      <Text fontSize="xs" color="green.600">
                        Sent {formatDate(entry.application_link_sent_at)}
                      </Text>
                    )}
                    {entry.application_link_opened_at && (
                      <Text fontSize="xs" color="blue.600">
                        Opened {formatDate(entry.application_link_opened_at)}
                      </Text>
                    )}
                    {entry.application_expires_at && (
                      <Text fontSize="xs" color="orange.600">
                        Expires {formatDate(entry.application_expires_at)}
                      </Text>
                    )}
                  </VStack>
                </Td>

                <Td>
                  <HStack spacing={2}>
                    <IconButton
                      size="sm"
                      minW="44px"
                      minH="44px"
                      icon={<FiEye />}
                      onClick={() => handleViewEntry(entry)}
                      aria-label="View entry details"
                      colorScheme="blue"
                    />

                    {entry.status === 'review' && (
                      <IconButton
                        size="sm"
                        minW="44px"
                        minH="44px"
                        icon={<FiCheck />}
                        onClick={() => handleReview(entry)}
                        aria-label="Review entry"
                        colorScheme="yellow"
                      />
                    )}

                    {(entry.status === 'approved' || entry.status === 'link_sent') && (
                      <Tooltip label="Generate and send application link">
                        <IconButton
                          size="sm"
                          minW="44px"
                          minH="44px"
                          icon={<FiSend />}
                          onClick={() => handleGenerateLink(entry)}
                          aria-label="Generate and send application link"
                          colorScheme="green"
                          variant={entry.status === 'link_sent' ? 'outline' : 'solid'}
                        />
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

      {/* Mobile Card View */}
      <VStack spacing={3} display={{ base: 'flex', md: 'none' }}>
        {filteredEntries.length === 0 ? (
          <Box py={8} textAlign="center" w="full">
            <Text color="gray.500">No waitlist entries found</Text>
          </Box>
        ) : (
          filteredEntries.map((entry) => (
            <Box
              key={entry.id}
              p={4}
              borderRadius="12px"
              border="1px solid"
              borderColor="#ECEAE5"
              bg="white"
              w="full"
              boxShadow="0 2px 8px rgba(165, 148, 128, 0.08)"
            >
              <VStack align="stretch" spacing={3}>
                {/* Name */}
                <Box>
                  <Text fontSize="sm" color="#5A5A5A" mb={1}>Name</Text>
                  <Text fontWeight="600" fontSize="md" color="#1F1F1F">
                    {entry.first_name} {entry.last_name}
                  </Text>
                  {entry.company && (
                    <Text fontSize="xs" color="gray.500">{entry.company}</Text>
                  )}
                </Box>

                {/* Contact */}
                <Box>
                  <Text fontSize="sm" color="#5A5A5A" mb={1}>Contact</Text>
                  <Text fontSize="sm" color="#1F1F1F">{entry.email}</Text>
                  <Text fontSize="sm" color="gray.500">{entry.phone}</Text>
                </Box>

                {/* Details */}
                {(entry.occupation || entry.referral) && (
                  <Box>
                    <Text fontSize="sm" color="#5A5A5A" mb={1}>Details</Text>
                    {entry.occupation && (
                      <Text fontSize="sm" color="#1F1F1F">{entry.occupation}</Text>
                    )}
                    {entry.referral && (
                      <Text fontSize="sm" color="blue.500">Ref: {entry.referral}</Text>
                    )}
                  </Box>
                )}

                {/* Status & Submitted */}
                <HStack justify="space-between" wrap="wrap">
                  <Box>
                    <Text fontSize="sm" color="#5A5A5A" mb={1}>Status</Text>
                    <Badge colorScheme={getStatusColor(entry.status)} variant="subtle">
                      {entry.status.replace('_', ' ')}
                    </Badge>
                  </Box>
                  <Box>
                    <Text fontSize="sm" color="#5A5A5A" mb={1}>Submitted</Text>
                    <Text fontSize="sm" color="#1F1F1F">{formatDate(entry.submitted_at)}</Text>
                  </Box>
                </HStack>

                {/* Link Status */}
                {(entry.application_link_sent_at || entry.application_link_opened_at || entry.application_expires_at) && (
                  <Box>
                    <Text fontSize="sm" color="#5A5A5A" mb={1}>Link Status</Text>
                    <VStack align="start" spacing={1}>
                      {entry.application_link_sent_at && (
                        <Text fontSize="xs" color="green.600">
                          Sent {formatDate(entry.application_link_sent_at)}
                        </Text>
                      )}
                      {entry.application_link_opened_at && (
                        <Text fontSize="xs" color="blue.600">
                          Opened {formatDate(entry.application_link_opened_at)}
                        </Text>
                      )}
                      {entry.application_expires_at && (
                        <Text fontSize="xs" color="orange.600">
                          Expires {formatDate(entry.application_expires_at)}
                        </Text>
                      )}
                    </VStack>
                  </Box>
                )}

                {/* Actions */}
                <HStack spacing={2} pt={2} borderTop="1px solid" borderColor="#ECEAE5">
                  <IconButton
                    size="md"
                    minW="44px"
                    minH="44px"
                    icon={<FiEye />}
                    onClick={() => handleViewEntry(entry)}
                    aria-label="View entry details"
                    colorScheme="blue"
                  />

                  {entry.status === 'review' && (
                    <IconButton
                      size="md"
                      minW="44px"
                      minH="44px"
                      icon={<FiCheck />}
                      onClick={() => handleReview(entry)}
                      aria-label="Review entry"
                      colorScheme="yellow"
                    />
                  )}

                  {(entry.status === 'approved' || entry.status === 'link_sent') && (
                    <Tooltip label="Generate and send application link">
                      <IconButton
                        size="md"
                        minW="44px"
                        minH="44px"
                        icon={<FiSend />}
                        onClick={() => handleGenerateLink(entry)}
                        aria-label="Generate and send application link"
                        colorScheme="green"
                        variant={entry.status === 'link_sent' ? 'outline' : 'solid'}
                      />
                    </Tooltip>
                  )}
                </HStack>
              </VStack>
            </Box>
          ))
        )}
      </VStack>

      {/* Review Drawer */}
      <Drawer isOpen={isReviewOpen} onClose={onReviewClose} size="md" placement="right">
        <DrawerOverlay />
        <DrawerContent bg="#ECEDE8" color="#353535" maxW="33vw" w="100%">
          <DrawerCloseButton />
          <DrawerHeader borderBottomWidth="1px" color="#353535">
            Review Waitlist Entry: {selectedEntry?.first_name} {selectedEntry?.last_name}
          </DrawerHeader>
          <DrawerBody>
            <VStack spacing={4} align="stretch" pt={4}>
              {selectedEntry && (
                <Box bg="white" p={4} borderRadius="md" border="1px" borderColor="gray.300">
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
                <FormLabel color="#353535">Review Notes</FormLabel>
                <Textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Add notes about this review..."
                  rows={3}
                  bg="white"
                  borderColor="gray.300"
                  _focus={{ borderColor: "blue.500", boxShadow: "0 0 0 1px #3182ce" }}
                  w="100%"
                />
              </FormControl>
            </VStack>
          </DrawerBody>
          <DrawerFooter borderTopWidth="1px">
            <HStack spacing={3}>
              <Button
                colorScheme="red"
                onClick={() => submitReview('denied')}
                leftIcon={<FiX />}
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
                leftIcon={<FiCheck />}
              >
                Approve
              </Button>
            </HStack>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* Application Link Drawer */}
      <Drawer isOpen={isLinkOpen} onClose={onLinkClose} size="md" placement="right">
        <DrawerOverlay />
        <DrawerContent bg="#ECEDE8" color="#353535" maxW="33vw" w="100%">
          <DrawerCloseButton />
          <DrawerHeader borderBottomWidth="1px" color="#353535">
            Send Application Link: {selectedEntry?.first_name} {selectedEntry?.last_name}
          </DrawerHeader>
          <DrawerBody>
            <VStack spacing={4} align="stretch" pt={4}>
              <Alert status="info" bg="blue.50" border="1px" borderColor="blue.200">
                <AlertIcon />
                <VStack align="start" spacing={1}>
                  <Text fontWeight="bold" color="#353535">
                    Generate and send application link via SMS
                  </Text>
                  <Text fontSize="sm" color="#353535">
                    This will create a unique application link that expires in 7 days and send it to {selectedEntry?.phone}
                  </Text>
                </VStack>
              </Alert>

              {selectedEntry?.application_link_sent_at && (
                <Alert status="warning" bg="orange.50" border="1px" borderColor="orange.200">
                  <AlertIcon />
                  <Text fontSize="sm" color="#353535">
                    A link was previously sent on {formatDate(selectedEntry.application_link_sent_at)}. 
                    Sending a new link will invalidate the previous one.
                  </Text>
                </Alert>
              )}
            </VStack>
          </DrawerBody>
          <DrawerFooter borderTopWidth="1px">
            <HStack spacing={3}>
              <Button onClick={onLinkClose} variant="outline">
                Cancel
              </Button>
              <Button
                colorScheme="green"
                onClick={generateAndSendLink}
                isLoading={sendingSMS}
                loadingText="Sending..."
                leftIcon={<FiSend />}
              >
                Generate & Send Link
              </Button>
            </HStack>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* View Entry Drawer */}
      <Drawer isOpen={isViewOpen} onClose={onViewClose} size="md" placement="right">
        <DrawerOverlay />
        <DrawerContent bg="#ECEDE8" color="#353535" maxW="33vw" w="100%">
          <DrawerCloseButton />
          <DrawerHeader borderBottomWidth="1px" color="#353535">
            Entry Details: {selectedEntry?.first_name} {selectedEntry?.last_name}
          </DrawerHeader>
          <DrawerBody>
            {selectedEntry && (
              <VStack spacing={4} align="stretch" pt={4}>
                <Box bg="white" p={4} borderRadius="md" border="1px" borderColor="gray.300">
                  <Text fontWeight="bold" mb={3} color="#353535">Contact Information</Text>
                  <VStack align="start" spacing={2}>
                    <Text><strong>Name:</strong> {selectedEntry.first_name} {selectedEntry.last_name}</Text>
                    <Text><strong>Email:</strong> {selectedEntry.email}</Text>
                    <Text><strong>Phone:</strong> {selectedEntry.phone}</Text>
                    {selectedEntry.company && (
                      <Text><strong>Company:</strong> {selectedEntry.company}</Text>
                    )}
                    {selectedEntry.occupation && (
                      <Text><strong>Occupation:</strong> {selectedEntry.occupation}</Text>
                    )}
                    {selectedEntry.industry && (
                      <Text><strong>Industry:</strong> {selectedEntry.industry}</Text>
                    )}
                  </VStack>
                </Box>

                <Box bg="white" p={4} borderRadius="md" border="1px" borderColor="gray.300">
                  <Text fontWeight="bold" mb={3} color="#353535">Application Details</Text>
                  <VStack align="start" spacing={2}>
                    {selectedEntry.referral && (
                      <Text><strong>Referral:</strong> {selectedEntry.referral}</Text>
                    )}
                    {selectedEntry.how_did_you_hear && (
                      <Text><strong>How did you hear:</strong> {selectedEntry.how_did_you_hear}</Text>
                    )}
                    {selectedEntry.why_noir && (
                      <Text><strong>Why Noir:</strong> {selectedEntry.why_noir}</Text>
                    )}
                    <Text><strong>Status:</strong> 
                      <Badge ml={2} colorScheme={getStatusColor(selectedEntry.status)}>
                        {selectedEntry.status.replace('_', ' ')}
                      </Badge>
                    </Text>
                    <Text><strong>Submitted:</strong> {formatDate(selectedEntry.submitted_at)}</Text>
                    {selectedEntry.reviewed_at && (
                      <Text><strong>Reviewed:</strong> {formatDate(selectedEntry.reviewed_at)}</Text>
                    )}
                  </VStack>
                </Box>

                {selectedEntry.review_notes && (
                  <Box bg="white" p={4} borderRadius="md" border="1px" borderColor="gray.300">
                    <Text fontWeight="bold" mb={3} color="#353535">Review Notes</Text>
                    <Text>{selectedEntry.review_notes}</Text>
                  </Box>
                )}

                <Box bg="white" p={4} borderRadius="md" border="1px" borderColor="gray.300">
                  <Text fontWeight="bold" mb={3} color="#353535">Application Link Status</Text>
                  <VStack align="start" spacing={2}>
                    {selectedEntry.application_link_sent_at ? (
                      <>
                        <Text color="green.600">✓ Link sent on {formatDate(selectedEntry.application_link_sent_at)}</Text>
                        {selectedEntry.application_link_opened_at && (
                          <Text color="blue.600">✓ Link opened on {formatDate(selectedEntry.application_link_opened_at)}</Text>
                        )}
                        {selectedEntry.application_expires_at && (
                          <Text color="orange.600">⚠ Expires on {formatDate(selectedEntry.application_expires_at)}</Text>
                        )}
                      </>
                    ) : (
                      <Text color="gray.500">No application link sent yet</Text>
                    )}
                  </VStack>
                </Box>
              </VStack>
            )}
          </DrawerBody>
          <DrawerFooter borderTopWidth="1px">
            <Button onClick={onViewClose} variant="outline">
              Close
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </VStack>
  );
} 