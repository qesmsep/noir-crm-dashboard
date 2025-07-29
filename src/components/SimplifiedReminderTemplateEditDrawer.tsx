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

interface ReminderTemplateEditDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  templateId: string | null;
  isCreateMode?: boolean;
  onTemplateUpdated: () => void;
}

const SimplifiedReminderTemplateEditDrawer: React.FC<ReminderTemplateEditDrawerProps> = ({
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
    quantity: 1,
    time_unit: 'hr' as 'hr' | 'min' | 'day',
    proximity: 'before' as 'before' | 'after',
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
        // Reset form for create mode
        setFormData({
          name: '',
          description: '',
          message_template: '',
          quantity: 1,
          time_unit: 'hr',
          proximity: 'before',
          is_active: true,
        });
        setTemplate(null);
        setShowPreview(false);
      } else if (templateId) {
        fetchTemplate();
        setShowPreview(false);
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
      const foundTemplate = data.find((t: ReservationReminderTemplate) => t.id === templateId);
      
      if (foundTemplate) {
        setTemplate(foundTemplate);
        setFormData({
          name: foundTemplate.name,
          description: foundTemplate.description || '',
          message_template: foundTemplate.message_template,
          quantity: foundTemplate.quantity,
          time_unit: foundTemplate.time_unit,
          proximity: foundTemplate.proximity,
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
      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        message_template: formData.message_template.trim(),
        quantity: formData.quantity,
        time_unit: formData.time_unit,
        proximity: formData.proximity,
        is_active: formData.is_active,
      };

      const url = isCreateMode ? '/api/reservation-reminder-templates' : `/api/reservation-reminder-templates?id=${templateId}`;
      const method = isCreateMode ? 'POST' : 'PUT';

      console.log('Saving template with payload:', payload);

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error response:', errorData);
        throw new Error(errorData.error || 'Failed to save template');
      }

      toast({
        title: 'Success',
        description: isCreateMode ? 'Reminder template created successfully' : 'Reminder template updated successfully',
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
        throw new Error('Failed to delete template');
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
    if (!formData.message_template) return '';
    
    return formData.message_template
      .replace(/\{\{first_name\}\}/g, 'John')
      .replace(/\{\{reservation_time\}\}/g, '7:30 PM')
      .replace(/\{\{party_size\}\}/g, '4');
  };

  const formatTimingDisplay = () => {
    if (formData.quantity === 0) {
      return 'Day of reservation';
    } else {
      const unit = formData.quantity === 1 ? formData.time_unit : formData.time_unit + 's';
      return `${formData.quantity} ${unit} ${formData.proximity}`;
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

          <DrawerBody className="drawer-body-content">
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
                  <HStack spacing={4} width="100%">
                    <FormControl flex="1">
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

                    <FormControl flex="2">
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
                  </HStack>
                </VStack>
                </Box>

                <Divider borderColor="#a59480" />

                {/* Timing Configuration */}
                <Box>
                  <Text fontSize="lg" fontWeight="bold" mb={4} fontFamily="'Montserrat', sans-serif" color="#a59480">
                    When to Send
                  </Text>
                  <VStack spacing={4}>
                    <HStack spacing={4} width="100%">
                      <FormControl>
                        <FormLabel fontFamily="'Montserrat', sans-serif" color="#a59480">Quantity</FormLabel>
                        <NumberInput
                          value={formData.quantity}
                          onChange={(value) => handleInputChange('quantity', parseInt(value))}
                          min={0}
                          max={99}
                          bg="#ecede8"
                          color="#353535"
                          borderColor="#a59480"
                          _focus={{ borderColor: '#a59480', boxShadow: '0 0 0 1px #a59480' }}
                        >
                          <NumberInputField 
                            placeholder="0-99"
                            _focus={{ borderColor: '#a59480', boxShadow: '0 0 0 1px #a59480' }}
                          />
                          <NumberInputStepper>
                            <NumberIncrementStepper />
                            <NumberDecrementStepper />
                          </NumberInputStepper>
                        </NumberInput>
                        <Text fontSize="xs" color="#a59480" mt={1}>
                          Number of time units (0 = day of reservation)
                        </Text>
                      </FormControl>

                      <FormControl>
                        <FormLabel fontFamily="'Montserrat', sans-serif" color="#a59480">Time Unit</FormLabel>
                        <Select
                          value={formData.time_unit}
                          onChange={(e) => handleInputChange('time_unit', e.target.value)}
                          bg="#ecede8"
                          color="#353535"
                          borderColor="#a59480"
                          _focus={{ borderColor: '#a59480', boxShadow: '0 0 0 1px #a59480' }}
                        >
                          <option value="hr">Hours</option>
                          <option value="min">Minutes</option>
                          <option value="day">Days</option>
                        </Select>
                        <Text fontSize="xs" color="#a59480" mt={1}>
                          Unit of time measurement
                        </Text>
                      </FormControl>

                      <FormControl>
                        <FormLabel fontFamily="'Montserrat', sans-serif" color="#a59480">Proximity</FormLabel>
                        <Select
                          value={formData.proximity}
                          onChange={(e) => handleInputChange('proximity', e.target.value)}
                          bg="#ecede8"
                          color="#353535"
                          borderColor="#a59480"
                          _focus={{ borderColor: '#a59480', boxShadow: '0 0 0 1px #a59480' }}
                        >
                          <option value="before">Before</option>
                          <option value="after">After</option>
                        </Select>
                        <Text fontSize="xs" color="#a59480" mt={1}>
                          Relative to reservation time
                        </Text>
                      </FormControl>
                    </HStack>

                                      <Box p={4} bg="#ecede8" borderRadius="md" border="1px solid #a59480">
                    <Text fontFamily="'Montserrat', sans-serif" color="#353535" fontWeight="bold">
                      Message will be sent {formatTimingDisplay()} the reservation
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
                      value={formData.message_template}
                      width="90%"
                      onChange={(e) => handleInputChange('message_template', e.target.value)}
                      rows={8}
                      minH="200px"
                      resize="vertical"
                      bg="#ecede8"
                      color="#353535"
                      borderColor="#a59480"
                      _focus={{ borderColor: '#a59480', boxShadow: '0 0 0 1px #a59480' }}
                      placeholder="Enter your message template here. Use {{first_name}}, {{reservation_time}}, and {{party_size}} as placeholders."
                      fontFamily="'Montserrat', sans-serif"
                      fontSize="14px"
                      lineHeight="1.5"
                    />
                                        <Text fontSize="xs" color="#a59480" mt={1}>
                      Available placeholders: {'{first_name}'}, {'{reservation_time}'}, {'{party_size}'}
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
                  {showPreview && formData.message_template && (
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
                    <Switch
                      isChecked={formData.is_active}
                      onChange={(e) => handleInputChange('is_active', e.target.checked)}
                      colorScheme="green"
                    />
                    <Text fontFamily="'Montserrat', sans-serif" color="#a59480">
                      {formData.is_active ? 'Active' : 'Inactive'}
                    </Text>
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

          <DrawerFooter className="drawer-footer-content" borderTopWidth="1px" borderColor="#a59480">
            <HStack spacing={4}>
              <Button variant="outline" onClick={onClose} fontFamily="'Montserrat', sans-serif" color="#a59480">
                Cancel
              </Button>
              <Button
                colorScheme="blue"
                onClick={handleSave}
                isLoading={isSaving}
                fontFamily="'Montserrat', sans-serif"
              >
                {isCreateMode ? 'Create Template' : 'Save Changes'}
              </Button>
            </HStack>
          </DrawerFooter>
        </DrawerContent>
      </Box>

      {/* Delete Confirmation Modal */}
      {isConfirmingDelete && (
        <Box
          position="fixed"
          top="0"
          left="0"
          right="0"
          bottom="0"
          bg="rgba(0,0,0,0.5)"
          zIndex={9999}
          display="flex"
          alignItems="center"
          justifyContent="center"
        >
          <Box bg="#353535" p={6} borderRadius="lg" border="1px solid #a59480" maxW="400px">
            <Text fontSize="lg" fontWeight="bold" mb={4} fontFamily="'Montserrat', sans-serif" color="#ef4444">
              Confirm Delete
            </Text>
            <Text mb={6} fontFamily="'Montserrat', sans-serif" color="#ECEDE8">
              Are you sure you want to delete this template? This action cannot be undone.
            </Text>
            <HStack spacing={4}>
              <Button
                variant="outline"
                onClick={() => setIsConfirmingDelete(false)}
                fontFamily="'Montserrat', sans-serif"
                color="#a59480"
              >
                Cancel
              </Button>
              <Button
                colorScheme="red"
                onClick={handleDelete}
                isLoading={isSaving}
                fontFamily="'Montserrat', sans-serif"
              >
                Delete
              </Button>
            </HStack>
          </Box>
        </Box>
      )}
    </Drawer>
  );
};

export default SimplifiedReminderTemplateEditDrawer; 