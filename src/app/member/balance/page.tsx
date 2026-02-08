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
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  Image,
} from '@chakra-ui/react';
import { ArrowUpIcon, ArrowDownIcon } from '@chakra-ui/icons';
import { useRouter } from 'next/navigation';
import { useMemberAuth } from '@/context/MemberAuthContext';
import MemberNav from '@/components/member/MemberNav';
import { Receipt } from 'lucide-react';
import { useToast } from '@chakra-ui/react';

export default function MemberBalancePage() {
  const router = useRouter();
  const { member, loading } = useMemberAuth();
  const { toast } = useToast();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(true);
  const [selectedTransaction, setSelectedTransaction] = useState<any | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

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

  const handlePayBalance = async () => {
    if (!member?.account_id) return;

    setIsProcessingPayment(true);
    try {
      const response = await fetch('/api/chargeBalance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          account_id: member.account_id,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to process payment');
      }

      toast({
        title: 'Payment Successful',
        description: 'Your balance has been paid successfully',
        status: 'success',
        duration: 5000,
        isClosable: true,
      });

      // Refresh transactions to show the new payment
      await fetchTransactions();
    } catch (error: any) {
      toast({
        title: 'Payment Failed',
        description: error.message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // Calculate current balance from most recent transaction's running balance
  const currentBalance = transactions.length > 0
    ? parseFloat(transactions[0].running_balance || 0)
    : (member?.balance || 0);

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
      {/* Header - Hidden on mobile */}
      <Box
        bg="white"
        borderBottom="1px solid"
        borderColor="#ECEAE5"
        position="sticky"
        top={0}
        zIndex={10}
        display={{ base: 'none', md: 'block' }}
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
          {/* Page Title */}
          <Box>
            <Heading size="xl" color="#1F1F1F" mb={2} fontFamily="CONEBARS">
              Welcome back, {member.first_name}
            </Heading>
          </Box>

          {/* Balance Summary Card */}
          <Card
            bg="white"
            borderRadius="12px"
            border="1px solid"
            borderColor="#ECEAE5"
            boxShadow="sm"
          >
            <CardBody p={{ base: 4, md: 5 }}>
              <HStack justify="space-between" align="center">
                <Box>
                  <Text fontSize="sm" color="#5A5A5A" mb={1}>
                    Current Balance
                  </Text>
                  <Text
                    fontSize="2xl"
                    fontWeight="bold"
                    color={currentBalance >= 0 ? '#4CAF50' : '#F44336'}
                  >
                    ${Math.abs(currentBalance).toFixed(2)}
                  </Text>
                </Box>
                {currentBalance < 0 && (
                  <Button
                    variant="outline"
                    borderColor="#DAD7D0"
                    color="#5A5A5A"
                    _hover={{ borderColor: '#A59480', color: '#A59480', bg: '#F6F5F2' }}
                    size="sm"
                    px={3}
                    isLoading={isProcessingPayment}
                    onClick={handlePayBalance}
                  >
                    Pay Balance
                  </Button>
                )}
              </HStack>
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
                <>
                  {/* Desktop Table View */}
                  <TableContainer display={{ base: 'none', md: 'block' }}>
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

                  {/* Mobile Card View */}
                  <VStack spacing={2} display={{ base: 'flex', md: 'none' }}>
                    {transactions.map((transaction, index) => (
                      <Box
                        key={transaction.id || index}
                        p={3}
                        borderRadius="8px"
                        border="1px solid"
                        borderColor="#ECEAE5"
                        bg="#FBFBFA"
                        w="full"
                        cursor={transaction.attachment_count > 0 ? 'pointer' : 'default'}
                        _hover={transaction.attachment_count > 0 ? { bg: '#F6F5F2', borderColor: '#A59480' } : {}}
                        onClick={() => {
                          if (transaction.attachment_count > 0) {
                            setSelectedTransaction(transaction);
                          }
                        }}
                      >
                        <VStack align="stretch" spacing={2}>
                          <HStack justify="space-between" align="center">
                            <HStack spacing={2}>
                              <Text fontSize="xs" color="#8C7C6D">
                                {new Date(transaction.created_at).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                })}
                              </Text>
                              {transaction.attachment_count > 0 && (
                                <HStack spacing={1} color="#8C7C6D">
                                  <Receipt size={12} strokeWidth={2.5} />
                                  <Text fontSize="xs" fontWeight="medium">
                                    Receipt
                                  </Text>
                                </HStack>
                              )}
                            </HStack>
                            <Text
                              fontSize="md"
                              fontWeight="bold"
                              color={transaction.transaction_type === 'credit' ? '#4CAF50' : '#F44336'}
                            >
                              {formatAmount(parseFloat(transaction.amount), transaction.transaction_type)}
                            </Text>
                          </HStack>
                          <Text fontSize="sm" color="#1F1F1F" fontWeight="medium">
                            {transaction.description || 'Transaction'}
                          </Text>
                        </VStack>
                      </Box>
                    ))}
                  </VStack>
                </>
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

      {/* Attachment Modal */}
      <Modal
        isOpen={!!selectedTransaction}
        onClose={() => setSelectedTransaction(null)}
        size="xl"
      >
        <ModalOverlay bg="blackAlpha.700" />
        <ModalContent bg="white" borderRadius="16px" mx={4}>
          <ModalHeader color="#1F1F1F" borderBottom="1px solid" borderColor="#ECEAE5">
            Transaction Attachments
          </ModalHeader>
          <ModalCloseButton color="#5A5A5A" />
          <ModalBody p={4}>
            {selectedTransaction && selectedTransaction.attachments && selectedTransaction.attachments.length > 0 ? (
              <VStack spacing={4} align="stretch">
                {selectedTransaction.attachments.map((attachment: any, index: number) => (
                  <Box key={attachment.id || index}>
                    {attachment.file_type?.startsWith('image/') ? (
                      <Image
                        src={attachment.file_url}
                        alt={attachment.file_name || 'Attachment'}
                        borderRadius="8px"
                        maxW="100%"
                        border="1px solid"
                        borderColor="#ECEAE5"
                      />
                    ) : (
                      <Box
                        p={4}
                        bg="#F6F5F2"
                        borderRadius="8px"
                        border="1px solid"
                        borderColor="#ECEAE5"
                      >
                        <HStack justify="space-between">
                          <VStack align="flex-start" spacing={1}>
                            <Text fontSize="sm" fontWeight="medium" color="#1F1F1F">
                              {attachment.file_name || 'Document'}
                            </Text>
                            <Text fontSize="xs" color="#8C7C6D">
                              {attachment.file_type || 'Unknown type'}
                            </Text>
                          </VStack>
                          <Button
                            as="a"
                            href={attachment.file_url}
                            target="_blank"
                            size="sm"
                            bg="#A59480"
                            color="white"
                            _hover={{ bg: '#8C7C6D' }}
                          >
                            View
                          </Button>
                        </HStack>
                      </Box>
                    )}
                  </Box>
                ))}
              </VStack>
            ) : (
              <Center py={8}>
                <Text color="#5A5A5A">No attachments found</Text>
              </Center>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>
    </Box>
  );
}
