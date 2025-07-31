import React, { useState, useEffect } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  Input,
  Textarea,
  Select,
  Switch,
  Badge,
  useToast,
  IconButton,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Divider,
  Flex,
  Grid,
  GridItem,
} from '@chakra-ui/react';
import { ArrowBackIcon, EditIcon, DeleteIcon, AddIcon } from '@chakra-ui/icons';
import { useRouter } from 'next/router';
import { supabase } from '../../../lib/supabase';
import AdminLayout from '../../../components/layouts/AdminLayout';
import CampaignTemplateDrawer from '../../../components/CampaignTemplateDrawer';
import { sortCampaignTemplates } from '../../../utils/campaignSorting';

interface Campaign {
  id: string;
  campaign_id: string;
  name: string;
  description: string;
  trigger_type: 'member_signup' | 'member_birthday' | 'member_renewal' | 'reservation_time' | 'reservation_created' | 'reservation' | 'recurring' | 'reservation_range' | 'private_event' | 'all_members';
  is_active: boolean;
  created_at: string;
  updated_at?: string;
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
}

export default function CampaignEditPage() {
  const router = useRouter();
  const { id } = router.query;
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [templates, setTemplates] = useState<CampaignTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isTemplateDrawerOpen, setIsTemplateDrawerOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [isTemplateCreateMode, setIsTemplateCreateMode] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const toast = useToast();

  useEffect(() => {
    if (id) {
      fetchCampaign();
    }
  }, [id]);

  useEffect(() => {
    if (campaign?.id) {
      fetchTemplates();
    }
  }, [campaign?.id]);

  const fetchCampaign = async () => {
    try {
      console.log('Fetching campaign with ID:', id);
      const response = await fetch(`/api/campaigns/${id}`);
      console.log('Response status:', response.status);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Response error data:', errorData);
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Campaign data received:', data);
      console.log('Campaign campaign_id:', data?.campaign_id);
      
      if (!data) {
        throw new Error('Campaign not found');
      }
      
      setCampaign(data);
    } catch (error) {
      console.error('Error fetching campaign:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch campaign',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchTemplates = async () => {
    try {
      console.log('Fetching templates for campaign_id:', campaign?.id);
      const response = await fetch(`/api/campaign-messages?campaign_id=${campaign?.id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch templates');
      }
      const data = await response.json();
      console.log('All templates fetched:', data);
      
      // Sort templates by proximity to trigger event
      const sortedTemplates = sortCampaignTemplates(data);
      
      setTemplates(sortedTemplates);
    } catch (error) {
      console.error('Error fetching templates:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch templates',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const handleCampaignUpdate = async (field: string, value: any) => {
    if (!campaign) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/campaigns/${campaign.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ [field]: value }),
      });

      if (!response.ok) {
        throw new Error('Failed to update campaign');
      }

      // Get the updated campaign data from the server response
      const updatedCampaign = await response.json();
      setCampaign(updatedCampaign);

      toast({
        title: 'Success',
        description: 'Campaign updated successfully',
        status: 'success',
        duration: 2000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error updating campaign:', error);
      toast({
        title: 'Error',
        description: 'Failed to update campaign',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setSaving(false);
    }
  };

  const startEditing = (field: string, currentValue: string) => {
    setEditingField(field);
    setEditValue(currentValue);
  };

  const saveEdit = () => {
    if (editingField && campaign) {
      handleCampaignUpdate(editingField, editValue);
      setEditingField(null);
      setEditValue('');
    }
  };

  const cancelEdit = () => {
    setEditingField(null);
    setEditValue('');
  };

  const handleCreateMessage = () => {
    setIsTemplateCreateMode(true);
    setSelectedTemplateId(null);
    setIsTemplateDrawerOpen(true);
  };

  const handleEditTemplate = (template: CampaignTemplate) => {
    setIsTemplateCreateMode(false);
    setSelectedTemplateId(template.id);
    setIsTemplateDrawerOpen(true);
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;

    try {
      const response = await fetch(`/api/campaign-messages/${templateId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete template');
      }

      setTemplates(templates.filter(t => t.id !== templateId));
      toast({
        title: 'Success',
        description: 'Template deleted successfully',
        status: 'success',
        duration: 2000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error deleting template:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete template',
        status: 'error',
        duration: 5000,
        isClosable: true,
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

      setTemplates(templates.map(t => 
        t.id === template.id ? { ...t, is_active: !t.is_active } : t
      ));

      toast({
        title: 'Success',
        description: `Template ${!template.is_active ? 'activated' : 'deactivated'} successfully`,
        status: 'success',
        duration: 2000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error updating template:', error);
      toast({
        title: 'Error',
        description: 'Failed to update template',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const handleTemplateUpdated = () => {
    fetchTemplates();
    setIsTemplateDrawerOpen(false);
  };

  const formatTiming = (template: CampaignTemplate) => {
    if (template.timing_type === 'specific_time') {
      // Convert 24-hour format to 12-hour format with AM/PM
      const time = template.specific_time || '10:00';
      const [hours, minutes] = time.split(':').map(Number);
      const period = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
      const displayTime = `${displayHours}:${minutes.toString().padStart(2, '0')}${period}`;
      
      if (template.specific_date) {
        return `${displayTime} on ${template.specific_date}`;
      } else {
        return `${displayTime} on trigger date`;
      }
    } else if (template.timing_type === 'recurring') {
      const time = template.recurring_time || '10:00';
      const [hours, minutes] = time.split(':').map(Number);
      const period = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
      const displayTime = `${displayHours}:${minutes.toString().padStart(2, '0')}${period}`;
      
      if (template.recurring_type === 'daily') {
        return `Daily at ${displayTime}`;
      } else if (template.recurring_type === 'weekly') {
        const days = template.recurring_weekdays?.map(d => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join(', ') || 'selected days';
        return `Weekly on ${days} at ${displayTime}`;
      } else if (template.recurring_type === 'monthly') {
        const type = template.recurring_monthly_type || 'first';
        const day = template.recurring_monthly_day || 'day';
        const value = template.recurring_monthly_value || 1;
        return `Monthly on ${type} ${day} ${value} at ${displayTime}`;
      } else if (template.recurring_type === 'yearly') {
        return `Yearly on ${template.recurring_yearly_date} at ${displayTime}`;
      }
      return `Recurring at ${displayTime}`;
    } else if (template.timing_type === 'relative') {
      const time = template.relative_time || '10:00';
      const [hours, minutes] = time.split(':').map(Number);
      const period = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
      const displayTime = `${displayHours}:${minutes.toString().padStart(2, '0')}${period}`;
      
      const quantity = template.relative_quantity || 0;
      const unit = template.relative_unit || 'day';
      const proximity = template.relative_proximity || 'after';
      
      if (quantity === 0) {
        return `${displayTime} on trigger date`;
      } else {
        const unitText = quantity === 1 ? unit : unit + 's';
        return `${displayTime} ${quantity} ${unitText} ${proximity} trigger`;
      }
    }
    return 'Timing not configured';
  };

  const formatRecipient = (template: CampaignTemplate) => {
    switch (template.recipient_type) {
      case 'member':
        return (campaign?.trigger_type === 'reservation' || campaign?.trigger_type === 'reservation_time' || campaign?.trigger_type === 'reservation_created') ? 'Phone number on reservation' : 'Primary Member';
      case 'all_members':
        return 'All Members';
      case 'specific_phone':
        return template.specific_phone || 'Custom Phone Number';
      default:
        return 'Unknown';
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <Box
          px={10}
          py={12}
          style={{ backgroundImage: 'linear-gradient(to bottom right, #ECEDE8, #FFFFFF)', backgroundAttachment: 'fixed' }}
          minH="100vh"
        >
          <Text>Loading campaign...</Text>
        </Box>
      </AdminLayout>
    );
  }

  if (!campaign) {
    return (
      <AdminLayout>
        <Box
          px={10}
          py={12}
          style={{ backgroundImage: 'linear-gradient(to bottom right, #ECEDE8, #FFFFFF)', backgroundAttachment: 'fixed' }}
          minH="100vh"
        >
          <Text>Campaign not found</Text>
        </Box>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <Box
        px={10}
        py={12}
        bg="white"
        minH="100vh"
      >
        <VStack spacing={8} align="stretch">
          {/* Header */}
          <HStack justify="space-between" align="center">
            <HStack spacing={4}>
              <IconButton
                onClick={() => router.push('/admin/communication')}
                icon={<ArrowBackIcon />}
                variant="ghost"
                color="#a59480"
                _hover={{ bg: '#ecede8' }}
                aria-label="Back to campaigns"
              />
              <Text
                fontSize="3xl"
                fontWeight="bold"
                color="#353535"
                fontFamily="'IvyJournal', serif"
                letterSpacing="tight"
                mb={4}
              >
                Edit Campaign
              </Text>
            </HStack>
            <Button
              onClick={handleCreateMessage}
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
              Create New Message
            </Button>
          </HStack>

          {/* Condensed Campaign Details */}
          <Box
            borderRadius="xl"
            overflow="hidden"
            boxShadow="0 10px 30px rgba(0,0,0,0.15)"
            w="100%"
            transition="all 0.3s ease"
            _hover={{
              transform: 'translateY(-4px)',
              boxShadow: '0 15px 40px rgba(0,0,0,0.2)',
            }}
          >
            <Box bg="#a59480" px={6} py={4}>
              <Text fontSize="2xl" letterSpacing="wide" fontFamily="'Montserrat', sans-serif" fontWeight="bold" color="white">
                Campaign Details
              </Text>
            </Box>
            <Box bg="white" px={6} py={6}>
              <VStack spacing={4} align="stretch">
                <HStack justify="space-between" align="center">
                  <HStack spacing={2}>
                    {saving && (
                      <Badge colorScheme="blue" fontFamily="'Montserrat', sans-serif">
                        Saving...
                      </Badge>
                    )}
                  </HStack>
                </HStack>
                <Grid templateColumns="repeat(2, 1fr)" gap={6}>
                  {/* Campaign ID */}
                  <GridItem>
                    <Text fontSize="sm" color="#666" fontFamily="'Montserrat', sans-serif" mb={1}>
                      Campaign ID
                    </Text>
                    <Text fontSize="md" fontFamily="'Montserrat', sans-serif" fontWeight="bold" color="#353535">
                      {campaign.campaign_id}
                    </Text>
                  </GridItem>
                  {/* Status */}
                  <GridItem >
                    <Text fontSize="sm" color="#666" fontFamily="'Montserrat', sans-serif" mb={1}>
                      Status
                    </Text>
                    <Button
                      size="sm"
                      colorScheme={campaign.is_active ? 'green' : 'red'}
                      variant="outline"
                      onClick={() => handleCampaignUpdate('is_active', !campaign.is_active)}
                      isDisabled={saving}
                      fontFamily="'Montserrat', sans-serif"
                      fontWeight="bold"
                      _hover={{
                        transform: 'translateY(-1px)',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                      }}
                    >
                      {campaign.is_active ? 'Active' : 'Inactive'}
                    </Button>
                  </GridItem>
                  {/* Campaign Name */}
                  <GridItem colSpan={2}>
                    <Text fontSize="sm" color="#666" fontFamily="'Montserrat', sans-serif" mb={1}>
                      Campaign Name *
                    </Text>
                    {editingField === 'name' ? (
                      <HStack>
                        <Input
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          bg="white"
                          borderColor="#a59480"
                          _focus={{ borderColor: '#8a7a66', boxShadow: '0 0 0 1px #8a7a66' }}
                          fontFamily="'Montserrat', sans-serif"
                          placeholder="Enter campaign name"
                          _placeholder={{ color: '#999' }}
                        />
                        <Button size="sm" colorScheme="green" onClick={saveEdit}>
                          Save
                        </Button>
                        <Button size="sm" variant="outline" onClick={cancelEdit}>
                          Cancel
                        </Button>
                      </HStack>
                    ) : (
                      <HStack justify="space-between" >
                        <Text fontSize="lg" fontFamily="'Montserrat', sans-serif" fontWeight="bold" color="#353535">
                          {campaign.name}
                        </Text>
                        <IconButton
                          size="sm"
                          icon={<EditIcon />}
                          variant="ghost"
                          onClick={() => startEditing('name', campaign.name)}
                          aria-label="Edit campaign name"
                        />
                      </HStack>
                    )}
                  </GridItem>
                  {/* Description */}
                  <GridItem colSpan={2}>
                    <Text fontSize="sm" color="#666" fontFamily="'Montserrat', sans-serif" mb={1}>
                      Description
                    </Text>
                    {editingField === 'description' ? (
                      <VStack align="stretch">
                        <Textarea
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          bg="white"
                          borderColor="#a59480"
                          _focus={{ borderColor: '#8a7a66', boxShadow: '0 0 0 1px #8a7a66' }}
                          fontFamily="'Montserrat', sans-serif"
                          rows={3}
                          placeholder="Enter campaign description"
                          _placeholder={{ color: '#999' }}
                        />
                        <HStack>
                          <Button size="sm" colorScheme="green" onClick={saveEdit}>
                            Save
                          </Button>
                          <Button size="sm" variant="outline" onClick={cancelEdit}>
                            Cancel
                          </Button>
                        </HStack>
                      </VStack>
                    ) : (
                      <HStack justify="space-between">
                        <Text fontSize="md" fontFamily="'Montserrat', sans-serif" color="#353535">
                          {campaign.description || 'No description'}
                        </Text>
                        <IconButton
                          size="sm"
                          icon={<EditIcon />}
                          variant="ghost"
                          onClick={() => startEditing('description', campaign.description || '')}
                          aria-label="Edit description"
                        />
                      </HStack>
                    )}
                  </GridItem>
                  {/* Trigger Type */}
                  <GridItem colSpan={2}>
                    <Text fontSize="sm" color="#666" fontFamily="'Montserrat', sans-serif" mb={1}>
                      Trigger Type *
                    </Text>
                    {editingField === 'trigger_type' ? (
                      <HStack>
                        <Select
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          bg="white"
                          borderColor="#a59480"
                          _focus={{ borderColor: '#8a7a66', boxShadow: '0 0 0 1px #8a7a66' }}
                          fontFamily="'Montserrat', sans-serif"
                        >
                          <option value="all_members">All Members</option>
                          <option value="member_birthday">Member Birthday</option>
                          <option value="member_renewal">Member Renewal Date</option>
                          <option value="member_signup">Member Signup</option>
                          <option value="private_event">Private Event</option>
                          <option value="recurring">Recurring</option>
                          <option value="reservation">Reservation</option>
                          <option value="reservation_created">Reservation Created</option>
                          <option value="reservation_range">Reservation Range</option>
                          <option value="reservation_time">Reservation Time</option>
                        </Select>
                        <Button size="sm" colorScheme="green" onClick={saveEdit}>
                          Save
                        </Button>
                        <Button size="sm" variant="outline" onClick={cancelEdit}>
                          Cancel
                        </Button>
                      </HStack>
                    ) : (
                      <HStack justify="space-between">
                        <Text fontSize="md" fontFamily="'Montserrat', sans-serif" fontWeight="bold" color="#353535">
                          {campaign.trigger_type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </Text>
                        <IconButton
                          size="sm"
                          icon={<EditIcon />}
                          variant="ghost"
                          onClick={() => startEditing('trigger_type', campaign.trigger_type)}
                          aria-label="Edit trigger type"
                        />
                      </HStack>
                    )}
                  </GridItem>
                </Grid>
              </VStack>
            </Box>
          </Box>

          {/* Message Templates */}
          <Box
            borderRadius="xl"
            overflow="hidden"
            boxShadow="0 10px 30px rgba(0,0,0,0.15)"
            w="100%"
          >
            <Box bg="#a59480" px={6} py={4}>
              <Text fontSize="2xl" letterSpacing="wide" fontFamily="'Montserrat', sans-serif" fontWeight="bold" color="white">
                Message Templates ({templates.length})
              </Text>
            </Box>
            <Box bg="white" px={6} py={6} overflowX="auto">
              {templates.length === 0 ? (
                <Box textAlign="center" py={12}>
                  <Text fontSize="xl" color="#666" fontFamily="'Montserrat', sans-serif" mb={4}>
                    No message templates yet
                  </Text>
                  <Text fontSize="md" color="#888" fontFamily="'Montserrat', sans-serif">
                    Create your first message template to start sending messages
                  </Text>
                </Box>
              ) : (
                <Table variant="striped" colorScheme="gray" size="lg">
                  <Thead>
                    <Tr >
                      <Th fontFamily="'Montserrat', sans-serif" fontWeight="bold" padding={20} fontSize="lg" py={14} width="15%">Template Name</Th>
                      <Th fontFamily="'Montserrat', sans-serif" fontWeight="bold" padding={20} fontSize="lg" py={14} width="25%">Description</Th>
                      <Th fontFamily="'Montserrat', sans-serif" fontWeight="bold" padding={20} fontSize="lg" py={14} width="25%">Timing</Th>
                      <Th fontFamily="'Montserrat', sans-serif" fontWeight="bold" padding={20} fontSize="lg" py={14} width="15%">Recipient</Th>
                      <Th fontFamily="'Montserrat', sans-serif" fontWeight="bold" padding={20} fontSize="lg" py={14} width="10%">Status</Th>
                      <Th fontFamily="'Montserrat', sans-serif" fontWeight="bold" padding={20} fontSize="lg" py={14} width="10%">Actions</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {templates.map((template) => (
                        <Tr key={template.id} _hover={{ bg: '#f0f0f0' }}>
                          <Td fontFamily="'Montserrat', sans-serif" fontWeight="bold" fontSize="md" py={6} px={4}>
                            {template.name}
                          </Td>
                          <Td fontFamily="'Montserrat', sans-serif" fontSize="md" py={6} px={4} maxW="300px">
                            <Text noOfLines={3} wordBreak="break-word">
                              {template.description || '-'}
                            </Text>
                          </Td>
                          <Td fontFamily="'Montserrat', sans-serif" fontSize="md" py={6} px={4} maxW="300px">
                            <Text noOfLines={2} wordBreak="break-word">
                              {formatTiming(template)}
                            </Text>
                          </Td>
                          <Td fontFamily="'Montserrat', sans-serif" fontSize="md" py={6} px={4}>
                            {formatRecipient(template)}
                          </Td>
                          <Td py={6} px={4}>
                            <Button
                              size="sm"
                              colorScheme={template.is_active ? 'green' : 'red'}
                              variant="outline"
                              onClick={() => handleToggleTemplateActive(template)}
                              fontFamily="'Montserrat', sans-serif"
                              fontWeight="bold"
                            >
                              {template.is_active ? 'Active' : 'Inactive'}
                            </Button>
                          </Td>
                          <Td py={6} px={4}>
                            <HStack spacing={2}>
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
          </Box>
        </VStack>

        {/* Template Drawer */}
        <CampaignTemplateDrawer
          isOpen={isTemplateDrawerOpen}
          onClose={() => setIsTemplateDrawerOpen(false)}
          templateId={selectedTemplateId}
          isCreateMode={isTemplateCreateMode}
          onTemplateUpdated={handleTemplateUpdated}
          campaignId={campaign.id}
          campaignTriggerType={campaign?.trigger_type}
        />
      </Box>
    </AdminLayout>
  );
} 