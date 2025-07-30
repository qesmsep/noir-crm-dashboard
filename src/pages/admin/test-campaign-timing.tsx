import React, { useState } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  Input,
  Select,
  useToast,
  Badge,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Code,
  Divider,
  FormControl,
} from '@chakra-ui/react';
import AdminLayout from '../../components/layouts/AdminLayout';

interface TestResult {
  template?: any;
  testResults?: any[];
  member?: any;
  messages?: any[];
  processedMessages?: any[];
  totalTemplates?: number;
  totalMessages?: number;
  messagesToSend?: number;
  message?: string;
}

export default function TestCampaignTiming() {
  const [action, setAction] = useState('test-template');
  const [templateId, setTemplateId] = useState('');
  const [memberId, setMemberId] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<TestResult | null>(null);
  const toast = useToast();

  const runTest = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/test-campaign-timing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          templateId: action === 'test-template' ? templateId : undefined,
          memberId: action === 'test-member' ? memberId : undefined,
        }),
      });

      if (!response.ok) {
        throw new Error('Test failed');
      }

      const data = await response.json();
      setResults(data);
      
      toast({
        title: 'Test Complete',
        description: data.message || 'Test completed successfully',
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Test error:', error);
      toast({
        title: 'Test Failed',
        description: 'Failed to run test',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminLayout>
      <Box p={8} bg="#f8f9fa" minH="100vh">
        <VStack spacing={6} align="stretch">
          <Text fontSize="3xl" fontWeight="bold" color="#353535" fontFamily="'IvyJournal', serif">
            Campaign Timing Test
          </Text>

          <Box bg="white" borderRadius="xl" p={6} boxShadow="0 4px 20px rgba(0,0,0,0.1)">
            <VStack spacing={4} align="stretch">
              <Text fontSize="lg" fontWeight="bold" color="#353535">
                Test Configuration
              </Text>

              <FormControl>
                <Text fontSize="sm" color="#666" mb={1}>Test Type</Text>
                <Select
                  value={action}
                  onChange={(e) => setAction(e.target.value)}
                  bg="#ecede8"
                  borderColor="#a59480"
                  _focus={{ borderColor: '#8a7a66', boxShadow: '0 0 0 1px #8a7a66' }}
                >
                  <option value="test-template">Test Template Timing</option>
                  <option value="test-member">Test Member Campaigns</option>
                  <option value="simulate-cron">Simulate Cron Job</option>
                </Select>
              </FormControl>

              {action === 'test-template' && (
                <FormControl>
                  <Text fontSize="sm" color="#666" mb={1}>Template ID</Text>
                  <Input
                    value={templateId}
                    onChange={(e) => setTemplateId(e.target.value)}
                    placeholder="Enter template ID"
                    bg="#ecede8"
                    borderColor="#a59480"
                    _focus={{ borderColor: '#8a7a66', boxShadow: '0 0 0 1px #8a7a66' }}
                  />
                </FormControl>
              )}

              {action === 'test-member' && (
                <FormControl>
                  <Text fontSize="sm" color="#666" mb={1}>Member ID</Text>
                  <Input
                    value={memberId}
                    onChange={(e) => setMemberId(e.target.value)}
                    placeholder="Enter member ID"
                    bg="#ecede8"
                    borderColor="#a59480"
                    _focus={{ borderColor: '#8a7a66', boxShadow: '0 0 0 1px #8a7a66' }}
                  />
                </FormControl>
              )}

              <Button
                onClick={runTest}
                isLoading={loading}
                loadingText="Running Test..."
                colorScheme="blue"
                size="lg"
                bg="#a59480"
                color="white"
                _hover={{ bg: '#8a7a66' }}
              >
                Run Test
              </Button>
            </VStack>
          </Box>

          {results && (
            <Box bg="white" borderRadius="xl" p={6} boxShadow="0 4px 20px rgba(0,0,0,0.1)">
              <VStack spacing={4} align="stretch">
                <Text fontSize="lg" fontWeight="bold" color="#353535">
                  Test Results
                </Text>

                {action === 'test-template' && results.template && (
                  <Box>
                    <Text fontSize="md" fontWeight="bold" mb={2}>Template Details:</Text>
                    <Code p={2} bg="#f0f0f0" borderRadius="md" display="block">
                      {JSON.stringify(results.template, null, 2)}
                    </Code>
                  </Box>
                )}

                {action === 'test-member' && results.member && (
                  <Box>
                    <Text fontSize="md" fontWeight="bold" mb={2}>Member Details:</Text>
                    <Code p={2} bg="#f0f0f0" borderRadius="md" display="block">
                      {JSON.stringify(results.member, null, 2)}
                    </Code>
                  </Box>
                )}

                {results.testResults && (
                  <Box>
                    <Text fontSize="md" fontWeight="bold" mb={2}>Timing Analysis:</Text>
                    <Table variant="simple" size="sm">
                      <Thead>
                        <Tr>
                          <Th>Scenario</Th>
                          <Th>Target Send Time</Th>
                          <Th>Time Diff (min)</Th>
                          <Th>Should Send Now</Th>
                        </Tr>
                      </Thead>
                      <Tbody>
                        {results.testResults.map((result: any, index: number) => (
                          <Tr key={index}>
                            <Td>{result.scenario}</Td>
                            <Td>{new Date(result.targetSendTime).toLocaleString()}</Td>
                            <Td>{result.timeDiffMinutes}</Td>
                            <Td>
                              <Badge colorScheme={result.shouldSendNow ? 'green' : 'red'}>
                                {result.shouldSendNow ? 'Yes' : 'No'}
                              </Badge>
                            </Td>
                          </Tr>
                        ))}
                      </Tbody>
                    </Table>
                  </Box>
                )}

                {results.messages && (
                  <Box>
                    <Text fontSize="md" fontWeight="bold" mb={2}>Member Messages:</Text>
                    <Table variant="simple" size="sm">
                      <Thead>
                        <Tr>
                          <Th>Template</Th>
                          <Th>Trigger Type</Th>
                          <Th>Target Send Time</Th>
                          <Th>Time Diff (min)</Th>
                          <Th>Should Send Now</Th>
                        </Tr>
                      </Thead>
                      <Tbody>
                        {results.messages.map((message: any, index: number) => (
                          <Tr key={index}>
                            <Td>{message.templateName}</Td>
                            <Td>{message.triggerType}</Td>
                            <Td>{new Date(message.targetSendTime).toLocaleString()}</Td>
                            <Td>{message.timeDiffMinutes}</Td>
                            <Td>
                              <Badge colorScheme={message.shouldSendNow ? 'green' : 'red'}>
                                {message.shouldSendNow ? 'Yes' : 'No'}
                              </Badge>
                            </Td>
                          </Tr>
                        ))}
                      </Tbody>
                    </Table>
                  </Box>
                )}

                {results.processedMessages && (
                  <Box>
                    <Text fontSize="md" fontWeight="bold" mb={2}>Cron Simulation Results:</Text>
                    <HStack spacing={4} mb={4}>
                      <Badge colorScheme="blue">Total Templates: {results.totalTemplates}</Badge>
                      <Badge colorScheme="green">Messages to Send: {results.messagesToSend}</Badge>
                      <Badge colorScheme="gray">Total Messages: {results.totalMessages}</Badge>
                    </HStack>
                    <Table variant="simple" size="sm">
                      <Thead>
                        <Tr>
                          <Th>Template</Th>
                          <Th>Member</Th>
                          <Th>Target Send Time</Th>
                          <Th>Would Send</Th>
                        </Tr>
                      </Thead>
                      <Tbody>
                        {results.processedMessages.map((message: any, index: number) => (
                          <Tr key={index}>
                            <Td>{message.templateName}</Td>
                            <Td>{message.memberName}</Td>
                            <Td>{new Date(message.targetSendTime).toLocaleString()}</Td>
                            <Td>
                              <Badge colorScheme={message.wouldSend ? 'green' : 'red'}>
                                {message.wouldSend ? 'Yes' : 'No'}
                              </Badge>
                            </Td>
                          </Tr>
                        ))}
                      </Tbody>
                    </Table>
                  </Box>
                )}

                <Divider />

                <Text fontSize="sm" color="#666">
                  <strong>Note:</strong> This test endpoint helps verify that your campaign timing logic is working correctly. 
                  The cron job runs every 10 minutes and checks for messages that should be sent within that time window.
                </Text>
              </VStack>
            </Box>
          )}
        </VStack>
      </Box>
    </AdminLayout>
  );
} 