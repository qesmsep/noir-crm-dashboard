import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Box, Spinner, Text, Button, SimpleGrid, VStack, Heading, HStack, Input, useToast } from "@chakra-ui/react";
import { supabase } from "../../api/supabaseClient";
import MemberDetail from "../../../components/MemberDetail";
import MemberLedger from "../../../components/pages/MemberLedger";
import AddMemberModal from '../../../components/members/AddMemberModal';
import SendMessageForm from '../../../components/messages/SendMessageForm';
import AdminLayout from '../../../components/layouts/AdminLayout';
import { EmailIcon, PhoneIcon, CalendarIcon } from "@chakra-ui/icons";
import { FaBriefcase, FaUser } from 'react-icons/fa';

interface Member {
  member_id: string;
  account_id: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  photo?: string;
  join_date?: string;
  primary?: boolean;
  dob?: string;
  company?: string;
  referred_by?: string;
  next_renewal?: string;
}

interface Message {
  id: string;
  member_id: string;
  account_id: string;
  content: string;
  direction: 'inbound' | 'outbound';
  status: 'sent' | 'failed' | 'pending';
  phone_number: string;
  error_message?: string;
  created_at: string;
  members?: {
    first_name: string;
    last_name: string;
    phone_number: string;
  };
}

interface Attribute {
  id: string;
  key: string;
  value: string;
  created_at: string;
}

function sortMembers(members: any[]) {
  return [...members].sort((a, b) => {
    if (a.primary && !b.primary) return -1;
    if (!a.primary && b.primary) return 1;
    return 0;
  });
}

