import React, { useState, useEffect } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
  Switch,
  IconButton,
  useToast,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  useDisclosure,
} from '@chakra-ui/react';
import { EditIcon, DeleteIcon, AddIcon, ViewIcon } from '@chakra-ui/icons';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabase';
import AdminLayout from '../../components/layouts/AdminLayout';
import CampaignDrawer from '../../components/CampaignDrawer';
import CampaignTemplateDrawer from '../../components/CampaignTemplateDrawer';
import SimplifiedReminderTemplateEditDrawer from '../../components/SimplifiedReminderTemplateEditDrawer';
import { sortCampaignTemplates } from '../../utils/campaignSorting';

interface Campaign {
  id: string;
  campaign_id: string;
  name: string;
  description: string;
  trigger_type: 'member_signup' | 'member_birthday' | 'member_renewal' | 'reservation_time';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface CampaignTemplate {
  id: string;
  campaign_id: string;
  name: string;
  description: string;
  content: string;
  recipient_type: 'member' | 'all_members' | 'specific_phone';
  specific_phone?: string;
  timing_type: 'specific_time' | 'duration';
  specific_time?: string;
  duration_quantity?: number;
  duration_unit?: 'min' | 'hr' | 'day' | 'month' | 'year';
  duration_proximity?: 'before' | 'after';
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

export default function CommunicationPage() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignTemplates, setCampaignTemplates] = useState<CampaignTemplate[]>([]);
  const [reminderTemplates, setReminderTemplates] = useState<ReservationReminderTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [isCampaignDrawerOpen, setIsCampaignDrawerOpen] = useState(false);
  const [isTemplateDrawerOpen, setIsTemplateDrawerOpen] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [isCampaignCreateMode, setIsCampaignCreateMode] = useState(false);
  const [isTemplateCreateMode, setIsTemplateCreateMode] = useState(false);
  const [isReminderDrawerOpen, setIsReminderDrawerOpen] = useState(false);
  const [selectedReminderId, setSelectedReminderId] = useState<string | null>(null);
  const [isReminderCreateMode, setIsReminderCreateMode] = useState(false);
  const toast = useToast();

  useEffect(() => {
    fetchCampaigns();
    fetchReminderTemplates();
  }, []);

