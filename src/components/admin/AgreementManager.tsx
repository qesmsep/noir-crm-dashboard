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
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load agreements',
        status: 'error',
        duration: 3000,
      });
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
    <VStack spacing={6} align="stretch">
      <HStack justify="space-between">
        <VStack align="start" spacing={1}>
          <Heading size="md">Agreements</Heading>
          <Text fontSize="sm" color="gray.600">
            Manage membership agreements
          </Text>
        </VStack>
        <Button leftIcon={<FiPlus />} onClick={handleCreate}>
          Create Agreement
        </Button>
      </HStack>

      <Table variant="simple">
        <Thead>
          <Tr>
            <Th>Title</Th>
            <Th>Version</Th>
            <Th>Status</Th>
            <Th>Current</Th>
            <Th>Actions</Th>
          </Tr>
        </Thead>
        <Tbody>
          {agreements.map((agreement) => (
            <Tr key={agreement.id}>
              <Td>
                <Text fontWeight="bold">{agreement.title}</Text>
              </Td>
              <Td>v{agreement.version}</Td>
              <Td>
                <Badge colorScheme={
                  agreement.status === 'active' ? 'green' : 
                  agreement.status === 'draft' ? 'yellow' : 'gray'
                }>
                  {agreement.status}
                </Badge>
              </Td>
              <Td>
                {agreement.is_current && (
                  <Badge colorScheme="blue">Current</Badge>
                )}
              </Td>
              <Td>
                <IconButton
                  size="sm"
                  icon={<FiEdit />}
                  onClick={() => handleEdit(agreement)}
                  aria-label="Edit agreement"
                  colorScheme="blue"
                />
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>

      {/* Edit Drawer */}
      <Drawer isOpen={isOpen} onClose={onClose} size="md" placement="right">
        <DrawerOverlay />
        <DrawerContent bg="#ECEDE8" color="#353535" maxW="33vw" w="100%">
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