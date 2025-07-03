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

interface Questionnaire {
  id: string;
  title: string;
  description: string;
  is_active: boolean;
  created_at: string;
  questionnaire_questions?: any[];
}

export default function QuestionnaireManager() {
  const [questionnaires, setQuestionnaires] = useState<Questionnaire[]>([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    loadQuestionnaires();
  }, []);

  const loadQuestionnaires = async () => {
    try {
      const response = await fetch('/api/membership/questionnaires?includeInactive=true');
      if (response.ok) {
        const data = await response.json();
        setQuestionnaires(data);
      } else {
        toast({
          title: 'Error',
          description: 'Failed to load questionnaires',
          status: 'error',
          duration: 3000,
        });
      }
    } catch (error) {
      toast({
        title: 'Error', 
        description: 'Failed to load questionnaires',
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
        <Text>Loading questionnaires...</Text>
      </VStack>
    );
  }

  return (
    <VStack spacing={6} align="stretch">
      <HStack justify="space-between">
        <VStack align="start" spacing={1}>
          <Text fontSize="lg" fontWeight="bold">
            Questionnaire Management
          </Text>
          <Text fontSize="sm" color="gray.600">
            Create and manage membership application questionnaires
          </Text>
        </VStack>
        
        <Button colorScheme="blue" size="md">
          Create New Questionnaire
        </Button>
      </HStack>

      {questionnaires.length === 0 ? (
        <Alert status="info">
          <AlertIcon />
          <VStack align="start" spacing={1}>
            <Text fontWeight="bold">No questionnaires found</Text>
            <Text fontSize="sm">
              Create your first questionnaire to start collecting membership applications.
            </Text>
          </VStack>
        </Alert>
      ) : (
        <Box overflowX="auto">
          <Table variant="simple">
            <Thead>
              <Tr>
                <Th>Title</Th>
                <Th>Description</Th>
                <Th>Questions</Th>
                <Th>Status</Th>
                <Th>Created</Th>
                <Th>Actions</Th>
              </Tr>
            </Thead>
            <Tbody>
              {questionnaires.map((questionnaire) => (
                <Tr key={questionnaire.id}>
                  <Td fontWeight="bold">{questionnaire.title}</Td>
                  <Td>{questionnaire.description || 'No description'}</Td>
                  <Td>{questionnaire.questionnaire_questions?.length || 0} questions</Td>
                  <Td>
                    <Badge 
                      colorScheme={questionnaire.is_active ? 'green' : 'gray'}
                      variant="subtle"
                    >
                      {questionnaire.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </Td>
                  <Td>{formatDate(questionnaire.created_at)}</Td>
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