export default function MemberDetailAdmin() {
  const router = useRouter();
  const { accountId } = router.query;
  const [members, setMembers] = useState<Member[]>([]);
  const [ledger, setLedger] = useState<any[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [ledgerLoading, setLedgerLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddMemberOpen, setAddMemberOpen] = useState(false);
  const [newTransaction, setNewTransaction] = useState<any>({});
  const [transactionStatus, setTransactionStatus] = useState<string>('');
  const [editingTransaction, setEditingTransaction] = useState<any>(null);
  const [editTransactionForm, setEditTransactionForm] = useState<any>({});
  const [selectedTransactionMemberId, setSelectedTransactionMemberId] = useState<string>('');
  const toast = useToast();
  const [attributes, setAttributes] = useState<Attribute[]>([]);
  const [attrType, setAttrType] = useState("");
  const [attrValue, setAttrValue] = useState("");
  const [editingAttrId, setEditingAttrId] = useState<string | null>(null);
  const [editingAttrType, setEditingAttrType] = useState("");
  const [editingAttrValue, setEditingAttrValue] = useState("");

  useEffect(() => {
    if (!accountId) return;
    async function fetchMembers() {
      try {
        const { data, error } = await supabase
          .from('members')
          .select('*')
          .eq('account_id', accountId);
        if (error) throw error;
        setMembers(sortMembers(data || []));
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchMembers();
  }, [accountId]);

  const fetchLedger = async (accountId: string) => {
    setLedgerLoading(true);
    try {
      const res = await fetch(`/api/ledger?account_id=${accountId}`);
      const result = await res.json();
      if (result.error) throw new Error(result.error);
      setLedger(result.data || []);
    } catch (err) {
      console.error('Ledger fetch error:', err);
      toast({
        title: 'Error fetching ledger',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setLedgerLoading(false);
    }
  };

  useEffect(() => {
    if (!accountId) return;
    fetchLedger(accountId as string);
  }, [accountId]);

  const handleAddTransaction = async (memberId: string, accountId: string) => {
    if (!newTransaction.type || !newTransaction.amount) {
      toast({
        title: 'Missing required fields',
        description: 'Please fill in all required fields',
        status: 'error',
        duration: 3000,
      });
      return;
    }

    setTransactionStatus('loading');
    try {
      const response = await fetch('/api/ledger', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          member_id: memberId,
          account_id: accountId,
          type: newTransaction.type,
          amount: newTransaction.amount,
          note: newTransaction.note,
          date: newTransaction.date || new Date().toISOString().split('T')[0],
        }),
      });

      const result = await response.json();
      if (result.error) throw new Error(result.error);

      // Clear the form
      setNewTransaction({});
      setSelectedTransactionMemberId('');
      
      // Refresh the ledger
      await fetchLedger(accountId);

      toast({
        title: 'Transaction added',
        status: 'success',
        duration: 3000,
      });
    } catch (err: any) {
      toast({
        title: 'Error adding transaction',
        description: err.message,
        status: 'error',
        duration: 3000,
      });
    } finally {
      setTransactionStatus('');
    }
  };

  const handleEditTransaction = (transaction: any) => {
    setEditingTransaction(transaction);
    setEditTransactionForm({
      note: transaction.note,
      amount: Math.abs(transaction.amount),
      type: transaction.type,
      date: transaction.date,
    });
  };

  const handleUpdateTransaction = async (tx: { id: string; type: string; amount: number; note?: string; date?: string }) => {
    const { id, type, amount, note, date } = tx;
    let amt = amount;
    if (type === 'purchase') amt = -Math.abs(amount);
    try {
      const response = await fetch('/api/ledger', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, type, amount: amt, note, date }),
      });
      const result = await response.json();
      if (result.error) throw new Error(result.error);
      setEditingTransaction(null);
      setEditTransactionForm({});
      await fetchLedger(accountId as string);
      toast({ title: 'Transaction updated', status: 'success', duration: 3000 });
    } catch (err: any) {
      toast({ title: 'Error updating transaction', description: err.message, status: 'error', duration: 3000 });
    }
  };
  const handleDeleteTransaction = async (id: string) => {
    try {
      const response = await fetch('/api/ledger', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const result = await response.json();
      if (result.error) throw new Error(result.error);
      await fetchLedger(accountId as string);
      toast({ title: 'Transaction deleted', status: 'success', duration: 3000 });
    } catch (err: any) {
      toast({ title: 'Error deleting transaction', description: err.message, status: 'error', duration: 3000 });
    }
  };

  useEffect(() => {
    if (!accountId) return;
    async function fetchMessages() {
      setMessagesLoading(true);
      try {
        const res = await fetch(`/api/messages?account_id=${accountId}`);
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        const result = await res.json();
        if (result.error) {
          throw new Error(result.error);
        }
        setMessages(result.messages || []);
      } catch (err) {
        console.error('Messages fetch error:', err);
        toast({
          title: 'Error fetching messages',
          description: err instanceof Error ? err.message : 'Failed to fetch messages',
          status: 'error',
          duration: 5000,
        });
        setMessages([]);
      } finally {
        setMessagesLoading(false);
      }
    }
    fetchMessages();
  }, [accountId, toast]);

  useEffect(() => {
    if (!members.length) return;
    const member_id = members[0].member_id;
    async function fetchAttributes() {
      const res = await fetch(`/api/member_attributes?member_id=${member_id}`);
      const result = await res.json();
      setAttributes(result.data || []);
    }
    fetchAttributes();
  }, [members]);

  const handleAddAttribute = async () => {
    if (!attrType) {
      toast({ title: 'Attribute type required', status: 'error', duration: 2000 });
      return;
    }
    const member_id = members[0].member_id;
    const res = await fetch('/api/member_attributes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ member_id, key: attrType, value: attrValue }),
    });
    const result = await res.json();
    if (result.error) {
      toast({ title: 'Error adding attribute', description: result.error, status: 'error', duration: 3000 });
    } else {
      setAttrType("");
      setAttrValue("");
      setAttributes(result.data || []);
      toast({ title: 'Attribute added', status: 'success', duration: 2000 });
    }
  };

  const handleEditClick = (attr: any) => {
    setEditingAttrId(attr.id);
    setEditingAttrType(attr.key);
    setEditingAttrValue(attr.value);
  };

  const handleSaveEdit = async () => {
    if (!editingAttrType) {
      toast({ title: 'Attribute type required', status: 'error', duration: 2000 });
      return;
    }
    const member_id = members[0].member_id;
    const res = await fetch('/api/member_attributes', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editingAttrId, member_id, key: editingAttrType, value: editingAttrValue }),
    });
    const result = await res.json();
    if (result.error) {
      toast({ title: 'Error updating attribute', description: result.error, status: 'error', duration: 3000 });
    } else {
      setEditingAttrId(null);
      setEditingAttrType("");
      setEditingAttrValue("");
      setAttributes(result.data || []);
      toast({ title: 'Attribute updated', status: 'success', duration: 2000 });
    }
  };

  const handleCancelEdit = () => {
    setEditingAttrId(null);
    setEditingAttrType("");
    setEditingAttrValue("");
  };

  const handleDeleteAttribute = async () => {
    if (!editingAttrId) return;
    if (!window.confirm('Delete this attribute?')) return;
    const res = await fetch('/api/member_attributes', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editingAttrId }),
    });
    const result = await res.json();
    if (result.error) {
      toast({ title: 'Error deleting attribute', description: result.error, status: 'error', duration: 3000 });
    } else {
      setEditingAttrId(null);
      setEditingAttrType("");
      setEditingAttrValue("");
      setAttributes(result.data || []);
      toast({ title: 'Attribute deleted', status: 'success', duration: 2000 });
    }
  };

  function formatPhone(phone?: string) {
    if (!phone) return '';
    // Always use last 10 digits, and always return (123) 456-7890 format if possible
    const cleaned = phone.replace(/\D/g, '').slice(-10);
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
  }

  if (loading) {
    return <Box p={8} display="flex" justifyContent="center"><Spinner size="xl" /></Box>;
  }
  if (error) {
    return <Box p={8}><Text color="red.500">Error: {error}</Text></Box>;
  }
  if (!members.length) {
    return <Box p={8}><Text>No members found for this account.</Text></Box>;
  }

  return (
    <AdminLayout>
      <Box p={8}>
        <Button mb={6} onClick={() => router.push('/admin/members')}
          bg="#A59480"
          color="white"
          borderRadius="12px"
          fontWeight="semibold"
          fontSize="md"
          _hover={{ bg: '#8B7B68' }}
        >Back to Members</Button>
        <Button mb={6} onClick={() => setAddMemberOpen(true)}
          bg="#A59480"
          color="white"
          borderRadius="12px"
          fontWeight="semibold"
          fontSize="md"
          _hover={{ bg: '#8B7B68' }}
        >Add New Member</Button>
        <AddMemberModal isOpen={isAddMemberOpen} onClose={() => setAddMemberOpen(false)} onSave={async (memberData: any) => {
          setAddMemberOpen(false);
        }} />
        <SimpleGrid columns={2} spacing={8} mb={10} mt={120} minChildWidth="600px">
          {members.map(member => (
            <Box key={member.member_id} minH="540px" display="flex" flexDirection="column" alignItems="center" bg="transparent" borderRadius="16px" boxShadow="none" p={0} fontFamily="Montserrat, sans-serif" position="relative">
              {/* Profile Card Box */}
              <Box position="relative" bg="#a59480" borderRadius="24px" boxShadow="0 4px 16px rgba(53,53,53,0.5)" p={15} pb="90px" pt="90px" w="100%" maxW="600px" display="flex" flexDirection="column" alignItems="center">
                {/* Photo as background, floating above card */}
                <Box
                  position="absolute"
                  top="-84px"
                  left="50%"
                  transform="translateX(-50%)"
                  zIndex={2}
                  borderRadius="100"
                  border="2px solid white"
                  overflow="hidden"
                  width="200px"
                  height="200px"
                  boxShadow="0 2px 8px rgba(0,0,0,0.50)"
                  bg="#fff"
                >
                  {member.photo ? (
                    <img src={member.photo} alt={`${member.first_name} ${member.last_name}`} style={{ width: '200px', height: '200px', objectFit: 'cover' }} />
                  ) : (
                    <Box width="140px"  height="140px" display="flex" alignItems="center" justifyContent="center" bg="#F7FAFC" >
                      <Text  fontSize="3xl" color="#353535" fontWeight="bold">{member.first_name?.[0]}{member.last_name?.[0]}</Text>
                    </Box>
                  )}
                </Box>
                {/* Name overlays photo */}
                <Box
                  position="relative"
                  zIndex={2}
                  top="24px"
                  mb={4}
                  textAlign="center"
                  width="100%"
                  mt={0}
                  
                >
                  <Text fontSize="40px" fontWeight="bold" color="#353535"  fontFamily="IvyJournal-Thin, serif" textTransform="uppercase" letterSpacing="0.08em" m={0} p={0}>
                    {member.first_name} {member.last_name}
                  </Text>
                </Box>
                {/* Info Box */}
                <Box bg="#ecede8" p={4} borderRadius="12px" boxShadow="0 4px 16px rgba(53,53,53,0.5)" w="100%" mt={2} padding={30}>
                  <SimpleGrid columns={2} spacingX={10} spacingY={1} ml={0} w="100%" alignItems="start">
                    <VStack align="flex-start" spacing={1} ml={12}>
                      <HStack spacing={15} color="#353535" width="90%">
                        <PhoneIcon boxSize={18} />
                        <Text fontSize="20px" margin={5}>{formatPhone(member.phone) || <span style={{ color: '#ccc' }}> </span>}</Text>
                        
                      </HStack>
                      <HStack spacing={15} color="#353535">
                        <EmailIcon boxSize={18} />
                        <Text fontSize="20px" margin={5}>{member.email || <span style={{ color: '#ccc' }}> </span>}</Text>
                      </HStack>
                      <HStack spacing={15} color="#353535">
                        <Box as={FaBriefcase} boxSize={16} />
                        <Text fontSize="20px" fontFamily="Montserrat, sans-serif" margin={5}>
                          Co.: {member.company || <span style={{ color: '#bbb' }}>—</span>}
                        </Text>
                      </HStack>
                    </VStack>
                    <VStack align="flex-start" spacing={1} mr={2} width="100%">
                      {member.dob && (
                        <HStack spacing={15} color="#353535">
                          <CalendarIcon boxSize={16} />
                          <Text fontSize="20px" fontFamily="Montserrat, sans-serif" margin={5}>
                            Birthdate: {new Date(member.dob).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </Text>
                        </HStack>
                      )}
                      {member.join_date && (
                        <HStack spacing={15} color="#353535">
                          <CalendarIcon boxSize={16} />
                          <Text fontSize="20px" fontFamily="Montserrat, sans-serif" margin={5}>Member Since: {new Date(member.join_date).toLocaleDateString()}</Text>
                        </HStack>
                      )}
                      <HStack spacing={15} color="#353535">
                        <Box as={FaUser} boxSize={16} />
                        <Text fontSize="20px" fontFamily="Montserrat, sans-serif" margin={5}>Referred by: {member.referred_by || <span style={{ color: '#bbb' }}>—</span>}</Text>
                      </HStack>
                    </VStack>
                  </SimpleGrid>
                </Box>
                {/* Add 20px space between info card and attributes card */}
                <Box h="20px" />
                {/* Centered Attributes & Notes title above the card */}
                <Box width="100%" textAlign="center" mb={2}>
                  <Text fontSize="32px" fontWeight="bold" color="#353535" fontFamily="IvyJournal-Thin, serif" textTransform="uppercase" letterSpacing="0.08em" m={0} mb={-12}>
                    Attributes & Notes
                  </Text>
                </Box>
                <Box bg="#ecede8" p={4} borderRadius="12px" boxShadow="0 4px 16px rgba(53,53,53,0.5)" w="100%" mt={2} padding={30} mb={10}>
                  {/* Attributes Section */}
                  <Text fontWeight="bold" fontSize="lg" mb={2} color="#353535">Attributes</Text>
                  {/* List attributes */}
                  <VStack align="stretch" spacing={2} mb={4} w="100%">
                    {attributes.map(attr => (
                      <HStack key={attr.id} spacing={2}>
                        {editingAttrId === attr.id ? (
                          <>
                            <Input
                              value={editingAttrType}
                              onChange={e => setEditingAttrType(e.target.value)}
                              w="30%"
                              bg="#ECEDE8"
                              border="2px solid #A59480"
                              borderRadius="8px"
                              fontSize="18px"
                              fontFamily="Montserrat, sans-serif"
                              _placeholder={{ color: "#999" }}
                            />
                            <Input
                              value={editingAttrValue}
                              onChange={e => setEditingAttrValue(e.target.value)}
                              w="50%"
                              bg="#ECEDE8"
                              border="2px solid #A59480"
                              borderRadius="8px"
                              fontSize="18px"
                              fontFamily="Montserrat, sans-serif"
                              _placeholder={{ color: "#999" }}
                            />
                            <Button size="sm" colorScheme="green" onClick={handleSaveEdit}>Save</Button>
                            <Button size="sm" variant="ghost" onClick={handleCancelEdit}>Cancel</Button>
                            <Button size="sm" colorScheme="red" onClick={handleDeleteAttribute}>Delete</Button>
                          </>
                        ) : (
                          <>
                            <Text w="30%" fontWeight="semibold">{attr.key}</Text>
                            <Text w="50%">{attr.value}</Text>
                            <Button size="sm" onClick={() => handleEditClick(attr)} colorScheme="yellow">Edit</Button>
                          </>
                        )}
                      </HStack>
                    ))}
                  </VStack>
                  <HStack spacing={2} mb={4} w="100%">
                    <Input
                      placeholder="Attribute Type"
                      value={attrType}
                      onChange={e => setAttrType(e.target.value)}
                      bg="#ECEDE8"
                      border="2px solid #A59480"
                      borderRadius="8px"
                      fontSize="18px"
                      fontFamily="Montserrat, sans-serif"
                      _placeholder={{ color: "#999" }}
                    />
                    <Input
                      placeholder="Attribute Detail"
                      value={attrValue}
                      onChange={e => setAttrValue(e.target.value)}
                      bg="#ECEDE8"
                      border="2px solid #A59480"
                      borderRadius="8px"
                      fontSize="18px"
                      fontFamily="Montserrat, sans-serif"
                      _placeholder={{ color: "#999" }}
                    />
                    <Button bg="#A59480" color="white" borderRadius="8px" fontWeight="semibold" fontSize="md" _hover={{ bg: '#8B7B68' }} onClick={handleAddAttribute}>Add</Button>
                  </HStack>
                  {/* Notes Section */}
                  <Text fontWeight="bold" fontSize="lg" mb={2} color="#353535">Notes History</Text>
                  <VStack align="stretch" spacing={2} w="100%">
                    <Input
                      placeholder="New note..."
                      bg="#ECEDE8"
                      border="2px solid #A59480"
                      borderRadius="8px"
                      fontSize="18px"
                      fontFamily="Montserrat, sans-serif"
                      _placeholder={{ color: "#999" }}
                    />
                    <Button alignSelf="flex-start" bg="#A59480" color="white" borderRadius="8px" fontWeight="semibold" fontSize="md" _hover={{ bg: '#8B7B68' }}>Add Note</Button>
                  </VStack>
                </Box>
                <Box h={2} />
                {/* Member ID in bottom-right corner */}
                <Box position="absolute" bottom="12px" right="20px">
                  <Text fontSize="sm" fontStyle="italic" color="#ECEDE8" opacity={0.6}>
                    ID: {member.member_id}
                  </Text>
                </Box>
              </Box>
              {/* Other member info, attributes, etc. can go below here as needed */}
            </Box>
          ))}
        </SimpleGrid>
        <Box bg="white" border="3px solid #a59480" borderRadius="12px" boxShadow="lg" p={8} mb={8}>
          <Heading size="md" mb={4}>Ledger</Heading>
          {ledgerLoading ? (
            <Spinner size="md" />
          ) : (
            <Box overflowX="auto">
              <MemberLedger
                members={members}
                memberLedger={ledger}
                selectedMember={members[0]}
                ledgerLoading={ledgerLoading}
                newTransaction={newTransaction}
                setNewTransaction={setNewTransaction}
                handleAddTransaction={handleAddTransaction}
                transactionStatus={transactionStatus}
                editingTransaction={editingTransaction}
                setEditingTransaction={setEditingTransaction}
                editTransactionForm={editTransactionForm}
                setEditTransactionForm={setEditTransactionForm}
                handleEditTransaction={handleEditTransaction}
                handleUpdateTransaction={handleUpdateTransaction}
                handleDeleteTransaction={handleDeleteTransaction}
                fetchLedger={() => accountId && fetchLedger(accountId as string)}
                setSelectedTransactionMemberId={setSelectedTransactionMemberId}
                selectedTransactionMemberId={selectedTransactionMemberId}
                session={null}
              />
            </Box>
          )}
        </Box>
        {/* Message + History Card */}
        <Box bg="white" border="3px solid #a59480" borderRadius="12px" boxShadow="lg" p={8} mb={8}>
          <Heading size="md" mb={4}>Messages</Heading>
          <Box display={{ base: 'block', md: 'flex' }} gap={6}>
            {/* Send Message Form */}
            <Box flex={1} minW={0} mr={{ md: 6 }}>
              <SendMessageForm
                members={members}
                accountId={accountId as string}
                onSent={async () => {
                  // Refetch messages after sending
                }}
              />
            </Box>
            {/* Message History Table */}
            <Box flex={1} minW={0}>
              <Heading size="sm" mb={2}>Message History</Heading>
              {messagesLoading ? (
                <Spinner size="md" />
              ) : messages.length === 0 ? (
                <Text>No messages found for this account.</Text>
              ) : (
                <Box overflowX="auto">
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f5f5f5' }}>
                        <th style={{ padding: '8px', borderBottom: '1px solid #eee', textAlign: 'left' }}>Message</th>
                        <th style={{ padding: '8px', borderBottom: '1px solid #eee', textAlign: 'left' }}>Date</th>
                        <th style={{ padding: '8px', borderBottom: '1px solid #eee', textAlign: 'left' }}>To</th>
                        <th style={{ padding: '8px', borderBottom: '1px solid #eee', textAlign: 'left' }}>From</th>
                      </tr>
                    </thead>
                    <tbody>
                      {messages.map((msg: any) => (
                        <tr key={msg.id}>
                          <td style={{ padding: '8px', borderBottom: '1px solid #f0f0f0' }}>{msg.content}</td>
                          <td style={{ padding: '8px', borderBottom: '1px solid #f0f0f0' }}>{new Date(msg.timestamp).toLocaleString()}</td>
                          <td style={{ padding: '8px', borderBottom: '1px solid #f0f0f0' }}>{msg.recipient || msg.to || 'N/A'}</td>
                          <td style={{ padding: '8px', borderBottom: '1px solid #f0f0f0' }}>{msg.sender || 'System'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Box>
              )}
            </Box>
          </Box>
        </Box>
      </Box>
    </AdminLayout>
  );
} 