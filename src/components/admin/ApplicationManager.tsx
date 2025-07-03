import React, { useState, useEffect } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  Heading,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
  Select,
  Input,
  InputGroup,
  InputLeftElement,
  Icon,
  useToast,
  Drawer,
  DrawerBody,
  DrawerFooter,
  DrawerHeader,
  DrawerOverlay,
  DrawerContent,
  DrawerCloseButton,
  useDisclosure,
  Divider,
  IconButton
} from '@chakra-ui/react';
import { FiSearch, FiEye, FiCheck, FiX } from 'react-icons/fi';

interface Application {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  status: string;
  created_at: string;
  questionnaire_completed_at?: string;
  agreement_completed_at?: string;
  payment_completed_at?: string;
  payment_amount?: number;
  waitlist_id?: string;
  questionnaire_responses?: any;
  agreement_signed?: boolean;
}

export default function ApplicationManager() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null);
  
  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();

  useEffect(() => {
    loadApplications();
  }, [statusFilter]);

  const loadApplications = async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }

      const response = await fetch(`/api/membership/applications?${params}`);
      if (response.ok) {
        const data = await response.json();
        setApplications(data);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load applications',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleViewApplication = async (application: Application) => {
    try {
      const response = await fetch(`/api/membership/applications/${application.id}`);
      if (response.ok) {
        const data = await response.json();
        setSelectedApplication(data);
        onOpen();
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load application details',
        status: 'error',
        duration: 3000,
      });
    }
  };

  const handleApproveApplication = async (applicationId: string) => {
    try {
      const response = await fetch(`/api/membership/applications/${applicationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' })
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Application approved successfully',
          status: 'success',
          duration: 3000,
        });
        onClose();
        loadApplications();
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to approve application',
        status: 'error',
        duration: 3000,
      });
    }
  };

  const handleRejectApplication = async (applicationId: string) => {
    try {
      const response = await fetch(`/api/membership/applications/${applicationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'rejected' })
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Application rejected successfully',
          status: 'success',
          duration: 3000,
        });
        onClose();
        loadApplications();
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to reject application',
        status: 'error',
        duration: 3000,
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'questionnaire_completed': return 'blue';
      case 'agreement_completed': return 'yellow';
      case 'payment_completed': return 'green';
      case 'approved': return 'green';
      case 'rejected': return 'red';
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

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount / 100);
  };

  const filteredApplications = applications.filter(app => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      app.first_name.toLowerCase().includes(searchLower) ||
      app.last_name.toLowerCase().includes(searchLower) ||
      app.email.toLowerCase().includes(searchLower) ||
      (app.phone && app.phone.includes(searchTerm))
    );
  });

  if (loading) {
    return <Text>Loading applications...</Text>;
  }

  return (
    <VStack spacing={6} align="stretch">
      <HStack justify="space-between">
        <VStack align="start" spacing={1}>
          <Heading size="md">Applications</Heading>
          <Text fontSize="sm" color="gray.600">
            Track membership applications
          </Text>
        </VStack>
      </HStack>

      {/* Filters */}
      <HStack spacing={4}>
        <InputGroup maxW="300px">
          <InputLeftElement>
            <Icon as={FiSearch} color="gray.400" />
          </InputLeftElement>
          <Input
            placeholder="Search applications..."
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
          <option value="questionnaire_pending">Questionnaire Pending</option>
          <option value="questionnaire_completed">Questionnaire Completed</option>
          <option value="agreement_pending">Agreement Pending</option>
          <option value="agreement_completed">Agreement Completed</option>
          <option value="payment_pending">Payment Pending</option>
          <option value="payment_completed">Payment Completed</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </Select>
      </HStack>

      <Table variant="simple">
        <Thead>
          <Tr>
            <Th>Applicant</Th>
            <Th>Contact</Th>
            <Th>Status</Th>
            <Th>Progress</Th>
            <Th>Payment</Th>
            <Th>Submitted</Th>
            <Th>Actions</Th>
          </Tr>
        </Thead>
        <Tbody>
          {filteredApplications.map((application) => (
            <Tr key={application.id}>
              <Td>
                <VStack align="start" spacing={1}>
                  <Text fontWeight="bold">
                    {application.first_name} {application.last_name}
                  </Text>
                  {application.waitlist_id && (
                    <Badge size="sm" colorScheme="purple">From Waitlist</Badge>
                  )}
                </VStack>
              </Td>
              
              <Td>
                <VStack align="start" spacing={1}>
                  <Text fontSize="sm">{application.email}</Text>
                  {application.phone && (
                    <Text fontSize="sm" color="gray.500">{application.phone}</Text>
                  )}
                </VStack>
              </Td>
              
              <Td>
                <Badge colorScheme={getStatusColor(application.status)}>
                  {application.status.replace('_', ' ')}
                </Badge>
              </Td>
              
              <Td>
                <VStack align="start" spacing={1}>
                  {application.questionnaire_completed_at && (
                    <Text fontSize="xs" color="green.600">✓ Questionnaire</Text>
                  )}
                  {application.agreement_completed_at && (
                    <Text fontSize="xs" color="green.600">✓ Agreement</Text>
                  )}
                  {application.payment_completed_at && (
                    <Text fontSize="xs" color="green.600">✓ Payment</Text>
                  )}
                </VStack>
              </Td>
              
              <Td>
                {application.payment_amount ? (
                  <Text fontWeight="bold" color="green.600">
                    {formatAmount(application.payment_amount)}
                  </Text>
                ) : (
                  <Text fontSize="sm" color="gray.500">Pending</Text>
                )}
              </Td>
              
              <Td>
                <Text fontSize="sm">{formatDate(application.created_at)}</Text>
              </Td>
              
              <Td>
                <HStack spacing={2}>
                  <IconButton
                    size="sm"
                    icon={<FiEye />}
                    onClick={() => handleViewApplication(application)}
                    aria-label="View application"
                    colorScheme="blue"
                  />
                  {application.status === 'payment_completed' && (
                    <IconButton
                      size="sm"
                      icon={<FiCheck />}
                      onClick={() => handleApproveApplication(application.id)}
                      aria-label="Approve application"
                      colorScheme="green"
                    />
                  )}
                </HStack>
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
      
      {filteredApplications.length === 0 && (
        <Box py={8} textAlign="center">
          <Text color="gray.500">No applications found</Text>
        </Box>
      )}

      {/* Application Details Drawer */}
      <Drawer isOpen={isOpen} onClose={onClose} size="xl">
        <DrawerOverlay />
        <DrawerContent bg="#ECEDE8" color="#353535">
          <DrawerCloseButton />
          <DrawerHeader borderBottomWidth="1px" color="#353535">
            Application Details: {selectedApplication?.first_name} {selectedApplication?.last_name}
          </DrawerHeader>
          <DrawerBody>
            {selectedApplication && (
              <VStack spacing={6} align="stretch" pt={4}>
                {/* Basic Information */}
                <Box bg="white" p={4} borderRadius="md" border="1px" borderColor="gray.300">
                  <Text fontWeight="bold" mb={3} color="#353535">Basic Information</Text>
                  <VStack align="start" spacing={2}>
                    <Text><strong>Name:</strong> {selectedApplication.first_name} {selectedApplication.last_name}</Text>
                    <Text><strong>Email:</strong> {selectedApplication.email}</Text>
                    {selectedApplication.phone && (
                      <Text><strong>Phone:</strong> {selectedApplication.phone}</Text>
                    )}
                    <Text><strong>Status:</strong> 
                      <Badge ml={2} colorScheme={getStatusColor(selectedApplication.status)}>
                        {selectedApplication.status.replace('_', ' ')}
                      </Badge>
                    </Text>
                    <Text><strong>Submitted:</strong> {formatDate(selectedApplication.created_at)}</Text>
                  </VStack>
                </Box>

                {/* Progress */}
                <Box bg="white" p={4} borderRadius="md" border="1px" borderColor="gray.300">
                  <Text fontWeight="bold" mb={3} color="#353535">Application Progress</Text>
                  <VStack align="start" spacing={2}>
                    {selectedApplication.questionnaire_completed_at && (
                      <Text color="green.600">✓ Questionnaire completed on {formatDate(selectedApplication.questionnaire_completed_at)}</Text>
                    )}
                    {selectedApplication.agreement_completed_at && (
                      <Text color="green.600">✓ Agreement signed on {formatDate(selectedApplication.agreement_completed_at)}</Text>
                    )}
                    {selectedApplication.payment_completed_at && (
                      <Text color="green.600">✓ Payment completed on {formatDate(selectedApplication.payment_completed_at)}</Text>
                    )}
                    {selectedApplication.payment_amount && (
                      <Text><strong>Payment Amount:</strong> {formatAmount(selectedApplication.payment_amount)}</Text>
                    )}
                  </VStack>
                </Box>

                {/* Questionnaire Responses */}
                {selectedApplication.questionnaire_responses && (
                  <Box bg="white" p={4} borderRadius="md" border="1px" borderColor="gray.300">
                    <Text fontWeight="bold" mb={3} color="#353535">Questionnaire Responses</Text>
                    <VStack align="start" spacing={3}>
                      {Object.entries(selectedApplication.questionnaire_responses).map(([question, answer]) => (
                        <Box key={question} w="100%">
                          <Text fontWeight="semibold" color="#353535">{question}</Text>
                          <Text fontSize="sm" color="gray.600">{String(answer)}</Text>
                        </Box>
                      ))}
                    </VStack>
                  </Box>
                )}
              </VStack>
            )}
          </DrawerBody>
          <DrawerFooter borderTopWidth="1px">
            <HStack spacing={3}>
              {selectedApplication?.status === 'payment_completed' && (
                <>
                  <Button
                    leftIcon={<FiX />}
                    colorScheme="red"
                    onClick={() => handleRejectApplication(selectedApplication.id)}
                  >
                    Reject
                  </Button>
                  <Button
                    leftIcon={<FiCheck />}
                    colorScheme="green"
                    onClick={() => handleApproveApplication(selectedApplication.id)}
                  >
                    Approve
                  </Button>
                </>
              )}
              <Button onClick={onClose} variant="outline">
                Close
              </Button>
            </HStack>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </VStack>
  );
} 