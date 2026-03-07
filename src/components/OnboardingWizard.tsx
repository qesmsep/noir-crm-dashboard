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
import { ArrowLeft, ArrowRight, Check, FileText, CreditCard, DollarSign, User, Upload } from 'lucide-react';
import SignatureCanvas from '@/components/SignatureCanvas';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
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
  { id: 3, name: 'Payment', icon: DollarSign },
  { id: 4, name: 'Profile', icon: User }
];

function PaymentForm({ token, selectedMembership, onSuccess }: any) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const toast = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) return;

    setSubmitting(true);

    try {
      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/onboard/success`,
        },
        redirect: 'if_required'
      });

      if (error) {
        throw error;
      }

      // Confirm member creation on backend
      const response = await fetch('/api/onboard/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          membership_type: selectedMembership
        })
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

  return (
    <form onSubmit={handleSubmit}>
      <VStack spacing={6} align="stretch">
        <PaymentElement />
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

  // Step 3: Payment
  const [clientSecret, setClientSecret] = useState('');

  // Step 4: Profile
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
      if (await validateAndCreatePaymentIntent()) {
        setDirection('forward');
        setCurrentStep(3);
      }
    } else if (currentStep === 3) {
      // Payment handled by PaymentForm
    } else if (currentStep === 4) {
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

    if (!agreed) {
      toast({
        title: 'Agreement Required',
        description: 'Please agree to the terms',
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

  const validateAndCreatePaymentIntent = async (): Promise<boolean> => {
    if (!selectedMembership) {
      toast({
        title: 'Select Membership',
        description: 'Please select a membership type',
        status: 'warning',
        duration: 3000,
      });
      return false;
    }

    try {
      const response = await fetch('/api/payment/create-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          membership_type: selectedMembership
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
    setCurrentStep(4);
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
          <VStack spacing={6} align="stretch">
            <HStack justify="space-between" flexWrap="wrap" gap={2}>
              <Badge colorScheme="purple" fontSize="sm" px={3} py={1}>
                {waitlistData.first_name} {waitlistData.last_name}
              </Badge>
            </HStack>

            <Divider />

            <Box
              maxH="300px"
              overflowY="auto"
              p={4}
              bg="white"
              borderRadius="md"
              borderWidth="2px"
              borderColor="gray.300"
            >
              <Text whiteSpace="pre-wrap" fontSize="sm" lineHeight="tall" color="#353535">
                {agreementContent}
              </Text>
            </Box>

            <Divider />

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

            <Checkbox
              isChecked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              colorScheme="orange"
              size="lg"
            >
              <Text fontSize="md" fontWeight="medium" color="#353535">
                I agree to the terms of this agreement
              </Text>
            </Checkbox>
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
                    key={plan.type}
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

            {selectedPlan && (
              <Box
                p={4}
                bg="#A5948010"
                borderRadius="md"
                borderLeftWidth="4px"
                borderLeftColor="#A59480"
              >
                <Text fontSize="sm" fontWeight="medium">
                  ✨ Selected: {selectedPlan.type} Membership - ${selectedPlan.base_fee}
                </Text>
              </Box>
            )}
          </VStack>
        );

      case 3:
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
              <HStack justify="space-between">
                <Text fontSize="md" fontWeight="medium">
                  {selectedPlan?.type} Membership
                </Text>
                <Text fontSize="xl" fontWeight="bold" color="#A59480">
                  ${selectedPlan?.base_fee}
                </Text>
              </HStack>
            </Box>

            {clientSecret && (
              <Elements stripe={stripePromise} options={{ clientSecret }}>
                <PaymentForm
                  token={token}
                  selectedMembership={selectedMembership}
                  onSuccess={handlePaymentSuccess}
                />
              </Elements>
            )}
          </VStack>
        );

      case 4:
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
                {currentStep !== 3 && (
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

                    {currentStep !== 4 && (
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
                        Continue
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
