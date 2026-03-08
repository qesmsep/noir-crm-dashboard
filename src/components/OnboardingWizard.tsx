import React, { useState } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  Input,
  Textarea,
  FormControl,
  FormLabel,
  Radio,
  RadioGroup,
  Checkbox,
  useToast,
  Card,
  CardBody,
  Icon,
  Progress,
  Divider,
  Badge,
  Image
} from '@chakra-ui/react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, FileText, CreditCard, DollarSign, User, Upload, Building2, UserPlus, Edit2, Trash2, Award } from 'lucide-react';
import SignatureCanvas from '@/components/SignatureCanvas';
import AdditionalMemberModal from '@/components/AdditionalMemberModal';
import { Elements, PaymentElement, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);
const MotionBox = motion(Box);

interface OnboardingWizardProps {
  token: string;
  waitlistData: any;
  agreement: any;
  membershipPlans: any[];
  onComplete: () => void;
}

const STEPS = [
  { id: 1, name: 'Contact Info', icon: User },
  { id: 2, name: 'Agreement', icon: FileText },
  { id: 3, name: 'Membership', icon: Award },
  { id: 4, name: 'Additional Members', icon: UserPlus },
  { id: 5, name: 'Payment', icon: DollarSign },
  { id: 6, name: 'Profile', icon: Check }
];

