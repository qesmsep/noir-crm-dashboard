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
  useDisclosure,
} from '@chakra-ui/react';
import { EditIcon, DeleteIcon, AddIcon, ViewIcon } from '@chakra-ui/icons';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabase';
import AdminLayout from '../../components/layouts/AdminLayout';
import CampaignDrawer from '../../components/CampaignDrawer';
import CampaignTemplateDrawer from '../../components/CampaignTemplateDrawer';
import { sortCampaignTemplates } from '../../utils/campaignSorting';
import mobileStyles from '../../styles/CommunicationMobile.module.css';

interface Campaign {
  id: string;
  campaign_id: string;
  name: string;
  description: string;
  trigger_type: 'member_signup' | 'member_birthday' | 'member_renewal' | 'reservation_time' | 'reservation_created' | 'reservation' | 'recurring' | 'reservation_range' | 'private_event' | 'all_members';
  is_active: boolean;
  created_at: string;
  updated_at: string;
  message_count?: number;
  // New fields for recurring campaigns
  recurring_schedule?: any;
  recurring_start_date?: string;
  recurring_end_date?: string;
  // New fields for reservation range campaigns
  reservation_range_start?: string;
  reservation_range_end?: string;
  // New fields for private event campaigns
  selected_private_event_id?: string;
  // New fields for event list feature
  include_event_list?: boolean;
  event_list_date_range?: any;
}

interface CampaignTemplate {
  id: string;
  campaign_id: string;
  name: string;
  description: string;
  content: string;
  recipient_type: 'member' | 'all_members' | 'specific_phone' | 'both_members' | 'reservation_phones' | 'private_event_rsvps' | 'all_primary_members';
  specific_phone?: string;
  timing_type: 'specific_time' | 'recurring' | 'relative';
  specific_time?: string;
  specific_date?: string;
  recurring_type?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  recurring_time?: string;
  recurring_weekdays?: number[];
  recurring_monthly_type?: 'first' | 'last' | 'second' | 'third' | 'fourth';
  recurring_monthly_day?: 'day' | 'weekday';
  recurring_monthly_value?: number;
  recurring_yearly_date?: string;
  relative_time?: string;
  relative_quantity?: number;
  relative_unit?: 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year';
  relative_proximity?: 'before' | 'after';
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // New fields for reservation range campaigns
  reservation_range_include_past?: boolean;
  reservation_range_minute_precision?: boolean;
  // New fields for private event campaigns
  private_event_date_range?: any;
  private_event_include_old?: boolean;
}

