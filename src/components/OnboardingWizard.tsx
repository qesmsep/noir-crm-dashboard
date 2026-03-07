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
import { ArrowLeft, ArrowRight, Check, FileText, CreditCard, DollarSign, User, Upload, Building2, UserPlus } from 'lucide-react';
import SignatureCanvas from '@/components/SignatureCanvas';
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
  { id: 1, name: 'Agreement', icon: FileText },
  { id: 2, name: 'Membership', icon: CreditCard },
  { id: 3, name: 'Additional Members', icon: UserPlus },
  { id: 4, name: 'Payment', icon: DollarSign },
  { id: 5, name: 'Profile', icon: User }
];

function PaymentForm({ token, selectedMembership, onSuccess, clientSecret, waitlistData }: any) {
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

      // Confirm card payment
      const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
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
        clientSecret: clientSecret,
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

  // Step 1: Agreement
  const [signerName, setSignerName] = useState(`${waitlistData.first_name} ${waitlistData.last_name}`);
  const [signerEmail, setSignerEmail] = useState(waitlistData.email);
  const [signatureData, setSignatureData] = useState('');
  const [agreed, setAgreed] = useState(false);

  // Step 2: Membership
  const [selectedMembership, setSelectedMembership] = useState(
    waitlistData.selected_membership || membershipPlans[0]?.type || ''
  );

  // Step 3: Additional Members
  const [additionalMembers, setAdditionalMembers] = useState<Array<{
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    dob: string;
  }>>([]);

  // Step 4: Payment
  const [clientSecret, setClientSecret] = useState('');

  // Step 5: Profile
  const [photoUrl, setPhotoUrl] = useState('');
  const [bio, setBio] = useState('');
  const [preferences, setPreferences] = useState({
    newsletter: true,
    smsNotifications: true
  });

  const progress = (currentStep / STEPS.length) * 100;

  const handleNext = async () => {
    if (currentStep === 1) {
      if (await validateAndSaveAgreement()) {
        setDirection('forward');
        setCurrentStep(2);
      }
    } else if (currentStep === 2) {
      if (await validateMembershipSelection()) {
        setDirection('forward');
        setCurrentStep(3);
      }
    } else if (currentStep === 3) {
      // Additional members step - save and continue to payment
      if (await saveAdditionalMembers()) {
        if (await validateAndCreatePaymentIntent()) {
          setDirection('forward');
          setCurrentStep(4);
        }
      }
    } else if (currentStep === 4) {
      // Payment handled by PaymentForm
    } else if (currentStep === 5) {
      await handleCompleteProfile();
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setDirection('backward');
      setCurrentStep(prev => prev - 1);
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

  const validateAndCreatePaymentIntent = async (): Promise<boolean> => {
    try {
      const response = await fetch('/api/payment/create-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          membership_type: selectedMembership,
          additional_members_count: additionalMembers.length
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create payment intent');
      }

      const data = await response.json();
      setClientSecret(data.client_secret);
      return true;
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to initialize payment',
        status: 'error',
        duration: 5000,
      });
      return false;
    }
  };

  const handleCompleteProfile = async () => {
    // Optional profile completion - can skip
    onComplete();
  };

  const handlePaymentSuccess = () => {
    setDirection('forward');
    setCurrentStep(5);
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

            <Divider />

            <VStack spacing={3} align="stretch">
              <FormControl isRequired>
                <FormLabel>Full Name</FormLabel>
                <Input
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                  size="lg"
                  bg="white"
                  borderWidth="2px"
                  _focus={{ borderColor: '#A59480' }}
                />
              </FormControl>

              <FormControl isRequired>
                <FormLabel>Email Address</FormLabel>
                <Input
                  type="email"
                  value={signerEmail}
                  onChange={(e) => setSignerEmail(e.target.value)}
                  size="lg"
                  bg="white"
                  borderWidth="2px"
                  _focus={{ borderColor: '#A59480' }}
                />
              </FormControl>
            </VStack>

            <Box
              p={4}
              bg="#A5948010"
              borderRadius="md"
              borderLeftWidth="4px"
              borderLeftColor="#A59480"
            >
              <Text fontSize="sm" color="#353535" fontWeight="medium">
                ⚖️ Electronic signature has the same legal effect as handwritten
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

      case 2:
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
                    <HStack justify="space-between" align="start">
                      <Radio value={plan.type} colorScheme="orange" size="lg">
                        <VStack align="start" spacing={1}>
                          <Text fontSize="lg" fontWeight="bold">
                            {plan.type}
                          </Text>
                          <Text fontSize="sm" color="gray.600">
                            {plan.description}
                          </Text>
                        </VStack>
                      </Radio>
                      <VStack align="end" spacing={0}>
                        <Text fontSize="2xl" fontWeight="bold" color="#A59480">
                          ${plan.base_fee}
                        </Text>
                        <Text fontSize="xs" color="gray.500">
                          one-time fee
                        </Text>
                      </VStack>
                    </HStack>
                  </Box>
                ))}
              </VStack>
            </RadioGroup>
          </VStack>
        );

      case 3:
        return (
          <VStack spacing={6} align="stretch">
            <Text fontSize="xl" fontWeight="bold" color="#353535">
              Add Additional Members (Optional)
            </Text>

            <Text fontSize="sm" color="gray.600">
              {selectedMembership === 'Skyline'
                ? 'Skyline members can add unlimited additional members at no extra cost!'
                : 'Add additional members to your account for $25/month each.'}
            </Text>

            {/* Display existing additional members */}
            {additionalMembers.map((member, index) => (
              <Box
                key={index}
                p={4}
                borderWidth="2px"
                borderColor="#A59480"
                borderRadius="lg"
                bg="#A5948010"
              >
                <HStack justify="space-between" mb={3}>
                  <Text fontSize="md" fontWeight="bold" color="#353535">
                    Additional Member #{index + 1}
                  </Text>
                  <Button
                    size="sm"
                    variant="ghost"
                    color="red.500"
                    onClick={() => {
                      const newMembers = [...additionalMembers];
                      newMembers.splice(index, 1);
                      setAdditionalMembers(newMembers);
                    }}
                  >
                    Remove
                  </Button>
                </HStack>

                <VStack spacing={3}>
                  <HStack spacing={3} w="full">
                    <FormControl isRequired>
                      <FormLabel fontSize="sm">First Name</FormLabel>
                      <Input
                        value={member.first_name}
                        onChange={(e) => {
                          const newMembers = [...additionalMembers];
                          newMembers[index].first_name = e.target.value;
                          setAdditionalMembers(newMembers);
                        }}
                        size="md"
                        bg="white"
                        borderWidth="2px"
                        _focus={{ borderColor: '#A59480' }}
                      />
                    </FormControl>

                    <FormControl isRequired>
                      <FormLabel fontSize="sm">Last Name</FormLabel>
                      <Input
                        value={member.last_name}
                        onChange={(e) => {
                          const newMembers = [...additionalMembers];
                          newMembers[index].last_name = e.target.value;
                          setAdditionalMembers(newMembers);
                        }}
                        size="md"
                        bg="white"
                        borderWidth="2px"
                        _focus={{ borderColor: '#A59480' }}
                      />
                    </FormControl>
                  </HStack>

                  <FormControl isRequired>
                    <FormLabel fontSize="sm">Email</FormLabel>
                    <Input
                      type="email"
                      value={member.email}
                      onChange={(e) => {
                        const newMembers = [...additionalMembers];
                        newMembers[index].email = e.target.value;
                        setAdditionalMembers(newMembers);
                      }}
                      size="md"
                      bg="white"
                      borderWidth="2px"
                      _focus={{ borderColor: '#A59480' }}
                    />
                  </FormControl>

                  <FormControl isRequired>
                    <FormLabel fontSize="sm">Phone</FormLabel>
                    <Input
                      type="tel"
                      value={member.phone}
                      onChange={(e) => {
                        const newMembers = [...additionalMembers];
                        newMembers[index].phone = e.target.value;
                        setAdditionalMembers(newMembers);
                      }}
                      size="md"
                      bg="white"
                      borderWidth="2px"
                      _focus={{ borderColor: '#A59480' }}
                      placeholder="(555) 555-5555"
                    />
                  </FormControl>

                  <FormControl isRequired>
                    <FormLabel fontSize="sm">Date of Birth</FormLabel>
                    <Input
                      type="date"
                      value={member.dob}
                      onChange={(e) => {
                        const newMembers = [...additionalMembers];
                        newMembers[index].dob = e.target.value;
                        setAdditionalMembers(newMembers);
                      }}
                      size="md"
                      bg="white"
                      borderWidth="2px"
                      _focus={{ borderColor: '#A59480' }}
                    />
                  </FormControl>
                </VStack>
              </Box>
            ))}

            {/* Add member button */}
            <Button
              leftIcon={<Icon as={UserPlus} />}
              onClick={() => {
                setAdditionalMembers([
                  ...additionalMembers,
                  { first_name: '', last_name: '', email: '', phone: '', dob: '' }
                ]);
              }}
              variant="outline"
              borderWidth="2px"
              borderColor="#A59480"
              color="#A59480"
              _hover={{ bg: '#A5948010' }}
              size="lg"
            >
              Add Member
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

      case 4:
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

            {clientSecret && (
              <Elements stripe={stripePromise} options={{ clientSecret }}>
                <PaymentForm
                  token={token}
                  selectedMembership={selectedMembership}
                  onSuccess={handlePaymentSuccess}
                  clientSecret={clientSecret}
                  waitlistData={waitlistData}
                />
              </Elements>
            )}
          </VStack>
        );

      case 5:
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
              <FormLabel>Profile Photo (Optional)</FormLabel>
              <Button
                as="label"
                htmlFor="photo-upload"
                leftIcon={<Icon as={Upload} />}
                variant="outline"
                w="full"
              >
                Upload Photo
              </Button>
              <Input
                id="photo-upload"
                type="file"
                accept="image/*"
                display="none"
              />
            </FormControl>

            <FormControl>
              <FormLabel>Bio (Optional)</FormLabel>
              <Textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell us about yourself..."
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
            >
              Complete Onboarding
            </Button>

            <Button
              variant="ghost"
              onClick={onComplete}
              color="gray.600"
            >
              Skip for now
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
              <VStack spacing={6} align="stretch">
                {/* Step Header */}
                <HStack spacing={3} mb={4}>
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
                {currentStep !== 4 && (
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

                    {currentStep !== 5 && (
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
                        {currentStep === 1 ? 'I Accept' : 'Continue'}
                      </Button>
                    )}
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
            <VStack key={step.id} spacing={1} flex={1} align="center">
              <Box
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
              <Text
                fontSize="xs"
                fontWeight="medium"
                color={currentStep >= step.id ? '#A59480' : 'gray.500'}
              >
                {step.name}
              </Text>
            </VStack>
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
    </Box>
  );
}
