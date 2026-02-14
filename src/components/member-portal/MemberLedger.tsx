import React, { useState } from 'react';
import {
  Box,
  Card,
  CardBody,
  CardHeader,
  Heading,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Text,
  Badge,
  VStack,
  HStack,
  Button,
  Select,
  Input,
  InputGroup,
  InputLeftElement,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  Flex,
  Spacer,
  useColorModeValue,
} from '@chakra-ui/react';
import { SearchIcon } from '@chakra-ui/icons';
import { FiDownload, FiFilter } from 'react-icons/fi';

interface LedgerEntry {
  id: string;
  transaction_type: string;
  amount: number;
  description: string;
  transaction_date: string;
  balance_after: number;
  reference_id?: string;
  metadata?: any;
}

interface MemberLedgerProps {
  entries: LedgerEntry[];
}

const MemberLedger: React.FC<MemberLedgerProps> = ({ entries }) => {
  const [filteredEntries, setFilteredEntries] = useState(entries);
  const [filterType, setFilterType] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState('all');

  React.useEffect(() => {
    let filtered = [...entries];

    // Filter by transaction type
    if (filterType !== 'all') {
      filtered = filtered.filter(entry => entry.transaction_type === filterType);
    }

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(entry =>
        entry.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entry.reference_id?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by date range
    if (dateRange !== 'all') {
      const now = new Date();
      const cutoffDate = new Date();
      
      switch (dateRange) {
        case '30days':
          cutoffDate.setDate(now.getDate() - 30);
          break;
        case '90days':
          cutoffDate.setDate(now.getDate() - 90);
          break;
        case '1year':
          cutoffDate.setFullYear(now.getFullYear() - 1);
          break;
      }
      
      filtered = filtered.filter(entry => 
        new Date(entry.transaction_date) >= cutoffDate
      );
    }

    setFilteredEntries(filtered);
  }, [entries, filterType, searchTerm, dateRange]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getTransactionTypeColor = (type: string) => {
    switch (type) {
      case 'charge':
      case 'membership_fee':
        return 'red';
      case 'credit':
      case 'payment':
      case 'beverage_credit':
        return 'green';
      default:
        return 'gray';
    }
  };

  const getTransactionTypeLabel = (type: string) => {
    switch (type) {
      case 'charge':
        return 'Charge';
      case 'credit':
        return 'Credit';
      case 'payment':
        return 'Payment';
      case 'membership_fee':
        return 'Membership Fee';
      case 'beverage_credit':
        return 'Beverage Credit';
      default:
        return type.charAt(0).toUpperCase() + type.slice(1);
    }
  };

  const currentBalance = entries.length > 0 ? entries[0].balance_after : 0;
  const totalCredits = entries
    .filter(e => ['credit', 'payment', 'beverage_credit'].includes(e.transaction_type))
    .reduce((sum, e) => sum + e.amount, 0);
  const totalDebits = entries
    .filter(e => ['charge', 'membership_fee'].includes(e.transaction_type))
    .reduce((sum, e) => sum + e.amount, 0);

  const exportToCSV = () => {
    const csvData = [
      ['Date', 'Type', 'Description', 'Amount', 'Balance'],
      ...filteredEntries.map(entry => [
        formatDate(entry.transaction_date),
        getTransactionTypeLabel(entry.transaction_type),
        entry.description,
        `${['charge', 'membership_fee'].includes(entry.transaction_type) ? '-' : '+'}${entry.amount}`,
        entry.balance_after
      ])
    ];

    const csvContent = csvData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `noir-ledger-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <VStack spacing={6} align="stretch">
      {/* Account Summary */}
      <Card bg="#28251F" borderColor="#3A362F" borderWidth={1}>
        <CardHeader>
          <Heading size="md" color="#ECEDE8">Account Summary</Heading>
        </CardHeader>
        <CardBody>
          <HStack spacing={8} justify="space-around">
            <Stat>
              <StatLabel color="#BCA892">Current Balance</StatLabel>
              <StatNumber color="#ECEDE8" fontSize="2xl">
                {formatCurrency(currentBalance)}
              </StatNumber>
              <StatHelpText color="#BCA892">
                As of {entries.length > 0 ? formatDate(entries[0].transaction_date) : 'N/A'}
              </StatHelpText>
            </Stat>
            
            <Stat>
              <StatLabel color="#BCA892">Total Credits</StatLabel>
              <StatNumber color="green.400" fontSize="xl">
                {formatCurrency(totalCredits)}
              </StatNumber>
            </Stat>
            
            <Stat>
              <StatLabel color="#BCA892">Total Charges</StatLabel>
              <StatNumber color="red.400" fontSize="xl">
                {formatCurrency(totalDebits)}
              </StatNumber>
            </Stat>
          </HStack>
        </CardBody>
      </Card>

      {/* Filters and Search */}
      <Card bg="#28251F" borderColor="#3A362F" borderWidth={1}>
        <CardBody>
          <Flex direction={{ base: 'column', md: 'row' }} gap={4} align="end">
            <Box flex={1}>
              <Text color="#BCA892" fontSize="sm" mb={2}>Search</Text>
              <InputGroup>
                <InputLeftElement>
                  <SearchIcon color="#BCA892" />
                </InputLeftElement>
                <Input
                  placeholder="Search transactions..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  bg="white"
                  color="black"
                />
              </InputGroup>
            </Box>
            
            <Box>
              <Text color="#BCA892" fontSize="sm" mb={2}>Type</Text>
              <Select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                bg="white"
                color="black"
                w="200px"
              >
                <option value="all">All Types</option>
                <option value="charge">Charges</option>
                <option value="credit">Credits</option>
                <option value="payment">Payments</option>
                <option value="membership_fee">Membership Fees</option>
                <option value="beverage_credit">Beverage Credits</option>
              </Select>
            </Box>
            
            <Box>
              <Text color="#BCA892" fontSize="sm" mb={2}>Period</Text>
              <Select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                bg="white"
                color="black"
                w="200px"
              >
                <option value="all">All Time</option>
                <option value="30days">Last 30 Days</option>
                <option value="90days">Last 90 Days</option>
                <option value="1year">Last Year</option>
              </Select>
            </Box>
            
            <Button
              leftIcon={<FiDownload />}
              onClick={exportToCSV}
              colorScheme="orange"
              variant="outline"
              isDisabled={filteredEntries.length === 0}
            >
              Export
            </Button>
          </Flex>
        </CardBody>
      </Card>

      {/* Transaction History */}
      <Card bg="#28251F" borderColor="#3A362F" borderWidth={1}>
        <CardHeader>
          <Flex align="center">
            <Heading size="md" color="#ECEDE8">Transaction History</Heading>
            <Spacer />
            <Text color="#BCA892" fontSize="sm">
              {filteredEntries.length} of {entries.length} transactions
            </Text>
          </Flex>
        </CardHeader>
        <CardBody p={0}>
          {filteredEntries.length === 0 ? (
            <Box p={8} textAlign="center">
              <Text color="#BCA892">No transactions found</Text>
            </Box>
          ) : (
            <Box overflowX="auto">
              <Table variant="simple">
                <Thead>
                  <Tr>
                    <Th color="#BCA892" borderColor="#3A362F">Date</Th>
                    <Th color="#BCA892" borderColor="#3A362F">Type</Th>
                    <Th color="#BCA892" borderColor="#3A362F">Description</Th>
                    <Th color="#BCA892" borderColor="#3A362F" isNumeric>Amount</Th>
                    <Th color="#BCA892" borderColor="#3A362F" isNumeric>Balance</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {filteredEntries.map((entry) => (
                    <Tr key={entry.id} _hover={{ bg: '#23201C' }}>
                      <Td color="#ECEDE8" borderColor="#3A362F">
                        {formatDate(entry.transaction_date)}
                      </Td>
                      <Td borderColor="#3A362F">
                        <Badge
                          colorScheme={getTransactionTypeColor(entry.transaction_type)}
                          variant="subtle"
                        >
                          {getTransactionTypeLabel(entry.transaction_type)}
                        </Badge>
                      </Td>
                      <Td color="#ECEDE8" borderColor="#3A362F">
                        <VStack align="start" spacing={1}>
                          <Text>{entry.description}</Text>
                          {entry.reference_id && (
                            <Text fontSize="xs" color="#BCA892">
                              Ref: {entry.reference_id}
                            </Text>
                          )}
                        </VStack>
                      </Td>
                      <Td
                        borderColor="#3A362F"
                        isNumeric
                        color={
                          ['charge', 'membership_fee'].includes(entry.transaction_type)
                            ? 'red.400'
                            : 'green.400'
                        }
                        fontWeight="semibold"
                      >
                        {['charge', 'membership_fee'].includes(entry.transaction_type) ? '-' : '+'}
                        {formatCurrency(entry.amount)}
                      </Td>
                      <Td color="#ECEDE8" borderColor="#3A362F" isNumeric fontWeight="medium">
                        {formatCurrency(entry.balance_after)}
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </Box>
          )}
        </CardBody>
      </Card>
    </VStack>
  );
};

export default MemberLedger;