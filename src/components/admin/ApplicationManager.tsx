import React, { useState, useEffect } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
  useToast,
  Spinner,
  Alert,
  AlertIcon,
  Select,
  Input,
  InputGroup,
  InputLeftElement,
  Icon
} from '@chakra-ui/react';
import { FiSearch } from 'react-icons/fi';

interface Application {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  status: string;
  created_at: string;
  questionnaire_completed_at?: string;
  agreement_completed_at?: string;
  payment_completed_at?: string;
  payment_amount?: number;
}

export default function ApplicationManager() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const toast = useToast();

  useEffect(() => {
    loadApplications();
  }, [statusFilter]);

  const loadApplications = async () => {
    try {
      // This would need to be implemented
      const response = await fetch('/api/membership/applications');
      if (response.ok) {
        const data = await response.json();
        setApplications(data);
      } else {
        // For now, show empty state
        setApplications([]);
      }
    } catch (error) {
      setApplications([]);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'questionnaire_pending': return 'yellow';
      case 'questionnaire_completed': return 'blue';
      case 'agreement_completed': return 'purple';
      case 'payment_completed': return 'green';
      case 'approved': return 'green';
      case 'rejected': return 'red';
      default: return 'gray';
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatAmount = (amount?: number) => {
    if (!amount) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount / 100);
  };

  const filteredApplications = applications.filter(app => {
    if (statusFilter !== 'all' && app.status !== statusFilter) return false;
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      app.first_name.toLowerCase().includes(searchLower) ||
      app.last_name.toLowerCase().includes(searchLower) ||
      app.email.toLowerCase().includes(searchLower)
    );
  });

  if (loading) {
    return (
      <VStack spacing={4} py={8}>
        <Spinner size="lg" />
        <Text>Loading applications...</Text>
      </VStack>
    );
  }

  return (
    <VStack spacing={6} align="stretch">
      <HStack justify="space-between" wrap="wrap">
        <VStack align="start" spacing={1}>
          <Text fontSize="lg" fontWeight="bold">
            Application Management
          </Text>
          <Text fontSize="sm" color="gray.600">
            Review and manage membership applications
          </Text>
        </VStack>

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
            <option value="questionnaire_completed">Questionnaire Complete</option>
            <option value="agreement_completed">Agreement Signed</option>
            <option value="payment_completed">Payment Complete</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </Select>
        </HStack>
      </HStack>

      {filteredApplications.length === 0 ? (
        <Alert status="info">
          <AlertIcon />
          <VStack align="start" spacing={1}>
            <Text fontWeight="bold">No applications found</Text>
            <Text fontSize="sm">
              Applications will appear here as users complete the membership process.
            </Text>
          </VStack>
        </Alert>
      ) : (
        <Box overflowX="auto">
          <Table variant="simple">
            <Thead>
              <Tr>
                <Th>Applicant</Th>
                <Th>Email</Th>
                <Th>Status</Th>
                <Th>Progress</Th>
                <Th>Payment</Th>
                <Th>Applied</Th>
                <Th>Actions</Th>
              </Tr>
            </Thead>
            <Tbody>
              {filteredApplications.map((application) => (
                <Tr key={application.id}>
                  <Td fontWeight="bold">
                    {application.first_name} {application.last_name}
                  </Td>
                  <Td>{application.email}</Td>
                  <Td>
                    <Badge 
                      colorScheme={getStatusColor(application.status)}
                      variant="subtle"
                    >
                      {application.status.replace('_', ' ')}
                    </Badge>
                  </Td>
                  <Td>
                    <VStack align="start" spacing={1}>
                      <Text fontSize="xs">
                        Questionnaire: {formatDate(application.questionnaire_completed_at)}
                      </Text>
                      <Text fontSize="xs">
                        Agreement: {formatDate(application.agreement_completed_at)}
                      </Text>
                      <Text fontSize="xs">
                        Payment: {formatDate(application.payment_completed_at)}
                      </Text>
                    </VStack>
                  </Td>
                  <Td>{formatAmount(application.payment_amount)}</Td>
                  <Td>{formatDate(application.created_at)}</Td>
                  <Td>
                    <HStack spacing={2}>
                      <Button size="xs" colorScheme="blue">
                        View
                      </Button>
                      {application.status === 'payment_completed' && (
                        <Button size="xs" colorScheme="green">
                          Approve
                        </Button>
                      )}
                    </HStack>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Box>
      )}
    </VStack>
  );
}