import React, { useState, useEffect } from 'react';
import {
  Box,
  Heading,
  VStack,
  HStack,
  Text,
  Badge,
  Button,
  useToast,
  Spinner,
  Select,
  Input,
  InputGroup,
  InputLeftElement,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Flex,
  Stat,
  StatLabel,
  StatNumber,
  SimpleGrid,
  useDisclosure
} from '@chakra-ui/react';
import { SearchIcon } from '@chakra-ui/icons';
import AdminLayout from '../../components/layouts/AdminLayout';
import WaitlistReviewDrawer from '../../components/WaitlistReviewDrawer';

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

interface StatusCounts {
  status: string;
  count: number;
}

export default function WaitlistPage() {
  const [waitlistEntries, setWaitlistEntries] = useState<WaitlistEntry[]>([]);
  const [statusCounts, setStatusCounts] = useState<StatusCounts[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEntry, setSelectedEntry] = useState<WaitlistEntry | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const { isOpen: isModalOpen, onOpen: onModalOpen, onClose: onModalClose } = useDisclosure();
  const toast = useToast();

  const ITEMS_PER_PAGE = 20;

  const fetchWaitlist = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: ITEMS_PER_PAGE.toString(),
        offset: ((currentPage - 1) * ITEMS_PER_PAGE).toString()
      });

      if (statusFilter) {
        params.append('status', statusFilter);
      }

      const response = await fetch(`/api/waitlist?${params}`);
      const data = await response.json();

      if (response.ok) {
        setWaitlistEntries(data.data || []);
        setTotalCount(data.count || 0);
        setStatusCounts(data.statusCounts || []);
      } else {
        throw new Error(data.error || 'Failed to fetch waitlist');
      }
    } catch (error) {
      console.error('Error fetching waitlist:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch waitlist entries',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWaitlist();
  }, [currentPage, statusFilter]);

  const handleStatusUpdate = () => {
    fetchWaitlist();
    toast({
      title: 'Success',
      description: 'Waitlist updated successfully',
      status: 'success',
      duration: 3000,
    });
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

  const formatPhone = (phone: string) => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 11 && digits.startsWith('1')) {
      return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    }
    return phone;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'review': return 'yellow';
      case 'approved': return 'green';
      case 'denied': return 'red';
      default: return 'gray';
    }
  };

  const filteredEntries = waitlistEntries.filter(entry => {
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      return (
        entry.first_name.toLowerCase().includes(searchLower) ||
        entry.last_name.toLowerCase().includes(searchLower) ||
        entry.email.toLowerCase().includes(searchLower) ||
        entry.company?.toLowerCase().includes(searchLower) ||
        entry.occupation?.toLowerCase().includes(searchLower)
      );
    }
    return true;
  });

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  return (
    <AdminLayout>
      <Box p={4} minH="100vh" bg="#353535" color="#ECEDE8">
        <Box position="relative" ml={10} mr={10} zIndex={1} pt={28}>
          <Heading mb={6} fontFamily="'Montserrat', sans-serif" color="#a59480">
            Waitlist Management
          </Heading>

          {/* Status Summary */}
          <SimpleGrid columns={3} spacing={6} mb={8}>
            {statusCounts.map((statusCount) => (
              <Stat key={statusCount.status} bg="#a59480" p={6} borderRadius="lg" border="1px solid #ecede8">
                <StatLabel fontSize="lg" fontFamily="'Montserrat', sans-serif" fontWeight="bold">
                  {statusCount.status.charAt(0).toUpperCase() + statusCount.status.slice(1)}
                </StatLabel>
                <StatNumber fontSize="3xl" fontFamily="'Montserrat', sans-serif">
                  {statusCount.count}
                </StatNumber>
              </Stat>
            ))}
          </SimpleGrid>

          {/* Filters */}
          <HStack spacing={4} mb={6}>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              bg="#2a2a2a"
              borderColor="#a59480"
              color="#ECEDE8"
              fontFamily="'Montserrat', sans-serif"
              w="200px"
            >
              <option value="">All Statuses</option>
              <option value="review">Review</option>
              <option value="approved">Approved</option>
              <option value="denied">Denied</option>
            </Select>

            <InputGroup w="300px">
              <InputLeftElement>
                <SearchIcon color="#a59480" />
              </InputLeftElement>
              <Input
                placeholder="Search by name, email, company..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                bg="#2a2a2a"
                borderColor="#a59480"
                color="#ECEDE8"
                fontFamily="'Montserrat', sans-serif"
                _focus={{ borderColor: "#a59480", boxShadow: "0 0 0 1px #a59480" }}
              />
            </InputGroup>

            <Button
              onClick={fetchWaitlist}
              bg="#a59480"
              color="#353535"
              _hover={{ bg: "#bca892" }}
              fontFamily="'Montserrat', sans-serif"
            >
              Refresh
            </Button>
          </HStack>

          {/* Waitlist Table */}
          <Box bg="#2a2a2a" borderRadius="lg" overflow="hidden" border="1px solid #a59480">
            {loading ? (
              <Flex justify="center" align="center" p={8}>
                <Spinner size="xl" color="#a59480" />
              </Flex>
            ) : (
              <>
                <Table variant="simple">
                  <Thead bg="#a59480">
                    <Tr>
                      <Th color="#353535" fontFamily="'Montserrat', sans-serif">Name</Th>
                      <Th color="#353535" fontFamily="'Montserrat', sans-serif">Email</Th>
                      <Th color="#353535" fontFamily="'Montserrat', sans-serif">Phone</Th>
                      <Th color="#353535" fontFamily="'Montserrat', sans-serif">Company</Th>
                      <Th color="#353535" fontFamily="'Montserrat', sans-serif">Status</Th>
                      <Th color="#353535" fontFamily="'Montserrat', sans-serif">Submitted</Th>
                      <Th color="#353535" fontFamily="'Montserrat', sans-serif">Actions</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {filteredEntries.map((entry) => (
                      <Tr key={entry.id} _hover={{ bg: "#3a3a3a" }}>
                        <Td fontFamily="'Montserrat', sans-serif">
                          {entry.first_name} {entry.last_name}
                        </Td>
                        <Td fontFamily="'Montserrat', sans-serif">{entry.email}</Td>
                        <Td fontFamily="'Montserrat', sans-serif">{formatPhone(entry.phone)}</Td>
                        <Td fontFamily="'Montserrat', sans-serif">{entry.company || '-'}</Td>
                        <Td>
                          <Badge colorScheme={getStatusColor(entry.status)} variant="subtle">
                            {entry.status.toUpperCase()}
                          </Badge>
                        </Td>
                        <Td fontFamily="'Montserrat', sans-serif">{formatDate(entry.submitted_at)}</Td>
                        <Td>
                          <Button
                            size="sm"
                            onClick={() => {
                              setSelectedEntry(entry);
                              onModalOpen();
                            }}
                            bg="#a59480"
                            color="#353535"
                            _hover={{ bg: "#bca892" }}
                            fontFamily="'Montserrat', sans-serif"
                          >
                            Review
                          </Button>
                        </Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>

                {filteredEntries.length === 0 && (
                  <Box p={8} textAlign="center">
                    <Text fontFamily="'Montserrat', sans-serif" color="#a59480">
                      No waitlist entries found
                    </Text>
                  </Box>
                )}
              </>
            )}
          </Box>

          {/* Pagination */}
          {totalPages > 1 && (
            <HStack justify="center" mt={6} spacing={2}>
              <Button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                bg="#a59480"
                color="#353535"
                _hover={{ bg: "#bca892" }}
                fontFamily="'Montserrat', sans-serif"
              >
                Previous
              </Button>
              <Text fontFamily="'Montserrat', sans-serif">
                Page {currentPage} of {totalPages}
              </Text>
              <Button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                bg="#a59480"
                color="#353535"
                _hover={{ bg: "#bca892" }}
                fontFamily="'Montserrat', sans-serif"
              >
                Next
              </Button>
            </HStack>
          )}
        </Box>
      </Box>

      {/* Waitlist Review Drawer */}
      <WaitlistReviewDrawer
        isOpen={isModalOpen}
        onClose={onModalClose}
        entry={selectedEntry}
        onStatusUpdate={handleStatusUpdate}
      />
    </AdminLayout>
  );
} 