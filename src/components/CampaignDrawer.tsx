import React, { useState, useEffect } from 'react';
import {
  Drawer,
  DrawerBody,
  DrawerFooter,
  DrawerHeader,
  DrawerOverlay,
  DrawerContent,
  DrawerCloseButton,
  Button,
  VStack,
  HStack,
  FormControl,
  FormLabel,
  Input,
  Textarea,
  Select,
  Switch,
  Text,
  useToast,
  Box,
} from '@chakra-ui/react';

interface Campaign {
  id?: string;
  name: string;
  description: string;
  trigger_type: 'member_signup' | 'member_birthday' | 'member_renewal' | 'reservation_time' | 'reservation_created';
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

interface CampaignDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  campaignId?: string | null;
  isCreateMode?: boolean;
  onCampaignUpdated: () => void;
}

const CampaignDrawer: React.FC<CampaignDrawerProps> = ({
  isOpen,
  onClose,
  campaignId,
  isCreateMode = false,
  onCampaignUpdated,
}) => {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [formData, setFormData] = useState<Campaign>({
    name: '',
    description: '',
    trigger_type: 'member_signup',
    is_active: true,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (isOpen && !isCreateMode && campaignId) {
      fetchCampaign();
    } else if (isOpen && isCreateMode) {
      // Reset form for create mode
      setFormData({
        name: '',
        description: '',
        trigger_type: 'member_signup',
        is_active: true,
      });
      setCampaign(null);
    }
  }, [isOpen, campaignId, isCreateMode]);

  const fetchCampaign = async () => {
    if (!campaignId) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`/api/campaigns/${campaignId}`);
      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 500 && errorData.error?.includes('relation "campaigns" does not exist')) {
          toast({
            title: 'Setup Required',
            description: 'Please run the database migration first to create the campaigns table.',
            status: 'warning',
            duration: 5000,
          });
          onClose();
          return;
        }
        throw new Error('Failed to fetch campaign');
      }
      const data = await response.json();
      setCampaign(data);
      setFormData({
        name: data.name || '',
        description: data.description || '',
        trigger_type: data.trigger_type || 'member_signup',
        is_active: data.is_active !== undefined ? data.is_active : true,
      });
    } catch (error) {
      console.error('Error fetching campaign:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch campaign',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in the campaign name',
        status: 'error',
        duration: 3000,
      });
      return;
    }

    // Validate trigger_type
    const validTriggerTypes = ['member_signup', 'member_birthday', 'member_renewal', 'reservation_time'];
    if (!validTriggerTypes.includes(formData.trigger_type)) {
      toast({
        title: 'Validation Error',
        description: `Invalid trigger type: ${formData.trigger_type}. Must be one of: ${validTriggerTypes.join(', ')}`,
        status: 'error',
        duration: 5000,
      });
      return;
    }

    setIsSaving(true);
    try {
      const url = isCreateMode 
        ? '/api/campaigns' 
        : `/api/campaigns/${campaignId}`;
      
      const method = isCreateMode ? 'POST' : 'PUT';
      
      console.log('Saving campaign with data:', formData);
      console.log('Using URL:', url, 'Method:', method);
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      console.log('Response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Error response:', errorData);
        throw new Error(errorData.error || errorData.details || `HTTP ${response.status}: ${response.statusText}`);
      }

      toast({
        title: 'Success',
        description: `Campaign ${isCreateMode ? 'created' : 'updated'} successfully`,
        status: 'success',
        duration: 3000,
      });

      onCampaignUpdated();
      onClose();
    } catch (error) {
      console.error('Error saving campaign:', error);
      toast({
        title: 'Error',
        description: 'Failed to save campaign',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Drawer
      isOpen={isOpen}
      placement="right"
      onClose={onClose}
      size="lg"
    >
      <DrawerOverlay />
      <DrawerContent
        borderLeft="2px solid #a59480"
        borderRadius="0 0 0 20px"
        fontFamily="'Montserrat', sans-serif"
        maxW="600px"
        w="100%"
        boxShadow="0 0 50px rgba(0,0,0,0.3)"
        mt="60px"
        mb="20px"
        padding="0"
        backgroundColor="#f8f9fa"
        position="relative"
        transform="translateX(0)"
        transition="all 0.3s ease"
      >
        <DrawerHeader
          borderBottom="2px solid #ecede8"
          backgroundColor="#ecede8"
          color="#353535"
          fontFamily="'IvyJournal', serif"
          fontSize="2xl"
          fontWeight="bold"
          py={6}
        >
          <HStack justify="space-between">
            <Text>{isCreateMode ? 'Create New Campaign' : 'Edit Campaign'}</Text>
            <DrawerCloseButton
              color="#a59480"
              _hover={{ color: '#8a7a66' }}
              size="lg"
            />
          </HStack>
        </DrawerHeader>

        <DrawerBody py={8} overflowY="auto" maxH="calc(100vh - 200px)">
          {isLoading ? (
            <Box textAlign="center" py={12}>
              <Text>Loading campaign...</Text>
            </Box>
          ) : (
            <VStack spacing={6} align="stretch">
              {/* Basic Information */}
              <Box>
                <Text fontSize="lg" fontWeight="bold" color="#353535" mb={4}>
                  Campaign Information
                </Text>
                
                <VStack spacing={4} align="stretch">
                  <FormControl>
                    <FormLabel fontFamily="'Montserrat', sans-serif" color="#a59480">
                      Campaign Name *
                    </FormLabel>
                    <Input
                      value={formData.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      placeholder="Enter campaign name"
                      borderColor="#a59480"
                      _focus={{ borderColor: '#8a7a66', boxShadow: '0 0 0 1px #8a7a66' }}
                      fontFamily="'Montserrat', sans-serif"
                    />
                  </FormControl>

                  <FormControl>
                    <FormLabel fontFamily="'Montserrat', sans-serif" color="#a59480">
                      Description
                    </FormLabel>
                    <Textarea
                      value={formData.description}
                      onChange={(e) => handleInputChange('description', e.target.value)}
                      placeholder="Enter campaign description"
                      borderColor="#a59480"
                      _focus={{ borderColor: '#8a7a66', boxShadow: '0 0 0 1px #8a7a66' }}
                      fontFamily="'Montserrat', sans-serif"
                      rows={3}
                    />
                  </FormControl>

                  <FormControl>
                    <FormLabel fontFamily="'Montserrat', sans-serif" color="#a59480">
                      Trigger Type
                    </FormLabel>
                    <Select
                      value={formData.trigger_type}
                      onChange={(e) => handleInputChange('trigger_type', e.target.value)}
                      borderColor="#a59480"
                      _focus={{ borderColor: '#8a7a66', boxShadow: '0 0 0 1px #8a7a66' }}
                      fontFamily="'Montserrat', sans-serif"
                    >
                      <option value="member_signup">Member Signup</option>
                      <option value="member_birthday">Member Birthday</option>
                      <option value="member_renewal">Member Renewal Date</option>
                      <option value="reservation_time">Reservation Time</option>
                      <option value="reservation_created">Reservation Created</option>
                    </Select>
                  </FormControl>

                  <FormControl>
                    <FormLabel fontFamily="'Montserrat', sans-serif" color="#a59480">
                      Active Status
                    </FormLabel>
                    <HStack spacing={4}>
                      <Switch
                        isChecked={formData.is_active}
                        onChange={(e) => handleInputChange('is_active', e.target.checked)}
                        colorScheme="green"
                        size="lg"
                      />
                      <Text fontFamily="'Montserrat', sans-serif" color="#353535">
                        {formData.is_active ? 'Active' : 'Inactive'}
                      </Text>
                    </HStack>
                  </FormControl>
                </VStack>
              </Box>

              {/* Campaign ID Info */}
              {!isCreateMode && campaign && (
                <Box bg="#ecede8" p={4} borderRadius="md">
                  <Text fontSize="sm" color="#666" fontFamily="'Montserrat', sans-serif">
                    <strong>Campaign ID:</strong> {campaign.id}
                  </Text>
                  <Text fontSize="sm" color="#666" fontFamily="'Montserrat', sans-serif">
                    <strong>Created:</strong> {new Date(campaign.created_at || '').toLocaleDateString()}
                  </Text>
                  {campaign.updated_at && (
                    <Text fontSize="sm" color="#666" fontFamily="'Montserrat', sans-serif">
                      <strong>Last Updated:</strong> {new Date(campaign.updated_at).toLocaleDateString()}
                    </Text>
                  )}
                </Box>
              )}
            </VStack>
          )}
        </DrawerBody>

        <DrawerFooter borderTop="2px solid #ecede8" backgroundColor="#ecede8">
          <HStack spacing={4} width="100%">
            <Button
              variant="outline"
              onClick={onClose}
              color="#a59480"
              borderColor="#a59480"
              _hover={{ bg: '#ecede8' }}
              fontFamily="'Montserrat', sans-serif"
              flex={1}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              isLoading={isSaving}
              loadingText="Saving..."
              colorScheme="green"
              bg="#a59480"
              _hover={{ bg: '#8a7a66' }}
              fontFamily="'Montserrat', sans-serif"
              flex={1}
            >
              {isCreateMode ? 'Create Campaign' : 'Update Campaign'}
            </Button>
          </HStack>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};

export default CampaignDrawer; 