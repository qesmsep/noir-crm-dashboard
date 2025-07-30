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
  FormControl,
  FormLabel,
  Input,
  Textarea,
  Select,
  Switch,
  VStack,
  HStack,
  Text,
  Box,
  IconButton,
  useToast,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
  Tooltip,
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverHeader,
  PopoverBody,
  PopoverArrow,
  PopoverCloseButton,
  List,
  ListItem,
  ListIcon,
} from '@chakra-ui/react';
import { CloseIcon, InfoIcon } from '@chakra-ui/icons';
import { supabase } from '../lib/supabase';

interface OnboardingTemplate {
  id?: string;
  name: string;
  content: string;
  recipient_type: 'member' | 'all_members' | 'specific_phone';
  specific_phone?: string;
  timing_days: number;
  timing_hours: number;
  timing_minutes: number;
  send_time: string;
  is_active: boolean;
}

interface OnboardingTemplateDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  templateId?: string | null;
  isCreateMode?: boolean;
  onTemplateUpdated: () => void;
}

const OnboardingTemplateDrawer: React.FC<OnboardingTemplateDrawerProps> = ({
  isOpen,
  onClose,
  templateId,
  isCreateMode = false,
  onTemplateUpdated
}) => {
  const [formData, setFormData] = useState<OnboardingTemplate>({
    name: '',
    content: '',
    recipient_type: 'member',
    specific_phone: '',
    timing_days: 0,
    timing_hours: 0,
    timing_minutes: 0,
    send_time: '10:00',
    is_active: true
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  // Placeholder information
  const placeholders = [
    { placeholder: '{{first_name}}', description: 'Member\'s first name' },
    { placeholder: '{{last_name}}', description: 'Member\'s last name' },
    { placeholder: '{{member_name}}', description: 'Full member name (first + last)' },
    { placeholder: '{{phone}}', description: 'Member\'s phone number' },
    { placeholder: '{{email}}', description: 'Member\'s email address' },
  ];

  useEffect(() => {
    if (isOpen && templateId && !isCreateMode) {
      fetchTemplate();
    } else if (isOpen && isCreateMode) {
      // Reset form for create mode
      setFormData({
        name: '',
        content: '',
        recipient_type: 'member',
        specific_phone: '',
        timing_days: 0,
        timing_hours: 0,
        timing_minutes: 0,
        send_time: '10:00',
        is_active: true
      });
    }
  }, [isOpen, templateId, isCreateMode]);

  const fetchTemplate = async () => {
    if (!templateId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('onboarding_templates')
        .select('*')
        .eq('id', templateId)
        .single();

      if (error) throw error;

      if (data) {
        setFormData({
          id: data.id,
          name: data.name,
          content: data.content,
          recipient_type: data.recipient_type,
          specific_phone: data.specific_phone || '',
          timing_days: data.timing_days,
          timing_hours: data.timing_hours,
          timing_minutes: data.timing_minutes,
          send_time: data.send_time ? data.send_time.substring(0, 5) : '10:00',
          is_active: data.is_active
        });
      }
    } catch (error) {
      console.error('Error fetching template:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch template',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.content.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Name and content are required',
        status: 'error',
        duration: 3000,
      });
      return;
    }

    if (formData.recipient_type === 'specific_phone' && !formData.specific_phone?.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Phone number is required when selecting specific phone',
        status: 'error',
        duration: 3000,
      });
      return;
    }

    setSaving(true);
    try {
      const templateData = {
        name: formData.name.trim(),
        content: formData.content.trim(),
        recipient_type: formData.recipient_type,
        specific_phone: formData.recipient_type === 'specific_phone' ? formData.specific_phone?.trim() : null,
        timing_days: formData.timing_days,
        timing_hours: formData.timing_hours,
        timing_minutes: formData.timing_minutes,
        send_time: formData.send_time + ':00',
        is_active: formData.is_active
      };

      let result;
      if (isCreateMode) {
        result = await supabase
          .from('onboarding_templates')
          .insert(templateData)
          .select()
          .single();
      } else {
        result = await supabase
          .from('onboarding_templates')
          .update(templateData)
          .eq('id', templateId)
          .select()
          .single();
      }

      if (result.error) throw result.error;

      toast({
        title: 'Success',
        description: isCreateMode ? 'Template created successfully' : 'Template updated successfully',
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
      setSaving(false);
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
                {isCreateMode ? 'Create Onboarding Template' : 'Edit Onboarding Template'}
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

          <DrawerBody className="drawer-body-content">
            {loading ? (
              <Text>Loading...</Text>
            ) : (
              <VStack spacing={6} align="stretch">
                <FormControl isRequired>
                  <FormLabel fontFamily="'Montserrat', sans-serif" fontWeight="bold">
                    Template Name
                  </FormLabel>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Welcome Message - Day 1"
                    bg="white"
                    border="1px solid #353535"
                    _focus={{ borderColor: '#a59480', boxShadow: '0 0 0 1px #a59480' }}
                  />
                </FormControl>

                <FormControl isRequired>
                  <FormLabel fontFamily="'Montserrat', sans-serif" fontWeight="bold">
                    Message Content
                  </FormLabel>
                  <HStack justify="space-between" align="center" mb={2}>
                    <Text fontSize="sm" color="#666">
                      Available placeholders:
                    </Text>
                    <Popover placement="top">
                      <PopoverTrigger>
                        <IconButton
                          aria-label="Show placeholders"
                          icon={<InfoIcon />}
                          size="sm"
                          variant="ghost"
                          color="#a59480"
                        />
                      </PopoverTrigger>
                      <PopoverContent>
                        <PopoverArrow />
                        <PopoverCloseButton />
                        <PopoverHeader fontFamily="'Montserrat', sans-serif" fontWeight="bold">
                          Available Placeholders
                        </PopoverHeader>
                        <PopoverBody>
                          <List spacing={2}>
                            {placeholders.map((item) => (
                              <ListItem key={item.placeholder}>
                                <ListIcon color="#a59480" />
                                <Text as="span" fontWeight="bold" fontFamily="monospace">
                                  {item.placeholder}
                                </Text>
                                <Text as="span" ml={2}>
                                  - {item.description}
                                </Text>
                              </ListItem>
                            ))}
                          </List>
                        </PopoverBody>
                      </PopoverContent>
                    </Popover>
                  </HStack>
                  <Textarea
                    value={formData.content}
                    onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                    placeholder="Enter your message content here..."
                    rows={6}
                    bg="white"
                    border="1px solid #353535"
                    _focus={{ borderColor: '#a59480', boxShadow: '0 0 0 1px #a59480' }}
                  />
                </FormControl>

                <FormControl isRequired>
                  <FormLabel fontFamily="'Montserrat', sans-serif" fontWeight="bold">
                    Recipient
                  </FormLabel>
                  <Select
                    value={formData.recipient_type}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      recipient_type: e.target.value as 'member' | 'all_members' | 'specific_phone',
                      specific_phone: e.target.value === 'specific_phone' ? prev.specific_phone : ''
                    }))}
                    bg="white"
                    border="1px solid #353535"
                    _focus={{ borderColor: '#a59480', boxShadow: '0 0 0 1px #a59480' }}
                  >
                    <option value="member">Primary member of the account</option>
                    <option value="all_members">All members in the account</option>
                    <option value="specific_phone">Specific phone number</option>
                  </Select>
                </FormControl>

                {formData.recipient_type === 'specific_phone' && (
                  <FormControl isRequired>
                    <FormLabel fontFamily="'Montserrat', sans-serif" fontWeight="bold">
                      Phone Number
                    </FormLabel>
                    <Input
                      value={formData.specific_phone ? formatPhoneNumber(formData.specific_phone) : ''}
                      onChange={(e) => handlePhoneChange(e.target.value)}
                      placeholder="(913) 777-4488"
                      bg="white"
                      border="1px solid #353535"
                      _focus={{ borderColor: '#a59480', boxShadow: '0 0 0 1px #a59480' }}
                    />
                  </FormControl>
                )}

                <FormControl isRequired>
                  <FormLabel fontFamily="'Montserrat', sans-serif" fontWeight="bold">
                    Timing (relative to signup date)
                  </FormLabel>
                  <HStack spacing={4}>
                    <Box flex={1}>
                      <Text fontSize="sm" mb={1}>Days</Text>
                      <NumberInput
                        value={formData.timing_days}
                        onChange={(_, value) => setFormData(prev => ({ ...prev, timing_days: value }))}
                        min={0}
                        max={365}
                        bg="white"
                        border="1px solid #353535"
                        _focus={{ borderColor: '#a59480', boxShadow: '0 0 0 1px #a59480' }}
                      >
                        <NumberInputField />
                        <NumberInputStepper>
                          <NumberIncrementStepper />
                          <NumberDecrementStepper />
                        </NumberInputStepper>
                      </NumberInput>
                    </Box>
                    <Box flex={1}>
                      <Text fontSize="sm" mb={1}>Hours</Text>
                      <NumberInput
                        value={formData.timing_hours}
                        onChange={(_, value) => setFormData(prev => ({ ...prev, timing_hours: value }))}
                        min={0}
                        max={23}
                        bg="white"
                        border="1px solid #353535"
                        _focus={{ borderColor: '#a59480', boxShadow: '0 0 0 1px #a59480' }}
                      >
                        <NumberInputField />
                        <NumberInputStepper>
                          <NumberIncrementStepper />
                          <NumberDecrementStepper />
                        </NumberInputStepper>
                      </NumberInput>
                    </Box>
                    <Box flex={1}>
                      <Text fontSize="sm" mb={1}>Minutes</Text>
                      <NumberInput
                        value={formData.timing_minutes}
                        onChange={(_, value) => setFormData(prev => ({ ...prev, timing_minutes: value }))}
                        min={0}
                        max={59}
                        bg="white"
                        border="1px solid #353535"
                        _focus={{ borderColor: '#a59480', boxShadow: '0 0 0 1px #a59480' }}
                      >
                        <NumberInputField />
                        <NumberInputStepper>
                          <NumberIncrementStepper />
                          <NumberDecrementStepper />
                        </NumberInputStepper>
                      </NumberInput>
                    </Box>
                  </HStack>
                </FormControl>

                <FormControl>
                  <FormLabel fontFamily="'Montserrat', sans-serif" fontWeight="bold">
                    Send Time
                  </FormLabel>
                  <Input
                    type="time"
                    value={formData.send_time}
                    onChange={(e) => setFormData(prev => ({ ...prev, send_time: e.target.value }))}
                    bg="white"
                    border="1px solid #353535"
                    _focus={{ borderColor: '#a59480', boxShadow: '0 0 0 1px #a59480' }}
                  />
                </FormControl>

                <FormControl display="flex" alignItems="center">
                  <FormLabel htmlFor="is-active" mb="0" fontFamily="'Montserrat', sans-serif" fontWeight="bold">
                    Active
                  </FormLabel>
                  <Switch
                    id="is-active"
                    isChecked={formData.is_active}
                    onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                    colorScheme="green"
                  />
                </FormControl>
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
                isLoading={saving}
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

export default OnboardingTemplateDrawer; 