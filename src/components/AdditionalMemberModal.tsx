import React, { useState } from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  VStack,
  HStack,
  FormControl,
  FormLabel,
  Input,
  Button,
  Text,
  Box,
  Icon,
  Image,
  useToast
} from '@chakra-ui/react';
import { Upload, X } from 'lucide-react';

interface AdditionalMember {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  dob: string;
  photo?: string;
}

interface AdditionalMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (member: AdditionalMember) => void;
  editingMember?: AdditionalMember;
  editingIndex?: number;
}

export default function AdditionalMemberModal({
  isOpen,
  onClose,
  onSave,
  editingMember,
  editingIndex
}: AdditionalMemberModalProps) {
  const toast = useToast();
  const [formData, setFormData] = useState<AdditionalMember>(
    editingMember || {
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      dob: '',
      photo: ''
    }
  );
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const formatPhoneNumber = (value: string) => {
    // Strip all non-digits and limit to 10 digits
    const phone = value.replace(/\D/g, '').substring(0, 10);

    // Progressive formatting
    const match = phone.match(/^(\d{0,3})(\d{0,3})(\d{0,4})$/);
    if (match) {
      return !match[2] ? match[1] : `(${match[1]}) ${match[2]}${match[3] ? `-${match[3]}` : ''}`;
    }
    return value;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const finalValue = name === 'phone' ? formatPhoneNumber(value) : value;
    setFormData(prev => ({ ...prev, [name]: finalValue }));
  };

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new window.Image();
        img.onload = () => {
          const MAX_WIDTH = 400;
          const MAX_HEIGHT = 400;

          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height = (height * MAX_WIDTH) / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width = (width * MAX_HEIGHT) / height;
              height = MAX_HEIGHT;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');

          if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.75);
          resolve(compressedDataUrl);
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid File',
        description: 'Please select an image file',
        status: 'error',
        duration: 3000,
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: 'File Too Large',
        description: 'Image must be less than 10MB',
        status: 'error',
        duration: 3000,
      });
      return;
    }

    setUploadingPhoto(true);

    try {
      const compressedDataUrl = await compressImage(file);
      setFormData(prev => ({ ...prev, photo: compressedDataUrl }));
      toast({
        title: 'Photo Added',
        description: 'Profile photo has been set',
        status: 'success',
        duration: 2000,
      });
    } catch (error: any) {
      toast({
        title: 'Upload Failed',
        description: error.message || 'Failed to upload photo',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSubmit = () => {
    if (!formData.first_name || !formData.last_name || !formData.email || !formData.phone || !formData.dob) {
      toast({
        title: 'Incomplete Information',
        description: 'Please fill in all required fields',
        status: 'warning',
        duration: 3000,
      });
      return;
    }

    onSave(formData);
    onClose();

    // Reset form
    setFormData({
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      dob: '',
      photo: ''
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl" isCentered>
      <ModalOverlay bg="blackAlpha.600" />
      <ModalContent bg="#ECEDE8" borderRadius="xl">
        <ModalHeader color="#353535" fontSize="2xl" fontWeight="bold">
          {editingMember ? 'Edit Member' : 'Add Member'}
        </ModalHeader>
        <ModalCloseButton />

        <ModalBody>
          <VStack spacing={4} align="stretch">
            {/* Photo Upload */}
            <FormControl>
              {formData.photo ? (
                <Box position="relative" w="120px" h="120px">
                  <Image
                    src={formData.photo}
                    alt="Member photo"
                    w="120px"
                    h="120px"
                    borderRadius="full"
                    objectFit="cover"
                    border="3px solid"
                    borderColor="#A59480"
                  />
                  <Button
                    position="absolute"
                    top="-8px"
                    right="-8px"
                    size="sm"
                    borderRadius="full"
                    colorScheme="red"
                    onClick={() => setFormData(prev => ({ ...prev, photo: '' }))}
                    minW="32px"
                    h="32px"
                    p={0}
                  >
                    <Icon as={X} boxSize={4} />
                  </Button>
                </Box>
              ) : (
                <Button
                  as="label"
                  htmlFor="member-photo-upload"
                  leftIcon={<Icon as={Upload} />}
                  variant="outline"
                  borderWidth="2px"
                  borderColor="#A59480"
                  color="#A59480"
                  _hover={{ bg: '#A5948010' }}
                  isLoading={uploadingPhoto}
                  cursor="pointer"
                >
                  Upload Photo
                  <Input
                    id="member-photo-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    display="none"
                  />
                </Button>
              )}
            </FormControl>

            {/* Name Fields */}
            <HStack spacing={3}>
              <FormControl isRequired>
                <Input
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleInputChange}
                  placeholder="First Name"
                  bg="white"
                  borderWidth="2px"
                  _focus={{ borderColor: '#A59480' }}
                  size="lg"
                />
              </FormControl>

              <FormControl isRequired>
                <Input
                  name="last_name"
                  value={formData.last_name}
                  onChange={handleInputChange}
                  placeholder="Last Name"
                  bg="white"
                  borderWidth="2px"
                  _focus={{ borderColor: '#A59480' }}
                  size="lg"
                />
              </FormControl>
            </HStack>

            {/* Contact Fields */}
            <FormControl isRequired>
              <Input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="Email"
                bg="white"
                borderWidth="2px"
                _focus={{ borderColor: '#A59480' }}
                size="lg"
              />
            </FormControl>

            <FormControl isRequired>
              <Input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                placeholder="(555) 555-5555"
                bg="white"
                borderWidth="2px"
                _focus={{ borderColor: '#A59480' }}
                size="lg"
              />
            </FormControl>

            <FormControl isRequired>
              <Input
                type="date"
                name="dob"
                value={formData.dob}
                onChange={handleInputChange}
                placeholder="Date of Birth"
                bg="white"
                borderWidth="2px"
                _focus={{ borderColor: '#A59480' }}
                size="lg"
              />
            </FormControl>
          </VStack>
        </ModalBody>

        <ModalFooter>
          <HStack spacing={3} w="full">
            <Button
              variant="outline"
              onClick={onClose}
              flex={1}
              size="lg"
              borderWidth="2px"
              borderColor="gray.300"
              color="#353535"
              _hover={{ borderColor: '#A59480', bg: '#A5948010' }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              bg="#A59480"
              color="white"
              _hover={{ bg: '#8F7F6B' }}
              flex={1}
              size="lg"
            >
              {editingMember ? 'Update Member' : 'Add Member'}
            </Button>
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
