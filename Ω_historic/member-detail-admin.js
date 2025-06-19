import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Box, Spinner, Text, Button, SimpleGrid, VStack, Heading } from "@chakra-ui/react";
import { supabase } from "../../api/supabaseClient";
import MemberDetail from "../../MemberDetail";
import MemberLedger from "../../components/pages/MemberLedger";
import AddMemberModal from '../../components/members/AddMemberModal';
import SendMessageForm from '../../components/messages/SendMessageForm';

function sortMembers(members) {
  // Assuming 'primary' is a boolean or a string field, adjust as needed
  return [...members].sort((a, b) => {
    if (a.primary && !b.primary) return -1;
    if (!a.primary && b.primary) return 1;
    return 0;
  });
}

export default function MemberDetailAdmin() {
  const { accountId } = useParams();
  const [members, setMembers] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ledgerLoading, setLedgerLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const [isAddMemberOpen, setAddMemberOpen] = useState(false);

  useEffect(() => {
    async function fetchMembers() {
      try {
        const { data, error } = await supabase
          .from('members')
          .select('*')
          .eq('account_id', accountId);
        if (error) throw error;
        setMembers(sortMembers(data || []));
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchMembers();
  }, [accountId]);

  useEffect(() => {
    async function fetchLedger() {
      setLedgerLoading(true);
      try {
        const res = await fetch(`/api/ledger?account_id=${accountId}`);
        const result = await res.json();
        if (result.error) throw new Error(result.error);
        setLedger(result.data || []);
      } catch (err) {
        console.error('Ledger fetch error:', err);
      } finally {
        setLedgerLoading(false);
      }
    }
    fetchLedger();
  }, [accountId]);

  useEffect(() => {
    async function fetchMessages() {
      setMessagesLoading(true);
      try {
        const res = await fetch(`/api/messages?account_id=${accountId}`);
        const result = await res.json();
        if (result.error) throw new Error(result.error);
        setMessages(result.messages || []);
      } catch (err) {
        console.error('Messages fetch error:', err);
      } finally {
        setMessagesLoading(false);
      }
    }
    fetchMessages();
  }, [accountId]);

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
    <Box p={8}>
      <Button mb={6} onClick={() => navigate(-1)} colorScheme="gray">Back to Members</Button>
      <Button mb={6} colorScheme="blue" onClick={() => setAddMemberOpen(true)}>Add New Member</Button>
      <AddMemberModal isOpen={isAddMemberOpen} onClose={() => setAddMemberOpen(false)} onSave={async (memberData) => {
        // Save logic here, refetch members after
        setAddMemberOpen(false);
        // Optionally refetch members
      }} accountId={accountId} />
      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={8} mb={10} minChildWidth="320px">
        {members.map(member => (
          <Box key={member.member_id} minH="540px" display="flex" flexDirection="column">
            <MemberDetail member={member} />
          </Box>
        ))}
      </SimpleGrid>
      <Box bg="white" borderRadius="lg" boxShadow="sm" p={6} mb={8}>
        <Heading size="md" mb={4}>Ledger</Heading>
        {ledgerLoading ? (
          <Spinner size="md" />
        ) : (
          <MemberLedger
            members={members}
            memberLedger={ledger}
            selectedMember={members[0]}
            ledgerLoading={ledgerLoading}
            newTransaction={{}}
            setNewTransaction={() => {}}
            handleAddTransaction={() => {}}
            transactionStatus=""
            editingTransaction={null}
            setEditingTransaction={() => {}}
            editTransactionForm={{}}
            setEditTransactionForm={() => {}}
            handleEditTransaction={() => {}}
            handleUpdateTransaction={() => {}}
            handleDeleteTransaction={() => {}}
            fetchLedger={() => {}}
            setSelectedTransactionMemberId={() => {}}
            selectedTransactionMemberId=""
            session={null}
          />
        )}
      </Box>
      {/* Message + History Card */}
      <Box bg="white" borderRadius="lg" boxShadow="sm" p={6} mb={8}>
        <Heading size="md" mb={4}>Messages</Heading>
        <Box display={{ base: 'block', md: 'flex' }} gap={6}>
          {/* Send Message Form */}
          <Box flex={1} minW={0} mr={{ md: 6 }}>
            <SendMessageForm
              members={members}
              accountId={accountId}
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
                    {messages.map(msg => (
                      <tr key={msg.id}>
                        <td style={{ padding: '8px', borderBottom: '1px solid #f0f0f0' }}>{msg.body}</td>
                        <td style={{ padding: '8px', borderBottom: '1px solid #f0f0f0' }}>{new Date(msg.created_at).toLocaleString()}</td>
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
  );
} 