function PaymentForm({ token, selectedMembership, onSuccess, additionalMembersCount, waitlistData }: any) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [paymentType, setPaymentType] = useState<'card' | 'ach' | null>(null);
  const toast = useToast();

  const handleCardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) return;

    setSubmitting(true);

    try {
      const cardElement = elements.getElement(CardElement);
      if (!cardElement) {
        throw new Error('Card element not found');
      }

      // Create payment intent when user submits payment
      const intentResponse = await fetch('/api/payment/create-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          membership_type: selectedMembership,
          additional_members_count: additionalMembersCount
        })
      });

      if (!intentResponse.ok) {
        throw new Error('Failed to create payment intent');
      }

      const intentData = await intentResponse.json();

      // Confirm card payment
      const { error, paymentIntent } = await stripe.confirmCardPayment(intentData.client_secret, {
        payment_method: {
          card: cardElement,
          billing_details: {
            name: `${waitlistData.first_name} ${waitlistData.last_name}`,
            email: waitlistData.email,
          },
        },
      });

      if (error) {
        throw error;
      }

      if (paymentIntent?.status !== 'succeeded') {
        throw new Error('Payment was not successful');
      }

      // Confirm member creation on backend
      const response = await fetch('/api/payment/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });

      if (!response.ok) {
        throw new Error('Failed to complete onboarding');
      }

      toast({
        title: 'Success! 🎉',
        description: 'Your membership is now active',
        status: 'success',
        duration: 5000,
      });

      onSuccess();
    } catch (error: any) {
      toast({
        title: 'Payment Failed',
        description: error.message || 'Please try again',
        status: 'error',
        duration: 5000,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAchSubmit = async () => {
    if (!stripe) return;

    setSubmitting(true);

    try {
      // Create payment intent when user submits payment
      const intentResponse = await fetch('/api/payment/create-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          membership_type: selectedMembership,
          additional_members_count: additionalMembersCount
        })
      });

      if (!intentResponse.ok) {
        throw new Error('Failed to create payment intent');
      }

      const intentData = await intentResponse.json();

      // Lock scroll position during Financial Connections flow
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      document.body.style.position = 'fixed';
      document.body.style.top = '0';
      document.body.style.left = '0';
      document.body.style.right = '0';
      document.body.style.width = '100%';
      document.body.style.overflow = 'hidden';

      // Use Financial Connections to collect bank account
      const { error, paymentIntent } = await stripe.collectBankAccountForPayment({
        clientSecret: intentData.client_secret,
        params: {
          payment_method_type: 'us_bank_account',
          payment_method_data: {
            billing_details: {
              name: `${waitlistData.first_name} ${waitlistData.last_name}`,
              email: waitlistData.email,
            },
          },
        },
      });

      if (error) {
        throw error;
      }

      if (!paymentIntent || paymentIntent.status !== 'succeeded') {
        // Payment might be processing - check with backend
        const response = await fetch('/api/payment/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token })
        });

        if (!response.ok) {
          throw new Error('Failed to complete onboarding');
        }
      }

      toast({
        title: 'Success! 🎉',
        description: 'Your membership is now active',
        status: 'success',
        duration: 5000,
      });

      onSuccess();
    } catch (error: any) {
      toast({
        title: 'Payment Failed',
        description: error.message || 'Please try again',
        status: 'error',
        duration: 5000,
      });
    } finally {
      // Unlock body scroll
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      document.body.style.width = '';
      document.body.style.height = '';
      setSubmitting(false);
    }
  };

  if (!paymentType) {
    return (
      <VStack spacing={4} align="stretch">
        <Text fontSize="md" fontWeight="semibold" color="#353535" mb={2}>
          Choose Payment Method
        </Text>

        {/* ACH Option */}
        <Box
          as="button"
          type="button"
          onClick={() => setPaymentType('ach')}
          p={5}
          borderWidth="1px"
          borderColor="#D1D5DB"
          borderRadius="lg"
          bg="white"
          boxShadow="0 2px 4px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.05)"
          _hover={{
            borderColor: '#A59480',
            bg: '#FBFBFA',
            boxShadow: "0 4px 8px rgba(0,0,0,0.12), 0 8px 20px rgba(0,0,0,0.08)"
          }}
          transition="all 0.2s"
          textAlign="left"
        >
          <HStack spacing={3}>
            <Icon as={Building2} boxSize={7} color="#A59480" />
            <VStack align="start" spacing={0.5} flex={1}>
              <Text fontSize="md" fontWeight="semibold" color="#1F1F1F">
                US Bank Account (ACH)
              </Text>
              <Text fontSize="xs" color="#5A5A5A">
                Direct debit from your bank
              </Text>
              <Text fontSize="xs" color="#4CAF50" fontWeight="bold" mt={1}>
                No processing fee
              </Text>
            </VStack>
          </HStack>
        </Box>

        {/* Credit Card Option */}
        <Box
          as="button"
          type="button"
          onClick={() => setPaymentType('card')}
          p={5}
          borderWidth="1px"
          borderColor="#D1D5DB"
          borderRadius="lg"
          bg="white"
          boxShadow="0 2px 4px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.05)"
          _hover={{
            borderColor: '#A59480',
            bg: '#FBFBFA',
            boxShadow: "0 4px 8px rgba(0,0,0,0.12), 0 8px 20px rgba(0,0,0,0.08)"
          }}
          transition="all 0.2s"
          textAlign="left"
        >
          <HStack spacing={3}>
            <Icon as={CreditCard} boxSize={7} color="#A59480" />
            <VStack align="start" spacing={0.5} flex={1}>
              <Text fontSize="md" fontWeight="semibold" color="#1F1F1F">
                Credit or Debit Card
              </Text>
              <Text fontSize="xs" color="#5A5A5A">
                Visa, Mastercard, Amex, Discover
              </Text>
              <Text fontSize="xs" color="#DC2626" fontWeight="bold" mt={1}>
                + 4% processing fee
              </Text>
            </VStack>
          </HStack>
        </Box>
      </VStack>
    );
  }

  if (paymentType === 'card') {
    return (
      <form onSubmit={handleCardSubmit}>
        <VStack spacing={6} align="stretch">
          <Box>
            <VStack align="stretch" spacing={2} mb={4}>
              <Text fontSize="lg" fontWeight="semibold" color="#353535">
                Card Information
              </Text>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setPaymentType(null)}
                color="#5A5A5A"
                alignSelf="flex-start"
                px={0}
              >
                Change Payment Method
              </Button>
            </VStack>

            <Box
              p={4}
              borderWidth="1px"
              borderColor="#ECEAE5"
              borderRadius="lg"
              bg="white"
            >
              <CardElement
                options={{
                  style: {
                    base: {
                      fontSize: '16px',
                      color: '#1F1F1F',
                      '::placeholder': {
                        color: '#8C7C6D',
                      },
                    },
                  },
                }}
              />
            </Box>

            <Text fontSize="xs" color="#DC2626" mt={2}>
              Note: A 4% processing fee will be added to credit card payments. To avoid this charge,{' '}
              <Text
                as="span"
                textDecoration="underline"
                cursor="pointer"
                fontWeight="bold"
                onClick={() => setPaymentType(null)}
              >
                use ACH
              </Text>
              {' '}instead.
            </Text>
          </Box>

          <Button
            type="submit"
            size="lg"
            bg="#A59480"
            color="white"
            _hover={{ bg: '#8F7F6B' }}
            isLoading={submitting}
            isDisabled={!stripe}
            leftIcon={<Icon as={Check} />}
            boxShadow="0 2px 4px rgba(0,0,0,0.1), 0 4px 8px rgba(0,0,0,0.1), 0 8px 16px rgba(0,0,0,0.1)"
            minH="56px"
          >
            Complete Payment
          </Button>
        </VStack>
      </form>
    );
  }

  // ACH payment - uses Financial Connections
  return (
    <VStack spacing={6} align="stretch">
      <Box>
        <VStack align="stretch" spacing={2} mb={4}>
          <Text fontSize="lg" fontWeight="semibold" color="#353535">
            US Bank Account (ACH)
          </Text>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setPaymentType(null)}
            color="#5A5A5A"
            alignSelf="flex-start"
            px={0}
          >
            Change Payment Method
          </Button>
        </VStack>

        <Box
          p={6}
          borderWidth="1px"
          borderColor="#ECEAE5"
          borderRadius="lg"
          bg="#FBFBFA"
          textAlign="center"
        >
          <Icon as={Building2} boxSize={12} color="#A59480" mb={3} />
          <Text fontSize="sm" color="#1F1F1F" fontWeight="medium" mb={2}>
            Connect Your Bank Account
          </Text>
          <Text fontSize="xs" color="#5A5A5A" mb={3}>
            Click below to securely link your bank account using Stripe's secure connection.
          </Text>
          <Text fontSize="xs" color="#4CAF50" fontWeight="bold">
            ✓ No processing fee for ACH payments
          </Text>
        </Box>
      </Box>

      <Button
        onClick={handleAchSubmit}
        size="lg"
        bg="#A59480"
        color="white"
        _hover={{ bg: '#8F7F6B' }}
        isLoading={submitting}
        isDisabled={!stripe}
        leftIcon={<Icon as={Building2} />}
        boxShadow="0 2px 4px rgba(0,0,0,0.1), 0 4px 8px rgba(0,0,0,0.1), 0 8px 16px rgba(0,0,0,0.1)"
        minH="56px"
      >
        {submitting ? 'Connecting...' : 'Connect Bank Account'}
      </Button>
    </VStack>
  );
}

