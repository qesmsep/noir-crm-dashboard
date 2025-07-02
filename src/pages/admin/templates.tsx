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
  Select,
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
  FormHelperText,
  Drawer,
  DrawerOverlay,
  DrawerContent,
  DrawerHeader,
  DrawerBody,
  DrawerFooter,
  DrawerCloseButton,
  Portal
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

interface ReservationReminderTemplate {
  id: string;
  name: string;
  description: string;
  message_template: string;
  reminder_type: 'day_of' | 'hour_before';
  send_time: string;
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

interface PendingReminder {
  id: string;
  customer_name: string;
  customer_phone: string;
  message_content: string;
  scheduled_for: string;
  created_at: string;
  reservation: {
    id: string;
    first_name: string;
    last_name: string;
    phone: string;
    start_time: string;
    party_size: number;
    status: string;
  };
  template: {
    id: string;
    name: string;
    reminder_type: string;
    send_time: string;
  };
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<CampaignTemplate[]>([]);
  const [reminderTemplates, setReminderTemplates] = useState<ReservationReminderTemplate[]>([]);
  const [pendingReminders, setPendingReminders] = useState<PendingReminder[]>([]);
  const [stats, setStats] = useState<TemplateStats>({ total: 0, pending: 0, sent: 0, failed: 0, cancelled: 0 });
  const [reminderStats, setReminderStats] = useState<TemplateStats>({ total: 0, pending: 0, sent: 0, failed: 0, cancelled: 0 });
  const [loading, setLoading] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState<CampaignTemplate | null>(null);
  const [editingReminderTemplate, setEditingReminderTemplate] = useState<ReservationReminderTemplate | null>(null);
  const [testPhone, setTestPhone] = useState('9137774488');
  const [testFirstName, setTestFirstName] = useState('Test');
  const [processingMessages, setProcessingMessages] = useState(false);
  const [processingReminders, setProcessingReminders] = useState(false);
  const [sendingIndividualReminder, setSendingIndividualReminder] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'campaigns' | 'reminders'>('campaigns');
  
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { isOpen: isTestOpen, onOpen: onTestOpen, onClose: onTestClose } = useDisclosure();
  const { isOpen: isReminderOpen, onOpen: onReminderOpen, onClose: onReminderClose } = useDisclosure();
  const { isOpen: isReminderTestOpen, onOpen: onReminderTestOpen, onClose: onReminderTestClose } = useDisclosure();
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

  // Reminder form state
  const [reminderFormData, setReminderFormData] = useState({
    name: '',
    description: '',
    message_template: '',
    reminder_type: 'day_of' as 'day_of' | 'hour_before',
    send_time: '10:00:00',
    is_active: true
  });

  useEffect(() => {
    fetchTemplates();
    fetchReminderTemplates();
    fetchStats();
    fetchReminderStats();
    fetchPendingReminders();
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

  const fetchReminderTemplates = async () => {
    try {
      const response = await fetch('/api/reservation-reminder-templates');
      const data = await response.json();
      
      if (response.ok) {
        setReminderTemplates(data.templates || []);
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to fetch reminder templates',
          status: 'error',
          duration: 3000,
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to fetch reminder templates',
        status: 'error',
        duration: 3000,
      });
    }
  };

  const fetchReminderStats = async () => {
    try {
      const response = await fetch('/api/process-reservation-reminders?days=7');
      const data = await response.json();
      
      if (response.ok) {
        setReminderStats(data.stats || { total: 0, pending: 0, sent: 0, failed: 0, cancelled: 0 });
      }
    } catch (error) {
      console.error('Failed to fetch reminder stats:', error);
    }
  };

  const fetchPendingReminders = async () => {
    try {
      const response = await fetch('/api/pending-reservation-reminders');
      const data = await response.json();
      
      if (response.ok) {
        setPendingReminders(data.pendingReminders || []);
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to fetch pending reminders',
          status: 'error',
          duration: 3000,
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to fetch pending reminders',
        status: 'error',
        duration: 3000,
      });
    }
  };

