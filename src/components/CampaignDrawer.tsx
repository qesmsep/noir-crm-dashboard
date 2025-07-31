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
  Checkbox,
  CheckboxGroup,
  Stack,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
  Radio,
  RadioGroup,
  Divider,
  Badge,
  IconButton,
} from '@chakra-ui/react';
import { CloseIcon, CalendarIcon } from '@chakra-ui/icons';

interface Campaign {
  id?: string;
  name: string;
  description: string;
  trigger_type: 'member_signup' | 'member_birthday' | 'member_renewal' | 'reservation_time' | 'reservation_created' | 'reservation' | 'recurring' | 'reservation_range' | 'private_event' | 'all_members';
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
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
    trigger_type: 'reservation',
    is_active: true,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [privateEvents, setPrivateEvents] = useState<any[]>([]);
  const toast = useToast();

  // Initialization effect: runs when drawer opens or mode/campaign changes
  useEffect(() => {
    if (isOpen) {
      if (!isCreateMode && campaignId) {
        fetchCampaign();
      } else if (isCreateMode) {
        setFormData({
          name: '',
          description: '',
          trigger_type: 'member_signup',
          is_active: true,
          include_event_list: false,
          event_list_date_range: { type: 'this_month' },
        });
        setCampaign(null);
      }
    }
  }, [isOpen, campaignId, isCreateMode]);

  // Fetch private events only when private_event trigger type is selected
  useEffect(() => {
    if (isOpen && formData.trigger_type === 'private_event') {
      fetchPrivateEvents();
    }
  }, [isOpen, formData.trigger_type]);

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
        recurring_schedule: data.recurring_schedule,
        recurring_start_date: data.recurring_start_date,
        recurring_end_date: data.recurring_end_date,
        reservation_range_start: data.reservation_range_start,
        reservation_range_end: data.reservation_range_end,
        selected_private_event_id: data.selected_private_event_id,
        include_event_list: data.include_event_list,
        event_list_date_range: data.event_list_date_range,
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

