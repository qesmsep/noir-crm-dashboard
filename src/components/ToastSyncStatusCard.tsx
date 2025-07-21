import React, { useState, useEffect } from 'react';
import {
  Box,
  Heading,
  Text,
  VStack,
  HStack,
  Badge,
  useToast,
  IconButton,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Spinner,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  StatArrow
} from '@chakra-ui/react';
import { RepeatIcon, InfoIcon } from '@chakra-ui/icons';

interface SyncStatus {
  id: string;
  sync_type: string;
  status: string;
  records_processed: number;
  records_failed: number;
  error_message?: string;
  started_at: string;
  completed_at?: string;
}

interface SyncSummary {
  total_syncs: number;
  successful_syncs: number;
  failed_syncs: number;
  total_records_processed: number;
  total_records_failed: number;
}

const ToastSyncStatusCard: React.FC = () => {
  const [syncStatus, setSyncStatus] = useState<SyncStatus[]>([]);
  const [summary, setSummary] = useState<SyncSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const toast = useToast();

  const fetchSyncStatus = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/toast-sync-status?limit=10');
      if (!response.ok) {
        throw new Error('Failed to fetch sync status');
      }
      const data = await response.json();
      setSyncStatus(data.syncStatus || []);
      setSummary(data.summary);
    } catch (error) {
      console.error('Error fetching sync status:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch Toast sync status',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchSyncStatus();
    setRefreshing(false);
  };

  useEffect(() => {
    fetchSyncStatus();
  }, []);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'green';
      case 'failed':
        return 'red';
      case 'in_progress':
        return 'yellow';
      default:
        return 'gray';
    }
  };

  const getSyncTypeLabel = (type: string) => {
    switch (type) {
      case 'webhook':
        return 'Real-time Webhook';
      case 'manual':
        return 'Manual Sync';
      case 'batch':
        return 'Batch Sync';
      default:
        return type;
    }
  };

  if (loading) {
    return (
      <Box p={6} bg="white" borderRadius="lg" boxShadow="sm">
        <VStack spacing={4} align="center" py={8}>
          <Spinner size="lg" />
          <Text>Loading Toast sync status...</Text>
        </VStack>
      </Box>
    );
  }

  return (
    <Box p={6} bg="white" borderRadius="lg" boxShadow="sm">
      <HStack justify="space-between" mb={6}>
        <Heading size="md">Toast Sync Status</Heading>
        <IconButton
          aria-label="Refresh sync status"
          icon={<RepeatIcon />}
          size="sm"
          onClick={handleRefresh}
          isLoading={refreshing}
        />
      </HStack>

      {summary && (
        <VStack spacing={4} mb={6} align="stretch">
          <HStack spacing={8} justify="space-around">
            <Stat>
              <StatLabel>Total Syncs (24h)</StatLabel>
              <StatNumber>{summary.total_syncs}</StatNumber>
              <StatHelpText>
                <StatArrow type="increase" />
                {summary.successful_syncs} successful
              </StatHelpText>
            </Stat>
            <Stat>
              <StatLabel>Records Processed</StatLabel>
              <StatNumber>{summary.total_records_processed}</StatNumber>
              <StatHelpText>
                {summary.total_records_failed} failed
              </StatHelpText>
            </Stat>
            <Stat>
              <StatLabel>Success Rate</StatLabel>
              <StatNumber>
                {summary.total_syncs > 0 
                  ? Math.round((summary.successful_syncs / summary.total_syncs) * 100)
                  : 0}%
              </StatNumber>
            </Stat>
          </HStack>
        </VStack>
      )}

      {syncStatus.length === 0 ? (
        <Box textAlign="center" py={8}>
          <Text color="gray.500">No sync activity found.</Text>
        </Box>
      ) : (
        <Box overflowX="auto">
          <Table size="sm">
            <Thead>
              <Tr>
                <Th>Type</Th>
                <Th>Status</Th>
                <Th>Records</Th>
                <Th>Started</Th>
                <Th>Duration</Th>
                <Th>Error</Th>
              </Tr>
            </Thead>
            <Tbody>
              {syncStatus.map((sync) => {
                const startTime = new Date(sync.started_at);
                const endTime = sync.completed_at ? new Date(sync.completed_at) : new Date();
                const duration = Math.round((endTime.getTime() - startTime.getTime()) / 1000);

                return (
                  <Tr key={sync.id}>
                    <Td>
                      <Text fontSize="sm" fontWeight="medium">
                        {getSyncTypeLabel(sync.sync_type)}
                      </Text>
                    </Td>
                    <Td>
                      <Badge colorScheme={getStatusColor(sync.status)} size="sm">
                        {sync.status}
                      </Badge>
                    </Td>
                    <Td>
                      <Text fontSize="sm">
                        {sync.records_processed} processed
                        {sync.records_failed > 0 && (
                          <Text as="span" color="red.500" ml={2}>
                            ({sync.records_failed} failed)
                          </Text>
                        )}
                      </Text>
                    </Td>
                    <Td fontSize="sm">{formatDate(sync.started_at)}</Td>
                    <Td fontSize="sm">{duration}s</Td>
                    <Td maxW="200px">
                      {sync.error_message ? (
                        <Text fontSize="xs" color="red.500" isTruncated title={sync.error_message}>
                          {sync.error_message}
                        </Text>
                      ) : (
                        <Text fontSize="xs" color="gray.400">-</Text>
                      )}
                    </Td>
                  </Tr>
                );
              })}
            </Tbody>
          </Table>
        </Box>
      )}

      <Box mt={4} p={3} bg="blue.50" borderRadius="md">
        <HStack spacing={2}>
          <InfoIcon color="blue.500" />
          <Text fontSize="sm" color="blue.700">
            Toast integration automatically syncs house account transactions in real-time via webhooks.
          </Text>
        </HStack>
      </Box>
    </Box>
  );
};

export default ToastSyncStatusCard; 