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
} from '@chakra-ui/react';
import { CloseIcon, DeleteIcon } from '@chakra-ui/icons';
import { useSettings } from '../context/SettingsContext';
import { DateTime } from 'luxon';

interface ReservationReminderTemplate {
  id: string;
  name: string;
  description: string;
  message_template: string;
  reminder_type: 'day_of' | 'hour_before';
  send_time: string | number;
  send_time_minutes?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface ReminderTemplateEditDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  templateId: string | null;
  isCreateMode?: boolean;
  onTemplateUpdated: () => void;
}

const ReminderTemplateEditDrawer: React.FC<ReminderTemplateEditDrawerProps> = ({
  isOpen,
  onClose,
  templateId,
  isCreateMode = false,
  onTemplateUpdated,
}) => {
  const [template, setTemplate] = useState<ReservationReminderTemplate | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    message_template: '',
    reminder_type: 'day_of' as 'day_of' | 'hour_before',
    send_time_hours: 10,
    send_time_minutes: 0,
    is_active: true,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const toast = useToast();
  const { settings } = useSettings();

  useEffect(() => {
    if (isOpen) {
      if (isCreateMode) {
        // Reset form for create mode
        setFormData({
          name: '',
          description: '',
          message_template: '',
          reminder_type: 'day_of',
          send_time_hours: 10,
          send_time_minutes: 0,
          is_active: true,
        });
        setTemplate(null);
      } else if (templateId) {
        fetchTemplate();
      }
    }
  }, [isOpen, templateId, isCreateMode]);

  const fetchTemplate = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/reservation-reminder-templates');
      if (!response.ok) {
        throw new Error('Failed to fetch templates');
      }
      
      const data = await response.json();
      const foundTemplate = data.templates?.find((t: ReservationReminderTemplate) => t.id === templateId);
      
      if (foundTemplate) {
        setTemplate(foundTemplate);
        
        // Parse send_time to extract hours and minutes
        let hours = 10;
        let minutes = 0;
        
        if (foundTemplate.reminder_type === 'day_of') {
          // Handle both old integer format and new minute-level precision
          if (typeof foundTemplate.send_time === 'number') {
            // Old format: integer hours
            hours = foundTemplate.send_time;
            minutes = 0;
          } else if (typeof foundTemplate.send_time === 'string') {
            // New format: "HH:MM" or "HH:MMZZ" (with timezone offset)
            const timeParts = foundTemplate.send_time.split(':');
            hours = parseInt(timeParts[0]);
            // Handle timezone offset in minutes part (e.g., "05-05:00" -> "05")
            const minutesPart = timeParts[1];
            if (minutesPart && minutesPart.includes('-')) {
              minutes = parseInt(minutesPart.split('-')[0]);
            } else {
              minutes = timeParts.length > 1 ? parseInt(timeParts[1]) : 0;
            }
          }
          
          // Add minutes from send_time_minutes if available
          if (foundTemplate.send_time_minutes !== undefined) {
            minutes = foundTemplate.send_time_minutes;
          }
        } else {
          // Handle both old integer format and new minute-level precision
          if (typeof foundTemplate.send_time === 'number') {
            // Old format: integer hours
            hours = foundTemplate.send_time;
            minutes = 0;
          } else if (typeof foundTemplate.send_time === 'string') {
            // New format: "H:M" or "H"
            const timeParts = foundTemplate.send_time.split(':');
            hours = parseInt(timeParts[0]);
            minutes = timeParts.length > 1 ? parseInt(timeParts[1]) : 0;
          }
          
          // Add minutes from send_time_minutes if available
          if (foundTemplate.send_time_minutes !== undefined) {
            minutes = foundTemplate.send_time_minutes;
          }
        }
        
        setFormData({
          name: foundTemplate.name,
          description: foundTemplate.description || '',
          message_template: foundTemplate.message_template,
          reminder_type: foundTemplate.reminder_type,
          send_time_hours: hours,
          send_time_minutes: minutes,
          is_active: foundTemplate.is_active,
        });
      } else {
        throw new Error('Template not found');
      }
    } catch (error) {
      console.error('Error fetching template:', error);
      toast({ 
        title: 'Error', 
        description: 'Failed to load template details', 
        status: 'error', 
        duration: 5000 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.message_template.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Name and message template are required',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    setIsSaving(true);
    try {
      // Format send_time based on reminder type
      let sendTime: string;
      if (formData.reminder_type === 'day_of') {
        // For day_of reminders, store as simple HH:MM format
        // The scheduling system will handle timezone conversion when actually scheduling
        sendTime = `${formData.send_time_hours.toString().padStart(2, '0')}:${formData.send_time_minutes.toString().padStart(2, '0')}`;
      } else {
        // For hour_before reminders, keep the simple format
        if (formData.send_time_minutes > 0) {
          sendTime = `${formData.send_time_hours}:${formData.send_time_minutes.toString().padStart(2, '0')}`;
        } else {
          sendTime = formData.send_time_hours.toString();
        }
      }

      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        message_template: formData.message_template.trim(),
        reminder_type: formData.reminder_type,
        send_time: sendTime,
        send_time_minutes: formData.send_time_minutes,
        is_active: formData.is_active,
      };

      const url = isCreateMode ? '/api/reservation-reminder-templates' : `/api/reservation-reminder-templates?id=${templateId}`;
      const method = isCreateMode ? 'POST' : 'PUT';

      console.log('Saving template with payload:', payload);
      console.log('URL:', url);
      console.log('Method:', method);

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error response:', errorData);
        throw new Error(errorData.error || 'Failed to save template');
      }

      console.log('✅ Template saved successfully!');
      
      toast({
        title: 'Success',
        description: isCreateMode ? 'Reminder template created successfully' : 'Reminder template updated successfully',
        status: 'success',
        duration: 3000,
      });
      
      console.log('Calling onTemplateUpdated...');
      onTemplateUpdated();
      console.log('Calling onClose...');
      onClose();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save template',
        status: 'error',
        duration: 5000,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!templateId) return;
    
    setIsSaving(true);
    try {
      const response = await fetch(`/api/reservation-reminder-templates?id=${templateId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete template');
      }

      toast({
        title: 'Success',
        description: 'Reminder template deleted successfully',
        status: 'success',
        duration: 3000,
      });
      
      onTemplateUpdated();
      onClose();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete template',
        status: 'error',
        duration: 5000,
      });
    } finally {
      setIsSaving(false);
      setIsConfirmingDelete(false);
    }
  };

  const getPreviewMessage = () => {
    return formData.message_template
      .replace(/\{\{first_name\}\}/g, 'John')
      .replace(/\{\{reservation_time\}\}/g, '7:00 PM')
      .replace(/\{\{party_size\}\}/g, '2');
  };

  const formatSendTimeDisplay = () => {
    if (formData.reminder_type === 'hour_before') {
      const h = formData.send_time_hours;
      const m = formData.send_time_minutes;
      let str = '';
      if (h > 0) str += `${h} Hour${h === 1 ? '' : 's'}`;
      if (h > 0 && m > 0) str += ' ';
      if (m > 0) str += `${m} Minute${m === 1 ? '' : 's'}`;
      if (!str) str = '0 Minutes';
      return str + ' Before';
    } else {
      const hour12 = formData.send_time_hours === 0 ? 12 : 
                    formData.send_time_hours > 12 ? formData.send_time_hours - 12 : 
                    formData.send_time_hours;
      const ampm = formData.send_time_hours < 12 ? 'AM' : 'PM';
      return `${hour12.toString().padStart(2, '0')}:${formData.send_time_minutes.toString().padStart(2, '0')} ${ampm}`;
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
          maxW="400px" 
          maxH="flex" 
          w="40vw" 
          boxShadow="xl" 
          mt="80px" 
          mb="25px" 
          paddingRight="40px" 
          paddingLeft="40px" 
          backgroundColor="#ecede8"
          position="fixed"
          top="0"
          right="0"
          height="100vh"
          style={{
            transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
            transition: 'transform 0.3s ease-in-out'
          }}
        >
          <DrawerHeader borderBottomWidth="1px" margin="0" fontWeight="bold" paddingTop="0px" fontSize="24px" fontFamily="IvyJournal, sans-serif" color="#353535">
            <HStack justify="space-between" align="center">
              <Text>
                {isCreateMode ? 'Create Reminder Template' : 'Edit Reminder Template'}
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
          
          <DrawerBody p={4} overflowY="auto">
            {isLoading ? (
              <VStack justify="center" align="center" h="100%">
                <Spinner size="xl" />
              </VStack>
            ) : (
              <VStack spacing={4} align="stretch">
                <FormControl>
                  <FormLabel fontSize="sm" mb={1}>Template Name</FormLabel>
                  <Input
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder="Enter template name"
                    size="sm"
                    bg="#ecede8"
                    borderColor="#23201C"
                    _focus={{ borderColor: '#a59480', boxShadow: '0 0 0 1px #a59480' }}
                  />
                </FormControl>

                <FormControl>
                  <FormLabel fontSize="sm" mb={1}>Description</FormLabel>
                  <Input
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    placeholder="Enter description (optional)"
                    size="sm"
                    bg="#ecede8"
                    borderColor="#23201C"
                    _focus={{ borderColor: '#a59480', boxShadow: '0 0 0 1px #a59480' }}
                  />
                </FormControl>

                <FormControl>
                  <FormLabel fontSize="sm" mb={1}>Reminder Type</FormLabel>
                  <Select
                    value={formData.reminder_type}
                    onChange={(e) => handleInputChange('reminder_type', e.target.value)}
                    size="sm"
                    bg="#ecede8"
                    borderColor="#23201C"
                    _focus={{ borderColor: '#a59480', boxShadow: '0 0 0 1px #a59480' }}
                  >
                    <option value="day_of">Day Of Reservation</option>
                    <option value="hour_before">Hours Before Reservation</option>
                  </Select>
                </FormControl>

                <FormControl isRequired>
                  <FormLabel fontSize="sm" mb={1}>
                    {formData.reminder_type === 'day_of' ? 'Send Time' : 'Hours/Minutes Before'}
                  </FormLabel>
                  <HStack spacing={2}>
                    {formData.reminder_type === 'day_of' ? (
                      <>
                        <NumberInput
                          value={formData.send_time_hours}
                          onChange={(_, value) => handleInputChange('send_time_hours', value)}
                          min={0}
                          max={23}
                          size="sm"
                          bg="#ecede8"
                          borderColor="#23201C"
                          _focus={{ borderColor: '#a59480', boxShadow: '0 0 0 1px #a59480' }}
                        >
                          <NumberInputField />
                          <NumberInputStepper>
                            <NumberIncrementStepper />
                            <NumberDecrementStepper />
                          </NumberInputStepper>
                        </NumberInput>
                        <Text color="#353535">:</Text>
                        <NumberInput
                          value={formData.send_time_minutes}
                          onChange={(_, value) => handleInputChange('send_time_minutes', value)}
                          min={0}
                          max={59}
                          size="sm"
                          bg="#ecede8"
                          borderColor="#23201C"
                          _focus={{ borderColor: '#a59480', boxShadow: '0 0 0 1px #a59480' }}
                        >
                          <NumberInputField />
                          <NumberInputStepper>
                            <NumberIncrementStepper />
                            <NumberDecrementStepper />
                          </NumberInputStepper>
                        </NumberInput>
                        <Text color="#353535" fontSize="sm">
                          {formatSendTimeDisplay()}
                        </Text>
                      </>
                    ) : (
                      <>
                        <NumberInput
                          value={formData.send_time_hours}
                          onChange={(_, value) => handleInputChange('send_time_hours', value)}
                          min={0}
                          max={24}
                          size="sm"
                          bg="#ecede8"
                          borderColor="#23201C"
                          _focus={{ borderColor: '#a59480', boxShadow: '0 0 0 1px #a59480' }}
                        >
                          <NumberInputField />
                          <NumberInputStepper>
                            <NumberIncrementStepper />
                            <NumberDecrementStepper />
                          </NumberInputStepper>
                        </NumberInput>
                        <Text color="#353535">Hour(s)</Text>
                        <NumberInput
                          value={formData.send_time_minutes}
                          onChange={(_, value) => handleInputChange('send_time_minutes', value)}
                          min={0}
                          max={59}
                          size="sm"
                          bg="#ecede8"
                          borderColor="#23201C"
                          _focus={{ borderColor: '#a59480', boxShadow: '0 0 0 1px #a59480' }}
                        >
                          <NumberInputField />
                          <NumberInputStepper>
                            <NumberIncrementStepper />
                            <NumberDecrementStepper />
                          </NumberInputStepper>
                        </NumberInput>
                        <Text color="#353535">Minute(s) Before</Text>
                        <Text color="#353535" fontSize="sm">
                          {formatSendTimeDisplay()}
                        </Text>
                      </>
                    )}
                  </HStack>
                </FormControl>

                <FormControl>
                  <FormLabel fontSize="sm" mb={1}>Message Template</FormLabel>
                  <Textarea
                    value={formData.message_template}
                    onChange={(e) => handleInputChange('message_template', e.target.value)}
                    placeholder="Enter message template. Use {{first_name}}, {{reservation_time}}, and {{party_size}} as placeholders. You can add line breaks for better formatting."
                    size="sm"
                    rows={4}
                    bg="#ecede8"
                    borderColor="#23201C"
                    _focus={{ borderColor: '#a59480', boxShadow: '0 0 0 1px #a59480' }}
                  />
                  <Text fontSize="xs" color="gray.600" mt={1}>
                    Available placeholders: {'{'}{'{'}first_name{'}'}{'}'}, {'{'}{'{'}reservation_time{'}'}{'}'}, {'{'}{'{'}party_size{'}'}{'}'}
                  </Text>
                  <Text fontSize="xs" color="gray.600" mt={1}>
                    💡 Tip: You can press Enter to add line breaks for better message formatting
                  </Text>
                </FormControl>

                {formData.message_template && (
                  <Box bg="gray.50" p={3} borderRadius="md" borderWidth="1px" borderColor="gray.200">
                    <Text fontSize="sm" fontWeight="bold" mb={2}>Preview:</Text>
                    <Text 
                      fontSize="sm" 
                      fontStyle="italic"
                      whiteSpace="pre-wrap"
                      fontFamily="monospace"
                    >
                      {getPreviewMessage()}
                    </Text>
                  </Box>
                )}

                <FormControl>
                  <HStack justify="space-between">
                    <FormLabel fontSize="sm" mb={0}>Active</FormLabel>
                    <Switch
                      isChecked={formData.is_active}
                      onChange={(e) => handleInputChange('is_active', e.target.checked)}
                      colorScheme="green"
                    />
                  </HStack>
                </FormControl>

                {settings?.timezone && (
                  <Text fontSize="xs" color="#666" textAlign="center">
                    Times will be sent in {settings.timezone} timezone
                  </Text>
                )}

                {!isCreateMode && template && (
                  <Box bg="gray.50" p={3} borderRadius="md" borderWidth="1px" borderColor="gray.200">
                    <VStack spacing={1} fontSize="xs">
                      <HStack justify="space-between" w="100%">
                        <Text fontSize="12px" color="gray.600" fontWeight="medium">Created:</Text>
                        <Text fontSize="12px">
                          {template.created_at ? new Date(template.created_at).toLocaleDateString() : 'N/A'}
                        </Text>
                      </HStack>
                      <HStack justify="space-between" w="100%">
                        <Text fontSize="12px" color="gray.600" fontWeight="medium">Last Updated:</Text>
                        <Text fontSize="12px">
                          {template.updated_at ? new Date(template.updated_at).toLocaleDateString() : 'N/A'}
                        </Text>
                      </HStack>
                    </VStack>
                  </Box>
                )}
              </VStack>
            )}
          </DrawerBody>
          
          <DrawerFooter borderTopWidth="1px" justifyContent="space-between">
            {isConfirmingDelete ? (
              <HStack w="100%" justifyContent="space-between">
                <Text fontWeight="bold">Are you sure?</Text>
                <HStack>
                  <Button variant="outline" size="sm" onClick={() => setIsConfirmingDelete(false)}>
                    Cancel
                  </Button>
                  <Button
                    colorScheme="red"
                    size="sm"
                    onClick={handleDelete}
                    isLoading={isSaving}
                  >
                    Delete
                  </Button>
                </HStack>
              </HStack>
            ) : (
              <>
                {!isCreateMode && (
                  <IconButton
                    aria-label="Delete template"
                    icon={<DeleteIcon />}
                    variant="ghost"
                    color="#ff0000"
                    fontSize="18px"
                    onClick={() => setIsConfirmingDelete(true)}
                  />
                )}
                <HStack spacing={3}>
                  <Button variant="outline" onClick={onClose}>Cancel</Button>
                  <Button 
                    colorScheme="blue" 
                    onClick={handleSave} 
                    isLoading={isSaving}
                    loadingText="Saving..."
                    isDisabled={!formData.name || !formData.message_template}
                  >
                    {isCreateMode ? 'Create' : 'Save'}
                  </Button>
                </HStack>
              </>
            )}
          </DrawerFooter>
        </DrawerContent>
      </Box>
    </Drawer>
  );
};

export default ReminderTemplateEditDrawer;