  const sendIndividualReminder = async (reminderId: string) => {
    setSendingIndividualReminder(reminderId);
    try {
      const response = await fetch('/api/pending-reservation-reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reminder_id: reminderId })
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Reminder sent successfully',
          status: 'success',
          duration: 3000,
        });
        // Refresh the pending reminders list
        fetchPendingReminders();
        fetchReminderStats();
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to send reminder',
          status: 'error',
          duration: 3000,
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to send reminder',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setSendingIndividualReminder(null);
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

  // Reminder template management functions
  const handleReminderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const url = editingReminderTemplate ? '/api/reservation-reminder-templates' : '/api/reservation-reminder-templates';
      const method = editingReminderTemplate ? 'PUT' : 'POST';
      const body = editingReminderTemplate ? { ...reminderFormData, id: editingReminderTemplate.id } : reminderFormData;

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: 'Success',
          description: editingReminderTemplate ? 'Reminder template updated successfully' : 'Reminder template created successfully',
          status: 'success',
          duration: 3000,
        });
        onReminderClose();
        fetchReminderTemplates();
        resetReminderForm();
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to save reminder template',
          status: 'error',
          duration: 3000,
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save reminder template',
        status: 'error',
        duration: 3000,
      });
    }
  };

  const handleReminderDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this reminder template?')) return;

    try {
      const response = await fetch(`/api/reservation-reminder-templates?id=${id}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Reminder template deleted successfully',
          status: 'success',
          duration: 3000,
        });
        fetchReminderTemplates();
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to delete reminder template',
          status: 'error',
          duration: 3000,
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete reminder template',
        status: 'error',
        duration: 3000,
      });
    }
  };

  const handleReminderEdit = (template: ReservationReminderTemplate) => {
    setEditingReminderTemplate(template);
    setReminderFormData({
      name: template.name,
      description: template.description || '',
      message_template: template.message_template,
      reminder_type: template.reminder_type,
      send_time: template.send_time,
      is_active: template.is_active
    });
    onReminderOpen();
  };

  const handleReminderTest = (template: ReservationReminderTemplate) => {
    setEditingReminderTemplate(template);
    setTestFirstName('Test');
    onReminderTestOpen();
  };

  const resetReminderForm = () => {
    setReminderFormData({
      name: '',
      description: '',
      message_template: '',
      reminder_type: 'day_of',
      send_time: '10:00:00',
      is_active: true
    });
    setEditingReminderTemplate(null);
  };

  const processReservationReminders = async () => {
    setProcessingReminders(true);
    try {
      const response = await fetch('/api/process-reservation-reminders', {
        method: 'POST'
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: 'Success',
          description: `Processed ${data.processed} reminders (${data.successful} successful, ${data.failed} failed)`,
          status: 'success',
          duration: 5000,
        });
        fetchReminderStats();
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to process reminders',
          status: 'error',
          duration: 3000,
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to process reminders',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setProcessingReminders(false);
    }
  };

  const sendReminderTestMessage = async () => {
    if (!editingReminderTemplate) return;

    try {
      const testMessage = editingReminderTemplate.message_template
        .replace(/\{\{first_name\}\}/g, testFirstName)
        .replace(/\{\{reservation_time\}\}/g, '7:00 PM')
        .replace(/\{\{party_size\}\}/g, '2');
      
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
          description: 'Test reminder message sent successfully',
          status: 'success',
          duration: 3000,
        });
        onReminderTestClose();
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to send test reminder message',
          status: 'error',
          duration: 3000,
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to send test reminder message',
        status: 'error',
        duration: 3000,
      });
    }
  };

  const getReminderPreviewMessage = () => {
    if (!editingReminderTemplate) return '';
    return editingReminderTemplate.message_template
      .replace(/\{\{first_name\}\}/g, testFirstName)
      .replace(/\{\{reservation_time\}\}/g, '7:00 PM')
      .replace(/\{\{party_size\}\}/g, '2');
  };

  return (
    <AdminLayout>
      {/* Drawer at the root, sibling to all content */}
      <Drawer isOpen={isReminderOpen} placement="right" onClose={onReminderClose}>
        <Box zIndex="2000" position="relative">
          <DrawerOverlay bg="blackAlpha.600" />
          <DrawerContent 
            bg="#a59480" 
            color="#23201C" 
            maxW="420px" 
            w="100%" 
            border="2px solid #353535" 
            borderRadius="10px"  
            fontFamily="Montserrat, sans-serif" 
            boxShadow="xl" 
            mt="80px" 
            mb="25px" 
            paddingRight="40px" 
            paddingLeft="40px" 
            position="fixed"
            top="0"
            right="0"
            height="100vh"
            style={{
              transform: isReminderOpen ? 'translateX(0)' : 'translateX(100%)',
              transition: 'transform 0.3s ease-in-out'
            }}
          >
          <DrawerHeader fontFamily="'Montserrat', sans-serif">
            {editingReminderTemplate ? 'Edit Reminder Template' : 'Create Reminder Template'}
          </DrawerHeader>
          <DrawerCloseButton />
          <form onSubmit={handleReminderSubmit} style={{ height: '100%' }}>
            <DrawerBody>
              <VStack spacing={4}>
                <FormControl isRequired>
                  <FormLabel fontFamily="'Montserrat', sans-serif">Template Name</FormLabel>
                  <Input
                    value={reminderFormData.name}
                    onChange={(e) => setReminderFormData({ ...reminderFormData, name: e.target.value })}
                    bg="white"
                    color="#23201C"
                    fontFamily="'Montserrat', sans-serif"
                  />
                </FormControl>

                <FormControl>
                  <FormLabel fontFamily="'Montserrat', sans-serif">Description</FormLabel>
                  <Textarea
                    value={reminderFormData.description}
                    onChange={(e) => setReminderFormData({ ...reminderFormData, description: e.target.value })}
                    bg="white"
                    color="#23201C"
                    fontFamily="'Montserrat', sans-serif"
                  />
                </FormControl>

                <FormControl isRequired>
                  <FormLabel fontFamily="'Montserrat', sans-serif">Message Template</FormLabel>
                  <Textarea
                    value={reminderFormData.message_template}
                    onChange={(e) => setReminderFormData({ ...reminderFormData, message_template: e.target.value })}
                    bg="white"
                    color="#23201C"
                    fontFamily="'Montserrat', sans-serif"
                    rows={4}
                    placeholder="Hi {{first_name}}! Your reservation at Noir is in 1 hour at {{reservation_time}} for {{party_size}} guests. See you soon!"
                  />
                  <FormHelperText fontFamily="'Montserrat', sans-serif">
                    Use {'{{first_name}}'}, {'{{reservation_time}}'}, and {'{{party_size}}'} as placeholders
                  </FormHelperText>
                </FormControl>

                <HStack spacing={4} w="full">
                  <FormControl isRequired>
                    <FormLabel fontFamily="'Montserrat', sans-serif">Reminder Type</FormLabel>
                    <Select
                      value={reminderFormData.reminder_type}
                      onChange={(e) => setReminderFormData({ ...reminderFormData, reminder_type: e.target.value as 'day_of' | 'hour_before' })}
                      bg="white"
                      color="#23201C"
                      fontFamily="'Montserrat', sans-serif"
                    >
                      <option value="day_of">Day of Reservation</option>
                      <option value="hour_before">Hours Before Reservation</option>
                    </Select>
                  </FormControl>

                  <FormControl isRequired>
                    <FormLabel fontFamily="'Montserrat', sans-serif">
                      {reminderFormData.reminder_type === 'day_of' ? 'Send Time' : 'Hours Before'}
                    </FormLabel>
                    {reminderFormData.reminder_type === 'day_of' ? (
                      <Input
                        type="time"
                        value={reminderFormData.send_time}
                        onChange={(e) => setReminderFormData({ ...reminderFormData, send_time: e.target.value + ':00' })}
                        bg="white"
                        color="#23201C"
                        fontFamily="'Montserrat', sans-serif"
                      />
                    ) : (
                      <Input
                        type="number"
                        value={reminderFormData.send_time}
                        onChange={(e) => setReminderFormData({ ...reminderFormData, send_time: e.target.value })}
                        bg="white"
                        color="#23201C"
                        fontFamily="'Montserrat', sans-serif"
                        min={1}
                        max={24}
                        placeholder="1"
                      />
                    )}
                  </FormControl>
                </HStack>

                <FormControl display="flex" alignItems="center">
                  <FormLabel fontFamily="'Montserrat', sans-serif" mb="0">
                    Active
                  </FormLabel>
                  <Switch
                    isChecked={reminderFormData.is_active}
                    onChange={(e) => setReminderFormData({ ...reminderFormData, is_active: e.target.checked })}
                    colorScheme="green"
                  />
                </FormControl>
              </VStack>
            </DrawerBody>
            <DrawerFooter>
              <Button variant="ghost" mr={3} onClick={onReminderClose} fontFamily="'Montserrat', sans-serif">
                Cancel
              </Button>
              <Button type="submit" colorScheme="blue" fontFamily="'Montserrat', sans-serif">
                {editingReminderTemplate ? 'Update' : 'Create'}
              </Button>
            </DrawerFooter>
          </form>
        </DrawerContent>
        </Box>
      </Drawer>
      <Box p={4} minH="100vh" bg="#353535" color="#ECEDE8">
        <Box position="relative" ml={10} mr={10} zIndex={1} pt={28}>
          <Heading mb={6} fontFamily="'Montserrat', sans-serif" color="#a59480">
            Message Templates
          </Heading>

          {/* Tab Navigation */}
          <HStack spacing={0} mb={6}>
            <Button
              variant={activeTab === 'campaigns' ? 'solid' : 'ghost'}
              colorScheme={activeTab === 'campaigns' ? 'blue' : 'gray'}
              onClick={() => setActiveTab('campaigns')}
              fontFamily="'Montserrat', sans-serif"
              borderRadius="md"
              borderRightRadius={0}
            >
              Member Campaigns
            </Button>
            <Button
              variant={activeTab === 'reminders' ? 'solid' : 'ghost'}
              colorScheme={activeTab === 'reminders' ? 'blue' : 'gray'}
              onClick={() => setActiveTab('reminders')}
              fontFamily="'Montserrat', sans-serif"
              borderRadius="md"
              borderLeftRadius={0}
            >
              Reservation Reminders
            </Button>
          </HStack>

          {/* Campaign Templates Tab */}
          {activeTab === 'campaigns' && (
            <>
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
            </>
          )}

          {/* Reservation Reminders Tab */}
          {activeTab === 'reminders' && (
            <>
              {/* Statistics */}
              <SimpleGrid columns={5} spacing={6} mb={8}>
                <Stat bg="#a59480" p={6} borderRadius="lg" border="1px solid #ecede8">
                  <StatLabel fontSize="lg" fontFamily="'Montserrat', sans-serif" fontWeight="bold">
                    Total Reminders
                  </StatLabel>
                  <StatNumber fontSize="3xl" fontFamily="'Montserrat', sans-serif">
                    {reminderStats.total}
                  </StatNumber>
                </Stat>
                <Stat bg="#a59480" p={6} borderRadius="lg" border="1px solid #ecede8">
                  <StatLabel fontSize="lg" fontFamily="'Montserrat', sans-serif" fontWeight="bold">
                    Pending
                  </StatLabel>
                  <StatNumber fontSize="3xl" fontFamily="'Montserrat', sans-serif">
                    {reminderStats.pending}
                  </StatNumber>
                </Stat>
                <Stat bg="#a59480" p={6} borderRadius="lg" border="1px solid #ecede8">
                  <StatLabel fontSize="lg" fontFamily="'Montserrat', sans-serif" fontWeight="bold">
                    Sent
                  </StatLabel>
                  <StatNumber fontSize="3xl" fontFamily="'Montserrat', sans-serif">
                    {reminderStats.sent}
                  </StatNumber>
                </Stat>
                <Stat bg="#a59480" p={6} borderRadius="lg" border="1px solid #ecede8">
                  <StatLabel fontSize="lg" fontFamily="'Montserrat', sans-serif" fontWeight="bold">
                    Failed
                  </StatLabel>
                  <StatNumber fontSize="3xl" fontFamily="'Montserrat', sans-serif">
                    {reminderStats.failed}
                  </StatNumber>
                </Stat>
                <Stat bg="#a59480" p={6} borderRadius="lg" border="1px solid #ecede8">
                  <StatLabel fontSize="lg" fontFamily="'Montserrat', sans-serif" fontWeight="bold">
                    Templates
                  </StatLabel>
                  <StatNumber fontSize="3xl" fontFamily="'Montserrat', sans-serif">
                    {reminderTemplates.length}
                  </StatNumber>
                </Stat>
              </SimpleGrid>

              {/* Action Buttons */}
              <HStack spacing={4} mb={6}>
                <Button
                  colorScheme="blue"
                  onClick={() => {
                    resetReminderForm();
                    onReminderOpen();
                  }}
                  fontFamily="'Montserrat', sans-serif"
                >
                  Create Reminder Template
                </Button>
                <Button
                  colorScheme="green"
                  onClick={processReservationReminders}
                  isLoading={processingReminders}
                  fontFamily="'Montserrat', sans-serif"
                >
                  Process Reservation Reminders
                </Button>
              </HStack>
            </>
          )}

          {/* Templates Tables */}
          {activeTab === 'campaigns' && (
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
          )}

          {activeTab === 'reminders' && (
            <Box bg="#a59480" borderRadius="lg" border="1px solid #ecede8" overflow="hidden">
              <Table variant="simple">
                <Thead>
                  <Tr>
                    <Th fontFamily="'Montserrat', sans-serif" color="#23201C">Name</Th>
                    <Th fontFamily="'Montserrat', sans-serif" color="#23201C">Description</Th>
                    <Th fontFamily="'Montserrat', sans-serif" color="#23201C">Type</Th>
                    <Th fontFamily="'Montserrat', sans-serif" color="#23201C">Send Time</Th>
                    <Th fontFamily="'Montserrat', sans-serif" color="#23201C">Status</Th>
                    <Th fontFamily="'Montserrat', sans-serif" color="#23201C">Actions</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {reminderTemplates.map((template) => (
                    <Tr key={template.id}>
                      <Td fontFamily="'Montserrat', sans-serif" fontWeight="bold">
                        {template.name}
                      </Td>
                      <Td fontFamily="'Montserrat', sans-serif">
                        {template.description || '-'}
                      </Td>
                      <Td fontFamily="'Montserrat', sans-serif">
                        <Badge
                          colorScheme={template.reminder_type === 'day_of' ? 'blue' : 'purple'}
                          fontFamily="'Montserrat', sans-serif"
                        >
                          {template.reminder_type === 'day_of' ? 'Day Of' : 'Hour Before'}
                        </Badge>
                      </Td>
                      <Td fontFamily="'Montserrat', sans-serif">
                        {template.reminder_type === 'day_of' ? template.send_time : `${template.send_time} hours before`}
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
                            aria-label="Test reminder template"
                            icon={<ViewIcon />}
                            size="sm"
                            colorScheme="blue"
                            onClick={() => handleReminderTest(template)}
                          />
                          <IconButton
                            aria-label="Edit reminder template"
                            icon={<EditIcon />}
                            size="sm"
                            colorScheme="yellow"
                            onClick={() => handleReminderEdit(template)}
                          />
                          <IconButton
                            aria-label="Delete reminder template"
                            icon={<DeleteIcon />}
                            size="sm"
                            colorScheme="red"
                            onClick={() => handleReminderDelete(template.id)}
                          />
                        </HStack>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </Box>

            {/* Pending Messages Table */}
            <Box mt={8} bg="#a59480" borderRadius="lg" border="1px solid #ecede8" overflow="hidden">
              <Box p={4} bg="#8B7A6A" borderBottom="1px solid #ecede8">
                <Heading size="md" fontFamily="'Montserrat', sans-serif" color="#23201C">
                  Pending Reminder Messages
                </Heading>
                <Text fontSize="sm" fontFamily="'Montserrat', sans-serif" color="#23201C" mt={1}>
                  {pendingReminders.length} pending message{pendingReminders.length !== 1 ? 's' : ''}
                </Text>
              </Box>
              {pendingReminders.length === 0 ? (
                <Box p={8} textAlign="center">
                  <Text fontFamily="'Montserrat', sans-serif" color="#23201C">
                    No pending reminder messages
                  </Text>
                </Box>
              ) : (
                <Table variant="simple">
                  <Thead>
                    <Tr>
                      <Th fontFamily="'Montserrat', sans-serif" color="#23201C">Customer</Th>
                      <Th fontFamily="'Montserrat', sans-serif" color="#23201C">Reservation</Th>
                      <Th fontFamily="'Montserrat', sans-serif" color="#23201C">Template</Th>
                      <Th fontFamily="'Montserrat', sans-serif" color="#23201C">Message</Th>
                      <Th fontFamily="'Montserrat', sans-serif" color="#23201C">Scheduled For</Th>
                      <Th fontFamily="'Montserrat', sans-serif" color="#23201C">Actions</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {pendingReminders.map((reminder) => (
                      <Tr key={reminder.id}>
                        <Td>
                          <VStack align="start" spacing={1}>
                            <Text fontFamily="'Montserrat', sans-serif" fontWeight="bold">
                              {reminder.customer_name}
                            </Text>
                            <Text fontFamily="'Montserrat', sans-serif" fontSize="sm" color="#666">
                              {reminder.customer_phone}
                            </Text>
                          </VStack>
                        </Td>
                        <Td>
                          <VStack align="start" spacing={1}>
                            <Text fontFamily="'Montserrat', sans-serif">
                              {new Date(reminder.reservation.start_time).toLocaleDateString()} at{' '}
                              {new Date(reminder.reservation.start_time).toLocaleTimeString([], { 
                                hour: 'numeric', 
                                minute: '2-digit',
                                hour12: true 
                              })}
                            </Text>
                            <Text fontFamily="'Montserrat', sans-serif" fontSize="sm" color="#666">
                              {reminder.reservation.party_size} guest{reminder.reservation.party_size !== 1 ? 's' : ''}
                            </Text>
                          </VStack>
                        </Td>
                        <Td>
                          <VStack align="start" spacing={1}>
                            <Text fontFamily="'Montserrat', sans-serif" fontWeight="bold">
                              {reminder.template.name}
                            </Text>
                            <Badge
                              colorScheme={reminder.template.reminder_type === 'day_of' ? 'blue' : 'purple'}
                              fontFamily="'Montserrat', sans-serif"
                              fontSize="xs"
                            >
                              {reminder.template.reminder_type === 'day_of' ? 'Day Of' : 'Hour Before'}
                            </Badge>
                          </VStack>
                        </Td>
                        <Td>
                          <Text fontFamily="'Montserrat', sans-serif" fontSize="sm" maxW="300px" noOfLines={3}>
                            {reminder.message_content}
                          </Text>
                        </Td>
                        <Td>
                          <VStack align="start" spacing={1}>
                            <Text fontFamily="'Montserrat', sans-serif">
                              {new Date(reminder.scheduled_for).toLocaleDateString()}
                            </Text>
                            <Text fontFamily="'Montserrat', sans-serif" fontSize="sm" color="#666">
                              {new Date(reminder.scheduled_for).toLocaleTimeString([], { 
                                hour: 'numeric', 
                                minute: '2-digit',
                                hour12: true 
                              })}
                            </Text>
                          </VStack>
                        </Td>
                        <Td>
                          <Button
                            size="sm"
                            colorScheme="green"
                            onClick={() => sendIndividualReminder(reminder.id)}
                            isLoading={sendingIndividualReminder === reminder.id}
                            loadingText="Sending"
                            fontFamily="'Montserrat', sans-serif"
                          >
                            Send Now
                          </Button>
                        </Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              )}
            </Box>
          )}

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
                        Use {'{{first_name}}'} to include the member's first name
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

          {/* Test Reminder Message Modal */}
          <Modal isOpen={isReminderTestOpen} onClose={onReminderTestClose} size="lg">
            <ModalOverlay />
            <ModalContent bg="#a59480" color="#23201C">
              <ModalHeader fontFamily="'Montserrat', sans-serif">
                Test Reminder Template Message
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
                      {getReminderPreviewMessage()}
                    </Box>
                  </FormControl>
                </VStack>
              </ModalBody>

              <ModalFooter>
                <Button variant="ghost" mr={3} onClick={onReminderTestClose} fontFamily="'Montserrat', sans-serif">
                  Cancel
                </Button>
                <Button onClick={sendReminderTestMessage} colorScheme="green" fontFamily="'Montserrat', sans-serif">
                  Send Test Reminder Message
                </Button>
              </ModalFooter>
            </ModalContent>
          </Modal>
        </Box>
      </Box>
    </AdminLayout>
  );
} 