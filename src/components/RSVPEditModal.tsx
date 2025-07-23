import React, { useState } from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Button,
  FormControl,
  FormLabel,
  Input,
  VStack,
  HStack,
  Text,
  useToast,
  Select,
  Textarea
} from '@chakra-ui/react';

interface RSVPEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  reservation: any;
  onUpdate: (updatedReservation: any) => void;
}

const RSVPEditModal: React.FC<RSVPEditModalProps> = ({
  isOpen,
  onClose,
  reservation,
  onUpdate
}) => {
  const [formData, setFormData] = useState({
    first_name: reservation?.first_name || '',
    last_name: reservation?.last_name || '',
    email: reservation?.email || '',
    phone: reservation?.phone || '',
    party_size: reservation?.party_size || 1,
    time_selected: reservation?.time_selected ? 
      new Date(reservation.time_selected).toISOString().slice(0, 16) : '',
    special_requests: reservation?.special_requests || ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const toast = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/rsvp/update', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: reservation.id,
          ...formData
        }),
      });

      const result = await response.json();

      if (response.ok) {
        toast({
          title: 'RSVP Updated',
          description: 'The RSVP has been updated successfully.',
          status: 'success',
          duration: 3000,
        });
        onUpdate(result.reservation);
        onClose();
      } else {
        throw new Error(result.error || 'Failed to update RSVP');
      }
    } catch (error) {
      console.error('Error updating RSVP:', error);
      toast({
        title: 'Error updating RSVP',
        description: error instanceof Error ? error.message : 'Failed to update RSVP. Please try again.',
        status: 'error',
        duration: 6000,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: string, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalOverlay />
      <ModalContent>
        <form onSubmit={handleSubmit}>
          <ModalHeader>Edit RSVP</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4}>
              <HStack spacing={4} w="full">
                <FormControl isRequired>
                  <FormLabel>First Name</FormLabel>
                  <Input
                    value={formData.first_name}
                    onChange={(e) => handleInputChange('first_name', e.target.value)}
                    placeholder="First Name"
                  />
                </FormControl>
                <FormControl isRequired>
                  <FormLabel>Last Name</FormLabel>
                  <Input
                    value={formData.last_name}
                    onChange={(e) => handleInputChange('last_name', e.target.value)}
                    placeholder="Last Name"
                  />
                </FormControl>
              </HStack>

              <HStack spacing={4} w="full">
                <FormControl isRequired>
                  <FormLabel>Email</FormLabel>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    placeholder="Email"
                  />
                </FormControl>
                <FormControl isRequired>
                  <FormLabel>Phone</FormLabel>
                  <Input
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    placeholder="Phone"
                  />
                </FormControl>
              </HStack>

              <HStack spacing={4} w="full">
                <FormControl isRequired>
                  <FormLabel>Number of Guests</FormLabel>
                  <Select
                    value={formData.party_size}
                    onChange={(e) => handleInputChange('party_size', parseInt(e.target.value))}
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                      <option key={num} value={num}>{num} {num === 1 ? 'guest' : 'guests'}</option>
                    ))}
                  </Select>
                </FormControl>
                <FormControl>
                  <FormLabel>Time</FormLabel>
                  <Input
                    type="datetime-local"
                    value={formData.time_selected}
                    onChange={(e) => handleInputChange('time_selected', e.target.value)}
                  />
                </FormControl>
              </HStack>

              <FormControl>
                <FormLabel>Special Requests</FormLabel>
                <Textarea
                  value={formData.special_requests}
                  onChange={(e) => handleInputChange('special_requests', e.target.value)}
                  placeholder="Any special requests or notes..."
                  rows={3}
                />
              </FormControl>
            </VStack>
          </ModalBody>

          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              bg="#a59480"
              color="white"
              _hover={{ bg: '#8c7a5a' }}
              isLoading={isSubmitting}
              loadingText="Updating..."
            >
              Update RSVP
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
};

export default RSVPEditModal; 