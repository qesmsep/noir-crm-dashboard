import React, { useState } from 'react';
import {
  Box,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Input,
  Select,
  Button,
  Text,
  useToast,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  FormControl,
  FormLabel,
  VStack,
  HStack,
  TableContainer,
} from '@chakra-ui/react';
import PropTypes from 'prop-types';

const MemberLedger = ({
  members,
  memberLedger,
  selectedMember,
  newTransaction,
  setNewTransaction,
  handleAddTransaction,
  transactionStatus,
  editingTransaction,
  setEditingTransaction,
  editTransactionForm,
  setEditTransactionForm,
  handleEditTransaction,
  handleUpdateTransaction,
  handleDeleteTransaction,
  fetchLedger,
  setSelectedTransactionMemberId,
  selectedTransactionMemberId,
  ledgerLoading,
  session
}) => {
  const [editingId, setEditingId] = useState(null);
  const [tempEditForm, setTempEditForm] = useState({});
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const toast = useToast();

  const formatDateLong = (dateString) => {
    if (!dateString) return null;
    // Prevent timezone shifts by treating as local date at midnight
    const datePart = dateString.includes('T') ? dateString.split('T')[0] : dateString;
    const date = new Date(`${datePart}T00:00:00`);
    if (isNaN(date)) return null;
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: '2-digit' });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const calculateBalance = () => {
    return (memberLedger || []).reduce((acc, t) => {
      // Payments increase credit, purchases decrease credit
      return acc + (t.type === 'payment' ? Number(t.amount) : -Number(t.amount));
    }, 0);
  };

  const handleStartEdit = (transaction) => {
    setEditingId(transaction.id);
    setTempEditForm({
      date: transaction.date,
      amount: Math.abs(transaction.amount),
      type: transaction.type,
      note: transaction.note,
      member_id: transaction.member_id
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setTempEditForm({});
  };

  const handleSaveEdit = async (transaction) => {
    try {
      await handleUpdateTransaction({
        ...transaction,
        ...tempEditForm
      });
      setEditingId(null);
      setTempEditForm({});
      // Refresh the ledger data after successful update
      await fetchLedger(selectedMember.account_id);
    } catch (error) {
      console.error('Error saving transaction:', error);
    }
  };

  const handleDelete = async (transaction) => {
    if (window.confirm('Are you sure you want to delete this transaction?')) {
      try {
        await handleDeleteTransaction(transaction.id);
        // Refresh the ledger data after successful deletion
        await fetchLedger(selectedMember.account_id);
      } catch (error) {
        console.error('Error deleting transaction:', error);
      }
    }
  };

  const handlePayBalance = async () => {
    if (!selectedMember?.account_id) {
      toast({
        title: 'Error',
        description: 'No account selected',
        status: 'error',
        duration: 3000,
      });
      return;
    }

    setIsProcessingPayment(true);
    try {
      const response = await fetch('/api/chargeBalance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          account_id: selectedMember.account_id,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to process payment');
      }

      toast({
        title: 'Payment Successful',
        description: 'The balance has been paid successfully',
        status: 'success',
        duration: 5000,
      });

      // Refresh the ledger to show the new payment
      await fetchLedger(selectedMember.account_id);
    } catch (error) {
      toast({
        title: 'Payment Failed',
        description: error.message,
        status: 'error',
        duration: 5000,
      });
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const balance = calculateBalance();

  return (
    <Box
      width="100%"
      position="relative"
      display="grid"
      gridTemplateColumns="1fr"
      gridGap={4}
      fontFamily="Montserrat, sans-serif"
    >
      <Box mb={0}>
        <HStack spacing={4} align="center" justify="center">
          <Box textAlign="center">
            <Text fontSize="lg" fontWeight="bold">
              {balance < 0 ? 'Balance Owed:' : 'Current Credit:'}
            </Text>
            <Text fontSize="2xl" color={balance < 0 ? 'red.500' : 'green.500'}>
              {formatCurrency(Math.abs(balance))}
            </Text>
          </Box>
          {balance < 0 && (
            <Button
              colorScheme="blue"
              size="md"
              isLoading={isProcessingPayment}
              onClick={handlePayBalance}
              fontFamily="Montserrat, sans-serif"
            >
              Pay Balance
            </Button>
          )}
        </HStack>
      </Box>

      <TableContainer 
        bg="#ecede8" 
        borderRadius="16px" 
        p={16} 
        mx={4}
        boxShadow="0 4px 16px rgba(53,53,53,0.5)"
      >
        <Table variant="simple" size="12px" width="90%">
          <Thead bg="#353535">
            <Tr>
              <Th px={10} py={5} borderRadius="16px"  margin={10} borderColor="gray.300" borderBottomWidth="1px" color="#ecede8" fontWeight="normal">
                Date
              </Th>
              <Th px={10} py={5} borderRadius="16px" margin={10} borderColor="gray.300" borderBottomWidth="1px" color="#ecede8" fontWeight="normal">
                Member
              </Th>
              <Th px={10} py={5}borderRadius="16px" borderColor="gray.300" borderBottomWidth="1px" color="#ecede8" fontWeight="normal">
                Description
              </Th>
              <Th px={6} py={5} borderRadius="16px" borderColor="gray.300" borderBottomWidth="1px" color="#ecede8" fontWeight="normal" isNumeric>
                Amount
              </Th>
              <Th px={6} py={5} borderRadius="16px" borderColor="gray.300" borderBottomWidth="1px" color="#ecede8" fontWeight="normal">
                Type
              </Th>
              <Th px={6} py={5}borderRadius="16px" borderColor="gray.300" borderBottomWidth="1px" color="#ecede8" fontWeight="normal">
                Actions
              </Th>
            </Tr>
          </Thead>
          <Tbody>
            {/* Add Transaction Row */}
            <Tr sx={{ height: '32px' }}>
              <Td px={6} py={10} padding={5} borderColor="gray.200" borderBottomWidth="1px" bg="#ecede8">
                <Input
                  type="date"
                  variant="filled"
                  bg="white"
                  size="sm"
                  value={newTransaction.date || new Date().toISOString().split('T')[0]}
                  onChange={e => setNewTransaction({ ...newTransaction, date: e.target.value })}
                  borderRadius="10px"
                  border="1px solid"
                  ml={-5}
                  borderColor="gray.300"
                  _focus={{ borderColor: '#A59480', boxShadow: '0 0 0 1px #A59480' }}
                />
              </Td>
              <Td px={6} py={10} padding={5} borderColor="gray.200" borderBottomWidth="1px" bg="#ecede8">
                <Select
                  variant="filled"
                  bg="white"
                  size="sm"
                  value={selectedTransactionMemberId}
                  onChange={e => setSelectedTransactionMemberId(e.target.value)}
                  placeholder="Select Member"
                  borderRadius="10px"
                  padding={5}
                  border="1px solid"
                  ml={-10}
                  borderColor="gray.300"
                  _focus={{ borderColor: '#A59480', boxShadow: '0 0 0 1px #A59480' }}
                  icon={<></>}
                >
                  {members.filter(m => m.account_id === selectedMember.account_id).map(m => (
                    <option key={m.member_id} value={m.member_id}>
                      {m.first_name} {m.last_name}
                    </option>
                  ))}
                </Select>
              </Td>
              <Td px={6} py={2} borderColor="gray.200" borderBottomWidth="1px" bg="#ecede8">
                <Input
                  placeholder="Note"
                  
                  variant="filled"
                  bg="white"
                  size="sm"
                  value={newTransaction.note || ''}
                  onChange={e => setNewTransaction({ ...newTransaction, note: e.target.value })}
                  borderRadius="10px"
                  width="95%"
                  padding={2}
                  ml={-5}
                  border="1px solid"
                  borderColor="gray.300"
                  _focus={{ borderColor: '#A59480', boxShadow: '0 0 0 1px #A59480' }}
                />
              </Td>
              <Td px={6} py={2} borderColor="gray.200" borderBottomWidth="1px" bg="#ecede8">
                <Input
                  type="number"
                  placeholder="Amount"
                  variant="filled"
                  bg="white"
                  size="sm"
                  value={newTransaction.amount || ''}
                  onChange={e => setNewTransaction({ ...newTransaction, amount: e.target.value })}
                  borderRadius="10px"
                  padding={2}
                  width="95%"
                  ml={-5}
                  border="1px solid"
                  borderColor="gray.300"
                  _focus={{ borderColor: '#A59480', boxShadow: '0 0 0 1px #A59480' }}
                />
              </Td>
              <Td px={6} py={2} borderColor="gray.200" borderBottomWidth="1px" bg="#ecede8">
                <Select
                  variant="filled"
                  bg="white"
                  size="sm"
                  value={newTransaction.type || ''}
                  onChange={e => setNewTransaction({ ...newTransaction, type: e.target.value })}
                  placeholder="Type"
                  borderRadius="10px"
                  padding={2}
                  width="95%"
                  ml={-5}
                  border="1px solid"
                  borderColor="gray.300"
                  _focus={{ borderColor: '#A59480', boxShadow: '0 0 0 1px #A59480' }}
                  icon={<></>}
                >
                  <option value="payment">Payment</option>
                  <option value="purchase">Purchase</option>
                </Select>
              </Td>
              <Td px={6} py={2} borderColor="gray.200" borderBottomWidth="1px" bg="#ecede8">
                <Button
                  size="md"
                  bg="#353535"
                  color="#ecede8"
                  _hover={{ bg: '#2a2a2a' }}
                  onClick={() => handleAddTransaction(selectedTransactionMemberId, selectedMember.account_id)}
                  isLoading={transactionStatus === 'loading'}
                  isDisabled={!selectedTransactionMemberId || !newTransaction.type || !newTransaction.amount}
                  borderRadius="lg"
                  px={6}
                  py={2}
                >
                  Add
                </Button>
              </Td>
            </Tr>

            {/* Ledger Rows */}
            {memberLedger && memberLedger.length > 0 ? (
              memberLedger.map((tx, idx) => {
                const member = members.find(m => m.member_id === tx.member_id);
                const isEditing = editingId === tx.id;

                return (
                  <Tr sx={{ height: '32px' }} key={tx.id || idx}>
                    <Td px={6} py={1} borderColor="gray.200" margin={0} borderBottomWidth="1px" bg="#ecede8">
                      {isEditing ? (
                        <Input
                          type="date"
                          variant="filled"
                          bg="white"
                          size="sm"
                          value={tempEditForm.date || ''}
                          onChange={e => setTempEditForm({ ...tempEditForm, date: e.target.value })}
                          borderRadius="md"
                          border="1px solid"
                          borderColor="gray.300"
                          _focus={{ borderColor: '#A59480', boxShadow: '0 0 0 1px #A59480' }}
                        />
                      ) : (
                        formatDateLong(tx.date)
                      )}
                    </Td>
                    <Td px={6} py={1} borderColor="gray.200" margin={0} borderBottomWidth="1px" bg="#ecede8">
                      {isEditing ? (
                        <Select
                          variant="filled"
                          bg="white"
                          size="sm"
                          value={tempEditForm.member_id || ''}
                          onChange={e => setTempEditForm({ ...tempEditForm, member_id: e.target.value })}
                          borderRadius="md"
                          border="1px solid"
                          borderColor="gray.300"
                          _focus={{ borderColor: '#A59480', boxShadow: '0 0 0 1px #A59480' }}
                          icon={<></>}
                        >
                          {members.filter(m => m.account_id === selectedMember.account_id).map(m => (
                            <option key={m.member_id} value={m.member_id}>
                              {m.first_name} {m.last_name}
                            </option>
                          ))}
                        </Select>
                      ) : (
                        member ? `${member.first_name} ${member.last_name}` : ''
                      )}
                    </Td>
                    <Td px={6} py={1} borderColor="gray.200" margin={0} borderBottomWidth="1px" bg="#ecede8">
                      {isEditing ? (
                        <Input
                          variant="filled"
                          bg="white"
                          size="sm"
                          value={tempEditForm.note || ''}
                          onChange={e => setTempEditForm({ ...tempEditForm, note: e.target.value })}
                          borderRadius="md"
                          border="1px solid"
                          borderColor="gray.300"
                          _focus={{ borderColor: '#A59480', boxShadow: '0 0 0 1px #A59480' }}
                        />
                      ) : (
                        tx.note
                      )}
                    </Td>
                    <Td px={6} py={1} borderColor="gray.200" margin={0} borderBottomWidth="1px" bg="#ecede8" isNumeric>
                      {isEditing ? (
                        <Input
                          type="number"
                          variant="filled"
                          bg="white"
                          size="sm"
                          value={tempEditForm.amount || ''}
                          onChange={e => setTempEditForm({ ...tempEditForm, amount: e.target.value })}
                          borderRadius="md"
                          border="1px solid"
                          borderColor="gray.300"
                          _focus={{ borderColor: '#A59480', boxShadow: '0 0 0 1px #A59480' }}
                        />
                      ) : (
                        <Text color={tx.type === 'payment' ? 'green.500' : 'red.500'}>
                          {formatCurrency(Number(tx.amount))}
                        </Text>
                      )}
                    </Td>
                    <Td px={6} py={1} borderColor="gray.200" margin={0} borderBottomWidth="1px" bg="#ecede8">
                      {isEditing ? (
                        <Select
                          variant="filled"
                          bg="white"
                          size="sm"
                          value={tempEditForm.type || ''}
                          onChange={e => setTempEditForm({ ...tempEditForm, type: e.target.value })}
                          borderRadius="md"
                          border="1px solid"
                          borderColor="gray.300"
                          _focus={{ borderColor: '#A59480', boxShadow: '0 0 0 1px #A59480' }}
                          icon={<></>}
                        >
                          <option value="payment">Payment</option>
                          <option value="purchase">Purchase</option>
                        </Select>
                      ) : (
                        tx.type === 'payment' ? 'Payment' : 'Purchase'
                      )}
                    </Td>
                    <Td px={6} py={1} borderColor="gray.200" margin={0} borderBottomWidth="1px" bg="#ecede8">
                      {isEditing ? (
                        <HStack spacing={2}>
                          <Button
                            size="md"
                            bg="#353535"
                            color="#ecede8"
                            _hover={{ bg: '#2a2a2a' }}
                            onClick={() => handleSaveEdit(tx)}
                            borderRadius="lg"
                            px={4}
                            py={2}
                          >
                            Save
                          </Button>
                          <Button
                            size="md"
                            bg="#353535"
                            color="#ecede8"
                            _hover={{ bg: '#2a2a2a' }}
                            variant="outline"
                            onClick={handleCancelEdit}
                            borderRadius="lg"
                            px={4}
                            py={2}
                          >
                            Cancel
                          </Button>
                          <Button
                            size="md"
                            bg="#353535"
                            color="#ecede8"
                            _hover={{ bg: '#2a2a2a' }}
                            variant="outline"
                            onClick={() => handleDelete(tx)}
                            borderRadius="lg"
                            px={4}
                            py={2}
                          >
                            Delete
                          </Button>
                        </HStack>
                      ) : (
                        <Button
                          size="md"
                          bg="#353535"
                          color="#ecede8"
                          _hover={{ bg: '#2a2a2a' }}
                          onClick={() => handleStartEdit(tx)}
                          borderRadius="lg"
                          px={4}
                          py={2}
                        >
                          Edit
                        </Button>
                      )}
                    </Td>
                  </Tr>
                );
              })
            ) : (
              <Tr>
                <Td px={6} py={1} borderColor="gray.200" margin={0} borderBottomWidth="1px" bg="#ecede8" colSpan={6} textAlign="center">No transactions found.</Td>
              </Tr>
            )}
          </Tbody>
        </Table>
      </TableContainer>

      {/* Edit Transaction Modal */}
      <Modal isOpen={!!editingTransaction} onClose={() => setEditingTransaction(null)}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Edit Transaction</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={1}>
              <FormControl>
                <FormLabel>Date</FormLabel>
                <Input
                  type="date"
                  value={editTransactionForm.date || ''}
                  onChange={e => setEditTransactionForm({ ...editTransactionForm, date: e.target.value })}
                />
              </FormControl>
              <FormControl>
                <FormLabel>Amount</FormLabel>
                <Input
                  type="number"
                  value={editTransactionForm.amount || ''}
                  onChange={e => setEditTransactionForm({ ...editTransactionForm, amount: e.target.value })}
                />
              </FormControl>
              <FormControl>
                <FormLabel>Type</FormLabel>
                <Select
                  value={editTransactionForm.type || ''}
                  onChange={e => setEditTransactionForm({ ...editTransactionForm, type: e.target.value })}
                >
                  <option value="payment">Payment</option>
                  <option value="purchase">Purchase</option>
                </Select>
              </FormControl>
              <FormControl>
                <FormLabel>Note</FormLabel>
                <Input
                  value={editTransactionForm.note || ''}
                  onChange={e => setEditTransactionForm({ ...editTransactionForm, note: e.target.value })}
                />
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={() => setEditingTransaction(null)}>
              Cancel
            </Button>
            <Button colorScheme="blue" onClick={handleUpdateTransaction}>
              Save Changes
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Refresh Button */}
      <Box display="flex" justifyContent="flex-end" mt={4}>
        <Button
          size="sm"
          bg="#353535"
          color="#ecede8"
          _hover={{ bg: '#2a2a2a' }}
          onClick={() => fetchLedger(selectedMember.account_id)}
          variant="outline"
        >
          Refresh
        </Button>
      </Box>
    </Box>
  );
};

MemberLedger.propTypes = {
  members: PropTypes.arrayOf(
    PropTypes.shape({
      member_id: PropTypes.string.isRequired,
      account_id: PropTypes.string.isRequired,
      first_name: PropTypes.string,
      last_name: PropTypes.string,
    })
  ).isRequired,
  memberLedger: PropTypes.array,
  selectedMember: PropTypes.object,
  newTransaction: PropTypes.object,
  setNewTransaction: PropTypes.func,
  handleAddTransaction: PropTypes.func,
  transactionStatus: PropTypes.string,
  editingTransaction: PropTypes.object,
  setEditingTransaction: PropTypes.func,
  editTransactionForm: PropTypes.object,
  setEditTransactionForm: PropTypes.func,
  handleEditTransaction: PropTypes.func,
  handleUpdateTransaction: PropTypes.func,
  handleDeleteTransaction: PropTypes.func,
  fetchLedger: PropTypes.func,
  setSelectedTransactionMemberId: PropTypes.func,
  selectedTransactionMemberId: PropTypes.string,
  ledgerLoading: PropTypes.bool,
  session: PropTypes.any,
};

export default MemberLedger; 