import React, { useState, useEffect } from 'react';
import {
  Box,
  Heading,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Spinner,
  Text,
  Badge,
  useToast,
  VStack,
  HStack,
  Button,
  IconButton
} from '@chakra-ui/react';
import { ExternalLinkIcon, RepeatIcon } from '@chakra-ui/icons';

interface ToastTransaction {
  id: string;
  toast_transaction_id: string;
  toast_order_id?: string;
  amount: number;
  transaction_date: string;
  items?: any[];
  payment_method?: string;
  server_name?: string;
  table_number?: string;
  status: string;
  members?: {
    first_name: string;
    last_name: string;
    phone: string;
  };
}

interface ToastTransactionsSectionProps {
  memberId: string;
  memberName: string;
}

const ToastTransactionsSection: React.FC<ToastTransactionsSectionProps> = ({ 
  memberId, 
  memberName 
}) => {
  const [transactions, setTransactions] = useState<ToastTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const toast = useToast();

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/toast-transactions?member_id=${memberId}&limit=20`);
      if (!response.ok) {
        throw new Error('Failed to fetch transactions');
      }
      const data = await response.json();
      setTransactions(data.transactions || []);
    } catch (error) {
      console.error('Error fetching Toast transactions:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch Toast transactions',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchTransactions();
    setRefreshing(false);
  };

  useEffect(() => {
    fetchTransactions();
  }, [memberId]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatItems = (items: any[]) => {
    if (!items || items.length === 0) return 'House account purchase';
    return items.map((item: any) => item.name || item.description).join(', ');
  };

  if (loading) {
    return (
      <Box>
        <Heading size="md" mb={4}>Toast House Account Activity</Heading>
        <VStack spacing={4} align="center" py={8}>
          <Spinner size="lg" />
          <Text>Loading Toast transactions...</Text>
        </VStack>
      </Box>
    );
  }

  return (
    <Box>
      <HStack justify="space-between" mb={4}>
        <Heading size="md">Toast House Account Activity</Heading>
        <IconButton
          aria-label="Refresh transactions"
          icon={<RepeatIcon />}
          size="sm"
          onClick={handleRefresh}
          isLoading={refreshing}
        />
      </HStack>

      {transactions.length === 0 ? (
        <Box p={6} textAlign="center">
          <Text color="gray.500">No Toast transactions found for this member.</Text>
        </Box>
      ) : (
        <Box overflowX="auto">
          <Table size="sm">
            <Thead>
              <Tr>
                <Th>Date</Th>
                <Th>Amount</Th>
                <Th>Items</Th>
                <Th>Server</Th>
                <Th>Table</Th>
                <Th>Status</Th>
              </Tr>
            </Thead>
            <Tbody>
              {transactions.map((tx) => (
                <Tr key={tx.id}>
                  <Td>{formatDate(tx.transaction_date)}</Td>
                  <Td fontWeight="bold">{formatCurrency(tx.amount)}</Td>
                  <Td maxW="200px" isTruncated title={formatItems(tx.items || [])}>
                    {formatItems(tx.items || [])}
                  </Td>
                  <Td>{tx.server_name || '-'}</Td>
                  <Td>{tx.table_number || '-'}</Td>
                  <Td>
                    <Badge 
                      colorScheme={tx.status === 'completed' ? 'green' : 'yellow'}
                      size="sm"
                    >
                      {tx.status}
                    </Badge>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Box>
      )}

      {transactions.length > 0 && (
        <Box mt={4} textAlign="center">
          <Text fontSize="sm" color="gray.500">
            Showing {transactions.length} most recent transactions
          </Text>
        </Box>
      )}
    </Box>
  );
};

export default ToastTransactionsSection; 