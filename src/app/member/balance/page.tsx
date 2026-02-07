"use client";

import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardBody,
  CardHeader,
  Container,
  Heading,
  Text,
  VStack,
  HStack,
  Badge,
  Spinner,
  Center,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  TableContainer,
  Icon,
} from '@chakra-ui/react';
import { ArrowUpIcon, ArrowDownIcon } from '@chakra-ui/icons';
import { useRouter } from 'next/navigation';
import { useMemberAuth } from '@/context/MemberAuthContext';
import MemberNav from '@/components/member/MemberNav';

export default function MemberBalancePage() {
  const router = useRouter();
  const { member, loading } = useMemberAuth();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(true);

  useEffect(() => {
    if (!loading && !member) {
      router.push('/member/login');
    } else if (member) {
      fetchTransactions();
    }
  }, [member, loading, router]);

  const fetchTransactions = async () => {
    try {
      const response = await fetch('/api/member/transactions', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setTransactions(data.transactions || []);
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoadingTransactions(false);
    }
  };

  if (loading || loadingTransactions) {
    return (
      <Center minH="100vh" bg="#ECEDE8">
        <Spinner size="xl" color="#A59480" />
      </Center>
    );
  }

  if (!member) {
    return null;
  }

  const formatAmount = (amount: number, type: string) => {
    const formatted = Math.abs(amount).toFixed(2);
    return type === 'credit' ? `+$${formatted}` : `-$${formatted}`;
  };

  return (
    <Box minH="100vh" bg="#ECEDE8" pb="80px">
      {/* Header */}
      <Box
        bg="white"
        borderBottom="1px solid"
        borderColor="#ECEAE5"
        position="sticky"
        top={0}
        zIndex={10}
      >
        <Container maxW="container.xl">
          <HStack justify="space-between" py={4}>
            <Box
              as="img"
              src="/images/noir-wedding-day.png"
              alt="Noir"
              h="32px"
              cursor="pointer"
              onClick={() => router.push('/member/dashboard')}
            />
          </HStack>
        </Container>
      </Box>

      {/* Main Content */}
      <Container maxW="container.xl" py={{ base: 4, md: 6, lg: 8 }}>
        <VStack spacing={6} align="stretch">
          {/* Header */}
          <Box>
            <Heading size="xl" color="#1F1F1F" mb={2}>
              Account Balance
            </Heading>
            <Text color="#5A5A5A">
              View your account balance and transaction history
            </Text>
          </Box>

          {/* Balance Summary Card */}
          <Card
            bg="white"
            borderRadius="16px"
            border="1px solid"
            borderColor="#ECEAE5"
            boxShadow="sm"
          >
            <CardHeader>
              <Heading size="md" color="#1F1F1F">
                Current Balance
              </Heading>
            </CardHeader>
            <CardBody>
              <VStack spacing={6} align="stretch">
                <Box>
                  <Text
                    fontSize="4xl"
                    fontWeight="bold"
                    color={(member.balance || 0) >= 0 ? '#4CAF50' : '#F44336'}
                  >
                    ${Math.abs(member.balance || 0).toFixed(2)}
                  </Text>
                  <Text fontSize="md" color="#5A5A5A">
                    {(member.balance || 0) >= 0 ? 'Credit' : 'Balance Due'}
                  </Text>
                </Box>

                <Box
                  bg="#F6F5F2"
                  p={4}
                  borderRadius="12px"
                >
                  <VStack align="stretch" spacing={3}>
                    <HStack justify="space-between">
                      <Text fontSize="sm" color="#5A5A5A">
                        Monthly Credit
                      </Text>
                      <Text fontSize="lg" fontWeight="medium" color="#1F1F1F">
                        ${(member.monthly_credit || 0).toFixed(2)}
                      </Text>
                    </HStack>
                    {member.credit_renewal_date && (
                      <HStack justify="space-between">
                        <Text fontSize="sm" color="#5A5A5A">
                          Next Renewal
                        </Text>
                        <Text fontSize="sm" fontWeight="medium" color="#1F1F1F">
                          {new Date(member.credit_renewal_date).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </Text>
                      </HStack>
                    )}
                  </VStack>
                </Box>

                {(member.balance || 0) < 0 && (
                  <Button
                    bg="#A59480"
                    color="white"
                    _hover={{ bg: '#8C7C6D' }}
                    size="lg"
                  >
                    Pay Balance
                  </Button>
                )}
              </VStack>
            </CardBody>
          </Card>

          {/* Transaction History Card */}
          <Card
            bg="white"
            borderRadius="16px"
            border="1px solid"
            borderColor="#ECEAE5"
            boxShadow="sm"
          >
            <CardHeader>
              <Heading size="md" color="#1F1F1F">
                Transaction History
              </Heading>
            </CardHeader>
            <CardBody>
              {transactions.length > 0 ? (
                <TableContainer>
                  <Table variant="simple" size="sm">
                    <Thead>
                      <Tr>
                        <Th color="#5A5A5A">Date</Th>
                        <Th color="#5A5A5A">Description</Th>
                        <Th color="#5A5A5A" isNumeric>Amount</Th>
                        <Th color="#5A5A5A" isNumeric>Balance</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {transactions.map((transaction, index) => (
                        <Tr key={transaction.id || index}>
                          <Td color="#5A5A5A" fontSize="sm">
                            {new Date(transaction.created_at).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </Td>
                          <Td>
                            <VStack align="flex-start" spacing={0}>
                              <Text fontSize="sm" color="#1F1F1F" fontWeight="medium">
                                {transaction.description || 'Transaction'}
                              </Text>
                              {transaction.notes && (
                                <Text fontSize="xs" color="#8C7C6D">
                                  {transaction.notes}
                                </Text>
                              )}
                            </VStack>
                          </Td>
                          <Td isNumeric>
                            <HStack justify="flex-end" spacing={1}>
                              <Icon
                                as={transaction.transaction_type === 'credit' ? ArrowUpIcon : ArrowDownIcon}
                                color={transaction.transaction_type === 'credit' ? '#4CAF50' : '#F44336'}
                                boxSize={3}
                              />
                              <Text
                                fontSize="sm"
                                fontWeight="medium"
                                color={transaction.transaction_type === 'credit' ? '#4CAF50' : '#F44336'}
                              >
                                {formatAmount(parseFloat(transaction.amount), transaction.transaction_type)}
                              </Text>
                            </HStack>
                          </Td>
                          <Td isNumeric>
                            <Text fontSize="sm" color="#1F1F1F" fontWeight="medium">
                              ${parseFloat(transaction.running_balance || 0).toFixed(2)}
                            </Text>
                          </Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                </TableContainer>
              ) : (
                <Center py={8}>
                  <VStack spacing={4}>
                    <Text color="#5A5A5A" textAlign="center">
                      No transactions yet
                    </Text>
                  </VStack>
                </Center>
              )}
            </CardBody>
          </Card>
        </VStack>
      </Container>

      {/* Bottom Navigation */}
      <MemberNav />
    </Box>
  );
}
