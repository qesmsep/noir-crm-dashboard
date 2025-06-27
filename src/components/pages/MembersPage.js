import React, { useState, useEffect } from 'react';
import { getSupabaseClient } from '../../api/supabaseClient';
import {
  Box,
  Button,
  FormControl,
  FormLabel,
  Input,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  Select,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Text,
  VStack,
  useToast,
  Badge,
  HStack,
  InputGroup,
  InputLeftElement,
  useColorModeValue,
  SimpleGrid,
  Avatar,
} from '@chakra-ui/react';
import { SearchIcon } from '@chakra-ui/icons';
import MemberDetail from '../../MemberDetail';
import MemberLedger from './MemberLedger';
import SendMessageModal from '../messages/SendMessageModal';
import MessageHistory from '../messages/MessageHistory';
import AddMemberModal from '../members/AddMemberModal';

// You may want to further break this down into smaller components later
const MembersPage = ({
  members,
  lookupQuery,
  setLookupQuery,
  selectedMember,
  setSelectedMember,
  fetchLedger,
  memberLedger,
  membersByAccount,
  formatDateLong,
  formatPhone,
  formatDOB,
  stripePromise,
  handleEditMember,
  session,
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
  setSelectedTransactionMemberId,
  selectedTransactionMemberId,
  ledgerLoading
}) => {
  const [showSendModal, setShowSendModal] = useState(false);
  const [modalMember, setModalMember] = useState(null);
  const [messageHistoryKey, setMessageHistoryKey] = useState(0);
  const isAdmin = session?.user?.user_metadata?.role === 'admin';
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    membership_type: 'standard',
    membership_status: 'active'
  });
  const [searchTerm, setSearchTerm] = useState('');
  const toast = useToast();
  const cardBg = 'nightSky';
  const cardBorder = 'daybreak';
  const cardShadow = 'lg';
  const cardRadius = 'md';
  const headingColor = 'weddingDay';
  const textColor = 'weddingDay';
  const fontFamily = 'Montserrat, sans-serif';

  useEffect(() => {
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    try {
      setLoading(true);
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('members')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMembers(data || []);
    } catch (error) {
      console.error('Error fetching members:', error);
      setError(error.message);
      toast({
        title: "Error",
        description: "Failed to fetch members",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMember = async (e) => {
    e.preventDefault();
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('members')
        .insert([createForm])
        .select();

      if (error) throw error;

      setMembers([...members, data[0]]);
      setShowCreateModal(false);
      setCreateForm({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        membership_type: 'standard',
        membership_status: 'active'
      });
      toast({
        title: "Success",
        description: "Member created successfully",
        status: "success",
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error creating member:', error);
      toast({
        title: "Error",
        description: error.message,
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const handleDeleteMember = async (id) => {
    if (!window.confirm('Are you sure you want to delete this member? This cannot be undone.')) return;
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from('members')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setMembers(members.filter(member => member.id !== id));
      toast({
        title: "Success",
        description: "Member deleted successfully",
        status: "success",
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error deleting member:', error);
      toast({
        title: "Error",
        description: error.message,
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const filteredMembers = members.filter(member => {
    const searchString = `${member.first_name} ${member.last_name} ${member.email} ${member.phone}`.toLowerCase();
    return searchString.includes(searchTerm.toLowerCase());
  });

  return (
    <VStack fontFamily={fontFamily} spacing={6} align="stretch" p={4}>
      <Box bg={cardBg} border="1px solid" borderColor={cardBorder} borderRadius={cardRadius} boxShadow={cardShadow} p={6}>
        <HStack justify="space-between" mb={4}>
          <Text fontSize="2xl" fontWeight="bold" color={headingColor} fontFamily={fontFamily}>Members</Text>
          <Button bg="cork" color={textColor} borderRadius="md" onClick={() => setShowCreateModal(true)}>
            Create Member
          </Button>
        </HStack>

        <InputGroup mb={4}>
          <InputLeftElement pointerEvents="none">
            <SearchIcon color="gray.300" />
          </InputLeftElement>
          <Input
            placeholder="Search members..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </InputGroup>

        <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={6} mt={4}>
          {filteredMembers.map(member => (
            <Box
              key={member.id}
              bg={useColorModeValue('white', 'gray.800')}
              p={6}
              borderRadius="lg"
              boxShadow="md"
              transition="all 0.2s"
              _hover={{ transform: 'scale(1.02)', boxShadow: 'lg' }}
            >
              <HStack spacing={4}>
                <Avatar name={`${member.first_name} ${member.last_name}`} src={member.photo} size="lg" />
                <VStack align="start" spacing={1}>
                  <Text fontSize="xl" fontWeight="bold">
                    {member.first_name} {member.last_name}
                  </Text>
                  {member.email && <Text fontSize="sm" color="gray.500">{member.email}</Text>}
                  {member.phone && <Text fontSize="sm" color="gray.500">{member.phone}</Text>}
                </VStack>
              </HStack>

              <HStack spacing={2} mt={4}>
                <Badge colorScheme={member.membership_type === 'premium' ? 'purple' : 'green'}>
                  {member.membership_type}
                </Badge>
                <Badge colorScheme={member.membership_status === 'active' ? 'green' : 'red'}>
                  {member.membership_status}
                </Badge>
              </HStack>

              <HStack mt={4} justify="flex-end">
                <Button variant="ghost" size="sm" onClick={() => setSelectedMember(member)}>
                  View
                </Button>
                <Button colorScheme="red" size="sm" onClick={() => handleDeleteMember(member.id)}>
                  Delete
                </Button>
              </HStack>
            </Box>
          ))}
        </SimpleGrid>
      </Box>

      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader color={headingColor} fontFamily={fontFamily}>Create New Member</ModalHeader>
          <ModalCloseButton />
          <form onSubmit={handleCreateMember}>
            <ModalBody>
              <VStack spacing={4}>
                <FormControl isRequired>
                  <FormLabel color={textColor} fontFamily={fontFamily}>First Name</FormLabel>
                  <Input
                    value={createForm.first_name}
                    onChange={e => setCreateForm(prev => ({ ...prev, first_name: e.target.value }))}
                  />
                </FormControl>
                <FormControl isRequired>
                  <FormLabel color={textColor} fontFamily={fontFamily}>Last Name</FormLabel>
                  <Input
                    value={createForm.last_name}
                    onChange={e => setCreateForm(prev => ({ ...prev, last_name: e.target.value }))}
                  />
                </FormControl>
                <FormControl isRequired>
                  <FormLabel color={textColor} fontFamily={fontFamily}>Email</FormLabel>
                  <Input
                    type="email"
                    value={createForm.email}
                    onChange={e => setCreateForm(prev => ({ ...prev, email: e.target.value }))}
                  />
                </FormControl>
                <FormControl>
                  <FormLabel color={textColor} fontFamily={fontFamily}>Phone</FormLabel>
                  <Input
                    type="tel"
                    value={createForm.phone}
                    onChange={e => setCreateForm(prev => ({ ...prev, phone: e.target.value }))}
                  />
                </FormControl>
                <FormControl>
                  <FormLabel color={textColor} fontFamily={fontFamily}>Membership Type</FormLabel>
                  <Select
                    value={createForm.membership_type}
                    onChange={e => setCreateForm(prev => ({ ...prev, membership_type: e.target.value }))}
                  >
                    <option value="standard">Standard</option>
                    <option value="premium">Premium</option>
                  </Select>
                </FormControl>
                <FormControl>
                  <FormLabel color={textColor} fontFamily={fontFamily}>Status</FormLabel>
                  <Select
                    value={createForm.membership_status}
                    onChange={e => setCreateForm(prev => ({ ...prev, membership_status: e.target.value }))}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </Select>
                </FormControl>
              </VStack>
            </ModalBody>
            <ModalFooter>
              <Button variant="ghost" mr={3} onClick={() => setShowCreateModal(false)} bg="cork" color={textColor} borderRadius="md">
                Cancel
              </Button>
              <Button bg="cork" color={textColor} borderRadius="md" type="submit">
                Create Member
              </Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>
    </VStack>
  );
};

export default MembersPage;