  const fetchCampaigns = async () => {
    try {
      const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        // If table doesn't exist yet, show empty state
        if (error.code === '42P01') { // Table doesn't exist
          console.log('Campaigns table not found - run migration first');
          setCampaigns([]);
          return;
        }
        throw error;
      }
      setCampaigns(data || []);
    } catch (error) {
      console.error('Error fetching campaigns:', error);
      // Don't show error toast if table doesn't exist - just set empty array
      if (error.code !== '42P01') {
        toast({
          title: 'Error',
          description: 'Failed to fetch campaigns',
          status: 'error',
          duration: 3000,
        });
      }
      setCampaigns([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchCampaignTemplates = async (campaignId: string) => {
    try {
      const response = await fetch(`/api/campaign-messages?campaign_id=${campaignId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch campaign templates');
      }
      const data = await response.json();
      
      // Sort templates by proximity to trigger event
      const sortedTemplates = sortCampaignTemplates(data || []);
      console.log('Sorted campaign templates:', sortedTemplates);
      
      setCampaignTemplates(sortedTemplates);
    } catch (error) {
      console.error('Error fetching campaign templates:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch campaign templates',
        status: 'error',
        duration: 3000,
      });
      setCampaignTemplates([]);
    }
  };

  const fetchReminderTemplates = async () => {
    try {
      const response = await fetch('/api/reservation-reminder-templates');
      const data = await response.json();
      if (response.ok) {
        setReminderTemplates(data || []);
      } else {
        console.error('Error fetching reminder templates:', data.error);
      }
    } catch (error) {
      console.error('Error fetching reminder templates:', error);
    }
  };

  const handleCreateCampaign = () => {
    setIsCampaignCreateMode(true);
    setSelectedCampaignId(null);
    setIsCampaignDrawerOpen(true);
  };

  const handleEditCampaign = (campaign: Campaign) => {
    router.push(`/admin/campaigns/${campaign.id}`);
  };

  const handleDeleteCampaign = async (id: string) => {
    if (!confirm('Are you sure you want to delete this campaign? This will also delete all associated templates.')) return;

    try {
      const { error } = await supabase
        .from('campaigns')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Campaign deleted successfully',
        status: 'success',
        duration: 3000,
      });

      fetchCampaigns();
    } catch (error) {
      console.error('Error deleting campaign:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete campaign',
        status: 'error',
        duration: 3000,
      });
    }
  };

  const handleToggleCampaignActive = async (campaign: Campaign) => {
    try {
      const { error } = await supabase
        .from('campaigns')
        .update({ is_active: !campaign.is_active })
        .eq('id', campaign.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: `Campaign ${campaign.is_active ? 'deactivated' : 'activated'} successfully`,
        status: 'success',
        duration: 3000,
      });

      fetchCampaigns();
    } catch (error) {
      console.error('Error updating campaign:', error);
      toast({
        title: 'Error',
        description: 'Failed to update campaign',
        status: 'error',
        duration: 3000,
      });
    }
  };

  const handleCampaignUpdated = () => {
    fetchCampaigns();
  };

  const handleViewCampaignTemplates = (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    fetchCampaignTemplates(campaign.id);
  };

  const handleCreateTemplate = () => {
    if (!selectedCampaign) return;
    setIsTemplateCreateMode(true);
    setSelectedTemplateId(null);
    setIsTemplateDrawerOpen(true);
  };

  const handleEditTemplate = (template: CampaignTemplate) => {
    setIsTemplateCreateMode(false);
    setSelectedTemplateId(template.id);
    setIsTemplateDrawerOpen(true);
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;

    try {
      const response = await fetch(`/api/campaign-messages/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete template');
      }

      toast({
        title: 'Success',
        description: 'Template deleted successfully',
        status: 'success',
        duration: 3000,
      });

      if (selectedCampaign) {
        fetchCampaignTemplates(selectedCampaign.id);
      }
    } catch (error) {
      console.error('Error deleting template:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete template',
        status: 'error',
        duration: 3000,
      });
    }
  };

  const handleToggleTemplateActive = async (template: CampaignTemplate) => {
    try {
      const response = await fetch(`/api/campaign-messages/${template.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ is_active: !template.is_active }),
      });

      if (!response.ok) {
        throw new Error('Failed to update template');
      }

      toast({
        title: 'Success',
        description: `Template ${template.is_active ? 'deactivated' : 'activated'} successfully`,
        status: 'success',
        duration: 3000,
      });

      if (selectedCampaign) {
        fetchCampaignTemplates(selectedCampaign.id);
      }
    } catch (error) {
      console.error('Error updating template:', error);
      toast({
        title: 'Error',
        description: 'Failed to update template',
        status: 'error',
        duration: 3000,
      });
    }
  };

  const handleTemplateUpdated = () => {
    if (selectedCampaign) {
      fetchCampaignTemplates(selectedCampaign.id);
    }
  };

  const handleBackToCampaigns = () => {
    setSelectedCampaign(null);
    setCampaignTemplates([]);
  };

  const handleCreateReminderTemplate = () => {
    setIsReminderCreateMode(true);
    setSelectedReminderId(null);
    setIsReminderDrawerOpen(true);
  };

  const handleEditReminderTemplate = (template: ReservationReminderTemplate) => {
    setIsReminderCreateMode(false);
    setSelectedReminderId(template.id);
    setIsReminderDrawerOpen(true);
  };

  const handleReminderTemplateUpdated = () => {
    fetchReminderTemplates();
  };

  const handleToggleReminderActive = async (template: ReservationReminderTemplate) => {
    try {
      const response = await fetch(`/api/reservation-reminder-templates/${template.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          is_active: !template.is_active
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update template');
      }

      toast({
        title: 'Success',
        description: `Template ${template.is_active ? 'deactivated' : 'activated'} successfully`,
        status: 'success',
        duration: 3000,
      });

      fetchReminderTemplates();
    } catch (error) {
      console.error('Error updating reminder template:', error);
      toast({
        title: 'Error',
        description: 'Failed to update template',
        status: 'error',
        duration: 3000,
      });
    }
  };

  const formatTiming = (template: CampaignTemplate) => {
    const parts: string[] = [];
    if (template.timing_type === 'specific_time') {
      return `At ${template.specific_time}`;
    } else {
      if (template.duration_quantity && template.duration_unit) {
        const unit = template.duration_unit === 'hr' ? 'hour' : template.duration_unit;
        const plural = template.duration_quantity !== 1 ? 's' : '';
        parts.push(`${template.duration_quantity} ${unit}${plural}`);
      }
      return `${template.duration_proximity === 'after' ? 'After' : 'Before'} ${parts.join(' ')}`;
    }
  };

  const formatRecipient = (template: CampaignTemplate) => {
    switch (template.recipient_type) {
      case 'member':
        return selectedCampaign?.trigger_type === 'reservation_time' ? 'Phone number on reservation' : 'Primary Member';
      case 'all_members':
        return 'All Members';
      case 'specific_phone':
        return template.specific_phone || 'Custom Phone Number';
      default:
        return 'Unknown';
    }
  };

  if (selectedCampaign) {
    // Show templates for selected campaign
    return (
      <AdminLayout>
        <Box p={8} bg="#f8f9fa" minH="100vh">
        <VStack spacing={6} align="stretch">
          {/* Header with back button */}
          <HStack justify="space-between" align="center">
            <HStack spacing={4}>
              <Button
                onClick={handleBackToCampaigns}
                variant="ghost"
                color="#a59480"
                _hover={{ bg: '#ecede8' }}
                fontFamily="'Montserrat', sans-serif"
              >
                ← Back to Campaigns
              </Button>
              <Text
                fontSize="3xl"
                fontWeight="bold"
                color="#353535"
                fontFamily="'IvyJournal', serif"
                mb={2}
              >
                {selectedCampaign.name}
              </Text>
            </HStack>
            <Button
              onClick={handleCreateTemplate}
              leftIcon={<AddIcon />}
              colorScheme="green"
              size="lg"
              px={8}
              py={6}
              fontSize="lg"
              fontWeight="bold"
              fontFamily="'Montserrat', sans-serif"
              bg="#a59480"
              color="white"
              _hover={{
                bg: '#8a7a66',
                transform: 'translateY(-2px)',
                boxShadow: '0 8px 25px rgba(165, 148, 128, 0.3)',
              }}
              _active={{
                bg: '#7a6a56',
                transform: 'translateY(0)',
              }}
              borderRadius="xl"
              boxShadow="0 4px 15px rgba(165, 148, 128, 0.2)"
            >
              Create New Template
            </Button>
          </HStack>

          {/* Campaign info */}
          <Box bg="#ecede8" borderRadius="lg" p={6} color="#353535">
            <VStack spacing={4} align="stretch">
              <Text fontSize="lg" fontFamily="'Montserrat', sans-serif" fontWeight="bold">
                Campaign Details
              </Text>
              <Text fontFamily="'Montserrat', sans-serif">
                <strong>Description:</strong> {selectedCampaign.description || 'No description'}
              </Text>
              <Text fontFamily="'Montserrat', sans-serif">
                <strong>Trigger:</strong> {selectedCampaign.trigger_type.charAt(0).toUpperCase() + selectedCampaign.trigger_type.slice(1)}
              </Text>
              <Text fontFamily="'Montserrat', sans-serif">
                <strong>Status:</strong> 
                <Badge 
                  colorScheme={selectedCampaign.is_active ? 'green' : 'red'} 
                  ml={2}
                  fontFamily="'Montserrat', sans-serif"
                >
                  {selectedCampaign.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </Text>
            </VStack>
          </Box>

          {/* Templates table */}
          <Box bg="#ecede8" borderRadius="lg" p={6} color="#353535">
            <VStack spacing={4} align="stretch">
              <Text fontSize="xl" fontFamily="'Montserrat', sans-serif" fontWeight="bold">
                Templates ({campaignTemplates.length})
              </Text>
              
              <Box overflowX="auto">
                {campaignTemplates.length === 0 ? (
                  <Box textAlign="center" py={12}>
                    <Text fontSize="xl" color="#666" fontFamily="'Montserrat', sans-serif" mb={4}>
                      No templates yet
                    </Text>
                    <Text fontSize="md" color="#888" fontFamily="'Montserrat', sans-serif">
                      Create your first template to start sending messages
                    </Text>
                  </Box>
                ) : (
                  <Table variant="simple" size="lg">
                    <Thead>
                      <Tr>
                        <Th fontFamily="'Montserrat', sans-serif" fontWeight="bold" fontSize="lg" py={4}>Template Name</Th>
                        <Th fontFamily="'Montserrat', sans-serif" fontWeight="bold" fontSize="lg" py={4}>Description</Th>
                        <Th fontFamily="'Montserrat', sans-serif" fontWeight="bold" fontSize="lg" py={4}>Timing</Th>
                        <Th fontFamily="'Montserrat', sans-serif" fontWeight="bold" fontSize="lg" py={4}>Recipient</Th>
                        <Th fontFamily="'Montserrat', sans-serif" fontWeight="bold" fontSize="lg" py={4}>Status</Th>
                        <Th fontFamily="'Montserrat', sans-serif" fontWeight="bold" fontSize="lg" py={4}>Actions</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {campaignTemplates
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map((template) => (
                          <Tr key={template.id} _hover={{ bg: '#f0f0f0' }}>
                            <Td fontFamily="'Montserrat', sans-serif" fontWeight="bold" fontSize="md" py={4}>
                              {template.name}
                            </Td>
                            <Td fontFamily="'Montserrat', sans-serif" fontSize="md" py={4}>
                              {template.description || '-'}
                            </Td>
                            <Td fontFamily="'Montserrat', sans-serif" fontSize="md" py={4}>
                              {formatTiming(template)}
                            </Td>
                            <Td fontFamily="'Montserrat', sans-serif" fontSize="md" py={4}>
                              {formatRecipient(template)}
                            </Td>
                            <Td py={4}>
                              <Badge 
                                colorScheme={template.is_active ? 'green' : 'red'} 
                                fontFamily="'Montserrat', sans-serif"
                                fontSize="md"
                                px={3}
                                py={1}
                              >
                                {template.is_active ? 'Active' : 'Inactive'}
                              </Badge>
                            </Td>
                            <Td py={4}>
                              <HStack spacing={2}>
                                <Switch
                                  isChecked={template.is_active}
                                  onChange={() => handleToggleTemplateActive(template)}
                                  colorScheme="green"
                                  size="md"
                                />
                                <IconButton 
                                  aria-label="Edit template" 
                                  icon={<EditIcon />} 
                                  size="md" 
                                  colorScheme="blue" 
                                  onClick={() => handleEditTemplate(template)}
                                />
                                <IconButton 
                                  aria-label="Delete template" 
                                  icon={<DeleteIcon />} 
                                  size="md" 
                                  colorScheme="red" 
                                  onClick={() => handleDeleteTemplate(template.id)}
                                />
                              </HStack>
                            </Td>
                          </Tr>
                        ))}
                    </Tbody>
                  </Table>
                )}
              </Box>
            </VStack>
          </Box>
        </VStack>

        {/* Template Drawer */}
        <CampaignTemplateDrawer
          isOpen={isTemplateDrawerOpen}
          onClose={() => setIsTemplateDrawerOpen(false)}
          templateId={selectedTemplateId}
          isCreateMode={isTemplateCreateMode}
          onTemplateUpdated={handleTemplateUpdated}
          campaignId={selectedCampaign.id}
          campaignTriggerType={selectedCampaign.trigger_type}
        />
      </Box>
      </AdminLayout>
    );
  }

  // Show campaigns list
  return (
    <AdminLayout>
      <Box p={8} bg="#f8f9fa" minH="100vh">
      <VStack spacing={6} align="stretch">
        {/* Header */}
        <Text
          fontSize="4xl"
          fontWeight="bold"
          color="#353535"
          fontFamily="'IvyJournal', serif"
          mb={2}
        >
          Campaigns
        </Text>

        {/* Tabs */}
        <Tabs variant="enclosed" colorScheme="green">
          <TabList>
            <Tab 
              fontFamily="'Montserrat', sans-serif" 
              fontSize="lg" 
              py={4} 
              px={6}
              _selected={{ bg: '#ecede8', color: '#353535' }}
            >
              Campaigns
            </Tab>
            <Tab 
              fontFamily="'Montserrat', sans-serif" 
              fontSize="lg" 
              py={4} 
              px={6}
              _selected={{ bg: '#ecede8', color: '#353535' }}
            >
              Reservation Reminders
            </Tab>
          </TabList>

          <TabPanels>
            {/* Campaigns Tab */}
            <TabPanel>
              <VStack spacing={6} align="stretch">
                {/* Create Campaign Button */}
                <Box textAlign="center" py={8}>
                  <VStack spacing={4}>
                    <Button
                      onClick={handleCreateCampaign}
                      leftIcon={<AddIcon />}
                      colorScheme="green"
                      size="lg"
                      px={12}
                      py={8}
                      fontSize="xl"
                      fontWeight="bold"
                      fontFamily="'Montserrat', sans-serif"
                      bg="#a59480"
                      color="white"
                      _hover={{
                        bg: '#8a7a66',
                        transform: 'translateY(-2px)',
                        boxShadow: '0 8px 25px rgba(165, 148, 128, 0.3)',
                      }}
                      _active={{
                        bg: '#7a6a56',
                        transform: 'translateY(0)',
                      }}
                      borderRadius="xl"
                      boxShadow="0 4px 15px rgba(165, 148, 128, 0.2)"
                    >
                      Create New Campaign
                    </Button>
                  </VStack>
                </Box>

                {/* Campaigns Table */}
                <Box bg="#ecede8" borderRadius="lg" p={6} color="#353535">
                  <VStack spacing={4} align="stretch">
                    <Text fontSize="xl" fontFamily="'Montserrat', sans-serif" fontWeight="bold">
                      All Campaigns
                    </Text>
                    
                    <Box overflowX="auto">
                      {campaigns.length === 0 ? (
                        <Box textAlign="center" py={12}>
                          <Text fontSize="xl" color="#666" fontFamily="'Montserrat', sans-serif" mb={4}>
                            No campaigns yet
                          </Text>
                          <Text fontSize="md" color="#888" fontFamily="'Montserrat', sans-serif">
                            Create your first campaign to get started with automated messaging
                          </Text>
                        </Box>
                      ) : (
                        <Table variant="simple" size="lg">
                          <Thead>
                            <Tr>
                              <Th fontFamily="'Montserrat', sans-serif" fontWeight="bold" fontSize="lg" py={4}>Campaign Name</Th>
                              <Th fontFamily="'Montserrat', sans-serif" fontWeight="bold" fontSize="lg" py={4}>Description</Th>
                              <Th fontFamily="'Montserrat', sans-serif" fontWeight="bold" fontSize="lg" py={4}>Trigger</Th>
                              <Th fontFamily="'Montserrat', sans-serif" fontWeight="bold" fontSize="lg" py={4}>Status</Th>
                              <Th fontFamily="'Montserrat', sans-serif" fontWeight="bold" fontSize="lg" py={4}>Actions</Th>
                            </Tr>
                          </Thead>
                          <Tbody>
                            {campaigns
                              .sort((a, b) => a.name.localeCompare(b.name))
                              .map((campaign) => (
                                <Tr key={campaign.id} _hover={{ bg: '#f0f0f0' }}>
                                  <Td fontFamily="'Montserrat', sans-serif" fontWeight="bold" fontSize="md" py={4}>
                                    {campaign.name}
                                  </Td>
                                  <Td fontFamily="'Montserrat', sans-serif" fontSize="md" py={4}>
                                    {campaign.description || '-'}
                                  </Td>
                                  <Td fontFamily="'Montserrat', sans-serif" fontSize="md" py={4}>
                                    <Badge colorScheme="blue" fontFamily="'Montserrat', sans-serif">
                                      {campaign.trigger_type.charAt(0).toUpperCase() + campaign.trigger_type.slice(1)}
                                    </Badge>
                                  </Td>
                                  <Td py={4}>
                                    <Badge 
                                      colorScheme={campaign.is_active ? 'green' : 'red'} 
                                      fontFamily="'Montserrat', sans-serif"
                                      fontSize="md"
                                      px={3}
                                      py={1}
                                    >
                                      {campaign.is_active ? 'Active' : 'Inactive'}
                                    </Badge>
                                  </Td>
                                  <Td py={4}>
                                    <HStack spacing={2}>
                                      <Switch
                                        isChecked={campaign.is_active}
                                        onChange={() => handleToggleCampaignActive(campaign)}
                                        colorScheme="green"
                                        size="md"
                                      />
                                      <Button 
                                        size="md" 
                                        colorScheme="blue" 
                                        onClick={() => handleEditCampaign(campaign)}
                                        _hover={{ transform: 'scale(1.1)' }}
                                        fontFamily="'Montserrat', sans-serif"
                                        fontSize="sm"
                                        px={4}
                                      >
                                        Edit
                                      </Button>
                                      <IconButton 
                                        aria-label="Delete campaign" 
                                        icon={<DeleteIcon />} 
                                        size="md" 
                                        colorScheme="red" 
                                        onClick={() => handleDeleteCampaign(campaign.id)}
                                        _hover={{ transform: 'scale(1.1)' }}
                                      />
                                    </HStack>
                                  </Td>
                                </Tr>
                              ))}
                          </Tbody>
                        </Table>
                      )}
                    </Box>
                  </VStack>
                </Box>
              </VStack>
            </TabPanel>

            {/* Reservation Reminders Tab */}
            <TabPanel>
              <VStack spacing={6} align="stretch">
                {/* Create Reminder Template Button */}
                <Box textAlign="center" py={8}>
                  <VStack spacing={4}>
                    <Button
                      onClick={handleCreateReminderTemplate}
                      leftIcon={<AddIcon />}
                      colorScheme="green"
                      size="lg"
                      px={12}
                      py={8}
                      fontSize="xl"
                      fontWeight="bold"
                      fontFamily="'Montserrat', sans-serif"
                      bg="#a59480"
                      color="white"
                      _hover={{
                        bg: '#8a7a66',
                        transform: 'translateY(-2px)',
                        boxShadow: '0 8px 25px rgba(165, 148, 128, 0.3)',
                      }}
                      _active={{
                        bg: '#7a6a56',
                        transform: 'translateY(0)',
                      }}
                      borderRadius="xl"
                      boxShadow="0 4px 15px rgba(165, 148, 128, 0.2)"
                    >
                      Create Reminder Template
                    </Button>
                  </VStack>
                </Box>

                {/* Reminder Templates Table */}
                <Box bg="#ecede8" borderRadius="lg" p={6} color="#353535">
                  <VStack spacing={4} align="stretch">
                    <Text fontSize="xl" fontFamily="'Montserrat', sans-serif" fontWeight="bold">
                      Reservation Reminder Templates
                    </Text>
                    
                    <Box overflowX="auto">
                      {reminderTemplates.length === 0 ? (
                        <Box textAlign="center" py={12}>
                          <Text fontSize="xl" color="#666" fontFamily="'Montserrat', sans-serif" mb={4}>
                            No reminder templates yet
                          </Text>
                          <Text fontSize="md" color="#888" fontFamily="'Montserrat', sans-serif">
                            Create your first reminder template to start sending reservation reminders
                          </Text>
                        </Box>
                      ) : (
                        <Table variant="simple" size="lg">
                          <Thead>
                            <Tr>
                              <Th fontFamily="'Montserrat', sans-serif" fontWeight="bold" fontSize="lg" py={4}>Template Name</Th>
                              <Th fontFamily="'Montserrat', sans-serif" fontWeight="bold" fontSize="lg" py={4}>Description</Th>
                              <Th fontFamily="'Montserrat', sans-serif" fontWeight="bold" fontSize="lg" py={4}>Timing</Th>
                              <Th fontFamily="'Montserrat', sans-serif" fontWeight="bold" fontSize="lg" py={4}>Status</Th>
                              <Th fontFamily="'Montserrat', sans-serif" fontWeight="bold" fontSize="lg" py={4}>Actions</Th>
                            </Tr>
                          </Thead>
                          <Tbody>
                            {reminderTemplates.map((template) => (
                              <Tr key={template.id} _hover={{ bg: '#f0f0f0' }}>
                                <Td fontFamily="'Montserrat', sans-serif" fontWeight="bold" fontSize="md" py={4}>
                                  {template.name}
                                </Td>
                                <Td fontFamily="'Montserrat', sans-serif" fontSize="md" py={4}>
                                  {template.description || '-'}
                                </Td>
                                <Td fontFamily="'Montserrat', sans-serif" fontSize="md" py={4}>
                                  {template.quantity} {template.time_unit}{template.quantity !== 1 ? 's' : ''} {template.proximity} reservation
                                </Td>
                                <Td py={4}>
                                  <Badge 
                                    colorScheme={template.is_active ? 'green' : 'red'} 
                                    fontFamily="'Montserrat', sans-serif"
                                    fontSize="md"
                                    px={3}
                                    py={1}
                                  >
                                    {template.is_active ? 'Active' : 'Inactive'}
                                  </Badge>
                                </Td>
                                <Td py={4}>
                                  <HStack spacing={2}>
                                    <Switch
                                      isChecked={template.is_active}
                                      onChange={() => handleToggleReminderActive(template)}
                                      colorScheme="green"
                                      size="md"
                                    />
                                    <IconButton 
                                      aria-label="Edit template" 
                                      icon={<EditIcon />} 
                                      size="md" 
                                      colorScheme="blue" 
                                      onClick={() => handleEditReminderTemplate(template)}
                                      _hover={{ transform: 'scale(1.1)' }}
                                    />
                                    <IconButton 
                                      aria-label="Delete template" 
                                      icon={<DeleteIcon />} 
                                      size="md" 
                                      colorScheme="red" 
                                      onClick={() => handleDeleteTemplate(template.id)}
                                      _hover={{ transform: 'scale(1.1)' }}
                                    />
                                  </HStack>
                                </Td>
                              </Tr>
                            ))}
                          </Tbody>
                        </Table>
                      )}
                    </Box>
                  </VStack>
                </Box>
              </VStack>
            </TabPanel>
          </TabPanels>
        </Tabs>
      </VStack>

      {/* Campaign Drawer */}
      <CampaignDrawer
        isOpen={isCampaignDrawerOpen}
        onClose={() => setIsCampaignDrawerOpen(false)}
        campaignId={selectedCampaignId}
        isCreateMode={isCampaignCreateMode}
        onCampaignUpdated={handleCampaignUpdated}
      />

      {/* Reminder Template Drawer */}
      <SimplifiedReminderTemplateEditDrawer
        isOpen={isReminderDrawerOpen}
        onClose={() => setIsReminderDrawerOpen(false)}
        templateId={selectedReminderId}
        isCreateMode={isReminderCreateMode}
        onTemplateUpdated={handleReminderTemplateUpdated}
      />
    </Box>
    </AdminLayout>
  );
} 