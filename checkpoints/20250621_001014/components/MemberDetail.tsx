import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  VStack,
  HStack,
  Text,
  Heading,
  Input,
  Select,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
  useToast,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  useDisclosure,
  FormControl,
  FormLabel,
  IconButton,
  Flex,
  Spacer,
  Divider,
} from '@chakra-ui/react';
import { AddIcon, DeleteIcon, EditIcon, ArrowBackIcon } from '@chakra-ui/icons';
import { supabase } from '../pages/api/supabaseClient';

interface Member {
  member_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  join_date: string;
  stripe_customer_id?: string;
  status?: string;
  photo?: string;
}

interface Transaction {
  id: string;
  amount: number;
  type: string;
  note: string;
  date: string;
}

interface Attribute {
  key: string;
  value: string;
  member_id: string;
}

interface Note {
  id: string;
  note: string;
  created_at: string;
}

interface MemberDetailProps {
  member: Member;
  ledger: Transaction[];
  ledgerLoading: boolean;
  onBack: () => void;
  onAddTransaction: (transaction: any) => void;
  newTransaction: any;
  setNewTransaction: (transaction: any) => void;
  transactionStatus: string;
  session: any;
  setMemberLedger: (ledger: Transaction[]) => void;
  fetchLedger: () => void;
  selectedMember: Member;
  onEditMember: (member: Member) => void;
}

