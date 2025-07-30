import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Heading,
  VStack,
  HStack,
  Text,
  useToast,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  IconButton,
  Badge,
  Stat,
  StatLabel,
  StatNumber,
  SimpleGrid,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  FormControl,
  FormLabel,
  Input,
  Select,
  Switch,
  useDisclosure
} from '@chakra-ui/react';
import { EditIcon, DeleteIcon, ViewIcon, ArrowForwardIcon } from '@chakra-ui/icons';
import AdminLayout from '../../components/layouts/AdminLayout';
import ReminderEditDrawer from '../../components/ReminderEditDrawer';
import SimplifiedReminderTemplateEditDrawer from '../../components/SimplifiedReminderTemplateEditDrawer';
import { DateTime } from 'luxon';
import { useSettings } from '../../context/SettingsContext';

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
  quantity: number;
  time_unit: 'hr' | 'min' | 'day';
  proximity: 'before' | 'after';
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

interface PendingCampaignMessage {
  id: string;
  message_content: string;
  scheduled_for: string;
  created_at: string;
  members: {
    first_name: string;
    last_name: string;
    phone: string;
  };
  campaign_templates: {
    id: string;
    name: string;
    default_delay_days: number;
    default_send_time: string;
  };
  member_campaigns: {
    id: string;
    campaign_status: string;
    activation_date: string;
  };
}

interface PendingReservationReminder {
  id: string;
  customer_name: string;
  customer_phone: string;
  message_content: string;
  scheduled_for: string;
  created_at: string;
  reservation_id: string;
  reservations: {
    id: string;
    first_name: string;
    last_name: string;
    phone: string;
    start_time: string;
    party_size: number;
    status: string;
  };
  reservation_reminder_templates: {
    id: string;
    name: string;
    quantity: number;
    time_unit: string;
    proximity: string;
  };
}

interface EditReservationData {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  start_time: string;
  party_size: number;
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<CampaignTemplate[]>([]);
  const [stats, setStats] = useState<TemplateStats>({ total: 0, pending: 0, sent: 0, failed: 0, cancelled: 0 });
  const [loading, setLoading] = useState(true);
  const [reminderTemplates, setReminderTemplates] = useState<ReservationReminderTemplate[]>([]);
  const [reminderStats, setReminderStats] = useState<TemplateStats>({ total: 0, pending: 0, sent: 0, failed: 0, cancelled: 0 });
  const [processingReminders, setProcessingReminders] = useState(false);
  const [pendingCampaignMessages, setPendingCampaignMessages] = useState<PendingCampaignMessage[]>([]);
  const [pendingReservationReminders, setPendingReservationReminders] = useState<PendingReservationReminder[]>([]);
  const [sendingIndividualMessage, setSendingIndividualMessage] = useState<string | null>(null);
  const [sendingIndividualReminder, setSendingIndividualReminder] = useState<string | null>(null);
  const [deletingReminder, setDeletingReminder] = useState<string | null>(null);
  const [isReminderDrawerOpen, setIsReminderDrawerOpen] = useState(false);
  const [selectedReminderId, setSelectedReminderId] = useState<string | null>(null);
  const [isTemplateDrawerOpen, setIsTemplateDrawerOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [isCreateMode, setIsCreateMode] = useState(false);
  const toast = useToast();
  const { settings } = useSettings();
  const businessTimezone = settings?.timezone || 'America/Chicago';

  const fetchReminderTemplates = async () => {
    console.log('📡 fetchReminderTemplates called...');
    try {
      const response = await fetch('/api/reservation-reminder-templates');
      const data = await response.json();
      console.log('📡 fetchReminderTemplates response:', data);
      if (response.ok) {
        setReminderTemplates(data || []);
        console.log('✅ Reminder templates updated:', data?.length || 0, 'templates');
      } else {
        console.error('❌ fetchReminderTemplates error:', data.error);
        toast({
          title: 'Error',
          description: data.error || 'Failed to fetch reminder templates',
          status: 'error',
          duration: 3000,
        });
      }
    } catch (error) {
      console.error('❌ fetchReminderTemplates exception:', error);
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

  const fetchPendingCampaignMessages = async () => {
    try {
      const response = await fetch('/api/pending-campaign-messages');
      const data = await response.json();
      if (response.ok) {
        setPendingCampaignMessages(data.pendingMessages || []);
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to fetch pending campaign messages',
          status: 'error',
          duration: 3000,
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to fetch pending campaign messages',
        status: 'error',
        duration: 3000,
      });
    }
  };

  const fetchPendingReservationReminders = async () => {
    try {
      const response = await fetch('/api/pending-reservation-reminders');
      const data = await response.json();
      if (response.ok) {
        setPendingReservationReminders(data.pendingReminders || []);
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to fetch pending reservation reminders',
          status: 'error',
          duration: 3000,
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to fetch pending reservation reminders',
        status: 'error',
        duration: 3000,
      });
    }
  };

  useEffect(() => {
    fetchTemplates();
    fetchStats();
    fetchReminderTemplates();
    fetchReminderStats();
    fetchPendingCampaignMessages();
    fetchPendingReservationReminders();
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

  const sendIndividualCampaignMessage = async (id: string) => {
    setSendingIndividualMessage(id);
    try {
      const response = await fetch('/api/pending-campaign-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message_id: id })
      });
      const data = await response.json();
      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Campaign message sent successfully',
          status: 'success',
          duration: 3000,
        });
        fetchPendingCampaignMessages();
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to send campaign message',
          status: 'error',
          duration: 3000,
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to send campaign message',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setSendingIndividualMessage(null);
    }
  };

