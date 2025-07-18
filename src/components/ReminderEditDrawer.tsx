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
  FormControl,
  FormLabel,
  Input,
  Textarea,
  useToast,
  Spinner,
  HStack,
  Text,
  Box,
} from '@chakra-ui/react';
import { useSettings } from '../context/SettingsContext';
import { utcToLocalInput, localInputToUTC } from '../utils/dateUtils';

interface ReminderEditDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  reminderId: string | null;
  onReminderUpdated: () => void;
}

const ReminderEditDrawer: React.FC<ReminderEditDrawerProps> = ({
  isOpen,
  onClose,
  reminderId,
  onReminderUpdated,
}) => {
  const [reminder, setReminder] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [formData, setFormData] = useState({
    scheduled_for: '',
    message_content: '',
  });
  const toast = useToast();
  const { settings } = useSettings();
  const timezone = settings?.timezone || 'America/Chicago';

  useEffect(() => {
    if (isOpen && reminderId) {
      setFormData({ scheduled_for: '', message_content: '' });
      fetchReminder();
    }
  }, [isOpen, reminderId]);

  // Reset formData to blank as soon as reminderId changes
  useEffect(() => {
    setFormData({ scheduled_for: '', message_content: '' });
  }, [reminderId]);

  // Convert UTC to local time string for input using luxon
  function utcToLocalInputHelper(utcString: string) {
    if (!utcString) return '';
    return utcToLocalInput(utcString, timezone);
  }

  // Convert local input string to UTC ISO string using luxon
  function localInputToUTCHelper(localString: string) {
    if (!localString) return '';
    return localInputToUTC(localString, timezone);
  }

  const fetchReminder = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/pending-reservation-reminders?id=${reminderId}`);
      if (!response.ok) throw new Error('Failed to fetch reminder');
      const data = await response.json();
      setReminder(data);
      setFormData({
        scheduled_for: data.scheduled_for ? utcToLocalInputHelper(data.scheduled_for) : '',
        message_content: data.message_content || '',
      });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to load reminder details', status: 'error', duration: 5000 });
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
      const response = await fetch(`/api/pending-reservation-reminders`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: reminderId,
          scheduled_for: localInputToUTCHelper(formData.scheduled_for),
          message_content: formData.message_content,
        }),
      });
      if (!response.ok) throw new Error('Failed to update reminder');
      toast({ title: 'Success', description: 'Reminder updated successfully', status: 'success', duration: 3000 });
      onReminderUpdated();
      onClose();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to update reminder', status: 'error', duration: 5000 });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendNow = async () => {
    setIsSending(true);
    try {
      const response = await fetch('/api/pending-reservation-reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reminder_id: reminderId }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to send reminder');
      }
      toast({ title: 'Sent', description: 'Reminder sent successfully', status: 'success', duration: 3000 });
      onReminderUpdated();
      onClose();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to send reminder', status: 'error', duration: 5000 });
    } finally {
      setIsSending(false);
    }
  };

  if (!reminderId) return null;

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
          style={{
            transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
            transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
          }}
        >
          <DrawerHeader borderBottomWidth="1px" margin="0" fontWeight="bold" paddingTop="0px" fontSize="24px" fontFamily="IvyJournal, sans-serif" color="#353535">
            Edit Reservation Reminder
          </DrawerHeader>
          <DrawerBody p={4} overflowY="auto" className="drawer-body-content">
            {isLoading ? (
              <VStack justify="center" align="center" h="100%">
                <Spinner size="xl" />
              </VStack>
            ) : reminder ? (
              <VStack spacing={4} align="stretch">
                <FormControl isDisabled={isLoading}>
                  <FormLabel fontFamily="'Montserrat', sans-serif" color="#23201C">Scheduled Send Time</FormLabel>
                  <Input
                    type="datetime-local"
                    value={formData.scheduled_for}
                    onChange={(e) => handleInputChange('scheduled_for', e.target.value)}
                    bg="#ecede8"
                    border="1px solid #23201C"
                    _focus={{ borderColor: '#a59480', boxShadow: '0 0 0 1px #a59480' }}
                  />
                </FormControl>
                <FormControl isDisabled={isLoading}>
                  <FormLabel fontFamily="'Montserrat', sans-serif" color="#23201C">Message Content</FormLabel>
                  {isLoading ? (
                    <Spinner size="md" />
                  ) : (
                    <Textarea
                      value={formData.message_content}
                      onChange={(e) => handleInputChange('message_content', e.target.value)}
                      bg="#ecede8"
                      border="1px solid #23201C"
                      _focus={{ borderColor: '#a59480', boxShadow: '0 0 0 1px #a59480' }}
                      rows={4}
                    />
                  )}
                </FormControl>
                <HStack>
                  <Text fontSize="sm" color="#666">Reminder ID: {reminderId}</Text>
                </HStack>
              </VStack>
            ) : (
              <Text>Reminder not found</Text>
            )}
          </DrawerBody>
          <DrawerFooter borderTopWidth="1px" justifyContent="flex-end" className="drawer-footer-content">
            <Button variant="outline" onClick={onClose} mr={3}>Cancel</Button>
            <Button colorScheme="blue" onClick={handleSave} isLoading={isSaving} loadingText="Saving...">Save</Button>
            <Button colorScheme="green" onClick={handleSendNow} isLoading={isSending} loadingText="Sending..." ml={3} disabled={isLoading || isSaving || isSending}>Send</Button>
          </DrawerFooter>
        </DrawerContent>
      </Box>
    </Drawer>
  );
};

export default ReminderEditDrawer; 