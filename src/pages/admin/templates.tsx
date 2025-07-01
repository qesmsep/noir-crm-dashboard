import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Heading,
  VStack,
  HStack,
  Text,
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
  Input,
  Textarea,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  IconButton,
  Badge,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Stat,
  StatLabel,
  StatNumber,
  SimpleGrid,
  Switch,
  FormHelperText
} from '@chakra-ui/react';
import { EditIcon, DeleteIcon, ViewIcon, CheckIcon, CloseIcon } from '@chakra-ui/icons';
import AdminLayout from '../../components/layouts/AdminLayout';

interface CampaignTemplate {
  id: string;
  name: string;
  description: string;
  message_template: string;
  default_delay_days: number;
  default_send_time: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface TemplateStats {
  total: number;
  pending: number;
  sent: number;
  failed: number;
  cancelled: number;
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<CampaignTemplate[]>([]);
  const [stats, setStats] = useState<TemplateStats>({ total: 0, pending: 0, sent: 0, failed: 0, cancelled: 0 });
  const [loading, setLoading] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState<CampaignTemplate | null>(null);
  const [testPhone, setTestPhone] = useState('9137774488');
  const [testFirstName, setTestFirstName] = useState('Test');
  const [processingMessages, setProcessingMessages] = useState(false);
  
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { isOpen: isTestOpen, onOpen: onTestOpen, onClose: onTestClose } = useDisclosure();
  const toast = useToast();

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    message_template: '',
    default_delay_days: 1,
    default_send_time: '10:00:00',
    is_active: true
  });

  useEffect(() => {
    fetchTemplates();
    fetchStats();
  }, []);

  const fetchTemplates = async () => {
    try {
      const response = await fetch('/api/campaign-templates');
      const data = await response.json();
      
      if (response.ok) {
        setTemplates(data.templates || []);
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to fetch templates',
          status: 'error',
          duration: 3000,
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to fetch templates',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/process-scheduled-messages?days=7');
      const data = await response.json();
      
      if (response.ok) {
        setStats(data.stats || { total: 0, pending: 0, sent: 0, failed: 0, cancelled: 0 });
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const url = editingTemplate ? '/api/campaign-templates' : '/api/campaign-templates';
      const method = editingTemplate ? 'PUT' : 'POST';
      const body = editingTemplate ? { ...formData, id: editingTemplate.id } : formData;

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: 'Success',
          description: editingTemplate ? 'Template updated successfully' : 'Template created successfully',
          status: 'success',
          duration: 3000,
        });
        onClose();
        fetchTemplates();
        resetForm();
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to save template',
          status: 'error',
          duration: 3000,
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save template',
        status: 'error',
        duration: 3000,
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;

    try {
      const response = await fetch(`/api/campaign-templates?id=${id}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Template deleted successfully',
          status: 'success',
          duration: 3000,
        });
        fetchTemplates();
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to delete template',
          status: 'error',
          duration: 3000,
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete template',
        status: 'error',
        duration: 3000,
      });
    }
  };

  const handleEdit = (template: CampaignTemplate) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      description: template.description || '',
      message_template: template.message_template,
      default_delay_days: template.default_delay_days,
      default_send_time: template.default_send_time,
      is_active: template.is_active
    });
    onOpen();
  };

  const handleTest = (template: CampaignTemplate) => {
    setEditingTemplate(template);
    setTestFirstName('Test');
    onTestOpen();
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      message_template: '',
      default_delay_days: 1,
      default_send_time: '10:00:00',
      is_active: true
    });
    setEditingTemplate(null);
  };

  const processScheduledMessages = async () => {
    setProcessingMessages(true);
    try {
      const response = await fetch('/api/process-scheduled-messages', {
        method: 'POST'
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: 'Success',
          description: `Processed ${data.processed} messages (${data.successful} successful, ${data.failed} failed)`,
          status: 'success',
          duration: 5000,
        });
        fetchStats();
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to process messages',
          status: 'error',
          duration: 3000,
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to process messages',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setProcessingMessages(false);
    }
  };

  const sendTestMessage = async () => {
    if (!editingTemplate) return;

    try {
      const testMessage = editingTemplate.message_template.replace(/\{\{first_name\}\}/g, testFirstName);
      
      const response = await fetch('/api/sendGuestMessage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: testPhone,
          content: testMessage,
          sent_by: 'admin'
        })
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Test message sent successfully',
          status: 'success',
          duration: 3000,
        });
        onTestClose();
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to send test message',
          status: 'error',
          duration: 3000,
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to send test message',
        status: 'error',
        duration: 3000,
      });
    }
  };

  const getPreviewMessage = () => {
    if (!editingTemplate) return '';
    return editingTemplate.message_template.replace(/\{\{first_name\}\}/g, testFirstName);
  };

  return (
    <AdminLayout>
      <Box p={4} minH="100vh" bg="#353535" color="#ECEDE8">
        <Box position="relative" ml={10} mr={10} zIndex={1} pt={28}>
          <Heading mb={6} fontFamily="'Montserrat', sans-serif" color="#a59480">
            Member Followup Campaign Templates
          </Heading>

          {/* Statistics */}
          <SimpleGrid columns={5} spacing={6} mb={8}>
            <Stat bg="#a59480" p={6} borderRadius="lg" border="1px solid #ecede8">
              <StatLabel fontSize="lg" fontFamily="'Montserrat', sans-serif" fontWeight="bold">
                Total Messages
              </StatLabel>
              <StatNumber fontSize="3xl" fontFamily="'Montserrat', sans-serif">
                {stats.total}
              </StatNumber>
            </Stat>
            <Stat bg="#a59480" p={6} borderRadius="lg" border="1px solid #ecede8">
              <StatLabel fontSize="lg" fontFamily="'Montserrat', sans-serif" fontWeight="bold">
                Pending
              </StatLabel>
              <StatNumber fontSize="3xl" fontFamily="'Montserrat', sans-serif">
                {stats.pending}
              </StatNumber>
            </Stat>
            <Stat bg="#a59480" p={6} borderRadius="lg" border="1px solid #ecede8">
              <StatLabel fontSize="lg" fontFamily="'Montserrat', sans-serif" fontWeight="bold">
                Sent
              </StatLabel>
              <StatNumber fontSize="3xl" fontFamily="'Montserrat', sans-serif">
                {stats.sent}
              </StatNumber>
            </Stat>
            <Stat bg="#a59480" p={6} borderRadius="lg" border="1px solid #ecede8">
              <StatLabel fontSize="lg" fontFamily="'Montserrat', sans-serif" fontWeight="bold">
                Failed
              </StatLabel>
              <StatNumber fontSize="3xl" fontFamily="'Montserrat', sans-serif">
                {stats.failed}
              </StatNumber>
            </Stat>
            <Stat bg="#a59480" p={6} borderRadius="lg" border="1px solid #ecede8">
              <StatLabel fontSize="lg" fontFamily="'Montserrat', sans-serif" fontWeight="bold">
                Templates
              </StatLabel>
              <StatNumber fontSize="3xl" fontFamily="'Montserrat', sans-serif">
                {templates.length}
              </StatNumber>
            </Stat>
          </SimpleGrid>

          {/* Action Buttons */}
          <HStack spacing={4} mb={6}>
            <Button
              colorScheme="blue"
              onClick={() => {
                resetForm();
                onOpen();
              }}
              fontFamily="'Montserrat', sans-serif"
            >
              Create Template
            </Button>
            <Button
              colorScheme="green"
              onClick={processScheduledMessages}
              isLoading={processingMessages}
              fontFamily="'Montserrat', sans-serif"
            >
              Process Scheduled Messages
            </Button>
          </HStack>

          {/* Templates Table */}
          <Box bg="#a59480" borderRadius="lg" border="1px solid #ecede8" overflow="hidden">
            <Table variant="simple">
              <Thead>
                <Tr>
                  <Th fontFamily="'Montserrat', sans-serif" color="#23201C">Name</Th>
                  <Th fontFamily="'Montserrat', sans-serif" color="#23201C">Description</Th>
                  <Th fontFamily="'Montserrat', sans-serif" color="#23201C">Delay (Days)</Th>
                  <Th fontFamily="'Montserrat', sans-serif" color="#23201C">Send Time</Th>
                  <Th fontFamily="'Montserrat', sans-serif" color="#23201C">Status</Th>
                  <Th fontFamily="'Montserrat', sans-serif" color="#23201C">Actions</Th>
                </Tr>
              </Thead>
              <Tbody>
                {templates.map((template) => (
                  <Tr key={template.id}>
                    <Td fontFamily="'Montserrat', sans-serif" fontWeight="bold">
                      {template.name}
                    </Td>
                    <Td fontFamily="'Montserrat', sans-serif">
                      {template.description || '-'}
                    </Td>
                    <Td fontFamily="'Montserrat', sans-serif">
                      {template.default_delay_days}
                    </Td>
                    <Td fontFamily="'Montserrat', sans-serif">
                      {template.default_send_time}
                    </Td>
                    <Td>
                      <Badge
                        colorScheme={template.is_active ? 'green' : 'red'}
                        fontFamily="'Montserrat', sans-serif"
                      >
                        {template.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </Td>
                    <Td>
                      <HStack spacing={2}>
                        <IconButton
                          aria-label="Test template"
                          icon={<ViewIcon />}
                          size="sm"
                          colorScheme="blue"
                          onClick={() => handleTest(template)}
                        />
                        <IconButton
                          aria-label="Edit template"
                          icon={<EditIcon />}
                          size="sm"
                          colorScheme="yellow"
                          onClick={() => handleEdit(template)}
                        />
                        <IconButton
                          aria-label="Delete template"
                          icon={<DeleteIcon />}
                          size="sm"
                          colorScheme="red"
                          onClick={() => handleDelete(template.id)}
                        />
                      </HStack>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Box>

          {/* Create/Edit Template Modal */}
          <Modal isOpen={isOpen} onClose={onClose} size="xl">
            <ModalOverlay />
            <ModalContent bg="#a59480" color="#23201C">
              <ModalHeader fontFamily="'Montserrat', sans-serif">
                {editingTemplate ? 'Edit Template' : 'Create Template'}
              </ModalHeader>
              <ModalCloseButton />
              <form onSubmit={handleSubmit}>
                <ModalBody>
                  <VStack spacing={4}>
                    <FormControl isRequired>
                      <FormLabel fontFamily="'Montserrat', sans-serif">Template Name</FormLabel>
                      <Input
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        bg="white"
                        color="#23201C"
                        fontFamily="'Montserrat', sans-serif"
                      />
                    </FormControl>

                    <FormControl>
                      <FormLabel fontFamily="'Montserrat', sans-serif">Description</FormLabel>
                      <Textarea
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        bg="white"
                        color="#23201C"
                        fontFamily="'Montserrat', sans-serif"
                      />
                    </FormControl>

                    <FormControl isRequired>
                      <FormLabel fontFamily="'Montserrat', sans-serif">Message Template</FormLabel>
                      <Textarea
                        value={formData.message_template}
                        onChange={(e) => setFormData({ ...formData, message_template: e.target.value })}
                        bg="white"
                        color="#23201C"
                        fontFamily="'Montserrat', sans-serif"
                        rows={4}
                        placeholder="Hi {{first_name}}! Welcome to Noir..."
                      />
                      <FormHelperText fontFamily="'Montserrat', sans-serif">
                        Use {{first_name}} to include the member's first name
                      </FormHelperText>
                    </FormControl>

                    <HStack spacing={4} w="full">
                      <FormControl isRequired>
                        <FormLabel fontFamily="'Montserrat', sans-serif">Delay (Days)</FormLabel>
                        <Input
                          type="number"
                          value={formData.default_delay_days}
                          onChange={(e) => setFormData({ ...formData, default_delay_days: parseInt(e.target.value) })}
                          bg="white"
                          color="#23201C"
                          fontFamily="'Montserrat', sans-serif"
                          min={0}
                          max={365}
                        />
                      </FormControl>

                      <FormControl isRequired>
                        <FormLabel fontFamily="'Montserrat', sans-serif">Send Time</FormLabel>
                        <Input
                          type="time"
                          value={formData.default_send_time}
                          onChange={(e) => setFormData({ ...formData, default_send_time: e.target.value + ':00' })}
                          bg="white"
                          color="#23201C"
                          fontFamily="'Montserrat', sans-serif"
                        />
                      </FormControl>
                    </HStack>

                    <FormControl display="flex" alignItems="center">
                      <FormLabel fontFamily="'Montserrat', sans-serif" mb="0">
                        Active
                      </FormLabel>
                      <Switch
                        isChecked={formData.is_active}
                        onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                        colorScheme="green"
                      />
                    </FormControl>
                  </VStack>
                </ModalBody>

                <ModalFooter>
                  <Button variant="ghost" mr={3} onClick={onClose} fontFamily="'Montserrat', sans-serif">
                    Cancel
                  </Button>
                  <Button type="submit" colorScheme="blue" fontFamily="'Montserrat', sans-serif">
                    {editingTemplate ? 'Update' : 'Create'}
                  </Button>
                </ModalFooter>
              </form>
            </ModalContent>
          </Modal>

          {/* Test Message Modal */}
          <Modal isOpen={isTestOpen} onClose={onTestClose} size="lg">
            <ModalOverlay />
            <ModalContent bg="#a59480" color="#23201C">
              <ModalHeader fontFamily="'Montserrat', sans-serif">
                Test Template Message
              </ModalHeader>
              <ModalCloseButton />
              <ModalBody>
                <VStack spacing={4}>
                  <FormControl>
                    <FormLabel fontFamily="'Montserrat', sans-serif">Test Phone Number</FormLabel>
                    <Input
                      value={testPhone}
                      onChange={(e) => setTestPhone(e.target.value)}
                      bg="white"
                      color="#23201C"
                      fontFamily="'Montserrat', sans-serif"
                      placeholder="9137774488"
                    />
                  </FormControl>

                  <FormControl>
                    <FormLabel fontFamily="'Montserrat', sans-serif">Test First Name</FormLabel>
                    <Input
                      value={testFirstName}
                      onChange={(e) => setTestFirstName(e.target.value)}
                      bg="white"
                      color="#23201C"
                      fontFamily="'Montserrat', sans-serif"
                      placeholder="Test"
                    />
                  </FormControl>

                  <FormControl>
                    <FormLabel fontFamily="'Montserrat', sans-serif">Preview Message</FormLabel>
                    <Box
                      p={4}
                      bg="white"
                      color="#23201C"
                      borderRadius="md"
                      fontFamily="'Montserrat', sans-serif"
                      minH="100px"
                      border="1px solid #e2e8f0"
                    >
                      {getPreviewMessage()}
                    </Box>
                  </FormControl>
                </VStack>
              </ModalBody>

              <ModalFooter>
                <Button variant="ghost" mr={3} onClick={onTestClose} fontFamily="'Montserrat', sans-serif">
                  Cancel
                </Button>
                <Button onClick={sendTestMessage} colorScheme="green" fontFamily="'Montserrat', sans-serif">
                  Send Test Message
                </Button>
              </ModalFooter>
            </ModalContent>
          </Modal>
        </Box>
      </Box>
    </AdminLayout>
  );
} 