  const fetchPrivateEvents = async () => {
    try {
      const response = await fetch('/api/private-events');
      if (response.ok) {
        const data = await response.json();
        setPrivateEvents(data);
      }
    } catch (error) {
      console.error('Error fetching private events:', error);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const getTriggerTypeOptions = () => [
    { value: 'all_members', label: 'All Members' },
    { value: 'member_birthday', label: 'Member Birthday' },
    { value: 'member_renewal', label: 'Member Renewal' },
    { value: 'member_signup', label: 'Member Signup' },
    { value: 'private_event', label: 'Private Event' },
    { value: 'recurring', label: 'Recurring' },
    { value: 'reservation', label: 'Reservation' },
    { value: 'reservation_created', label: 'Reservation Created' },
    { value: 'reservation_range', label: 'Reservation Range' },
    { value: 'reservation_time', label: 'Reservation Time' },
  ];

  const renderTriggerTypeSpecificFields = () => {
    switch (formData.trigger_type) {
      case 'recurring':
        return (
          <VStack spacing={4} align="stretch">
            <FormControl>
              <FormLabel fontFamily="'Montserrat', sans-serif" color="#a59480">
                Recurring Schedule
              </FormLabel>
              <RadioGroup value={formData.recurring_schedule?.type || 'weekly'} onChange={(value) => handleInputChange('recurring_schedule', { ...formData.recurring_schedule, type: value })}>
                <Stack direction="column">
                  <Radio value="daily" colorScheme="green">Daily</Radio>
                  <Radio value="weekly" colorScheme="green">Weekly</Radio>
                  <Radio value="monthly" colorScheme="green">Monthly</Radio>
                  <Radio value="yearly" colorScheme="green">Yearly</Radio>
                  <Radio value="weekdays" colorScheme="green">Specific Weekdays</Radio>
                  <Radio value="first_of_month" colorScheme="green">1st of Month</Radio>
                  <Radio value="last_of_month" colorScheme="green">Last Day of Month</Radio>
                </Stack>
              </RadioGroup>
            </FormControl>

            {(formData.recurring_schedule?.type === 'weekdays') && (
              <FormControl>
                <FormLabel fontFamily="'Montserrat', sans-serif" color="#a59480">
                  Select Weekdays
                </FormLabel>
                <CheckboxGroup value={formData.recurring_schedule?.weekdays || []} onChange={(value) => handleInputChange('recurring_schedule', { ...formData.recurring_schedule, weekdays: value })}>
                  <Stack direction="column">
                    <Checkbox value="0">Sunday</Checkbox>
                    <Checkbox value="1">Monday</Checkbox>
                    <Checkbox value="2">Tuesday</Checkbox>
                    <Checkbox value="3">Wednesday</Checkbox>
                    <Checkbox value="4">Thursday</Checkbox>
                    <Checkbox value="5">Friday</Checkbox>
                    <Checkbox value="6">Saturday</Checkbox>
                  </Stack>
                </CheckboxGroup>
              </FormControl>
            )}

            <HStack spacing={4}>
              <FormControl>
                <FormLabel fontFamily="'Montserrat', sans-serif" color="#a59480">
                  Start Date
                </FormLabel>
                <Input
                  type="date"
                  value={formData.recurring_start_date || ''}
                  onChange={(e) => handleInputChange('recurring_start_date', e.target.value)}
                  borderColor="#a59480"
                  _focus={{ borderColor: '#8a7a66', boxShadow: '0 0 0 1px #8a7a66' }}
                />
              </FormControl>

              <FormControl>
                <FormLabel fontFamily="'Montserrat', sans-serif" color="#a59480">
                  End Date (Optional)
                </FormLabel>
                <Input
                  type="date"
                  value={formData.recurring_end_date || ''}
                  onChange={(e) => handleInputChange('recurring_end_date', e.target.value)}
                  borderColor="#a59480"
                  _focus={{ borderColor: '#8a7a66', boxShadow: '0 0 0 1px #8a7a66' }}
                />
              </FormControl>
            </HStack>
          </VStack>
        );

      case 'reservation_range':
        return (
          <VStack spacing={4} align="stretch">
            <HStack spacing={4}>
              <FormControl>
                <FormLabel fontFamily="'Montserrat', sans-serif" color="#a59480">
                  Start Date & Time
                </FormLabel>
                <Input
                  type="datetime-local"
                  value={formData.reservation_range_start || ''}
                  onChange={(e) => handleInputChange('reservation_range_start', e.target.value)}
                  borderColor="#a59480"
                  _focus={{ borderColor: '#8a7a66', boxShadow: '0 0 0 1px #8a7a66' }}
                />
              </FormControl>

              <FormControl>
                <FormLabel fontFamily="'Montserrat', sans-serif" color="#a59480">
                  End Date & Time
                </FormLabel>
                <Input
                  type="datetime-local"
                  value={formData.reservation_range_end || ''}
                  onChange={(e) => handleInputChange('reservation_range_end', e.target.value)}
                  borderColor="#a59480"
                  _focus={{ borderColor: '#8a7a66', boxShadow: '0 0 0 1px #8a7a66' }}
                />
              </FormControl>
            </HStack>
          </VStack>
        );

      case 'private_event':
        return (
          <VStack spacing={4} align="stretch">
            <FormControl>
              <FormLabel fontFamily="'Montserrat', sans-serif" color="#a59480">
                Select Private Event
              </FormLabel>
              <Select
                value={formData.selected_private_event_id || ''}
                onChange={(e) => handleInputChange('selected_private_event_id', e.target.value)}
                borderColor="#a59480"
                _focus={{ borderColor: '#8a7a66', boxShadow: '0 0 0 1px #8a7a66' }}
                placeholder="Select a private event"
              >
                {privateEvents.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.title} - {new Date(event.start_time).toLocaleDateString()}
                  </option>
                ))}
              </Select>
            </FormControl>
          </VStack>
        );

      case 'all_members':
        return (
          <VStack spacing={4} align="stretch">
            <FormControl display="flex" alignItems="center">
              <FormLabel htmlFor="include-event-list" mb="0" fontFamily="'Montserrat', sans-serif" color="#a59480">
                Include Event List
              </FormLabel>
              <Switch
                id="include-event-list"
                isChecked={formData.include_event_list || false}
                onChange={(e) => handleInputChange('include_event_list', e.target.checked)}
                colorScheme="green"
              />
            </FormControl>
            
            {formData.include_event_list && (
              <VStack spacing={4} align="stretch">
                <FormControl>
                  <FormLabel fontFamily="'Montserrat', sans-serif" color="#a59480">Event Date Range</FormLabel>
                  <Select
                    value={formData.event_list_date_range?.type || 'this_month'}
                    onChange={(e) => handleInputChange('event_list_date_range', { 
                      ...formData.event_list_date_range, 
                      type: e.target.value 
                    })}
                    bg="#ecede8"
                    color="#353535"
                    borderColor="#a59480"
                    _focus={{ borderColor: '#a59480', boxShadow: '0 0 0 1px #a59480' }}
                  >
                    <option value="this_month">This Month</option>
                    <option value="next_month">Next Month</option>
                    <option value="specific_range">Specific Date Range</option>
                  </Select>
                </FormControl>

                {formData.event_list_date_range?.type === 'specific_range' && (
                  <HStack spacing={4}>
                    <FormControl>
                      <FormLabel fontFamily="'Montserrat', sans-serif" color="#a59480">Start Date</FormLabel>
                      <Input
                        type="date"
                        value={formData.event_list_date_range?.start_date || ''}
                        onChange={(e) => handleInputChange('event_list_date_range', { 
                          ...formData.event_list_date_range, 
                          start_date: e.target.value 
                        })}
                        bg="#ecede8"
                        color="#353535"
                        borderColor="#a59480"
                        _focus={{ borderColor: '#a59480', boxShadow: '0 0 0 1px #a59480' }}
                      />
                    </FormControl>
                    <FormControl>
                      <FormLabel fontFamily="'Montserrat', sans-serif" color="#a59480">End Date</FormLabel>
                      <Input
                        type="date"
                        value={formData.event_list_date_range?.end_date || ''}
                        onChange={(e) => handleInputChange('event_list_date_range', { 
                          ...formData.event_list_date_range, 
                          end_date: e.target.value 
                        })}
                        bg="#ecede8"
                        color="#353535"
                        borderColor="#a59480"
                        _focus={{ borderColor: '#a59480', boxShadow: '0 0 0 1px #a59480' }}
                      />
                    </FormControl>
                  </HStack>
                )}

                <Text fontSize="sm" color="#a59480">
                  Will include all "Noir Member Event" events within the selected date range.
                </Text>
              </VStack>
            )}
          </VStack>
        );

      default:
        return null;
    }
  };

  const handleSave = async () => {
    console.log('Save button clicked!');
    console.log('Form data:', formData);
    console.log('Is create mode:', isCreateMode);
    
    if (!formData.name.trim()) {
      console.log('Validation failed: name is empty');
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields',
        status: 'error',
        duration: 3000,
      });
      return;
    }

    setIsSaving(true);
    try {
      const url = isCreateMode 
        ? '/api/campaigns' 
        : `/api/campaigns/${campaignId}`;
      
      const method = isCreateMode ? 'POST' : 'PUT';
      
      console.log('Making request to:', url);
      console.log('Method:', method);
      console.log('Request body:', JSON.stringify(formData, null, 2));
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);

      if (!response.ok) {
        const errorText = await response.text();
        console.log('Error response:', errorText);
        throw new Error('Failed to save campaign');
      }

      const result = await response.json();
      console.log('Success response:', result);

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
                      Trigger Type *
                    </FormLabel>
                    <Select
                      value={formData.trigger_type}
                      onChange={(e) => handleInputChange('trigger_type', e.target.value)}
                      borderColor="#a59480"
                      _focus={{ borderColor: '#8a7a66', boxShadow: '0 0 0 1px #8a7a66' }}
                      fontFamily="'Montserrat', sans-serif"
                    >
                      {getTriggerTypeOptions().map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                  </FormControl>
                </VStack>
              </Box>

              {/* Trigger Type Specific Fields */}
              {formData.trigger_type && (
                <>
                  <Divider borderColor="#a59480" />
                  <Box>
                    <Text fontSize="lg" fontWeight="bold" color="#353535" mb={4}>
                      {formData.trigger_type === 'recurring' && 'Recurring Schedule'}
                      {formData.trigger_type === 'reservation_range' && 'Reservation Range'}
                      {formData.trigger_type === 'private_event' && 'Private Event Selection'}
                      {formData.trigger_type === 'all_members' && 'All Members Options'}
                    </Text>
                    {renderTriggerTypeSpecificFields()}
                  </Box>
                </>
              )}

              {/* Status */}
              <Divider borderColor="#a59480" />
              <Box>
                <Text fontSize="lg" fontWeight="bold" color="#353535" mb={4}>
                  Status
                </Text>
                <HStack spacing={4} align="center">
                  <Button
                    size="sm"
                    colorScheme={formData.is_active ? 'green' : 'red'}
                    variant="outline"
                    onClick={() => handleInputChange('is_active', !formData.is_active)}
                    fontFamily="'Montserrat', sans-serif"
                    fontWeight="bold"
                    _hover={{
                      transform: 'translateY(-1px)',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    }}
                  >
                    {formData.is_active ? 'Active' : 'Inactive'}
                  </Button>
                </HStack>
              </Box>
            </VStack>
          )}
        </DrawerBody>

        <DrawerFooter>
          <HStack spacing={4} w="full">
            <Button
              variant="outline"
              onClick={onClose}
              flex={1}
              fontFamily="'Montserrat', sans-serif"
              borderColor="#353535"
              color="#353535"
              _hover={{ bg: '#f0f0f0' }}
            >
              Cancel
            </Button>
            <Button
              colorScheme="blue"
              onClick={handleSave}
              isLoading={isSaving}
              loadingText="Saving..."
              flex={1}
              fontFamily="'Montserrat', sans-serif"
              bg="#a59480"
              color="#ECEDE8"
              _hover={{ bg: '#8a7a6a' }}
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