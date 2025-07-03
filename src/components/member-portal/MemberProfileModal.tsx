import React, { useState, useRef } from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  Button,
  VStack,
  HStack,
  FormControl,
  FormLabel,
  Input,
  Textarea,
  Avatar,
  Text,
  Divider,
  useToast,
  Alert,
  AlertIcon,
  AlertDescription,
  Switch,
  Select,
  Box,
  IconButton,
  Tag,
  TagLabel,
  TagCloseButton,
  Wrap,
  WrapItem,
} from '@chakra-ui/react';
import { EditIcon, AddIcon, DeleteIcon } from '@chakra-ui/icons';

interface Member {
  member_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  photo_url?: string;
  join_date: string;
  membership_type: string;
  membership_status: string;
  preferences: any;
}

interface MemberProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: Member | null;
  onUpdate: () => void;
}

interface FormData {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  preferences: {
    dietary_restrictions?: string[];
    communication_preferences?: {
      email_notifications: boolean;
      sms_notifications: boolean;
      marketing_emails: boolean;
    };
    seating_preferences?: string;
    special_occasions?: string;
  };
}

const MemberProfileModal: React.FC<MemberProfileModalProps> = ({
  isOpen,
  onClose,
  member,
  onUpdate,
}) => {
  const [formData, setFormData] = useState<FormData>({
    first_name: member?.first_name || '',
    last_name: member?.last_name || '',
    email: member?.email || '',
    phone: member?.phone || '',
    preferences: {
      dietary_restrictions: member?.preferences?.dietary_restrictions || [],
      communication_preferences: {
        email_notifications: member?.preferences?.communication_preferences?.email_notifications ?? true,
        sms_notifications: member?.preferences?.communication_preferences?.sms_notifications ?? true,
        marketing_emails: member?.preferences?.communication_preferences?.marketing_emails ?? false,
      },
      seating_preferences: member?.preferences?.seating_preferences || '',
      special_occasions: member?.preferences?.special_occasions || '',
    },
  });

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [newDietaryRestriction, setNewDietaryRestriction] = useState('');
  const [changeReason, setChangeReason] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  React.useEffect(() => {
    if (member) {
      setFormData({
        first_name: member.first_name,
        last_name: member.last_name,
        email: member.email,
        phone: member.phone,
        preferences: {
          dietary_restrictions: member.preferences?.dietary_restrictions || [],
          communication_preferences: {
            email_notifications: member.preferences?.communication_preferences?.email_notifications ?? true,
            sms_notifications: member.preferences?.communication_preferences?.sms_notifications ?? true,
            marketing_emails: member.preferences?.communication_preferences?.marketing_emails ?? false,
          },
          seating_preferences: member.preferences?.seating_preferences || '',
          special_occasions: member.preferences?.special_occasions || '',
        },
      });
      setPhotoPreview(null);
      setPhotoFile(null);
    }
  }, [member]);

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

     const handlePreferenceChange = (category: string, field: string, value: any) => {
     if (category === 'communication_preferences') {
       setFormData(prev => ({
         ...prev,
         preferences: {
           ...prev.preferences,
           communication_preferences: {
             ...prev.preferences.communication_preferences,
             [field]: value,
           },
         },
       }));
     } else {
       setFormData(prev => ({
         ...prev,
         preferences: {
           ...prev.preferences,
           [category]: value,
         },
       }));
     }
   };

  const handlePhotoSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast({
          title: 'File too large',
          description: 'Please select an image smaller than 5MB',
          status: 'error',
          duration: 3000,
        });
        return;
      }

      if (!file.type.startsWith('image/')) {
        toast({
          title: 'Invalid file type',
          description: 'Please select an image file',
          status: 'error',
          duration: 3000,
        });
        return;
      }

      setPhotoFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setPhotoPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const addDietaryRestriction = () => {
    if (newDietaryRestriction.trim() && !formData.preferences.dietary_restrictions?.includes(newDietaryRestriction.trim())) {
      setFormData(prev => ({
        ...prev,
        preferences: {
          ...prev.preferences,
          dietary_restrictions: [
            ...(prev.preferences.dietary_restrictions || []),
            newDietaryRestriction.trim(),
          ],
        },
      }));
      setNewDietaryRestriction('');
    }
  };

  const removeDietaryRestriction = (restriction: string) => {
    setFormData(prev => ({
      ...prev,
      preferences: {
        ...prev.preferences,
        dietary_restrictions: prev.preferences.dietary_restrictions?.filter(r => r !== restriction) || [],
      },
    }));
  };

     const uploadPhoto = async (): Promise<string | null> => {
     if (!photoFile || !member) return null;

     const uploadFormData = new FormData();
     uploadFormData.append('photo', photoFile);
     uploadFormData.append('member_id', member.member_id);

     try {
       const response = await fetch('/api/member-portal/upload-photo', {
         method: 'POST',
         body: uploadFormData,
       });

       const data = await response.json();
       if (data.success) {
         return data.photo_url as string;
       } else {
         throw new Error(data.error || 'Failed to upload photo');
       }
     } catch (error) {
       console.error('Photo upload error:', error);
       throw error;
     }
   };

  const submitProfileChanges = async () => {
    if (!member) return;

    setLoading(true);
    try {
      let photoUrl = null;
      
      // Upload photo if selected
      if (photoFile) {
        photoUrl = await uploadPhoto();
      }

             const changes: Array<{
         change_type: string;
         current_data: any;
         proposed_data: any;
       }> = [];

       // Check for profile info changes
       if (
         formData.first_name !== member.first_name ||
         formData.last_name !== member.last_name ||
         formData.email !== member.email ||
         formData.phone !== member.phone
       ) {
         changes.push({
           change_type: 'profile_info',
           current_data: {
             first_name: member.first_name,
             last_name: member.last_name,
             email: member.email,
             phone: member.phone,
           },
           proposed_data: {
             first_name: formData.first_name,
             last_name: formData.last_name,
             email: formData.email,
             phone: formData.phone,
           },
         });
       }

       // Check for photo changes
       if (photoUrl) {
         changes.push({
           change_type: 'photo',
           current_data: { photo_url: member.photo_url },
           proposed_data: { photo_url: photoUrl },
         });
       }

       // Check for preference changes
       if (JSON.stringify(formData.preferences) !== JSON.stringify(member.preferences)) {
         changes.push({
           change_type: 'preferences',
           current_data: member.preferences,
           proposed_data: formData.preferences,
         });
       }

      if (changes.length === 0) {
        toast({
          title: 'No changes detected',
          description: 'Please make some changes before submitting',
          status: 'info',
          duration: 3000,
        });
        setLoading(false);
        return;
      }

      // Submit changes for approval
      for (const change of changes) {
        const response = await fetch('/api/member-portal/submit-changes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...change,
            member_id: member.member_id,
            reason: changeReason,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to submit changes');
        }
      }

      toast({
        title: 'Changes submitted',
        description: 'Your changes have been submitted for admin approval',
        status: 'success',
        duration: 5000,
      });

      onClose();
      onUpdate();
    } catch (error: any) {
      toast({
        title: 'Error submitting changes',
        description: error.message || 'Please try again',
        status: 'error',
        duration: 5000,
      });
    } finally {
      setLoading(false);
    }
  };

  const formatPhoneNumber = (value: string) => {
    const phone = value.replace(/\D/g, '');
    const match = phone.match(/^(\d{0,3})(\d{0,3})(\d{0,4})$/);
    if (match) {
      return !match[2] ? match[1] : `(${match[1]}) ${match[2]}${match[3] ? `-${match[3]}` : ''}`;
    }
    return value;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    handleInputChange('phone', formatted);
  };

  if (!member) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="2xl">
      <ModalOverlay />
      <ModalContent bg="#28251F" borderColor="#3A362F" borderWidth={1}>
        <ModalHeader color="#ECEDE8">Edit Profile</ModalHeader>
        <ModalCloseButton color="#BCA892" />
        
        <ModalBody>
          <VStack spacing={6} align="stretch">
            <Alert status="info" bg="#3A362F" borderColor="#BCA892">
              <AlertIcon />
              <AlertDescription color="#ECEDE8">
                All changes require admin approval and will be reviewed within 24 hours.
              </AlertDescription>
            </Alert>

            {/* Photo Section */}
            <Box>
              <Text color="#ECEDE8" fontWeight="bold" mb={3}>Profile Photo</Text>
              <HStack spacing={4}>
                <Avatar
                  size="xl"
                  src={photoPreview || member.photo_url}
                  name={`${member.first_name} ${member.last_name}`}
                  bg="#BCA892"
                  color="#23201C"
                />
                <VStack align="start">
                  <Button
                    size="sm"
                    leftIcon={<EditIcon />}
                    onClick={() => fileInputRef.current?.click()}
                    colorScheme="orange"
                    variant="outline"
                  >
                    Change Photo
                  </Button>
                  <Text fontSize="xs" color="#BCA892">
                    Max 5MB • JPG, PNG supported
                  </Text>
                </VStack>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handlePhotoSelect}
                />
              </HStack>
            </Box>

            <Divider borderColor="#3A362F" />

            {/* Basic Information */}
            <Box>
              <Text color="#ECEDE8" fontWeight="bold" mb={3}>Basic Information</Text>
              <VStack spacing={4}>
                <HStack spacing={4} w="100%">
                  <FormControl>
                    <FormLabel color="#BCA892">First Name</FormLabel>
                    <Input
                      value={formData.first_name}
                      onChange={(e) => handleInputChange('first_name', e.target.value)}
                      bg="white"
                      color="black"
                    />
                  </FormControl>
                  <FormControl>
                    <FormLabel color="#BCA892">Last Name</FormLabel>
                    <Input
                      value={formData.last_name}
                      onChange={(e) => handleInputChange('last_name', e.target.value)}
                      bg="white"
                      color="black"
                    />
                  </FormControl>
                </HStack>
                
                <FormControl>
                  <FormLabel color="#BCA892">Email</FormLabel>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    bg="white"
                    color="black"
                  />
                </FormControl>
                
                <FormControl>
                  <FormLabel color="#BCA892">Phone Number</FormLabel>
                  <Input
                    type="tel"
                    value={formData.phone}
                    onChange={handlePhoneChange}
                    maxLength={14}
                    bg="white"
                    color="black"
                  />
                </FormControl>
              </VStack>
            </Box>

            <Divider borderColor="#3A362F" />

            {/* Dietary Restrictions */}
            <Box>
              <Text color="#ECEDE8" fontWeight="bold" mb={3}>Dietary Restrictions</Text>
              <Wrap spacing={2} mb={3}>
                {formData.preferences.dietary_restrictions?.map((restriction, index) => (
                  <WrapItem key={index}>
                    <Tag size="md" variant="solid" colorScheme="orange">
                      <TagLabel>{restriction}</TagLabel>
                      <TagCloseButton onClick={() => removeDietaryRestriction(restriction)} />
                    </Tag>
                  </WrapItem>
                ))}
              </Wrap>
              <HStack>
                <Input
                  placeholder="Add dietary restriction"
                  value={newDietaryRestriction}
                  onChange={(e) => setNewDietaryRestriction(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addDietaryRestriction()}
                  bg="white"
                  color="black"
                />
                <IconButton
                  icon={<AddIcon />}
                  onClick={addDietaryRestriction}
                  colorScheme="orange"
                  aria-label="Add dietary restriction"
                />
              </HStack>
            </Box>

            <Divider borderColor="#3A362F" />

            {/* Communication Preferences */}
            <Box>
              <Text color="#ECEDE8" fontWeight="bold" mb={3}>Communication Preferences</Text>
              <VStack spacing={3} align="stretch">
                <HStack justify="space-between">
                  <Text color="#BCA892">Email Notifications</Text>
                  <Switch
                    isChecked={formData.preferences.communication_preferences?.email_notifications}
                    onChange={(e) => handlePreferenceChange('communication_preferences', 'email_notifications', e.target.checked)}
                    colorScheme="orange"
                  />
                </HStack>
                <HStack justify="space-between">
                  <Text color="#BCA892">SMS Notifications</Text>
                  <Switch
                    isChecked={formData.preferences.communication_preferences?.sms_notifications}
                    onChange={(e) => handlePreferenceChange('communication_preferences', 'sms_notifications', e.target.checked)}
                    colorScheme="orange"
                  />
                </HStack>
                <HStack justify="space-between">
                  <Text color="#BCA892">Marketing Emails</Text>
                  <Switch
                    isChecked={formData.preferences.communication_preferences?.marketing_emails}
                    onChange={(e) => handlePreferenceChange('communication_preferences', 'marketing_emails', e.target.checked)}
                    colorScheme="orange"
                  />
                </HStack>
              </VStack>
            </Box>

            <Divider borderColor="#3A362F" />

            {/* Additional Preferences */}
            <Box>
              <Text color="#ECEDE8" fontWeight="bold" mb={3}>Additional Preferences</Text>
              <VStack spacing={4}>
                <FormControl>
                  <FormLabel color="#BCA892">Seating Preferences</FormLabel>
                  <Select
                    value={formData.preferences.seating_preferences}
                    onChange={(e) => handlePreferenceChange('seating_preferences', '', e.target.value)}
                    bg="white"
                    color="black"
                  >
                    <option value="">No preference</option>
                    <option value="window">Window seating</option>
                    <option value="booth">Booth seating</option>
                    <option value="bar">Bar seating</option>
                    <option value="quiet">Quiet area</option>
                  </Select>
                </FormControl>
                
                <FormControl>
                  <FormLabel color="#BCA892">Special Occasions / Notes</FormLabel>
                  <Textarea
                    value={formData.preferences.special_occasions}
                    onChange={(e) => handlePreferenceChange('special_occasions', '', e.target.value)}
                    placeholder="Anniversary dates, allergies, accessibility needs, etc."
                    bg="white"
                    color="black"
                    rows={3}
                  />
                </FormControl>
              </VStack>
            </Box>

            <Divider borderColor="#3A362F" />

            {/* Reason for Changes */}
            <FormControl>
              <FormLabel color="#BCA892">Reason for Changes (Optional)</FormLabel>
              <Textarea
                value={changeReason}
                onChange={(e) => setChangeReason(e.target.value)}
                placeholder="Help us understand why you're making these changes..."
                bg="white"
                color="black"
                rows={2}
              />
            </FormControl>
          </VStack>
        </ModalBody>

        <ModalFooter>
          <Button variant="ghost" onClick={onClose} color="#BCA892" mr={3}>
            Cancel
          </Button>
          <Button
            colorScheme="orange"
            onClick={submitProfileChanges}
            isLoading={loading}
            loadingText="Submitting..."
          >
            Submit for Approval
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default MemberProfileModal;