import React, { useState, useEffect } from 'react';
import {
  Drawer,
  DrawerBody,
  DrawerFooter,
  DrawerHeader,
  DrawerOverlay,
  DrawerContent,
  Button,
  VStack,
  HStack,
  FormControl,
  FormLabel,
  Input,
  Select,
  Textarea,
  Text,
  Box,
  Divider,
  useToast,
  Spinner,
  Badge,
  IconButton,
  Switch,
  Alert,
  AlertIcon,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
  Radio,
  RadioGroup,
  Stack,
} from '@chakra-ui/react';
import { CloseIcon, DeleteIcon } from '@chakra-ui/icons';
import { useSettings } from '../context/SettingsContext';

interface CampaignTemplate {
  id?: string;
  campaign_id: string; // Now a UUID string
  name: string;
  description: string;
  content: string;
  recipient_type: 'member' | 'all_members' | 'specific_phone';
  specific_phone?: string;
  timing_type: 'specific_time' | 'duration';
  specific_time?: string; // HH:MM format
  specific_time_quantity?: number; // Number of time units relative to trigger date
  specific_time_unit?: 'min' | 'hr' | 'day' | 'month' | 'year'; // Time unit for relative timing
  specific_time_proximity?: 'before' | 'after'; // Whether to send before or after trigger date
  duration_quantity?: number;
  duration_unit?: 'min' | 'hr' | 'day' | 'month' | 'year';
  duration_proximity?: 'before' | 'after';
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

interface CampaignTemplateDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  templateId?: string | null;
  isCreateMode?: boolean;
  onTemplateUpdated: () => void;
  campaignId?: string;
  isCampaignMode?: boolean;
  campaignTriggerType?: 'member_signup' | 'member_birthday' | 'member_renewal' | 'reservation_time';
}

