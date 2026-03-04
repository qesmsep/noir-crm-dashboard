import React, { useState, useEffect } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  Heading,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
  Drawer,
  DrawerBody,
  DrawerFooter,
  DrawerHeader,
  DrawerOverlay,
  DrawerContent,
  DrawerCloseButton,
  useDisclosure,
  useToast,
  FormControl,
  FormLabel,
  Input,
  Textarea,
  Select,
  Checkbox,
  IconButton
} from '@chakra-ui/react';
import { FiPlus, FiEdit } from 'react-icons/fi';

interface Agreement {
  id: string;
  title: string;
  content: string;
  version: number;
  status: 'active' | 'inactive' | 'draft';
  is_current: boolean;
}

export default function AgreementManager() {
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingAgreement, setEditingAgreement] = useState<Agreement | null>(null);

  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();

  useEffect(() => {
    loadAgreements();
  }, []);

  const loadAgreements = async () => {
    try {
      const response = await fetch('/api/membership/agreements');
      if (response.ok) {
        const data = await response.json();
        setAgreements(data);
      } else {
        // Use mock data for now if API doesn't exist
        setAgreements([
          {
            id: '1',
            title: 'Noir Membership Agreement',
            content: 'Standard membership agreement content...',
            version: 1,
            status: 'active',
            is_current: true
          }
        ]);
      }
    } catch (error) {
      // Use mock data if API fails
      setAgreements([
        {
          id: '1',
          title: 'Noir Membership Agreement',
          content: 'Standard membership agreement content...',
          version: 1,
          status: 'active',
          is_current: true
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingAgreement({
      id: '',
      title: '',
      content: '',
      version: 1,
      status: 'draft',
      is_current: false
    });
    onOpen();
  };

  const handleEdit = (agreement: Agreement) => {
    setEditingAgreement({ ...agreement });
    onOpen();
  };

  const handleSave = async () => {
    if (!editingAgreement?.title || !editingAgreement?.content) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields',
        status: 'error',
        duration: 3000,
      });
      return;
    }

    try {
      const method = editingAgreement.id ? 'PUT' : 'POST';
      const response = await fetch('/api/membership/agreements', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingAgreement)
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Agreement saved successfully',
          status: 'success',
          duration: 3000,
        });
        onClose();
        loadAgreements();
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save agreement',
        status: 'error',
        duration: 3000,
      });
    }
  };

  if (loading) {
    return <Text>Loading agreements...</Text>;
  }

  return (
    <VStack spacing={4} align="stretch">
      <HStack justify="space-between" flexWrap={{ base: "wrap", md: "nowrap" }} gap={3}>
        <VStack align="start" spacing={1} flex="1">
          <Heading size={{ base: "sm", md: "md" }} color="#1F1F1F">Agreements</Heading>
          <Text fontSize={{ base: "xs", md: "sm" }} color="#5A5A5A">
            Manage membership agreements
          </Text>
        </VStack>
        <Button
          leftIcon={<FiPlus />}
          onClick={handleCreate}
          bg="#A59480"
          color="white"
          size={{ base: "sm", md: "md" }}
          _hover={{ bg: '#8C7C6D' }}
          boxShadow="0 2px 4px rgba(0,0,0,0.1), 0 4px 8px rgba(0,0,0,0.08), 0 8px 16px rgba(0,0,0,0.06)"
          borderRadius="10px"
        >
          Create Agreement
        </Button>
      </HStack>

      {/* Mobile View - Cards */}
      <Box display={{ base: "block", md: "none" }}>
        <VStack spacing={3} align="stretch">
          {agreements.map((agreement) => (
            <Box
              key={agreement.id}
              bg="white"
              p={4}
              borderRadius="16px"
              boxShadow="0 2px 4px rgba(0,0,0,0.05)"
              borderWidth="1px"
              borderColor="#ECEAE5"
            >
              <HStack justify="space-between" mb={2}>
                <Text fontWeight="bold" fontSize="sm" color="#1F1F1F">
                  {agreement.title}
                </Text>
                <IconButton
                  size="sm"
                  icon={<FiEdit />}
                  onClick={() => handleEdit(agreement)}
                  aria-label="Edit agreement"
                  bg="#A59480"
                  color="white"
                  _hover={{ bg: '#8C7C6D' }}
                />
              </HStack>
              <HStack spacing={2} flexWrap="wrap">
                <Badge
                  px={2}
                  py={1}
                  borderRadius="5px"
                  fontSize="xs"
                >
                  v{agreement.version}
                </Badge>
                <Badge
                  colorScheme={
                    agreement.status === 'active' ? 'green' :
                    agreement.status === 'draft' ? 'yellow' : 'gray'
                  }
                  px={2}
                  py={1}
                  borderRadius="5px"
                  fontSize="xs"
                >
                  {agreement.status}
                </Badge>
                {agreement.is_current && (
                  <Badge
                    colorScheme="blue"
                    px={2}
                    py={1}
                    borderRadius="5px"
                    fontSize="xs"
                  >
                    Current
                  </Badge>
                )}
              </HStack>
            </Box>
          ))}
        </VStack>
      </Box>

      {/* Desktop View - Table */}
      <Box
        display={{ base: "none", md: "block" }}
        overflowX="auto"
        bg="white"
        borderRadius="16px"
        borderWidth="1px"
        borderColor="#ECEAE5"
      >
        <Table variant="simple">
          <Thead bg="#F6F5F2">
            <Tr>
              <Th color="#5A5A5A" borderBottom="2px" borderColor="#ECEAE5">Title</Th>
              <Th color="#5A5A5A" borderBottom="2px" borderColor="#ECEAE5">Version</Th>
              <Th color="#5A5A5A" borderBottom="2px" borderColor="#ECEAE5">Status</Th>
              <Th color="#5A5A5A" borderBottom="2px" borderColor="#ECEAE5">Current</Th>
              <Th color="#5A5A5A" borderBottom="2px" borderColor="#ECEAE5">Actions</Th>
            </Tr>
          </Thead>
          <Tbody>
            {agreements.map((agreement) => (
              <Tr key={agreement.id} _hover={{ bg: '#FBFBFA' }}>
                <Td borderBottom="1px" borderColor="#EFEDE8">
                  <Text fontWeight="bold" color="#1F1F1F">{agreement.title}</Text>
                </Td>
                <Td borderBottom="1px" borderColor="#EFEDE8" color="#2C2C2C">v{agreement.version}</Td>
                <Td borderBottom="1px" borderColor="#EFEDE8">
                  <Badge
                    colorScheme={
                      agreement.status === 'active' ? 'green' :
                      agreement.status === 'draft' ? 'yellow' : 'gray'
                    }
                    px={2}
                    py={1}
                    borderRadius="5px"
                  >
                    {agreement.status}
                  </Badge>
                </Td>
                <Td borderBottom="1px" borderColor="#EFEDE8">
                  {agreement.is_current && (
                    <Badge colorScheme="blue" px={2} py={1} borderRadius="5px">Current</Badge>
                  )}
                </Td>
                <Td borderBottom="1px" borderColor="#EFEDE8">
                  <IconButton
                    size="sm"
                    icon={<FiEdit />}
                    onClick={() => handleEdit(agreement)}
                    aria-label="Edit agreement"
                    bg="#A59480"
                    color="white"
                    _hover={{ bg: '#8C7C6D' }}
                    boxShadow="0 2px 4px rgba(0,0,0,0.05)"
                  />
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </Box>

      {/* Edit Drawer */}
      <Drawer
        isOpen={isOpen}
        onClose={onClose}
        size={{ base: "full", md: "md" }}
        placement="right"
      >
        <DrawerOverlay />
        <DrawerContent
          bg="#ECEDE8"
          color="#353535"
          maxW={{ base: "100%", md: "450px" }}
          w="100%"
          borderTopRadius={{ base: "20px", md: "0" }}
          maxH={{ base: "90vh", md: "100vh" }}
        >
          <DrawerCloseButton />
          <DrawerHeader borderBottomWidth="1px" color="#353535">
            {editingAgreement?.id ? 'Edit Agreement' : 'Create Agreement'}
          </DrawerHeader>
          <DrawerBody>
            <VStack spacing={4} align="stretch" pt={4}>
              <FormControl>
                <FormLabel color="#353535">Title</FormLabel>
                <Input
                  value={editingAgreement?.title || ''}
                  onChange={(e) => setEditingAgreement(prev => ({ ...prev!, title: e.target.value }))}
                  placeholder="Enter agreement title"
                  bg="white"
                  borderColor="gray.300"
                  _focus={{ borderColor: "blue.500", boxShadow: "0 0 0 1px #3182ce" }}
                  w="100%"
                />
              </FormControl>

              <FormControl>
                <FormLabel color="#353535">Status</FormLabel>
                <Select
                  value={editingAgreement?.status || 'draft'}
                  onChange={(e) => setEditingAgreement(prev => ({ ...prev!, status: e.target.value as any }))}
                  bg="white"
                  borderColor="gray.300"
                  _focus={{ borderColor: "blue.500", boxShadow: "0 0 0 1px #3182ce" }}
                  w="100%"
                >
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </Select>
              </FormControl>

              <FormControl>
                <Checkbox
                  isChecked={editingAgreement?.is_current || false}
                  onChange={(e) => setEditingAgreement(prev => ({ ...prev!, is_current: e.target.checked }))}
                  color="#353535"
                >
                  Set as current agreement
                </Checkbox>
              </FormControl>

              <FormControl>
                <FormLabel color="#353535">Content (HTML)</FormLabel>
                <Textarea
                  value={editingAgreement?.content || ''}
                  onChange={(e) => setEditingAgreement(prev => ({ ...prev!, content: e.target.value }))}
                  placeholder="Enter agreement content (HTML supported)"
                  rows={15}
                  bg="white"
                  borderColor="gray.300"
                  _focus={{ borderColor: "blue.500", boxShadow: "0 0 0 1px #3182ce" }}
                  w="100%"
                />
              </FormControl>
            </VStack>
          </DrawerBody>
          <DrawerFooter borderTopWidth="1px">
            <HStack spacing={3}>
              <Button onClick={onClose} variant="outline">
                Cancel
              </Button>
              <Button colorScheme="blue" onClick={handleSave}>
                Save Agreement
              </Button>
            </HStack>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </VStack>
  );
} 