export default function OnboardingWizard({
  token,
  waitlistData,
  agreement,
  membershipPlans,
  onComplete
}: OnboardingWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward');
  const toast = useToast();

  // Step 1: Contact Info
  const [firstName, setFirstName] = useState(waitlistData.first_name || '');
  const [lastName, setLastName] = useState(waitlistData.last_name || '');
  const [email, setEmail] = useState(waitlistData.email || '');
  const [phone, setPhone] = useState(waitlistData.phone || '');
  const [address, setAddress] = useState(waitlistData.address || '');
  const [city, setCity] = useState(waitlistData.city || '');
  const [state, setState] = useState(waitlistData.state || '');
  const [zipCode, setZipCode] = useState(waitlistData.zip_code || '');
  const [primaryMemberPhoto, setPrimaryMemberPhoto] = useState(waitlistData.photo_url || '');
  const [uploadingPrimaryPhoto, setUploadingPrimaryPhoto] = useState(false);

  // Step 2: Agreement
  const [signerName, setSignerName] = useState(`${waitlistData.first_name} ${waitlistData.last_name}`);
  const [signerEmail, setSignerEmail] = useState(waitlistData.email);
  const [signatureData, setSignatureData] = useState('');
  const [agreed, setAgreed] = useState(false);

  // Step 3: Membership
  const [selectedMembership, setSelectedMembership] = useState(
    waitlistData.selected_membership || membershipPlans[0]?.type || ''
  );

  // Check if this is a Skyline-only flow
  const isSkylineFlow = waitlistData.selected_membership === 'Skyline';

  // Step 4: Additional Members
  const [additionalMembers, setAdditionalMembers] = useState<Array<{
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    dob: string;
    photo?: string;
  }>>([]);
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
  const [editingMemberIndex, setEditingMemberIndex] = useState<number | undefined>(undefined);

  // Step 5: Payment

  // Step 6: Profile
  const [photoUrl, setPhotoUrl] = useState('');
  const [bio, setBio] = useState('');
  const [preferences, setPreferences] = useState({
    newsletter: true,
    smsNotifications: true
  });

  const progress = (currentStep / STEPS.length) * 100;

  const handleNext = async () => {
    if (currentStep === 1) {
      // Contact info step
      if (await validateAndSaveContactInfo()) {
        setDirection('forward');
        setCurrentStep(2);
      }
    } else if (currentStep === 2) {
      // Agreement step
      if (await validateAndSaveAgreement()) {
        setDirection('forward');
        // Skip membership selection for Skyline flow
        setCurrentStep(isSkylineFlow ? 4 : 3);
      }
    } else if (currentStep === 3) {
      // Membership selection step
      if (await validateMembershipSelection()) {
        setDirection('forward');
        setCurrentStep(4);
      }
    } else if (currentStep === 4) {
      // Additional members step - save and continue to payment
      if (await saveAdditionalMembers()) {
        setDirection('forward');
        setCurrentStep(5);
      }
    } else if (currentStep === 5) {
      // Payment handled by PaymentForm
    } else if (currentStep === 6) {
      // Profile step
      await handleCompleteProfile();
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setDirection('backward');
      // Skip step 3 when going back from step 4 in Skyline flow
      if (currentStep === 4 && isSkylineFlow) {
        setCurrentStep(2);
      } else {
        setCurrentStep(prev => prev - 1);
      }
    }
  };

  const validateAndSaveContactInfo = async (): Promise<boolean> => {
    if (!firstName || !lastName || !email || !phone) {
      toast({
        title: 'Required Fields',
        description: 'Please provide your name, email, and phone number',
        status: 'warning',
        duration: 3000,
      });
      return false;
    }

    if (!address || !city || !state || !zipCode) {
      toast({
        title: 'Address Required',
        description: 'Please complete your address',
        status: 'warning',
        duration: 3000,
      });
      return false;
    }

    if (!primaryMemberPhoto) {
      toast({
        title: 'Photo Required',
        description: 'Please upload your profile photo',
        status: 'warning',
        duration: 3000,
      });
      return false;
    }

    try {
      const response = await fetch('/api/onboard/save-contact-info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          first_name: firstName,
          last_name: lastName,
          email,
          phone,
          address,
          city,
          state,
          zip_code: zipCode,
          photo_url: primaryMemberPhoto
        })
      });

      if (!response.ok) {
        throw new Error('Failed to save contact information');
      }

      // Update signer name and email for agreement step
      setSignerName(`${firstName} ${lastName}`);
      setSignerEmail(email);

      return true;
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save contact information. Please try again.',
        status: 'error',
        duration: 5000,
      });
      return false;
    }
  };

  const validateAndSaveAgreement = async (): Promise<boolean> => {
    if (!signerName || !signerEmail) {
      toast({
        title: 'Required Fields',
        description: 'Please provide your name and email',
        status: 'warning',
        duration: 3000,
      });
      return false;
    }

    if (!signatureData) {
      toast({
        title: 'Signature Required',
        description: 'Please sign the agreement',
        status: 'warning',
        duration: 3000,
      });
      return false;
    }

    try {
      const response = await fetch('/api/agreement/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          signer_name: signerName,
          signer_email: signerEmail,
          signature_data: signatureData,
          agreement_id: agreement?.id
        })
      });

      if (!response.ok) {
        throw new Error('Failed to save signature');
      }

      return true;
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save signature. Please try again.',
        status: 'error',
        duration: 5000,
      });
      return false;
    }
  };

  const validateMembershipSelection = async (): Promise<boolean> => {
    if (!selectedMembership) {
      toast({
        title: 'Select Membership',
        description: 'Please select a membership type',
        status: 'warning',
        duration: 3000,
      });
      return false;
    }
    return true;
  };

  const saveAdditionalMembers = async (): Promise<boolean> => {
    // Validate additional members if any were added
    for (let i = 0; i < additionalMembers.length; i++) {
      const member = additionalMembers[i];
      if (!member.first_name || !member.last_name || !member.email || !member.phone || !member.dob) {
        toast({
          title: 'Incomplete Member Info',
          description: `Please complete all fields for additional member #${i + 1}`,
          status: 'warning',
          duration: 3000,
        });
        return false;
      }
    }

    // Save to waitlist record
    try {
      const response = await fetch('/api/onboard/save-additional-members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          additional_members: additionalMembers
        })
      });

      if (!response.ok) {
        throw new Error('Failed to save additional members');
      }

      return true;
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save additional members. Please try again.',
        status: 'error',
        duration: 5000,
      });
      return false;
    }
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

  const handlePrimaryPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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

    setUploadingPrimaryPhoto(true);

    try {
      const compressedDataUrl = await compressImage(file);
      setPrimaryMemberPhoto(compressedDataUrl);
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
      setUploadingPrimaryPhoto(false);
    }
  };

  const handleCompleteProfile = async () => {
    // Optional profile completion - can skip
    onComplete();
  };

  const handlePaymentSuccess = () => {
    setDirection('forward');
    setCurrentStep(6);
  };

  const today = new Date().toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });

  const agreementContent = agreement?.content
    ?.replace(/{{name}}/g, signerName)
    ?.replace(/MEMBER_NAME/g, signerName)
    ?.replace(/{{email}}/g, signerEmail)
    ?.replace(/{{membership}}/g, selectedMembership || 'Standard')
    ?.replace(/{{date}}/g, today);

  const selectedPlan = membershipPlans.find(p => p.type === selectedMembership);

  const slideVariants = {
    enter: (direction: string) => ({
      x: direction === 'forward' ? 300 : -300,
      opacity: 0,
      scale: 0.95
    }),
    center: {
      x: 0,
      opacity: 1,
      scale: 1
    },
    exit: (direction: string) => ({
      x: direction === 'forward' ? -300 : 300,
      opacity: 0,
      scale: 0.95
    })
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <VStack spacing={3} align="stretch">
            {/* Profile Photo - Required */}
            <FormControl isRequired>
              {primaryMemberPhoto ? (
                <HStack spacing={4}>
                  <Image
                    src={primaryMemberPhoto}
                    alt="Your photo"
                    boxSize="100px"
                    borderRadius="full"
                    objectFit="cover"
                    border="3px solid"
                    borderColor="#A59480"
                  />
                  <VStack align="start" flex={1}>
                    <Text fontSize="sm" color="green.600" fontWeight="medium">
                      ✓ Photo uploaded successfully
                    </Text>
                    <Button
                      size="sm"
                      variant="ghost"
                      colorScheme="red"
                      onClick={() => setPrimaryMemberPhoto('')}
                    >
                      Remove Photo
                    </Button>
                  </VStack>
                </HStack>
              ) : (
                <Button
                  as="label"
                  htmlFor="primary-photo-upload"
                  leftIcon={<Icon as={Upload} />}
                  variant="outline"
                  borderWidth="2px"
                  borderColor="#A59480"
                  color="#A59480"
                  _hover={{ bg: '#A5948010' }}
                  isLoading={uploadingPrimaryPhoto}
                  cursor="pointer"
                  size="lg"
                  w="full"
                >
                  Upload Your Photo
                  <Input
                    id="primary-photo-upload"
                    type="file"
                    accept="image/*"
                    onChange={handlePrimaryPhotoUpload}
                    display="none"
                  />
                </Button>
              )}
            </FormControl>

            {/* Name Fields */}
            <HStack spacing={1}>
              <FormControl isRequired>
                <Input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="First Name"
                  size="lg"
                  bg="white"
                  borderWidth="2px"
                  _focus={{ borderColor: '#A59480' }}
                />
              </FormControl>

              <FormControl isRequired>
                <Input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Last Name"
                  size="lg"
                  bg="white"
                  borderWidth="2px"
                  _focus={{ borderColor: '#A59480' }}
                />
              </FormControl>
            </HStack>

            {/* Contact Fields */}
            <FormControl isRequired>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email Address"
                size="lg"
                bg="white"
                borderWidth="2px"
                _focus={{ borderColor: '#A59480' }}
              />
            </FormControl>

            <FormControl isRequired>
              <Input
                type="tel"
                value={phone}
                onChange={(e) => {
                  const input = e.target.value.replace(/\D/g, '');
                  let formatted = '';
                  if (input.length > 0) {
                    formatted = '(' + input.substring(0, 3);
                    if (input.length >= 3) {
                      formatted += ') ' + input.substring(3, 6);
                    }
                    if (input.length >= 6) {
                      formatted += '-' + input.substring(6, 10);
                    }
                  }
                  setPhone(formatted);
                }}
                placeholder="(555) 555-5555"
                maxLength={14}
                size="lg"
                bg="white"
                borderWidth="2px"
                _focus={{ borderColor: '#A59480' }}
              />
            </FormControl>

            {/* Address Fields */}
            <FormControl isRequired>
              <Input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Street Address"
                size="lg"
                bg="white"
                borderWidth="2px"
                _focus={{ borderColor: '#A59480' }}
              />
            </FormControl>

            <HStack spacing={1} align="flex-start">
              <VStack spacing={1} align="stretch" flex={2}>
                <FormControl isRequired>
                  <Input
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="City"
                    size="lg"
                    bg="white"
                    borderWidth="2px"
                    _focus={{ borderColor: '#A59480' }}
                  />
                </FormControl>

                <FormControl isRequired>
                  <Input
                    value={zipCode}
                    onChange={(e) => setZipCode(e.target.value)}
                    placeholder="ZIP Code"
                    maxLength={5}
                    size="lg"
                    bg="white"
                    borderWidth="2px"
                    _focus={{ borderColor: '#A59480' }}
                  />
                </FormControl>
              </VStack>

              <FormControl isRequired flex={1}>
                <Input
                  value={state}
                  onChange={(e) => setState(e.target.value.toUpperCase())}
                  placeholder="State"
                  maxLength={2}
                  textTransform="uppercase"
                  size="lg"
                  bg="white"
                  borderWidth="2px"
                  _focus={{ borderColor: '#A59480' }}
                />
              </FormControl>
            </HStack>
          </VStack>
        );

      case 2:
        return (
          <VStack spacing={4} align="stretch">
            <Box
              maxH={{ base: "400px", md: "300px" }}
              overflowY="auto"
              p={{ base: 6, md: 4 }}
              bg="white"
              borderRadius="md"
              borderWidth="2px"
              borderColor="gray.300"
              mx={{ base: -4, md: 0 }}
              width={{ base: "calc(100% + 32px)", md: "100%" }}
            >
              <Text whiteSpace="pre-wrap" fontSize="sm" lineHeight="tall" color="#353535">
                {agreementContent}
              </Text>
            </Box>

            <VStack spacing={3} align="stretch">
              <Text fontSize="sm" color="gray.600">
                Hold and drag to sign
              </Text>
              <SignatureCanvas
                onSignatureComplete={setSignatureData}
                disabled={false}
              />
            </VStack>
          </VStack>
        );

      case 3:
        return (
          <VStack spacing={6} align="stretch">
            <Text fontSize="xl" fontWeight="bold" color="#353535">
              Choose Your Membership
            </Text>

            <RadioGroup value={selectedMembership} onChange={setSelectedMembership}>
              <VStack spacing={4} align="stretch">
                {membershipPlans.map(plan => (
                  <Box
                    key={plan.id || plan.type}
                    p={5}
                    borderRadius="lg"
                    borderWidth="2px"
                    borderColor={selectedMembership === plan.type ? '#A59480' : 'gray.300'}
                    bg={selectedMembership === plan.type ? '#A5948010' : 'white'}
                    cursor="pointer"
                    transition="all 0.2s"
                    _hover={{ borderColor: '#A59480', transform: 'translateY(-2px)' }}
                    onClick={() => setSelectedMembership(plan.type)}
                  >
                    <Radio value={plan.type} colorScheme="orange" size="lg" w="full">
                      <VStack align="start" spacing={2} w="full">
                        <Text fontSize="lg" fontWeight="bold">
                          {plan.type}
                        </Text>
                        <Text fontSize="sm" color="gray.600">
                          {plan.description}
                        </Text>
                        <HStack spacing={2} align="baseline">
                          <Text fontSize="2xl" fontWeight="bold" color="#A59480">
                            ${plan.base_fee}
                          </Text>
                          <Text fontSize="xs" color="gray.500">
                            one-time fee
                          </Text>
                        </HStack>
                      </VStack>
                    </Radio>
                  </Box>
                ))}
              </VStack>
            </RadioGroup>
          </VStack>
        );

      case 4:
        return (
          <VStack spacing={6} align="stretch">
            <Text fontSize="sm" color="gray.600">
              {selectedMembership === 'Skyline'
                ? 'Skyline members can add 1 additional member at no extra cost!'
                : 'Add additional members to your account for $25/month each.'}
            </Text>

            {/* Display existing additional members - clean list view */}
            {additionalMembers.length > 0 && (
              <VStack spacing={3} align="stretch">
                {additionalMembers.map((member, index) => (
                  <Box
                    key={index}
                    position="relative"
                    p={4}
                    borderWidth="2px"
                    borderColor="#A59480"
                    borderRadius="lg"
                    bg="white"
                    transition="all 0.2s"
                    _hover={{ transform: 'translateY(-2px)', boxShadow: 'md' }}
                  >
                    <Button
                      position="absolute"
                      top={2}
                      right={2}
                      size="sm"
                      variant="ghost"
                      color="#A59480"
                      onClick={() => {
                        setEditingMemberIndex(index);
                        setIsAddMemberModalOpen(true);
                      }}
                      minW="auto"
                      p={2}
                    >
                      <Icon as={Edit2} boxSize={4} />
                    </Button>

                    <HStack spacing={4}>
                      {member.photo ? (
                        <Image
                          src={member.photo}
                          alt={`${member.first_name} ${member.last_name}`}
                          boxSize="50px"
                          borderRadius="full"
                          objectFit="cover"
                          border="2px solid"
                          borderColor="#A59480"
                        />
                      ) : (
                        <Box
                          boxSize="50px"
                          borderRadius="full"
                          bg="#A5948010"
                          border="2px solid"
                          borderColor="#A59480"
                          display="flex"
                          alignItems="center"
                          justifyContent="center"
                        >
                          <Icon as={User} boxSize={6} color="#A59480" />
                        </Box>
                      )}
                      <VStack align="start" spacing={0}>
                        <Text fontSize="md" fontWeight="bold" color="#353535">
                          {member.first_name} {member.last_name}
                        </Text>
                        <Text fontSize="sm" color="gray.600">
                          {member.email}
                        </Text>
                      </VStack>
                    </HStack>
                  </Box>
                ))}
              </VStack>
            )}

            {/* Add member button */}
            <Button
              leftIcon={<Icon as={UserPlus} />}
              onClick={() => {
                setEditingMemberIndex(undefined);
                setIsAddMemberModalOpen(true);
              }}
              variant="outline"
              borderWidth="2px"
              borderColor="#A59480"
              color="#A59480"
              _hover={{ bg: '#A5948010' }}
              size="lg"
              isDisabled={selectedMembership === 'Skyline' && additionalMembers.length >= 1}
            >
              {selectedMembership === 'Skyline' && additionalMembers.length >= 1 ? 'Maximum Members Reached' : 'Add Member'}
            </Button>

            {/* Pricing summary */}
            {additionalMembers.length > 0 && (
              <Box
                p={4}
                bg="#A5948010"
                borderRadius="md"
                borderLeftWidth="4px"
                borderLeftColor="#A59480"
              >
                <VStack align="stretch" spacing={2}>
                  <HStack justify="space-between">
                    <Text fontSize="sm" fontWeight="medium">
                      Base Membership ({selectedPlan?.type})
                    </Text>
                    <Text fontSize="sm" fontWeight="bold">
                      ${selectedPlan?.base_fee}
                    </Text>
                  </HStack>
                  <HStack justify="space-between">
                    <Text fontSize="sm" fontWeight="medium">
                      Additional Members ({additionalMembers.length} × ${selectedMembership === 'Skyline' ? '0' : '25'})
                    </Text>
                    <Text fontSize="sm" fontWeight="bold">
                      ${selectedMembership === 'Skyline' ? 0 : additionalMembers.length * 25}
                    </Text>
                  </HStack>
                  <Divider />
                  <HStack justify="space-between">
                    <Text fontSize="md" fontWeight="bold" color="#353535">
                      Total
                    </Text>
                    <Text fontSize="xl" fontWeight="bold" color="#A59480">
                      ${selectedPlan?.base_fee + (selectedMembership === 'Skyline' ? 0 : additionalMembers.length * 25)}
                    </Text>
                  </HStack>
                </VStack>
              </Box>
            )}
          </VStack>
        );

      case 5:
        return (
          <VStack spacing={6} align="stretch">
            <Text fontSize="xl" fontWeight="bold" color="#353535">
              Complete Your Payment
            </Text>

            <Box
              p={4}
              bg="white"
              borderRadius="md"
              borderWidth="2px"
              borderColor="gray.300"
            >
              <VStack align="stretch" spacing={2}>
                <HStack justify="space-between">
                  <Text fontSize="md" fontWeight="medium">
                    {selectedPlan?.type} Membership
                  </Text>
                  <Text fontSize="md" fontWeight="bold" color="#A59480">
                    ${selectedPlan?.base_fee}
                  </Text>
                </HStack>
                {additionalMembers.length > 0 && (
                  <>
                    <HStack justify="space-between">
                      <Text fontSize="sm" color="gray.600">
                        Additional Members ({additionalMembers.length})
                      </Text>
                      <Text fontSize="sm" fontWeight="medium">
                        ${selectedMembership === 'Skyline' ? 0 : additionalMembers.length * 25}
                      </Text>
                    </HStack>
                    <Divider />
                    <HStack justify="space-between">
                      <Text fontSize="lg" fontWeight="bold">
                        Total
                      </Text>
                      <Text fontSize="xl" fontWeight="bold" color="#A59480">
                        ${selectedPlan?.base_fee + (selectedMembership === 'Skyline' ? 0 : additionalMembers.length * 25)}
                      </Text>
                    </HStack>
                  </>
                )}
              </VStack>
            </Box>

            <Elements stripe={stripePromise}>
              <PaymentForm
                token={token}
                selectedMembership={selectedMembership}
                onSuccess={handlePaymentSuccess}
                additionalMembersCount={additionalMembers.length}
                waitlistData={waitlistData}
              />
            </Elements>
          </VStack>
        );

      case 6:
        return (
          <VStack spacing={6} align="stretch">
            <VStack spacing={2} align="center">
              <Icon as={Check} w={16} h={16} color="#A59480" />
              <Text fontSize="2xl" fontWeight="bold" color="#353535">
                Welcome to Noir! 🎉
              </Text>
              <Text fontSize="md" color="gray.600" textAlign="center">
                Your membership is now active. Check your phone for login instructions.
              </Text>
            </VStack>

            <Divider />

            <FormControl>
              <FormLabel>Please let us know if you have any special requests. (Optional)</FormLabel>
              <Textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Any special requests or preferences..."
                rows={4}
                bg="white"
                borderWidth="2px"
                _focus={{ borderColor: '#A59480' }}
              />
            </FormControl>

            <Button
              size="lg"
              bg="#A59480"
              color="white"
              _hover={{ bg: '#8F7F6B' }}
              onClick={onComplete}
              boxShadow="0 2px 4px rgba(0,0,0,0.1), 0 4px 8px rgba(0,0,0,0.1), 0 8px 16px rgba(0,0,0,0.1)"
              minH="56px"
              w="full"
            >
              Complete Onboarding
            </Button>
          </VStack>
        );

      default:
        return null;
    }
  };

  return (
    <Box w="100%" maxW="700px" mx="auto" px={4}>
      {/* Animated Step Card */}
      <AnimatePresence mode="wait" custom={direction}>
        <MotionBox
          key={currentStep}
          custom={direction}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{
            x: { type: 'spring', stiffness: 300, damping: 30 },
            opacity: { duration: 0.2 },
            scale: { duration: 0.2 }
          }}
        >
          <Card
            boxShadow="0 2px 4px rgba(0,0,0,0.1), 0 4px 8px rgba(0,0,0,0.1), 0 8px 16px rgba(0,0,0,0.1)"
            borderRadius="xl"
            bg="#ECEDE8"
          >
            <CardBody p={8}>
              <VStack spacing={4} align="stretch">
                {/* Step Header */}
                <HStack spacing={3}>
                  <Box
                    bg="#A59480"
                    borderRadius="full"
                    p={3}
                    boxShadow="0 2px 4px rgba(0,0,0,0.1)"
                  >
                    <Icon
                      as={STEPS[currentStep - 1].icon}
                      w={6}
                      h={6}
                      color="white"
                    />
                  </Box>
                  <VStack align="start" spacing={0}>
                    <Text fontSize="sm" color="gray.600" fontWeight="medium">
                      Step {currentStep} of {STEPS.length}
                    </Text>
                    <Text fontSize="2xl" fontWeight="bold" color="#353535">
                      {STEPS[currentStep - 1].name}
                    </Text>
                  </VStack>
                </HStack>

                {/* Step Content */}
                {renderStepContent()}

                {/* Navigation Buttons (not for payment or final step) */}
                {currentStep !== 5 && currentStep !== 6 && (
                  <HStack spacing={3} pt={4}>
                    <Button
                      leftIcon={<Icon as={ArrowLeft} />}
                      onClick={handleBack}
                      isDisabled={currentStep === 1}
                      variant="outline"
                      flex={1}
                      size="lg"
                      minH="56px"
                      borderWidth="2px"
                      borderColor="gray.300"
                      color="#353535"
                      _hover={{ borderColor: '#A59480', bg: '#A5948010' }}
                      _disabled={{ opacity: 0.3 }}
                    >
                      Back
                    </Button>

                    <Button
                      rightIcon={<Icon as={ArrowRight} />}
                      onClick={handleNext}
                      bg="#A59480"
                      color="white"
                      flex={2}
                      size="lg"
                      minH="56px"
                      _hover={{ bg: '#8F7F6B' }}
                      boxShadow="0 2px 4px rgba(0,0,0,0.1), 0 4px 8px rgba(0,0,0,0.1), 0 8px 16px rgba(0,0,0,0.1)"
                    >
                      {currentStep === 1 ? 'Next' : currentStep === 2 ? 'I Accept' : 'Continue'}
                    </Button>
                  </HStack>
                )}
              </VStack>
            </CardBody>
          </Card>
        </MotionBox>
      </AnimatePresence>

      {/* Progress Bar Below */}
      <VStack spacing={3} mt={6} align="stretch">
        <HStack justify="space-between">
          {STEPS.map((step, index) => (
            <Box
              key={step.id}
              w={10}
              h={10}
              borderRadius="full"
              bg={currentStep >= step.id ? '#A59480' : 'gray.300'}
              display="flex"
              alignItems="center"
              justifyContent="center"
              transition="all 0.3s"
            >
              <Icon
                as={currentStep > step.id ? Check : step.icon}
                color="white"
                w={5}
                h={5}
              />
            </Box>
          ))}
        </HStack>
        <Progress
          value={progress}
          borderRadius="full"
          bg="gray.300"
          sx={{
            '& > div': {
              background: 'linear-gradient(90deg, #A59480 0%, #8F7F6B 100%)'
            }
          }}
          h="6px"
        />
      </VStack>

      {/* Additional Member Modal */}
      <AdditionalMemberModal
        isOpen={isAddMemberModalOpen}
        onClose={() => {
          setIsAddMemberModalOpen(false);
          setEditingMemberIndex(undefined);
        }}
        onSave={(member) => {
          if (editingMemberIndex !== undefined) {
            // Edit existing member
            const newMembers = [...additionalMembers];
            newMembers[editingMemberIndex] = member;
            setAdditionalMembers(newMembers);
          } else {
            // Add new member
            setAdditionalMembers([...additionalMembers, member]);
          }
          setEditingMemberIndex(undefined);
        }}
        editingMember={editingMemberIndex !== undefined ? additionalMembers[editingMemberIndex] : undefined}
        editingIndex={editingMemberIndex}
      />
    </Box>
  );
}