const CampaignTemplateDrawer: React.FC<CampaignTemplateDrawerProps> = ({
  isOpen,
  onClose,
  templateId,
  isCreateMode = false,
  onTemplateUpdated,
  campaignId,
  isCampaignMode = false,
  campaignTriggerType,
}) => {
  const [template, setTemplate] = useState<CampaignTemplate | null>(null);
  const [formData, setFormData] = useState({
    campaign_id: '',
    name: '',
    description: '',
    content: '',
    recipient_type: 'member' as 'member' | 'all_members' | 'specific_phone',
    specific_phone: '',
    timing_type: 'specific_time' as 'specific_time' | 'duration',
    specific_time: '10:00',
    specific_time_quantity: 0,
    specific_time_unit: 'day' as 'min' | 'hr' | 'day' | 'month' | 'year',
    specific_time_proximity: 'after' as 'before' | 'after',
    duration_quantity: 1,
    duration_unit: 'hr' as 'min' | 'hr' | 'day' | 'month' | 'year',
    duration_proximity: 'after' as 'before' | 'after',

    is_active: true,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const toast = useToast();
  const { settings } = useSettings();

  useEffect(() => {
    if (isOpen) {
      if (isCreateMode) {
        // Reset form for create mode with campaign trigger type
        setFormData({
          campaign_id: campaignId || '',
          name: '',
          description: '',
          content: '',
          recipient_type: 'member',
          specific_phone: '',
          timing_type: 'specific_time',
          specific_time: '10:00',
          specific_time_quantity: 0,
          specific_time_unit: 'day',
          specific_time_proximity: 'after',
          duration_quantity: 1,
          duration_unit: 'hr',
          duration_proximity: 'after',

          is_active: true,
        });
        setTemplate(null);
        setShowPreview(false);
      } else if (templateId) {
        fetchTemplate();
        setShowPreview(false);
      }
    }
  }, [isOpen, isCreateMode, templateId, campaignTriggerType]);

  const fetchTemplate = async () => {
    if (!templateId) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`/api/campaign-messages/${templateId}`);
      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 500 && errorData.error?.includes('relation "campaign_messages" does not exist')) {
          toast({
            title: 'Setup Required',
            description: 'Please run the database migration first to create the campaign messages table.',
            status: 'warning',
            duration: 5000,
          });
          onClose();
          return;
        }
        throw new Error('Failed to fetch template');
      }
      const data = await response.json();
      setTemplate(data);
      setFormData({
        campaign_id: data.campaign_id || '',
        name: data.name || '',
        description: data.description || '',
        content: data.content || '',
        recipient_type: data.recipient_type || 'member',
        specific_phone: data.specific_phone || '',
        timing_type: data.timing_type || 'specific_time',
        specific_time: data.specific_time || '10:00',
        specific_time_quantity: data.specific_time_quantity || 0,
        specific_time_unit: data.specific_time_unit || 'day',
        specific_time_proximity: data.specific_time_proximity || 'after',
        duration_quantity: data.duration_quantity || 1,
        duration_unit: data.duration_unit || 'hr',
        duration_proximity: data.duration_proximity || 'after',

        is_active: data.is_active !== undefined ? data.is_active : true,
      });
    } catch (error) {
      console.error('Error fetching template:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch template',
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
    console.log('=== SAVING MESSAGE TEMPLATE ===');
    console.log('Form data:', formData);
    console.log('Campaign ID:', campaignId);
    console.log('Is create mode:', isCreateMode);
    console.log('Template ID:', templateId);

    if (!formData.name.trim() || !formData.content.trim()) {
      console.log('Validation failed: Missing required fields');
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields',
        status: 'error',
        duration: 3000,
      });
      return;
    }

    // Log timing information for message sending
    console.log('=== MESSAGE TIMING ANALYSIS ===');
    if (formData.timing_type === 'specific_time') {
      console.log(`Message will be sent at: ${formData.specific_time} on trigger date`);
    } else {
      console.log(`Message will be sent: ${formData.duration_quantity} ${formData.duration_unit} ${formData.duration_proximity} trigger`);
    }
    
    // Log recipient information
    console.log('=== RECIPIENT ANALYSIS ===');
    console.log('Recipient type:', formData.recipient_type);
    if (formData.recipient_type === 'specific_phone') {
      console.log('Specific phone:', formData.specific_phone);
    }
    
    // Log message content analysis
    console.log('=== MESSAGE CONTENT ANALYSIS ===');
    console.log('Message length:', formData.content.length, 'characters');
    console.log('Contains placeholders:', {
      first_name: formData.content.includes('{{first_name}}'),
      last_name: formData.content.includes('{{last_name}}'),
      member_name: formData.content.includes('{{member_name}}'),
      phone: formData.content.includes('{{phone}}'),
      email: formData.content.includes('{{email}}'),
      reservation_time: formData.content.includes('{{reservation_time}}'),
    });

    setIsSaving(true);
    try {
      const url = isCreateMode 
        ? '/api/campaign-messages' 
        : `/api/campaign-messages/${templateId}`;
      
      const method = isCreateMode ? 'POST' : 'PUT';
      
      // Clean up the data to only send relevant fields based on timing type
      let cleanedData: any = { ...formData };
      
      // Remove trigger_type as it's not in the database schema
      delete cleanedData.trigger_type;
      
      // Only include timing-specific fields based on timing_type
      if (formData.timing_type === 'specific_time') {
        // For specific_time, only include specific_time field
        delete cleanedData.duration_quantity;
        delete cleanedData.duration_unit;
        delete cleanedData.duration_proximity;
      } else {
        // For duration, only include duration fields
        delete cleanedData.specific_time;
      }
      
      // If creating a template within a campaign, set the campaign_id
      const dataToSend = isCreateMode && campaignId 
        ? { ...cleanedData, campaign_id: campaignId }
        : cleanedData;
      
      console.log('Sending request to:', url);
      console.log('Request method:', method);
      console.log('Request data:', dataToSend);
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dataToSend),
      });

      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Response error:', errorText);
        throw new Error(`Failed to save template: ${response.status} ${response.statusText}`);
      }

      const responseData = await response.json();
      console.log('Response data:', responseData);

      console.log('=== MESSAGE TEMPLATE SAVED SUCCESSFULLY ===');
      console.log('Template will be processed by cron job every 10 minutes');
      console.log('Next processing time:', new Date(Date.now() + 10 * 60 * 1000).toLocaleString());
      
      toast({
        title: 'Success',
        description: `Message ${isCreateMode ? 'created' : 'updated'} successfully`,
        status: 'success',
        duration: 3000,
      });

      onTemplateUpdated();
      onClose();
    } catch (error) {
      console.error('Error saving template:', error);
      toast({
        title: 'Error',
        description: 'Failed to save template',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!templateId) return;

    setIsConfirmingDelete(false);
    setIsSaving(true);
    try {
      const response = await fetch(`/api/campaign-messages/${templateId}`, {
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

      onTemplateUpdated();
      onClose();
    } catch (error) {
      console.error('Error deleting template:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete template',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const getPreviewMessage = () => {
    return formData.content
      .replace(/\{\{first_name\}\}/g, 'John')
      .replace(/\{\{last_name\}\}/g, 'Doe')
      .replace(/\{\{member_name\}\}/g, 'John Doe')
      .replace(/\{\{phone\}\}/g, '(555) 123-4567')
      .replace(/\{\{email\}\}/g, 'john.doe@example.com');
  };

  const formatTimingDisplay = () => {
    if (formData.timing_type === 'specific_time') {
      const unit = formData.specific_time_quantity === 1 ? formData.specific_time_unit : formData.specific_time_unit + 's';
      return `Send at ${formData.specific_time} ${formData.specific_time_quantity} ${unit} ${formData.specific_time_proximity} trigger date`;
    } else {
      const unit = formData.duration_quantity === 1 ? formData.duration_unit : formData.duration_unit + 's';
      return `Send ${formData.duration_quantity} ${unit} ${formData.duration_proximity} trigger`;
    }
  };

  const formatPhoneNumber = (phone: string) => {
    // Remove all non-digits
    const digits = phone.replace(/\D/g, '');
    
    // Format as (XXX) XXX-XXXX
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    } else if (digits.length === 11 && digits.startsWith('1')) {
      return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    }
    
    return phone;
  };

  const handlePhoneChange = (phone: string) => {
    // Remove all non-digits
    const digits = phone.replace(/\D/g, '');
    
    // Convert to international format for storage
    let formattedPhone = phone;
    if (digits.length === 10) {
      formattedPhone = '+1' + digits;
    } else if (digits.length === 11 && digits.startsWith('1')) {
      formattedPhone = '+' + digits;
    } else {
      formattedPhone = '+' + digits;
    }
    
    setFormData(prev => ({ ...prev, specific_phone: formattedPhone }));
  };

  const getRecipientOptions = () => {
    if (!campaignTriggerType) return [];
    
    if (campaignTriggerType === 'reservation_time') {
      return [
        { value: 'member', label: 'Phone number on reservation' },
        { value: 'specific_phone', label: 'Custom phone number' }
      ];
    } else {
      // member_signup, member_birthday, member_renewal
      return [
        { value: 'member', label: 'Primary member' },
        { value: 'all_members', label: 'All members' },
        { value: 'specific_phone', label: 'Custom phone number' }
      ];
    }
  };

  return (
    <Drawer 
      isOpen={isOpen} 
      placement="right" 
      onClose={onClose} 
      size="sm"
      closeOnOverlayClick={true}
      closeOnEsc={true}
    >
      <Box zIndex="2000" position="relative">
        <DrawerOverlay bg="blackAlpha.600" onClick={onClose} />
        <DrawerContent 
          border="2px solid #353535" 
          borderRadius="10px"  
          fontFamily="Montserrat, sans-serif" 
          maxW="500px" 
          w="50vw" 
          boxShadow="xl" 
          mt="80px" 
          mb="25px" 
          paddingRight="40px" 
          paddingLeft="40px" 
          backgroundColor="#ecede8"
          position="fixed"
          top="0"
          right="0"
          style={{
            transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
            transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
            willChange: 'transform',
            transformStyle: 'preserve-3d',
            backfaceVisibility: 'hidden'
          }}
        >
          <DrawerHeader borderBottomWidth="1px" margin="0" fontWeight="bold" paddingTop="0px" fontSize="24px" fontFamily="IvyJournal, sans-serif" color="#353535">
            <HStack justify="space-between" align="center">
              <Text>
                {isCreateMode ? 'Create/Edit Message' : 'Edit Message'}
              </Text>
              <IconButton
                aria-label="Close drawer"
                icon={<CloseIcon />}
                size="sm"
                variant="ghost"
                bg="#353535"
                onClick={onClose}
                color="#ECEDE8"
                _hover={{ bg: '#2a2a2a' }}
              />
            </HStack>
          </DrawerHeader>

          <DrawerBody className="drawer-body-content" overflowY="auto" maxH="calc(100vh - 200px)">
            {isLoading ? (
              <Box display="flex" justifyContent="center" alignItems="center" height="200px">
                <Spinner size="xl" color="#a59480" />
              </Box>
            ) : (
              <VStack spacing={6} align="stretch">
                {/* Basic Information */}
                <Box>
                  <Text fontSize="lg" fontWeight="bold" mb={4} fontFamily="'Montserrat', sans-serif" color="#a59480">
                    Basic Information
                  </Text>
                  <VStack spacing={4}>
                    <FormControl>
                      <FormLabel fontFamily="'Montserrat', sans-serif" color="#a59480">Template Name</FormLabel>
                      <Input
                        value={formData.name}
                        onChange={(e) => handleInputChange('name', e.target.value)}
                        bg="#ecede8"
                        color="#353535"
                        borderColor="#a59480"
                        _focus={{ borderColor: '#a59480', boxShadow: '0 0 0 1px #a59480' }}
                      />
                    </FormControl>

                    <FormControl>
                      <FormLabel fontFamily="'Montserrat', sans-serif" color="#a59480">Description</FormLabel>
                      <Input
                        value={formData.description}
                        onChange={(e) => handleInputChange('description', e.target.value)}
                        bg="#ecede8"
                        color="#353535"
                        borderColor="#a59480"
                        _focus={{ borderColor: '#a59480', boxShadow: '0 0 0 1px #a59480' }}
                      />
                    </FormControl>
                  </VStack>
                </Box>

                <Divider borderColor="#a59480" />

                {/* Recipient Configuration */}
                <Box>
                  <Text fontSize="lg" fontWeight="bold" mb={4} fontFamily="'Montserrat', sans-serif" color="#a59480">
                    Recipient Configuration
                  </Text>
                  <VStack spacing={4}>
                    <FormControl>
                      <FormLabel fontFamily="'Montserrat', sans-serif" color="#a59480">Recipient Type</FormLabel>
                      <Select
                        value={formData.recipient_type}
                        onChange={(e) => handleInputChange('recipient_type', e.target.value)}
                        bg="#ecede8"
                        color="#353535"
                        borderColor="#a59480"
                        _focus={{ borderColor: '#a59480', boxShadow: '0 0 0 1px #a59480' }}
                      >
                        {getRecipientOptions().map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </Select>
                    </FormControl>

                    {formData.recipient_type === 'specific_phone' && (
                      <FormControl>
                        <FormLabel fontFamily="'Montserrat', sans-serif" color="#a59480">Phone Number</FormLabel>
                        <Input
                          value={formatPhoneNumber(formData.specific_phone || '')}
                          onChange={(e) => handlePhoneChange(e.target.value)}
                          bg="#ecede8"
                          color="#353535"
                          borderColor="#a59480"
                          _focus={{ borderColor: '#a59480', boxShadow: '0 0 0 1px #a59480' }}
                          placeholder="(555) 123-4567"
                        />
                        <Text fontSize="xs" color="#a59480" mt={1}>
                          Format: (XXX) XXX-XXXX
                        </Text>
                      </FormControl>
                    )}
                  </VStack>
                </Box>

                <Divider borderColor="#a59480" />

                {/* Timing Configuration */}
                <Box>
                  <Text fontSize="lg" fontWeight="bold" mb={4} fontFamily="'Montserrat', sans-serif" color="#a59480">
                    When to Send
                  </Text>
                  <VStack spacing={4}>
                    <FormControl>
                      <FormLabel fontFamily="'Montserrat', sans-serif" color="#a59480">Timing Type</FormLabel>
                      <RadioGroup value={formData.timing_type} onChange={(value) => handleInputChange('timing_type', value)}>
                        <Stack direction="column">
                          <Radio 
                            value="specific_time" 
                            colorScheme="green"
                            bg={formData.timing_type === 'specific_time' ? '#ecede8' : 'transparent'}
                            p={2}
                            borderRadius="md"
                            border={formData.timing_type === 'specific_time' ? '2px solid #a59480' : '1px solid transparent'}
                          >
                            Send at specific time relative to trigger date
                          </Radio>
                          <Radio 
                            value="duration" 
                            colorScheme="green"
                            bg={formData.timing_type === 'duration' ? '#ecede8' : 'transparent'}
                            p={2}
                            borderRadius="md"
                            border={formData.timing_type === 'duration' ? '2px solid #a59480' : '1px solid transparent'}
                          >
                            Send after/before trigger by duration
                          </Radio>
                        </Stack>
                      </RadioGroup>
                    </FormControl>

                    {formData.timing_type === 'specific_time' ? (
                      <VStack spacing={4} width="100%">
                        <FormControl>
                          <FormLabel fontFamily="'Montserrat', sans-serif" color="#a59480">Send Time</FormLabel>
                          <Input
                            type="time"
                            value={formData.specific_time}
                            onChange={(e) => handleInputChange('specific_time', e.target.value)}
                            bg="#ecede8"
                            color="#353535"
                            borderColor="#a59480"
                            _focus={{ borderColor: '#a59480', boxShadow: '0 0 0 1px #a59480' }}
                          />
                          <Text fontSize="xs" color="#a59480" mt={1}>
                            Time of day (e.g., 10:00 AM)
                          </Text>
                        </FormControl>

                        <HStack spacing={4} width="100%">
                          <FormControl>
                            <FormLabel fontFamily="'Montserrat', sans-serif" color="#a59480">Quantity</FormLabel>
                            <NumberInput
                              value={formData.specific_time_quantity}
                              onChange={(value) => handleInputChange('specific_time_quantity', parseInt(value))}
                              min={0}
                              max={2000}
                              bg="#ecede8"
                              color="#353535"
                              borderColor="#a59480"
                              _focus={{ borderColor: '#a59480', boxShadow: '0 0 0 1px #a59480' }}
                            >
                              <NumberInputField 
                                placeholder="0-2000"
                                _focus={{ borderColor: '#a59480', boxShadow: '0 0 0 1px #a59480' }}
                              />
                              <NumberInputStepper>
                                <NumberIncrementStepper />
                                <NumberDecrementStepper />
                              </NumberInputStepper>
                            </NumberInput>
                          </FormControl>

                          <FormControl>
                            <FormLabel fontFamily="'Montserrat', sans-serif" color="#a59480">Time Unit</FormLabel>
                            <Select
                              value={formData.specific_time_unit}
                              onChange={(e) => handleInputChange('specific_time_unit', e.target.value)}
                              bg="#ecede8"
                              color="#353535"
                              borderColor="#a59480"
                              _focus={{ borderColor: '#a59480', boxShadow: '0 0 0 1px #a59480' }}
                            >
                              <option value="min">Minutes</option>
                              <option value="hr">Hours</option>
                              <option value="day">Days</option>
                              <option value="month">Months</option>
                              <option value="year">Years</option>
                            </Select>
                          </FormControl>

                          <FormControl>
                            <FormLabel fontFamily="'Montserrat', sans-serif" color="#a59480">Proximity</FormLabel>
                            <Select
                              value={formData.specific_time_proximity}
                              onChange={(e) => handleInputChange('specific_time_proximity', e.target.value)}
                              bg="#ecede8"
                              color="#353535"
                              borderColor="#a59480"
                              _focus={{ borderColor: '#a59480', boxShadow: '0 0 0 1px #a59480' }}
                            >
                              <option value="before">Before</option>
                              <option value="after">After</option>
                            </Select>
                          </FormControl>
                        </HStack>
                      </VStack>
                    ) : (
                      <HStack spacing={4} width="100%">
                        <FormControl>
                          <FormLabel fontFamily="'Montserrat', sans-serif" color="#a59480">Quantity</FormLabel>
                          <NumberInput
                            value={formData.duration_quantity}
                            onChange={(value) => handleInputChange('duration_quantity', parseInt(value))}
                            min={0}
                            max={2000}
                            bg="#ecede8"
                            color="#353535"
                            borderColor="#a59480"
                            _focus={{ borderColor: '#a59480', boxShadow: '0 0 0 1px #a59480' }}
                          >
                            <NumberInputField 
                              placeholder="0-2000"
                              _focus={{ borderColor: '#a59480', boxShadow: '0 0 0 1px #a59480' }}
                            />
                            <NumberInputStepper>
                              <NumberIncrementStepper />
                              <NumberDecrementStepper />
                            </NumberInputStepper>
                          </NumberInput>
                        </FormControl>

                        <FormControl>
                          <FormLabel fontFamily="'Montserrat', sans-serif" color="#a59480">Time Unit</FormLabel>
                          <Select
                            value={formData.duration_unit}
                            onChange={(e) => handleInputChange('duration_unit', e.target.value)}
                            bg="#ecede8"
                            color="#353535"
                            borderColor="#a59480"
                            _focus={{ borderColor: '#a59480', boxShadow: '0 0 0 1px #a59480' }}
                          >
                            <option value="min">Minutes</option>
                            <option value="hr">Hours</option>
                            <option value="day">Days</option>
                            <option value="month">Months</option>
                            <option value="year">Years</option>
                          </Select>
                        </FormControl>

                        <FormControl>
                          <FormLabel fontFamily="'Montserrat', sans-serif" color="#a59480">Proximity</FormLabel>
                          <Select
                            value={formData.duration_proximity}
                            onChange={(e) => handleInputChange('duration_proximity', e.target.value)}
                            bg="#ecede8"
                            color="#353535"
                            borderColor="#a59480"
                            _focus={{ borderColor: '#a59480', boxShadow: '0 0 0 1px #a59480' }}
                          >
                            <option value="before">Before</option>
                            <option value="after">After</option>
                          </Select>
                        </FormControl>
                      </HStack>
                    )}

                    <Box p={4} bg="#ecede8" borderRadius="md" border="1px solid #a59480">
                      <Text fontFamily="'Montserrat', sans-serif" color="#353535" fontWeight="bold">
                        {formatTimingDisplay()}
                      </Text>
                    </Box>
                  </VStack>
                </Box>

                <Divider borderColor="#a59480" />

                {/* Message Template */}
                <Box>
                  <Text fontSize="lg" fontWeight="bold" mb={4} fontFamily="'Montserrat', sans-serif" color="#a59480">
                    Message Template
                  </Text>
                  <VStack spacing={4}>
                    <FormControl>
                      <FormLabel fontFamily="'Montserrat', sans-serif" color="#a59480">Message Content</FormLabel>
                      <Textarea
                        value={formData.content}
                        onChange={(e) => handleInputChange('content', e.target.value)}
                        rows={8}
                        minH="200px"
                        resize="vertical"
                        bg="#ecede8"
                        color="#353535"
                        borderColor="#a59480"
                        _focus={{ borderColor: '#a59480', boxShadow: '0 0 0 1px #a59480' }}
                        placeholder="Enter your message template here. Use {{first_name}}, {{last_name}}, {{member_name}}, {{phone}}, and {{email}} as placeholders."
                        fontFamily="'Montserrat', sans-serif"
                        fontSize="14px"
                        lineHeight="1.5"
                        w="90%"
                      />
                      <Text fontSize="xs" color="#a59480" mt={1}>
                        Available placeholders: {'{{first_name}}'}, {'{{last_name}}'}, {'{{member_name}}'}, {'{{phone}}'}, {'{{email}}'}
                      </Text>
                    </FormControl>

                    {/* Preview Toggle */}
                    <FormControl display="flex" alignItems="center">
                      <FormLabel htmlFor="show-preview" mb="0" fontFamily="'Montserrat', sans-serif" color="#a59480">
                        Show Preview
                      </FormLabel>
                      <Switch
                        id="show-preview"
                        isChecked={showPreview}
                        onChange={(e) => setShowPreview(e.target.checked)}
                        colorScheme="green"
                      />
                    </FormControl>

                    {/* Preview Section */}
                    {showPreview && formData.content && (
                      <Box>
                        <Text fontSize="sm" fontWeight="bold" mb={2} fontFamily="'Montserrat', sans-serif" color="#a59480">
                          Preview:
                        </Text>
                        <Box 
                          p={4} 
                          bg="#ecede8" 
                          borderRadius="md" 
                          border="1px solid #a59480"
                          minH="120px"
                          maxH="200px"
                          overflowY="auto"
                          w="90%"
                        >
                          <Text 
                            fontFamily="'Montserrat', sans-serif" 
                            color="#353535" 
                            whiteSpace="pre-wrap"
                            fontSize="14px"
                            lineHeight="1.5"
                          >
                            {getPreviewMessage()}
                          </Text>
                        </Box>
                      </Box>
                    )}
                  </VStack>
                </Box>

                <Divider borderColor="#a59480" />

                {/* Status */}
                <Box>
                  <Text fontSize="lg" fontWeight="bold" mb={4} fontFamily="'Montserrat', sans-serif" color="#a59480">
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

                {/* Delete Section */}
                {!isCreateMode && templateId && (
                  <>
                    <Divider borderColor="#a59480" />
                    <Box>
                      <Text fontSize="lg" fontWeight="bold" mb={4} fontFamily="'Montserrat', sans-serif" color="#ef4444">
                        Danger Zone
                      </Text>
                      <Button
                        colorScheme="red"
                        variant="outline"
                        onClick={() => setIsConfirmingDelete(true)}
                        fontFamily="'Montserrat', sans-serif"
                      >
                        Delete Template
                      </Button>
                    </Box>
                  </>
                )}
              </VStack>
            )}
          </DrawerBody>

          <DrawerFooter className="drawer-footer-content">
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
                {isCreateMode ? 'Create Template' : 'Update Template'}
              </Button>
            </HStack>
          </DrawerFooter>
        </DrawerContent>
      </Box>
    </Drawer>
  );
};

export default CampaignTemplateDrawer; 