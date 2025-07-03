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
} from '@chakra-ui/react';
import { CloseIcon, DeleteIcon } from '@chakra-ui/icons';

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
    send_time: '10:00:00',
    is_active: true,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (isOpen) {
      if (isCreateMode) {
        // Reset form for create mode
        setFormData({
          name: '',
          description: '',
          message_template: '',
          reminder_type: 'day_of',
          send_time: '10:00:00',
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
        setFormData({
          name: foundTemplate.name || '',
          description: foundTemplate.description || '',
          message_template: foundTemplate.message_template || '',
          reminder_type: foundTemplate.reminder_type || 'day_of',
          send_time: foundTemplate.send_time || '10:00:00',
          is_active: foundTemplate.is_active ?? true,
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
    setIsSaving(true);
    try {
      const url = '/api/reservation-reminder-templates';
      const method = isCreateMode ? 'POST' : 'PUT';
      const body = isCreateMode ? formData : { ...formData, id: templateId };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save template');
      }

      toast({
        title: 'Success',
        description: isCreateMode 
          ? 'Reminder template created successfully' 
          : 'Reminder template updated successfully',
        status: 'success',
        duration: 3000,
      });
      
      onTemplateUpdated();
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

  const title = isCreateMode ? 'Create Reminder Template' : 'Edit Reminder Template';

  return (
    <Box>
      <Drawer isOpen={isOpen} placement="right" onClose={onClose} size="md">
        <DrawerOverlay bg="rgba(0, 0, 0, 0.4)" backdropFilter="blur(10px)" />
        <DrawerContent 
          bg="#353535" 
          color="#ECEDE8" 
          fontFamily="Montserrat, sans-serif"
          maxW="400px"
          w="25vw"
          minW="350px"
        >
          <DrawerHeader 
            borderBottomWidth="1px" 
            borderBottomColor="#a59480"
            fontSize="xl"
            fontWeight="bold"
            fontFamily="IvyJournal, sans-serif"
          >
            <HStack justify="space-between" align="center">
              <Text>{title}</Text>
              <IconButton
                aria-label="Close"
                icon={<CloseIcon />}
                variant="ghost"
                size="sm"
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
                    bg="#2a2a2a"
                    borderColor="#a59480"
                    _focus={{ borderColor: "#ecede8" }}
                  />
                </FormControl>

                <FormControl>
                  <FormLabel fontSize="sm" mb={1}>Description</FormLabel>
                  <Input
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    placeholder="Enter description (optional)"
                    size="sm"
                    bg="#2a2a2a"
                    borderColor="#a59480"
                    _focus={{ borderColor: "#ecede8" }}
                  />
                </FormControl>

                <FormControl>
                  <FormLabel fontSize="sm" mb={1}>Reminder Type</FormLabel>
                  <Select
                    value={formData.reminder_type}
                    onChange={(e) => handleInputChange('reminder_type', e.target.value)}
                    size="sm"
                    bg="#2a2a2a"
                    borderColor="#a59480"
                    _focus={{ borderColor: "#ecede8" }}
                  >
                    <option value="day_of">Day Of Reservation</option>
                    <option value="hour_before">Hours Before Reservation</option>
                  </Select>
                </FormControl>

                <FormControl>
                  <FormLabel fontSize="sm" mb={1}>
                    {formData.reminder_type === 'day_of' ? 'Send Time' : 'Hours Before'}
                  </FormLabel>
                  {formData.reminder_type === 'day_of' ? (
                    <Input
                      type="time"
                      value={formData.send_time}
                      onChange={(e) => handleInputChange('send_time', e.target.value)}
                      size="sm"
                      bg="#2a2a2a"
                      borderColor="#a59480"
                      _focus={{ borderColor: "#ecede8" }}
                    />
                  ) : (
                    <Select
                      value={formData.send_time}
                      onChange={(e) => handleInputChange('send_time', e.target.value)}
                      size="sm"
                      bg="#2a2a2a"
                      borderColor="#a59480"
                      _focus={{ borderColor: "#ecede8" }}
                    >
                      <option value="1">1 Hour Before</option>
                      <option value="2">2 Hours Before</option>
                      <option value="3">3 Hours Before</option>
                      <option value="4">4 Hours Before</option>
                      <option value="6">6 Hours Before</option>
                      <option value="12">12 Hours Before</option>
                      <option value="24">24 Hours Before</option>
                    </Select>
                  )}
                </FormControl>

                <FormControl>
                  <FormLabel fontSize="sm" mb={1}>Message Template</FormLabel>
                  <Textarea
                    value={formData.message_template}
                    onChange={(e) => handleInputChange('message_template', e.target.value)}
                    placeholder="Enter message template. Use {{first_name}}, {{reservation_time}}, and {{party_size}} as placeholders."
                    size="sm"
                    rows={4}
                    bg="#2a2a2a"
                    borderColor="#a59480"
                    _focus={{ borderColor: "#ecede8" }}
                  />
                  <Text fontSize="xs" color="gray.400" mt={1}>
                    Available placeholders: {'{'}{'{'} first_name {'}'}{'}'},  {'{'}{'{'} reservation_time {'}'}{'}'},  {'{'}{'{'} party_size {'}'}{'}'} 
                  </Text>
                </FormControl>

                {formData.message_template && (
                  <Box bg="#2a2a2a" p={3} borderRadius="md" borderWidth="1px" borderColor="#a59480">
                    <Text fontSize="sm" fontWeight="bold" mb={2}>Preview:</Text>
                    <Text fontSize="sm" fontStyle="italic">
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

                {!isCreateMode && template && (
                  <Box bg="#2a2a2a" p={3} borderRadius="md" borderWidth="1px" borderColor="#a59480">
                    <VStack spacing={1} fontSize="xs">
                      <HStack justify="space-between" w="100%">
                        <Text fontSize="12px" color="gray.400" fontWeight="medium">Created:</Text>
                        <Text fontSize="12px">
                          {template.created_at ? new Date(template.created_at).toLocaleDateString() : 'N/A'}
                        </Text>
                      </HStack>
                      <HStack justify="space-between" w="100%">
                        <Text fontSize="12px" color="gray.400" fontWeight="medium">Last Updated:</Text>
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
          
          <DrawerFooter borderTopWidth="1px" borderTopColor="#a59480" justifyContent="space-between">
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
      </Drawer>
    </Box>
  );
};

export default ReminderTemplateEditDrawer;