  const sendIndividualReservationReminder = async (id: string) => {
    setSendingIndividualReminder(id);
    try {
      const response = await fetch('/api/pending-reservation-reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reminder_id: id })
      });
      const data = await response.json();
      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Reservation reminder sent successfully',
          status: 'success',
          duration: 3000,
        });
        fetchPendingReservationReminders();
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to send reservation reminder',
          status: 'error',
          duration: 3000,
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to send reservation reminder',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setSendingIndividualReminder(null);
    }
  };

  const deleteReservationReminder = async (id: string) => {
    setDeletingReminder(id);
    try {
      const response = await fetch(`/api/delete-reservation-reminder?reminder_id=${id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Reminder deleted successfully',
          status: 'success',
          duration: 3000,
        });
        // Refresh the pending reminders
        fetchPendingReservationReminders();
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to delete reminder',
          status: 'error',
          duration: 3000,
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete reminder',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setDeletingReminder(null);
    }
  };

  const handleEditReminder = (reminder: PendingReservationReminder) => {
    setSelectedReminderId(reminder.id);
    setIsReminderDrawerOpen(true);
  };

  const handleReminderUpdated = () => {
    fetchReminderTemplates();
    fetchPendingReservationReminders();
  };

  const handleTemplateUpdated = () => {
    console.log('🔄 handleTemplateUpdated called - refreshing reminder templates...');
    fetchReminderTemplates();
  };

  // Template management functions
  const handleEditTemplate = (template: CampaignTemplate) => {
    // TODO: Implement edit template functionality
    toast({
      title: 'Edit Template',
      description: 'Edit template functionality coming soon',
      status: 'info',
      duration: 3000,
    });
  };

  const handleDeleteTemplate = async (id: string) => {
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

  const handleTestTemplate = (template: CampaignTemplate) => {
    // TODO: Implement test template functionality
    toast({
      title: 'Test Template',
      description: 'Test template functionality coming soon',
      status: 'info',
      duration: 3000,
    });
  };

  // Reminder template management functions
  const handleEditReminderTemplate = (template: ReservationReminderTemplate) => {
    setSelectedTemplateId(template.id);
    setIsCreateMode(false);
    setIsTemplateDrawerOpen(true);
  };

  const handleDeleteReminderTemplate = async (id: string) => {
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

  const handleTestReminderTemplate = (template: ReservationReminderTemplate) => {
    // TODO: Implement test reminder template functionality
    toast({
      title: 'Test Reminder Template',
      description: 'Test reminder template functionality coming soon',
      status: 'info',
      duration: 3000,
    });
  };

  const handleCreateReminderTemplate = () => {
    setSelectedTemplateId(null);
    setIsCreateMode(true);
    setIsTemplateDrawerOpen(true);
  };

  const handleToggleTemplateActive = async (template: ReservationReminderTemplate) => {
    try {
      const response = await fetch(`/api/reservation-reminder-templates?id=${template.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: template.name,
          description: template.description,
          message_template: template.message_template,
          quantity: template.quantity,
          time_unit: template.time_unit,
          proximity: template.proximity,
          is_active: !template.is_active
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update template status');
      }

      // If we're deactivating the template, also cancel pending reminders
      if (template.is_active) {
        try {
          const cancelResponse = await fetch('/api/cancel-pending-reminders', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              template_id: template.id
            }),
          });

          if (cancelResponse.ok) {
            const cancelData = await cancelResponse.json();
            toast({
              title: 'Success',
              description: `Template deactivated and ${cancelData.cancelled_count || 0} pending reminders cancelled`,
              status: 'success',
              duration: 3000,
            });
          } else {
            toast({
              title: 'Success',
              description: `Template deactivated successfully`,
              status: 'success',
              duration: 3000,
            });
          }
        } catch (cancelError) {
          console.error('Error cancelling pending reminders:', cancelError);
          toast({
            title: 'Success',
            description: `Template deactivated successfully`,
            status: 'success',
            duration: 3000,
          });
        }
      } else {
        toast({
          title: 'Success',
          description: `Template activated successfully`,
          status: 'success',
          duration: 3000,
        });
      }

      // Refresh the templates list and pending reminders
      fetchReminderTemplates();
      fetchPendingReservationReminders();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update template status',
        status: 'error',
        duration: 5000,
      });
    }
  };

  // Helper to format send time
  function formatSendTime(template) {
    if (template.quantity === 0) {
      return 'Day of reservation';
    } else {
      const unit = template.quantity === 1 ? template.time_unit : template.time_unit + 's';
      return `${template.quantity} ${unit} ${template.proximity}`;
    }
  }

  return (
    <AdminLayout>
      <ReminderEditDrawer
        isOpen={isReminderDrawerOpen}
        onClose={() => setIsReminderDrawerOpen(false)}
        reminderId={selectedReminderId}
        onReminderUpdated={handleReminderUpdated}
      />
      <SimplifiedReminderTemplateEditDrawer
        isOpen={isTemplateDrawerOpen}
        onClose={() => setIsTemplateDrawerOpen(false)}
        templateId={selectedTemplateId}
        isCreateMode={isCreateMode}
        onTemplateUpdated={handleTemplateUpdated}
      />
      <Box p={4} minH="100vh" bg="#353535" color="#ECEDE8">
        <Box position="relative" ml={10} mr={10} zIndex={1} pt={28}>
          <Heading mb={6} fontFamily="'Montserrat', sans-serif" color="#a59480">
            Message Templates & Auto-Reminders
          </Heading>
          <Tabs variant="enclosed" colorScheme="blue" fontFamily="'Montserrat', sans-serif">
            <TabList>
              <Tab>Member Campaigns</Tab>
              <Tab>Reservation Reminders</Tab>
              <Tab>Pending Messages</Tab>
            </TabList>
            <TabPanels>
              {/* Member Campaigns Tab */}
              <TabPanel>
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
                <HStack spacing={4} mb={6}>
                  <Button colorScheme="blue" fontFamily="'Montserrat', sans-serif">
                    Create Template
                  </Button>
                  <Button colorScheme="green" fontFamily="'Montserrat', sans-serif">
                    Process Scheduled Messages
                  </Button>
                </HStack>
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
                            <Badge colorScheme={template.is_active ? 'green' : 'red'} fontFamily="'Montserrat', sans-serif">
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
                                onClick={() => handleTestTemplate(template)}
                              />
                              <IconButton 
                                aria-label="Edit template" 
                                icon={<EditIcon />} 
                                size="sm" 
                                colorScheme="yellow" 
                                onClick={() => handleEditTemplate(template)}
                              />
                              <IconButton 
                                aria-label="Delete template" 
                                icon={<DeleteIcon />} 
                                size="sm" 
                                colorScheme="red" 
                                onClick={() => handleDeleteTemplate(template.id)}
                              />
                            </HStack>
                          </Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                </Box>
              </TabPanel>
              {/* Reservation Reminders Tab */}
              <TabPanel>
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
                <HStack spacing={4} mb={6}>
                  <Button 
                    colorScheme="blue" 
                    fontFamily="'Montserrat', sans-serif"
                    onClick={handleCreateReminderTemplate}
                  >
                    Create Reminder Template
                  </Button>
                  <Button colorScheme="green" fontFamily="'Montserrat', sans-serif" isLoading={processingReminders}>
                    Process Reservation Reminders
                  </Button>
                </HStack>
                <Box bg="#ecede8" borderRadius="lg" border="2px solid #a59480" overflow="hidden" mt={4}>
                  <Table variant="simple" style={{ background: '#ecede8', color: '#353535', borderColor: '#a59480' }}>
                    <Thead style={{ background: '#ecede8', color: '#353535', borderColor: '#a59480' }}>
                      <Tr>
                        <Th fontFamily="'Montserrat', sans-serif" color="#353535" borderColor="#a59480">Name</Th>
                        <Th fontFamily="'Montserrat', sans-serif" color="#353535" borderColor="#a59480">Timing</Th>
                        <Th fontFamily="'Montserrat', sans-serif" color="#353535" borderColor="#a59480">Message</Th>
                        <Th fontFamily="'Montserrat', sans-serif" color="#353535" borderColor="#a59480">Status</Th>
                        <Th fontFamily="'Montserrat', sans-serif" color="#353535" borderColor="#a59480">Actions</Th>
                      </Tr>
                    </Thead>
                    <Tbody style={{ background: '#ecede8', color: '#353535', borderColor: '#a59480' }}>
                      {reminderTemplates.map((template) => (
                        <Tr key={template.id} style={{ verticalAlign: 'top', background: '#ecede8', color: '#353535', borderColor: '#a59480' }}>
                          <Td fontFamily="'Montserrat', sans-serif" fontWeight="bold" color="#353535" borderColor="#a59480">{template.name}</Td>
                          <Td fontFamily="'Montserrat', sans-serif" color="#353535" borderColor="#a59480">{formatSendTime(template)}</Td>
                          <Td fontFamily="'Montserrat', sans-serif" style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: 'sm', maxWidth: 400, background: '#f7f5f2', borderRadius: 8, padding: 8, color: '#353535', borderColor: '#a59480' }}>{template.message_template}</Td>
                          <Td borderColor="#a59480">
                            <Box 
                              border="2px solid #a59480" 
                              borderRadius="md" 
                              p={0}
                              margin="0"
                              width="100px"
                              bg={template.is_active ? "#22c55e" : "#ef4444"}
                              cursor="pointer"
                              onClick={() => handleToggleTemplateActive(template)}
                              textAlign="center"
                            >
                              <Text 
                                fontSize="sm" 
                                fontFamily="'Montserrat', sans-serif" 
                                color="#FFF"
                                fontWeight="bold"
                              >
                                {template.is_active ? 'ACTIVE' : 'INACTIVE'}
                              </Text>
                            </Box>
                          </Td>
                          <Td borderColor="#a59480">
                            <HStack spacing={2} align="flex-start">
                              <IconButton aria-label="Test template" icon={<ViewIcon />} size="md" colorScheme="blue" onClick={() => handleTestReminderTemplate(template)} />
                              <IconButton aria-label="Edit reminder template" icon={<EditIcon />} size="sm" colorScheme="yellow" onClick={() => handleEditReminderTemplate(template)} />
                              <IconButton aria-label="Delete reminder template" icon={<DeleteIcon />} size="sm" colorScheme="red" onClick={() => handleDeleteReminderTemplate(template.id)} />
                            </HStack>
                          </Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                </Box>
              </TabPanel>
              {/* Pending Messages Tab */}
              <TabPanel>
                <VStack spacing={8} align="stretch">
                  {/* Campaign Messages Section */}
                  <Box>
                    <Heading size="md" mb={4} fontFamily="'Montserrat', sans-serif" color="#a59480">
                      Pending Campaign Messages ({pendingCampaignMessages.length})
                    </Heading>
                    {pendingCampaignMessages.length === 0 ? (
                      <Box p={8} textAlign="center" bg="#a59480" borderRadius="lg" border="1px solid #ecede8">
                        <Text fontFamily="'Montserrat', sans-serif" color="#23201C">
                          No pending campaign messages
                        </Text>
                      </Box>
                    ) : (
                      <Box bg="#a59480" borderRadius="lg" border="1px solid #ecede8" overflow="hidden">
                        <Table variant="simple">
                          <Thead>
                            <Tr>
                              <Th fontFamily="'Montserrat', sans-serif" color="#23201C">Member</Th>
                              <Th fontFamily="'Montserrat', sans-serif" color="#23201C">Template</Th>
                              <Th fontFamily="'Montserrat', sans-serif" color="#23201C">Message</Th>
                              <Th fontFamily="'Montserrat', sans-serif" color="#23201C">Scheduled For</Th>
                              <Th fontFamily="'Montserrat', sans-serif" color="#23201C">Actions</Th>
                            </Tr>
                          </Thead>
                          <Tbody>
                            {pendingCampaignMessages.map((message) => (
                              <Tr key={message.id}>
                                <Td fontFamily="'Montserrat', sans-serif">
                                  <VStack align="start" spacing={1}>
                                    <Text fontWeight="bold">
                                      {message.members.first_name} {message.members.last_name}
                                    </Text>
                                    <Text fontSize="sm" color="#666">
                                      {message.members.phone}
                                    </Text>
                                  </VStack>
                                </Td>
                                <Td fontFamily="'Montserrat', sans-serif">
                                  <Text fontWeight="bold">{message.campaign_templates.name}</Text>
                                  <Text fontSize="sm" color="#666">
                                    {message.campaign_templates.default_delay_days} days after activation
                                  </Text>
                                </Td>
                                <Td fontFamily="'Montserrat', sans-serif" maxW="300px">
                                  <Text 
                                    noOfLines={3} 
                                    color="#23201C"
                                    whiteSpace="pre-wrap"
                                    fontFamily="monospace"
                                    fontSize="sm"
                                  >
                                    {message.message_content}
                                  </Text>
                                </Td>
                                <Td fontFamily="'Montserrat', sans-serif" style={{ minWidth: 180 }}>
                                  {DateTime.fromISO(message.scheduled_for, { zone: 'utc' }).setZone(businessTimezone).toFormat('MMM d, yyyy h:mm a')}
                                </Td>
                                <Td>
                                  <IconButton
                                    aria-label="Send message now"
                                    icon={<ArrowForwardIcon />}
                                    size="sm"
                                    colorScheme="green"
                                    onClick={() => sendIndividualCampaignMessage(message.id)}
                                    isLoading={sendingIndividualMessage === message.id}
                                  />
                                </Td>
                              </Tr>
                            ))}
                          </Tbody>
                        </Table>
                      </Box>
                    )}
                  </Box>
                  {/* Reservation Reminders Section */}
                  <Box>
                    <Heading size="md" mb={4} fontFamily="'Montserrat', sans-serif" color="#a59480">
                      Pending Reservation Reminders ({pendingReservationReminders.length})
                    </Heading>
                    {pendingReservationReminders.length === 0 ? (
                      <Box p={8} textAlign="center" bg="#a59480" borderRadius="lg" border="1px solid #ecede8">
                        <Text fontFamily="'Montserrat', sans-serif" color="#23201C">
                          No pending reservation reminders
                        </Text>
                      </Box>
                    ) : (
                      <Box bg="#ecede8" borderRadius="lg" border="2px solid #a59480" overflow="hidden" mt={4} style={{ width: '90%', margin: '0 auto' }}>
                        <Table variant="simple" style={{ background: '#ecede8', color: '#353535', borderColor: '#a59480' }}>
                          <Thead style={{ background: '#ecede8', color: '#353535', borderColor: '#a59480' }}>
                            <Tr>
                              <Th fontFamily="'Montserrat', sans-serif" color="#353535" borderColor="#a59480">Phone Number</Th>
                              <Th fontFamily="'Montserrat', sans-serif" color="#353535" borderColor="#a59480">Customer Name</Th>
                              <Th fontFamily="'Montserrat', sans-serif" color="#353535" borderColor="#a59480">Reservation Date & Time</Th>
                              <Th fontFamily="'Montserrat', sans-serif" color="#353535" borderColor="#a59480">Message</Th>
                              <Th fontFamily="'Montserrat', sans-serif" color="#353535" borderColor="#a59480">Scheduled to Send</Th>
                              <Th fontFamily="'Montserrat', sans-serif" color="#353535" borderColor="#a59480">Actions</Th>
                            </Tr>
                          </Thead>
                          <Tbody style={{ background: '#ecede8', color: '#353535', borderColor: '#a59480' }}>
                            {pendingReservationReminders.map((reminder) => (
                              <Tr key={reminder.id} style={{ verticalAlign: 'top', background: '#ecede8', color: '#353535', borderColor: '#a59480' }}>
                                <Td fontFamily="'Montserrat', sans-serif" color="#353535" borderColor="#a59480">{reminder.customer_phone}</Td>
                                <Td fontFamily="'Montserrat', sans-serif" color="#353535" borderColor="#a59480">{reminder.customer_name}</Td>
                                <Td fontFamily="'Montserrat', sans-serif" color="#353535" borderColor="#a59480">
                                  {reminder.reservations && reminder.reservations.start_time
                                    ? DateTime.fromISO(reminder.reservations.start_time, { zone: 'utc' }).setZone(businessTimezone).toFormat('M/d/yyyy hh:mm a')
                                    : ''}
                                </Td>
                                <Td fontFamily="'Montserrat', sans-serif" style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: 'sm', maxWidth: 400, background: '#f7f5f2', borderRadius: 8, padding: 8, color: '#353535', borderColor: '#a59480' }}>{reminder.message_content}</Td>
                                <Td fontFamily="'Montserrat', sans-serif" color="#353535" borderColor="#a59480">
                                  {reminder.scheduled_for
                                    ? DateTime.fromISO(reminder.scheduled_for, { zone: 'utc' }).setZone(businessTimezone).toFormat('M/d/yyyy hh:mm a')
                                    : ''}
                                </Td>
                                <Td borderColor="#a59480">
                                  <HStack spacing={2} align="flex-start">
                                    <IconButton aria-label="Send reminder now" icon={<ArrowForwardIcon />} size="sm" colorScheme="green" onClick={() => sendIndividualReservationReminder(reminder.id)} isLoading={sendingIndividualReminder === reminder.id} />
                                    <IconButton aria-label="Edit reminder" icon={<EditIcon />} size="sm" colorScheme="yellow" onClick={() => handleEditReminder(reminder)} />
                                    <IconButton aria-label="Delete reminder" icon={<DeleteIcon />} size="sm" colorScheme="red" onClick={() => deleteReservationReminder(reminder.id)} isLoading={deletingReminder === reminder.id} />
                                  </HStack>
                                </Td>
                              </Tr>
                            ))}
                          </Tbody>
                        </Table>
                      </Box>
                    )}
                  </Box>
                </VStack>
              </TabPanel>
            </TabPanels>
          </Tabs>
        </Box>
      </Box>
    </AdminLayout>
  );
} 