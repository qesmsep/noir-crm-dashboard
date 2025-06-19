import React from 'react';
import CalendarAvailabilityControl from '../CalendarAvailabilityControl';
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
  useColorModeValue,
} from '@chakra-ui/react';

const AdminPage = ({
  users,
  setUsers,
  editUserId,
  setEditUserId,
  editForm,
  setEditForm,
  handleEditUser,
  handleCancelEdit,
  handleSaveUser,
  showCreateUserModal,
  setShowCreateUserModal,
  createUserForm,
  setCreateUserForm,
  handleCreateUser,
  createStatus,
  session
}) => {
  const toast = useToast();
  const cardBg = 'nightSky';
  const cardBorder = 'daybreak';
  const cardShadow = 'lg';
  const cardRadius = 'md';
  const headingColor = 'weddingDay';
  const textColor = 'weddingDay';
  const fontFamily = 'Montserrat, sans-serif';

  const handleDeleteUser = async (user) => {
    if (!window.confirm('Are you sure you want to delete this user? This cannot be undone.')) return;
    try {
      const res = await fetch('/api/deleteAuthUser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supabase_user_id: user.id,
          member_id: null,
          requester_token: session.access_token
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setUsers(users.filter(u => u.id !== user.id));
        setEditUserId(null);
        toast({
          title: "User deleted",
          status: "success",
          duration: 3000,
          isClosable: true,
        });
      } else {
        toast({
          title: "Error",
          description: data.error || 'Failed to delete user',
          status: "error",
          duration: 5000,
          isClosable: true,
        });
      }
    } catch (e) {
      toast({
        title: "Error",
        description: e.message,
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    }
  };

  return (
    <VStack fontFamily={fontFamily} spacing={6} align="stretch" p={4}>
      <Box bg={cardBg} border="1px solid" borderColor={cardBorder} borderRadius={cardRadius} boxShadow={cardShadow} p={6}>
        <Text fontSize="2xl" fontWeight="bold" mb={4} color={headingColor} fontFamily={fontFamily}>Calendar Availability Control</Text>
        <CalendarAvailabilityControl />
      </Box>

      {createStatus && (
        <Text color={textColor} fontWeight="semibold" fontFamily={fontFamily}>{createStatus}</Text>
      )}

      <Modal isOpen={showCreateUserModal} onClose={() => setShowCreateUserModal(false)}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader color={headingColor} fontFamily={fontFamily}>Create New User</ModalHeader>
          <ModalCloseButton />
          <form onSubmit={handleCreateUser}>
            <ModalBody>
              <VStack spacing={4}>
                <FormControl isRequired>
                  <FormLabel color={textColor} fontFamily={fontFamily}>First Name</FormLabel>
                  <Input
                    value={createUserForm.first_name}
                    onChange={e => setCreateUserForm(prev => ({ ...prev, first_name: e.target.value }))}
                  />
                </FormControl>
                <FormControl isRequired>
                  <FormLabel color={textColor} fontFamily={fontFamily}>Last Name</FormLabel>
                  <Input
                    value={createUserForm.last_name}
                    onChange={e => setCreateUserForm(prev => ({ ...prev, last_name: e.target.value }))}
                  />
                </FormControl>
                <FormControl isRequired>
                  <FormLabel color={textColor} fontFamily={fontFamily}>Email</FormLabel>
                  <Input
                    type="email"
                    value={createUserForm.email}
                    onChange={e => setCreateUserForm(prev => ({ ...prev, email: e.target.value }))}
                  />
                </FormControl>
                <FormControl>
                  <FormLabel color={textColor} fontFamily={fontFamily}>Phone</FormLabel>
                  <Input
                    type="tel"
                    value={createUserForm.phone}
                    onChange={e => setCreateUserForm(prev => ({ ...prev, phone: e.target.value }))}
                  />
                </FormControl>
                <FormControl>
                  <FormLabel color={textColor} fontFamily={fontFamily}>Role</FormLabel>
                  <Select
                    value={createUserForm.role}
                    onChange={e => setCreateUserForm(prev => ({ ...prev, role: e.target.value }))}
                  >
                    <option value="view">View</option>
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                  </Select>
                </FormControl>
              </VStack>
            </ModalBody>
            <ModalFooter>
              <Button variant="ghost" mr={3} onClick={() => setShowCreateUserModal(false)} bg="cork" color={textColor} borderRadius="md">
                Cancel
              </Button>
              <Button bg="cork" color={textColor} borderRadius="md" type="submit">
                Create User
              </Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>

      <Box bg={cardBg} border="1px solid" borderColor={cardBorder} borderRadius={cardRadius} boxShadow={cardShadow} p={6}>
        <Text fontSize="2xl" fontWeight="bold" mb={4} color={headingColor} fontFamily={fontFamily}>All Users</Text>
        <Table variant="striped" colorScheme="gray">
          <Thead>
            <Tr>
              <Th color={textColor} fontFamily={fontFamily}>First Name</Th>
              <Th color={textColor} fontFamily={fontFamily}>Last Name</Th>
              <Th color={textColor} fontFamily={fontFamily}>Email</Th>
              <Th color={textColor} fontFamily={fontFamily}>Phone</Th>
              <Th color={textColor} fontFamily={fontFamily}>Role</Th>
              <Th color={textColor} fontFamily={fontFamily}>Actions</Th>
            </Tr>
          </Thead>
          <Tbody>
            {users.map(user => (
              editUserId === user.id ? (
                <Tr key={user.id}>
                  <Td color={textColor} fontFamily={fontFamily}>
                    <Input
                      value={editForm.first_name}
                      onChange={e => setEditForm({ ...editForm, first_name: e.target.value })}
                    />
                  </Td>
                  <Td color={textColor} fontFamily={fontFamily}>
                    <Input
                      value={editForm.last_name}
                      onChange={e => setEditForm({ ...editForm, last_name: e.target.value })}
                    />
                  </Td>
                  <Td color={textColor} fontFamily={fontFamily}>
                    <Input
                      value={editForm.email}
                      onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                    />
                  </Td>
                  <Td color={textColor} fontFamily={fontFamily}>
                    <Input
                      value={editForm.phone}
                      onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                    />
                  </Td>
                  <Td color={textColor} fontFamily={fontFamily}>
                    <Select
                      value={editForm.role}
                      onChange={e => setEditForm({ ...editForm, role: e.target.value })}
                    >
                      <option value="admin">admin</option>
                      <option value="member">member</option>
                      <option value="view">view</option>
                    </Select>
                  </Td>
                  <Td color={textColor} fontFamily={fontFamily}>
                    <Button bg="cork" color={textColor} borderRadius="md" size="sm" mr={2} onClick={() => handleSaveUser(user.id)}>
                      Save
                    </Button>
                    <Button variant="ghost" size="sm" mr={2} onClick={handleCancelEdit} bg="cork" color={textColor} borderRadius="md">
                      Cancel
                    </Button>
                    <Button colorScheme="red" size="sm" onClick={() => handleDeleteUser(user)} borderRadius="md">
                      Delete
                    </Button>
                  </Td>
                </Tr>
              ) : (
                <Tr key={user.id}>
                  <Td color={textColor} fontFamily={fontFamily}>{user.first_name}</Td>
                  <Td color={textColor} fontFamily={fontFamily}>{user.last_name}</Td>
                  <Td color={textColor} fontFamily={fontFamily}>{user.email}</Td>
                  <Td color={textColor} fontFamily={fontFamily}>{user.phone}</Td>
                  <Td color={textColor} fontFamily={fontFamily}>{user.role}</Td>
                  <Td color={textColor} fontFamily={fontFamily}>
                    <Button bg="cork" color={textColor} borderRadius="md" size="sm" mr={2} onClick={() => handleEditUser(user)}>
                      Edit
                    </Button>
                    <Button colorScheme="red" size="sm" onClick={() => handleDeleteUser(user)} borderRadius="md">
                      Delete
                    </Button>
                  </Td>
                </Tr>
              )
            ))}
          </Tbody>
        </Table>
      </Box>
    </VStack>
  );
};

export default AdminPage; 