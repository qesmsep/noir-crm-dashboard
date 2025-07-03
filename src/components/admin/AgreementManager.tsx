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
  AlertIcon
} from '@chakra-ui/react';

interface Agreement {
  id: string;
  title: string;
  version: number;
  status: string;
  is_current: boolean;
  created_at: string;
}

export default function AgreementManager() {
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    loadAgreements();
  }, []);

  const loadAgreements = async () => {
    try {
      const response = await fetch('/api/membership/agreements');
      if (response.ok) {
        const data = await response.json();
        setAgreements(data);
      } else {
        toast({
          title: 'Error',
          description: 'Failed to load agreements',
          status: 'error',
          duration: 3000,
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load agreements',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <VStack spacing={4} py={8}>
        <Spinner size="lg" />
        <Text>Loading agreements...</Text>
      </VStack>
    );
  }

  return (
    <VStack spacing={6} align="stretch">
      <HStack justify="space-between">
        <VStack align="start" spacing={1}>
          <Text fontSize="lg" fontWeight="bold">
            Agreement Management
          </Text>
          <Text fontSize="sm" color="gray.600">
            Create and manage membership agreements with version control
          </Text>
        </VStack>
        
        <Button colorScheme="blue" size="md">
          Create New Agreement
        </Button>
      </HStack>

      {agreements.length === 0 ? (
        <Alert status="info">
          <AlertIcon />
          <VStack align="start" spacing={1}>
            <Text fontWeight="bold">No agreements found</Text>
            <Text fontSize="sm">
              Create your first membership agreement to define terms and conditions.
            </Text>
          </VStack>
        </Alert>
      ) : (
        <Box overflowX="auto">
          <Table variant="simple">
            <Thead>
              <Tr>
                <Th>Title</Th>
                <Th>Version</Th>
                <Th>Status</Th>
                <Th>Current</Th>
                <Th>Created</Th>
                <Th>Actions</Th>
              </Tr>
            </Thead>
            <Tbody>
              {agreements.map((agreement) => (
                <Tr key={agreement.id}>
                  <Td fontWeight="bold">{agreement.title}</Td>
                  <Td>v{agreement.version}</Td>
                  <Td>
                    <Badge 
                      colorScheme={agreement.status === 'active' ? 'green' : 'gray'}
                      variant="subtle"
                    >
                      {agreement.status}
                    </Badge>
                  </Td>
                  <Td>
                    {agreement.is_current && (
                      <Badge colorScheme="blue" variant="subtle">
                        Current
                      </Badge>
                    )}
                  </Td>
                  <Td>{formatDate(agreement.created_at)}</Td>
                  <Td>
                    <HStack spacing={2}>
                      <Button size="xs" colorScheme="blue">
                        Edit
                      </Button>
                      <Button size="xs" variant="outline">
                        Preview
                      </Button>
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