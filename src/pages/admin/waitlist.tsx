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
import { SearchIcon, LinkIcon, CopyIcon } from '@chakra-ui/icons';
import AdminLayout from '../../components/layouts/AdminLayout';
import WaitlistReviewDrawer from '../../components/WaitlistReviewDrawer';
import styles from '../../styles/WaitlistMobile.module.css';

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
  city_state?: string;
  visit_frequency?: string;
  go_to_drink?: string;
  application_token?: string;
  application_link_sent_at?: string;
  application_expires_at?: string;
  application_link_opened_at?: string;
  status: 'review' | 'approved' | 'denied' | 'waitlisted';
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
  const [generatingLink, setGeneratingLink] = useState<string | null>(null);
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
      case 'waitlisted': return 'purple';
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

  const generateInvitationLink = async (waitlistId: string) => {
    setGeneratingLink(waitlistId);
    try {
      const response = await fetch('/api/invitation/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ waitlistId }),
      });

      const data = await response.json();

      if (response.ok) {
        // Copy to clipboard
        await navigator.clipboard.writeText(data.invitationUrl);
        toast({
          title: 'Invitation Link Generated',
          description: 'Link copied to clipboard',
          status: 'success',
          duration: 3000,
        });
        fetchWaitlist(); // Refresh to show the new link
      } else {
        throw new Error(data.error || 'Failed to generate invitation link');
      }
    } catch (error) {
      console.error('Error generating invitation link:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate invitation link',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setGeneratingLink(null);
    }
  };

  const copyInvitationLink = async (token: string) => {
    const invitationUrl = `${window.location.origin}/invitation?token=${token}`;
    try {
      await navigator.clipboard.writeText(invitationUrl);
      toast({
        title: 'Link Copied',
        description: 'Invitation link copied to clipboard',
        status: 'success',
        duration: 2000,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to copy link',
        status: 'error',
        duration: 2000,
      });
    }
  };

  return (
    <AdminLayout>
      {/* Desktop View */}
      <div className={styles.desktopView}>
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
                <option value="waitlisted">Waitlisted</option>
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
                        <Th color="#353535" fontFamily="'Montserrat', sans-serif">Location</Th>
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
                          <Td fontFamily="'Montserrat', sans-serif">{entry.city_state || '-'}</Td>
                          <Td>
                            <Badge colorScheme={getStatusColor(entry.status)} variant="subtle">
                              {entry.status.toUpperCase()}
                            </Badge>
                          </Td>
                          <Td fontFamily="'Montserrat', sans-serif">{formatDate(entry.submitted_at)}</Td>
                          <Td>
                            <HStack spacing={2}>
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
                              {!entry.application_token ? (
                                <Button
                                  size="sm"
                                  onClick={() => generateInvitationLink(entry.id)}
                                  isLoading={generatingLink === entry.id}
                                  leftIcon={<LinkIcon />}
                                  bg="#2a2a2a"
                                  color="#a59480"
                                  borderColor="#a59480"
                                  borderWidth="1px"
                                  _hover={{ bg: "#3a3a3a" }}
                                  fontFamily="'Montserrat', sans-serif"
                                >
                                  Generate Link
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  onClick={() => copyInvitationLink(entry.application_token!)}
                                  leftIcon={<CopyIcon />}
                                  bg="#2a2a2a"
                                  color="#a59480"
                                  borderColor="#a59480"
                                  borderWidth="1px"
                                  _hover={{ bg: "#3a3a3a" }}
                                  fontFamily="'Montserrat', sans-serif"
                                >
                                  Copy Link
                                </Button>
                              )}
                            </HStack>
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
      </div>

      {/* Mobile View */}
      <div className={styles.mobileView}>
        <div className={styles.mobileContainer}>
          <div className={styles.mobileHeader}>
            <h1 className={styles.mobileTitle}>Waitlist Management</h1>
            
            {/* Mobile Status Summary */}
            <div className={styles.mobileStatusGrid}>
              {statusCounts.map((statusCount) => (
                <div key={statusCount.status} className={styles.mobileStatusCard}>
                  <div className={styles.mobileStatusLabel}>
                    {statusCount.status.charAt(0).toUpperCase() + statusCount.status.slice(1)}
                  </div>
                  <div className={styles.mobileStatusNumber}>
                    {statusCount.count}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Mobile Filters */}
          <div className={styles.mobileFiltersContainer}>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={styles.mobileSelect}
            >
              <option value="">All Statuses</option>
              <option value="review">Review</option>
              <option value="approved">Approved</option>
              <option value="waitlisted">Waitlisted</option>
              <option value="denied">Denied</option>
            </select>

            <div className={styles.mobileSearchContainer}>
              <SearchIcon className={styles.mobileSearchIcon} />
              <input
                type="text"
                placeholder="Search by name, email, company..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={styles.mobileSearchInput}
              />
            </div>

            <button
              onClick={fetchWaitlist}
              className={styles.mobileRefreshButton}
            >
              Refresh
            </button>
          </div>

          {/* Mobile Waitlist Entries */}
          <div className={styles.mobileEntriesContainer}>
            {loading ? (
              <div className={styles.mobileLoading}>
                <div className={styles.mobileLoadingSpinner}></div>
              </div>
            ) : filteredEntries.length === 0 ? (
              <div className={styles.mobileEmpty}>
                No waitlist entries found
              </div>
            ) : (
              filteredEntries.map((entry) => (
                <div key={entry.id} className={styles.mobileEntryCard}>
                  <div className={styles.mobileEntryHeader}>
                    <div className={styles.mobileEntryName}>
                      {entry.first_name} {entry.last_name}
                    </div>
                    <div className={styles.mobileEntryHeaderInfo}>
                      <span className={`${styles.mobileEntryStatus} ${styles[entry.status]}`}>
                        {entry.status.toUpperCase()}
                      </span>
                      <div className={styles.mobileEntryDate}>
                        {formatDate(entry.submitted_at)}
                      </div>
                    </div>
                  </div>

                  <div className={styles.mobileEntryInfo}>
                    <div className={styles.mobileInfoRow}>
                      <span className={styles.mobileInfoIcon}>✉️</span>
                      <span className={styles.mobileInfoText}>{entry.email}</span>
                    </div>
                    <div className={styles.mobileInfoRow}>
                      <span className={styles.mobileInfoIcon}>📞</span>
                      <span className={styles.mobileInfoText}>{formatPhone(entry.phone)}</span>
                    </div>
                    {(entry.company || entry.city_state) && (
                      <div className={styles.mobileInfoRow}>
                        <span className={styles.mobileInfoIcon}>🏢</span>
                        <div className={styles.mobileInfoText}>
                          {entry.company || '-'}
                          {entry.company && entry.city_state && (
                            <div className={styles.mobileCompanyLocation}>
                              {entry.city_state}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {/* Additional details - expandable section */}
                    {(entry.why_noir || entry.occupation || entry.how_did_you_hear) && (
                      <div className={styles.mobileExpandedDetails}>
                        {entry.why_noir && (
                          <div className={styles.mobileDetailSection}>
                            <div className={styles.mobileDetailLabel}>Why Noir?</div>
                            <div className={styles.mobileDetailValue}>{entry.why_noir}</div>
                          </div>
                        )}
                        {entry.occupation && (
                          <div className={styles.mobileDetailSection}>
                            <div className={styles.mobileDetailLabel}>Occupation</div>
                            <div className={styles.mobileDetailValue}>{entry.occupation}</div>
                          </div>
                        )}
                        {entry.how_did_you_hear && (
                          <div className={styles.mobileDetailSection}>
                            <div className={styles.mobileDetailLabel}>How did you hear about us?</div>
                            <div className={styles.mobileDetailValue}>{entry.how_did_you_hear}</div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className={styles.mobileEntryActions}>
                    <button
                      onClick={() => {
                        setSelectedEntry(entry);
                        onModalOpen();
                      }}
                      className={`${styles.mobileActionButton} ${styles.mobileReviewButton}`}
                    >
                      Review
                    </button>
                    {!entry.application_token ? (
                      <button
                        onClick={() => generateInvitationLink(entry.id)}
                        disabled={generatingLink === entry.id}
                        className={`${styles.mobileActionButton} ${styles.mobileGenerateButton}`}
                      >
                        {generatingLink === entry.id ? '⏳' : '🔗'} Generate Link
                      </button>
                    ) : (
                      <button
                        onClick={() => copyInvitationLink(entry.application_token!)}
                        className={`${styles.mobileActionButton} ${styles.mobileCopyButton}`}
                      >
                        📋 Copy Link
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Mobile Pagination */}
          {totalPages > 1 && (
            <div className={styles.mobilePagination}>
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className={styles.mobilePaginationButton}
              >
                Previous
              </button>
              <span className={styles.mobilePaginationText}>
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className={styles.mobilePaginationButton}
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>

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