export default function CommunicationPage() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignTemplates, setCampaignTemplates] = useState<CampaignTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [isCampaignDrawerOpen, setIsCampaignDrawerOpen] = useState(false);
  const [isTemplateDrawerOpen, setIsTemplateDrawerOpen] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [isCampaignCreateMode, setIsCampaignCreateMode] = useState(false);
  const [isTemplateCreateMode, setIsTemplateCreateMode] = useState(false);
  const toast = useToast();

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const fetchCampaigns = async () => {
    try {
      // First, get all campaigns
      const { data: campaignsData, error: campaignsError } = await supabase
        .from('campaigns')
        .select('*')
        .order('created_at', { ascending: false });

      if (campaignsError) {
        // If table doesn't exist yet, show empty state
        if (campaignsError.code === '42P01') { // Table doesn't exist
          console.log('Campaigns table not found - run migration first');
          setCampaigns([]);
          return;
        }
        throw campaignsError;
      }

      // Then, get message counts for each campaign
      const campaignsWithCounts = await Promise.all(
        (campaignsData || []).map(async (campaign) => {
          const { count, error: countError } = await supabase
            .from('campaign_messages')
            .select('*', { count: 'exact', head: true })
            .eq('campaign_id', campaign.id);

          if (countError) {
            console.error(`Error fetching message count for campaign ${campaign.id}:`, countError);
            return { ...campaign, message_count: 0 };
          }

          return { ...campaign, message_count: count || 0 };
        })
      );

      setCampaigns(campaignsWithCounts);
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

  const handleCreateCampaign = () => {
    console.log('Create Campaign button clicked!');
    setIsCampaignCreateMode(true);
    setSelectedCampaignId(null);
    setIsCampaignDrawerOpen(true);
    console.log('Campaign drawer should now be open:', true);
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

  const formatTimingDisplay = (template: CampaignTemplate) => {
    if (template.timing_type === 'specific_time') {
      return `Send at ${template.specific_time} on ${template.specific_date || 'trigger date'}`;
    } else if (template.timing_type === 'recurring') {
      let display = `Send ${template.recurring_type} at ${template.recurring_time || '10:00'}`;
      if (template.recurring_type === 'weekly') {
        const days = template.recurring_weekdays?.map(d => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join(', ') || 'selected days';
        display += ` on ${days}`;
      } else if (template.recurring_type === 'monthly') {
        display += ` on ${template.recurring_monthly_type} ${template.recurring_monthly_day} ${template.recurring_monthly_value}`;
      } else if (template.recurring_type === 'yearly') {
        display += ` on ${template.recurring_yearly_date}`;
      }
      return display;
    } else if (template.timing_type === 'relative') {
      const unit = template.relative_quantity === 1 ? template.relative_unit : template.relative_unit + 's';
      return `Send at ${template.relative_time} ${template.relative_quantity} ${unit} ${template.relative_proximity} trigger`;
    } else {
      return 'Timing not configured';
    }
  };

  const formatRecipient = (template: CampaignTemplate) => {
    switch (template.recipient_type) {
      case 'member':
        return (selectedCampaign?.trigger_type === 'reservation' || selectedCampaign?.trigger_type === 'reservation_time' || selectedCampaign?.trigger_type === 'reservation_created') ? 'Phone number on reservation' : 'Primary Member';
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
                                {formatTimingDisplay(template)}
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
      {/* Desktop View */}
      <div className={mobileStyles.desktopView}>
        <Box p={8} pt="95px" bg="#f8f9fa" minH="100vh">
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

          {/* Campaigns Section */}
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
                          <Th fontFamily="'Montserrat', sans-serif" fontWeight="bold" fontSize="lg" py={6} px={6}>Campaign Name</Th>
                          <Th fontFamily="'Montserrat', sans-serif" fontWeight="bold" fontSize="lg" py={6} px={6}>Description</Th>
                          <Th fontFamily="'Montserrat', sans-serif" fontWeight="bold" fontSize="lg" py={6} px={6}>Trigger</Th>
                          <Th fontFamily="'Montserrat', sans-serif" fontWeight="bold" fontSize="lg" py={6} px={6}>Messages</Th>
                          <Th fontFamily="'Montserrat', sans-serif" fontWeight="bold" fontSize="lg" py={6} px={6}>Status</Th>
                          <Th fontFamily="'Montserrat', sans-serif" fontWeight="bold" fontSize="lg" py={6} px={6}>Actions</Th>
                        </Tr>
                      </Thead>
                      <Tbody>
                        {campaigns
                          .sort((a, b) => a.name.localeCompare(b.name))
                          .map((campaign) => (
                            <Tr key={campaign.id} _hover={{ bg: '#f0f0f0' }}>
                              <Td fontFamily="'Montserrat', sans-serif" fontWeight="bold" fontSize="md" py={6} px={6}>
                                {campaign.name}
                              </Td>
                              <Td fontFamily="'Montserrat', sans-serif" fontSize="md" py={6} px={6}>
                                {campaign.description || '-'}
                              </Td>
                              <Td fontFamily="'Montserrat', sans-serif" fontSize="md" py={6} px={6}>
                                <Badge colorScheme="blue" fontFamily="'Montserrat', sans-serif">
                                  {campaign.trigger_type.charAt(0).toUpperCase() + campaign.trigger_type.slice(1)}
                                </Badge>
                              </Td>
                              <Td fontFamily="'Montserrat', sans-serif" fontSize="md" py={6} px={6} textAlign="center">
                                <Badge 
                                  colorScheme="purple" 
                                  fontFamily="'Montserrat', sans-serif"
                                  fontSize="md"
                                  px={4}
                                  py={2}
                                  borderRadius="full"
                                >
                                  {campaign.message_count || 0}
                                </Badge>
                              </Td>
                              <Td py={6} px={6}>
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
                              <Td py={6} px={6}>
                                <HStack spacing={3}>
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
        </VStack>

        {/* Campaign Drawer */}
        <CampaignDrawer
          isOpen={isCampaignDrawerOpen}
          onClose={() => {
            console.log('Closing campaign drawer');
            setIsCampaignDrawerOpen(false);
          }}
          campaignId={selectedCampaignId}
          isCreateMode={isCampaignCreateMode}
          onCampaignUpdated={handleCampaignUpdated}
        />
        </Box>
      </div>

      {/* Mobile View */}
      <div className={mobileStyles.mobileView}>
        <MobileCommunicationView 
          campaigns={campaigns}
          campaignTemplates={campaignTemplates}
          loading={loading}
          onCreateCampaign={handleCreateCampaign}
          onCreateTemplate={handleCreateTemplate}
          onEditCampaign={handleEditCampaign}
          onEditTemplate={handleEditTemplate}
          onDeleteCampaign={handleDeleteCampaign}
          onDeleteTemplate={handleDeleteTemplate}
          onToggleCampaign={(campaignId: string, isActive: boolean) => {
            const campaign = campaigns.find(c => c.id === campaignId);
            if (campaign) {
              handleToggleCampaignActive({ ...campaign, is_active: isActive });
            }
          }}
          onViewCampaign={handleEditCampaign}
        />
      </div>
    </AdminLayout>
  );
}

// Mobile Communication View Component
function MobileCommunicationView({
  campaigns,
  campaignTemplates,
  loading,
  onCreateCampaign,
  onCreateTemplate,
  onEditCampaign,
  onEditTemplate,
  onDeleteCampaign,
  onDeleteTemplate,
  onToggleCampaign,
  onViewCampaign
}: {
  campaigns: Campaign[];
  campaignTemplates: any[];
  loading: boolean;
  onCreateCampaign: () => void;
  onCreateTemplate: () => void;
  onEditCampaign: (campaign: Campaign) => void;
  onEditTemplate: (template: any) => void;
  onDeleteCampaign: (campaignId: string) => void;
  onDeleteTemplate: (templateId: string) => void;
  onToggleCampaign: (campaignId: string, isActive: boolean) => void;
  onViewCampaign: (campaign: Campaign) => void;
}) {
  if (loading) {
    return (
      <div className={mobileStyles.mobileLoading}>
        <div className={mobileStyles.mobileLoadingSpinner}></div>
        <div className={mobileStyles.mobileLoadingText}>Loading campaigns...</div>
      </div>
    );
  }

  const getTriggerTypeLabel = (triggerType: string) => {
    const labels: Record<string, string> = {
      'member_signup': 'Member Signup',
      'member_birthday': 'Member Birthday',
      'member_renewal': 'Member Renewal',
      'reservation_time': 'Reservation Time',
      'reservation_created': 'Reservation Created',
      'reservation': 'Reservation',
      'recurring': 'Recurring',
      'reservation_range': 'Reservation Range',
      'private_event': 'Private Event',
      'all_members': 'All Members'
    };
    return labels[triggerType] || triggerType;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  return (
    <div className={mobileStyles.mobileContainer}>
      <div className={mobileStyles.mobileHeader}>
        <h1 className={mobileStyles.mobileTitle}>Campaigns</h1>
      </div>

      {/* Create campaign button */}
      <button
        className={mobileStyles.mobileCreateButton}
        onClick={onCreateCampaign}
      >
        + Create Campaign
      </button>

      {/* Campaigns List */}
      <div className={mobileStyles.mobileCampaignsContainer}>
        <div className={mobileStyles.mobileCampaignsHeader}>
          <div className={mobileStyles.mobileCampaignsTitle}>Active Campaigns</div>
        </div>

        {campaigns.length === 0 ? (
          <div className={mobileStyles.mobileEmpty}>
            <div className={mobileStyles.mobileEmptyIcon}>📧</div>
            <div className={mobileStyles.mobileEmptyText}>No campaigns found. Create your first campaign above.</div>
          </div>
        ) : (
          campaigns.map((campaign) => (
            <div key={campaign.id} className={mobileStyles.mobileCampaignCard}>
              {/* Campaign Title */}
              <div className={mobileStyles.mobileCampaignTitle}>{campaign.name}</div>

              {/* Campaign Details */}
              <div className={mobileStyles.mobileCampaignDetails}>
                <div className={mobileStyles.mobileCampaignTrigger}>
                  {getTriggerTypeLabel(campaign.trigger_type)}
                </div>
                <div className={mobileStyles.mobileCampaignMessages}>
                  📧 {campaign.message_count || 0} messages
                </div>
                <div className={mobileStyles.mobileCampaignCreated}>
                  📅 Created {formatDate(campaign.created_at)}
                </div>
                {campaign.description && (
                  <div className={mobileStyles.mobileCampaignDescription}>
                    {campaign.description.length > 80 ? 
                      `${campaign.description.substring(0, 80)}...` : 
                      campaign.description
                    }
                  </div>
                )}
              </div>

              {/* Action Buttons Row */}
              <div className={mobileStyles.mobileCampaignActionsRow}>
                <button
                  className={`${mobileStyles.mobileCampaignActionButton} ${mobileStyles.view}`}
                  onClick={() => onViewCampaign(campaign)}
                >
                  👁️ View
                </button>
                <button
                  className={`${mobileStyles.mobileCampaignActionButton} ${mobileStyles.edit}`}
                  onClick={() => onEditCampaign(campaign)}
                >
                  ✏️ Edit
                </button>
                <button
                  className={`${mobileStyles.mobileCampaignActionButton} ${mobileStyles.delete}`}
                  onClick={() => onDeleteCampaign(campaign.id)}
                >
                  🗑️ Delete
                </button>
                <div className={mobileStyles.mobileCampaignToggleButton}>
                  <span>Active</span>
                  <div
                    className={`${mobileStyles.mobileCampaignSwitch} ${campaign.is_active ? mobileStyles.active : ''}`}
                    onClick={() => onToggleCampaign(campaign.id, !campaign.is_active)}
                  >
                    <div className={mobileStyles.mobileCampaignSwitchThumb}></div>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Templates Section */}
      <div className={mobileStyles.mobileTemplatesContainer}>
        <div className={mobileStyles.mobileTemplatesHeader}>
          <div className={mobileStyles.mobileTemplatesTitle}>Message Templates</div>
          <button
            className={mobileStyles.mobileCreateButton}
            onClick={onCreateTemplate}
            style={{ padding: '8px 12px', fontSize: '14px', marginBottom: 0 }}
          >
            + Add Template
          </button>
        </div>

        {campaignTemplates.length === 0 ? (
          <div className={mobileStyles.mobileEmpty}>
            <div className={mobileStyles.mobileEmptyIcon}>📝</div>
            <div className={mobileStyles.mobileEmptyText}>No templates found. Create your first template above.</div>
          </div>
        ) : (
          campaignTemplates.map((template) => (
            <div key={template.id} className={mobileStyles.mobileTemplateCard}>
              <div className={mobileStyles.mobileTemplateHeader}>
                <div className={mobileStyles.mobileTemplateName}>{template.name}</div>
                <div className={mobileStyles.mobileCampaignActions}>
                  <button
                    className={`${mobileStyles.mobileCampaignActionButton} ${mobileStyles.edit}`}
                    onClick={() => onEditTemplate(template)}
                  >
                    ✏️
                  </button>
                  <button
                    className={`${mobileStyles.mobileCampaignActionButton} ${mobileStyles.delete}`}
                    onClick={() => onDeleteTemplate(template.id)}
                  >
                    🗑️
                  </button>
                </div>
              </div>

              <div className={mobileStyles.mobileTemplateSubject}>
                Subject: {template.subject || 'No subject'}
              </div>

              <div className={mobileStyles.mobileTemplatePreview}>
                {template.body ? 
                  (template.body.length > 100 ? 
                    `${template.body.substring(0, 100)}...` : 
                    template.body
                  ) : 'No content'
                }
              </div>

              <div className={mobileStyles.mobileTemplateFooter}>
                <span>Created {formatDate(template.created_at)}</span>
                <span>{template.message_type || 'SMS'}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
} 