const MemberDetail: React.FC<MemberDetailProps> = ({
  member,
  ledger,
  ledgerLoading,
  onBack,
  onAddTransaction,
  newTransaction,
  setNewTransaction,
  transactionStatus,
  session,
  setMemberLedger,
  fetchLedger,
  selectedMember,
  onEditMember,
}) => {
  const [linkingStripe, setLinkingStripe] = useState(false);
  const [linkResult, setLinkResult] = useState<{ status: string; stripeId?: string; error?: string } | null>(null);
  const [stripeData, setStripeData] = useState<any>(null);
  const [stripeLoading, setStripeLoading] = useState(false);
  const [stripeError, setStripeError] = useState<string | null>(null);
  const [charging, setCharging] = useState(false);
  const [chargeStatus, setChargeStatus] = useState<string | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [editTransactionForm, setEditTransactionForm] = useState({
    note: '',
    amount: '',
    type: '',
    date: ''
  });

  const [attributes, setAttributes] = useState<Attribute[]>([]);
  const [notes, setNotes] = useState('');
  const [notesLog, setNotesLog] = useState<Note[]>([]);
  const [newAttrKey, setNewAttrKey] = useState('');
  const [newAttrValue, setNewAttrValue] = useState('');

  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure();

  useEffect(() => {
    if (member?.member_id) {
      fetchAttributes();
      fetchNotesLog();
    }
  }, [member?.member_id]);

  const fetchAttributes = async () => {
    try {
      const res = await fetch(`/api/member_attributes?member_id=${member.member_id}`);
      const { data } = await res.json();
      setAttributes(data || []);
    } catch (error) {
      toast({
        title: 'Error fetching attributes',
        status: 'error',
        duration: 3000,
      });
    }
  };

  const fetchNotesLog = async () => {
    try {
      const res = await fetch(`/api/member_notes?member_id=${member.member_id}`);
      const { data } = await res.json();
      setNotesLog(data || []);
    } catch (error) {
      toast({
        title: 'Error fetching notes',
        status: 'error',
        duration: 3000,
      });
    }
  };

  const handleSaveAttributes = async () => {
    try {
      for (const attr of attributes) {
        await fetch('/api/member_attributes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ member_id: member.member_id, key: attr.key, value: attr.value }),
        });
      }
      toast({
        title: 'Attributes saved',
        status: 'success',
        duration: 3000,
      });
      fetchAttributes();
    } catch (error) {
      toast({
        title: 'Error saving attributes',
        status: 'error',
        duration: 3000,
      });
    }
  };

  const handleAddNote = async () => {
    if (!notes.trim()) return;
    try {
      await fetch('/api/member_notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_id: member.member_id, note: notes }),
      });
      setNotes('');
      fetchNotesLog();
      toast({
        title: 'Note added',
        status: 'success',
        duration: 3000,
      });
    } catch (error) {
      toast({
        title: 'Error adding note',
        status: 'error',
        duration: 3000,
      });
    }
  };

  const handleAddAttribute = async () => {
    if (!newAttrKey || !newAttrValue) return;
    try {
      await fetch('/api/member_attributes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_id: member.member_id, key: newAttrKey, value: newAttrValue }),
      });
      setNewAttrKey('');
      setNewAttrValue('');
      fetchAttributes();
      toast({
        title: 'Attribute added',
        status: 'success',
        duration: 3000,
      });
    } catch (error) {
      toast({
        title: 'Error adding attribute',
        status: 'error',
        duration: 3000,
      });
    }
  };

  const handleEditAttribute = async (attr: Attribute) => {
    onOpen();
    // Implementation for editing attribute
  };

  const handleDeleteAttribute = async (attr: Attribute) => {
    if (!window.confirm(`Delete attribute "${attr.key}"?`)) return;
    try {
      await supabase
        .from('member_attributes')
        .delete()
        .eq('member_id', attr.member_id);
      fetchAttributes();
      toast({
        title: 'Attribute deleted',
        status: 'success',
        duration: 3000,
      });
    } catch (error) {
      toast({
        title: 'Error deleting attribute',
        status: 'error',
        duration: 3000,
      });
    }
  };

  const handleEditNote = async (noteObj: Note) => {
    const updated = prompt('Edit note', noteObj.note);
    if (updated != null) {
      try {
        await fetch('/api/member_notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ member_id: member.member_id, note: updated, id: noteObj.id }),
        });
        fetchNotesLog();
        toast({
          title: 'Note updated',
          status: 'success',
          duration: 3000,
        });
      } catch (error) {
        toast({
          title: 'Error updating note',
          status: 'error',
          duration: 3000,
        });
      }
    }
  };

  const handleLinkStripe = async () => {
    setLinkingStripe(true);
    setLinkResult(null);
    try {
      const response = await fetch('/api/linkStripeCustomer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          member_id: member.member_id,
          first_name: member.first_name,
          last_name: member.last_name,
          email: member.email,
        }),
      });
      const result = await response.json();
      if (result.success) {
        setLinkResult({ status: 'success', stripeId: result.stripe_customer.id });
        toast({
          title: 'Stripe account linked',
          status: 'success',
          duration: 3000,
        });
      } else {
        setLinkResult({ status: 'error', error: result.error });
        toast({
          title: 'Error linking Stripe account',
          status: 'error',
          duration: 3000,
        });
      }
    } catch (error: unknown) {
      const err = error as Error;
      setLinkResult({ status: 'error', error: err.message });
      toast({
        title: 'Error linking Stripe account',
        status: 'error',
        duration: 3000,
      });
    }
    setLinkingStripe(false);
  };

  useEffect(() => {
    if (member?.stripe_customer_id) {
      setStripeLoading(true);
      fetch('/api/getStripeCustomer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stripe_customer_id: member.stripe_customer_id }),
      })
        .then((res) => res.json())
        .then((data) => {
          setStripeData(data);
          setStripeLoading(false);
        })
        .catch(() => {
          setStripeError('Error fetching Stripe info');
          setStripeLoading(false);
          toast({
            title: 'Error fetching Stripe info',
            status: 'error',
            duration: 3000,
          });
        });
    }
  }, [member?.stripe_customer_id]);

  if (!member) return null;

  const formatDateLong = (dateString: string) => {
    if (!dateString) return null;
    const datePart = dateString.includes('T') ? dateString.split('T')[0] : dateString;
    const date = new Date(`${datePart}T00:00:00`);
    if (isNaN(date.getTime())) return null;
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: '2-digit' });
  };

  const formatPhoneNumber = (phone: string) => {
    if (!phone) return '';
    const trimmed = phone.replace(/\s+/g, '');
    let digits = trimmed.replace(/\D/g, '');
    if (digits.length === 11 && digits.startsWith('1')) {
      digits = digits.slice(1);
    }
    if (digits.length === 10) {
      return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6,10)}`;
    }
    return phone.trim();
  };

  const handleDeleteMember = async (member_id: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: 'Not authenticated',
          status: 'error',
          duration: 3000,
        });
        return;
      }
      const res = await fetch('/api/deleteAuthUser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          member_id,
          requester_token: session.access_token
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast({
          title: 'Member deleted',
          status: 'success',
          duration: 3000,
        });
        if (typeof onBack === 'function') onBack();
      } else {
        toast({
          title: 'Failed to delete member',
          description: data.error || 'Unknown error',
          status: 'error',
          duration: 3000,
        });
      }
    } catch (error: unknown) {
      const err = error as Error;
      toast({
        title: 'Failed to delete member',
        description: err.message,
        status: 'error',
        duration: 3000,
      });
    }
  };

  const nextRenewal = (() => {
    if (!member.join_date) return 'N/A';
    const jd = new Date(member.join_date);
    const today = new Date();
    const nextYear = new Date(jd);
    nextYear.setFullYear(today.getFullYear() + 1);
    return formatDateLong(nextYear.toISOString());
  })();

  const handleUpdateTransaction = async (txId: string | undefined) => {
    if (!txId) return;
    try {
      await fetch(`/api/transactions/${txId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editTransactionForm),
      });
      setEditingTransaction(null);
      fetchLedger();
      toast({
        title: 'Transaction updated',
        status: 'success',
        duration: 3000,
      });
    } catch (error) {
      toast({
        title: 'Error updating transaction',
        status: 'error',
        duration: 3000,
      });
    }
  };

  return (
    <Box p={6} maxW="1200px" mx="auto">
      <VStack spacing={6} align="stretch">
        {/* Header */}
        <Flex justify="flex-end" align="center">
          <HStack>
            <Button
              colorScheme="red"
              variant="outline"
              onClick={() => handleDeleteMember(member.member_id)}
            >
              Delete Member
            </Button>
            <Button
              colorScheme="blue"
              onClick={() => onEditMember(member)}
            >
              Edit Member
            </Button>
          </HStack>
        </Flex>

        {/* Member Info */}
        <Box bg="white" p={6} borderRadius="12px" boxShadow="lg" border="3px solid #a59480">
          <HStack spacing={6} align="flex-start">
            {member.photo ? (
              <Box
                borderRadius="full"
                overflow="hidden"
                width="100px"
                height="100px"
                flexShrink={0}
                boxShadow="md"
                border="2px solid #F7FAFC"
              >
                <img
                  src={member.photo}
                  alt={`${member.first_name} ${member.last_name}`}
                  style={{ width: '100px', height: '100px', objectFit: 'cover' }}
                />
              </Box>
            ) : (
              <Box
                width="100px"
                height="100px"
                borderRadius="full"
                bg="#F7FAFC"
                display="flex"
                alignItems="center"
                justifyContent="center"
                flexShrink={0}
                boxShadow="md"
                border="2px solid #F7FAFC"
              >
                <Text fontSize="4xl" color="#A59480" fontWeight="bold">
                  {member.first_name?.[0]}{member.last_name?.[0]}
                </Text>
              </Box>
            )}
            <VStack align="flex-start" spacing={1} flex={1}>
              <Text
                fontSize="2xl"
                fontWeight="normal"
                color="#A59480"
                fontFamily="IvyJournalThin, serif"
                textTransform="uppercase"
                letterSpacing="0.05em"
              >
                {member.first_name} {member.last_name}
              </Text>
              <HStack spacing={2} color="gray.600">
                <Text fontSize="sm">{member.email}</Text>
              </HStack>
              <HStack spacing={2} color="gray.600">
                <Text fontSize="sm">{formatPhoneNumber(member.phone)}</Text>
              </HStack>
              <Text color="gray.600" fontSize="xs">
                Member since {formatDateLong(member.join_date)}
              </Text>
            </VStack>
          </HStack>
        </Box>

        {/* Attributes */}
        <Box bg="white" p={6} borderRadius="lg" boxShadow="sm">
          <VStack spacing={4} align="stretch">
            <Heading size="md">Attributes</Heading>
            <HStack>
              <Input
                placeholder="Key"
                value={newAttrKey}
                onChange={(e) => setNewAttrKey(e.target.value)}
              />
              <Input
                placeholder="Value"
                value={newAttrValue}
                onChange={(e) => setNewAttrValue(e.target.value)}
              />
              <Button
                leftIcon={<AddIcon />}
                onClick={handleAddAttribute}
                isDisabled={!newAttrKey || !newAttrValue}
              >
                Add
              </Button>
            </HStack>
            <VStack spacing={2} align="stretch">
              {attributes.map((attr) => (
                <Flex key={attr.key} justify="space-between" align="center">
                  <Text fontWeight="bold">{attr.key}:</Text>
                  <Text>{attr.value}</Text>
                  <HStack>
                    <IconButton
                      aria-label="Edit attribute"
                      icon={<EditIcon />}
                      size="sm"
                      onClick={() => handleEditAttribute(attr)}
                    />
                    <IconButton
                      aria-label="Delete attribute"
                      icon={<DeleteIcon />}
                      size="sm"
                      colorScheme="red"
                      onClick={() => handleDeleteAttribute(attr)}
                    />
                  </HStack>
                </Flex>
              ))}
            </VStack>
          </VStack>
        </Box>

        {/* Notes */}
        <Box bg="white" p={6} borderRadius="lg" boxShadow="sm">
          <VStack spacing={4} align="stretch">
            <Heading size="md">Notes</Heading>
            <HStack>
              <Input
                placeholder="Add a note..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
              <Button
                leftIcon={<AddIcon />}
                onClick={handleAddNote}
                isDisabled={!notes.trim()}
              >
                Add
              </Button>
            </HStack>
            <VStack spacing={2} align="stretch">
              {notesLog.map((note) => (
                <Box key={note.id} p={3} bg="gray.50" borderRadius="md">
                  <Flex justify="space-between" align="center">
                    <Text>{note.note}</Text>
                    <IconButton
                      aria-label="Edit note"
                      icon={<EditIcon />}
                      size="sm"
                      onClick={() => handleEditNote(note)}
                    />
                  </Flex>
                  <Text fontSize="sm" color="gray.500">
                    {formatDateLong(note.created_at)}
                  </Text>
                </Box>
              ))}
            </VStack>
          </VStack>
        </Box>
      </VStack>

      {/* Edit Transaction Modal */}
      <Modal isOpen={!!editingTransaction} onClose={() => setEditingTransaction(null)}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Edit Transaction</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4}>
              <FormControl>
                <FormLabel>Amount</FormLabel>
                <Input
                  value={editTransactionForm.amount}
                  onChange={(e) => setEditTransactionForm({ ...editTransactionForm, amount: e.target.value })}
                />
              </FormControl>
              <FormControl>
                <FormLabel>Type</FormLabel>
                <Select
                  value={editTransactionForm.type}
                  onChange={(e) => setEditTransactionForm({ ...editTransactionForm, type: e.target.value })}
                >
                  <option value="charge">Charge</option>
                  <option value="credit">Credit</option>
                </Select>
              </FormControl>
              <FormControl>
                <FormLabel>Note</FormLabel>
                <Input
                  value={editTransactionForm.note}
                  onChange={(e) => setEditTransactionForm({ ...editTransactionForm, note: e.target.value })}
                />
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={() => setEditingTransaction(null)}>
              Cancel
            </Button>
            <Button colorScheme="blue" onClick={() => handleUpdateTransaction(editingTransaction?.id)}>
              Save
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default MemberDetail; 