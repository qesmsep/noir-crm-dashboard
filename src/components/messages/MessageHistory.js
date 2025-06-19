import React, { useState, useEffect } from 'react';
import {
  Box,
  VStack,
  Text,
  Badge,
  Spinner,
  useToast,
  Heading,
} from '@chakra-ui/react';

export default function MessageHistory({ accountId }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const res = await fetch(`/api/messages?account_id=${accountId}`);
        if (!res.ok) {
          throw new Error('Failed to fetch messages');
        }
        const data = await res.json();
        setMessages(data.messages || []);
      } catch (error) {
        toast({
          title: 'Error',
          description: error.message,
          status: 'error',
          duration: 3000,
        });
      } finally {
        setLoading(false);
      }
    };

    if (accountId) {
      fetchMessages();
    }
  }, [accountId]);

  if (loading) {
    return (
      <Box textAlign="center" py={8}>
        <Spinner size="xl" />
      </Box>
    );
  }

  if (!messages.length) {
    return (
      <Box textAlign="center" py={8}>
        <Text color="gray.500">No messages found</Text>
      </Box>
    );
  }

  return (
    <Box bg="white" p={6} borderRadius="lg" boxShadow="sm">
      <Heading size="md" mb={4}>Message History</Heading>
      <VStack spacing={4} align="stretch">
        {messages.map((message) => (
          <Box
            key={message.id}
            p={4}
            borderWidth={1}
            borderRadius="md"
            bg={message.direction === 'outbound' ? 'blue.50' : 'gray.50'}
          >
            <Box display="flex" justifyContent="space-between" mb={2}>
              <Text fontWeight="bold">
                {message.direction === 'outbound' ? 'To: ' : 'From: '}
                {message.phone_number}
              </Text>
              <Badge
                colorScheme={
                  message.status === 'sent' ? 'green' :
                  message.status === 'failed' ? 'red' :
                  'yellow'
                }
              >
                {message.status}
              </Badge>
            </Box>
            <Text>{message.content}</Text>
            <Text fontSize="sm" color="gray.500" mt={2}>
              {new Date(message.created_at).toLocaleString()}
            </Text>
          </Box>
        ))}
      </VStack>
    </Box>
  );
} 